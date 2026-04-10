"""
DPO (Direct Preference Optimization) 对齐训练
无需奖励模型的直接偏好优化，比RLHF更简单高效
"""

import os
import math
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

logger = logging.getLogger(__name__)


@dataclass
class DPOConfig:
    """DPO配置"""
    beta: float = 0.1
    learning_rate: float = 5e-7
    weight_decay: float = 0.01
    warmup_steps: int = 100
    max_steps: int = 1000
    batch_size: int = 4
    gradient_accumulation_steps: int = 1
    max_length: int = 1024
    max_prompt_length: int = 512
    reference_free: bool = False
    label_smoothing: float = 0.0
    use_sigmoid: bool = True
    
    output_dir: str = "output/dpo"
    save_steps: int = 100
    eval_steps: int = 50
    logging_steps: int = 10


@dataclass
class PreferenceSample:
    """偏好样本"""
    prompt: str
    chosen: str
    rejected: str
    prompt_ids: Optional[torch.Tensor] = None
    chosen_ids: Optional[torch.Tensor] = None
    rejected_ids: Optional[torch.Tensor] = None


class PreferenceDataset(Dataset):
    """偏好数据集"""
    
    def __init__(
        self,
        samples: List[PreferenceSample],
        tokenizer,
        max_length: int = 1024,
        max_prompt_length: int = 512,
    ):
        self.samples = samples
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.max_prompt_length = max_prompt_length
        
        self._tokenize_samples()
    
    def _tokenize_samples(self):
        """预处理tokenize"""
        for sample in self.samples:
            sample.prompt_ids = self.tokenizer.encode(
                sample.prompt,
                max_length=self.max_prompt_length,
                truncation=True,
            )
            
            chosen_text = sample.prompt + sample.chosen
            rejected_text = sample.prompt + sample.rejected
            
            sample.chosen_ids = self.tokenizer.encode(
                chosen_text,
                max_length=self.max_length,
                truncation=True,
            )
            
            sample.rejected_ids = self.tokenizer.encode(
                rejected_text,
                max_length=self.max_length,
                truncation=True,
            )
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        sample = self.samples[idx]
        return {
            "prompt_ids": torch.tensor(sample.prompt_ids, dtype=torch.long),
            "chosen_ids": torch.tensor(sample.chosen_ids, dtype=torch.long),
            "rejected_ids": torch.tensor(sample.rejected_ids, dtype=torch.long),
            "prompt_length": len(sample.prompt_ids),
        }


def collate_preference_data(batch: List[Dict]) -> Dict[str, torch.Tensor]:
    """整理偏好数据批次"""
    prompt_ids = [item["prompt_ids"] for item in batch]
    chosen_ids = [item["chosen_ids"] for item in batch]
    rejected_ids = [item["rejected_ids"] for item in batch]
    
    max_prompt_len = max(len(ids) for ids in prompt_ids)
    max_chosen_len = max(len(ids) for ids in chosen_ids)
    max_rejected_len = max(len(ids) for ids in rejected_ids)
    
    def pad_sequence(sequences, max_len, pad_value=0):
        padded = []
        masks = []
        for seq in sequences:
            padding_len = max_len - len(seq)
            padded_seq = torch.cat([
                seq,
                torch.full((padding_len,), pad_value, dtype=seq.dtype)
            ])
            mask = torch.cat([
                torch.ones(len(seq)),
                torch.zeros(padding_len)
            ])
            padded.append(padded_seq)
            masks.append(mask)
        return torch.stack(padded), torch.stack(masks)
    
    prompt_batch, prompt_mask = pad_sequence(prompt_ids, max_prompt_len)
    chosen_batch, chosen_mask = pad_sequence(chosen_ids, max_chosen_len)
    rejected_batch, rejected_mask = pad_sequence(rejected_ids, max_rejected_len)
    
    return {
        "prompt_ids": prompt_batch,
        "prompt_mask": prompt_mask,
        "chosen_ids": chosen_batch,
        "chosen_mask": chosen_mask,
        "rejected_ids": rejected_batch,
        "rejected_mask": rejected_mask,
    }


class DPOTrainer:
    """DPO训练器"""
    
    def __init__(
        self,
        model: nn.Module,
        ref_model: nn.Module,
        config: DPOConfig,
        tokenizer=None,
    ):
        self.model = model
        self.ref_model = ref_model
        self.config = config
        self.tokenizer = tokenizer
        
        self.ref_model.eval()
        for param in self.ref_model.parameters():
            param.requires_grad = False
        
        self.optimizer = torch.optim.AdamW(
            self.model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        self.step = 0
        self.best_loss = float('inf')
    
    def compute_logprobs(
        self,
        model: nn.Module,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        prompt_length: int,
    ) -> torch.Tensor:
        """计算log probabilities"""
        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        
        logits = outputs['logits']
        
        shift_logits = logits[..., :-1, :].contiguous()
        shift_labels = input_ids[..., 1:].contiguous()
        
        log_probs = F.log_softmax(shift_logits, dim=-1)
        
        selected_log_probs = log_probs.gather(
            dim=-1,
            index=shift_labels.unsqueeze(-1)
        ).squeeze(-1)
        
        response_mask = attention_mask[:, 1:].clone()
        response_mask[:, :prompt_length] = 0
        
        response_log_probs = selected_log_probs * response_mask
        total_log_probs = response_log_probs.sum(dim=-1)
        
        return total_log_probs
    
    def compute_dpo_loss(
        self,
        policy_chosen_logps: torch.Tensor,
        policy_rejected_logps: torch.Tensor,
        reference_chosen_logps: torch.Tensor,
        reference_rejected_logps: torch.Tensor,
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        """计算DPO损失"""
        chosen_logratios = policy_chosen_logps - reference_chosen_logps
        rejected_logratios = policy_rejected_logps - reference_rejected_logps
        
        if self.config.use_sigmoid:
            logits = chosen_logratios - rejected_logratios
            loss = -F.logsigmoid(self.config.beta * logits)
            
            if self.config.label_smoothing > 0:
                loss = (1 - self.config.label_smoothing) * loss + \
                       self.config.label_smoothing * F.logsigmoid(-self.config.beta * logits)
        else:
            logits = self.config.beta * (chosen_logratios - rejected_logratios)
            loss = -F.logsigmoid(logits)
        
        loss = loss.mean()
        
        with torch.no_grad():
            accuracy = (chosen_logratios > rejected_logratios).float().mean()
            chosen_rewards = self.config.beta * chosen_logratios
            rejected_rewards = self.config.beta * rejected_logratios
            reward_margin = chosen_rewards.mean() - rejected_rewards.mean()
        
        metrics = {
            "loss": loss.item(),
            "accuracy": accuracy.item(),
            "chosen_rewards": chosen_rewards.mean().item(),
            "rejected_rewards": rejected_rewards.mean().item(),
            "reward_margin": reward_margin.item(),
        }
        
        return loss, metrics
    
    def train_step(self, batch: Dict[str, torch.Tensor]) -> Dict[str, float]:
        """单步训练"""
        prompt_ids = batch["prompt_ids"]
        prompt_mask = batch["prompt_mask"]
        chosen_ids = batch["chosen_ids"]
        chosen_mask = batch["chosen_mask"]
        rejected_ids = batch["rejected_ids"]
        rejected_mask = batch["rejected_mask"]
        
        prompt_length = prompt_ids.shape[1]
        
        policy_chosen_logps = self.compute_logprobs(
            self.model, chosen_ids, chosen_mask, prompt_length
        )
        policy_rejected_logps = self.compute_logprobs(
            self.model, rejected_ids, rejected_mask, prompt_length
        )
        
        with torch.no_grad():
            reference_chosen_logps = self.compute_logprobs(
                self.ref_model, chosen_ids, chosen_mask, prompt_length
            )
            reference_rejected_logps = self.compute_logprobs(
                self.ref_model, rejected_ids, rejected_mask, prompt_length
            )
        
        loss, metrics = self.compute_dpo_loss(
            policy_chosen_logps,
            policy_rejected_logps,
            reference_chosen_logps,
            reference_rejected_logps,
        )
        
        loss.backward()
        
        self.optimizer.step()
        self.optimizer.zero_grad()
        
        self.step += 1
        
        return metrics
    
    def train(
        self,
        train_dataset: PreferenceDataset,
        eval_dataset: Optional[PreferenceDataset] = None,
    ):
        """完整训练"""
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            collate_fn=collate_preference_data,
        )
        
        logger.info(f"开始DPO训练，共 {self.config.max_steps} 步")
        
        for epoch in range(100):
            for batch in train_loader:
                if self.step >= self.config.max_steps:
                    logger.info("训练完成")
                    return
                
                metrics = self.train_step(batch)
                
                if self.step % self.config.logging_steps == 0:
                    logger.info(
                        f"Step {self.step}: "
                        f"loss={metrics['loss']:.4f}, "
                        f"accuracy={metrics['accuracy']:.4f}, "
                        f"reward_margin={metrics['reward_margin']:.4f}"
                    )
                
                if self.step % self.config.save_steps == 0:
                    self.save_checkpoint()
                
                if eval_dataset and self.step % self.config.eval_steps == 0:
                    eval_metrics = self.evaluate(eval_dataset)
                    logger.info(f"评估: {eval_metrics}")
    
    def evaluate(self, dataset: PreferenceDataset) -> Dict[str, float]:
        """评估"""
        loader = DataLoader(
            dataset,
            batch_size=self.config.batch_size,
            collate_fn=collate_preference_data,
        )
        
        total_loss = 0.0
        total_accuracy = 0.0
        num_batches = 0
        
        self.model.eval()
        
        with torch.no_grad():
            for batch in loader:
                prompt_ids = batch["prompt_ids"]
                prompt_mask = batch["prompt_mask"]
                chosen_ids = batch["chosen_ids"]
                chosen_mask = batch["chosen_mask"]
                rejected_ids = batch["rejected_ids"]
                rejected_mask = batch["rejected_mask"]
                
                prompt_length = prompt_ids.shape[1]
                
                policy_chosen_logps = self.compute_logprobs(
                    self.model, chosen_ids, chosen_mask, prompt_length
                )
                policy_rejected_logps = self.compute_logprobs(
                    self.model, rejected_ids, rejected_mask, prompt_length
                )
                
                reference_chosen_logps = self.compute_logprobs(
                    self.ref_model, chosen_ids, chosen_mask, prompt_length
                )
                reference_rejected_logps = self.compute_logprobs(
                    self.ref_model, rejected_ids, rejected_mask, prompt_length
                )
                
                _, metrics = self.compute_dpo_loss(
                    policy_chosen_logps,
                    policy_rejected_logps,
                    reference_chosen_logps,
                    reference_rejected_logps,
                )
                
                total_loss += metrics['loss']
                total_accuracy += metrics['accuracy']
                num_batches += 1
        
        self.model.train()
        
        return {
            "eval_loss": total_loss / num_batches,
            "eval_accuracy": total_accuracy / num_batches,
        }
    
    def save_checkpoint(self, path: Optional[str] = None):
        """保存检查点"""
        if path is None:
            path = os.path.join(self.config.output_dir, f"checkpoint_{self.step}")
        
        os.makedirs(path, exist_ok=True)
        
        torch.save({
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "step": self.step,
            "config": self.config.__dict__,
        }, os.path.join(path, "checkpoint.pt"))
        
        logger.info(f"检查点已保存到 {path}")


class SFTTrainer:
    """SFT (Supervised Fine-Tuning) 训练器"""
    
    def __init__(
        self,
        model: nn.Module,
        learning_rate: float = 1e-5,
        weight_decay: float = 0.01,
        warmup_steps: int = 100,
        max_steps: int = 1000,
    ):
        self.model = model
        self.learning_rate = learning_rate
        self.weight_decay = weight_decay
        self.warmup_steps = warmup_steps
        self.max_steps = max_steps
        
        self.optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay,
        )
        
        self.scheduler = None
        self.step = 0
    
    def train_step(self, batch: Dict[str, torch.Tensor]) -> float:
        """单步训练"""
        outputs = self.model(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"],
            labels=batch["labels"],
        )
        
        loss = outputs['loss']
        loss.backward()
        
        self.optimizer.step()
        self.optimizer.zero_grad()
        
        self.step += 1
        
        return loss.item()
    
    def train(self, dataloader: DataLoader):
        """训练"""
        self.model.train()
        
        total_loss = 0.0
        num_batches = 0
        
        for batch in dataloader:
            if self.step >= self.max_steps:
                break
            
            loss = self.train_step(batch)
            total_loss += loss
            num_batches += 1
            
            if num_batches % 10 == 0:
                avg_loss = total_loss / num_batches
                logger.info(f"Step {self.step}, Loss: {avg_loss:.4f}")
        
        return {"loss": total_loss / num_batches}


def create_preference_samples_from_conversations(
    conversations: List[Dict[str, str]],
) -> List[PreferenceSample]:
    """从对话数据创建偏好样本"""
    samples = []
    
    for conv in conversations:
        if "prompt" in conv and "chosen" in conv and "rejected" in conv:
            sample = PreferenceSample(
                prompt=conv["prompt"],
                chosen=conv["chosen"],
                rejected=conv["rejected"],
            )
            samples.append(sample)
    
    return samples


if __name__ == "__main__":
    print("DPO (Direct Preference Optimization) 对齐训练")
    print("=" * 60)
    print("\nDPO vs RLHF 对比:")
    print("-" * 60)
    print("| 特性 | DPO | RLHF |")
    print("|------|-----|------|")
    print("| 需要奖励模型 | ❌ | ✅ |")
    print("| 训练稳定性 | 高 | 低 |")
    print("| 实现复杂度 | 简单 | 复杂 |")
    print("| 计算开销 | 低 | 高 |")
    print("| 对齐效果 | 好 | 好 |")
    print("-" * 60)
    
    print("\nDPO损失函数:")
    print("L_DPO = -E[log σ(β(log π(y_w|x) - log π_ref(y_w|x))")
    print("                    - β(log π(y_l|x) - log π_ref(y_l|x)))]")

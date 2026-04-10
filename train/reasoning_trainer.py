"""
Reasoning Model Training
推理模型训练 - 支持DeepSeek-R1风格的思考链训练
参考MiniMind项目实现
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
from torch.optim import AdamW

logger = logging.getLogger(__name__)


THINK_START = "<think_start>"
THINK_END = "<think_end>"
ANSWER_START = "<answer_start>"
ANSWER_END = "<answer_end>"

REASONING_TEMPLATE = f"""{THINK_START}
{{thinking}}
{THINK_END}

{ANSWER_START}
{{answer}}
{ANSWER_END}"""


@dataclass
class ReasoningConfig:
    """推理模型训练配置"""
    learning_rate: float = 1e-5
    weight_decay: float = 0.01
    warmup_steps: int = 100
    max_steps: int = 1000
    batch_size: int = 4
    gradient_accumulation_steps: int = 1
    max_length: int = 2048
    max_thinking_length: int = 1024
    
    think_token_penalty: float = 10.0
    answer_token_penalty: float = 5.0
    
    use_format_reward: bool = True
    format_reward_weight: float = 0.1
    
    output_dir: str = "output/reason"
    save_steps: int = 100
    eval_steps: int = 50
    logging_steps: int = 10


class ReasoningDataset(Dataset):
    """推理数据集"""
    
    def __init__(
        self,
        data: List[Dict[str, str]],
        tokenizer,
        max_length: int = 2048,
        max_thinking_length: int = 1024,
    ):
        self.data = data
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.max_thinking_length = max_thinking_length
        
        self.think_start_id = tokenizer.encode(THINK_START, add_special_tokens=False)
        self.think_end_id = tokenizer.encode(THINK_END, add_special_tokens=False)
        self.answer_start_id = tokenizer.encode(ANSWER_START, add_special_tokens=False)
        self.answer_end_id = tokenizer.encode(ANSWER_END, add_special_tokens=False)
        
        self._preprocess()
    
    def _preprocess(self):
        """预处理数据"""
        self.processed_data = []
        
        for item in self.data:
            conversations = item.get("conversations", [])
            
            for conv in conversations:
                role = conv.get("role", "")
                content = conv.get("content", "")
                
                if role == "assistant" and THINK_START in content:
                    thinking, answer = self._parse_reasoning_content(content)
                    
                    if thinking and answer:
                        prompt = ""
                        for c in conversations:
                            if c.get("role") == "user":
                                prompt = c.get("content", "")
                                break
                        
                        self.processed_data.append({
                            "prompt": prompt,
                            "thinking": thinking,
                            "answer": answer,
                            "full_response": content,
                        })
    
    def _parse_reasoning_content(self, content: str) -> Tuple[str, str]:
        """解析推理内容"""
        thinking = ""
        answer = ""
        
        if THINK_START in content and THINK_END in content:
            think_start_idx = content.find(THINK_START) + len(THINK_START)
            think_end_idx = content.find(THINK_END)
            thinking = content[think_start_idx:think_end_idx].strip()
        
        if ANSWER_START in content and ANSWER_END in content:
            answer_start_idx = content.find(ANSWER_START) + len(ANSWER_START)
            answer_end_idx = content.find(ANSWER_END)
            answer = content[answer_start_idx:answer_end_idx].strip()
        
        return thinking, answer
    
    def __len__(self):
        return len(self.processed_data)
    
    def __getitem__(self, idx):
        item = self.processed_data[idx]
        
        full_text = item["prompt"] + "\n" + item["full_response"]
        
        encoding = self.tokenizer(
            full_text,
            max_length=self.max_length,
            truncation=True,
            return_tensors="pt",
        )
        
        input_ids = encoding["input_ids"].squeeze(0)
        attention_mask = encoding["attention_mask"].squeeze(0)
        
        special_token_ids = self._find_special_token_positions(input_ids)
        
        return {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "special_token_positions": special_token_ids,
            "prompt": item["prompt"],
            "thinking": item["thinking"],
            "answer": item["answer"],
        }
    
    def _find_special_token_positions(self, input_ids: torch.Tensor) -> Dict[str, List[int]]:
        """查找特殊token位置"""
        positions = {
            "think_start": [],
            "think_end": [],
            "answer_start": [],
            "answer_end": [],
        }
        
        ids_list = input_ids.tolist()
        
        for token_name, token_ids in [
            ("think_start", self.think_start_id),
            ("think_end", self.think_end_id),
            ("answer_start", self.answer_start_id),
            ("answer_end", self.answer_end_id),
        ]:
            if isinstance(token_ids, int):
                token_ids = [token_ids]
            
            for i in range(len(ids_list) - len(token_ids) + 1):
                if ids_list[i:i+len(token_ids)] == token_ids:
                    positions[token_name].extend(range(i, i + len(token_ids)))
        
        return positions


class ReasoningTrainer:
    """
    推理模型训练器
    
    特点：
    1. 支持思考链(Chain-of-Thought)格式训练
    2. 特殊token位置惩罚机制
    3. 格式奖励函数
    """
    
    def __init__(
        self,
        model: nn.Module,
        config: ReasoningConfig,
        tokenizer=None,
    ):
        self.model = model
        self.config = config
        self.tokenizer = tokenizer
        
        self.optimizer = AdamW(
            model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        self.step = 0
        self.best_loss = float('inf')
        
        self._register_special_tokens()
    
    def _register_special_tokens(self):
        """注册特殊token"""
        if self.tokenizer is None:
            return
        
        special_tokens = {
            "think_start": THINK_START,
            "think_end": THINK_END,
            "answer_start": ANSWER_START,
            "answer_end": ANSWER_END,
        }
        
        existing_tokens = set(self.tokenizer.get_vocab().keys())
        new_tokens = [v for v in special_tokens.values() if v not in existing_tokens]
        
        if new_tokens:
            self.tokenizer.add_tokens(new_tokens)
            self.model.resize_token_embeddings(len(self.tokenizer))
            logger.info(f"添加了 {len(new_tokens)} 个新token: {new_tokens}")
    
    def compute_loss_mask(
        self,
        input_ids: torch.Tensor,
        special_positions: Dict[str, List[int]],
    ) -> torch.Tensor:
        """计算损失掩码，对特殊token位置增加惩罚"""
        batch_size, seq_len = input_ids.shape
        loss_mask = torch.ones(batch_size, seq_len, device=input_ids.device)
        
        for batch_idx in range(batch_size):
            positions = special_positions
            
            for pos in positions.get("think_start", []):
                if pos < seq_len:
                    loss_mask[batch_idx, pos] = self.config.think_token_penalty
            
            for pos in positions.get("think_end", []):
                if pos < seq_len:
                    loss_mask[batch_idx, pos] = self.config.think_token_penalty
            
            for pos in positions.get("answer_start", []):
                if pos < seq_len:
                    loss_mask[batch_idx, pos] = self.config.answer_token_penalty
            
            for pos in positions.get("answer_end", []):
                if pos < seq_len:
                    loss_mask[batch_idx, pos] = self.config.answer_token_penalty
        
        return loss_mask
    
    def compute_format_reward(
        self,
        generated_text: str,
    ) -> float:
        """计算格式奖励"""
        reward = 0.0
        
        if THINK_START in generated_text:
            reward += 0.25
        if THINK_END in generated_text:
            reward += 0.25
        if ANSWER_START in generated_text:
            reward += 0.25
        if ANSWER_END in generated_text:
            reward += 0.25
        
        think_start_idx = generated_text.find(THINK_START)
        think_end_idx = generated_text.find(THINK_END)
        answer_start_idx = generated_text.find(ANSWER_START)
        answer_end_idx = generated_text.find(ANSWER_END)
        
        if all(idx >= 0 for idx in [think_start_idx, think_end_idx, answer_start_idx, answer_end_idx]):
            if think_start_idx < think_end_idx < answer_start_idx < answer_end_idx:
                reward += 0.5
        
        return reward
    
    def train_step(self, batch: Dict[str, torch.Tensor]) -> Dict[str, float]:
        """训练步骤"""
        input_ids = batch["input_ids"]
        attention_mask = batch["attention_mask"]
        special_positions = batch["special_token_positions"]
        
        outputs = self.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=input_ids,
        )
        
        logits = outputs["logits"]
        shift_logits = logits[..., :-1, :].contiguous()
        shift_labels = input_ids[..., 1:].contiguous()
        
        loss_mask = self.compute_loss_mask(input_ids, special_positions)
        shift_mask = loss_mask[..., 1:].contiguous()
        
        loss_fct = nn.CrossEntropyLoss(reduction='none')
        loss = loss_fct(
            shift_logits.view(-1, shift_logits.size(-1)),
            shift_labels.view(-1)
        )
        
        loss = loss.view(shift_labels.shape)
        loss = (loss * shift_mask).sum() / shift_mask.sum()
        
        if self.config.use_format_reward:
            with torch.no_grad():
                generated = self.model.generate(
                    input_ids=input_ids[:, :50],
                    max_new_tokens=100,
                )
                generated_text = self.tokenizer.decode(generated[0], skip_special_tokens=False)
                format_reward = self.compute_format_reward(generated_text)
            
            format_loss = -self.config.format_reward_weight * format_reward
            total_loss = loss + format_loss
        else:
            total_loss = loss
        
        self.optimizer.zero_grad()
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.optimizer.step()
        
        self.step += 1
        
        return {
            "loss": total_loss.item(),
            "lm_loss": loss.item(),
            "format_reward": format_reward if self.config.use_format_reward else 0.0,
        }
    
    def train(
        self,
        train_dataset: ReasoningDataset,
        eval_dataset: Optional[ReasoningDataset] = None,
    ):
        """完整训练"""
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
        )
        
        logger.info(f"开始推理模型训练，共 {self.config.max_steps} 步")
        
        for epoch in range(1000):
            for batch in train_loader:
                if self.step >= self.config.max_steps:
                    logger.info("推理模型训练完成")
                    return
                
                metrics = self.train_step(batch)
                
                if self.step % self.config.logging_steps == 0:
                    logger.info(
                        f"Step {self.step}: "
                        f"loss={metrics['loss']:.4f}, "
                        f"format_reward={metrics['format_reward']:.4f}"
                    )
                
                if self.step % self.config.save_steps == 0:
                    self.save_checkpoint()
    
    def save_checkpoint(self, path: Optional[str] = None):
        """保存检查点"""
        if path is None:
            path = os.path.join(self.config.output_dir, f"reason_{self.step}")
        
        os.makedirs(path, exist_ok=True)
        
        torch.save({
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "step": self.step,
            "config": self.config.__dict__,
        }, os.path.join(path, "checkpoint.pt"))
        
        logger.info(f"推理模型检查点已保存到 {path}")
    
    @torch.no_grad()
    def generate_reasoning(
        self,
        prompt: str,
        max_new_tokens: int = 512,
        temperature: float = 0.7,
        top_p: float = 0.9,
    ) -> Dict[str, str]:
        """生成推理响应"""
        self.model.eval()
        
        input_ids = self.tokenizer.encode(prompt, return_tensors="pt")
        input_ids = input_ids.to(next(self.model.parameters()).device)
        
        output_ids = self.model.generate(
            input_ids=input_ids,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            do_sample=True,
        )
        
        full_response = self.tokenizer.decode(output_ids[0], skip_special_tokens=False)
        
        thinking = ""
        answer = ""
        
        if THINK_START in full_response and THINK_END in full_response:
            think_start_idx = full_response.find(THINK_START) + len(THINK_START)
            think_end_idx = full_response.find(THINK_END)
            thinking = full_response[think_start_idx:think_end_idx].strip()
        
        if ANSWER_START in full_response and ANSWER_END in full_response:
            answer_start_idx = full_response.find(ANSWER_START) + len(ANSWER_START)
            answer_end_idx = full_response.find(ANSWER_END)
            answer = full_response[answer_start_idx:answer_end_idx].strip()
        
        return {
            "full_response": full_response,
            "thinking": thinking,
            "answer": answer,
        }


def create_reasoning_sample(
    question: str,
    thinking_process: str,
    final_answer: str,
) -> Dict[str, Any]:
    """创建推理训练样本"""
    return {
        "conversations": [
            {"role": "user", "content": question},
            {"role": "assistant", "content": REASONING_TEMPLATE.format(
                thinking=thinking_process,
                answer=final_answer
            )}
        ]
    }


if __name__ == "__main__":
    print("=" * 70)
    print("Reasoning Model Training - 推理模型训练")
    print("=" * 70)
    print("\n推理模型格式模板:")
    print(REASONING_TEMPLATE.format(thinking="思考过程...", answer="最终答案"))
    print("\n特殊Token:")
    print(f"  思考开始: {THINK_START}")
    print(f"  思考结束: {THINK_END}")
    print(f"  答案开始: {ANSWER_START}")
    print(f"  答案结束: {ANSWER_END}")

"""
Knowledge Distillation Training
知识蒸馏训练 - 白盒蒸馏实现
参考MiniMind项目实现
"""

import os
import math
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from torch.optim import AdamW
from tqdm import tqdm

logger = logging.getLogger(__name__)


@dataclass
class DistillationConfig:
    """知识蒸馏配置"""
    learning_rate: float = 1e-5
    weight_decay: float = 0.01
    warmup_steps: int = 100
    max_steps: int = 1000
    batch_size: int = 4
    gradient_accumulation_steps: int = 1
    max_length: int = 512
    
    temperature: float = 2.0
    alpha: float = 0.5
    
    use_hidden_loss: bool = True
    hidden_loss_weight: float = 0.1
    
    use_attention_loss: bool = False
    attention_loss_weight: float = 0.05
    
    use_embedding_loss: bool = False
    embedding_loss_weight: float = 0.05
    
    output_dir: str = "output/distill"
    save_steps: int = 100
    eval_steps: int = 50
    logging_steps: int = 10


class DistillationDataset(Dataset):
    """蒸馏数据集"""
    
    def __init__(
        self,
        data: List[Dict[str, str]],
        tokenizer,
        max_length: int = 512,
    ):
        self.data = data
        self.tokenizer = tokenizer
        self.max_length = max_length
        
        self._preprocess()
    
    def _preprocess(self):
        """预处理数据"""
        self.processed_data = []
        
        for item in self.data:
            if "text" in item:
                text = item["text"]
            elif "conversations" in item:
                text = self._format_conversations(item["conversations"])
            else:
                continue
            
            encoding = self.tokenizer(
                text,
                max_length=self.max_length,
                truncation=True,
                return_tensors="pt",
            )
            
            self.processed_data.append({
                "input_ids": encoding["input_ids"].squeeze(0),
                "attention_mask": encoding["attention_mask"].squeeze(0),
                "text": text,
            })
    
    def _format_conversations(self, conversations: List[Dict]) -> str:
        """格式化对话"""
        formatted = []
        for conv in conversations:
            role = conv.get("role", "")
            content = conv.get("content", "")
            if role == "user":
                formatted.append(f"User: {content}")
            elif role == "assistant":
                formatted.append(f"Assistant: {content}")
        return "\n".join(formatted)
    
    def __len__(self):
        return len(self.processed_data)
    
    def __getitem__(self, idx):
        return self.processed_data[idx]


class DistillationTrainer:
    """
    知识蒸馏训练器
    
    支持两种蒸馏方式：
    1. 黑盒蒸馏：仅使用教师模型的输出概率分布
    2. 白盒蒸馏：同时使用教师模型的中间层表示
    
    损失函数：
    - KL散度损失：L_KL = KL(p_teacher || p_student)
    - 隐藏层损失：L_hidden = MSE(h_teacher, h_student)
    - 注意力损失：L_attn = MSE(A_teacher, A_student)
    """
    
    def __init__(
        self,
        student_model: nn.Module,
        teacher_model: nn.Module,
        config: DistillationConfig,
        tokenizer=None,
    ):
        self.student_model = student_model
        self.teacher_model = teacher_model
        self.config = config
        self.tokenizer = tokenizer
        
        self.teacher_model.eval()
        for param in self.teacher_model.parameters():
            param.requires_grad = False
        
        self.optimizer = AdamW(
            self.student_model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        self.step = 0
        self.best_loss = float('inf')
        
        self._align_layers()
    
    def _align_layers(self):
        """对齐学生和教师模型的层"""
        student_layers = self._get_num_layers(self.student_model)
        teacher_layers = self._get_num_layers(self.teacher_model)
        
        if teacher_layers > student_layers:
            self.layer_mapping = self._create_layer_mapping(
                student_layers, teacher_layers
            )
        else:
            self.layer_mapping = None
        
        logger.info(f"学生模型层数: {student_layers}, 教师模型层数: {teacher_layers}")
        if self.layer_mapping:
            logger.info(f"层映射: {self.layer_mapping}")
    
    def _get_num_layers(self, model: nn.Module) -> int:
        """获取模型层数"""
        if hasattr(model, 'config'):
            return getattr(model.config, 'num_hidden_layers', 
                          getattr(model.config, 'n_layers', 12))
        
        if hasattr(model, 'layers'):
            return len(model.layers)
        
        if hasattr(model, 'model') and hasattr(model.model, 'layers'):
            return len(model.model.layers)
        
        return 12
    
    def _create_layer_mapping(
        self,
        student_layers: int,
        teacher_layers: int,
    ) -> Dict[int, int]:
        """创建层映射"""
        mapping = {}
        for i in range(student_layers):
            teacher_idx = int(i * teacher_layers / student_layers)
            mapping[i] = teacher_idx
        return mapping
    
    def compute_kl_loss(
        self,
        student_logits: torch.Tensor,
        teacher_logits: torch.Tensor,
        labels: torch.Tensor,
        temperature: float = 2.0,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        计算KL散度损失
        
        Args:
            student_logits: 学生模型logits
            teacher_logits: 教师模型logits
            labels: 真实标签
            temperature: 温度参数
        """
        student_log_probs = F.log_softmax(student_logits / temperature, dim=-1)
        teacher_probs = F.softmax(teacher_logits / temperature, dim=-1)
        
        kl_loss = F.kl_div(
            student_log_probs,
            teacher_probs,
            reduction='batchmean'
        ) * (temperature ** 2)
        
        shift_logits = student_logits[..., :-1, :].contiguous()
        shift_labels = labels[..., 1:].contiguous()
        
        ce_loss = F.cross_entropy(
            shift_logits.view(-1, shift_logits.size(-1)),
            shift_labels.view(-1),
            ignore_index=0
        )
        
        return kl_loss, ce_loss
    
    def compute_hidden_loss(
        self,
        student_hiddens: List[torch.Tensor],
        teacher_hiddens: List[torch.Tensor],
    ) -> torch.Tensor:
        """计算隐藏层损失"""
        if not student_hiddens or not teacher_hiddens:
            return torch.tensor(0.0)
        
        total_loss = 0.0
        count = 0
        
        for i, student_hidden in enumerate(student_hiddens):
            if self.layer_mapping:
                teacher_idx = self.layer_mapping.get(i, -1)
            else:
                teacher_idx = min(i, len(teacher_hiddens) - 1)
            
            if teacher_idx < 0 or teacher_idx >= len(teacher_hiddens):
                continue
            
            teacher_hidden = teacher_hiddens[teacher_idx]
            
            if student_hidden.shape != teacher_hidden.shape:
                student_hidden_proj = self._project_hidden(student_hidden, teacher_hidden.shape[-1])
            else:
                student_hidden_proj = student_hidden
            
            loss = F.mse_loss(student_hidden_proj, teacher_hidden.detach())
            total_loss += loss
            count += 1
        
        return total_loss / max(count, 1)
    
    def _project_hidden(
        self,
        hidden: torch.Tensor,
        target_dim: int,
    ) -> torch.Tensor:
        """投影隐藏层到目标维度"""
        if hidden.shape[-1] == target_dim:
            return hidden
        
        if not hasattr(self, 'hidden_projectors'):
            self.hidden_projectors = {}
        
        key = f"{hidden.shape[-1]}_{target_dim}"
        if key not in self.hidden_projectors:
            self.hidden_projectors[key] = nn.Linear(
                hidden.shape[-1], target_dim, bias=False
            ).to(hidden.device)
        
        return self.hidden_projectors[key](hidden)
    
    def compute_attention_loss(
        self,
        student_attns: List[torch.Tensor],
        teacher_attns: List[torch.Tensor],
    ) -> torch.Tensor:
        """计算注意力损失"""
        if not student_attns or not teacher_attns:
            return torch.tensor(0.0)
        
        total_loss = 0.0
        count = 0
        
        for i, student_attn in enumerate(student_attns):
            if self.layer_mapping:
                teacher_idx = self.layer_mapping.get(i, -1)
            else:
                teacher_idx = min(i, len(teacher_attns) - 1)
            
            if teacher_idx < 0 or teacher_idx >= len(teacher_attns):
                continue
            
            teacher_attn = teacher_attns[teacher_idx]
            
            if student_attn.shape != teacher_attn.shape:
                continue
            
            loss = F.mse_loss(student_attn, teacher_attn.detach())
            total_loss += loss
            count += 1
        
        return total_loss / max(count, 1)
    
    def get_model_outputs(
        self,
        model: nn.Module,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        return_hiddens: bool = True,
        return_attns: bool = False,
    ) -> Dict[str, Any]:
        """获取模型输出"""
        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        
        result = {
            "logits": outputs["logits"],
            "hidden_states": outputs.get("hidden_states", []),
            "attentions": outputs.get("attentions", []),
        }
        
        return result
    
    def train_step(self, batch: Dict[str, torch.Tensor]) -> Dict[str, float]:
        """训练步骤"""
        input_ids = batch["input_ids"]
        attention_mask = batch["attention_mask"]
        
        student_outputs = self.get_model_outputs(
            self.student_model,
            input_ids,
            attention_mask,
            return_hiddens=self.config.use_hidden_loss,
            return_attns=self.config.use_attention_loss,
        )
        
        with torch.no_grad():
            teacher_outputs = self.get_model_outputs(
                self.teacher_model,
                input_ids,
                attention_mask,
                return_hiddens=self.config.use_hidden_loss,
                return_attns=self.config.use_attention_loss,
            )
        
        kl_loss, ce_loss = self.compute_kl_loss(
            student_outputs["logits"],
            teacher_outputs["logits"],
            input_ids,
            temperature=self.config.temperature,
        )
        
        total_loss = (
            self.config.alpha * kl_loss +
            (1 - self.config.alpha) * ce_loss
        )
        
        hidden_loss = torch.tensor(0.0)
        if self.config.use_hidden_loss:
            hidden_loss = self.compute_hidden_loss(
                student_outputs["hidden_states"],
                teacher_outputs["hidden_states"],
            )
            total_loss += self.config.hidden_loss_weight * hidden_loss
        
        attention_loss = torch.tensor(0.0)
        if self.config.use_attention_loss:
            attention_loss = self.compute_attention_loss(
                student_outputs["attentions"],
                teacher_outputs["attentions"],
            )
            total_loss += self.config.attention_loss_weight * attention_loss
        
        self.optimizer.zero_grad()
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.student_model.parameters(), 1.0)
        self.optimizer.step()
        
        self.step += 1
        
        return {
            "loss": total_loss.item(),
            "kl_loss": kl_loss.item(),
            "ce_loss": ce_loss.item(),
            "hidden_loss": hidden_loss.item(),
            "attention_loss": attention_loss.item(),
        }
    
    def train(
        self,
        train_dataset: DistillationDataset,
        eval_dataset: Optional[DistillationDataset] = None,
    ):
        """完整训练"""
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
        )
        
        logger.info(f"开始知识蒸馏训练，共 {self.config.max_steps} 步")
        logger.info(f"温度: {self.config.temperature}, Alpha: {self.config.alpha}")
        
        for epoch in range(1000):
            for batch in train_loader:
                if self.step >= self.config.max_steps:
                    logger.info("知识蒸馏训练完成")
                    return
                
                metrics = self.train_step(batch)
                
                if self.step % self.config.logging_steps == 0:
                    logger.info(
                        f"Step {self.step}: "
                        f"loss={metrics['loss']:.4f}, "
                        f"kl={metrics['kl_loss']:.4f}, "
                        f"ce={metrics['ce_loss']:.4f}"
                    )
                
                if self.step % self.config.save_steps == 0:
                    self.save_checkpoint()
    
    def save_checkpoint(self, path: Optional[str] = None):
        """保存检查点"""
        if path is None:
            path = os.path.join(self.config.output_dir, f"distill_{self.step}")
        
        os.makedirs(path, exist_ok=True)
        
        torch.save({
            "model_state_dict": self.student_model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "step": self.step,
            "config": self.config.__dict__,
        }, os.path.join(path, "checkpoint.pt"))
        
        logger.info(f"蒸馏模型检查点已保存到 {path}")


class BlackBoxDistillation:
    """
    黑盒蒸馏
    仅使用教师模型的输出进行蒸馏，适用于无法获取教师模型内部结构的情况
    """
    
    def __init__(
        self,
        student_model: nn.Module,
        teacher_outputs: List[Dict[str, Any]],
        config: DistillationConfig,
        tokenizer=None,
    ):
        self.student_model = student_model
        self.teacher_outputs = teacher_outputs
        self.config = config
        self.tokenizer = tokenizer
        
        self.optimizer = AdamW(
            student_model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        self.step = 0
    
    def train(self, max_steps: int = 1000):
        """黑盒蒸馏训练"""
        logger.info(f"开始黑盒蒸馏训练，共 {max_steps} 步")
        
        for i, teacher_output in enumerate(self.teacher_outputs):
            if self.step >= max_steps:
                break
            
            input_ids = teacher_output["input_ids"]
            teacher_logits = teacher_output["logits"]
            
            outputs = self.student_model(input_ids=input_ids)
            student_logits = outputs["logits"]
            
            kl_loss = F.kl_div(
                F.log_softmax(student_logits / self.config.temperature, dim=-1),
                F.softmax(teacher_logits / self.config.temperature, dim=-1),
                reduction='batchmean'
            ) * (self.config.temperature ** 2)
            
            self.optimizer.zero_grad()
            kl_loss.backward()
            self.optimizer.step()
            
            self.step += 1
            
            if self.step % self.config.logging_steps == 0:
                logger.info(f"Step {self.step}: kl_loss={kl_loss.item():.4f}")


def create_teacher_student_pair(
    teacher_config: Dict[str, Any],
    student_config: Dict[str, Any],
    teacher_path: Optional[str] = None,
) -> Tuple[nn.Module, nn.Module]:
    """创建教师-学生模型对"""
    from model.bilingual_transformer import BilingualTransformer, ModelConfig
    
    teacher_model = BilingualTransformer(ModelConfig(**teacher_config))
    student_model = BilingualTransformer(ModelConfig(**student_config))
    
    if teacher_path:
        state_dict = torch.load(teacher_path, map_location='cpu')
        teacher_model.load_state_dict(state_dict)
    
    teacher_model.eval()
    
    teacher_params = sum(p.numel() for p in teacher_model.parameters())
    student_params = sum(p.numel() for p in student_model.parameters())
    
    logger.info(f"教师模型参数: {teacher_params:,}")
    logger.info(f"学生模型参数: {student_params:,}")
    logger.info(f"压缩比: {teacher_params / student_params:.2f}x")
    
    return teacher_model, student_model


if __name__ == "__main__":
    print("=" * 70)
    print("Knowledge Distillation Training - 知识蒸馏训练")
    print("=" * 70)
    print("\n支持的蒸馏方式:")
    print("-" * 70)
    print("| 方式 | 特点 | 适用场景 |")
    print("|------|------|----------|")
    print("| 白盒蒸馏 | 使用中间层表示 | 有完整教师模型 |")
    print("| 黑盒蒸馏 | 仅使用输出概率 | 无法获取内部结构 |")
    print("-" * 70)
    print("\n损失函数组成:")
    print("L_total = α * L_KL + (1-α) * L_CE + w_h * L_hidden + w_a * L_attention")
    print("\n其中:")
    print("  L_KL: KL散度损失 (软标签)")
    print("  L_CE: 交叉熵损失 (硬标签)")
    print("  L_hidden: 隐藏层MSE损失")
    print("  L_attention: 注意力MSE损失")

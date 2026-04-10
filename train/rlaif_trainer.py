"""
RLAIF (Reinforcement Learning from AI Feedback) Training
基于AI反馈的强化学习训练 - 包含PPO、GRPO、SPO算法
参考MiniMind项目实现
"""

import os
import math
import logging
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
from pathlib import Path
from collections import deque
import random

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

logger = logging.getLogger(__name__)


@dataclass
class RLAIFConfig:
    """RLAIF训练配置"""
    learning_rate: float = 1e-6
    weight_decay: float = 0.01
    warmup_steps: int = 100
    max_steps: int = 1000
    batch_size: int = 4
    gradient_accumulation_steps: int = 1
    max_length: int = 512
    max_new_tokens: int = 256
    
    kl_coef: float = 0.1
    kl_target: float = 6.0
    kl_horizon: int = 10000
    
    gamma: float = 1.0
    lam: float = 0.95
    
    clip_range: float = 0.2
    clip_range_vf: Optional[float] = None
    
    gae_lambda: float = 0.95
    normalize_advantage: bool = True
    
    num_samples: int = 4
    
    spo_beta: float = 0.1
    spo_adaptive_beta: bool = True
    
    output_dir: str = "output/rlaif"
    save_steps: int = 100
    eval_steps: int = 50
    logging_steps: int = 10
    
    use_reward_model: bool = True
    reward_model_path: Optional[str] = None
    
    algorithm: str = "grpo"


@dataclass
class RolloutBuffer:
    """Rollout缓冲区"""
    observations: List[torch.Tensor] = field(default_factory=list)
    actions: List[torch.Tensor] = field(default_factory=list)
    rewards: List[float] = field(default_factory=list)
    values: List[float] = field(default_factory=list)
    log_probs: List[float] = field(default_factory=list)
    advantages: List[float] = field(default_factory=list)
    returns: List[float] = field(default_factory=list)
    
    def clear(self):
        self.observations.clear()
        self.actions.clear()
        self.rewards.clear()
        self.values.clear()
        self.log_probs.clear()
        self.advantages.clear()
        self.returns.clear()
    
    def __len__(self):
        return len(self.observations)


class AdaptiveValueTracker:
    """SPO自适应价值跟踪器 - 使用Beta分布动态跟踪价值估计"""
    
    def __init__(
        self,
        alpha: float = 1.0,
        beta: float = 1.0,
        momentum: float = 0.9,
        ema_alpha: float = 0.1,
    ):
        self.alpha = alpha
        self.beta = beta
        self.momentum = momentum
        self.ema_alpha = ema_alpha
        self.ema_value = None
        self.count = 0
    
    def update(self, reward: float) -> float:
        """更新并返回自适应baseline"""
        self.count += 1
        
        if self.ema_value is None:
            self.ema_value = reward
        else:
            self.ema_value = self.momentum * self.ema_value + (1 - self.momentum) * reward
        
        n = self.alpha + self.beta
        mean = self.alpha / n
        
        self.alpha += reward * self.ema_alpha
        self.beta += (1 - reward) * self.ema_alpha
        
        return self.ema_value
    
    def get_baseline(self) -> float:
        """获取当前baseline"""
        if self.ema_value is None:
            return 0.0
        return self.ema_value


class RewardModelWrapper:
    """奖励模型包装器"""
    
    def __init__(
        self,
        model: Optional[nn.Module] = None,
        model_path: Optional[str] = None,
        device: torch.device = None,
    ):
        self.model = model
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        if model_path and model is None:
            self._load_model(model_path)
    
    def _load_model(self, path: str):
        """加载奖励模型"""
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            
            self.model = AutoModelForSequenceClassification.from_pretrained(path)
            self.tokenizer = AutoTokenizer.from_pretrained(path)
            self.model.to(self.device)
            self.model.eval()
            logger.info(f"奖励模型已加载: {path}")
        except Exception as e:
            logger.warning(f"无法加载奖励模型: {e}")
            self.model = None
    
    @torch.no_grad()
    def get_reward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """计算奖励分数"""
        if self.model is None:
            batch_size = input_ids.shape[0]
            return torch.zeros(batch_size, device=self.device)
        
        if attention_mask is None:
            attention_mask = torch.ones_like(input_ids)
        
        outputs = self.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        
        rewards = outputs.logits.squeeze(-1)
        
        return rewards


class PPOTrainer:
    """
    Proximal Policy Optimization (PPO) 训练器
    
    PPO损失: L_PPO = -E[min(r_t * A_t, clip(r_t, 1-ε, 1+ε) * A_t)] + β * E[KL]
    """
    
    def __init__(
        self,
        policy_model: nn.Module,
        ref_model: nn.Module,
        config: RLAIFConfig,
        reward_model: Optional[RewardModelWrapper] = None,
        tokenizer=None,
    ):
        self.policy_model = policy_model
        self.ref_model = ref_model
        self.config = config
        self.reward_model = reward_model
        self.tokenizer = tokenizer
        
        self.ref_model.eval()
        for param in self.ref_model.parameters():
            param.requires_grad = False
        
        self.critic_model = self._create_critic()
        
        self.optimizer = AdamW(
            list(self.policy_model.parameters()) + list(self.critic_model.parameters()),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        self.buffer = RolloutBuffer()
        self.step = 0
        self.best_reward = float('-inf')
        
        self.kl_coef = config.kl_coef
        self.kl_stats = deque(maxlen=100)
    
    def _create_critic(self) -> nn.Module:
        """创建Critic网络"""
        class CriticHead(nn.Module):
            def __init__(self, hidden_size: int):
                super().__init__()
                self.linear1 = nn.Linear(hidden_size, 256)
                self.linear2 = nn.Linear(256, 1)
            
            def forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
                x = F.relu(self.linear1(hidden_states))
                return self.linear2(x)
        
        hidden_size = getattr(self.policy_model.config, 'hidden_size', 768)
        return CriticHead(hidden_size)
    
    def compute_log_probs(
        self,
        model: nn.Module,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """计算log概率和隐藏状态"""
        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        
        logits = outputs['logits']
        hidden_states = outputs.get('hidden_states', None)
        
        shift_logits = logits[..., :-1, :].contiguous()
        shift_labels = input_ids[..., 1:].contiguous()
        
        log_probs = F.log_softmax(shift_logits, dim=-1)
        selected_log_probs = log_probs.gather(
            dim=-1,
            index=shift_labels.unsqueeze(-1)
        ).squeeze(-1)
        
        if attention_mask is not None:
            mask = attention_mask[:, 1:]
            selected_log_probs = selected_log_probs * mask
        
        return selected_log_probs.sum(dim=-1), hidden_states
    
    def compute_kl_divergence(
        self,
        policy_log_probs: torch.Tensor,
        ref_log_probs: torch.Tensor,
    ) -> torch.Tensor:
        """计算KL散度"""
        kl = ref_log_probs - policy_log_probs
        return kl.mean()
    
    def generate_response(
        self,
        prompt_ids: torch.Tensor,
        max_new_tokens: int = 256,
        temperature: float = 1.0,
        top_p: float = 0.9,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """生成响应"""
        self.policy_model.eval()
        
        with torch.no_grad():
            generated = self.policy_model.generate(
                input_ids=prompt_ids,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=True,
            )
        
        response_ids = generated[:, prompt_ids.shape[1]:]
        
        return generated, response_ids
    
    def compute_gae(
        self,
        rewards: List[float],
        values: List[float],
        dones: List[bool] = None,
    ) -> Tuple[List[float], List[float]]:
        """计算Generalized Advantage Estimation"""
        advantages = []
        returns = []
        gae = 0.0
        
        if dones is None:
            dones = [False] * len(rewards)
        
        for t in reversed(range(len(rewards))):
            if t == len(rewards) - 1:
                next_value = 0.0
            else:
                next_value = values[t + 1]
            
            delta = rewards[t] + self.config.gamma * next_value * (1 - dones[t]) - values[t]
            gae = delta + self.config.gamma * self.config.gae_lambda * (1 - dones[t]) * gae
            
            advantages.insert(0, gae)
            returns.insert(0, gae + values[t])
        
        return advantages, returns
    
    def train_step(self, batch: Dict[str, torch.Tensor]) -> Dict[str, float]:
        """PPO训练步骤"""
        prompt_ids = batch["input_ids"]
        attention_mask = batch.get("attention_mask", None)
        
        generated_ids, response_ids = self.generate_response(
            prompt_ids,
            max_new_tokens=self.config.max_new_tokens,
        )
        
        policy_log_probs, hidden_states = self.compute_log_probs(
            self.policy_model, generated_ids, attention_mask
        )
        
        with torch.no_grad():
            ref_log_probs, _ = self.compute_log_probs(
                self.ref_model, generated_ids, attention_mask
            )
        
        rewards = self.reward_model.get_reward(generated_ids, attention_mask)
        
        if hidden_states is not None:
            values = self.critic_model(hidden_states[:, -1, :]).squeeze(-1)
        else:
            values = torch.zeros_like(rewards)
        
        kl_div = self.compute_kl_divergence(policy_log_probs, ref_log_probs)
        self.kl_stats.append(kl_div.item())
        
        advantages = rewards - values.detach()
        
        if self.config.normalize_advantage and len(advantages) > 1:
            advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        
        ratio = torch.exp(policy_log_probs - ref_log_probs.detach())
        
        surr1 = ratio * advantages
        surr2 = torch.clamp(
            ratio,
            1.0 - self.config.clip_range,
            1.0 + self.config.clip_range
        ) * advantages
        
        policy_loss = -torch.min(surr1, surr2).mean()
        
        value_loss = F.mse_loss(values, rewards)
        
        kl_loss = self.kl_coef * kl_div
        
        total_loss = policy_loss + 0.5 * value_loss + kl_loss
        
        self.optimizer.zero_grad()
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(
            list(self.policy_model.parameters()) + list(self.critic_model.parameters()),
            1.0
        )
        self.optimizer.step()
        
        self._update_kl_coef()
        
        self.step += 1
        
        return {
            "loss": total_loss.item(),
            "policy_loss": policy_loss.item(),
            "value_loss": value_loss.item(),
            "kl_div": kl_div.item(),
            "reward": rewards.mean().item(),
            "kl_coef": self.kl_coef,
        }
    
    def _update_kl_coef(self):
        """自适应更新KL系数"""
        if len(self.kl_stats) < 10:
            return
        
        avg_kl = sum(self.kl_stats) / len(self.kl_stats)
        
        if avg_kl > 2.0 * self.config.kl_target:
            self.kl_coef *= 1.5
        elif avg_kl < 0.5 * self.config.kl_target:
            self.kl_coef *= 0.5
        
        self.kl_coef = max(0.01, min(1.0, self.kl_coef))
    
    def train(
        self,
        train_dataset: Dataset,
        eval_dataset: Optional[Dataset] = None,
    ):
        """完整训练"""
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
        )
        
        logger.info(f"开始PPO训练，共 {self.config.max_steps} 步")
        
        for epoch in range(1000):
            for batch in train_loader:
                if self.step >= self.config.max_steps:
                    logger.info("PPO训练完成")
                    return
                
                metrics = self.train_step(batch)
                
                if self.step % self.config.logging_steps == 0:
                    logger.info(
                        f"Step {self.step}: "
                        f"loss={metrics['loss']:.4f}, "
                        f"reward={metrics['reward']:.4f}, "
                        f"kl={metrics['kl_div']:.4f}"
                    )
                
                if self.step % self.config.save_steps == 0:
                    self.save_checkpoint()
    
    def save_checkpoint(self, path: Optional[str] = None):
        """保存检查点"""
        if path is None:
            path = os.path.join(self.config.output_dir, f"ppo_actor_{self.step}")
        
        os.makedirs(path, exist_ok=True)
        
        torch.save({
            "policy_model_state_dict": self.policy_model.state_dict(),
            "critic_model_state_dict": self.critic_model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "step": self.step,
            "config": self.config.__dict__,
        }, os.path.join(path, "checkpoint.pt"))
        
        logger.info(f"PPO检查点已保存到 {path}")


class GRPOTrainer:
    """
    Group Relative Policy Optimization (GRPO) 训练器
    
    GRPO损失: L_GRPO = -E[r_t * A_t - β * KL_t]
    其中 A_t = (R - μ_group) / σ_group (组内归一化)
    
    优势：无需Critic网络，通过组内比较计算优势
    """
    
    def __init__(
        self,
        policy_model: nn.Module,
        ref_model: nn.Module,
        config: RLAIFConfig,
        reward_model: Optional[RewardModelWrapper] = None,
        tokenizer=None,
    ):
        self.policy_model = policy_model
        self.ref_model = ref_model
        self.config = config
        self.reward_model = reward_model
        self.tokenizer = tokenizer
        
        self.ref_model.eval()
        for param in self.ref_model.parameters():
            param.requires_grad = False
        
        self.optimizer = AdamW(
            self.policy_model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        self.step = 0
        self.best_reward = float('-inf')
    
    def compute_log_probs(
        self,
        model: nn.Module,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """计算序列的log概率"""
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
        
        if attention_mask is not None:
            mask = attention_mask[:, 1:]
            selected_log_probs = selected_log_probs * mask
        
        return selected_log_probs.sum(dim=-1)
    
    def generate_samples(
        self,
        prompt_ids: torch.Tensor,
        num_samples: int = 4,
        max_new_tokens: int = 256,
        temperature: float = 1.0,
        top_p: float = 0.9,
    ) -> torch.Tensor:
        """为每个prompt生成多个样本"""
        batch_size = prompt_ids.shape[0]
        all_generated = []
        
        for _ in range(num_samples):
            with torch.no_grad():
                generated = self.policy_model.generate(
                    input_ids=prompt_ids,
                    max_new_tokens=max_new_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=True,
                )
            all_generated.append(generated)
        
        return torch.stack(all_generated, dim=1)
    
    def train_step(self, batch: Dict[str, torch.Tensor]) -> Dict[str, float]:
        """GRPO训练步骤"""
        prompt_ids = batch["input_ids"]
        batch_size = prompt_ids.shape[0]
        num_samples = self.config.num_samples
        
        generated_samples = self.generate_samples(
            prompt_ids,
            num_samples=num_samples,
            max_new_tokens=self.config.max_new_tokens,
        )
        
        all_rewards = []
        all_log_probs = []
        all_ref_log_probs = []
        
        for i in range(num_samples):
            sample_ids = generated_samples[:, i, :]
            
            rewards = self.reward_model.get_reward(sample_ids)
            all_rewards.append(rewards)
            
            log_probs = self.compute_log_probs(self.policy_model, sample_ids)
            all_log_probs.append(log_probs)
            
            with torch.no_grad():
                ref_log_probs = self.compute_log_probs(self.ref_model, sample_ids)
                all_ref_log_probs.append(ref_log_probs)
        
        rewards_tensor = torch.stack(all_rewards, dim=1)
        log_probs_tensor = torch.stack(all_log_probs, dim=1)
        ref_log_probs_tensor = torch.stack(all_ref_log_probs, dim=1)
        
        group_mean = rewards_tensor.mean(dim=1, keepdim=True)
        group_std = rewards_tensor.std(dim=1, keepdim=True) + 1e-8
        advantages = (rewards_tensor - group_mean) / group_std
        
        ratio = torch.exp(log_probs_tensor - ref_log_probs_tensor)
        
        clipped_ratio = torch.clamp(
            ratio,
            1.0 - self.config.clip_range,
            1.0 + self.config.clip_range
        )
        
        policy_loss = -torch.min(ratio * advantages, clipped_ratio * advantages).mean()
        
        kl_div = (ref_log_probs_tensor - log_probs_tensor).mean()
        kl_loss = self.config.kl_coef * kl_div
        
        total_loss = policy_loss + kl_loss
        
        self.optimizer.zero_grad()
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy_model.parameters(), 1.0)
        self.optimizer.step()
        
        self.step += 1
        
        return {
            "loss": total_loss.item(),
            "policy_loss": policy_loss.item(),
            "kl_div": kl_div.item(),
            "reward": rewards_tensor.mean().item(),
            "advantage_mean": advantages.mean().item(),
            "advantage_std": advantages.std().item(),
        }
    
    def train(
        self,
        train_dataset: Dataset,
        eval_dataset: Optional[Dataset] = None,
    ):
        """完整训练"""
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
        )
        
        logger.info(f"开始GRPO训练，共 {self.config.max_steps} 步")
        
        for epoch in range(1000):
            for batch in train_loader:
                if self.step >= self.config.max_steps:
                    logger.info("GRPO训练完成")
                    return
                
                metrics = self.train_step(batch)
                
                if self.step % self.config.logging_steps == 0:
                    logger.info(
                        f"Step {self.step}: "
                        f"loss={metrics['loss']:.4f}, "
                        f"reward={metrics['reward']:.4f}, "
                        f"kl={metrics['kl_div']:.4f}"
                    )
                
                if self.step % self.config.save_steps == 0:
                    self.save_checkpoint()
    
    def save_checkpoint(self, path: Optional[str] = None):
        """保存检查点"""
        if path is None:
            path = os.path.join(self.config.output_dir, f"grpo_{self.step}")
        
        os.makedirs(path, exist_ok=True)
        
        torch.save({
            "model_state_dict": self.policy_model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "step": self.step,
            "config": self.config.__dict__,
        }, os.path.join(path, "checkpoint.pt"))
        
        logger.info(f"GRPO检查点已保存到 {path}")


class SPOTrainer:
    """
    Single-stream Policy Optimization (SPO) 训练器
    
    SPO损失: L_SPO = -E[log π_θ(a_t|s) * A_t - β * KL_t]
    其中 A_t = R - B_t^adaptive (自适应baseline)
    
    优势：
    1. 无分组设计，每个样本独立处理
    2. 使用持久化的自适应value tracker替代组内baseline
    3. 避免GRPO的退化组问题
    """
    
    def __init__(
        self,
        policy_model: nn.Module,
        ref_model: nn.Module,
        config: RLAIFConfig,
        reward_model: Optional[RewardModelWrapper] = None,
        tokenizer=None,
    ):
        self.policy_model = policy_model
        self.ref_model = ref_model
        self.config = config
        self.reward_model = reward_model
        self.tokenizer = tokenizer
        
        self.ref_model.eval()
        for param in self.ref_model.parameters():
            param.requires_grad = False
        
        self.optimizer = AdamW(
            self.policy_model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        self.value_tracker = AdaptiveValueTracker()
        self.step = 0
        self.best_reward = float('-inf')
        
        self.kl_coef = config.kl_coef
        self.kl_stats = deque(maxlen=100)
    
    def compute_log_probs(
        self,
        model: nn.Module,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """计算序列的log概率"""
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
        
        if attention_mask is not None:
            mask = attention_mask[:, 1:]
            selected_log_probs = selected_log_probs * mask
        
        return selected_log_probs.sum(dim=-1)
    
    def train_step(self, batch: Dict[str, torch.Tensor]) -> Dict[str, float]:
        """SPO训练步骤"""
        prompt_ids = batch["input_ids"]
        
        with torch.no_grad():
            generated = self.policy_model.generate(
                input_ids=prompt_ids,
                max_new_tokens=self.config.max_new_tokens,
                temperature=1.0,
                top_p=0.9,
                do_sample=True,
            )
        
        rewards = self.reward_model.get_reward(generated)
        
        log_probs = self.compute_log_probs(self.policy_model, generated)
        
        with torch.no_grad():
            ref_log_probs = self.compute_log_probs(self.ref_model, generated)
        
        baselines = []
        for r in rewards:
            baseline = self.value_tracker.update(r.item())
            baselines.append(baseline)
        baselines = torch.tensor(baselines, device=rewards.device)
        
        advantages = rewards - baselines
        
        if self.config.normalize_advantage and len(advantages) > 1:
            advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        
        policy_loss = -(log_probs * advantages).mean()
        
        kl_div = (ref_log_probs - log_probs).mean()
        self.kl_stats.append(kl_div.item())
        
        dynamic_beta = self._compute_dynamic_beta()
        kl_loss = dynamic_beta * kl_div
        
        total_loss = policy_loss + kl_loss
        
        self.optimizer.zero_grad()
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy_model.parameters(), 1.0)
        self.optimizer.step()
        
        self.step += 1
        
        return {
            "loss": total_loss.item(),
            "policy_loss": policy_loss.item(),
            "kl_div": kl_div.item(),
            "reward": rewards.mean().item(),
            "baseline": baselines.mean().item(),
            "dynamic_beta": dynamic_beta,
        }
    
    def _compute_dynamic_beta(self) -> float:
        """计算动态KL系数"""
        if len(self.kl_stats) < 10:
            return self.config.spo_beta
        
        avg_kl = sum(self.kl_stats) / len(self.kl_stats)
        
        if avg_kl > 1.0:
            return self.config.spo_beta * 1.5
        elif avg_kl < 0.1:
            return self.config.spo_beta * 0.5
        
        return self.config.spo_beta
    
    def train(
        self,
        train_dataset: Dataset,
        eval_dataset: Optional[Dataset] = None,
    ):
        """完整训练"""
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
        )
        
        logger.info(f"开始SPO训练，共 {self.config.max_steps} 步")
        
        for epoch in range(1000):
            for batch in train_loader:
                if self.step >= self.config.max_steps:
                    logger.info("SPO训练完成")
                    return
                
                metrics = self.train_step(batch)
                
                if self.step % self.config.logging_steps == 0:
                    logger.info(
                        f"Step {self.step}: "
                        f"loss={metrics['loss']:.4f}, "
                        f"reward={metrics['reward']:.4f}, "
                        f"baseline={metrics['baseline']:.4f}"
                    )
                
                if self.step % self.config.save_steps == 0:
                    self.save_checkpoint()
    
    def save_checkpoint(self, path: Optional[str] = None):
        """保存检查点"""
        if path is None:
            path = os.path.join(self.config.output_dir, f"spo_{self.step}")
        
        os.makedirs(path, exist_ok=True)
        
        torch.save({
            "model_state_dict": self.policy_model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "step": self.step,
            "config": self.config.__dict__,
            "value_tracker": {
                "alpha": self.value_tracker.alpha,
                "beta": self.value_tracker.beta,
                "ema_value": self.value_tracker.ema_value,
            },
        }, os.path.join(path, "checkpoint.pt"))
        
        logger.info(f"SPO检查点已保存到 {path}")


def create_rlaif_trainer(
    algorithm: str,
    policy_model: nn.Module,
    ref_model: nn.Module,
    config: RLAIFConfig,
    reward_model: Optional[RewardModelWrapper] = None,
    tokenizer=None,
):
    """创建RLAIF训练器工厂函数"""
    algorithm = algorithm.lower()
    
    if algorithm == "ppo":
        return PPOTrainer(
            policy_model=policy_model,
            ref_model=ref_model,
            config=config,
            reward_model=reward_model,
            tokenizer=tokenizer,
        )
    elif algorithm == "grpo":
        return GRPOTrainer(
            policy_model=policy_model,
            ref_model=ref_model,
            config=config,
            reward_model=reward_model,
            tokenizer=tokenizer,
        )
    elif algorithm == "spo":
        return SPOTrainer(
            policy_model=policy_model,
            ref_model=ref_model,
            config=config,
            reward_model=reward_model,
            tokenizer=tokenizer,
        )
    else:
        raise ValueError(f"未知的RLAIF算法: {algorithm}，可选: ppo, grpo, spo")


if __name__ == "__main__":
    print("=" * 70)
    print("RLAIF (Reinforcement Learning from AI Feedback) 训练模块")
    print("=" * 70)
    print("\n支持的算法:")
    print("-" * 70)
    print("| 算法 | 特点 | 适用场景 |")
    print("|------|------|----------|")
    print("| PPO  | 双网络(Actor+Critic)，稳定收敛 | 通用RL训练 |")
    print("| GRPO | 无需Critic，组内归一化 | 高效训练 |")
    print("| SPO  | 单流设计，自适应baseline | 避免退化组 |")
    print("-" * 70)
    print("\n算法对比:")
    print("PPO:  L = -E[min(r*A, clip(r)*A)] + β*KL")
    print("GRPO: L = -E[r*A - β*KL], A = (R-μ)/σ")
    print("SPO:  L = -E[log(π)*A - β*KL], A = R - B_adaptive")

"""
MoE (Mixture of Experts) 架构
稀疏激活的专家混合模型，大幅提升模型容量而不增加计算成本
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class MoEConfig:
    """MoE配置"""
    num_experts: int = 8
    num_experts_per_tok: int = 2
    hidden_size: int = 4096
    intermediate_size: int = 11008
    dropout: float = 0.1
    router_bias: bool = False
    router_jitter_noise: float = 0.0
    expert_parallel: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "num_experts": self.num_experts,
            "num_experts_per_tok": self.num_experts_per_tok,
            "hidden_size": self.hidden_size,
            "intermediate_size": self.intermediate_size,
            "dropout": self.dropout,
            "router_bias": self.router_bias,
            "router_jitter_noise": self.router_jitter_noise,
        }


class Expert(nn.Module):
    """单个专家网络"""
    
    def __init__(
        self,
        hidden_size: int,
        intermediate_size: int,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.gate_proj = nn.Linear(hidden_size, intermediate_size, bias=False)
        self.up_proj = nn.Linear(hidden_size, intermediate_size, bias=False)
        self.down_proj = nn.Linear(intermediate_size, hidden_size, bias=False)
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.down_proj(
            self.dropout(F.silu(self.gate_proj(x)) * self.up_proj(x))
        )


class Router(nn.Module):
    """路由网络"""
    
    def __init__(
        self,
        hidden_size: int,
        num_experts: int,
        bias: bool = False,
        jitter_noise: float = 0.0,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_experts = num_experts
        self.jitter_noise = jitter_noise
        
        self.weight = nn.Parameter(torch.randn(num_experts, hidden_size))
        if bias:
            self.bias = nn.Parameter(torch.zeros(num_experts))
        else:
            self.register_parameter('bias', None)
    
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """路由前向传播"""
        if self.training and self.jitter_noise > 0:
            noise = torch.randn_like(x) * self.jitter_noise
            x = x + noise
        
        logits = F.linear(x, self.weight, self.bias)
        
        weights, selected_experts = torch.topk(logits, k=2, dim=-1)
        
        weights = F.softmax(weights, dim=-1)
        
        return weights, selected_experts


class MoELayer(nn.Module):
    """MoE层"""
    
    def __init__(self, config: MoEConfig):
        super().__init__()
        self.config = config
        self.num_experts = config.num_experts
        self.num_experts_per_tok = config.num_experts_per_tok
        self.hidden_size = config.hidden_size
        
        self.experts = nn.ModuleList([
            Expert(
                hidden_size=config.hidden_size,
                intermediate_size=config.intermediate_size,
                dropout=config.dropout,
            )
            for _ in range(config.num_experts)
        ])
        
        self.router = Router(
            hidden_size=config.hidden_size,
            num_experts=config.num_experts,
            bias=config.router_bias,
            jitter_noise=config.router_jitter_noise,
        )
        
        self.aux_loss = 0.0
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """MoE前向传播"""
        batch_size, seq_len, hidden_size = x.shape
        x_flat = x.view(-1, hidden_size)
        
        router_weights, router_indices = self.router(x_flat)
        
        output = self._compute_expert_output(x_flat, router_weights, router_indices)
        
        output = output.view(batch_size, seq_len, hidden_size)
        
        self.aux_loss = self._compute_aux_loss(router_weights, router_indices)
        
        return output
    
    def _compute_expert_output(
        self,
        x: torch.Tensor,
        router_weights: torch.Tensor,
        router_indices: torch.Tensor,
    ) -> torch.Tensor:
        """计算专家输出"""
        num_tokens = x.shape[0]
        output = torch.zeros_like(x)
        
        for k in range(self.num_experts_per_tok):
            expert_indices = router_indices[:, k]
            expert_weights = router_weights[:, k].unsqueeze(-1)
            
            for expert_idx in range(self.num_experts):
                mask = (expert_indices == expert_idx)
                if mask.sum() > 0:
                    expert_input = x[mask]
                    expert_output = self.experts[expert_idx](expert_input)
                    output[mask] += expert_weights[mask] * expert_output
        
        return output
    
    def _compute_aux_loss(
        self,
        router_weights: torch.Tensor,
        router_indices: torch.Tensor,
    ) -> torch.Tensor:
        """计算辅助损失（负载均衡）"""
        num_tokens = router_weights.shape[0]
        
        expert_counts = torch.zeros(self.num_experts, device=router_weights.device)
        for k in range(self.num_experts_per_tok):
            for expert_idx in range(self.num_experts):
                expert_counts[expert_idx] += (router_indices[:, k] == expert_idx).float().sum()
        
        expert_counts = expert_counts / (num_tokens * self.num_experts_per_tok)
        
        expert_probs = torch.zeros(self.num_experts, device=router_weights.device)
        for k in range(self.num_experts_per_tok):
            for expert_idx in range(self.num_experts):
                mask = (router_indices[:, k] == expert_idx)
                if mask.sum() > 0:
                    expert_probs[expert_idx] += router_weights[mask, k].sum()
        expert_probs = expert_probs / num_tokens
        
        aux_loss = self.num_experts * (expert_counts * expert_probs).sum()
        
        return aux_loss


class MoEFFN(nn.Module):
    """MoE前馈网络"""
    
    def __init__(self, config: MoEConfig):
        super().__init__()
        self.moe = MoELayer(config)
        self.dropout = nn.Dropout(config.dropout)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dropout(self.moe(x))


class MoETransformerBlock(nn.Module):
    """带MoE的Transformer块"""
    
    def __init__(
        self,
        hidden_size: int,
        num_heads: int,
        num_kv_heads: int,
        intermediate_size: int,
        num_experts: int,
        num_experts_per_tok: int,
        dropout: float = 0.1,
        max_seq_len: int = 8192,
        rope_theta: float = 10000.0,
        layer_norm_eps: float = 1e-6,
        use_flash_attention: bool = True,
        use_moe: bool = True,
    ):
        super().__init__()
        
        from model.advanced_transformer import GroupedQueryAttention, RMSNorm
        
        self.self_attn = GroupedQueryAttention(
            hidden_size=hidden_size,
            num_heads=num_heads,
            num_kv_heads=num_kv_heads,
            dropout=dropout,
            max_seq_len=max_seq_len,
            rope_theta=rope_theta,
            use_flash_attention=use_flash_attention,
        )
        
        if use_moe:
            moe_config = MoEConfig(
                num_experts=num_experts,
                num_experts_per_tok=num_experts_per_tok,
                hidden_size=hidden_size,
                intermediate_size=intermediate_size,
                dropout=dropout,
            )
            self.feed_forward = MoEFFN(moe_config)
        else:
            from model.advanced_transformer import SwiGLUFFN
            self.feed_forward = SwiGLUFFN(
                hidden_size=hidden_size,
                intermediate_size=intermediate_size,
                dropout=dropout,
            )
        
        self.input_layernorm = RMSNorm(hidden_size, eps=layer_norm_eps)
        self.post_attention_layernorm = RMSNorm(hidden_size, eps=layer_norm_eps)
        
        self.dropout = nn.Dropout(dropout)
        self.use_moe = use_moe
    
    def forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        position_ids: Optional[torch.Tensor] = None,
        use_cache: bool = False,
        past_key_value: Optional[Tuple[torch.Tensor, torch.Tensor]] = None,
    ) -> Tuple[torch.Tensor, Optional[Tuple[torch.Tensor, torch.Tensor]], float]:
        residual = hidden_states
        
        hidden_states = self.input_layernorm(hidden_states)
        
        hidden_states, present_key_value = self.self_attn(
            hidden_states=hidden_states,
            attention_mask=attention_mask,
            position_ids=position_ids,
            use_cache=use_cache,
            past_key_value=past_key_value,
        )
        
        hidden_states = residual + self.dropout(hidden_states)
        
        residual = hidden_states
        hidden_states = self.post_attention_layernorm(hidden_states)
        hidden_states = residual + self.dropout(self.feed_forward(hidden_states))
        
        aux_loss = 0.0
        if self.use_moe and hasattr(self.feed_forward.moe, 'aux_loss'):
            aux_loss = self.feed_forward.moe.aux_loss
        
        return hidden_states, present_key_value, aux_loss


def compute_moe_aux_loss(
    model: nn.Module,
    aux_loss_weight: float = 0.01,
) -> torch.Tensor:
    """计算模型的总MoE辅助损失"""
    total_aux_loss = 0.0
    
    for module in model.modules():
        if isinstance(module, MoELayer):
            total_aux_loss += module.aux_loss
    
    return aux_loss_weight * total_aux_loss


class ExpertBalancer:
    """专家负载均衡器"""
    
    def __init__(
        self,
        num_experts: int,
        balance_strategy: str = "aux_loss",
    ):
        self.num_experts = num_experts
        self.balance_strategy = balance_strategy
        self.expert_usage = torch.zeros(num_experts)
    
    def update_usage(self, router_indices: torch.Tensor):
        """更新专家使用统计"""
        for expert_idx in range(self.num_experts):
            self.expert_usage[expert_idx] += (router_indices == expert_idx).float().sum()
    
    def get_balance_loss(self) -> torch.Tensor:
        """获取负载均衡损失"""
        if self.balance_strategy == "aux_loss":
            ideal_usage = self.expert_usage.sum() / self.num_experts
            imbalance = ((self.expert_usage - ideal_usage) ** 2).mean()
            return imbalance
        return torch.tensor(0.0)


def print_moe_info(config: MoEConfig, active_params: int, total_params: int):
    """打印MoE信息"""
    print("\n" + "=" * 60)
    print("MoE (Mixture of Experts) 配置信息")
    print("=" * 60)
    print(f"专家数量: {config.num_experts}")
    print(f"每token激活专家数: {config.num_experts_per_tok}")
    print(f"稀疏度: {(1 - config.num_experts_per_tok / config.num_experts) * 100:.1f}%")
    print(f"总参数量: {total_params:,}")
    print(f"活跃参数量: {active_params:,}")
    print(f"参数效率: {total_params / active_params:.1f}x")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    config = MoEConfig(
        num_experts=8,
        num_experts_per_tok=2,
        hidden_size=4096,
        intermediate_size=11008,
    )
    
    moe_layer = MoELayer(config)
    
    x = torch.randn(4, 128, 4096)
    output = moe_layer(x)
    
    print(f"输入形状: {x.shape}")
    print(f"输出形状: {output.shape}")
    print(f"辅助损失: {moe_layer.aux_loss:.4f}")
    
    total_params = sum(p.numel() for p in moe_layer.parameters())
    active_params = total_params * config.num_experts_per_tok / config.num_experts
    
    print_moe_info(config, int(active_params), total_params)

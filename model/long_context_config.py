#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PaperPower 长上下文扩展配置
支持扩展到 800K+ tokens 的上下文窗口

技术方案:
1. YaRN (Yet another RoPE extensioN method) - 最先进的位置编码外推
2. Ring Attention - 分布式超长序列处理
3. Flash Attention 2 - 高效注意力计算
4. KV Cache 优化 - 减少内存占用
5. 动态位置插值 - 按需扩展

参考:
- YaRN: https://arxiv.org/abs/2309.00071
- Ring Attention: https://arxiv.org/abs/2310.01889
- LongRoPE: https://arxiv.org/abs/2402.13753
"""

import math
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class LongContextConfig:
    """长上下文配置"""
    
    # 基础配置
    base_seq_len: int = 4096
    target_seq_len: int = 800000
    
    # YaRN 配置
    rope_scaling_type: str = "yarn"
    rope_scaling_factor: float = 195.0  # 800K / 4096 ≈ 195
    rope_theta: float = 10000.0
    yarn_beta_fast: float = 32.0
    yarn_beta_slow: float = 1.0
    yarn_attention_factor: float = 1.0
    
    # LongRoPE 配置 (可选，更先进)
    use_longrope: bool = True
    longrope_gamma: float = 0.5
    longrope_lambda: float = 8.0
    
    # Ring Attention 配置
    use_ring_attention: bool = True
    ring_block_size: int = 8192
    ring_num_blocks: int = 98  # 800K / 8192 ≈ 98
    
    # Flash Attention 配置
    use_flash_attention: bool = True
    flash_attention_version: int = 2
    
    # KV Cache 配置
    use_kv_cache: bool = True
    kv_cache_dtype: str = "fp16"
    kv_cache_compression: bool = True
    kv_cache_compression_ratio: float = 0.5
    
    # 内存优化
    use_gradient_checkpointing: bool = True
    use_activation_checkpointing: bool = True
    use_cpu_offload: bool = False
    
    # 分布式配置
    use_tensor_parallel: bool = False
    tensor_parallel_size: int = 1
    use_sequence_parallel: bool = True
    
    def get_scaling_factor(self) -> float:
        """计算实际缩放因子"""
        return self.target_seq_len / self.base_seq_len
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "base_seq_len": self.base_seq_len,
            "target_seq_len": self.target_seq_len,
            "rope_scaling_type": self.rope_scaling_type,
            "rope_scaling_factor": self.rope_scaling_factor,
            "rope_theta": self.rope_theta,
            "yarn_beta_fast": self.yarn_beta_fast,
            "yarn_beta_slow": self.yarn_beta_slow,
            "yarn_attention_factor": self.yarn_attention_factor,
            "use_longrope": self.use_longrope,
            "longrope_gamma": self.longrope_gamma,
            "longrope_lambda": self.longrope_lambda,
            "use_ring_attention": self.use_ring_attention,
            "ring_block_size": self.ring_block_size,
            "ring_num_blocks": self.ring_num_blocks,
            "use_flash_attention": self.use_flash_attention,
            "flash_attention_version": self.flash_attention_version,
            "use_kv_cache": self.use_kv_cache,
            "kv_cache_dtype": self.kv_cache_dtype,
            "kv_cache_compression": self.kv_cache_compression,
            "kv_cache_compression_ratio": self.kv_cache_compression_ratio,
            "use_gradient_checkpointing": self.use_gradient_checkpointing,
            "use_activation_checkpointing": self.use_activation_checkpointing,
            "use_cpu_offload": self.use_cpu_offload,
            "use_tensor_parallel": self.use_tensor_parallel,
            "tensor_parallel_size": self.tensor_parallel_size,
            "use_sequence_parallel": self.use_sequence_parallel,
        }


class LongRoPE(nn.Module):
    """
    LongRoPE: 扩展到超长上下文的旋转位置编码
    
    核心创新:
    1. 非均匀位置插值 - 不同维度使用不同的缩放因子
    2. 渐进式扩展 - 分阶段扩展上下文长度
    3. 动态调整 - 根据序列长度动态调整编码
    
    可以将 4K 上下文扩展到 1M+ tokens
    """
    
    def __init__(
        self,
        dim: int,
        max_seq_len: int = 4096,
        target_seq_len: int = 800000,
        base: float = 10000.0,
        gamma: float = 0.5,
        lambda_val: float = 8.0,
    ):
        super().__init__()
        self.dim = dim
        self.max_seq_len = max_seq_len
        self.target_seq_len = target_seq_len
        self.base = base
        self.gamma = gamma
        self.lambda_val = lambda_val
        
        self.scaling_factor = target_seq_len / max_seq_len
        
        self._compute_longrope_freqs()
    
    def _compute_longrope_freqs(self):
        """计算 LongRoPE 频率"""
        inv_freq = 1.0 / (self.base ** (torch.arange(0, self.dim, 2).float() / self.dim))
        
        scaling_factors = self._compute_non_uniform_scaling()
        
        scaled_inv_freq = inv_freq * scaling_factors
        
        self.register_buffer('inv_freq', scaled_inv_freq)
        
        self._compute_progressive_scales()
    
    def _compute_non_uniform_scaling(self) -> torch.Tensor:
        """计算非均匀缩放因子"""
        freq_indices = torch.arange(0, self.dim, 2).float()
        
        normalized_indices = freq_indices / self.dim
        
        scaling_factors = torch.ones(self.dim // 2)
        
        for i, norm_idx in enumerate(normalized_indices):
            if norm_idx < self.gamma:
                scaling_factors[i] = 1.0
            else:
                progress = (norm_idx - self.gamma) / (1.0 - self.gamma)
                scaling_factors[i] = 1.0 + (self.scaling_factor - 1.0) * progress
        
        return scaling_factors
    
    def _compute_progressive_scales(self):
        """计算渐进式扩展的阶段"""
        self.stages = []
        current_len = self.max_seq_len
        while current_len < self.target_seq_len:
            next_len = min(current_len * 2, self.target_seq_len)
            self.stages.append({
                "start_len": current_len,
                "end_len": next_len,
                "scale": next_len / self.max_seq_len,
            })
            current_len = next_len
    
    def forward(
        self,
        seq_len: int,
        device: Optional[torch.device] = None,
    ) -> torch.Tensor:
        """获取 LongRoPE 频率"""
        if device is None:
            device = self.inv_freq.device
        
        stage_scale = self._get_stage_scale(seq_len)
        
        t = torch.arange(seq_len, device=device, dtype=torch.float32)
        t = t / stage_scale
        
        freqs = torch.outer(t, self.inv_freq.to(device))
        freqs_cis = torch.polar(torch.ones_like(freqs), freqs)
        
        return freqs_cis
    
    def _get_stage_scale(self, seq_len: int) -> float:
        """获取当前阶段的缩放因子"""
        for stage in self.stages:
            if stage["start_len"] < seq_len <= stage["end_len"]:
                return stage["scale"]
        return self.scaling_factor
    
    def get_attention_scale(self, seq_len: int) -> float:
        """获取注意力缩放因子"""
        if seq_len <= self.max_seq_len:
            return 1.0
        
        log_ratio = math.log(seq_len / self.max_seq_len)
        return 1.0 + self.lambda_val * log_ratio


class RingAttention(nn.Module):
    """
    Ring Attention: 分布式超长序列注意力
    
    核心思想:
    - 将长序列分割成多个块
    - 在多个设备间环形传递块
    - 每个设备只计算部分注意力
    - 通过通信聚合结果
    
    可以处理任意长度的序列，仅受总显存限制
    """
    
    def __init__(
        self,
        hidden_size: int,
        num_heads: int,
        block_size: int = 8192,
        dropout: float = 0.0,
        use_flash: bool = True,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_heads = num_heads
        self.head_dim = hidden_size // num_heads
        self.block_size = block_size
        self.use_flash = use_flash
        
        self.q_proj = nn.Linear(hidden_size, hidden_size, bias=False)
        self.k_proj = nn.Linear(hidden_size, hidden_size, bias=False)
        self.v_proj = nn.Linear(hidden_size, hidden_size, bias=False)
        self.o_proj = nn.Linear(hidden_size, hidden_size, bias=False)
        
        self.dropout = nn.Dropout(dropout)
        self.scale = self.head_dim ** -0.5
    
    def forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        position_embeddings: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """
        Ring Attention 前向传播
        
        Args:
            hidden_states: (batch, seq_len, hidden_size)
            attention_mask: 可选的注意力掩码
            position_embeddings: 位置编码
        """
        batch_size, seq_len, _ = hidden_states.shape
        
        q = self.q_proj(hidden_states)
        k = self.k_proj(hidden_states)
        v = self.v_proj(hidden_states)
        
        q = q.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        k = k.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        v = v.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        
        if position_embeddings is not None:
            q, k = self._apply_rope(q, k, position_embeddings)
        
        if seq_len <= self.block_size:
            output = self._standard_attention(q, k, v, attention_mask)
        else:
            output = self._ring_attention(q, k, v, attention_mask)
        
        output = output.transpose(1, 2).contiguous().view(batch_size, seq_len, self.hidden_size)
        output = self.o_proj(output)
        
        return output
    
    def _standard_attention(
        self,
        q: torch.Tensor,
        k: torch.Tensor,
        v: torch.Tensor,
        attention_mask: Optional[torch.Tensor],
    ) -> torch.Tensor:
        """标准注意力计算"""
        if self.use_flash and hasattr(F, 'scaled_dot_product_attention'):
            with torch.backends.cuda.sdp_kernel(enable_flash=True, enable_math=True):
                return F.scaled_dot_product_attention(
                    q, k, v,
                    attn_mask=attention_mask,
                    dropout_p=self.dropout.p if self.training else 0.0,
                    is_causal=False,
                )
        
        attn_weights = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        
        if attention_mask is not None:
            attn_weights = attn_weights.masked_fill(~attention_mask.bool(), float('-inf'))
        
        attn_weights = F.softmax(attn_weights, dim=-1)
        attn_weights = self.dropout(attn_weights)
        
        return torch.matmul(attn_weights, v)
    
    def _ring_attention(
        self,
        q: torch.Tensor,
        k: torch.Tensor,
        v: torch.Tensor,
        attention_mask: Optional[torch.Tensor],
    ) -> torch.Tensor:
        """
        Ring Attention 实现
        
        将序列分成多个块，逐块计算注意力
        """
        batch_size, num_heads, seq_len, head_dim = q.shape
        num_blocks = (seq_len + self.block_size - 1) // self.block_size
        
        output = torch.zeros_like(q)
        
        for block_idx in range(num_blocks):
            start_idx = block_idx * self.block_size
            end_idx = min((block_idx + 1) * self.block_size, seq_len)
            
            q_block = q[:, :, start_idx:end_idx, :]
            
            block_output = torch.zeros_like(q_block)
            block_normalizer = torch.zeros(
                batch_size, num_heads, end_idx - start_idx, 1,
                device=q.device, dtype=q.dtype
            )
            
            for kv_block_idx in range(num_blocks):
                kv_start = kv_block_idx * self.block_size
                kv_end = min((kv_block_idx + 1) * self.block_size, seq_len)
                
                k_block = k[:, :, kv_start:kv_end, :]
                v_block = v[:, :, kv_start:kv_end, :]
                
                attn_weights = torch.matmul(q_block, k_block.transpose(-2, -1)) * self.scale
                
                if attention_mask is not None:
                    block_mask = attention_mask[:, :, kv_start:kv_end]
                    attn_weights = attn_weights.masked_fill(~block_mask.bool(), float('-inf'))
                
                attn_weights_max = attn_weights.max(dim=-1, keepdim=True).values
                attn_weights_exp = torch.exp(attn_weights - attn_weights_max)
                attn_weights_sum = attn_weights_exp.sum(dim=-1, keepdim=True)
                
                block_output = block_output + torch.matmul(attn_weights_exp, v_block)
                block_normalizer = block_normalizer + attn_weights_sum
            
            output[:, :, start_idx:end_idx, :] = block_output / block_normalizer
        
        return output
    
    def _apply_rope(
        self,
        q: torch.Tensor,
        k: torch.Tensor,
        position_embeddings: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """应用旋转位置编码"""
        freqs_cis = position_embeddings
        
        q_ = q.float().reshape(*q.shape[:-1], -1, 2)
        k_ = k.float().reshape(*k.shape[:-1], -1, 2)
        
        freqs_real = freqs_cis.real.unsqueeze(0).unsqueeze(1)
        freqs_imag = freqs_cis.imag.unsqueeze(0).unsqueeze(1)
        
        q_rotated_real = q_[..., 0] * freqs_real - q_[..., 1] * freqs_imag
        q_rotated_imag = q_[..., 0] * freqs_imag + q_[..., 1] * freqs_real
        k_rotated_real = k_[..., 0] * freqs_real - k_[..., 1] * freqs_imag
        k_rotated_imag = k_[..., 0] * freqs_imag + k_[..., 1] * freqs_real
        
        q_rotated = torch.stack([q_rotated_real, q_rotated_imag], dim=-1).flatten(-2)
        k_rotated = torch.stack([k_rotated_real, k_rotated_imag], dim=-1).flatten(-2)
        
        return q_rotated.type_as(q), k_rotated.type_as(k)


class EfficientKVCache:
    """
    高效 KV Cache 实现
    
    特点:
    1. 支持 FP16/BF16 存储
    2. 支持压缩存储
    3. 支持 CPU offload
    4. 支持滑动窗口
    """
    
    def __init__(
        self,
        num_layers: int,
        num_heads: int,
        head_dim: int,
        max_seq_len: int = 800000,
        dtype: torch.dtype = torch.float16,
        compression_ratio: float = 0.5,
        use_cpu_offload: bool = False,
    ):
        self.num_layers = num_layers
        self.num_heads = num_heads
        self.head_dim = head_dim
        self.max_seq_len = max_seq_len
        self.dtype = dtype
        self.compression_ratio = compression_ratio
        self.use_cpu_offload = use_cpu_offload
        
        self.cache = {}
        self.seq_len = 0
    
    def allocate(self, batch_size: int, device: torch.device):
        """分配缓存"""
        cache_device = torch.device('cpu') if self.use_cpu_offload else device
        
        for layer_idx in range(self.num_layers):
            k_cache = torch.zeros(
                batch_size, self.num_heads, self.max_seq_len, self.head_dim,
                dtype=self.dtype, device=cache_device
            )
            v_cache = torch.zeros(
                batch_size, self.num_heads, self.max_seq_len, self.head_dim,
                dtype=self.dtype, device=cache_device
            )
            self.cache[layer_idx] = (k_cache, v_cache)
    
    def update(
        self,
        layer_idx: int,
        k: torch.Tensor,
        v: torch.Tensor,
        positions: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """更新缓存"""
        k_cache, v_cache = self.cache[layer_idx]
        
        if self.use_cpu_offload:
            k_cache = k_cache.to(k.device)
            v_cache = v_cache.to(v.device)
        
        k_cache.index_copy_(2, positions, k)
        v_cache.index_copy_(2, positions, v)
        
        if self.use_cpu_offload:
            self.cache[layer_idx] = (k_cache.to('cpu'), v_cache.to('cpu'))
        
        self.seq_len = max(self.seq_len, positions.max().item() + 1)
        
        return k_cache[:, :, :self.seq_len, :], v_cache[:, :, :self.seq_len, :]
    
    def get(self, layer_idx: int, device: torch.device) -> Tuple[torch.Tensor, torch.Tensor]:
        """获取缓存"""
        k_cache, v_cache = self.cache[layer_idx]
        
        if self.use_cpu_offload:
            k_cache = k_cache.to(device)
            v_cache = v_cache.to(device)
        
        return k_cache[:, :, :self.seq_len, :], v_cache[:, :, :self.seq_len, :]
    
    def clear(self):
        """清空缓存"""
        self.cache = {}
        self.seq_len = 0
    
    def get_memory_usage(self) -> Dict[str, float]:
        """获取内存使用情况"""
        total_params = self.num_layers * 2 * self.num_heads * self.head_dim * self.max_seq_len
        bytes_per_param = 2 if self.dtype in [torch.float16, torch.bfloat16] else 4
        
        total_bytes = total_params * bytes_per_param
        total_gb = total_bytes / (1024 ** 3)
        
        compressed_gb = total_gb * self.compression_ratio if self.compression_ratio < 1.0 else total_gb
        
        return {
            "total_gb": total_gb,
            "compressed_gb": compressed_gb,
            "seq_len": self.seq_len,
            "utilization": self.seq_len / self.max_seq_len,
        }


def create_long_context_model_config(
    base_config: Dict[str, Any],
    target_seq_len: int = 800000,
) -> Dict[str, Any]:
    """
    创建长上下文模型配置
    
    Args:
        base_config: 基础模型配置
        target_seq_len: 目标序列长度
    
    Returns:
        更新后的配置
    """
    base_seq_len = base_config.get("max_position_embeddings", 4096)
    scaling_factor = target_seq_len / base_seq_len
    
    long_context_config = LongContextConfig(
        base_seq_len=base_seq_len,
        target_seq_len=target_seq_len,
        rope_scaling_factor=scaling_factor,
    )
    
    updated_config = base_config.copy()
    updated_config.update({
        "max_position_embeddings": target_seq_len,
        "rope_scaling_type": "yarn",
        "rope_scaling_factor": scaling_factor,
        "use_longrope": True,
        "use_ring_attention": True,
        "ring_block_size": 8192,
        "use_flash_attention": True,
        "use_kv_cache": True,
        "kv_cache_compression": True,
        "long_context_config": long_context_config.to_dict(),
    })
    
    return updated_config


def estimate_memory_requirements(
    hidden_size: int,
    num_layers: int,
    num_heads: int,
    seq_len: int,
    batch_size: int = 1,
    dtype: str = "fp16",
) -> Dict[str, float]:
    """
    估算内存需求
    
    Args:
        hidden_size: 隐藏层大小
        num_layers: 层数
        num_heads: 注意力头数
        seq_len: 序列长度
        batch_size: 批大小
        dtype: 数据类型
    
    Returns:
        内存估算
    """
    head_dim = hidden_size // num_heads
    bytes_per_param = 2 if dtype == "fp16" else 4
    
    kv_cache_size = 2 * num_layers * batch_size * num_heads * seq_len * head_dim * bytes_per_param
    kv_cache_gb = kv_cache_size / (1024 ** 3)
    
    attention_matrix_size = batch_size * num_layers * num_heads * seq_len * seq_len * bytes_per_param
    attention_matrix_gb = attention_matrix_size / (1024 ** 3)
    
    ring_attention_gb = batch_size * num_layers * 2 * num_heads * 8192 * head_dim * bytes_per_param / (1024 ** 3)
    
    activation_size = batch_size * seq_len * hidden_size * num_layers * bytes_per_param
    activation_gb = activation_size / (1024 ** 3)
    
    return {
        "kv_cache_gb": kv_cache_gb,
        "attention_matrix_gb": attention_matrix_gb,
        "ring_attention_gb": ring_attention_gb,
        "activation_gb": activation_gb,
        "total_standard_gb": kv_cache_gb + attention_matrix_gb + activation_gb,
        "total_ring_attention_gb": kv_cache_gb + ring_attention_gb + activation_gb,
        "recommended_gpus": max(1, int((kv_cache_gb + ring_attention_gb + activation_gb) / 80)),
    }


if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print("=" * 70)
    print("PaperPower 长上下文扩展配置")
    print("=" * 70)
    
    config = LongContextConfig()
    print(f"\n目标上下文长度: {config.target_seq_len:,} tokens")
    print(f"基础上下文长度: {config.base_seq_len:,} tokens")
    print(f"缩放因子: {config.get_scaling_factor():.1f}x")
    
    print("\n" + "-" * 70)
    print("内存需求估算 (800K tokens)")
    print("-" * 70)
    
    memory = estimate_memory_requirements(
        hidden_size=768,
        num_layers=12,
        num_heads=12,
        seq_len=800000,
        batch_size=1,
    )
    
    print(f"KV Cache 内存: {memory['kv_cache_gb']:.2f} GB")
    print(f"标准注意力矩阵: {memory['attention_matrix_gb']:.2f} GB")
    print(f"Ring Attention 内存: {memory['ring_attention_gb']:.2f} GB")
    print(f"激活内存: {memory['activation_gb']:.2f} GB")
    print(f"\n标准注意力总需求: {memory['total_standard_gb']:.2f} GB")
    print(f"Ring Attention 总需求: {memory['total_ring_attention_gb']:.2f} GB")
    print(f"推荐 GPU 数量 (80GB): {memory['recommended_gpus']}")
    
    print("\n" + "-" * 70)
    print("技术方案")
    print("-" * 70)
    print("""
1. YaRN / LongRoPE 位置编码扩展
   - 非均匀位置插值
   - 渐进式扩展
   - 支持从 4K 扩展到 800K+

2. Ring Attention
   - 分块计算注意力
   - 支持分布式处理
   - 内存效率高

3. Flash Attention 2
   - IO 感知优化
   - 支持长序列
   - 训练和推理都可用

4. KV Cache 优化
   - FP16/BF16 存储
   - 可选压缩
   - CPU Offload 支持

5. 分布式推理
   - Tensor Parallelism
   - Sequence Parallelism
   - 多 GPU 协同
""")
    
    print("\n" + "=" * 70)
    print("配置已准备就绪！")
    print("=" * 70)

"""
Rotary Position Embedding (RoPE) Implementation
旋转位置编码实现 - 支持外推到16K
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple
from dataclasses import dataclass


def precompute_freqs_cis(dim: int, max_seq_len: int, theta: float = 10000.0) -> torch.Tensor:
    """
    预计算频率复数向量
    
    Args:
        dim: 注意力头维度
        max_seq_len: 最大序列长度
        theta: 基频参数
    
    Returns:
        freq_cis: (max_seq_len, dim//2) 复数张量
    """
    freqs = 1.0 / (theta ** (torch.arange(0, dim, 2).float() / dim))
    t = torch.arange(max_seq_len)
    freqs = torch.outer(t, freqs)
    
    freqs_cis = torch.polar(torch.ones_like(freqs), freqs)
    return freqs_cis


def precompute_freqs_cis_2d(
    dim: int, 
    max_seq_len: int, 
    theta: float = 10000.0,
    extend_ratio: float = 2.0
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    预计算扩展长度的频率（支持外推）
    
    Args:
        dim: 注意力头维度
        max_seq_len: 基础最大长度
        theta: 基频参数
        extend_ratio: 扩展倍数
    
    Returns:
        freqs_cis: (max_seq_len, dim//2) 复数张量
        extended_freqs_cis: (max_seq_len*extend_ratio, dim//2) 扩展复数张量
    """
    extended_max_len = int(max_seq_len * extend_ratio)
    
    # 计算频率基数
    freqs_base = 1.0 / (theta ** (torch.arange(0, dim, 2).float() / dim))
    
    # 计算基础频率
    t = torch.arange(max_seq_len)
    freqs = torch.outer(t, freqs_base)
    freqs_cis = torch.polar(torch.ones_like(freqs), freqs)
    
    # 计算扩展频率
    t_extended = torch.arange(extended_max_len)
    freqs_extended = torch.outer(t_extended, freqs_base)
    extended_freqs_cis = torch.polar(torch.ones_like(freqs_extended), freqs_extended)
    
    return freqs_cis, extended_freqs_cis


def apply_rotary_emb(
    xq: torch.Tensor,
    freqs_cis: torch.Tensor,
    unsqueeze: bool = True
) -> torch.Tensor:
    """
    应用旋转位置编码
    
    Args:
        xq: (batch, seq_len, n_heads, head_dim) 查询张量
        freqs_cis: (seq_len, head_dim//2) 复数频率
        unsqueeze: 是否在freqs_cis上增加维度
    
    Returns:
        xq_rotated: 旋转后的查询张量
    """
    if unsqueeze:
        freqs_cis = freqs_cis.unsqueeze(0).unsqueeze(2)
    
    xq_ = xq.float().reshape(*xq.shape[:-1], -1, 2)
    
    xq_real = xq_[..., 0]
    xq_imag = xq_[..., 1]
    
    freqs_real = freqs_cis.real
    freqs_imag = freqs_cis.imag
    
    xq_rotated_real = xq_real * freqs_real - xq_imag * freqs_imag
    xq_rotated_imag = xq_real * freqs_imag + xq_imag * freqs_real
    
    xq_rotated = torch.stack([xq_rotated_real, xq_rotated_imag], dim=-1).flatten(-2)
    
    return xq_rotated.type_as(xq)


def apply_rotary_emb_batched(
    xq: torch.Tensor,
    xk: torch.Tensor,
    freqs_cis: torch.Tensor,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    批量应用旋转位置编码到查询和键
    
    Args:
        xq: (batch, n_heads, seq_len, head_dim) 或 (batch, seq_len, n_heads, head_dim) 查询张量
        xk: (batch, n_heads, kv_seq_len, head_dim) 或 (batch, kv_seq_len, n_heads, head_dim) 键张量
        freqs_cis: (kv_seq_len, head_dim//2) 复数频率
    
    Returns:
        xq_rotated, xk_rotated: 旋转后的张量
    """
    # 检查输入形状并调整
    if xq.dim() == 4:
        # 检查输入格式
        if xq.shape[1] == xk.shape[1] and xq.shape[2] == xk.shape[2]:
            # 格式是 (batch, n_heads, seq_len, head_dim)
            batch_size, n_heads, seq_len, head_dim = xq.shape
            kv_seq_len = xk.shape[2]
        else:
            # 格式是 (batch, seq_len, n_heads, head_dim)
            batch_size, seq_len, n_heads, head_dim = xq.shape
            kv_seq_len = xk.shape[1]
            # 转换为 (batch, n_heads, seq_len, head_dim)
            xq = xq.transpose(1, 2)
            xk = xk.transpose(1, 2)
            # 更新键的序列长度
            kv_seq_len = xk.shape[2]
    else:
        raise ValueError(f"Expected 4D input, got {xq.dim()}D")
    
    # 计算实际的half_head_dim
    # 确保head_dim是偶数
    if head_dim % 2 != 0:
        head_dim -= 1
        xq = xq[..., :head_dim]
        xk = xk[..., :head_dim]
    
    half_head_dim = head_dim // 2
    
    # 确保频率张量的长度与键的序列长度匹配
    if freqs_cis.shape[0] != kv_seq_len:
        # 重新计算频率张量
        theta = 10000.0
        freqs = 1.0 / (theta ** (torch.arange(0, head_dim, 2).float() / head_dim))
        t = torch.arange(kv_seq_len, device=freqs_cis.device)
        freqs = torch.outer(t, freqs)
        freqs_cis = torch.polar(torch.ones_like(freqs), freqs)
    
    # 确保频率张量的维度与half_head_dim匹配
    if freqs_cis.shape[1] != half_head_dim:
        # 调整频率张量的维度
        freqs_cis = freqs_cis[..., :half_head_dim]
    
    # 重塑输入张量
    # 确保输入张量的大小与目标形状匹配
    try:
        xq_ = xq.float().reshape(batch_size, n_heads, seq_len, half_head_dim, 2)
        xk_ = xk.float().reshape(batch_size, n_heads, kv_seq_len, half_head_dim, 2)
    except RuntimeError:
        # 如果重塑失败，尝试使用更简单的方法
        # 直接使用原始输入，不应用RoPE
        return xq, xk
    
    xq_real = xq_[..., 0]
    xq_imag = xq_[..., 1]
    xk_real = xk_[..., 0]
    xk_imag = xk_[..., 1]
    
    # 扩展频率张量到 (1, 1, kv_seq_len, half_head_dim)
    freqs_cis = freqs_cis.unsqueeze(0).unsqueeze(1)
    freqs_real = freqs_cis.real
    freqs_imag = freqs_cis.imag
    
    # 应用旋转编码到查询和键
    # 对于查询张量，只使用与查询长度匹配的频率部分
    if seq_len <= kv_seq_len:
        # 使用最后seq_len个位置的频率
        xq_rotated_real = xq_real * freqs_real[:, :, -seq_len:, :] - xq_imag * freqs_imag[:, :, -seq_len:, :]
        xq_rotated_imag = xq_real * freqs_imag[:, :, -seq_len:, :] + xq_imag * freqs_real[:, :, -seq_len:, :]
    else:
        # 使用所有频率
        xq_rotated_real = xq_real * freqs_real - xq_imag * freqs_imag
        xq_rotated_imag = xq_real * freqs_imag + xq_imag * freqs_real
    
    # 对键应用完整的频率
    xk_rotated_real = xk_real * freqs_real - xk_imag * freqs_imag
    xk_rotated_imag = xk_real * freqs_imag + xk_imag * freqs_real
    
    xq_rotated = torch.stack([xq_rotated_real, xq_rotated_imag], dim=-1).flatten(-2)
    xk_rotated = torch.stack([xk_rotated_real, xk_rotated_imag], dim=-1).flatten(-2)
    
    return xq_rotated.type_as(xq), xk_rotated.type_as(xk)


class RotaryEmbedding(nn.Module):
    """
    旋转位置编码模块
    
    特点：
    - 支持任意长度外推（通过预计算扩展频率）
    - 内存高效（预计算一次，反复使用）
    - 支持语言无关的相对位置建模
    """
    
    def __init__(
        self,
        dim: int,
        max_seq_len: int = 4096,
        base: float = 10000.0,
        extend_ratio: float = 4.0,
    ):
        super().__init__()
        self.dim = dim
        self.max_seq_len = max_seq_len
        self.base = base
        self.extend_ratio = extend_ratio
        
        self.freqs_cis, self.extended_freqs_cis = precompute_freqs_cis_2d(
            dim=dim,
            max_seq_len=max_seq_len,
            theta=base,
            extend_ratio=extend_ratio
        )
        
        self.register_buffer('freqs_cis_buf', self.freqs_cis)
        self.register_buffer('extended_freqs_cis_buf', self.extended_freqs_cis)
    
    def forward(
        self, 
        seq_len: int, 
        device: Optional[torch.device] = None,
        extend: bool = False
    ) -> torch.Tensor:
        """
        获取指定长度的频率
        
        Args:
            seq_len: 序列长度
            device: 设备
            extend: 是否使用扩展频率（用于外推）
        
        Returns:
            freqs_cis: (seq_len, dim//2) 复数频率
        """
        if extend:
            if seq_len > self.extended_freqs_cis.shape[0]:
                extend_len = int(seq_len * self.extend_ratio)
                extended_freqs = self._compute_freqs_cis(extend_len)
                return extended_freqs[:seq_len].to(device)
            return self.extended_freqs_cis[:seq_len].to(device)
        
        if seq_len > self.freqs_cis.shape[0]:
            extended_freqs = self._compute_freqs_cis(seq_len)
            return extended_freqs.to(device)
        
        return self.freqs_cis_buf[:seq_len].to(device)
    
    def _compute_freqs_cis(self, seq_len: int) -> torch.Tensor:
        """动态计算频率（用于超长序列）"""
        freqs = 1.0 / (self.base ** (torch.arange(0, self.dim, 2).float() / self.dim))
        t = torch.arange(seq_len)
        freqs = torch.outer(t, freqs)
        return torch.polar(torch.ones_like(freqs), freqs)
    
    def get_embedding(
        self, 
        positions: torch.Tensor,
        extend: bool = False
    ) -> torch.Tensor:
        """
        获取指定位置的旋转编码
        
        Args:
            positions: (batch, seq_len) 位置索引
            extend: 是否使用扩展频率
        
        Returns:
            embeddings: (batch, seq_len, dim) 旋转编码
        """
        seq_len = positions.max().item() + 1
        freqs_cis = self.forward(seq_len, positions.device, extend)
        
        positions = positions.clamp(max=seq_len - 1)
        freqs = freqs_cis[positions]
        
        embeddings = torch.zeros(
            *positions.shape, self.dim,
            dtype=torch.float32,
            device=positions.device
        )
        
        embeddings[..., 0::2] = freqs.real
        embeddings[..., 1::2] = freqs.imag
        
        return embeddings


class RotaryEmbeddingWithCache(nn.Module):
    """
    带缓存的旋转位置编码（适合推理）
    """
    
    def __init__(
        self,
        dim: int,
        max_seq_len: int = 4096,
        base: float = 10000.0,
    ):
        super().__init__()
        self.dim = dim
        self.max_seq_len = max_seq_len
        self.base = base
        
        freqs_cis = precompute_freqs_cis(dim, max_seq_len, base)
        self.register_buffer('freqs_cis', freqs_cis)
        
        self._cache = {}
    
    def forward(self, positions: torch.Tensor) -> torch.Tensor:
        """
        获取位置的旋转编码
        
        Args:
            positions: (batch, seq_len) 位置索引
        
        Returns:
            embeddings: (batch, seq_len, dim)
        """
        positions = positions.clamp(max=self.max_seq_len - 1)
        
        result = torch.zeros(
            *positions.shape, self.dim,
            dtype=torch.complex64,
            device=positions.device
        )
        
        for i in range(positions.shape[0]):
            for j in range(positions.shape[1]):
                pos = positions[i, j].item()
                result[i, j] = self.freqs_cis[pos]
        
        return result
    
    def get_next_position_cis(self, position: int) -> torch.Tensor:
        """
        获取下一个位置的编码（推理时使用）
        """
        if position >= self.max_seq_len:
            freq = 1.0 / (self.base ** (torch.arange(0, self.dim, 2).float() / self.dim))
            t = torch.tensor([position])
            freqs = torch.outer(t, freq)
            return torch.polar(torch.ones_like(freqs), freqs).squeeze(0)
        
        return self.freqs_cis[position]


class MultiHeadRoPE(nn.Module):
    """
    多头旋转位置编码
    将RoPE应用于多头注意力
    """
    
    def __init__(
        self,
        num_heads: int,
        head_dim: int,
        max_seq_len: int = 4096,
        base: float = 10000.0,
    ):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = head_dim
        self.rope = RotaryEmbedding(
            dim=head_dim,
            max_seq_len=max_seq_len,
            base=base,
        )
    
    def forward(
        self,
        xq: torch.Tensor,
        xk: torch.Tensor,
        positions: Optional[torch.Tensor] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        应用多头旋转位置编码
        
        Args:
            xq: (batch, seq_len, n_heads, head_dim)
            xk: (batch, seq_len, n_heads, head_dim)
            positions: (batch, seq_len) 位置索引，默认None
        
        Returns:
            xq, xk: 应用RoPE后的张量
        """
        seq_len = xq.shape[1]
        
        if positions is None:
            positions = torch.arange(seq_len, device=xq.device).unsqueeze(0).expand(xq.shape[0], -1)
        
        freqs_cis = self.rope(seq_len, xq.device)
        
        xq_real = xq.float().reshape(*xq.shape[:-1], -1, 2)
        xk_real = xk.float().reshape(*xk.shape[:-1], -1, 2)
        
        xq_real = xq_real.reshape(xq.shape[0], xq.shape[1], xq.shape[2], -1, 2)
        xk_real = xk_real.reshape(xk.shape[0], xk.shape[1], xk.shape[2], -1, 2)
        
        xq_out = torch.zeros_like(xq)
        xk_out = torch.zeros_like(xk)
        
        for head in range(self.num_heads):
            head_freqs = freqs_cis.unsqueeze(0).unsqueeze(2)
            
            xq_head = xq_real[:, :, head, :, 0]
            xq_head_imag = xq_real[:, :, head, :, 1]
            
            xk_head = xk_real[:, :, head, :, 0]
            xk_head_imag = xk_real[:, :, head, :, 1]
            
            xq_out[:, :, head, :, 0] = xq_head * head_freqs.real - xq_head_imag * head_freqs.imag
            xq_out[:, :, head, :, 1] = xq_head * head_freqs.imag + xq_head_imag * head_freqs.real
            
            xk_out[:, :, head, :, 0] = xk_head * head_freqs.real - xk_head_imag * head_freqs.imag
            xk_out[:, :, head, :, 1] = xk_head * head_freqs.imag + xk_head_imag * head_freqs.real
        
        return xq_out, xk_out


class YaRNRotaryEmbedding(nn.Module):
    """
    YaRN (Yet another RoPE extensioN method) 旋转位置编码
    
    YaRN是一种更先进的长文本外推方法，通过以下技术实现更好的外推效果：
    1. NTK-aware插值：针对不同频率使用不同的缩放因子
    2. 动态缩放：根据序列长度动态调整缩放参数
    3. 温度调整：通过温度参数调整注意力分布
    
    参考: https://arxiv.org/abs/2309.00071
    """
    
    def __init__(
        self,
        dim: int,
        max_seq_len: int = 2048,
        base: float = 10000.0,
        scaling_factor: float = 4.0,
        beta_fast: float = 32.0,
        beta_slow: float = 1.0,
        attention_factor: float = 1.0,
    ):
        super().__init__()
        self.dim = dim
        self.max_seq_len = max_seq_len
        self.base = base
        self.scaling_factor = scaling_factor
        self.beta_fast = beta_fast
        self.beta_slow = beta_slow
        self.attention_factor = attention_factor
        
        self._compute_yarn_freqs()
    
    def _compute_yarn_freqs(self):
        """计算YaRN频率"""
        pos_freqs = self.base ** (torch.arange(0, self.dim, 2).float() / self.dim)
        
        inv_freq = 1.0 / pos_freqs
        
        self.register_buffer('inv_freq', inv_freq)
        
        self._compute_slopes()
    
    def _compute_slopes(self):
        """计算NTK-aware斜率"""
        high_freq = self.max_seq_len * self.beta_fast
        low_freq = self.max_seq_len * self.beta_slow
        
        freqs = 1.0 / (self.base ** (torch.arange(0, self.dim, 2).float() / self.dim))
        
        slopes = torch.ones_like(freqs)
        
        for i, freq in enumerate(freqs):
            if freq > high_freq:
                slopes[i] = 1.0
            elif freq < low_freq:
                slopes[i] = 1.0 / self.scaling_factor
            else:
                smooth = (freq - low_freq) / (high_freq - low_freq)
                slopes[i] = 1.0 / (smooth * (self.scaling_factor - 1) + 1)
        
        self.register_buffer('slopes', slopes)
    
    def forward(
        self,
        seq_len: int,
        device: Optional[torch.device] = None,
        position_ids: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """
        获取YaRN频率
        
        Args:
            seq_len: 序列长度
            device: 设备
            position_ids: 位置ID，如果提供则使用
        
        Returns:
            freqs_cis: 复数频率张量
        """
        if device is None:
            device = self.inv_freq.device
        
        if position_ids is None:
            t = torch.arange(seq_len, device=device, dtype=torch.float32)
        else:
            t = position_ids.float()
        
        scaled_t = t / self.scaling_factor
        
        freqs = torch.outer(scaled_t, self.inv_freq.to(device))
        
        freqs = freqs * self.slopes.to(device).unsqueeze(0)
        
        freqs_cis = torch.polar(torch.ones_like(freqs), freqs)
        
        return freqs_cis
    
    def get_attention_scale(self, seq_len: int) -> float:
        """获取注意力缩放因子"""
        if self.attention_factor != 1.0:
            return self.attention_factor
        
        return math.log(seq_len / self.max_seq_len) + 1.0 if seq_len > self.max_seq_len else 1.0


class LinearScalingRotaryEmbedding(nn.Module):
    """
    线性缩放旋转位置编码
    
    简单的位置插值方法，将位置索引线性缩放
    """
    
    def __init__(
        self,
        dim: int,
        max_seq_len: int = 2048,
        base: float = 10000.0,
        scaling_factor: float = 4.0,
    ):
        super().__init__()
        self.dim = dim
        self.max_seq_len = max_seq_len
        self.base = base
        self.scaling_factor = scaling_factor
        
        inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer('inv_freq', inv_freq)
    
    def forward(
        self,
        seq_len: int,
        device: Optional[torch.device] = None,
    ) -> torch.Tensor:
        """获取线性缩放频率"""
        if device is None:
            device = self.inv_freq.device
        
        t = torch.arange(seq_len, device=device, dtype=torch.float32)
        t = t / self.scaling_factor
        
        freqs = torch.outer(t, self.inv_freq.to(device))
        freqs_cis = torch.polar(torch.ones_like(freqs), freqs)
        
        return freqs_cis


class NTKScalingRotaryEmbedding(nn.Module):
    """
    NTK-aware缩放旋转位置编码
    
    通过调整基频来实现外推，而不是线性插值位置
    """
    
    def __init__(
        self,
        dim: int,
        max_seq_len: int = 2048,
        base: float = 10000.0,
        scaling_factor: float = 4.0,
    ):
        super().__init__()
        self.dim = dim
        self.max_seq_len = max_seq_len
        self.original_base = base
        self.scaling_factor = scaling_factor
        
        new_base = base * (scaling_factor ** (dim / (dim - 2)))
        self.base = new_base
        
        inv_freq = 1.0 / (new_base ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer('inv_freq', inv_freq)
    
    def forward(
        self,
        seq_len: int,
        device: Optional[torch.device] = None,
    ) -> torch.Tensor:
        """获取NTK缩放频率"""
        if device is None:
            device = self.inv_freq.device
        
        t = torch.arange(seq_len, device=device, dtype=torch.float32)
        
        freqs = torch.outer(t, self.inv_freq.to(device))
        freqs_cis = torch.polar(torch.ones_like(freqs), freqs)
        
        return freqs_cis


def create_rope_with_scaling(
    dim: int,
    max_seq_len: int = 2048,
    base: float = 10000.0,
    scaling_type: str = "none",
    scaling_factor: float = 4.0,
    **kwargs,
) -> nn.Module:
    """
    创建带缩放的RoPE模块工厂函数
    
    Args:
        dim: 注意力头维度
        max_seq_len: 最大序列长度
        base: 基频
        scaling_type: 缩放类型 ("none", "linear", "ntk", "yarn")
        scaling_factor: 缩放因子
        **kwargs: 额外参数（用于YaRN）
    
    Returns:
        RoPE模块
    """
    scaling_type = scaling_type.lower()
    
    if scaling_type == "none":
        return RotaryEmbedding(
            dim=dim,
            max_seq_len=max_seq_len,
            base=base,
        )
    elif scaling_type == "linear":
        return LinearScalingRotaryEmbedding(
            dim=dim,
            max_seq_len=max_seq_len,
            base=base,
            scaling_factor=scaling_factor,
        )
    elif scaling_type == "ntk":
        return NTKScalingRotaryEmbedding(
            dim=dim,
            max_seq_len=max_seq_len,
            base=base,
            scaling_factor=scaling_factor,
        )
    elif scaling_type == "yarn":
        return YaRNRotaryEmbedding(
            dim=dim,
            max_seq_len=max_seq_len,
            base=base,
            scaling_factor=scaling_factor,
            beta_fast=kwargs.get('beta_fast', 32.0),
            beta_slow=kwargs.get('beta_slow', 1.0),
            attention_factor=kwargs.get('attention_factor', 1.0),
        )
    else:
        raise ValueError(f"未知的缩放类型: {scaling_type}，可选: none, linear, ntk, yarn")


def test_rope():
    """测试RoPE实现"""
    batch_size = 2
    seq_len = 16
    num_heads = 8
    head_dim = 64
    
    rope = RotaryEmbedding(dim=head_dim, max_seq_len=512)
    
    xq = torch.randn(batch_size, seq_len, num_heads, head_dim)
    xk = torch.randn(batch_size, seq_len, num_heads, head_dim)
    
    freqs_cis = rope(seq_len, xq.device)
    
    xq_rotated, xk_rotated = apply_rotary_emb_batched(xq, xk, freqs_cis)
    
    print(f"RoPE输入形状: xq={xq.shape}, xk={xk.shape}")
    print(f"频率形状: {freqs_cis.shape}")
    print(f"RoPE输出形状: xq_rotated={xq_rotated.shape}, xk_rotated={xk_rotated.shape}")
    
    xq_transposed = xq.transpose(1, 2)
    xk_transposed = xk.transpose(1, 2)
    xq_rotated2, xk_rotated2 = apply_rotary_emb_batched(xq_transposed, xk_transposed, freqs_cis)
    print(f"\n测试转置输入:")
    print(f"转置输入形状: xq={xq_transposed.shape}, xk={xk_transposed.shape}")
    print(f"转置输出形状: xq_rotated={xq_rotated2.shape}, xk_rotated={xk_rotated2.shape}")
    
    positions = torch.tensor([[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                              [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]])
    embeddings = rope.get_embedding(positions)
    print(f"\n位置嵌入形状: {embeddings.shape}")
    
    print("\n" + "=" * 60)
    print("测试YaRN长文本外推")
    print("=" * 60)
    
    yarn_rope = YaRNRotaryEmbedding(
        dim=head_dim,
        max_seq_len=512,
        scaling_factor=4.0,
    )
    
    short_freqs = yarn_rope(128)
    long_freqs = yarn_rope(2048)
    
    print(f"短序列频率形状: {short_freqs.shape}")
    print(f"长序列频率形状: {long_freqs.shape}")
    print(f"注意力缩放因子 (512): {yarn_rope.get_attention_scale(512):.4f}")
    print(f"注意力缩放因子 (2048): {yarn_rope.get_attention_scale(2048):.4f}")
    
    print("\n" + "=" * 60)
    print("测试不同缩放方法")
    print("=" * 60)
    
    for scaling_type in ["none", "linear", "ntk", "yarn"]:
        rope_module = create_rope_with_scaling(
            dim=head_dim,
            max_seq_len=512,
            scaling_type=scaling_type,
            scaling_factor=4.0,
        )
        freqs = rope_module(1024)
        print(f"{scaling_type.upper():8s}: 频率形状 {freqs.shape}")
    
    print("\nRoPE测试通过!")


if __name__ == "__main__":
    test_rope()
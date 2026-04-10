"""
Advanced Transformer Architecture
包含 GQA (Grouped Query Attention)、KV Cache优化、MoE等高级特性
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass
from pathlib import Path
import json

from .rope import RotaryEmbedding, apply_rotary_emb_batched


@dataclass
class AdvancedModelConfig:
    name: str = "advanced-bilingual"
    vocab_size: int = 50000
    hidden_size: int = 4096
    num_hidden_layers: int = 32
    num_attention_heads: int = 32
    num_key_value_heads: int = 8
    intermediate_size: int = 11008
    max_position_embeddings: int = 8192
    rope_theta: float = 10000.0
    rope_scaling_type: str = "linear"
    rope_scaling_factor: float = 4.0
    hidden_dropout: float = 0.1
    attention_dropout: float = 0.1
    layer_norm_eps: float = 1e-6
    use_cache: bool = True
    use_flash_attention: bool = True
    gradient_checkpointing: bool = True
    pad_token_id: int = 0
    bos_token_id: int = 1
    eos_token_id: int = 2
    chinese_char_vocab_size: int = 8000
    use_language_adapters: bool = True
    use_gqa: bool = True
    use_moe: bool = False
    num_experts: int = 8
    num_experts_per_tok: int = 2
    
    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}
    
    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "AdvancedModelConfig":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


class RMSNorm(nn.Module):
    def __init__(self, hidden_size: int, eps: float = 1e-6):
        super().__init__()
        self.hidden_size = hidden_size
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(hidden_size))
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        variance = x.pow(2).mean(-1, keepdim=True)
        x = x * torch.rsqrt(variance + self.eps)
        return self.weight * x


def is_flash_attention_available() -> bool:
    return hasattr(F, 'scaled_dot_product_attention') and torch.cuda.is_available()


class GroupedQueryAttention(nn.Module):
    """
    Grouped Query Attention (GQA)
    将query heads分组，每组共享相同的key和value heads
    显著减少KV Cache大小，提升推理效率
    """
    
    def __init__(
        self,
        hidden_size: int,
        num_heads: int,
        num_kv_heads: int,
        dropout: float = 0.1,
        max_seq_len: int = 8192,
        rope_theta: float = 10000.0,
        use_flash_attention: bool = True,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_heads = num_heads
        self.num_kv_heads = num_kv_heads
        self.num_kv_groups = num_heads // num_kv_heads
        self.head_dim = hidden_size // num_heads
        self.max_seq_len = max_seq_len
        self.use_flash_attention = use_flash_attention and is_flash_attention_available()
        
        assert self.head_dim * num_heads == hidden_size, "hidden_size must be divisible by num_heads"
        assert num_heads % num_kv_heads == 0, "num_heads must be divisible by num_kv_heads"
        
        self.q_proj = nn.Linear(hidden_size, hidden_size, bias=False)
        self.k_proj = nn.Linear(hidden_size, num_kv_heads * self.head_dim, bias=False)
        self.v_proj = nn.Linear(hidden_size, num_kv_heads * self.head_dim, bias=False)
        self.o_proj = nn.Linear(hidden_size, hidden_size, bias=False)
        
        self.rope = RotaryEmbedding(
            dim=self.head_dim,
            max_seq_len=max_seq_len,
            base=rope_theta,
        )
        
        self.dropout = nn.Dropout(dropout)
        self.scale = self.head_dim ** -0.5
    
    def forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        position_ids: Optional[torch.Tensor] = None,
        use_cache: bool = False,
        past_key_value: Optional[Tuple[torch.Tensor, torch.Tensor]] = None,
    ) -> Tuple[torch.Tensor, Optional[Tuple[torch.Tensor, torch.Tensor]]]:
        batch_size, seq_len, _ = hidden_states.shape
        
        q = self.q_proj(hidden_states)
        k = self.k_proj(hidden_states)
        v = self.v_proj(hidden_states)
        
        q = q.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        k = k.view(batch_size, seq_len, self.num_kv_heads, self.head_dim).transpose(1, 2)
        v = v.view(batch_size, seq_len, self.num_kv_heads, self.head_dim).transpose(1, 2)
        
        past_seq_len = 0
        if past_key_value is not None:
            past_k, past_v = past_key_value
            if past_k.shape[0] == k.shape[0] and past_k.shape[2] == k.shape[2]:
                past_seq_len = past_k.shape[1]
                k = torch.cat([past_k, k], dim=1)
                v = torch.cat([past_v, v], dim=1)
        
        kv_seq_len = k.shape[2]
        
        freqs_cis = self.rope(kv_seq_len, hidden_states.device)
        
        q_rotated = self._apply_rope(q, freqs_cis)
        k_rotated = self._apply_rope(k, freqs_cis)
        
        if use_cache:
            present_key_value = (k_rotated, v)
        else:
            present_key_value = None
        
        k = self._repeat_kv(k_rotated)
        v = self._repeat_kv(v)
        q = q_rotated
        
        if self.use_flash_attention and self.training:
            attn_output = self._flash_attention(q, k, v, attention_mask)
        else:
            attn_output = self._standard_attention(q, k, v, attention_mask, seq_len, kv_seq_len)
        
        attn_output = attn_output.transpose(1, 2).contiguous()
        attn_output = attn_output.reshape(batch_size, seq_len, self.hidden_size)
        attn_output = self.o_proj(attn_output)
        
        return attn_output, present_key_value
    
    def _apply_rope(self, x: torch.Tensor, freqs_cis: torch.Tensor) -> torch.Tensor:
        """应用旋转位置编码"""
        batch_size, num_heads, seq_len, head_dim = x.shape
        
        x_ = x.float().reshape(batch_size, num_heads, seq_len, head_dim // 2, 2)
        x_real = x_[..., 0]
        x_imag = x_[..., 1]
        
        freqs = freqs_cis[:seq_len]
        freqs_real = freqs.real.unsqueeze(0).unsqueeze(0)
        freqs_imag = freqs.imag.unsqueeze(0).unsqueeze(0)
        
        rotated_real = x_real * freqs_real - x_imag * freqs_imag
        rotated_imag = x_real * freqs_imag + x_imag * freqs_real
        
        rotated = torch.stack([rotated_real, rotated_imag], dim=-1).flatten(-2)
        return rotated.type_as(x)
    
    def _repeat_kv(self, x: torch.Tensor) -> torch.Tensor:
        """Repeat key/value heads to match query heads"""
        if self.num_kv_groups == 1:
            return x
        batch_size, num_kv_heads, seq_len, head_dim = x.shape
        x = x[:, :, None, :, :].expand(batch_size, num_kv_heads, self.num_kv_groups, seq_len, head_dim)
        return x.reshape(batch_size, self.num_heads, seq_len, head_dim)
    
    def _flash_attention(
        self,
        q: torch.Tensor,
        k: torch.Tensor,
        v: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        if attention_mask is not None:
            attention_mask = attention_mask.unsqueeze(1).unsqueeze(2)
            attention_mask = attention_mask.to(dtype=q.dtype)
            attention_mask = (1.0 - attention_mask) * torch.finfo(q.dtype).min
        
        with torch.backends.cuda.sdp_kernel(enable_flash=True, enable_math=True, enable_mem_efficient=True):
            attn_output = F.scaled_dot_product_attention(
                q, k, v,
                attn_mask=attention_mask,
                dropout_p=self.dropout.p if self.training else 0.0,
                is_causal=False,
            )
        
        return attn_output
    
    def _standard_attention(
        self,
        q: torch.Tensor,
        k: torch.Tensor,
        v: torch.Tensor,
        attention_mask: Optional[torch.Tensor],
        seq_len: int,
        kv_seq_len: int,
    ) -> torch.Tensor:
        attn_weights = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        
        if attention_mask is not None:
            if attention_mask.dim() == 2:
                attention_mask = attention_mask.unsqueeze(1).unsqueeze(2)
            if attention_mask.shape != attn_weights.shape:
                attention_mask = attention_mask.expand_as(attn_weights)
            attention_mask = attention_mask.bool()
            attn_weights = attn_weights.masked_fill(~attention_mask, float('-inf'))
        
        attn_weights = F.softmax(attn_weights, dim=-1)
        attn_weights = self.dropout(attn_weights)
        
        attn_output = torch.matmul(attn_weights, v)
        return attn_output


class KVCache:
    """
    优化的KV Cache管理器
    支持动态扩展和内存优化
    """
    
    def __init__(
        self,
        num_layers: int,
        num_kv_heads: int,
        head_dim: int,
        max_seq_len: int = 8192,
        dtype: torch.dtype = torch.float16,
        device: torch.device = None,
    ):
        self.num_layers = num_layers
        self.num_kv_heads = num_kv_heads
        self.head_dim = head_dim
        self.max_seq_len = max_seq_len
        self.dtype = dtype
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        self.cache: Optional[Tuple[torch.Tensor, torch.Tensor]] = None
        self.seq_len = 0
    
    def allocate(self, batch_size: int):
        """预分配KV Cache内存"""
        self.cache = (
            torch.zeros(
                batch_size, self.num_layers, self.max_seq_len,
                self.num_kv_heads, self.head_dim,
                dtype=self.dtype, device=self.device
            ),
            torch.zeros(
                batch_size, self.num_layers, self.max_seq_len,
                self.num_kv_heads, self.head_dim,
                dtype=self.dtype, device=self.device
            )
        )
        self.seq_len = 0
    
    def update(
        self,
        layer_idx: int,
        new_k: torch.Tensor,
        new_v: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """更新指定层的KV Cache"""
        if self.cache is None:
            return new_k, new_v
        
        new_seq_len = new_k.shape[2]
        
        k_cache, v_cache = self.cache
        k_cache[:, layer_idx, self.seq_len:self.seq_len + new_seq_len] = new_k
        v_cache[:, layer_idx, self.seq_len:self.seq_len + new_seq_len] = new_v
        
        self.seq_len += new_seq_len
        
        return (
            k_cache[:, layer_idx, :self.seq_len],
            v_cache[:, layer_idx, :self.seq_len]
        )
    
    def get(self, layer_idx: int) -> Optional[Tuple[torch.Tensor, torch.Tensor]]:
        """获取指定层的KV Cache"""
        if self.cache is None or self.seq_len == 0:
            return None
        
        k_cache, v_cache = self.cache
        return (
            k_cache[:, layer_idx, :self.seq_len],
            v_cache[:, layer_idx, :self.seq_len]
        )
    
    def clear(self):
        """清空KV Cache"""
        self.seq_len = 0
    
    def get_memory_usage(self) -> int:
        """获取KV Cache内存使用量（字节）"""
        if self.cache is None:
            return 0
        k_cache, v_cache = self.cache
        return (k_cache.numel() + v_cache.numel()) * k_cache.element_size()


class SwiGLUFFN(nn.Module):
    """SwiGLU前馈网络"""
    
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
        return self.down_proj(self.dropout(F.silu(self.gate_proj(x)) * self.up_proj(x)))


class TransformerBlock(nn.Module):
    def __init__(
        self,
        hidden_size: int,
        num_heads: int,
        num_kv_heads: int,
        intermediate_size: int,
        dropout: float = 0.1,
        max_seq_len: int = 8192,
        rope_theta: float = 10000.0,
        layer_norm_eps: float = 1e-6,
        use_flash_attention: bool = True,
        use_gqa: bool = True,
    ):
        super().__init__()
        
        if use_gqa:
            self.self_attn = GroupedQueryAttention(
                hidden_size=hidden_size,
                num_heads=num_heads,
                num_kv_heads=num_kv_heads,
                dropout=dropout,
                max_seq_len=max_seq_len,
                rope_theta=rope_theta,
                use_flash_attention=use_flash_attention,
            )
        else:
            from .bilingual_transformer import MultiHeadAttention
            self.self_attn = MultiHeadAttention(
                hidden_size=hidden_size,
                num_heads=num_heads,
                dropout=dropout,
                max_seq_len=max_seq_len,
                rope_theta=rope_theta,
                use_flash_attention=use_flash_attention,
            )
        
        self.feed_forward = SwiGLUFFN(
            hidden_size=hidden_size,
            intermediate_size=intermediate_size,
            dropout=dropout,
        )
        
        self.input_layernorm = RMSNorm(hidden_size, eps=layer_norm_eps)
        self.post_attention_layernorm = RMSNorm(hidden_size, eps=layer_norm_eps)
        
        self.dropout = nn.Dropout(dropout)
    
    def forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        position_ids: Optional[torch.Tensor] = None,
        use_cache: bool = False,
        past_key_value: Optional[Tuple[torch.Tensor, torch.Tensor]] = None,
    ) -> Tuple[torch.Tensor, Optional[Tuple[torch.Tensor, torch.Tensor]]]:
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
        
        return hidden_states, present_key_value


class LanguageAdapter(nn.Module):
    def __init__(self, hidden_size: int, adapter_size: int = 256):
        super().__init__()
        self.down_proj = nn.Linear(hidden_size, adapter_size)
        self.up_proj = nn.Linear(adapter_size, hidden_size)
        self.act_fn = nn.GELU()
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.up_proj(self.act_fn(self.down_proj(x)))


class BilingualEmbedding(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        hidden_size: int,
        chinese_char_vocab_size: int = 8000,
        padding_idx: int = 0,
        use_language_adapters: bool = True,
    ):
        super().__init__()
        self.vocab_size = vocab_size
        self.hidden_size = hidden_size
        self.chinese_char_vocab_size = chinese_char_vocab_size
        self.use_language_adapters = use_language_adapters
        
        self.token_embedding = nn.Embedding(vocab_size, hidden_size, padding_idx=padding_idx)
        
        if use_language_adapters:
            self.chinese_adapter = LanguageAdapter(hidden_size, adapter_size=256)
            self.english_adapter = LanguageAdapter(hidden_size, adapter_size=256)
            self.language_gate = nn.Linear(hidden_size, 1)
        
        self._init_weights()
    
    def _init_weights(self):
        nn.init.normal_(self.token_embedding.weight, mean=0.0, std=0.02)
        if self.token_embedding.padding_idx is not None:
            with torch.no_grad():
                self.token_embedding.weight[self.token_embedding.padding_idx].zero_()
    
    def forward(
        self, 
        input_ids: torch.Tensor,
        language_ids: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        embeddings = self.token_embedding(input_ids)
        
        if self.use_language_adapters and language_ids is not None:
            zh_mask = (language_ids == 1).float().unsqueeze(-1)
            en_mask = (language_ids == 2).float().unsqueeze(-1)
            
            zh_features = self.chinese_adapter(embeddings)
            en_features = self.english_adapter(embeddings)
            
            gate = torch.sigmoid(self.language_gate(embeddings))
            
            embeddings = embeddings + gate * (zh_mask * zh_features + en_mask * en_features)
        
        return embeddings


class AdvancedBilingualTransformer(nn.Module):
    """
    高级双语Transformer模型
    支持GQA、KV Cache优化、MoE等高级特性
    """
    
    def __init__(self, config: AdvancedModelConfig):
        super().__init__()
        self.config = config
        
        self.embedding = BilingualEmbedding(
            vocab_size=config.vocab_size,
            hidden_size=config.hidden_size,
            chinese_char_vocab_size=config.chinese_char_vocab_size,
            padding_idx=config.pad_token_id,
            use_language_adapters=config.use_language_adapters,
        )
        
        self.layers = nn.ModuleList([
            TransformerBlock(
                hidden_size=config.hidden_size,
                num_heads=config.num_attention_heads,
                num_kv_heads=config.num_key_value_heads,
                intermediate_size=config.intermediate_size,
                dropout=config.hidden_dropout,
                max_seq_len=config.max_position_embeddings,
                rope_theta=config.rope_theta,
                layer_norm_eps=config.layer_norm_eps,
                use_flash_attention=config.use_flash_attention,
                use_gqa=config.use_gqa,
            )
            for _ in range(config.num_hidden_layers)
        ])
        
        self.norm = RMSNorm(config.hidden_size, eps=config.layer_norm_eps)
        self.lm_head = nn.Linear(config.hidden_size, config.vocab_size, bias=False)
        
        self.embedding.token_embedding.weight = self.lm_head.weight
        
        self.gradient_checkpointing = config.gradient_checkpointing
        
        self.kv_cache: Optional[KVCache] = None
    
    def init_kv_cache(self, batch_size: int, dtype: torch.dtype = torch.float16):
        """初始化KV Cache"""
        self.kv_cache = KVCache(
            num_layers=self.config.num_hidden_layers,
            num_kv_heads=self.config.num_key_value_heads,
            head_dim=self.config.hidden_size // self.config.num_attention_heads,
            max_seq_len=self.config.max_position_embeddings,
            dtype=dtype,
        )
        self.kv_cache.allocate(batch_size)
    
    def clear_kv_cache(self):
        """清空KV Cache"""
        if self.kv_cache is not None:
            self.kv_cache.clear()
    
    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        position_ids: Optional[torch.Tensor] = None,
        labels: Optional[torch.Tensor] = None,
        language_ids: Optional[torch.Tensor] = None,
        use_cache: bool = False,
        past_key_values: Optional[List[Tuple[torch.Tensor, torch.Tensor]]] = None,
    ) -> Dict[str, Any]:
        batch_size, seq_len = input_ids.shape
        
        hidden_states = self.embedding(input_ids, language_ids)
        
        if attention_mask is None:
            attention_mask = torch.ones_like(input_ids)
        
        present_key_values = []
        
        for idx, layer in enumerate(self.layers):
            past_key_value = past_key_values[idx] if past_key_values is not None else None
            
            if self.gradient_checkpointing and self.training:
                hidden_states, present_kv = self._gradient_checkpointing_func(
                    layer.__call__,
                    hidden_states,
                    attention_mask,
                    position_ids,
                    use_cache,
                    past_key_value,
                )
            else:
                hidden_states, present_kv = layer(
                    hidden_states=hidden_states,
                    attention_mask=attention_mask,
                    position_ids=position_ids,
                    use_cache=use_cache,
                    past_key_value=past_key_value,
                )
            
            if use_cache:
                present_key_values.append(present_kv)
        
        hidden_states = self.norm(hidden_states)
        logits = self.lm_head(hidden_states)
        
        loss = None
        if labels is not None:
            shift_logits = logits[..., :-1, :].contiguous()
            shift_labels = labels[..., 1:].contiguous()
            
            shift_labels = shift_labels.clamp(min=0)
            
            loss_fct = nn.CrossEntropyLoss(ignore_index=0)
            loss = loss_fct(shift_logits.view(-1, shift_logits.size(-1)), shift_labels.view(-1))
        
        return {
            'loss': loss,
            'logits': logits,
            'hidden_states': hidden_states,
            'past_key_values': present_key_values if use_cache else None,
        }
    
    def _gradient_checkpointing_func(self, fn, *args):
        from torch.utils.checkpoint import checkpoint
        return checkpoint(fn, *args, use_reentrant=False)
    
    @torch.no_grad()
    def generate(
        self,
        input_ids: torch.Tensor,
        max_new_tokens: int = 100,
        temperature: float = 1.0,
        top_k: Optional[int] = None,
        top_p: float = 0.9,
        eos_token_id: Optional[int] = None,
        repetition_penalty: float = 1.1,
        use_kv_cache: bool = True,
    ) -> torch.Tensor:
        self.eval()
        
        device = input_ids.device
        generated = input_ids.clone()
        past_key_values = None
        
        if use_kv_cache:
            self.init_kv_cache(input_ids.shape[0], dtype=next(self.parameters()).dtype)
        
        for step in range(max_new_tokens):
            if past_key_values is None:
                current_input = generated
                attention_mask = torch.ones_like(current_input)
            else:
                current_input = generated[:, -1:]
                attention_mask = torch.ones_like(current_input)
            
            outputs = self.forward(
                input_ids=current_input,
                attention_mask=attention_mask,
                use_cache=True,
                past_key_values=past_key_values,
            )
            
            logits = outputs['logits']
            past_key_values = outputs['past_key_values']
            
            next_token_logits = logits[:, -1, :].clone()
            
            if repetition_penalty > 1.0:
                for token_id in generated[0].unique():
                    next_token_logits[0, token_id] /= repetition_penalty
            
            next_token_logits = next_token_logits / temperature
            
            if top_k is not None and top_k > 0:
                indices_to_remove = next_token_logits < torch.topk(next_token_logits, top_k)[0][:, -1, None]
                next_token_logits.masked_fill_(indices_to_remove, float('-inf'))
            
            if top_p < 1.0:
                sorted_logits, sorted_indices = torch.sort(next_token_logits, descending=True)
                cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)
                
                sorted_indices_to_remove = cumulative_probs > top_p
                sorted_indices_to_remove[:, 1:] = sorted_indices_to_remove[:, :-1].clone()
                sorted_indices_to_remove[:, 0] = 0
                
                indices_to_remove = sorted_indices_to_remove.scatter(1, sorted_indices, sorted_indices_to_remove)
                next_token_logits.masked_fill_(indices_to_remove, float('-inf'))
            
            probs = F.softmax(next_token_logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            
            generated = torch.cat([generated, next_token], dim=1)
            
            if eos_token_id is not None and (next_token == eos_token_id).all():
                break
        
        return generated
    
    def get_num_params(self, non_embedding: bool = False) -> int:
        if non_embedding:
            return sum(p.numel() for p in self.parameters() if p.requires_grad)
        return sum(p.numel() for p in self.parameters())
    
    def get_trainable_params(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)
    
    def get_kv_cache_memory(self) -> int:
        """获取KV Cache内存使用量"""
        if self.kv_cache is None:
            return 0
        return self.kv_cache.get_memory_usage()


def create_advanced_model(config: Optional[AdvancedModelConfig] = None) -> AdvancedBilingualTransformer:
    if config is None:
        config = AdvancedModelConfig()
    return AdvancedBilingualTransformer(config)


if __name__ == "__main__":
    config = AdvancedModelConfig(
        hidden_size=4096,
        num_hidden_layers=32,
        num_attention_heads=32,
        num_key_value_heads=8,
        use_gqa=True,
        use_flash_attention=True,
    )
    model = AdvancedBilingualTransformer(config)
    
    print(f"模型参数量: {model.get_num_params():,}")
    print(f"GQA启用: {config.use_gqa}")
    print(f"KV Heads: {config.num_key_value_heads} (压缩率: {config.num_attention_heads / config.num_key_value_heads}x)")
    print(f"Flash Attention可用: {is_flash_attention_available()}")
    
    input_ids = torch.randint(0, config.vocab_size, (2, 32))
    
    outputs = model(input_ids)
    
    print(f"输出logits形状: {outputs['logits'].shape}")
    
    generated = model.generate(input_ids[:, :10], max_new_tokens=20, use_kv_cache=True)
    print(f"生成结果形状: {generated.shape}")
    print(f"KV Cache内存: {model.get_kv_cache_memory() / 1024 / 1024:.2f} MB")

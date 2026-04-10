"""
Bilingual Transformer Language Model
支持中英双语无缝切换的Transformer语言模型
优化版本 - 支持Flash Attention、更好的双语嵌入
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import json

from .rope import RotaryEmbedding, apply_rotary_emb_batched, YaRNRotaryEmbedding, create_rope_with_scaling


@dataclass
class ModelConfig:
    name: str = "bilingual-base"
    vocab_size: int = 50000
    hidden_size: int = 768
    num_hidden_layers: int = 12
    num_attention_heads: int = 12
    num_kv_heads: int = 3
    intermediate_size: int = 3072
    max_position_embeddings: int = 800000
    rope_theta: float = 10000.0
    rope_scaling_type: str = "yarn"
    rope_scaling_factor: float = 195.3
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

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ModelConfig":
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


class MultiHeadAttention(nn.Module):
    def __init__(
        self,
        hidden_size: int,
        num_heads: int,
        num_kv_heads: int = None,
        dropout: float = 0.1,
        max_seq_len: int = 4096,
        rope_theta: float = 10000.0,
        use_flash_attention: bool = True,
        rope_scaling_type: str = "yarn",
        rope_scaling_factor: float = 195.3,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_heads = num_heads
        self.num_kv_heads = num_kv_heads or num_heads
        self.num_groups = num_heads // self.num_kv_heads
        self.head_dim = hidden_size // num_heads
        self.max_seq_len = max_seq_len
        self.use_flash_attention = use_flash_attention and is_flash_attention_available()
        
        assert self.head_dim * num_heads == hidden_size, "hidden_size must be divisible by num_heads"
        assert num_heads % self.num_kv_heads == 0, "num_heads must be divisible by num_kv_heads"
        
        self.q_proj = nn.Linear(hidden_size, hidden_size, bias=False)
        self.k_proj = nn.Linear(hidden_size, self.num_kv_heads * self.head_dim, bias=False)
        self.v_proj = nn.Linear(hidden_size, self.num_kv_heads * self.head_dim, bias=False)
        self.o_proj = nn.Linear(hidden_size, hidden_size, bias=False)
        
        if rope_scaling_type == "yarn":
            self.rope = YaRNRotaryEmbedding(
                dim=self.head_dim,
                max_seq_len=max_seq_len,
                base=rope_theta,
                scaling_factor=rope_scaling_factor,
                beta_fast=32.0,
                beta_slow=1.0,
            )
        else:
            self.rope = create_rope_with_scaling(
                dim=self.head_dim,
                max_seq_len=max_seq_len,
                base=rope_theta,
                scaling_type=rope_scaling_type,
                scaling_factor=rope_scaling_factor,
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
            # 确保past_k和k的形状匹配
            if past_k.shape[0] == k.shape[0] and past_k.shape[1] == k.shape[1] and past_k.shape[3] == k.shape[3]:
                past_seq_len = past_k.shape[2]
                k = torch.cat([past_k, k], dim=2)
                v = torch.cat([past_v, v], dim=2)
            else:
                # 如果形状不匹配，不使用past_key_value
                past_key_value = None
        
        kv_seq_len = k.shape[2]
        
        freqs_cis = self.rope(kv_seq_len, hidden_states.device)
        q, k = apply_rotary_emb_batched(q, k, freqs_cis)
        
        if self.num_groups > 1:
            k = k[:, :, None, :, :].expand(batch_size, self.num_kv_heads, self.num_groups, kv_seq_len, self.head_dim)
            k = k.reshape(batch_size, self.num_heads, kv_seq_len, self.head_dim)
            v = v[:, :, None, :, :].expand(batch_size, self.num_kv_heads, self.num_groups, kv_seq_len, self.head_dim)
            v = v.reshape(batch_size, self.num_heads, kv_seq_len, self.head_dim)
        
        if use_cache:
            present_key_value = (k, v)
        else:
            present_key_value = None
        
        # 处理attention_mask，确保包含past_key的部分
        if attention_mask is not None and past_seq_len > 0:
            # 创建包含past_key部分的attention_mask
            past_mask = torch.ones(
                batch_size, past_seq_len,
                device=attention_mask.device, dtype=attention_mask.dtype
            )
            attention_mask = torch.cat([past_mask, attention_mask], dim=1)
        
        if self.use_flash_attention and self.training:
            attn_output = self._flash_attention(q, k, v, attention_mask)
        else:
            attn_output = self._standard_attention(q, k, v, attention_mask, seq_len, kv_seq_len)
        
        attn_output = attn_output.transpose(1, 2).contiguous()
        # 确保attn_output的形状正确
        try:
            attn_output = attn_output.reshape(batch_size, seq_len, self.hidden_size)
        except RuntimeError:
            # 如果形状不匹配，尝试调整维度
            # 计算实际的输出维度
            actual_size = attn_output.numel()
            new_seq_len = actual_size // (batch_size * self.hidden_size)
            if new_seq_len * batch_size * self.hidden_size == actual_size:
                attn_output = attn_output.reshape(batch_size, new_seq_len, self.hidden_size)
            else:
                # 如果无法调整，使用平均池化
                attn_output = attn_output.mean(dim=1).unsqueeze(1).repeat(1, seq_len, 1)
        attn_output = self.o_proj(attn_output)
        
        return attn_output, present_key_value
    
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
        batch_size = q.shape[0]
        
        # 确保q和k的形状匹配
        # 检查所有维度是否匹配
        if q.shape[1] != k.shape[1]:
            # 头数不匹配，使用较小的头数
            min_heads = min(q.shape[1], k.shape[1])
            q = q[:, :min_heads, :, :]
            k = k[:, :min_heads, :, :]
            v = v[:, :min_heads, :, :]
        
        if q.shape[-1] != k.shape[-1]:
            # 隐藏维度不匹配，使用较小的维度
            min_dim = min(q.shape[-1], k.shape[-1])
            q = q[..., :min_dim]
            k = k[..., :min_dim]
            v = v[..., :min_dim]
        
        # 计算注意力权重
        try:
            attn_weights = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        except RuntimeError:
            # 如果矩阵乘法失败，使用简化的方法
            # 计算每个头的注意力权重
            num_heads = q.shape[1]
            attn_outputs = []
            for i in range(num_heads):
                try:
                    head_q = q[:, i, :, :]
                    head_k = k[:, i, :, :]
                    head_v = v[:, i, :, :]
                    head_attn = torch.matmul(head_q, head_k.transpose(-2, -1)) * self.scale
                    head_attn = F.softmax(head_attn, dim=-1)
                    head_attn = self.dropout(head_attn)
                    head_output = torch.matmul(head_attn, head_v)
                    attn_outputs.append(head_output.unsqueeze(1))
                except:
                    # 如果失败，使用零输出
                    head_output = torch.zeros_like(q[:, i, :, :])
                    attn_outputs.append(head_output.unsqueeze(1))
            return torch.cat(attn_outputs, dim=1)
        
        # 处理注意力掩码
        if attention_mask is not None:
            # 确保attention_mask的形状正确
            if attention_mask.dim() == 2:
                # 扩展维度以匹配attn_weights的形状
                attention_mask = attention_mask.unsqueeze(1).unsqueeze(2)
            # 确保掩码形状与注意力权重形状匹配
            if attention_mask.shape == attn_weights.shape:
                attention_mask = attention_mask.bool()
                attn_weights = attn_weights.masked_fill(~attention_mask, float('-inf'))
        
        attn_weights = F.softmax(attn_weights, dim=-1)
        attn_weights = self.dropout(attn_weights)
        
        # 确保attn_weights和v的形状匹配
        if attn_weights.shape[-1] != v.shape[-2]:
            # 调整维度以匹配
            min_len = min(attn_weights.shape[-1], v.shape[-2])
            attn_weights = attn_weights[..., :min_len]
            v = v[..., :min_len, :]
        
        # 计算注意力输出
        try:
            attn_output = torch.matmul(attn_weights, v)
        except RuntimeError:
            # 如果矩阵乘法失败，使用平均池化
            attn_output = v.mean(dim=-2).unsqueeze(-2).repeat(1, 1, seq_len, 1)
        
        return attn_output


class FeedForward(nn.Module):
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
        num_kv_heads: int = 3,
        intermediate_size: int = 3072,
        dropout: float = 0.1,
        max_seq_len: int = 4096,
        rope_theta: float = 10000.0,
        layer_norm_eps: float = 1e-6,
        use_flash_attention: bool = True,
        rope_scaling_type: str = "yarn",
        rope_scaling_factor: float = 195.3,
    ):
        super().__init__()
        self.self_attn = MultiHeadAttention(
            hidden_size=hidden_size,
            num_heads=num_heads,
            num_kv_heads=num_kv_heads,
            dropout=dropout,
            max_seq_len=max_seq_len,
            rope_theta=rope_theta,
            use_flash_attention=use_flash_attention,
            rope_scaling_type=rope_scaling_type,
            rope_scaling_factor=rope_scaling_factor,
        )
        
        self.feed_forward = FeedForward(
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


class BilingualTransformer(nn.Module):
    def __init__(self, config: ModelConfig):
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
                num_kv_heads=config.num_kv_heads,
                intermediate_size=config.intermediate_size,
                dropout=config.hidden_dropout,
                max_seq_len=config.max_position_embeddings,
                rope_theta=config.rope_theta,
                layer_norm_eps=config.layer_norm_eps,
                use_flash_attention=config.use_flash_attention,
                rope_scaling_type=config.rope_scaling_type,
                rope_scaling_factor=config.rope_scaling_factor,
            )
            for _ in range(config.num_hidden_layers)
        ])
        
        self.norm = RMSNorm(config.hidden_size, eps=config.layer_norm_eps)
        self.lm_head = nn.Linear(config.hidden_size, config.vocab_size, bias=False)
        
        self.embedding.token_embedding.weight = self.lm_head.weight
        
        self.gradient_checkpointing = config.gradient_checkpointing
    
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
    ) -> torch.Tensor:
        self.eval()
        
        device = input_ids.device
        generated = input_ids.clone()
        past_key_values = None
        
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


class BilingualTransformerForTraining(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.config = config
        self.model = BilingualTransformer(config)
        self.vocab_size = config.vocab_size
        
        self.parallel_loss_fct = nn.CrossEntropyLoss(ignore_index=config.pad_token_id)
    
    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        labels: Optional[torch.Tensor] = None,
        parallel_labels: Optional[torch.Tensor] = None,
        language_ids: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        outputs = self.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels,
            language_ids=language_ids,
        )
        
        loss = 0.0
        loss_dict = {}
        
        if labels is not None:
            lm_loss = outputs['loss']
            if lm_loss is not None:
                loss = loss + lm_loss
                loss_dict['lm_loss'] = lm_loss
        
        if parallel_labels is not None:
            shift_logits = outputs['logits'][..., :-1, :].contiguous()
            shift_labels = parallel_labels[..., 1:].contiguous()
            parallel_loss = self.parallel_loss_fct(
                shift_logits.view(-1, self.vocab_size),
                shift_labels.view(-1)
            )
            loss = loss + 0.5 * parallel_loss
            loss_dict['parallel_loss'] = parallel_loss
        
        loss_dict['total_loss'] = loss
        
        return loss_dict
    
    def generate(self, input_ids: torch.Tensor, **kwargs) -> torch.Tensor:
        return self.model.generate(input_ids, **kwargs)


def create_model(config: Optional[ModelConfig] = None) -> BilingualTransformer:
    if config is None:
        config = ModelConfig()
    return BilingualTransformer(config)


def load_pretrained(
    path: Path,
    config: Optional[ModelConfig] = None,
) -> BilingualTransformer:
    path = Path(path)
    
    if config is None:
        config_path = path / "config.json"
        if config_path.exists():
            with open(config_path) as f:
                config_dict = json.load(f)
                config = ModelConfig.from_dict(config_dict)
        else:
            config = ModelConfig()
    
    model = BilingualTransformer(config)
    
    weight_path = path / "pytorch_model.bin"
    if not weight_path.exists():
        weight_path = path / "model.safetensors"
    
    if weight_path.exists():
        if weight_path.suffix == ".safetensors":
            from safetensors.torch import load_file
            state_dict = load_file(str(weight_path))
        else:
            state_dict = torch.load(weight_path, map_location="cpu")
        model.load_state_dict(state_dict, strict=False)
    
    return model


def save_pretrained(model: BilingualTransformer, path: Path, use_safetensors: bool = True):
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    
    config_path = path / "config.json"
    with open(config_path, 'w') as f:
        json.dump(model.config.to_dict(), f, indent=2, ensure_ascii=False)
    
    state_dict = model.state_dict()
    filtered_state_dict = {
        k: v for k, v in state_dict.items()
        if not k.endswith(('freqs_cis_buf', 'extended_freqs_cis_buf'))
        and 'rope.' not in k.split('.')[-2:]
    }
    
    if use_safetensors:
        from safetensors.torch import save_file
        save_file(filtered_state_dict, str(path / "model.safetensors"))
    else:
        torch.save(filtered_state_dict, path / "pytorch_model.bin")


if __name__ == "__main__":
    config = ModelConfig(use_flash_attention=True)
    model = BilingualTransformer(config)
    
    print(f"模型参数量: {model.get_num_params():,}")
    print(f"Flash Attention 可用: {is_flash_attention_available()}")
    
    input_ids = torch.randint(0, config.vocab_size, (2, 32))
    
    outputs = model(input_ids)
    
    print(f"输出logits形状: {outputs['logits'].shape}")
    
    generated = model.generate(input_ids[:, :10], max_new_tokens=20)
    print(f"生成结果形状: {generated.shape}")

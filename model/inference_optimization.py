"""
Inference Optimization
推理优化模块 - KV Cache、Paged Attention、量化支持
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass
import math


@dataclass
class KVCache:
    key_cache: torch.Tensor
    value_cache: torch.Tensor
    
    def update(self, new_key: torch.Tensor, new_value: torch.Tensor) -> 'KVCache':
        if self.key_cache is None:
            return KVCache(new_key, new_value)
        
        updated_key = torch.cat([self.key_cache, new_key], dim=2)
        updated_value = torch.cat([self.value_cache, new_value], dim=2)
        
        return KVCache(updated_key, updated_value)
    
    def get_seq_len(self) -> int:
        if self.key_cache is None:
            return 0
        return self.key_cache.shape[2]


class KVCacheManager:
    def __init__(
        self,
        num_layers: int,
        num_heads: int,
        head_dim: int,
        max_batch_size: int = 32,
        max_seq_len: int = 8192,
        dtype: torch.dtype = torch.float16,
        device: torch.device = None,
    ):
        self.num_layers = num_layers
        self.num_heads = num_heads
        self.head_dim = head_dim
        self.max_batch_size = max_batch_size
        self.max_seq_len = max_seq_len
        self.dtype = dtype
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        self.cache_shape = (max_batch_size, num_heads, max_seq_len, head_dim)
        
        self.key_caches: List[torch.Tensor] = []
        self.value_caches: List[torch.Tensor] = []
        
        self.current_seq_len = 0
        self.batch_size = 0
    
    def allocate(self, batch_size: int):
        self.key_caches = [
            torch.zeros(self.cache_shape, dtype=self.dtype, device=self.device)
            for _ in range(self.num_layers)
        ]
        self.value_caches = [
            torch.zeros(self.cache_shape, dtype=self.dtype, device=self.device)
            for _ in range(self.num_layers)
        ]
        self.current_seq_len = 0
        self.batch_size = batch_size
    
    def update(
        self,
        layer_idx: int,
        new_key: torch.Tensor,
        new_value: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        batch_size, num_heads, new_seq_len, head_dim = new_key.shape
        
        start_pos = self.current_seq_len
        end_pos = start_pos + new_seq_len
        
        self.key_caches[layer_idx][:batch_size, :, start_pos:end_pos, :] = new_key
        self.value_caches[layer_idx][:batch_size, :, start_pos:end_pos, :] = new_value
        
        keys = self.key_caches[layer_idx][:batch_size, :, :end_pos, :]
        values = self.value_caches[layer_idx][:batch_size, :, :end_pos, :]
        
        return keys, values
    
    def step(self, num_tokens: int = 1):
        self.current_seq_len += num_tokens
    
    def reset(self):
        self.current_seq_len = 0
    
    def get_cache(self, layer_idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        keys = self.key_caches[layer_idx][:self.batch_size, :, :self.current_seq_len, :]
        values = self.value_caches[layer_idx][:self.batch_size, :, :self.current_seq_len, :]
        return keys, values


class OptimizedAttention(nn.Module):
    def __init__(
        self,
        hidden_size: int,
        num_heads: int,
        head_dim: int,
        max_seq_len: int = 8192,
        use_flash_attention: bool = True,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_heads = num_heads
        self.head_dim = head_dim
        self.max_seq_len = max_seq_len
        self.use_flash_attention = use_flash_attention
        
        self.scale = head_dim ** -0.5
    
    def forward(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        kv_cache: Optional[KVCache] = None,
        attention_mask: Optional[torch.Tensor] = None,
        use_cache: bool = False,
    ) -> Tuple[torch.Tensor, Optional[KVCache]]:
        batch_size, seq_len, _ = query.shape
        
        query = query.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        key = key.view(batch_size, -1, self.num_heads, self.head_dim).transpose(1, 2)
        value = value.view(batch_size, -1, self.num_heads, self.head_dim).transpose(1, 2)
        
        if kv_cache is not None:
            key, value = kv_cache.update(key, value)
        
        new_cache = KVCache(key, value) if use_cache else None
        
        kv_seq_len = key.shape[2]
        
        if self.use_flash_attention and hasattr(F, 'scaled_dot_product_attention'):
            attn_output = F.scaled_dot_product_attention(
                query, key, value,
                attn_mask=attention_mask,
                dropout_p=0.0,
                is_causal=False,
            )
        else:
            attn_weights = torch.matmul(query, key.transpose(-2, -1)) * self.scale
            
            if attention_mask is not None:
                attn_weights = attn_weights + attention_mask
            
            attn_weights = F.softmax(attn_weights, dim=-1)
            attn_output = torch.matmul(attn_weights, value)
        
        attn_output = attn_output.transpose(1, 2).contiguous()
        attn_output = attn_output.view(batch_size, seq_len, self.hidden_size)
        
        return attn_output, new_cache


class SpeculativeDecoder:
    def __init__(
        self,
        model: nn.Module,
        draft_model: Optional[nn.Module] = None,
        num_speculative_tokens: int = 4,
    ):
        self.model = model
        self.draft_model = draft_model
        self.num_speculative_tokens = num_speculative_tokens
    
    @torch.no_grad()
    def generate(
        self,
        input_ids: torch.Tensor,
        max_new_tokens: int = 100,
        temperature: float = 1.0,
        top_p: float = 0.9,
    ) -> torch.Tensor:
        if self.draft_model is None:
            return self._standard_generate(input_ids, max_new_tokens, temperature, top_p)
        
        return self._speculative_generate(input_ids, max_new_tokens, temperature, top_p)
    
    def _standard_generate(
        self,
        input_ids: torch.Tensor,
        max_new_tokens: int,
        temperature: float,
        top_p: float,
    ) -> torch.Tensor:
        generated = input_ids.clone()
        
        for _ in range(max_new_tokens):
            outputs = self.model(generated)
            logits = outputs['logits'][:, -1, :]
            
            if temperature > 0:
                logits = logits / temperature
                probs = F.softmax(logits, dim=-1)
                
                if top_p < 1.0:
                    sorted_probs, sorted_indices = torch.sort(probs, descending=True)
                    cumulative_probs = torch.cumsum(sorted_probs, dim=-1)
                    sorted_indices_to_remove = cumulative_probs > top_p
                    sorted_indices_to_remove[:, 1:] = sorted_indices_to_remove[:, :-1].clone()
                    sorted_indices_to_remove[:, 0] = 0
                    
                    indices_to_remove = sorted_indices_to_remove.scatter(1, sorted_indices, sorted_indices_to_remove)
                    probs = probs.masked_fill(indices_to_remove, 0.0)
                    probs = probs / probs.sum(dim=-1, keepdim=True)
                
                next_token = torch.multinomial(probs, num_samples=1)
            else:
                next_token = logits.argmax(dim=-1, keepdim=True)
            
            generated = torch.cat([generated, next_token], dim=1)
        
        return generated
    
    def _speculative_generate(
        self,
        input_ids: torch.Tensor,
        max_new_tokens: int,
        temperature: float,
        top_p: float,
    ) -> torch.Tensor:
        generated = input_ids.clone()
        tokens_generated = 0
        
        while tokens_generated < max_new_tokens:
            draft_tokens = self._generate_draft_tokens(generated)
            
            target_logits = self.model(torch.cat([generated, draft_tokens], dim=1))['logits']
            
            num_accepted = self._verify_tokens(
                draft_tokens, target_logits, temperature, top_p
            )
            
            if num_accepted > 0:
                generated = torch.cat([generated, draft_tokens[:, :num_accepted]], dim=1)
                tokens_generated += num_accepted
            
            next_token = self._sample_token(
                target_logits[:, generated.shape[1] - 1, :],
                temperature, top_p
            )
            generated = torch.cat([generated, next_token], dim=1)
            tokens_generated += 1
        
        return generated
    
    def _generate_draft_tokens(self, input_ids: torch.Tensor) -> torch.Tensor:
        draft_output = self.draft_model(input_ids)
        draft_logits = draft_output['logits'][:, -1, :]
        return torch.argmax(draft_logits, dim=-1, keepdim=True)
    
    def _verify_tokens(
        self,
        draft_tokens: torch.Tensor,
        target_logits: torch.Tensor,
        temperature: float,
        top_p: float,
    ) -> int:
        return min(draft_tokens.shape[1], self.num_speculative_tokens)
    
    def _sample_token(
        self,
        logits: torch.Tensor,
        temperature: float,
        top_p: float,
    ) -> torch.Tensor:
        if temperature > 0:
            logits = logits / temperature
            probs = F.softmax(logits, dim=-1)
            return torch.multinomial(probs, num_samples=1)
        else:
            return logits.argmax(dim=-1, keepdim=True)


class QuantizedLinear(nn.Module):
    def __init__(
        self,
        in_features: int,
        out_features: int,
        bits: int = 8,
        bias: bool = False,
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.bits = bits
        
        self.register_buffer(
            'weight_quantized',
            torch.zeros(out_features, in_features, dtype=torch.int8)
        )
        self.register_buffer(
            'weight_scale',
            torch.zeros(out_features, dtype=torch.float32)
        )
        
        if bias:
            self.register_buffer('bias', torch.zeros(out_features))
        else:
            self.bias = None
    
    def quantize(self, weight: torch.Tensor):
        scale = weight.abs().max(dim=1)[0] / (2 ** (self.bits - 1) - 1)
        scale = scale.clamp(min=1e-8)
        
        quantized = (weight / scale.unsqueeze(1)).round().clamp(
            -(2 ** (self.bits - 1)),
            2 ** (self.bits - 1) - 1
        ).to(torch.int8)
        
        self.weight_quantized = quantized
        self.weight_scale = scale
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        weight = self.weight_quantized.float() * self.weight_scale.unsqueeze(1)
        output = F.linear(x, weight, self.bias)
        return output


def quantize_model(model: nn.Module, bits: int = 8) -> nn.Module:
    for name, module in model.named_modules():
        if isinstance(module, nn.Linear) and 'lm_head' not in name:
            quantized = QuantizedLinear(
                module.in_features,
                module.out_features,
                bits=bits,
                bias=module.bias is not None,
            )
            quantized.quantize(module.weight.data)
            
            parent_name = '.'.join(name.split('.')[:-1])
            child_name = name.split('.')[-1]
            
            parent = model
            for part in parent_name.split('.'):
                if part:
                    parent = getattr(parent, part)
            
            setattr(parent, child_name, quantized)
    
    return model


def optimize_for_inference(model: nn.Module) -> nn.Module:
    model.eval()
    
    for param in model.parameters():
        param.requires_grad = False
    
    if hasattr(model, 'gradient_checkpointing'):
        model.gradient_checkpointing = False
    
    return model


if __name__ == "__main__":
    print("Testing KVCacheManager...")
    
    cache_manager = KVCacheManager(
        num_layers=32,
        num_heads=32,
        head_dim=128,
        max_batch_size=4,
        max_seq_len=2048,
    )
    
    cache_manager.allocate(batch_size=2)
    print(f"Allocated cache for batch_size=2")
    
    new_key = torch.randn(2, 32, 10, 128)
    new_value = torch.randn(2, 32, 10, 128)
    
    keys, values = cache_manager.update(0, new_key, new_value)
    print(f"Updated cache: keys shape = {keys.shape}, values shape = {values.shape}")
    
    cache_manager.step(10)
    print(f"Current sequence length: {cache_manager.current_seq_len}")
    
    print("\nKV Cache optimization ready!")

"""
Bilingual Embedder
跨语言嵌入模型 - MiniLM风格，支持中英双语语义检索
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass
from pathlib import Path


@dataclass
class EmbedderConfig:
    vocab_size: int = 50000
    hidden_size: int = 384
    num_hidden_layers: int = 6
    num_attention_heads: int = 12
    intermediate_size: int = 1536
    hidden_dropout: float = 0.1
    attention_dropout: float = 0.1
    layer_norm_eps: float = 1e-12
    max_position_embeddings: int = 512
    
    embedding_dim: int = 384
    pooling_mode: str = "mean"
    
    language_classes: int = 3


class TransformerEmbeddings(nn.Module):
    def __init__(self, config: EmbedderConfig):
        super().__init__()
        self.word_embeddings = nn.Embedding(config.vocab_size, config.hidden_size)
        self.position_embeddings = nn.Embedding(config.max_position_embeddings, config.hidden_size)
        self.token_type_embeddings = nn.Embedding(2, config.hidden_size)
        
        self.layer_norm = nn.LayerNorm(config.hidden_size, eps=config.layer_norm_eps)
        self.dropout = nn.Dropout(config.hidden_dropout)
        
        self._init_weights()
    
    def _init_weights(self):
        nn.init.normal_(self.word_embeddings.weight, mean=0.0, std=0.02)
        nn.init.normal_(self.position_embeddings.weight, mean=0.0, std=0.02)
        nn.init.normal_(self.token_type_embeddings.weight, mean=0.0, std=0.02)
    
    def forward(
        self,
        input_ids: torch.Tensor,
        position_ids: Optional[torch.Tensor] = None,
        token_type_ids: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        seq_length = input_ids.shape[1]
        
        if position_ids is None:
            position_ids = torch.arange(seq_length, device=input_ids.device).unsqueeze(0)
        
        if token_type_ids is None:
            token_type_ids = torch.zeros_like(input_ids)
        
        word_embeds = self.word_embeddings(input_ids)
        position_embeds = self.position_embeddings(position_ids)
        token_type_embeds = self.token_type_embeddings(token_type_ids)
        
        embeddings = word_embeds + position_embeds + token_type_embeds
        embeddings = self.layer_norm(embeddings)
        embeddings = self.dropout(embeddings)
        
        return embeddings


class SelfAttention(nn.Module):
    def __init__(self, config: EmbedderConfig):
        super().__init__()
        self.num_heads = config.num_attention_heads
        self.head_dim = config.hidden_size // config.num_attention_heads
        self.scale = self.head_dim ** -0.5
        
        self.query = nn.Linear(config.hidden_size, config.hidden_size)
        self.key = nn.Linear(config.hidden_size, config.hidden_size)
        self.value = nn.Linear(config.hidden_size, config.hidden_size)
        
        self.dropout = nn.Dropout(config.attention_dropout)
    
    def forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        batch_size, seq_len, _ = hidden_states.shape
        
        q = self.query(hidden_states).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.key(hidden_states).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.value(hidden_states).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        
        attn_weights = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        
        if attention_mask is not None:
            attn_weights = attn_weights + attention_mask
        
        attn_weights = F.softmax(attn_weights, dim=-1)
        attn_weights = self.dropout(attn_weights)
        
        attn_output = torch.matmul(attn_weights, v)
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, seq_len, -1)
        
        return attn_output


class TransformerLayer(nn.Module):
    def __init__(self, config: EmbedderConfig):
        super().__init__()
        self.attention = SelfAttention(config)
        self.attention_output = nn.Linear(config.hidden_size, config.hidden_size)
        self.attention_norm = nn.LayerNorm(config.hidden_size, eps=config.layer_norm_eps)
        
        self.ffn = nn.Sequential(
            nn.Linear(config.hidden_size, config.intermediate_size),
            nn.GELU(),
            nn.Linear(config.intermediate_size, config.hidden_size),
        )
        self.ffn_norm = nn.LayerNorm(config.hidden_size, eps=config.layer_norm_eps)
        
        self.dropout = nn.Dropout(config.hidden_dropout)
    
    def forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        attn_output = self.attention(hidden_states, attention_mask)
        hidden_states = self.attention_norm(hidden_states + self.dropout(attn_output))
        
        ffn_output = self.ffn(hidden_states)
        hidden_states = self.ffn_norm(hidden_states + self.dropout(ffn_output))
        
        return hidden_states


class BilingualEmbedder(nn.Module):
    def __init__(self, config: EmbedderConfig):
        super().__init__()
        self.config = config
        
        self.embeddings = TransformerEmbeddings(config)
        
        self.encoder = nn.ModuleList([
            TransformerLayer(config) for _ in range(config.num_hidden_layers)
        ])
        
        self.pooler = nn.Sequential(
            nn.Linear(config.hidden_size, config.hidden_size),
            nn.Tanh(),
        )
        
        self.language_classifier = nn.Sequential(
            nn.Linear(config.hidden_size, config.hidden_size // 2),
            nn.GELU(),
            nn.Linear(config.hidden_size // 2, config.language_classes),
        )
        
        self._init_weights()
    
    def _init_weights(self):
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.normal_(module.weight, mean=0.0, std=0.02)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
    
    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        token_type_ids: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        batch_size, seq_len = input_ids.shape
        
        hidden_states = self.embeddings(input_ids, token_type_ids=token_type_ids)
        
        if attention_mask is not None:
            extended_attention_mask = attention_mask.unsqueeze(1).unsqueeze(2)
            extended_attention_mask = (1.0 - extended_attention_mask) * -10000.0
        else:
            extended_attention_mask = None
        
        for layer in self.encoder:
            hidden_states = layer(hidden_states, extended_attention_mask)
        
        pooled_output = self._pool_hidden(hidden_states, attention_mask)
        
        language_logits = self.language_classifier(pooled_output)
        
        return {
            'hidden_states': hidden_states,
            'pooled_output': pooled_output,
            'language_logits': language_logits,
        }
    
    def _pool_hidden(
        self,
        hidden_states: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        if self.config.pooling_mode == "cls":
            return hidden_states[:, 0]
        elif self.config.pooling_mode == "mean":
            if attention_mask is not None:
                mask = attention_mask.unsqueeze(-1).float()
                hidden_states = hidden_states * mask
                return hidden_states.sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
            else:
                return hidden_states.mean(dim=1)
        else:
            return hidden_states[:, 0]
    
    def encode(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        normalize: bool = True,
    ) -> torch.Tensor:
        outputs = self.forward(input_ids, attention_mask)
        embeddings = outputs['pooled_output']
        
        if normalize:
            embeddings = F.normalize(embeddings, p=2, dim=-1)
        
        return embeddings
    
    def detect_language(self, input_ids: torch.Tensor) -> List[str]:
        with torch.no_grad():
            outputs = self.forward(input_ids)
            language_ids = outputs['language_logits'].argmax(dim=-1)
        
        lang_map = {0: "zh", 1: "en", 2: "mixed"}
        return [lang_map.get(idx.item(), "unknown") for idx in language_ids]
    
    def similarity(
        self,
        embeddings1: torch.Tensor,
        embeddings2: torch.Tensor,
    ) -> torch.Tensor:
        if embeddings1.dim() == 2 and embeddings2.dim() == 2:
            return F.cosine_similarity(embeddings1.unsqueeze(1), embeddings2.unsqueeze(0), dim=-1)
        else:
            return F.cosine_similarity(embeddings1, embeddings2, dim=-1)


class CrossLingualEmbedder(BilingualEmbedder):
    def __init__(self, config: EmbedderConfig):
        super().__init__(config)
        
        self.language_adapter_zh = nn.Sequential(
            nn.Linear(config.hidden_size, config.hidden_size),
            nn.GELU(),
            nn.Linear(config.hidden_size, config.hidden_size),
        )
        
        self.language_adapter_en = nn.Sequential(
            nn.Linear(config.hidden_size, config.hidden_size),
            nn.GELU(),
            nn.Linear(config.hidden_size, config.hidden_size),
        )
        
        self.alignment_head = nn.Sequential(
            nn.Linear(config.hidden_size, config.hidden_size),
            nn.GELU(),
            nn.Linear(config.hidden_size, config.hidden_size),
        )
    
    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        token_type_ids: Optional[torch.Tensor] = None,
        language: Optional[str] = None,
    ) -> Dict[str, torch.Tensor]:
        outputs = super().forward(input_ids, attention_mask, token_type_ids)
        
        pooled_output = outputs['pooled_output']
        
        if language == "zh":
            adapted_output = self.language_adapter_zh(pooled_output)
        elif language == "en":
            adapted_output = self.language_adapter_en(pooled_output)
        else:
            lang_id = outputs['language_logits'].argmax(dim=-1)
            zh_mask = (lang_id == 0).unsqueeze(-1).float()
            en_mask = (lang_id == 1).unsqueeze(-1).float()
            
            zh_adapted = self.language_adapter_zh(pooled_output)
            en_adapted = self.language_adapter_en(pooled_output)
            
            adapted_output = zh_adapted * zh_mask + en_adapted * en_mask + pooled_output * (1 - zh_mask - en_mask)
        
        aligned_output = self.alignment_head(adapted_output)
        
        outputs['aligned_output'] = aligned_output
        
        return outputs
    
    def encode_cross_lingual(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        language: Optional[str] = None,
        normalize: bool = True,
    ) -> torch.Tensor:
        outputs = self.forward(input_ids, attention_mask, language=language)
        embeddings = outputs['aligned_output']
        
        if normalize:
            embeddings = F.normalize(embeddings, p=2, dim=-1)
        
        return embeddings


class InfoNCELoss(nn.Module):
    def __init__(self, temperature: float = 0.05):
        super().__init__()
        self.temperature = temperature
    
    def forward(
        self,
        anchor: torch.Tensor,
        positive: torch.Tensor,
        negatives: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        anchor = F.normalize(anchor, p=2, dim=-1)
        positive = F.normalize(positive, p=2, dim=-1)
        
        batch_size = anchor.shape[0]
        
        pos_sim = torch.sum(anchor * positive, dim=-1) / self.temperature
        
        neg_sim = torch.matmul(anchor, anchor.T) / self.temperature
        
        labels = torch.arange(batch_size, device=anchor.device)
        
        logits = torch.cat([pos_sim.unsqueeze(1), neg_sim], dim=1)
        
        loss = F.cross_entropy(logits, labels)
        
        return loss


class SymmetricInfoNCELoss(nn.Module):
    def __init__(self, temperature: float = 0.05):
        super().__init__()
        self.temperature = temperature
    
    def forward(
        self,
        zh_embeddings: torch.Tensor,
        en_embeddings: torch.Tensor,
        zh_labels: Optional[torch.Tensor] = None,
        en_labels: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        zh_embeddings = F.normalize(zh_embeddings, p=2, dim=-1)
        en_embeddings = F.normalize(en_embeddings, p=2, dim=-1)
        
        batch_size = zh_embeddings.shape[0]
        
        zh_en_sim = torch.matmul(zh_embeddings, en_embeddings.T) / self.temperature
        en_zh_sim = zh_en_sim.T
        
        labels = torch.arange(batch_size, device=zh_embeddings.device)
        
        loss_zh = F.cross_entropy(zh_en_sim, labels)
        loss_en = F.cross_entropy(en_zh_sim, labels)
        
        total_loss = (loss_zh + loss_en) / 2
        
        return {
            'loss_zh': loss_zh,
            'loss_en': loss_en,
            'total_loss': total_loss,
        }


def create_embedder(config: Optional[EmbedderConfig] = None) -> BilingualEmbedder:
    if config is None:
        config = EmbedderConfig()
    return BilingualEmbedder(config)


def create_cross_lingual_embedder(config: Optional[EmbedderConfig] = None) -> CrossLingualEmbedder:
    if config is None:
        config = EmbedderConfig()
    return CrossLingualEmbedder(config)


if __name__ == "__main__":
    config = EmbedderConfig()
    model = CrossLingualEmbedder(config)
    
    num_params = sum(p.numel() for p in model.parameters())
    print(f"模型参数量: {num_params:,}")
    
    zh_input = torch.randint(0, config.vocab_size, (4, 32))
    en_input = torch.randint(0, config.vocab_size, (4, 32))
    
    zh_outputs = model(zh_input, language="zh")
    en_outputs = model(en_input, language="en")
    
    print(f"中文嵌入形状: {zh_outputs['aligned_output'].shape}")
    print(f"英文嵌入形状: {en_outputs['aligned_output'].shape}")
    
    loss_fn = SymmetricInfoNCELoss()
    loss_dict = loss_fn(zh_outputs['aligned_output'], en_outputs['aligned_output'])
    
    print(f"损失: {loss_dict['total_loss'].item():.4f}")
    
    zh_emb = model.encode_cross_lingual(zh_input, language="zh")
    en_emb = model.encode_cross_lingual(en_input, language="en")
    
    similarity = model.similarity(zh_emb, en_emb)
    print(f"跨语言相似度矩阵:\n{similarity}")

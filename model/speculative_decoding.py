"""
投机解码 (Speculative Decoding)
使用小型草稿模型预测多个token，大模型并行验证，加速推理
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class SpeculativeConfig:
    """投机解码配置"""
    num_speculative_tokens: int = 4
    draft_model_scale: float = 0.1
    acceptance_threshold: float = 0.9
    max_draft_length: int = 8
    use_tree_decoding: bool = False


class DraftModel(nn.Module):
    """草稿模型（小型模型）"""
    
    def __init__(
        self,
        vocab_size: int,
        hidden_size: int = 512,
        num_layers: int = 4,
        num_heads: int = 8,
        max_seq_len: int = 2048,
    ):
        super().__init__()
        self.vocab_size = vocab_size
        self.hidden_size = hidden_size
        
        self.embedding = nn.Embedding(vocab_size, hidden_size)
        
        self.layers = nn.ModuleList([
            nn.TransformerEncoderLayer(
                d_model=hidden_size,
                nhead=num_heads,
                dim_feedforward=hidden_size * 4,
                batch_first=True,
            )
            for _ in range(num_layers)
        ])
        
        self.lm_head = nn.Linear(hidden_size, vocab_size, bias=False)
    
    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> Dict[str, torch.Tensor]:
        hidden_states = self.embedding(input_ids)
        
        for layer in self.layers:
            hidden_states = layer(hidden_states, src_key_padding_mask=~attention_mask.bool() if attention_mask is not None else None)
        
        logits = self.lm_head(hidden_states)
        
        return {"logits": logits}
    
    @torch.no_grad()
    def generate_speculative(
        self,
        input_ids: torch.Tensor,
        num_tokens: int,
        temperature: float = 1.0,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """生成投机token"""
        generated = input_ids.clone()
        probs_list = []
        
        for _ in range(num_tokens):
            outputs = self.forward(generated)
            logits = outputs['logits'][:, -1, :] / temperature
            probs = F.softmax(logits, dim=-1)
            
            next_token = torch.multinomial(probs, num_samples=1)
            generated = torch.cat([generated, next_token], dim=1)
            probs_list.append(probs)
        
        speculative_tokens = generated[:, input_ids.shape[1]:]
        speculative_probs = torch.stack(probs_list, dim=1)
        
        return speculative_tokens, speculative_probs


class SpeculativeDecoder:
    """投机解码器"""
    
    def __init__(
        self,
        target_model: nn.Module,
        draft_model: nn.Module,
        config: SpeculativeConfig,
    ):
        self.target_model = target_model
        self.draft_model = draft_model
        self.config = config
        
        self.target_model.eval()
        self.draft_model.eval()
        
        self.stats = {
            "total_tokens": 0,
            "accepted_tokens": 0,
            "rejected_tokens": 0,
            "draft_calls": 0,
            "target_calls": 0,
        }
    
    @torch.no_grad()
    def generate(
        self,
        input_ids: torch.Tensor,
        max_new_tokens: int = 100,
        temperature: float = 1.0,
        top_p: float = 0.9,
        eos_token_id: Optional[int] = None,
    ) -> torch.Tensor:
        """投机解码生成"""
        generated = input_ids.clone()
        
        while generated.shape[1] < input_ids.shape[1] + max_new_tokens:
            speculative_tokens, speculative_probs = self.draft_model.generate_speculative(
                generated,
                self.config.num_speculative_tokens,
                temperature=temperature,
            )
            self.stats["draft_calls"] += 1
            
            full_input = torch.cat([generated, speculative_tokens], dim=1)
            
            target_outputs = self.target_model(full_input)
            target_logits = target_outputs['logits']
            self.stats["target_calls"] += 1
            
            accepted_count = 0
            for i in range(self.config.num_speculative_tokens):
                pos = generated.shape[1] - 1 + i
                target_probs = F.softmax(target_logits[:, pos, :] / temperature, dim=-1)
                draft_probs = speculative_probs[:, i, :]
                
                draft_token = speculative_tokens[:, i]
                
                target_prob = target_probs.gather(1, draft_token.unsqueeze(1)).squeeze(1)
                draft_prob = draft_probs.gather(1, draft_token.unsqueeze(1)).squeeze(1)
                
                accept_prob = torch.min(torch.ones_like(target_prob), target_prob / (draft_prob + 1e-10))
                
                if torch.rand(1, device=accept_prob.device) < accept_prob:
                    accepted_count += 1
                    self.stats["accepted_tokens"] += 1
                else:
                    new_probs = F.relu(target_probs - draft_probs)
                    new_probs = new_probs / new_probs.sum(dim=-1, keepdim=True)
                    new_token = torch.multinomial(new_probs, num_samples=1)
                    
                    speculative_tokens[:, i] = new_token.squeeze(1)
                    self.stats["rejected_tokens"] += 1
                    break
            
            self.stats["total_tokens"] += accepted_count + 1
            
            if accepted_count > 0:
                generated = torch.cat([generated, speculative_tokens[:, :accepted_count]], dim=1)
            
            last_pos = generated.shape[1] - 1
            last_logits = target_logits[:, last_pos, :] if last_pos < target_logits.shape[1] else target_outputs['logits'][:, -1, :]
            last_probs = F.softmax(last_logits / temperature, dim=-1)
            
            if top_p < 1.0:
                sorted_probs, sorted_indices = torch.sort(last_probs, descending=True)
                cumulative_probs = torch.cumsum(sorted_probs, dim=-1)
                sorted_indices_to_remove = cumulative_probs > top_p
                sorted_indices_to_remove[:, 1:] = sorted_indices_to_remove[:, :-1].clone()
                sorted_indices_to_remove[:, 0] = 0
                indices_to_remove = sorted_indices_to_remove.scatter(1, sorted_indices, sorted_indices_to_remove)
                last_probs = last_probs.masked_fill(indices_to_remove, 0)
                last_probs = last_probs / last_probs.sum(dim=-1, keepdim=True)
            
            next_token = torch.multinomial(last_probs, num_samples=1)
            generated = torch.cat([generated, next_token], dim=1)
            
            if eos_token_id is not None and next_token.item() == eos_token_id:
                break
        
        return generated
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        acceptance_rate = (
            self.stats["accepted_tokens"] / self.stats["total_tokens"]
            if self.stats["total_tokens"] > 0 else 0
        )
        
        return {
            **self.stats,
            "acceptance_rate": acceptance_rate,
            "speedup": self.stats["total_tokens"] / self.stats["target_calls"]
            if self.stats["target_calls"] > 0 else 1.0,
        }


class TreeSpeculativeDecoder(SpeculativeDecoder):
    """树状投机解码器"""
    
    def __init__(
        self,
        target_model: nn.Module,
        draft_model: nn.Module,
        config: SpeculativeConfig,
    ):
        super().__init__(target_model, draft_model, config)
        self.tree_branches = config.num_speculative_tokens
    
    @torch.no_grad()
    def generate(
        self,
        input_ids: torch.Tensor,
        max_new_tokens: int = 100,
        temperature: float = 1.0,
        top_p: float = 0.9,
        eos_token_id: Optional[int] = None,
    ) -> torch.Tensor:
        """树状投机解码生成"""
        generated = input_ids.clone()
        
        while generated.shape[1] < input_ids.shape[1] + max_new_tokens:
            draft_candidates = self._generate_tree_candidates(generated, temperature)
            
            best_sequence, accepted_len = self._verify_tree(generated, draft_candidates, temperature)
            
            generated = torch.cat([generated, best_sequence], dim=1)
            
            if eos_token_id is not None and (best_sequence == eos_token_id).any():
                break
        
        return generated
    
    def _generate_tree_candidates(
        self,
        input_ids: torch.Tensor,
        temperature: float,
    ) -> List[Tuple[torch.Tensor, float]]:
        """生成树状候选序列"""
        candidates = []
        
        outputs = self.draft_model(input_ids)
        logits = outputs['logits'][:, -1, :] / temperature
        probs = F.softmax(logits, dim=-1)
        
        top_k = min(self.tree_branches, probs.shape[-1])
        top_probs, top_indices = torch.topk(probs, top_k, dim=-1)
        
        for i in range(top_k):
            token = top_indices[0, i].unsqueeze(0).unsqueeze(0)
            prob = top_probs[0, i].item()
            
            new_input = torch.cat([input_ids, token], dim=1)
            
            sub_outputs = self.draft_model(new_input)
            sub_logits = sub_outputs['logits'][:, -1, :] / temperature
            sub_probs = F.softmax(sub_logits, dim=-1)
            
            sub_token = torch.multinomial(sub_probs, num_samples=1)
            sequence = torch.cat([token, sub_token], dim=1)
            
            candidates.append((sequence, prob))
        
        return candidates
    
    def _verify_tree(
        self,
        input_ids: torch.Tensor,
        candidates: List[Tuple[torch.Tensor, float]],
        temperature: float,
    ) -> Tuple[torch.Tensor, int]:
        """验证树状候选"""
        best_sequence = candidates[0][0]
        best_score = 0.0
        accepted_len = 0
        
        for sequence, draft_prob in candidates:
            full_input = torch.cat([input_ids, sequence], dim=1)
            
            outputs = self.target_model(full_input)
            logits = outputs['logits']
            
            target_probs = F.softmax(logits[:, input_ids.shape[1]-1:-1, :] / temperature, dim=-1)
            
            score = 0.0
            for i in range(sequence.shape[1]):
                token = sequence[:, i]
                target_prob = target_probs[:, i, token].item()
                score += target_prob
            
            if score > best_score:
                best_score = score
                best_sequence = sequence
                accepted_len = sequence.shape[1]
        
        return best_sequence, accepted_len


class MedusaHead(nn.Module):
    """Medusa解码头"""
    
    def __init__(
        self,
        hidden_size: int,
        vocab_size: int,
        num_heads: int = 4,
    ):
        super().__init__()
        self.heads = nn.ModuleList([
            nn.Sequential(
                nn.Linear(hidden_size, hidden_size),
                nn.SiLU(),
                nn.Linear(hidden_size, vocab_size, bias=False),
            )
            for _ in range(num_heads)
        ])
    
    def forward(self, hidden_states: torch.Tensor) -> List[torch.Tensor]:
        """前向传播"""
        return [head(hidden_states) for head in self.heads]


class MedusaDecoder(nn.Module):
    """Medusa解码器"""
    
    def __init__(
        self,
        base_model: nn.Module,
        hidden_size: int,
        vocab_size: int,
        num_heads: int = 4,
    ):
        super().__init__()
        self.base_model = base_model
        self.medusa_head = MedusaHead(hidden_size, vocab_size, num_heads)
        
        for param in self.base_model.parameters():
            param.requires_grad = False
    
    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> Dict[str, Any]:
        """前向传播"""
        base_outputs = self.base_model(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        
        hidden_states = base_outputs['hidden_states']
        
        medusa_logits = self.medusa_head(hidden_states)
        
        return {
            "logits": base_outputs['logits'],
            "medusa_logits": medusa_logits,
            "hidden_states": hidden_states,
        }
    
    @torch.no_grad()
    def generate(
        self,
        input_ids: torch.Tensor,
        max_new_tokens: int = 100,
        temperature: float = 1.0,
        top_p: float = 0.9,
    ) -> torch.Tensor:
        """Medusa生成"""
        generated = input_ids.clone()
        
        while generated.shape[1] < input_ids.shape[1] + max_new_tokens:
            outputs = self.forward(generated)
            
            base_logits = outputs['logits'][:, -1, :] / temperature
            base_probs = F.softmax(base_logits, dim=-1)
            
            medusa_probs = [
                F.softmax(logits[:, -1, :] / temperature, dim=-1)
                for logits in outputs['medusa_logits']
            ]
            
            candidates = [torch.multinomial(base_probs, num_samples=1)]
            for probs in medusa_probs:
                candidates.append(torch.multinomial(probs, num_samples=1))
            
            for token in candidates:
                generated = torch.cat([generated, token], dim=1)
        
        return generated


def print_speculative_stats(stats: Dict[str, Any]):
    """打印投机解码统计"""
    print("\n" + "=" * 60)
    print("投机解码统计")
    print("=" * 60)
    print(f"总生成token数: {stats['total_tokens']}")
    print(f"接受token数: {stats['accepted_tokens']}")
    print(f"拒绝token数: {stats['rejected_tokens']}")
    print(f"接受率: {stats['acceptance_rate']:.2%}")
    print(f"加速比: {stats['speedup']:.2f}x")
    print(f"草稿模型调用次数: {stats['draft_calls']}")
    print(f"目标模型调用次数: {stats['target_calls']}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    print("投机解码 (Speculative Decoding)")
    print("=" * 60)
    print("\n原理:")
    print("1. 小型草稿模型快速生成多个候选token")
    print("2. 大型目标模型并行验证所有候选")
    print("3. 接受正确的token，拒绝错误的token")
    print("\n优势:")
    print("- 减少目标模型调用次数")
    print("- 提升推理速度 2-3x")
    print("- 保持生成质量不变")
    print("=" * 60)

"""
Alignment Trainer
跨语言对齐训练 - 对比学习+翻译对齐
"""

import os
import json
import random
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
import math

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

from .bilingual_embedder import (
    CrossLingualEmbedder,
    EmbedderConfig,
    SymmetricInfoNCELoss,
    InfoNCELoss,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    batch_size: int = 32
    learning_rate: float = 2e-5
    weight_decay: float = 0.01
    warmup_steps: int = 1000
    max_steps: int = 100000
    save_steps: int = 5000
    eval_steps: int = 1000
    
    temperature: float = 0.05
    
    parallel_weight: float = 1.0
    monolingual_weight: float = 0.5
    hard_negative_weight: float = 0.3
    
    max_seq_length: int = 128
    
    output_dir: str = "./output"
    
    use_amp: bool = True
    gradient_accumulation_steps: int = 1


@dataclass
class ParallelPair:
    zh_text: str
    en_text: str
    similarity: float = 1.0


@dataclass
class MonolingualPair:
    text1: str
    text2: str
    language: str
    similarity: float = 0.8


@dataclass
class HardNegative:
    anchor_text: str
    anchor_lang: str
    negative_text: str
    negative_lang: str


class ParallelDataset(Dataset):
    def __init__(
        self,
        parallel_pairs: List[ParallelPair],
        tokenizer: Any = None,
        max_length: int = 128,
    ):
        self.pairs = parallel_pairs
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self) -> int:
        return len(self.pairs)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        pair = self.pairs[idx]
        
        zh_tokens = self._tokenize(pair.zh_text)
        en_tokens = self._tokenize(pair.en_text)
        
        return {
            'zh_input_ids': torch.tensor(zh_tokens),
            'en_input_ids': torch.tensor(en_tokens),
            'similarity': torch.tensor(pair.similarity),
        }
    
    def _tokenize(self, text: str) -> List[int]:
        tokens = [hash(c) % 50000 for c in text[:self.max_length]]
        
        while len(tokens) < self.max_length:
            tokens.append(0)
        
        return tokens


class MonolingualDataset(Dataset):
    def __init__(
        self,
        pairs: List[MonolingualPair],
        tokenizer: Any = None,
        max_length: int = 128,
    ):
        self.pairs = pairs
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self) -> int:
        return len(self.pairs)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        pair = self.pairs[idx]
        
        tokens1 = self._tokenize(pair.text1)
        tokens2 = self._tokenize(pair.text2)
        
        lang_id = 0 if pair.language == "zh" else 1
        
        return {
            'input_ids1': torch.tensor(tokens1),
            'input_ids2': torch.tensor(tokens2),
            'language': torch.tensor(lang_id),
            'similarity': torch.tensor(pair.similarity),
        }
    
    def _tokenize(self, text: str) -> List[int]:
        tokens = [hash(c) % 50000 for c in text[:self.max_length]]
        
        while len(tokens) < self.max_length:
            tokens.append(0)
        
        return tokens


class AlignmentTrainer:
    def __init__(
        self,
        model: CrossLingualEmbedder,
        config: TrainingConfig,
        tokenizer: Any = None,
    ):
        self.model = model
        self.config = config
        self.tokenizer = tokenizer
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        
        self.optimizer = AdamW(
            model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        
        self.scheduler = CosineAnnealingLR(
            self.optimizer,
            T_max=config.max_steps,
            eta_min=config.learning_rate * 0.01,
        )
        
        self.parallel_loss = SymmetricInfoNCELoss(temperature=config.temperature)
        self.monolingual_loss = InfoNCELoss(temperature=config.temperature)
        
        self.global_step = 0
        self.best_loss = float('inf')
        
        os.makedirs(config.output_dir, exist_ok=True)
    
    def train(
        self,
        parallel_pairs: List[ParallelPair],
        monolingual_pairs: List[MonolingualPair],
        hard_negatives: Optional[List[HardNegative]] = None,
        eval_pairs: Optional[List[ParallelPair]] = None,
    ):
        logger.info(f"Starting training for {self.config.max_steps} steps")
        logger.info(f"Parallel pairs: {len(parallel_pairs)}")
        logger.info(f"Monolingual pairs: {len(monolingual_pairs)}")
        
        parallel_dataset = ParallelDataset(
            parallel_pairs, self.tokenizer, self.config.max_seq_length
        )
        monolingual_dataset = MonolingualDataset(
            monolingual_pairs, self.tokenizer, self.config.max_seq_length
        )
        
        parallel_loader = DataLoader(
            parallel_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            num_workers=0,
        )
        
        monolingual_loader = DataLoader(
            monolingual_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            num_workers=0,
        )
        
        parallel_iter = self._cycle_loader(parallel_loader)
        monolingual_iter = self._cycle_loader(monolingual_loader)
        
        self.model.train()
        
        while self.global_step < self.config.max_steps:
            parallel_batch = next(parallel_iter)
            monolingual_batch = next(monolingual_iter)
            
            loss_dict = self._train_step(parallel_batch, monolingual_batch)
            
            if self.global_step % 100 == 0:
                logger.info(
                    f"Step {self.global_step} | "
                    f"Loss: {loss_dict['total_loss']:.4f} | "
                    f"Parallel: {loss_dict['parallel_loss']:.4f} | "
                    f"Mono: {loss_dict['monolingual_loss']:.4f}"
                )
            
            if self.global_step % self.config.save_steps == 0:
                self._save_checkpoint()
            
            self.global_step += 1
        
        logger.info("Training completed!")
        self._save_checkpoint(final=True)
    
    def _cycle_loader(self, loader: DataLoader):
        while True:
            for batch in loader:
                yield batch
    
    def _train_step(
        self,
        parallel_batch: Dict[str, torch.Tensor],
        monolingual_batch: Dict[str, torch.Tensor],
    ) -> Dict[str, float]:
        self.optimizer.zero_grad()
        
        zh_input_ids = parallel_batch['zh_input_ids'].to(self.device)
        en_input_ids = parallel_batch['en_input_ids'].to(self.device)
        
        zh_outputs = self.model(zh_input_ids, language="zh")
        en_outputs = self.model(en_input_ids, language="en")
        
        parallel_loss_dict = self.parallel_loss(
            zh_outputs['aligned_output'],
            en_outputs['aligned_output'],
        )
        parallel_loss = parallel_loss_dict['total_loss']
        
        input_ids1 = monolingual_batch['input_ids1'].to(self.device)
        input_ids2 = monolingual_batch['input_ids2'].to(self.device)
        languages = monolingual_batch['language'].to(self.device)
        
        outputs1 = self.model(input_ids1)
        outputs2 = self.model(input_ids2)
        
        mono_loss = self.monolingual_loss(
            outputs1['pooled_output'],
            outputs2['pooled_output'],
        )
        
        total_loss = (
            self.config.parallel_weight * parallel_loss +
            self.config.monolingual_weight * mono_loss
        )
        
        total_loss.backward()
        
        torch.nn.utils.clip_grad_norm_(
            self.model.parameters(),
            1.0
        )
        
        self.optimizer.step()
        self.scheduler.step()
        
        return {
            'total_loss': total_loss.item(),
            'parallel_loss': parallel_loss.item(),
            'monolingual_loss': mono_loss.item(),
        }
    
    def _save_checkpoint(self, final: bool = False):
        checkpoint = {
            'global_step': self.global_step,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'scheduler_state_dict': self.scheduler.state_dict(),
            'best_loss': self.best_loss,
        }
        
        if final:
            path = os.path.join(self.config.output_dir, "final_model.pt")
        else:
            path = os.path.join(self.config.output_dir, f"checkpoint_{self.global_step}.pt")
        
        torch.save(checkpoint, path)
        logger.info(f"Checkpoint saved to {path}")
    
    def load_checkpoint(self, path: str):
        checkpoint = torch.load(path, map_location=self.device)
        
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
        self.global_step = checkpoint['global_step']
        self.best_loss = checkpoint.get('best_loss', float('inf'))
        
        logger.info(f"Checkpoint loaded from {path}")
    
    def evaluate(
        self,
        eval_pairs: List[ParallelPair],
    ) -> Dict[str, float]:
        self.model.eval()
        
        dataset = ParallelDataset(eval_pairs, self.tokenizer, self.config.max_seq_length)
        loader = DataLoader(dataset, batch_size=self.config.batch_size)
        
        total_loss = 0.0
        num_batches = 0
        
        with torch.no_grad():
            for batch in loader:
                zh_input_ids = batch['zh_input_ids'].to(self.device)
                en_input_ids = batch['en_input_ids'].to(self.device)
                
                zh_outputs = self.model(zh_input_ids, language="zh")
                en_outputs = self.model(en_input_ids, language="en")
                
                loss_dict = self.parallel_loss(
                    zh_outputs['aligned_output'],
                    en_outputs['aligned_output'],
                )
                
                total_loss += loss_dict['total_loss'].item()
                num_batches += 1
        
        avg_loss = total_loss / num_batches if num_batches > 0 else 0.0
        
        self.model.train()
        
        return {'eval_loss': avg_loss}


def generate_sample_data() -> Tuple[List[ParallelPair], List[MonolingualPair]]:
    parallel_pairs = [
        ParallelPair("人工智能技术正在快速发展", "Artificial intelligence technology is developing rapidly"),
        ParallelPair("机器学习是人工智能的核心", "Machine learning is the core of artificial intelligence"),
        ParallelPair("深度学习模型需要大量数据", "Deep learning models need large amounts of data"),
        ParallelPair("自然语言处理是重要领域", "Natural language processing is an important field"),
        ParallelPair("计算机视觉技术广泛应用", "Computer vision technology is widely applied"),
    ]
    
    monolingual_pairs = [
        MonolingualPair("神经网络模型", "深度学习网络", "zh", 0.8),
        MonolingualPair("机器学习算法", "人工智能方法", "zh", 0.7),
        MonolingualPair("neural network model", "deep learning network", "en", 0.8),
        MonolingualPair("machine learning algorithm", "AI method", "en", 0.7),
    ]
    
    return parallel_pairs, monolingual_pairs


def create_trainer(
    model: Optional[CrossLingualEmbedder] = None,
    config: Optional[TrainingConfig] = None,
) -> AlignmentTrainer:
    if model is None:
        model = CrossLingualEmbedder(EmbedderConfig())
    
    if config is None:
        config = TrainingConfig()
    
    return AlignmentTrainer(model, config)


if __name__ == "__main__":
    config = TrainingConfig(
        batch_size=4,
        max_steps=100,
        save_steps=50,
    )
    
    model = CrossLingualEmbedder(EmbedderConfig())
    
    trainer = AlignmentTrainer(model, config)
    
    parallel_pairs, monolingual_pairs = generate_sample_data()
    
    print(f"训练数据: {len(parallel_pairs)} 平行句对, {len(monolingual_pairs)} 单语言对")
    
    trainer.train(parallel_pairs, monolingual_pairs)
    
    eval_results = trainer.evaluate(parallel_pairs)
    print(f"评估结果: {eval_results}")

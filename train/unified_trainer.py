"""
Unified Bilingual Trainer
统一双语训练器 - 整合所有训练功能
修复AMP Bug、添加Warmup、支持LoRA、DeepSpeed
"""

import os
import math
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import json

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torch.cuda.amp import autocast, GradScaler
from torch.nn.utils import clip_grad_norm_
from torch.utils.checkpoint import checkpoint

from tqdm import tqdm

from model.bilingual_transformer import (
    BilingualTransformer, 
    ModelConfig, 
    BilingualTransformerForTraining
)
from train.config import TrainingConfig, CurriculumStage
from tokenizer.international_tokenizer import MultilingualBPETokenizer


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class LossTracker:
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.losses: Dict[str, List[float]] = {}
        self.history: List[Dict[str, float]] = []
    
    def update(self, losses: Dict[str, Any]):
        for key, value in losses.items():
            if key not in self.losses:
                self.losses[key] = []
            if value is not None:
                if isinstance(value, torch.Tensor):
                    value = value.item()
                if not math.isnan(value):
                    self.losses[key].append(value)
    
    def get_average(self, key: str) -> float:
        if key not in self.losses or not self.losses[key]:
            return 0.0
        recent = self.losses[key][-self.window_size:]
        return sum(recent) / len(recent)
    
    def get_all_averages(self) -> Dict[str, float]:
        return {key: self.get_average(key) for key in self.losses.keys()}
    
    def reset(self):
        self.losses = {}
        self.history = []


class WarmupCosineScheduler(optim.lr_scheduler._LRScheduler):
    def __init__(
        self,
        optimizer: optim.Optimizer,
        warmup_steps: int,
        total_steps: int,
        min_lr: float = 1e-7,
        last_epoch: int = -1,
    ):
        self.warmup_steps = warmup_steps
        self.total_steps = total_steps
        self.min_lr = min_lr
        super().__init__(optimizer, last_epoch)
    
    def get_lr(self):
        if self.last_epoch < self.warmup_steps:
            warmup_factor = self.last_epoch / max(1, self.warmup_steps)
            return [base_lr * warmup_factor for base_lr in self.base_lrs]
        
        progress = (self.last_epoch - self.warmup_steps) / max(1, self.total_steps - self.warmup_steps)
        cosine_factor = 0.5 * (1 + math.cos(math.pi * progress))
        
        return [max(self.min_lr, base_lr * cosine_factor) for base_lr in self.base_lrs]


class CurriculumScheduler:
    def __init__(self, stages: List[CurriculumStage]):
        self.stages = stages
        self.current_stage_idx = 0
        self.current_step = 0
        self.stage_start_step = 0
    
    def get_current_stage(self) -> CurriculumStage:
        return self.stages[self.current_stage_idx]
    
    def step(self) -> Dict[str, float]:
        self.current_step += 1
        
        current_stage = self.get_current_stage()
        stage_progress = self.current_step - self.stage_start_step
        
        if stage_progress >= current_stage.duration_steps:
            if self.current_stage_idx < len(self.stages) - 1:
                self.current_stage_idx += 1
                self.stage_start_step = self.current_step
                logger.info(f"Advancing to stage: {self.stages[self.current_stage_idx].name}")
        
        return self.get_current_ratios()
    
    def get_current_ratios(self) -> Dict[str, float]:
        stage = self.get_current_stage()
        return {
            'zh_ratio': stage.zh_ratio,
            'en_ratio': stage.en_ratio,
            'parallel_ratio': stage.parallel_ratio,
            'code_switch_ratio': stage.code_switch_ratio,
            'instruction_ratio': stage.instruction_ratio,
        }
    
    def should_advance(self, metrics: Dict[str, float]) -> bool:
        stage = self.get_current_stage()
        
        if stage.target_ppl_zh is not None and 'ppl_zh' in metrics:
            if metrics['ppl_zh'] > stage.target_ppl_zh:
                return False
        
        if stage.target_ppl_en is not None and 'ppl_en' in metrics:
            if metrics['ppl_en'] > stage.target_ppl_en:
                return False
        
        return True


class LoRALayer(nn.Module):
    def __init__(
        self,
        in_features: int,
        out_features: int,
        rank: int = 128,
        alpha: int = 256,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank
        
        self.lora_a = nn.Linear(in_features, rank, bias=False)
        self.lora_b = nn.Linear(rank, out_features, bias=False)
        self.dropout = nn.Dropout(dropout)
        
        nn.init.kaiming_uniform_(self.lora_a.weight, a=math.sqrt(5))
        nn.init.zeros_(self.lora_b.weight)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dropout(self.lora_a(x)) @ self.lora_b.weight.T * self.scaling


def apply_lora_to_model(
    model: BilingualTransformer,
    rank: int = 128,
    alpha: int = 256,
    dropout: float = 0.1,
    target_modules: List[str] = None,
) -> BilingualTransformer:
    if target_modules is None:
        target_modules = ["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
    
    for name, module in model.named_modules():
        if any(target in name for target in target_modules):
            if isinstance(module, nn.Linear):
                parent_name = '.'.join(name.split('.')[:-1])
                child_name = name.split('.')[-1]
                
                lora_layer = LoRALayer(
                    module.in_features,
                    module.out_features,
                    rank=rank,
                    alpha=alpha,
                    dropout=dropout,
                )
                
                parent = model
                for part in parent_name.split('.'):
                    if part:
                        parent = getattr(parent, part)
                
                original_forward = module.forward
                lora_forward = lora_layer.forward
                
                def make_forward(orig_fwd, lora_fwd):
                    def forward(x):
                        return orig_fwd(x) + lora_fwd(x)
                    return forward
                
                module.forward = make_forward(original_forward, lora_forward)
                setattr(module, 'lora_layer', lora_layer)
    
    for name, param in model.named_parameters():
        if 'lora' not in name:
            param.requires_grad = False
    
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info(f"LoRA applied: {trainable:,} trainable / {total:,} total parameters")
    
    return model


class BilingualTrainer:
    def __init__(
        self,
        config: TrainingConfig,
        model: Optional[BilingualTransformer] = None,
        tokenizer: Optional[MultilingualBPETokenizer] = None,
    ):
        self.config = config
        self.tokenizer = tokenizer or self._create_tokenizer()
        
        if model is None:
            self.model = BilingualTransformer(config.model_config)
        else:
            self.model = model
        
        if config.lora_config.enabled:
            self.model = apply_lora_to_model(
                self.model,
                rank=config.lora_config.rank,
                alpha=config.lora_config.alpha,
                dropout=config.lora_config.dropout,
                target_modules=config.lora_config.target_modules,
            )
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        
        self.optimizer = self._create_optimizer()
        self.scheduler = self._create_scheduler()
        
        self.scaler = GradScaler() if config.use_amp else None
        self.amp_dtype = torch.bfloat16 if config.amp_dtype == "bf16" and torch.cuda.is_bf16_supported() else torch.float16
        
        self.loss_tracker = LossTracker()
        
        self.global_step = 0
        self.epoch = 0
        self.best_loss = float('inf')
        
        if config.curriculum_config.enabled:
            self.curriculum_scheduler = CurriculumScheduler(config.curriculum_config.stages)
        else:
            self.curriculum_scheduler = None
        
        os.makedirs(config.output_dir, exist_ok=True)
        os.makedirs(config.checkpoint_dir, exist_ok=True)
        
        self._setup_logging()
    
    def _create_tokenizer(self) -> MultilingualBPETokenizer:
        vocab_path = Path("vocab/multilingual_50k")
        if vocab_path.exists():
            return MultilingualBPETokenizer.load(vocab_path)
        return MultilingualBPETokenizer()
    
    def _create_optimizer(self) -> optim.Optimizer:
        no_decay = ['bias', 'LayerNorm.weight', 'layer_norm.weight', 'RMSNorm.weight']
        
        optimizer_grouped_parameters = [
            {
                'params': [p for n, p in self.model.named_parameters() 
                          if p.requires_grad and not any(nd in n for nd in no_decay)],
                'weight_decay': self.config.optimizer_config.weight_decay,
            },
            {
                'params': [p for n, p in self.model.named_parameters() 
                          if p.requires_grad and any(nd in n for nd in no_decay)],
                'weight_decay': 0.0,
            },
        ]
        
        return optim.AdamW(
            optimizer_grouped_parameters,
            lr=self.config.optimizer_config.learning_rate,
            betas=(self.config.optimizer_config.beta1, self.config.optimizer_config.beta2),
            eps=self.config.optimizer_config.epsilon,
        )
    
    def _create_scheduler(self) -> WarmupCosineScheduler:
        return WarmupCosineScheduler(
            self.optimizer,
            warmup_steps=self.config.optimizer_config.warmup_steps,
            total_steps=self.config.total_steps,
            min_lr=self.config.optimizer_config.min_learning_rate,
        )
    
    def _setup_logging(self):
        if self.config.use_tensorboard:
            from torch.utils.tensorboard import SummaryWriter
            self.writer = SummaryWriter(self.config.tensorboard_dir)
        else:
            self.writer = None
        
        if self.config.use_wandb:
            try:
                import wandb
                wandb.init(
                    project=self.config.wandb_project,
                    config=self.config.to_dict(),
                )
                self.wandb = wandb
            except ImportError:
                logger.warning("wandb not installed, skipping")
                self.wandb = None
        else:
            self.wandb = None
    
    def train(
        self,
        train_dataset: Dataset,
        eval_dataset: Optional[Dataset] = None,
    ):
        logger.info(f"Starting training for {self.config.total_steps} steps")
        logger.info(f"Device: {self.device}")
        logger.info(f"Model parameters: {self.model.get_num_params():,}")
        logger.info(f"Trainable parameters: {self.model.get_trainable_params():,}")
        
        train_loader = self._create_dataloader(train_dataset)
        eval_loader = self._create_dataloader(eval_dataset) if eval_dataset else None
        
        self.model.train()
        
        data_iter = iter(train_loader)
        
        while self.global_step < self.config.total_steps:
            try:
                batch = next(data_iter)
            except StopIteration:
                self.epoch += 1
                data_iter = iter(train_loader)
                batch = next(data_iter)
            
            if self.curriculum_scheduler:
                ratios = self.curriculum_scheduler.step()
            
            loss_dict = self._train_step(batch)
            
            self.loss_tracker.update(loss_dict)
            
            if self.global_step % self.config.log_interval == 0:
                self._log_progress(loss_dict)
            
            if self.global_step % self.config.eval_interval == 0 and eval_loader:
                eval_loss = self._evaluate(eval_loader)
                self._log_eval(eval_loss)
                self.model.train()
            
            if self.global_step % self.config.save_interval == 0:
                self.save_checkpoint(f"step_{self.global_step}")
            
            self.global_step += 1
        
        logger.info("Training completed!")
        self.save_checkpoint("final")
        
        if self.writer:
            self.writer.close()
        if self.wandb:
            self.wandb.finish()
    
    def _create_dataloader(self, dataset: Dataset) -> DataLoader:
        def collate_fn(batch):
            texts = [item['text'] if isinstance(item, dict) else str(item) for item in batch]
            languages = [item.get('language', 'mixed') if isinstance(item, dict) else 'mixed' for item in batch]
            
            encodings = self.tokenizer(
                texts,
                max_length=self.config.data_config.max_seq_length,
                padding='max_length',
                truncation=True,
                return_tensors='pt',
            )
            
            input_ids = encodings['input_ids']
            attention_mask = encodings['attention_mask']
            labels = input_ids.clone()
            
            language_ids = torch.zeros_like(input_ids)
            for i, lang in enumerate(languages):
                if lang == 'zh':
                    language_ids[i] = 1
                elif lang == 'en':
                    language_ids[i] = 2
            
            return {
                'input_ids': input_ids,
                'attention_mask': attention_mask,
                'labels': labels,
                'language_ids': language_ids,
            }
        
        return DataLoader(
            dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            collate_fn=collate_fn,
            num_workers=self.config.data_config.num_workers,
            pin_memory=True,
            drop_last=True,
        )
    
    def _train_step(self, batch: Dict[str, torch.Tensor]) -> Dict[str, float]:
        input_ids = batch['input_ids'].to(self.device)
        attention_mask = batch['attention_mask'].to(self.device)
        labels = batch['labels'].to(self.device)
        language_ids = batch.get('language_ids', None)
        if language_ids is not None:
            language_ids = language_ids.to(self.device)
        
        total_loss = 0.0
        accum_steps = self.config.gradient_accumulation_steps
        
        self.optimizer.zero_grad()
        
        for accum_idx in range(accum_steps):
            start_idx = accum_idx * (input_ids.size(0) // accum_steps)
            end_idx = start_idx + (input_ids.size(0) // accum_steps)
            
            sub_input = input_ids[start_idx:end_idx]
            sub_labels = labels[start_idx:end_idx]
            sub_mask = attention_mask[start_idx:end_idx]
            sub_lang = language_ids[start_idx:end_idx] if language_ids is not None else None
            
            if self.config.use_amp:
                with autocast(dtype=self.amp_dtype):
                    outputs = self.model(
                        input_ids=sub_input,
                        attention_mask=sub_mask,
                        labels=sub_labels,
                        language_ids=sub_lang,
                    )
                    loss = outputs['loss'] / accum_steps
                
                self.scaler.scale(loss).backward()
            else:
                outputs = self.model(
                    input_ids=sub_input,
                    attention_mask=sub_mask,
                    labels=sub_labels,
                    language_ids=sub_lang,
                )
                loss = outputs['loss'] / accum_steps
                loss.backward()
            
            total_loss += loss.item() * accum_steps
        
        if self.config.use_amp:
            self.scaler.unscale_(self.optimizer)
        
        clip_grad_norm_(self.model.parameters(), self.config.optimizer_config.max_grad_norm)
        
        if self.config.use_amp:
            self.scaler.step(self.optimizer)
            self.scaler.update()
        else:
            self.optimizer.step()
        
        self.scheduler.step()
        
        return {
            'loss': total_loss,
            'learning_rate': self.scheduler.get_last_lr()[0],
        }
    
    def _evaluate(self, eval_loader: DataLoader) -> float:
        self.model.eval()
        
        total_loss = 0.0
        num_batches = 0
        
        with torch.no_grad():
            for batch in tqdm(eval_loader, desc="Evaluating"):
                input_ids = batch['input_ids'].to(self.device)
                attention_mask = batch['attention_mask'].to(self.device)
                labels = batch['labels'].to(self.device)
                language_ids = batch.get('language_ids')
                if language_ids is not None:
                    language_ids = language_ids.to(self.device)
                
                if self.config.use_amp:
                    with autocast(dtype=self.amp_dtype):
                        outputs = self.model(
                            input_ids=input_ids,
                            attention_mask=attention_mask,
                            labels=labels,
                            language_ids=language_ids,
                        )
                else:
                    outputs = self.model(
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        labels=labels,
                        language_ids=language_ids,
                    )
                
                if outputs['loss'] is not None:
                    total_loss += outputs['loss'].item()
                    num_batches += 1
        
        return total_loss / max(num_batches, 1)
    
    def _log_progress(self, loss_dict: Dict[str, float]):
        avg_losses = self.loss_tracker.get_all_averages()
        lr = self.scheduler.get_last_lr()[0]
        
        msg = f"Step {self.global_step}/{self.config.total_steps} | "
        msg += f"Loss: {avg_losses.get('loss', 0):.4f} | "
        msg += f"LR: {lr:.2e}"
        
        logger.info(msg)
        
        if self.writer:
            self.writer.add_scalar('train/loss', avg_losses.get('loss', 0), self.global_step)
            self.writer.add_scalar('train/learning_rate', lr, self.global_step)
        
        if self.wandb:
            self.wandb.log({
                'train/loss': avg_losses.get('loss', 0),
                'train/learning_rate': lr,
                'train/step': self.global_step,
            })
    
    def _log_eval(self, eval_loss: float):
        logger.info(f"Eval Loss at step {self.global_step}: {eval_loss:.4f}")
        
        if eval_loss < self.best_loss:
            self.best_loss = eval_loss
            self.save_checkpoint("best")
        
        if self.writer:
            self.writer.add_scalar('eval/loss', eval_loss, self.global_step)
        
        if self.wandb:
            self.wandb.log({
                'eval/loss': eval_loss,
                'eval/step': self.global_step,
            })
    
    def save_checkpoint(self, name: str):
        checkpoint_path = Path(self.config.checkpoint_dir) / name
        checkpoint_path.mkdir(parents=True, exist_ok=True)
        
        checkpoint = {
            'global_step': self.global_step,
            'epoch': self.epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'scheduler_state_dict': self.scheduler.state_dict(),
            'best_loss': self.best_loss,
            'config': self.config.to_dict(),
        }
        
        if self.scaler:
            checkpoint['scaler_state_dict'] = self.scaler.state_dict()
        
        torch.save(checkpoint, checkpoint_path / "checkpoint.pt")
        
        config_path = checkpoint_path / "config.json"
        with open(config_path, 'w') as f:
            json.dump(self.config.to_dict(), f, indent=2, ensure_ascii=False)
        
        logger.info(f"Checkpoint saved to {checkpoint_path}")
    
    def load_checkpoint(self, path: str):
        checkpoint = torch.load(path, map_location=self.device)
        
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
        
        self.global_step = checkpoint['global_step']
        self.epoch = checkpoint['epoch']
        self.best_loss = checkpoint.get('best_loss', float('inf'))
        
        if self.scaler and 'scaler_state_dict' in checkpoint:
            self.scaler.load_state_dict(checkpoint['scaler_state_dict'])
        
        logger.info(f"Checkpoint loaded from {path}")
    
    @torch.no_grad()
    def generate(
        self,
        prompt: str,
        max_new_tokens: int = 100,
        temperature: float = 0.7,
        top_k: int = 50,
        top_p: float = 0.9,
        language: str = "auto",
    ) -> str:
        self.model.eval()
        
        input_ids = self.tokenizer.encode(prompt, add_special_tokens=True)
        input_ids = torch.tensor([input_ids], device=self.device)
        
        language_id = None
        if language == "zh":
            language_id = torch.ones_like(input_ids)
        elif language == "en":
            language_id = torch.ones_like(input_ids) * 2
        
        generated_ids = self.model.generate(
            input_ids=input_ids,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_k=top_k,
            top_p=top_p,
            eos_token_id=self.config.model_config.eos_token_id,
        )
        
        generated_text = self.tokenizer.decode(generated_ids[0].tolist(), skip_special_tokens=True)
        
        return generated_text


def create_trainer(
    config: Optional[TrainingConfig] = None,
    model: Optional[BilingualTransformer] = None,
    tokenizer: Optional[MultilingualBPETokenizer] = None,
) -> BilingualTrainer:
    if config is None:
        config = TrainingConfig()
    
    return BilingualTrainer(config, model, tokenizer)


if __name__ == "__main__":
    from train.config import TrainingConfig, ModelConfig
    
    config = TrainingConfig(
        model_config=ModelConfig(),
        batch_size=4,
        total_steps=1000,
        log_interval=10,
        save_interval=100,
    )
    
    trainer = create_trainer(config)
    
    print(f"Trainer created with device: {trainer.device}")
    print(f"Model parameters: {trainer.model.get_num_params():,}")

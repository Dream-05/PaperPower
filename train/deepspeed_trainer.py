"""
DeepSpeed ZeRO 分布式训练支持
支持 ZeRO-1, ZeRO-2, ZeRO-3 三种优化级别
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

logger = logging.getLogger(__name__)


@dataclass
class DeepSpeedConfig:
    """DeepSpeed配置"""
    
    enabled: bool = True
    zero_stage: int = 2
    
    optimizer: Dict[str, Any] = field(default_factory=lambda: {
        "type": "AdamW",
        "params": {
            "lr": 1e-4,
            "betas": [0.9, 0.95],
            "eps": 1e-8,
            "weight_decay": 0.01,
        }
    })
    
    scheduler: Dict[str, Any] = field(default_factory=lambda: {
        "type": "WarmupDecayLR",
        "params": {
            "warmup_min_lr": 0,
            "warmup_max_lr": 1e-4,
            "warmup_num_steps": 1000,
            "total_num_steps": 100000,
        }
    })
    
    fp16: Dict[str, Any] = field(default_factory=lambda: {
        "enabled": True,
        "loss_scale": 0,
        "initial_scale_power": 16,
        "loss_scale_window": 1000,
        "hysteresis": 2,
        "min_loss_scale": 1,
    })
    
    bf16: Dict[str, Any] = field(default_factory=lambda: {
        "enabled": False,
    })
    
    gradient_accumulation_steps: int = 1
    gradient_clipping: float = 1.0
    
    train_micro_batch_size_per_gpu: int = 4
    
    zero_optimization: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        self._setup_zero_config()
    
    def _setup_zero_config(self):
        """设置ZeRO配置"""
        if self.zero_stage == 1:
            self.zero_optimization = {
                "stage": 1,
                "reduce_gradients": True,
                "allgather_partitions": True,
                "allgather_bucket_size": 2e8,
                "reduce_scatter": True,
                "reduce_bucket_size": 2e8,
                "overlap_comm": True,
                "contiguous_gradients": True,
            }
        elif self.zero_stage == 2:
            self.zero_optimization = {
                "stage": 2,
                "offload_optimizer": {
                    "device": "cpu",
                    "pin_memory": True,
                },
                "allgather_partitions": True,
                "allgather_bucket_size": 2e8,
                "reduce_scatter": True,
                "reduce_bucket_size": 2e8,
                "overlap_comm": True,
                "contiguous_gradients": True,
            }
        elif self.zero_stage == 3:
            self.zero_optimization = {
                "stage": 3,
                "offload_optimizer": {
                    "device": "cpu",
                    "pin_memory": True,
                },
                "offload_param": {
                    "device": "cpu",
                    "pin_memory": True,
                },
                "overlap_comm": True,
                "contiguous_gradients": True,
                "sub_group_size": 1e9,
                "reduce_bucket_size": "auto",
                "stage3_prefetch_bucket_size": "auto",
                "stage3_param_persistence_threshold": "auto",
                "stage3_max_live_parameters": 1e9,
                "stage3_max_reuse_distance": 1e9,
                "stage3_gather_16bit_weights_on_model_save": True,
            }
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "train_batch_size": "auto",
            "train_micro_batch_size_per_gpu": self.train_micro_batch_size_per_gpu,
            "gradient_accumulation_steps": self.gradient_accumulation_steps,
            "optimizer": self.optimizer,
            "scheduler": self.scheduler,
            "fp16": self.fp16,
            "bf16": self.bf16,
            "gradient_clipping": self.gradient_clipping,
            "zero_optimization": self.zero_optimization,
            "steps_per_print": 100,
            "wall_clock_breakdown": False,
        }
    
    def save(self, path: str):
        """保存配置到JSON文件"""
        with open(path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
        logger.info(f"DeepSpeed配置已保存到 {path}")


class DeepSpeedTrainer:
    """DeepSpeed训练器"""
    
    def __init__(
        self,
        model: nn.Module,
        config: DeepSpeedConfig,
        train_dataset: Optional[Dataset] = None,
        eval_dataset: Optional[Dataset] = None,
    ):
        self.model = model
        self.config = config
        self.train_dataset = train_dataset
        self.eval_dataset = eval_dataset
        
        self.ds_engine = None
        self.optimizer = None
        self.scheduler = None
        
        self._initialized = False
    
    def setup(self):
        """初始化DeepSpeed"""
        try:
            import deepspeed
        except ImportError:
            logger.warning("DeepSpeed未安装，使用标准PyTorch训练")
            self._setup_pytorch_fallback()
            return
        
        if not self.config.enabled:
            self._setup_pytorch_fallback()
            return
        
        config_dict = self.config.to_dict()
        
        model_parameters = filter(lambda p: p.requires_grad, self.model.parameters())
        
        self.ds_engine, self.optimizer, _, self.scheduler = deepspeed.initialize(
            model=self.model,
            model_parameters=model_parameters,
            config=config_dict,
        )
        
        self.model = self.ds_engine.module
        self._initialized = True
        
        logger.info(f"✅ DeepSpeed ZeRO-{self.config.zero_stage} 初始化成功")
        self._log_memory_usage()
    
    def _setup_pytorch_fallback(self):
        """PyTorch回退方案"""
        from torch.optim import AdamW
        from torch.optim.lr_scheduler import OneCycleLR
        
        self.optimizer = AdamW(
            self.model.parameters(),
            lr=self.config.optimizer['params']['lr'],
            betas=tuple(self.config.optimizer['params']['betas']),
            eps=self.config.optimizer['params']['eps'],
            weight_decay=self.config.optimizer['params']['weight_decay'],
        )
        
        self._initialized = True
        logger.info("✅ 使用标准PyTorch训练")
    
    def _log_memory_usage(self):
        """记录内存使用"""
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1024**3
            reserved = torch.cuda.memory_reserved() / 1024**3
            logger.info(f"GPU内存: 已分配 {allocated:.2f}GB, 已预留 {reserved:.2f}GB")
    
    def train_step(self, batch: Dict[str, torch.Tensor]) -> float:
        """单步训练"""
        if self.ds_engine is not None:
            self.ds_engine.module.train()
        else:
            self.model.train()
        
        if self.ds_engine is not None:
            loss = self.ds_engine(batch)
        else:
            outputs = self.model(**batch)
            loss = outputs['loss'] if isinstance(outputs, dict) else outputs[0]
        
        if self.ds_engine is not None:
            self.ds_engine.backward(loss)
            self.ds_engine.step()
        else:
            loss.backward()
            self.optimizer.step()
            self.optimizer.zero_grad()
        
        return loss.item()
    
    def train_epoch(
        self,
        dataloader: DataLoader,
        epoch: int,
        log_interval: int = 100,
    ) -> Dict[str, float]:
        """训练一个epoch"""
        total_loss = 0.0
        num_batches = 0
        
        for step, batch in enumerate(dataloader):
            loss = self.train_step(batch)
            total_loss += loss
            num_batches += 1
            
            if (step + 1) % log_interval == 0:
                avg_loss = total_loss / num_batches
                logger.info(f"Epoch {epoch}, Step {step + 1}, Loss: {avg_loss:.4f}")
        
        return {
            "loss": total_loss / num_batches,
            "num_batches": num_batches,
        }
    
    def save_checkpoint(self, path: str, tag: str = None):
        """保存检查点"""
        if self.ds_engine is not None:
            self.ds_engine.save_checkpoint(path, tag=tag)
        else:
            os.makedirs(path, exist_ok=True)
            torch.save({
                'model_state_dict': self.model.state_dict(),
                'optimizer_state_dict': self.optimizer.state_dict(),
            }, os.path.join(path, 'checkpoint.pt'))
        
        logger.info(f"检查点已保存到 {path}")
    
    def load_checkpoint(self, path: str, tag: str = None):
        """加载检查点"""
        if self.ds_engine is not None:
            self.ds_engine.load_checkpoint(path, tag=tag)
        else:
            checkpoint = torch.load(os.path.join(path, 'checkpoint.pt'))
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        
        logger.info(f"检查点已从 {path} 加载")


class FSDPConfig:
    """FSDP (Fully Sharded Data Parallel) 配置"""
    
    def __init__(
        self,
        enabled: bool = True,
        sharding_strategy: str = "FULL_SHARD",
        mixed_precision: bool = True,
        cpu_offload: bool = False,
        backward_prefetch: str = "BACKWARD_PRE",
        forward_prefetch: bool = False,
        use_orig_params: bool = True,
    ):
        self.enabled = enabled
        self.sharding_strategy = sharding_strategy
        self.mixed_precision = mixed_precision
        self.cpu_offload = cpu_offload
        self.backward_prefetch = backward_prefetch
        self.forward_prefetch = forward_prefetch
        self.use_orig_params = use_orig_params
    
    def get_fsdp_config(self) -> Dict[str, Any]:
        """获取FSDP配置字典"""
        from torch.distributed.fsdp import ShardingStrategy, BackwardPrefetch
        from torch.distributed.fsdp import StateDictType
        
        strategy_map = {
            "FULL_SHARD": ShardingStrategy.FULL_SHARD,
            "SHARD_GRAD_OP": ShardingStrategy.SHARD_GRAD_OP,
            "NO_SHARD": ShardingStrategy.NO_SHARD,
            "HYBRID_SHARD": ShardingStrategy.HYBRID_SHARD,
        }
        
        prefetch_map = {
            "BACKWARD_PRE": BackwardPrefetch.BACKWARD_PRE,
            "BACKWARD_POST": BackwardPrefetch.BACKWARD_POST,
        }
        
        config = {
            "sharding_strategy": strategy_map.get(self.sharding_strategy, ShardingStrategy.FULL_SHARD),
            "backward_prefetch": prefetch_map.get(self.backward_prefetch, BackwardPrefetch.BACKWARD_PRE),
            "forward_prefetch": self.forward_prefetch,
            "use_orig_params": self.use_orig_params,
        }
        
        if self.cpu_offload:
            from torch.distributed.fsdp import CPUOffload
            config["cpu_offload"] = CPUOffload(offload_params=True)
        
        if self.mixed_precision:
            from torch.distributed.fsdp import MixedPrecision
            config["mixed_precision"] = MixedPrecision(
                param_dtype=torch.bfloat16,
                reduce_dtype=torch.bfloat16,
                buffer_dtype=torch.bfloat16,
            )
        
        return config


def setup_distributed():
    """初始化分布式环境"""
    if "RANK" in os.environ and "WORLD_SIZE" in os.environ:
        rank = int(os.environ["RANK"])
        world_size = int(os.environ["WORLD_SIZE"])
        local_rank = int(os.environ.get("LOCAL_RANK", 0))
        
        torch.distributed.init_process_group(
            backend="nccl",
            rank=rank,
            world_size=world_size,
        )
        
        torch.cuda.set_device(local_rank)
        
        return {
            "rank": rank,
            "world_size": world_size,
            "local_rank": local_rank,
            "is_distributed": True,
        }
    else:
        return {
            "rank": 0,
            "world_size": 1,
            "local_rank": 0,
            "is_distributed": False,
        }


def cleanup_distributed():
    """清理分布式环境"""
    if torch.distributed.is_initialized():
        torch.distributed.destroy_process_group()


def get_deepspeed_config(zero_stage: int = 2, **kwargs) -> Dict[str, Any]:
    """生成DeepSpeed配置"""
    config = DeepSpeedConfig(zero_stage=zero_stage, **kwargs)
    return config.to_dict()


def create_deepspeed_config_file(
    output_path: str,
    zero_stage: int = 2,
    batch_size: int = 4,
    gradient_accumulation_steps: int = 1,
    learning_rate: float = 1e-4,
    warmup_steps: int = 1000,
    total_steps: int = 100000,
    fp16: bool = True,
    bf16: bool = False,
    offload_optimizer: bool = True,
    offload_param: bool = False,
) -> str:
    """创建DeepSpeed配置文件"""
    
    config = {
        "train_batch_size": "auto",
        "train_micro_batch_size_per_gpu": batch_size,
        "gradient_accumulation_steps": gradient_accumulation_steps,
        "optimizer": {
            "type": "AdamW",
            "params": {
                "lr": learning_rate,
                "betas": [0.9, 0.95],
                "eps": 1e-8,
                "weight_decay": 0.01,
            }
        },
        "scheduler": {
            "type": "WarmupDecayLR",
            "params": {
                "warmup_min_lr": 0,
                "warmup_max_lr": learning_rate,
                "warmup_num_steps": warmup_steps,
                "total_num_steps": total_steps,
            }
        },
        "gradient_clipping": 1.0,
        "steps_per_print": 100,
        "wall_clock_breakdown": False,
    }
    
    if fp16:
        config["fp16"] = {
            "enabled": True,
            "loss_scale": 0,
            "initial_scale_power": 16,
            "loss_scale_window": 1000,
            "hysteresis": 2,
            "min_loss_scale": 1,
        }
    
    if bf16:
        config["bf16"] = {"enabled": True}
        if "fp16" in config:
            config["fp16"]["enabled"] = False
    
    if zero_stage == 1:
        config["zero_optimization"] = {
            "stage": 1,
            "reduce_gradients": True,
            "allgather_partitions": True,
            "overlap_comm": True,
            "contiguous_gradients": True,
        }
    elif zero_stage == 2:
        config["zero_optimization"] = {
            "stage": 2,
            "offload_optimizer": {
                "device": "cpu" if offload_optimizer else "none",
                "pin_memory": True,
            } if offload_optimizer else None,
            "allgather_partitions": True,
            "overlap_comm": True,
            "contiguous_gradients": True,
        }
    elif zero_stage == 3:
        config["zero_optimization"] = {
            "stage": 3,
            "offload_optimizer": {
                "device": "cpu" if offload_optimizer else "none",
                "pin_memory": True,
            } if offload_optimizer else None,
            "offload_param": {
                "device": "cpu" if offload_param else "none",
                "pin_memory": True,
            } if offload_param else None,
            "overlap_comm": True,
            "contiguous_gradients": True,
            "stage3_gather_16bit_weights_on_model_save": True,
        }
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    logger.info(f"✅ DeepSpeed配置文件已创建: {output_path}")
    return output_path


if __name__ == "__main__":
    config = DeepSpeedConfig(zero_stage=2)
    config.save("configs/deepspeed_zero2_new.json")
    
    print("\nDeepSpeed ZeRO-2 配置:")
    print(json.dumps(config.to_dict(), indent=2))
    
    print("\n" + "=" * 60)
    print("ZeRO优化级别对比:")
    print("=" * 60)
    print("ZeRO-1: 优化器状态分片")
    print("ZeRO-2: 优化器状态 + 梯度分片")
    print("ZeRO-3: 优化器状态 + 梯度 + 参数分片")
    print("=" * 60)

"""
LoRA (Low-Rank Adaptation) 高效微调
支持大模型的参数高效微调，大幅减少训练参数量
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Dict, List, Tuple, Any, Union
from dataclasses import dataclass, field
import re


@dataclass
class LoRAConfig:
    """LoRA配置"""
    enabled: bool = True
    r: int = 64
    lora_alpha: int = 128
    dropout: float = 0.05
    bias: str = "none"
    target_modules: List[str] = field(default_factory=lambda: [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ])
    fan_in_fan_out: bool = False
    merge_weights: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "r": self.r,
            "lora_alpha": self.lora_alpha,
            "dropout": self.dropout,
            "bias": self.bias,
            "target_modules": self.target_modules,
            "fan_in_fan_out": self.fan_in_fan_out,
            "merge_weights": self.merge_weights,
        }


class LoRALayer(nn.Module):
    """
    LoRA层实现
    W' = W + BA, 其中 B ∈ R^{d×r}, A ∈ R^{r×k}
    """
    
    def __init__(
        self,
        in_features: int,
        out_features: int,
        r: int = 8,
        lora_alpha: int = 16,
        dropout: float = 0.05,
        fan_in_fan_out: bool = False,
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.r = r
        self.lora_alpha = lora_alpha
        self.scaling = lora_alpha / r
        self.fan_in_fan_out = fan_in_fan_out
        
        if r > 0:
            self.lora_A = nn.Parameter(torch.randn(r, in_features) * 0.01)
            self.lora_B = nn.Parameter(torch.zeros(out_features, r))
            self.dropout = nn.Dropout(p=dropout) if dropout > 0 else nn.Identity()
        else:
            self.register_parameter('lora_A', None)
            self.register_parameter('lora_B', None)
        
        self.merged = False
    
    def forward(self, x: torch.Tensor, original_output: torch.Tensor) -> torch.Tensor:
        """前向传播"""
        if self.r > 0 and not self.merged:
            lora_output = self._lora_forward(x)
            return original_output + lora_output * self.scaling
        return original_output
    
    def _lora_forward(self, x: torch.Tensor) -> torch.Tensor:
        """LoRA分支前向传播"""
        if self.fan_in_fan_out:
            return self.dropout(x) @ self.lora_A.T @ self.lora_B.T
        else:
            return self.dropout(x) @ self.lora_A.T @ self.lora_B.T
    
    def merge(self, weight: torch.Tensor) -> torch.Tensor:
        """合并LoRA权重到原始权重"""
        if self.r > 0 and not self.merged:
            if self.fan_in_fan_out:
                merged_weight = weight + (self.lora_B @ self.lora_A) * self.scaling
            else:
                merged_weight = weight + (self.lora_B @ self.lora_A) * self.scaling
            self.merged = True
            return merged_weight
        return weight
    
    def unmerge(self, weight: torch.Tensor) -> torch.Tensor:
        """从原始权重中分离LoRA权重"""
        if self.r > 0 and self.merged:
            if self.fan_in_fan_out:
                unmerged_weight = weight - (self.lora_B @ self.lora_A) * self.scaling
            else:
                unmerged_weight = weight - (self.lora_B @ self.lora_A) * self.scaling
            self.merged = False
            return unmerged_weight
        return weight
    
    def extra_repr(self) -> str:
        return f"in_features={self.in_features}, out_features={self.out_features}, r={self.r}, alpha={self.lora_alpha}"


class LoRALinear(nn.Module):
    """
    带LoRA的线性层
    """
    
    def __init__(
        self,
        in_features: int,
        out_features: int,
        r: int = 8,
        lora_alpha: int = 16,
        dropout: float = 0.05,
        bias: bool = True,
        fan_in_fan_out: bool = False,
    ):
        super().__init__()
        self.linear = nn.Linear(in_features, out_features, bias=bias)
        self.lora = LoRALayer(
            in_features=in_features,
            out_features=out_features,
            r=r,
            lora_alpha=lora_alpha,
            dropout=dropout,
            fan_in_fan_out=fan_in_fan_out,
        )
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        original_output = self.linear(x)
        return self.lora(x, original_output)
    
    def merge_weights(self):
        """合并LoRA权重"""
        self.linear.weight.data = self.lora.merge(self.linear.weight.data)
    
    def unmerge_weights(self):
        """分离LoRA权重"""
        self.linear.weight.data = self.lora.unmerge(self.linear.weight.data)
    
    @property
    def weight(self):
        return self.linear.weight
    
    @property
    def bias(self):
        return self.linear.bias


def apply_lora_to_model(
    model: nn.Module,
    config: LoRAConfig,
    verbose: bool = True,
) -> nn.Module:
    """
    将LoRA应用到模型的指定层
    
    Args:
        model: 原始模型
        config: LoRA配置
        verbose: 是否打印信息
    
    Returns:
        应用了LoRA的模型
    """
    if not config.enabled:
        return model
    
    lora_modules = {}
    
    for name, module in model.named_modules():
        if isinstance(module, nn.Linear):
            for target in config.target_modules:
                if target in name:
                    lora_modules[name] = module
                    break
    
    replaced_count = 0
    for name, module in lora_modules.items():
        in_features = module.in_features
        out_features = module.out_features
        has_bias = module.bias is not None
        
        lora_linear = LoRALinear(
            in_features=in_features,
            out_features=out_features,
            r=config.r,
            lora_alpha=config.lora_alpha,
            dropout=config.dropout,
            bias=has_bias,
            fan_in_fan_out=config.fan_in_fan_out,
        )
        
        lora_linear.linear.weight.data = module.weight.data.clone()
        if has_bias:
            lora_linear.linear.bias.data = module.bias.data.clone()
        
        parent_name = '.'.join(name.split('.')[:-1])
        child_name = name.split('.')[-1]
        
        parent = model
        for part in parent_name.split('.'):
            if part:
                parent = getattr(parent, part)
        
        setattr(parent, child_name, lora_linear)
        replaced_count += 1
    
    if verbose:
        print(f"✅ LoRA已应用到 {replaced_count} 个层")
        print(f"   - Rank (r): {config.r}")
        print(f"   - Alpha: {config.lora_alpha}")
        print(f"   - Target modules: {config.target_modules}")
    
    return model


def get_lora_parameters(model: nn.Module) -> List[nn.Parameter]:
    """获取所有LoRA参数"""
    lora_params = []
    for name, param in model.named_parameters():
        if 'lora_A' in name or 'lora_B' in name:
            lora_params.append(param)
    return lora_params


def get_trainable_parameters(model: nn.Module, config: LoRAConfig) -> Dict[str, int]:
    """获取可训练参数统计"""
    total_params = 0
    trainable_params = 0
    lora_params = 0
    
    for name, param in model.named_parameters():
        total_params += param.numel()
        if param.requires_grad:
            trainable_params += param.numel()
            if 'lora_A' in name or 'lora_B' in name:
                lora_params += param.numel()
    
    return {
        "total_params": total_params,
        "trainable_params": trainable_params,
        "lora_params": lora_params,
        "trainable_percentage": trainable_params / total_params * 100,
        "lora_percentage": lora_params / total_params * 100,
    }


def freeze_non_lora_parameters(model: nn.Module):
    """冻结非LoRA参数"""
    for name, param in model.named_parameters():
        if 'lora_A' not in name and 'lora_B' not in name:
            param.requires_grad = False
        else:
            param.requires_grad = True


def merge_lora_weights(model: nn.Module):
    """合并所有LoRA权重"""
    for name, module in model.named_modules():
        if isinstance(module, LoRALinear):
            module.merge_weights()


def unmerge_lora_weights(model: nn.Module):
    """分离所有LoRA权重"""
    for name, module in model.named_modules():
        if isinstance(module, LoRALinear):
            module.unmerge_weights()


class LoRAManager:
    """LoRA管理器"""
    
    def __init__(self, model: nn.Module, config: LoRAConfig):
        self.model = model
        self.config = config
        self.original_state_dict = None
    
    def apply(self):
        """应用LoRA"""
        self.original_state_dict = self.model.state_dict().copy()
        self.model = apply_lora_to_model(self.model, self.config)
        freeze_non_lora_parameters(self.model)
        return self.model
    
    def merge(self):
        """合并LoRA权重"""
        merge_lora_weights(self.model)
    
    def unmerge(self):
        """分离LoRA权重"""
        unmerge_lora_weights(self.model)
    
    def get_stats(self) -> Dict[str, int]:
        """获取参数统计"""
        return get_trainable_parameters(self.model, self.config)
    
    def save_lora_weights(self, path: str):
        """保存LoRA权重"""
        lora_state_dict = {}
        for name, param in self.model.named_parameters():
            if 'lora_A' in name or 'lora_B' in name:
                lora_state_dict[name] = param.data
        
        torch.save({
            'lora_state_dict': lora_state_dict,
            'config': self.config.to_dict(),
        }, path)
        print(f"✅ LoRA权重已保存到 {path}")
    
    def load_lora_weights(self, path: str):
        """加载LoRA权重"""
        checkpoint = torch.load(path, map_location='cpu')
        lora_state_dict = checkpoint['lora_state_dict']
        
        for name, param in self.model.named_parameters():
            if name in lora_state_dict:
                param.data = lora_state_dict[name]
        
        print(f"✅ LoRA权重已从 {path} 加载")


class QLoRAConfig:
    """QLoRA配置 (4-bit量化 + LoRA)"""
    
    def __init__(
        self,
        bits: int = 4,
        quant_type: str = "nf4",
        double_quant: bool = True,
        lora_config: LoRAConfig = None,
    ):
        self.bits = bits
        self.quant_type = quant_type
        self.double_quant = double_quant
        self.lora_config = lora_config or LoRAConfig()


def print_lora_info(model: nn.Module, config: LoRAConfig):
    """打印LoRA信息"""
    stats = get_trainable_parameters(model, config)
    
    print("\n" + "=" * 60)
    print("LoRA 配置信息")
    print("=" * 60)
    print(f"总参数量: {stats['total_params']:,}")
    print(f"可训练参数量: {stats['trainable_params']:,} ({stats['trainable_percentage']:.2f}%)")
    print(f"LoRA参数量: {stats['lora_params']:,} ({stats['lora_percentage']:.2f}%)")
    print(f"LoRA Rank: {config.r}")
    print(f"LoRA Alpha: {config.lora_alpha}")
    print(f"LoRA Dropout: {config.dropout}")
    print(f"目标模块: {config.target_modules}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    import torch.nn as nn
    
    class SimpleModel(nn.Module):
        def __init__(self):
            super().__init__()
            self.linear1 = nn.Linear(768, 1024)
            self.linear2 = nn.Linear(1024, 768)
            self.q_proj = nn.Linear(768, 768)
            self.v_proj = nn.Linear(768, 768)
        
        def forward(self, x):
            x = self.linear1(x)
            x = torch.relu(x)
            x = self.linear2(x)
            return x
    
    model = SimpleModel()
    
    print("原始模型参数:")
    total = sum(p.numel() for p in model.parameters())
    print(f"总参数量: {total:,}")
    
    config = LoRAConfig(
        r=64,
        lora_alpha=128,
        dropout=0.05,
        target_modules=["q_proj", "v_proj"],
    )
    
    manager = LoRAManager(model, config)
    model = manager.apply()
    
    print_lora_info(model, config)
    
    print("测试前向传播...")
    x = torch.randn(2, 10, 768)
    output = model(x)
    print(f"输出形状: {output.shape}")
    
    print("\n测试权重合并...")
    manager.merge()
    print("LoRA权重已合并")
    
    manager.unmerge()
    print("LoRA权重已分离")

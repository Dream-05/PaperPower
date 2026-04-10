"""
模型量化支持
支持 INT8 动态量化、INT4 量化、GPTQ 等
大幅降低模型显存需求，提升推理速度
"""

import os
import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Dict, List, Tuple, Any, Union
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class QuantizationConfig:
    """量化配置"""
    bits: int = 8
    method: str = "dynamic"
    target_modules: List[str] = None
    sym: bool = True
    per_channel: bool = True
    group_size: int = 128
    
    def __post_init__(self):
        if self.target_modules is None:
            self.target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", 
                                   "gate_proj", "up_proj", "down_proj"]


class QuantizedLinear(nn.Module):
    """量化线性层"""
    
    def __init__(
        self,
        in_features: int,
        out_features: int,
        bits: int = 8,
        bias: bool = True,
        group_size: int = 128,
    ):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.bits = bits
        self.group_size = group_size
        
        self.qweight = nn.Parameter(
            torch.zeros(out_features, in_features, dtype=torch.int8),
            requires_grad=False,
        )
        
        self.scales = nn.Parameter(
            torch.zeros(out_features, dtype=torch.float16),
            requires_grad=False,
        )
        
        if bias:
            self.bias = nn.Parameter(torch.zeros(out_features))
        else:
            self.register_parameter('bias', None)
        
        self.quantized = False
    
    def quantize(self, weight: torch.Tensor):
        """量化权重"""
        if self.bits == 8:
            self._quantize_int8(weight)
        elif self.bits == 4:
            self._quantize_int4(weight)
        self.quantized = True
    
    def _quantize_int8(self, weight: torch.Tensor):
        """INT8量化"""
        weight = weight.to(torch.float32)
        
        max_val = weight.abs().max(dim=1, keepdim=True)[0]
        scale = max_val / 127.0
        
        scale = scale.squeeze()
        scale = torch.where(scale == 0, torch.ones_like(scale), scale)
        
        quantized = torch.clamp(torch.round(weight / scale.unsqueeze(1)), -128, 127).to(torch.int8)
        
        self.qweight.data = quantized
        self.scales.data = scale.to(torch.float16)
    
    def _quantize_int4(self, weight: torch.Tensor):
        """INT4量化 (使用group-wise量化)"""
        weight = weight.to(torch.float32)
        out_features, in_features = weight.shape
        
        weight = weight.reshape(out_features, in_features // self.group_size, self.group_size)
        
        max_val = weight.abs().max(dim=2, keepdim=True)[0]
        scale = max_val / 7.0
        
        scale = torch.where(scale == 0, torch.ones_like(scale), scale)
        
        quantized = torch.clamp(torch.round(weight / scale), -8, 7)
        
        self.qweight.data = quantized.reshape(out_features, in_features).to(torch.int8)
        self.scales.data = scale.reshape(out_features, in_features // self.group_size).to(torch.float16)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """前向传播"""
        if not self.quantized:
            return F.linear(x, self.qweight.to(x.dtype), self.bias)
        
        if self.bits == 8:
            weight = self.qweight.to(x.dtype) * self.scales.unsqueeze(1).to(x.dtype)
        else:
            out_features, in_features = self.qweight.shape
            weight = self.qweight.reshape(out_features, in_features // self.group_size, self.group_size)
            weight = weight.to(x.dtype) * self.scales.unsqueeze(2).to(x.dtype)
            weight = weight.reshape(out_features, in_features)
        
        return F.linear(x, weight, self.bias)
    
    def get_memory_savings(self) -> float:
        """获取内存节省比例"""
        original_bits = 16
        return (original_bits - self.bits) / original_bits * 100


class DynamicQuantizer:
    """动态量化器"""
    
    def __init__(self, config: QuantizationConfig):
        self.config = config
    
    def quantize_model(self, model: nn.Module) -> nn.Module:
        """量化模型"""
        quantized_modules = []
        
        for name, module in model.named_modules():
            if isinstance(module, nn.Linear):
                should_quantize = False
                for target in self.config.target_modules:
                    if target in name:
                        should_quantize = True
                        break
                
                if should_quantize:
                    quantized_module = self._quantize_linear(module, name)
                    self._replace_module(model, name, quantized_module)
                    quantized_modules.append(name)
        
        logger.info(f"✅ 已量化 {len(quantized_modules)} 个线性层")
        return model
    
    def _quantize_linear(self, module: nn.Linear, name: str) -> QuantizedLinear:
        """量化线性层"""
        quantized = QuantizedLinear(
            in_features=module.in_features,
            out_features=module.out_features,
            bits=self.config.bits,
            bias=module.bias is not None,
            group_size=self.config.group_size,
        )
        
        quantized.quantize(module.weight.data)
        
        if module.bias is not None:
            quantized.bias.data = module.bias.data
        
        return quantized
    
    def _replace_module(self, model: nn.Module, name: str, new_module: nn.Module):
        """替换模块"""
        parts = name.split('.')
        parent = model
        for part in parts[:-1]:
            parent = getattr(parent, part)
        setattr(parent, parts[-1], new_module)


class StaticQuantizer:
    """静态量化器 (需要校准数据)"""
    
    def __init__(self, config: QuantizationConfig):
        self.config = config
        self.calibration_data = []
        self.hooks = []
    
    def prepare(self, model: nn.Module) -> nn.Module:
        """准备量化"""
        for name, module in model.named_modules():
            if isinstance(module, nn.Linear):
                for target in self.config.target_modules:
                    if target in name:
                        self._add_observer(module, name)
                        break
        return model
    
    def _add_observer(self, module: nn.Linear, name: str):
        """添加观察器"""
        observer = MinMaxObserver()
        
        def hook(module, input, output):
            observer.observe(input[0])
        
        self.hooks.append(module.register_forward_hook(hook))
        module.observer = observer
    
    def calibrate(self, model: nn.Module, dataloader):
        """校准"""
        model.eval()
        with torch.no_grad():
            for batch in dataloader:
                if isinstance(batch, dict):
                    model(**batch)
                else:
                    model(batch)
    
    def convert(self, model: nn.Module) -> nn.Module:
        """转换为量化模型"""
        for hook in self.hooks:
            hook.remove()
        
        for name, module in model.named_modules():
            if hasattr(module, 'observer'):
                quantized = self._quantize_with_observer(module)
                self._replace_module(model, name, quantized)
        
        return model
    
    def _quantize_with_observer(self, module: nn.Linear) -> QuantizedLinear:
        """使用观察器量化"""
        quantized = QuantizedLinear(
            in_features=module.in_features,
            out_features=module.out_features,
            bits=self.config.bits,
            bias=module.bias is not None,
        )
        
        scale = module.observer.get_scale()
        quantized.quantize(module.weight.data / scale)
        
        if module.bias is not None:
            quantized.bias.data = module.bias.data
        
        return quantized
    
    def _replace_module(self, model: nn.Module, name: str, new_module: nn.Module):
        parts = name.split('.')
        parent = model
        for part in parts[:-1]:
            parent = getattr(parent, part)
        setattr(parent, parts[-1], new_module)


class MinMaxObserver:
    """最小最大观察器"""
    
    def __init__(self):
        self.min_val = None
        self.max_val = None
    
    def observe(self, tensor: torch.Tensor):
        """观察张量"""
        if self.min_val is None:
            self.min_val = tensor.min().item()
            self.max_val = tensor.max().item()
        else:
            self.min_val = min(self.min_val, tensor.min().item())
            self.max_val = max(self.max_val, tensor.max().item())
    
    def get_scale(self) -> float:
        """获取缩放因子"""
        return max(abs(self.min_val), abs(self.max_val)) / 127.0


class GPTQQuantizer:
    """GPTQ量化器"""
    
    def __init__(self, config: QuantizationConfig):
        self.config = config
    
    def quantize(
        self,
        model: nn.Module,
        dataloader,
        num_samples: int = 128,
    ) -> nn.Module:
        """GPTQ量化"""
        model.eval()
        
        for name, module in model.named_modules():
            if isinstance(module, nn.Linear):
                for target in self.config.target_modules:
                    if target in name:
                        self._gptq_quantize_layer(model, module, name, dataloader, num_samples)
                        break
        
        return model
    
    def _gptq_quantize_layer(
        self,
        model: nn.Module,
        layer: nn.Linear,
        name: str,
        dataloader,
        num_samples: int,
    ):
        """GPTQ量化单个层"""
        H = torch.zeros(layer.in_features, layer.in_features, device=layer.weight.device)
        
        def hook(module, input, output):
            nonlocal H
            x = input[0]
            H += x.T @ x
        
        handle = layer.register_forward_hook(hook)
        
        sample_count = 0
        with torch.no_grad():
            for batch in dataloader:
                if sample_count >= num_samples:
                    break
                if isinstance(batch, dict):
                    model(**batch)
                else:
                    model(batch)
                sample_count += batch.get('input_ids', batch).shape[0]
        
        handle.remove()
        
        H = H / sample_count
        
        quantized_layer = self._quantize_with_hessian(layer, H)
        self._replace_module(model, name, quantized_layer)
    
    def _quantize_with_hessian(self, layer: nn.Linear, H: torch.Tensor) -> QuantizedLinear:
        """使用Hessian矩阵量化"""
        W = layer.weight.data.clone()
        
        quantized = QuantizedLinear(
            in_features=layer.in_features,
            out_features=layer.out_features,
            bits=self.config.bits,
            bias=layer.bias is not None,
        )
        
        Q = torch.zeros_like(W)
        
        damp = 0.01 * torch.diag(H).mean()
        H = H + damp * torch.eye(H.shape[0], device=H.device)
        
        for i in range(layer.in_features):
            q = self._quantize_column(W[:, i])
            Q[:, i] = q
            
            error = (W[:, i] - q) / H[i, i]
            W[:, i+1:] += error.unsqueeze(1) * H[i, i+1:].unsqueeze(0)
        
        quantized.qweight.data = Q.to(torch.int8)
        quantized.quantized = True
        
        if layer.bias is not None:
            quantized.bias.data = layer.bias.data
        
        return quantized
    
    def _quantize_column(self, column: torch.Tensor) -> torch.Tensor:
        """量化单列"""
        if self.config.bits == 8:
            scale = column.abs().max() / 127.0
            return torch.clamp(torch.round(column / scale), -128, 127)
        elif self.config.bits == 4:
            scale = column.abs().max() / 7.0
            return torch.clamp(torch.round(column / scale), -8, 7)
        return column
    
    def _replace_module(self, model: nn.Module, name: str, new_module: nn.Module):
        parts = name.split('.')
        parent = model
        for part in parts[:-1]:
            parent = getattr(parent, part)
        setattr(parent, parts[-1], new_module)


def quantize_model_dynamic(
    model: nn.Module,
    bits: int = 8,
    target_modules: List[str] = None,
) -> nn.Module:
    """动态量化模型"""
    config = QuantizationConfig(
        bits=bits,
        method="dynamic",
        target_modules=target_modules,
    )
    quantizer = DynamicQuantizer(config)
    return quantizer.quantize_model(model)


def quantize_model_static(
    model: nn.Module,
    dataloader,
    bits: int = 8,
    target_modules: List[str] = None,
    num_calibration_samples: int = 128,
) -> nn.Module:
    """静态量化模型"""
    config = QuantizationConfig(
        bits=bits,
        method="static",
        target_modules=target_modules,
    )
    quantizer = StaticQuantizer(config)
    
    model = quantizer.prepare(model)
    quantizer.calibrate(model, dataloader)
    model = quantizer.convert(model)
    
    return model


def quantize_model_gptq(
    model: nn.Module,
    dataloader,
    bits: int = 4,
    target_modules: List[str] = None,
    num_samples: int = 128,
) -> nn.Module:
    """GPTQ量化模型"""
    config = QuantizationConfig(
        bits=bits,
        method="gptq",
        target_modules=target_modules,
    )
    quantizer = GPTQQuantizer(config)
    return quantizer.quantize(model, dataloader, num_samples)


def get_model_size(model: nn.Module) -> Dict[str, float]:
    """获取模型大小"""
    total_params = sum(p.numel() for p in model.parameters())
    
    fp16_size = total_params * 2 / 1024**2
    int8_size = total_params * 1 / 1024**2
    int4_size = total_params * 0.5 / 1024**2
    
    return {
        "total_params": total_params,
        "fp16_size_mb": fp16_size,
        "int8_size_mb": int8_size,
        "int4_size_mb": int4_size,
    }


def print_quantization_info(model: nn.Module, bits: int = 8):
    """打印量化信息"""
    size_info = get_model_size(model)
    
    print("\n" + "=" * 60)
    print("量化信息")
    print("=" * 60)
    print(f"模型参数量: {size_info['total_params']:,}")
    print(f"FP16 模型大小: {size_info['fp16_size_mb']:.2f} MB")
    print(f"INT8 模型大小: {size_info['int8_size_mb']:.2f} MB")
    print(f"INT4 模型大小: {size_info['int4_size_mb']:.2f} MB")
    
    if bits == 8:
        savings = (size_info['fp16_size_mb'] - size_info['int8_size_mb']) / size_info['fp16_size_mb'] * 100
        print(f"\nINT8 量化节省: {savings:.1f}%")
    elif bits == 4:
        savings = (size_info['fp16_size_mb'] - size_info['int4_size_mb']) / size_info['fp16_size_mb'] * 100
        print(f"\nINT4 量化节省: {savings:.1f}%")
    
    print("=" * 60 + "\n")


if __name__ == "__main__":
    model = nn.Sequential(
        nn.Linear(768, 1024),
        nn.ReLU(),
        nn.Linear(1024, 768),
    )
    
    print("原始模型:")
    print_quantization_info(model)
    
    quantized = quantize_model_dynamic(model, bits=8)
    print("INT8量化后:")
    print_quantization_info(quantized, bits=8)
    
    x = torch.randn(2, 10, 768)
    output = quantized(x)
    print(f"输出形状: {output.shape}")

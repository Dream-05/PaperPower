#!/usr/bin/env python3
"""
推理性能优化工具
包含模型优化、量化、缓存优化等
"""

import os
import sys
import time
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class OptimizationConfig:
    """优化配置"""
    model_path: str = "output/training/final_model"
    output_path: str = "output/optimized_model"
    
    use_quantization: bool = True
    quantization_bits: int = 8
    
    use_fusion: bool = True
    use_script: bool = False
    
    batch_size: int = 1
    seq_length: int = 128
    warmup_runs: int = 5
    benchmark_runs: int = 20


class ModelOptimizer:
    """模型优化器"""
    
    def __init__(self, config: OptimizationConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    def load_model(self):
        """加载模型"""
        from train_with_chase import SimpleTransformer, TrainingConfig, SimpleTokenizer
        
        config_path = Path(self.config.model_path) / "config.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config_dict = json.load(f)
            config = TrainingConfig(**config_dict)
        else:
            config = TrainingConfig()
        
        self.model = SimpleTransformer(config)
        
        model_file = Path(self.config.model_path) / "model.bin"
        if not model_file.exists():
            model_file = Path(self.config.model_path) / "pytorch_model.bin"
        
        if model_file.exists():
            state_dict = torch.load(model_file, map_location="cpu")
            if "model_state_dict" in state_dict:
                self.model.load_state_dict(state_dict["model_state_dict"], strict=False)
            else:
                self.model.load_state_dict(state_dict, strict=False)
        
        self.model.to(self.device)
        self.model.eval()
        
        self.tokenizer = SimpleTokenizer.from_pretrained(self.config.model_path)
        
        logger.info(f"模型已加载到 {self.device}")
    
    def apply_quantization(self):
        """应用量化"""
        if not self.config.use_quantization:
            return
        
        logger.info(f"应用 {self.config.quantization_bits}bit 量化...")
        
        from model.quantization import quantize_model_dynamic
        
        self.model = quantize_model_dynamic(
            self.model,
            bits=self.config.quantization_bits,
        )
        
        logger.info("量化完成")
    
    def apply_torch_compile(self):
        """应用torch.compile优化"""
        if not self.config.use_fusion:
            return
        
        if hasattr(torch, 'compile'):
            logger.info("应用 torch.compile 优化...")
            self.model = torch.compile(self.model, mode="reduce-overhead")
            logger.info("torch.compile 完成")
        else:
            logger.warning("torch.compile 不可用，跳过")
    
    def apply_script(self):
        """应用TorchScript"""
        if not self.config.use_script:
            return
        
        logger.info("应用 TorchScript...")
        
        example_input = torch.randint(0, 1000, (1, 10), device=self.device)
        
        try:
            self.model = torch.jit.trace(self.model, example_input)
            logger.info("TorchScript 完成")
        except Exception as e:
            logger.warning(f"TorchScript 失败: {e}")
    
    def benchmark(self) -> Dict[str, float]:
        """性能基准测试"""
        logger.info("开始性能基准测试...")
        
        input_ids = torch.randint(
            0, 1000,
            (self.config.batch_size, self.config.seq_length),
            device=self.device
        )
        
        for _ in range(self.config.warmup_runs):
            with torch.no_grad():
                _ = self.model(input_ids)
        
        if self.device.type == "cuda":
            torch.cuda.synchronize()
        
        times = []
        for _ in range(self.config.benchmark_runs):
            start = time.perf_counter()
            
            with torch.no_grad():
                _ = self.model(input_ids)
            
            if self.device.type == "cuda":
                torch.cuda.synchronize()
            
            end = time.perf_counter()
            times.append(end - start)
        
        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)
        
        throughput = self.config.batch_size * self.config.seq_length / avg_time
        
        results = {
            "avg_time_ms": avg_time * 1000,
            "min_time_ms": min_time * 1000,
            "max_time_ms": max_time * 1000,
            "throughput_tokens_per_sec": throughput,
            "batch_size": self.config.batch_size,
            "seq_length": self.config.seq_length,
        }
        
        return results
    
    def measure_memory(self) -> Dict[str, float]:
        """测量内存使用"""
        if self.device.type == "cuda":
            allocated = torch.cuda.memory_allocated() / 1024**2
            reserved = torch.cuda.memory_reserved() / 1024**2
            return {
                "gpu_allocated_mb": allocated,
                "gpu_reserved_mb": reserved,
            }
        else:
            import psutil
            process = psutil.Process()
            memory = process.memory_info().rss / 1024**2
            return {
                "cpu_memory_mb": memory,
            }
    
    def save_optimized_model(self):
        """保存优化后的模型"""
        output_path = Path(self.config.output_path)
        output_path.mkdir(parents=True, exist_ok=True)
        
        if hasattr(self.model, '_orig_mod'):
            state_dict = self.model._orig_mod.state_dict()
        else:
            state_dict = self.model.state_dict()
        
        torch.save({
            "model_state_dict": state_dict,
            "optimization_config": {
                "quantization_bits": self.config.quantization_bits,
                "use_fusion": self.config.use_fusion,
            }
        }, output_path / "optimized_model.bin")
        
        logger.info(f"优化模型已保存到 {output_path}")


def compare_models(config: OptimizationConfig):
    """比较优化前后的模型性能"""
    print("\n" + "=" * 60)
    print("模型性能对比")
    print("=" * 60)
    
    results = {}
    
    print("\n1. 测试原始模型...")
    optimizer = ModelOptimizer(config)
    optimizer.load_model()
    original_results = optimizer.benchmark()
    original_memory = optimizer.measure_memory()
    results["original"] = {**original_results, **original_memory}
    
    print(f"   平均推理时间: {original_results['avg_time_ms']:.2f}ms")
    print(f"   吞吐量: {original_results['throughput_tokens_per_sec']:.0f} tokens/s")
    
    print("\n2. 测试量化模型...")
    config_quant = OptimizationConfig(
        model_path=config.model_path,
        use_quantization=True,
        quantization_bits=8,
    )
    optimizer_quant = ModelOptimizer(config_quant)
    optimizer_quant.load_model()
    optimizer_quant.apply_quantization()
    quant_results = optimizer_quant.benchmark()
    quant_memory = optimizer_quant.measure_memory()
    results["quantized_int8"] = {**quant_results, **quant_memory}
    
    print(f"   平均推理时间: {quant_results['avg_time_ms']:.2f}ms")
    print(f"   吞吐量: {quant_results['throughput_tokens_per_sec']:.0f} tokens/s")
    
    print("\n" + "=" * 60)
    print("对比结果")
    print("=" * 60)
    
    speedup = original_results['avg_time_ms'] / quant_results['avg_time_ms']
    print(f"INT8量化加速: {speedup:.2f}x")
    
    if "gpu_allocated_mb" in original_memory:
        memory_reduction = (original_memory['gpu_allocated_mb'] - quant_memory['gpu_allocated_mb']) / original_memory['gpu_allocated_mb'] * 100
        print(f"显存节省: {memory_reduction:.1f}%")
    
    return results


def optimize_for_inference(model_path: str, output_path: str):
    """为推理优化模型"""
    config = OptimizationConfig(
        model_path=model_path,
        output_path=output_path,
        use_quantization=True,
        quantization_bits=8,
        use_fusion=True,
    )
    
    optimizer = ModelOptimizer(config)
    optimizer.load_model()
    optimizer.apply_quantization()
    optimizer.apply_torch_compile()
    optimizer.save_optimized_model()
    
    results = optimizer.benchmark()
    
    print("\n优化完成!")
    print(f"推理时间: {results['avg_time_ms']:.2f}ms")
    print(f"吞吐量: {results['throughput_tokens_per_sec']:.0f} tokens/s")


def main():
    parser = argparse.ArgumentParser(description="推理性能优化")
    parser.add_argument("--model_path", type=str, default="output/training/final_model")
    parser.add_argument("--output_path", type=str, default="output/optimized_model")
    parser.add_argument("--compare", action="store_true", help="比较优化前后性能")
    parser.add_argument("--quantize", action="store_true", help="应用量化")
    parser.add_argument("--bits", type=int, default=8, choices=[4, 8])
    parser.add_argument("--benchmark", action="store_true", help="运行基准测试")
    parser.add_argument("--batch_size", type=int, default=1)
    parser.add_argument("--seq_length", type=int, default=128)
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("推理性能优化工具")
    print("=" * 60)
    
    if args.compare:
        config = OptimizationConfig(
            model_path=args.model_path,
            batch_size=args.batch_size,
            seq_length=args.seq_length,
        )
        compare_models(config)
    
    elif args.benchmark:
        config = OptimizationConfig(
            model_path=args.model_path,
            batch_size=args.batch_size,
            seq_length=args.seq_length,
        )
        optimizer = ModelOptimizer(config)
        optimizer.load_model()
        results = optimizer.benchmark()
        
        print("\n基准测试结果:")
        for key, value in results.items():
            print(f"  {key}: {value}")
    
    else:
        optimize_for_inference(args.model_path, args.output_path)
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()

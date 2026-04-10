#!/usr/bin/env python3
"""
模型测试套件
测试所有核心功能
"""

import os
import sys
import json
import time
import unittest
import tempfile
from pathlib import Path

import torch
import torch.nn as nn

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestModelArchitecture(unittest.TestCase):
    """测试模型架构"""
    
    def setUp(self):
        """设置测试环境"""
        self.hidden_size = 256
        self.num_heads = 8
        self.num_kv_heads = 2
        self.batch_size = 2
        self.seq_len = 16
    
    def test_gqa_attention(self):
        """测试GQA注意力"""
        from model.advanced_transformer import GroupedQueryAttention
        
        gqa = GroupedQueryAttention(
            hidden_size=self.hidden_size,
            num_heads=self.num_heads,
            num_kv_heads=self.num_kv_heads,
        )
        
        x = torch.randn(self.batch_size, self.seq_len, self.hidden_size)
        output, cache = gqa(x)
        
        self.assertEqual(output.shape, x.shape)
        self.assertEqual(gqa.num_kv_groups, self.num_heads // self.num_kv_heads)
        
        print("✓ GQA注意力测试通过")
    
    def test_kv_cache(self):
        """测试KV Cache"""
        from model.advanced_transformer import KVCache
        
        cache = KVCache(
            num_layers=8,
            num_kv_heads=4,
            head_dim=64,
            max_seq_len=1024,
        )
        
        cache.allocate(batch_size=2)
        
        self.assertIsNotNone(cache.cache)
        self.assertEqual(cache.seq_len, 0)
        
        memory = cache.get_memory_usage()
        self.assertGreater(memory, 0)
        
        cache.clear()
        self.assertEqual(cache.seq_len, 0)
        
        print("✓ KV Cache测试通过")
    
    def test_advanced_transformer(self):
        """测试高级Transformer"""
        from model.advanced_transformer import AdvancedBilingualTransformer, AdvancedModelConfig
        
        config = AdvancedModelConfig(
            hidden_size=256,
            num_hidden_layers=4,
            num_attention_heads=8,
            num_key_value_heads=2,
            vocab_size=1000,
        )
        
        model = AdvancedBilingualTransformer(config)
        
        input_ids = torch.randint(0, 1000, (self.batch_size, self.seq_len))
        
        outputs = model(input_ids)
        
        self.assertIn('logits', outputs)
        self.assertEqual(outputs['logits'].shape, (self.batch_size, self.seq_len, config.vocab_size))
        
        num_params = model.get_num_params()
        self.assertGreater(num_params, 0)
        
        print(f"✓ 高级Transformer测试通过 (参数量: {num_params:,})")


class TestLoRA(unittest.TestCase):
    """测试LoRA"""
    
    def test_lora_layer(self):
        """测试LoRA层"""
        from model.lora import LoRALayer, LoRAConfig
        
        config = LoRAConfig(r=16, lora_alpha=32)
        lora = LoRALayer(
            in_features=256,
            out_features=512,
            r=config.r,
            lora_alpha=config.lora_alpha,
        )
        
        x = torch.randn(2, 10, 256)
        original = torch.randn(2, 10, 512)
        
        output = lora(x, original)
        
        self.assertEqual(output.shape, original.shape)
        
        print("✓ LoRA层测试通过")
    
    def test_lora_linear(self):
        """测试LoRA线性层"""
        from model.lora import LoRALinear
        
        layer = LoRALinear(256, 512, r=16, lora_alpha=32)
        
        x = torch.randn(2, 10, 256)
        output = layer(x)
        
        self.assertEqual(output.shape, (2, 10, 512))
        
        layer.merge_weights()
        layer.unmerge_weights()
        
        print("✓ LoRA线性层测试通过")


class TestQuantization(unittest.TestCase):
    """测试量化"""
    
    def test_quantized_linear(self):
        """测试量化线性层"""
        from model.quantization import QuantizedLinear
        
        layer = QuantizedLinear(256, 512, bits=8)
        
        weight = torch.randn(512, 256)
        layer.quantize(weight)
        
        self.assertTrue(layer.quantized)
        
        x = torch.randn(2, 10, 256)
        output = layer(x)
        
        self.assertEqual(output.shape, (2, 10, 512))
        
        savings = layer.get_memory_savings()
        self.assertEqual(savings, 50.0)
        
        print("✓ INT8量化测试通过")
    
    def test_int4_quantization(self):
        """测试INT4量化"""
        from model.quantization import QuantizedLinear
        
        layer = QuantizedLinear(256, 512, bits=4, group_size=64)
        
        weight = torch.randn(512, 256)
        layer.quantize(weight)
        
        x = torch.randn(2, 10, 256)
        output = layer(x)
        
        self.assertEqual(output.shape, (2, 10, 512))
        
        print("✓ INT4量化测试通过")


class TestMoE(unittest.TestCase):
    """测试MoE"""
    
    def test_moe_layer(self):
        """测试MoE层"""
        from model.moe import MoELayer, MoEConfig
        
        config = MoEConfig(
            num_experts=4,
            num_experts_per_tok=2,
            hidden_size=256,
            intermediate_size=512,
        )
        
        moe = MoELayer(config)
        
        x = torch.randn(2, 10, 256)
        output = moe(x)
        
        self.assertEqual(output.shape, x.shape)
        self.assertGreater(moe.aux_loss, 0)
        
        print("✓ MoE层测试通过")


class TestTraining(unittest.TestCase):
    """测试训练"""
    
    def test_simple_training(self):
        """测试简单训练"""
        from train_with_chase import SimpleTransformer, TrainingConfig, InstructionDataset
        
        config = TrainingConfig(
            hidden_size=128,
            num_hidden_layers=2,
            num_attention_heads=4,
            vocab_size=100,
            num_epochs=1,
            batch_size=2,
        )
        
        model = SimpleTransformer(config)
        
        samples = [
            {"instruction": "测试", "input": "输入", "output": "输出"}
            for _ in range(4)
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, encoding='utf-8') as f:
            for s in samples:
                f.write(json.dumps(s, ensure_ascii=False) + '\n')
            temp_file = f.name
        
        try:
            dataset = InstructionDataset(temp_file, max_length=32)
            
            self.assertEqual(len(dataset), 4)
            
            sample = dataset[0]
            self.assertIn('input_ids', sample)
            self.assertIn('labels', sample)
            
            print("✓ 训练数据集测试通过")
            
        finally:
            os.unlink(temp_file)


class TestInference(unittest.TestCase):
    """测试推理"""
    
    def test_model_generation(self):
        """测试模型生成"""
        from train_with_chase import SimpleTransformer, TrainingConfig
        
        config = TrainingConfig(
            hidden_size=128,
            num_hidden_layers=2,
            num_attention_heads=4,
            vocab_size=100,
        )
        
        model = SimpleTransformer(config)
        model.eval()
        
        input_ids = torch.randint(0, 100, (1, 10))
        
        with torch.no_grad():
            output = model.generate(input_ids, max_new_tokens=10)
        
        self.assertEqual(output.shape[1], 20)
        
        print("✓ 模型生成测试通过")


class TestEvaluation(unittest.TestCase):
    """测试评估"""
    
    def test_sql_evaluator(self):
        """测试SQL评估器"""
        from evaluate import SQLEvaluator
        
        evaluator = SQLEvaluator()
        
        result = evaluator.exact_match(
            "SELECT 姓名 FROM 员工",
            "SELECT 姓名 FROM 员工"
        )
        self.assertEqual(result, 1.0)
        
        result = evaluator.exact_match(
            "SELECT 姓名 FROM 员工",
            "SELECT 年龄 FROM 员工"
        )
        self.assertEqual(result, 0.0)
        
        validity = evaluator.sql_validity("SELECT * FROM 员工")
        self.assertEqual(validity, 1.0)
        
        keyword = evaluator.keyword_match(
            "SELECT 姓名 FROM 员工 WHERE 年龄 > 30",
            "SELECT 姓名 FROM 员工 WHERE 年龄 > 30"
        )
        self.assertGreater(keyword, 0.8)
        
        print("✓ SQL评估器测试通过")


class TestPerformance(unittest.TestCase):
    """测试性能"""
    
    def test_inference_speed(self):
        """测试推理速度"""
        from train_with_chase import SimpleTransformer, TrainingConfig
        
        config = TrainingConfig(
            hidden_size=256,
            num_hidden_layers=4,
            num_attention_heads=8,
            vocab_size=1000,
        )
        
        model = SimpleTransformer(config)
        model.eval()
        
        input_ids = torch.randint(0, 1000, (1, 20))
        
        start = time.time()
        with torch.no_grad():
            for _ in range(10):
                _ = model(input_ids)
        end = time.time()
        
        avg_time = (end - start) / 10
        print(f"✓ 平均推理时间: {avg_time*1000:.2f}ms")
        
        self.assertLess(avg_time, 1.0)


def run_all_tests():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("智办AI 模型测试套件")
    print("=" * 60 + "\n")
    
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestModelArchitecture))
    suite.addTests(loader.loadTestsFromTestCase(TestLoRA))
    suite.addTests(loader.loadTestsFromTestCase(TestQuantization))
    suite.addTests(loader.loadTestsFromTestCase(TestMoE))
    suite.addTests(loader.loadTestsFromTestCase(TestTraining))
    suite.addTests(loader.loadTestsFromTestCase(TestInference))
    suite.addTests(loader.loadTestsFromTestCase(TestEvaluation))
    suite.addTests(loader.loadTestsFromTestCase(TestPerformance))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("\n" + "=" * 60)
    print(f"测试完成: {result.testsRun} 个测试")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    print("=" * 60 + "\n")
    
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)

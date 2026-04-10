"""
Bilingual Model Tests
翻译能力、代码切换测试
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import torch

from model.bilingual_transformer import (
    BilingualTransformer,
    ModelConfig,
    BilingualEmbedding,
    TransformerBlock,
    MultiHeadAttention,
    create_model,
)
from model.rope import RotaryEmbedding, apply_rotary_emb_batched
from data.mixed_sampler import (
    BilingualSampler,
    BilingualDataset,
    CurriculumScheduler,
    SamplingConfig,
    LanguageType,
)


class TestRoPE(unittest.TestCase):
    
    def test_rope_initialization(self):
        rope = RotaryEmbedding(dim=64, max_seq_len=512)
        
        self.assertEqual(rope.dim, 64)
        self.assertEqual(rope.max_seq_len, 512)
        self.assertIsNotNone(rope.freqs_cis_buf)
    
    def test_rope_forward(self):
        rope = RotaryEmbedding(dim=64, max_seq_len=512)
        
        freqs = rope(seq_len=128)
        
        self.assertEqual(freqs.shape[0], 128)
        self.assertEqual(freqs.shape[1], 32)
    
    def test_rope_extended(self):
        rope = RotaryEmbedding(dim=64, max_seq_len=512, extend_ratio=4.0)
        
        freqs = rope(seq_len=2048, extend=True)
        
        self.assertEqual(freqs.shape[0], 2048)
    
    def test_apply_rotary_emb(self):
        batch_size = 2
        seq_len = 16
        num_heads = 8
        head_dim = 64
        
        xq = torch.randn(batch_size, seq_len, num_heads, head_dim)
        xk = torch.randn(batch_size, seq_len, num_heads, head_dim)
        
        rope = RotaryEmbedding(dim=head_dim, max_seq_len=512)
        freqs_cis = rope(seq_len, xq.device)
        
        xq_rotated, xk_rotated = apply_rotary_emb_batched(xq, xk, freqs_cis)
        
        self.assertEqual(xq_rotated.shape, xq.shape)
        self.assertEqual(xk_rotated.shape, xk.shape)


class TestModelComponents(unittest.TestCase):
    
    def test_model_config(self):
        config = ModelConfig(
            vocab_size=50000,
            hidden_size=768,
            num_hidden_layers=12,
            num_attention_heads=12,
        )
        
        self.assertEqual(config.vocab_size, 50000)
        self.assertEqual(config.hidden_size, 768)
        self.assertEqual(config.num_hidden_layers, 12)
        self.assertEqual(config.num_attention_heads, 12)
    
    def test_bilingual_embedding(self):
        embedding = BilingualEmbedding(
            vocab_size=50000,
            hidden_size=768,
        )
        
        input_ids = torch.randint(0, 50000, (2, 32))
        
        output = embedding(input_ids)
        
        self.assertEqual(output.shape, (2, 32, 768))
    
    def test_multi_head_attention(self):
        attention = MultiHeadAttention(
            hidden_size=768,
            num_heads=12,
            max_seq_len=4096,
        )
        
        hidden_states = torch.randn(2, 32, 768)
        
        output, cache = attention(hidden_states, use_cache=True)
        
        self.assertEqual(output.shape, (2, 32, 768))
        self.assertIsNotNone(cache)
    
    def test_transformer_block(self):
        block = TransformerBlock(
            hidden_size=768,
            num_heads=12,
            intermediate_size=3072,
            max_seq_len=4096,
        )
        
        hidden_states = torch.randn(2, 32, 768)
        
        output, cache = block(hidden_states, use_cache=True)
        
        self.assertEqual(output.shape, (2, 32, 768))


class TestBilingualTransformer(unittest.TestCase):
    
    def setUp(self):
        self.config = ModelConfig(
            vocab_size=1000,
            hidden_size=256,
            num_hidden_layers=2,
            num_attention_heads=4,
            intermediate_size=512,
            max_position_embeddings=128,
        )
        self.model = BilingualTransformer(self.config)
    
    def test_model_initialization(self):
        self.assertEqual(self.model.config.vocab_size, 1000)
        self.assertEqual(self.model.config.hidden_size, 256)
        self.assertEqual(len(self.model.layers), 2)
    
    def test_forward_pass(self):
        input_ids = torch.randint(0, 1000, (2, 32))
        
        outputs = self.model(input_ids)
        
        self.assertIn('logits', outputs)
        self.assertEqual(outputs['logits'].shape, (2, 32, 1000))
    
    def test_forward_with_labels(self):
        input_ids = torch.randint(0, 1000, (2, 32))
        labels = input_ids.clone()
        
        outputs = self.model(input_ids, labels=labels)
        
        self.assertIn('loss', outputs)
        self.assertIsNotNone(outputs['loss'])
    
    def test_forward_with_cache(self):
        input_ids = torch.randint(0, 1000, (2, 32))
        
        outputs = self.model(input_ids, use_cache=True)
        
        self.assertIn('past_key_values', outputs)
        self.assertIsNotNone(outputs['past_key_values'])
    
    def test_generation(self):
        input_ids = torch.randint(0, 1000, (1, 10))
        
        generated = self.model.generate(
            input_ids=input_ids,
            max_new_tokens=10,
            temperature=1.0,
        )
        
        self.assertEqual(generated.shape[0], 1)
        self.assertGreaterEqual(generated.shape[1], 10)
    
    def test_parameter_count(self):
        num_params = self.model.get_num_params()
        
        self.assertGreater(num_params, 0)


class TestBilingualSampler(unittest.TestCase):
    
    def test_sampler_initialization(self):
        texts = ["中文文本", "English text"]
        languages = ["zh", "en"]
        
        dataset = BilingualDataset(texts, languages)
        config = SamplingConfig(batch_size=2)
        
        sampler = BilingualSampler(dataset, config)
        
        self.assertEqual(len(sampler.zh_samples), 1)
        self.assertEqual(len(sampler.en_samples), 1)
    
    def test_sampler_iteration(self):
        texts = ["中文文本"] * 10 + ["English text"] * 10
        languages = ["zh"] * 10 + ["en"] * 10
        
        dataset = BilingualDataset(texts, languages)
        config = SamplingConfig(batch_size=4)
        
        sampler = BilingualSampler(dataset, config)
        
        batches = list(sampler)
        
        self.assertGreater(len(batches), 0)
        self.assertEqual(len(batches[0]), 4)
    
    def test_curriculum_update(self):
        texts = ["中文文本", "English text"]
        languages = ["zh", "en"]
        
        dataset = BilingualDataset(texts, languages)
        config = SamplingConfig(batch_size=2)
        
        sampler = BilingualSampler(dataset, config)
        
        sampler.update_curriculum(week=1)
        self.assertEqual(sampler.current_zh_ratio, 0.5)
        
        sampler.update_curriculum(week=5)
        self.assertEqual(sampler.config.parallel_data_ratio, 0.15)


class TestCurriculumScheduler(unittest.TestCase):
    
    def test_scheduler_initialization(self):
        scheduler = CurriculumScheduler(total_steps=10000)
        
        self.assertEqual(scheduler.total_steps, 10000)
    
    def test_stage_progression(self):
        scheduler = CurriculumScheduler(total_steps=10000)
        
        config_0 = scheduler.stage_configs[0][2]
        self.assertEqual(config_0['zh_ratio'], 0.5)
        
        config_3 = scheduler.stage_configs[3][2]
        self.assertEqual(config_3['code_ratio'], 0.15)


class TestLanguageDetection(unittest.TestCase):
    
    def test_chinese_detection(self):
        from tokenizer.language_detector import detect_language, Language
        
        text = "这是一段中文文本"
        lang = detect_language(text)
        
        self.assertEqual(lang, Language.CHINESE)
    
    def test_english_detection(self):
        from tokenizer.language_detector import detect_language, Language
        
        text = "This is an English text"
        lang = detect_language(text)
        
        self.assertEqual(lang, Language.ENGLISH)
    
    def test_mixed_detection(self):
        from tokenizer.language_detector import detect_language, Language
        
        text = "AI技术正在改变世界"
        lang = detect_language(text)
        
        self.assertEqual(lang, Language.MIXED)


class TestCodeSwitching(unittest.TestCase):
    
    def setUp(self):
        self.config = ModelConfig(
            vocab_size=1000,
            hidden_size=256,
            num_hidden_layers=2,
            num_attention_heads=4,
        )
        self.model = BilingualTransformer(self.config)
    
    def test_mixed_input_encoding(self):
        from tokenizer import MultilingualBPETokenizer
        
        tokenizer = MultilingualBPETokenizer()
        
        text = "我正在学习Machine Learning"
        tokens = tokenizer.encode(text)
        
        self.assertIsInstance(tokens, list)
        self.assertGreater(len(tokens), 0)
    
    def test_mixed_roundtrip(self):
        from tokenizer import MultilingualBPETokenizer
        
        tokenizer = MultilingualBPETokenizer()
        
        text = "AI技术Machine Learning深度学习"
        tokens = tokenizer.encode(text)
        decoded = tokenizer.decode(tokens)
        
        self.assertEqual(decoded, text)


class TestTranslationCapability(unittest.TestCase):
    
    def test_parallel_data_handling(self):
        texts = [
            "你好世界",
            "Hello World",
        ]
        languages = ["zh", "en"]
        
        dataset = BilingualDataset(texts, languages)
        
        self.assertEqual(len(dataset), 2)
        self.assertEqual(dataset[0]['language'], "zh")
        self.assertEqual(dataset[1]['language'], "en")


class TestLongSequence(unittest.TestCase):
    
    def test_long_sequence_handling(self):
        config = ModelConfig(
            vocab_size=1000,
            hidden_size=256,
            num_hidden_layers=2,
            num_attention_heads=4,
            max_position_embeddings=4096,
        )
        model = BilingualTransformer(config)
        
        input_ids = torch.randint(0, 1000, (1, 1024))
        
        outputs = model(input_ids)
        
        self.assertEqual(outputs['logits'].shape[1], 1024)


class TestMemoryEfficiency(unittest.TestCase):
    
    def test_gradient_checkpointing(self):
        config = ModelConfig(
            vocab_size=1000,
            hidden_size=256,
            num_hidden_layers=4,
        )
        model = BilingualTransformer(config)
        model.gradient_checkpointing = True
        
        input_ids = torch.randint(0, 1000, (2, 64))
        
        outputs = model(input_ids)
        
        self.assertIsNotNone(outputs['logits'])


if __name__ == "__main__":
    unittest.main(verbosity=2)

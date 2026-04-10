"""
Mixed Language Tests
中英混合文本测试
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tokenizer.language_detector import LanguageDetector, Language
from tokenizer.international_tokenizer import MultilingualBPETokenizer, TokenizerConfig


class TestMixedLanguageDetection(unittest.TestCase):
    
    def setUp(self):
        self.detector = LanguageDetector()
    
    def test_detect_mixed_zh_en(self):
        text = "AI技术正在改变世界"
        self.assertTrue(self.detector.is_mixed_zh_en(text))
    
    def test_detect_english_dominant(self):
        text = "This is an English sentence."
        lang = self.detector.detect_text_language(text)
        self.assertEqual(lang, Language.ENGLISH)
    
    def test_segment_mixed_boundary(self):
        text = "AI技术"
        segments = self.detector.segment_by_language(text)
        
        self.assertGreaterEqual(len(segments), 1)
    
    def test_language_stats_mixed(self):
        text = "学习machine learning很有趣"
        stats = self.detector.get_language_stats(text)
        
        self.assertIn(Language.CHINESE, stats)
        self.assertIn(Language.ENGLISH, stats)


class TestMixedTokenization(unittest.TestCase):
    
    def setUp(self):
        self.tokenizer = MultilingualBPETokenizer()
    
    def test_mixed_simple(self):
        text = "AI技术"
        tokens = self.tokenizer.encode(text)
        
        self.assertIsInstance(tokens, list)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_mixed_sentence(self):
        text = "我正在学习Machine Learning"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_english_word_in_chinese(self):
        text = "Python是一门很火的编程语言"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_word_in_english(self):
        text = "The concept of AI is interesting"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_mixed_with_punctuation(self):
        text = "今天天气很好，let's go to the park!"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_code_mixed(self):
        text = "def 函数名(): return None"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_technical_terms(self):
        terms = [
            "API接口",
            "HTTP请求",
            "JSON数据",
            "SQL查询",
            "GitHub仓库",
            "Linux系统",
            "Docker容器",
        ]
        
        for term in terms:
            with self.subTest(term=term):
                tokens = self.tokenizer.encode(term)
                decoded = self.tokenizer.decode(term)
                self.assertEqual(decoded, term)
    
    def test_mixed_compression_ratio(self):
        text = "AI技术 Machine Learning 深度学习 Deep Learning"
        stats = self.tokenizer.get_token_stats(text)
        
        self.assertIn('compression_ratio', stats)
        self.assertGreater(stats['compression_ratio'], 0)
        self.assertEqual(stats['detected_language'], 'mixed')
    
    def test_special_tokens_with_mixed(self):
        text = "我爱你"
        tokens = self.tokenizer.encode(text, add_special_tokens=True)
        
        self.assertIn(self.tokenizer.vocab.get("<|zh|>"), tokens)


class TestMixedRoundTrip(unittest.TestCase):
    
    def setUp(self):
        self.tokenizer = MultilingualBPETokenizer()
    
    def test_roundtrip_sentences(self):
        texts = [
            "我爱你，I love you",
            "今天天气很好，the weather is nice",
            "学习AI，学习Machine Learning",
        ]
        
        for text in texts:
            with self.subTest(text=text):
                tokens = self.tokenizer.encode(text)
                decoded = self.tokenizer.decode(tokens)
                self.assertEqual(decoded, text)
    
    def test_roundtrip_technical(self):
        text = "使用Python开发AI模型，使用TensorFlow框架"
        
        tokens = self.tokenizer.encode(text)
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_roundtrip_paragraph(self):
        text = """
        人工智能（Artificial Intelligence）是当前科技发展的热点。
        Machine Learning是AI的核心技术之一。
        深度学习（Deep Learning）近年来取得了突破性进展。
        """
        
        tokens = self.tokenizer.encode(text)
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)


class TestLanguageSwitching(unittest.TestCase):
    
    def setUp(self):
        self.tokenizer = MultilingualBPETokenizer()
    
    def test_chinese_with_english_markers(self):
        text = "<|zh|>中文内容<|en|>English content"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertIn("中文内容", decoded)
        self.assertIn("English content", decoded)
    
    def test_code_token_detection(self):
        text = "def hello(): print('Hello, World!')"
        lang = self.tokenizer.language_detector.detect_text_language(text)
        
        self.assertEqual(lang, Language.CODE)


class TestMixedEdgeCases(unittest.TestCase):
    
    def setUp(self):
        self.tokenizer = MultilingualBPETokenizer()
    
    def test_special_chars_in_mixed(self):
        text = "Email: test@example.com, 电话: 123-456-7890"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertIn("test@example.com", decoded)
    
    def test_urls_in_mixed(self):
        text = "访问 https://example.com 查看详情"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertIn("https://example.com", decoded)
    
    def test_mixed_newlines(self):
        text = "第一行 English\n第二行 中文"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_long_mixed_text(self):
        text = """
        Machine Learning is a subset of artificial intelligence.
        机器学习是人工智能的一个分支。
        It enables computers to learn from data.
        它使计算机能够从数据中学习。
        Deep Learning uses neural networks.
        深度学习使用神经网络。
        """
        
        tokens = self.tokenizer.encode(text)
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)


class TestCompressionComparison(unittest.TestCase):
    
    def setUp(self):
        self.tokenizer = MultilingualBPETokenizer()
    
    def test_chinese_compression(self):
        text = "人工智能技术正在快速发展"
        stats = self.tokenizer.get_token_stats(text)
        
        chinese_chars = len([c for c in text if '\u4e00' <= c <= '\u9fff'])
        tokens_per_char = stats['token_count'] / chinese_chars if chinese_chars > 0 else 0
        
        self.assertLessEqual(tokens_per_char, 2.0)
    
    def test_english_compression(self):
        text = "Artificial intelligence technology is developing rapidly"
        stats = self.tokenizer.get_token_stats(text)
        
        words = text.split()
        tokens_per_word = stats['token_count'] / len(words) if words else 0
        
        self.assertLessEqual(tokens_per_word, 2.0)
    
    def test_mixed_compression(self):
        text = "AI技术 Machine Learning 深度学习"
        stats = self.tokenizer.get_token_stats(text)
        
        self.assertGreater(stats['compression_ratio'], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)

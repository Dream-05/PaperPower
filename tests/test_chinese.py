"""
Chinese Encoding Tests
中文编码解码专项测试
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tokenizer.language_detector import LanguageDetector, Language
from tokenizer.international_tokenizer import MultilingualBPETokenizer, TokenizerConfig


class TestChineseLanguageDetection(unittest.TestCase):
    
    def setUp(self):
        self.detector = LanguageDetector()
    
    def test_detect_pure_chinese(self):
        text = "人工智能是计算机科学的一个分支"
        lang = self.detector.detect_text_language(text)
        self.assertEqual(lang, Language.CHINESE)
    
    def test_detect_chinese_with_punctuation(self):
        text = "今天天气很好，我们去公园散步。"
        lang = self.detector.detect_text_language(text)
        self.assertEqual(lang, Language.CHINESE)
    
    def test_detect_chinese_numbers(self):
        text = "2024年1月1日，新的一年开始了。"
        lang = self.detector.detect_text_language(text)
        self.assertEqual(lang, Language.CHINESE)
    
    def test_is_chinese_dominant(self):
        text = "这是一段中文文本"
        self.assertTrue(self.detector.is_chinese_dominant(text))
    
    def test_segment_chinese_text(self):
        text = "人工智能技术"
        segments = self.detector.segment_by_language(text)
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0].language, Language.CHINESE)
        self.assertEqual(segments[0].text, text)


class TestChineseTokenization(unittest.TestCase):
    
    def setUp(self):
        self.config = TokenizerConfig()
        self.tokenizer = MultilingualBPETokenizer(config=self.config)
    
    def test_single_chinese_char(self):
        text = "人"
        tokens = self.tokenizer.encode(text)
        self.assertIsInstance(tokens, list)
        self.assertGreater(len(tokens), 0)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_word(self):
        text = "人工智能"
        tokens = self.tokenizer.encode(text)
        self.assertIsInstance(tokens, list)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_sentence(self):
        text = "机器学习是人工智能的核心技术。"
        tokens = self.tokenizer.encode(text)
        self.assertIsInstance(tokens, list)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_punctuation(self):
        text = "你好，世界！"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_numbers(self):
        text = "2024年"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_newlines(self):
        text = "第一行\n第二行"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_spaces(self):
        text = "中文 文本"
        tokens = self.tokenizer.encode(text)
        
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_compression_ratio(self):
        text = "人工智能技术正在改变我们的生活方式，从智能手机到自动驾驶汽车，人工智能无处不在。"
        stats = self.tokenizer.get_token_stats(text)
        
        self.assertGreater(stats['compression_ratio'], 1.0)
        self.assertEqual(stats['detected_language'], 'zh')
    
    def test_empty_string(self):
        text = ""
        tokens = self.tokenizer.encode(text)
        self.assertEqual(tokens, [])
        
        decoded = self.tokenizer.decode([])
        self.assertEqual(decoded, "")
    
    def test_special_tokens_in_chinese(self):
        text = "这是中文文本"
        tokens = self.tokenizer.encode(text, add_special_tokens=True)
        
        self.assertIn(self.tokenizer.vocab.get("<|zh|>"), tokens)


class TestChineseRoundTrip(unittest.TestCase):
    
    def setUp(self):
        self.tokenizer = MultilingualBPETokenizer()
    
    def test_roundtrip_simple(self):
        texts = [
            "你好",
            "世界",
            "中国",
            "北京",
        ]
        
        for text in texts:
            with self.subTest(text=text):
                tokens = self.tokenizer.encode(text)
                decoded = self.tokenizer.decode(tokens)
                self.assertEqual(decoded, text)
    
    def test_roundtrip_sentences(self):
        texts = [
            "今天天气很好。",
            "我喜欢学习人工智能。",
            "机器学习是一门有趣的学科。",
        ]
        
        for text in texts:
            with self.subTest(text=text):
                tokens = self.tokenizer.encode(text)
                decoded = self.tokenizer.decode(tokens)
                self.assertEqual(decoded, text)
    
    def test_roundtrip_paragraph(self):
        text = """
        人工智能（Artificial Intelligence，简称AI）是计算机科学的一个分支，
        它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。
        该领域的研究包括机器人、语言识别、图像识别、自然语言处理和专家系统等。
        """
        
        tokens = self.tokenizer.encode(text)
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)


class TestChineseEdgeCases(unittest.TestCase):
    
    def setUp(self):
        self.tokenizer = MultilingualBPETokenizer()
    
    def test_rare_chinese_chars(self):
        text = "龘龘龘"
        tokens = self.tokenizer.encode(text)
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_with_fullwidth_chars(self):
        text = "ＡＢＣ中文"
        tokens = self.tokenizer.encode(text)
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)
    
    def test_chinese_idioms(self):
        idioms = [
            "画蛇添足",
            "守株待兔",
            "刻舟求剑",
            "掩耳盗铃",
        ]
        
        for idiom in idioms:
            with self.subTest(idiom=idiom):
                tokens = self.tokenizer.encode(idiom)
                decoded = self.tokenizer.decode(tokens)
                self.assertEqual(decoded, idiom)
    
    def test_long_chinese_text(self):
        text = "人工智能" * 100
        tokens = self.tokenizer.encode(text)
        decoded = self.tokenizer.decode(tokens)
        self.assertEqual(decoded, text)


if __name__ == "__main__":
    unittest.main(verbosity=2)

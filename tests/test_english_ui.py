"""
English UI Tests
英文界面测试
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import torch

from vision.multilingual_vit import MultilingualViT, ViTConfig
from vision.ocr_head import BilingualOCRHead, OCRConfig
from vision.synthetic_bilingual import (
    BilingualDataGenerator,
    SyntheticBilingualDataset,
    LAYOUT_TEMPLATES,
    CONTENT_LIBRARY,
)
from vision.language_adaptive_decoder import (
    LanguageAdaptiveDecoder,
    DescriptionGenerator,
    DocumentDescription,
)


class TestEnglishViT(unittest.TestCase):
    
    def setUp(self):
        self.config = ViTConfig(
            image_size=224,
            patch_size=16,
            hidden_size=512,
            num_hidden_layers=8,
            num_attention_heads=8,
        )
        self.model = MultilingualViT(self.config)
    
    def test_model_forward(self):
        dummy_input = torch.randn(2, 3, 224, 224)
        
        outputs = self.model(dummy_input)
        
        self.assertIn('hidden_states', outputs)
        self.assertIn('language_logits', outputs)
    
    def test_english_language_detection(self):
        dummy_input = torch.randn(1, 3, 224, 224)
        
        language = self.model.detect_language(dummy_input)
        
        self.assertIn(language, ["zh", "en", "mixed", "other"])


class TestEnglishOCR(unittest.TestCase):
    
    def setUp(self):
        self.config = OCRConfig()
        self.ocr_head = BilingualOCRHead(self.config)
    
    def test_text_detection(self):
        dummy_features = torch.randn(2, 512, 14, 14)
        
        outputs = self.ocr_head(dummy_features.permute(0, 3, 1, 2))
        
        self.assertIn('language_logits', outputs)
    
    def test_text_recognition(self):
        dummy_features = torch.randn(2, 512, 14, 14)
        
        recognized = self.ocr_head.recognize_text(dummy_features.permute(0, 3, 1, 2))
        
        self.assertEqual(recognized.shape[0], 2)


class TestEnglishDataGenerator(unittest.TestCase):
    
    def setUp(self):
        self.generator = BilingualDataGenerator()
    
    def test_generate_en_sample(self):
        sample = self.generator.generate_sample(language="en")
        
        self.assertEqual(sample.language, "en")
        self.assertIsNotNone(sample.title)
    
    def test_en_title_content(self):
        sample = self.generator.generate_sample(language="en")
        
        self.assertIn(sample.title, CONTENT_LIBRARY["title_en"])
    
    def test_en_ppt_sample(self):
        en_templates = [t for t in LAYOUT_TEMPLATES if t.language == "en"]
        
        self.assertGreater(len(en_templates), 0)
    
    def test_batch_generation_en(self):
        batch = self.generator.generate_batch(10, {"zh": 0.0, "en": 1.0, "mixed": 0.0})
        
        en_count = sum(1 for s in batch if s.language == "en")
        self.assertEqual(en_count, 10)


class TestEnglishDescriptionGenerator(unittest.TestCase):
    
    def setUp(self):
        self.decoder = LanguageAdaptiveDecoder()
        self.generator = DescriptionGenerator(self.decoder)
    
    def test_description_generation_en(self):
        dummy_features = torch.randn(1, 197, 512)
        
        description = self.generator.generate_description(
            visual_features=dummy_features,
            title="Artificial Intelligence Report",
            text_content="AI technology is developing rapidly...",
        )
        
        self.assertEqual(description.language, "en")
        self.assertEqual(description.title, "Artificial Intelligence Report")
    
    def test_json_output_en(self):
        description = DocumentDescription(
            language="en",
            layout="title-content single column",
            title="Test Report",
            sections=["Background", "Solution"],
            visual_elements=["chart"],
            text_content="Test content",
            suggested_prompt="Hand-drawn style, blue color scheme",
        )
        
        json_output = self.generator.to_json(description)
        
        self.assertIn("en", json_output)
        self.assertIn("Test Report", json_output)
    
    def test_layout_mapping_en(self):
        template = self.generator.language_templates["en"]
        
        self.assertEqual(template["layout_map"]["title_content"], "title-content single column")
        self.assertEqual(template["layout_map"]["two_column"], "title-two column")


class TestEnglishUIParsing(unittest.TestCase):
    
    def test_ui_template_detection(self):
        en_templates = [t for t in LAYOUT_TEMPLATES if t.language == "en"]
        
        layout_types = [t.layout_type for t in en_templates]
        
        self.assertIn("single_column", layout_types)
        self.assertIn("two_column", layout_types)
    
    def test_ui_content_extraction(self):
        generator = BilingualDataGenerator()
        
        sample = generator.generate_sample(language="en")
        
        self.assertIsNotNone(sample.sections)
    
    def test_ui_visual_elements(self):
        generator = BilingualDataGenerator()
        
        sample = generator.generate_sample(language="en")
        
        self.assertIsInstance(sample.visual_elements, list)


class TestEnglishDataset(unittest.TestCase):
    
    def test_dataset_creation_en(self):
        dataset = SyntheticBilingualDataset(num_samples=10)
        
        self.assertEqual(len(dataset), 10)
    
    def test_dataset_item_en(self):
        dataset = SyntheticBilingualDataset(num_samples=10)
        
        item = dataset[0]
        
        self.assertIn('image', item)
        self.assertIn('language_label', item)


class TestCrossLanguageSupport(unittest.TestCase):
    
    def test_mixed_language_sample(self):
        generator = BilingualDataGenerator()
        
        sample = generator.generate_sample(language="mixed")
        
        self.assertEqual(sample.language, "mixed")
    
    def test_language_switching(self):
        generator = DescriptionGenerator()
        
        zh_description = generator.generate_description(
            visual_features=torch.randn(1, 197, 512),
            title="中文标题",
            text_content="中文内容",
        )
        
        en_description = generator.generate_description(
            visual_features=torch.randn(1, 197, 512),
            title="English Title",
            text_content="English content",
        )
        
        self.assertEqual(zh_description.language, "zh")
        self.assertEqual(en_description.language, "en")


class TestEnglishEndToEnd(unittest.TestCase):
    
    def test_full_pipeline_en(self):
        config = ViTConfig()
        model = MultilingualViT(config)
        
        generator = BilingualDataGenerator()
        
        sample = generator.generate_sample(language="en")
        
        self.assertIsNotNone(sample)
        self.assertEqual(sample.language, "en")


if __name__ == "__main__":
    unittest.main(verbosity=2)

"""
Chinese PPT Parsing Tests
中文PPT解析测试
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import torch

from vision.multilingual_vit import MultilingualViT, ViTConfig, BilingualDocumentEncoder
from vision.ocr_head import BilingualOCRHead, OCRConfig, LightweightOCR
from vision.synthetic_bilingual import (
    BilingualDataGenerator,
    SyntheticBilingualDataset,
    LayoutTemplate,
    CONTENT_LIBRARY,
)
from vision.language_adaptive_decoder import (
    LanguageAdaptiveDecoder,
    DescriptionGenerator,
    DocumentDescription,
    Language,
)


class TestChineseViT(unittest.TestCase):
    
    def setUp(self):
        self.config = ViTConfig(
            image_size=224,
            patch_size=16,
            hidden_size=512,
            num_hidden_layers=8,
            num_attention_heads=8,
        )
        self.model = MultilingualViT(self.config)
    
    def test_model_initialization(self):
        self.assertIsNotNone(self.model)
        self.assertEqual(self.config.hidden_size, 512)
        self.assertEqual(self.config.num_hidden_layers, 8)
    
    def test_forward_pass(self):
        dummy_input = torch.randn(2, 3, 224, 224)
        
        outputs = self.model(dummy_input)
        
        self.assertIn('hidden_states', outputs)
        self.assertIn('language_logits', outputs)
        self.assertIn('layout_logits', outputs)
        
        self.assertEqual(outputs['hidden_states'].shape[0], 2)
        self.assertEqual(outputs['language_logits'].shape[-1], 4)
    
    def test_language_detection(self):
        dummy_input = torch.randn(1, 3, 224, 224)
        
        language = self.model.detect_language(dummy_input)
        
        self.assertIn(language, ["zh", "en", "mixed", "other"])
    
    def test_parameter_count(self):
        num_params = self.model.get_num_params()
        
        self.assertLess(num_params, 25_000_000)
        print(f"模型参数量: {num_params:,}")


class TestChineseOCRSystem(unittest.TestCase):
    
    def setUp(self):
        self.ocr_config = OCRConfig()
        self.ocr_head = BilingualOCRHead(self.ocr_config)
    
    def test_ocr_initialization(self):
        self.assertIsNotNone(self.ocr_head)
    
    def test_text_detection(self):
        dummy_features = torch.randn(2, 512, 14, 14)
        
        outputs = self.ocr_head(dummy_features.permute(0, 3, 1, 2))
        
        self.assertIn('language_logits', outputs)
        self.assertIn('layout_logits', outputs)
    
    def test_text_recognition(self):
        dummy_features = torch.randn(2, 512, 14, 14)
        
        recognized = self.ocr_head.recognize_text(dummy_features.permute(0, 3, 1, 2))
        
        self.assertEqual(recognized.shape[0], 2)
    
    def test_language_identification(self):
        dummy_features = torch.randn(2, 512, 14, 14)
        
        languages = self.ocr_head.identify_language(dummy_features.permute(0, 3, 1, 2))
        
        self.assertEqual(len(languages), 2)


class TestChineseDataGenerator(unittest.TestCase):
    
    def setUp(self):
        self.generator = BilingualDataGenerator()
    
    def test_generator_initialization(self):
        self.assertIsNotNone(self.generator)
        self.assertGreater(len(self.generator.templates), 0)
    
    def test_generate_zh_sample(self):
        sample = self.generator.generate_sample(language="zh")
        
        self.assertEqual(sample.language, "zh")
        self.assertIsNotNone(sample.title)
        self.assertIsNotNone(sample.text_content)
    
    def test_generate_zh_title_content(self):
        template = LayoutTemplate(
            name="title_content_zh",
            layout_type="single_column",
            regions=[
                {"name": "title", "type": "title_zh", "x": 0.1, "y": 0.1, "w": 0.8, "h": 0.1},
                {"name": "content", "type": "content_zh", "x": 0.1, "y": 0.25, "w": 0.8, "h": 0.6},
            ],
            language="zh",
        )
        
        sample = self.generator.generate_sample(language="zh", template=template)
        
        self.assertIsNotNone(sample)
        self.assertIn(sample.title, CONTENT_LIBRARY["title_zh"])
    
    def test_generate_ppt_sample(self):
        sample = self.generator.generate_sample(language="zh")
        
        self.assertIn("ppt", sample.layout_type.lower() if hasattr(sample, 'layout_type') else "")
    
    def test_batch_generation(self):
        batch = self.generator.generate_batch(10, {"zh": 0.7, "en": 0.2, "mixed": 0.1})
        
        self.assertEqual(len(batch), 10)
        
        zh_count = sum(1 for s in batch if s.language == "zh")
        self.assertGreater(zh_count, 5)


class TestChineseDescriptionGenerator(unittest.TestCase):
    
    def setUp(self):
        self.decoder = LanguageAdaptiveDecoder()
        self.generator = DescriptionGenerator(self.decoder)
    
    def test_description_generation_zh(self):
        dummy_features = torch.randn(1, 197, 512)
        
        description = self.generator.generate_description(
            visual_features=dummy_features,
            title="人工智能技术发展报告",
            text_content="人工智能技术正在快速发展...",
        )
        
        self.assertEqual(description.language, "zh")
        self.assertEqual(description.title, "人工智能技术发展报告")
        self.assertIsNotNone(description.layout)
        self.assertIsNotNone(description.sections)
    
    def test_json_output_zh(self):
        description = DocumentDescription(
            language="zh",
            layout="标题-正文单栏",
            title="测试报告",
            sections=["背景", "方案"],
            visual_elements=["图表"],
            text_content="测试内容",
            suggested_prompt="手绘风格，蓝色调",
        )
        
        json_output = self.generator.to_json(description)
        
        self.assertIn("zh", json_output)
        self.assertIn("测试报告", json_output)
    
    def test_layout_mapping_zh(self):
        template = self.generator.language_templates["zh"]
        
        self.assertIn("title_content", template["layout_map"])
        self.assertIn("two_column", template["layout_map"])
        
        self.assertEqual(template["layout_map"]["title_content"], "标题-正文单栏")
        self.assertEqual(template["layout_map"]["two_column"], "标题-双栏")


class TestChinesePPTParsing(unittest.TestCase):
    
    def test_ppt_title_extraction(self):
        from vision.synthetic_bilingual import LAYOUT_TEMPLATES
        
        ppt_templates = [t for t in LAYOUT_TEMPLATES if "ppt" in t.name.lower()]
        
        self.assertGreater(len(ppt_templates), 0)
        
        for template in ppt_templates:
            self.assertIn("title", [r["name"] for r in template.regions])
    
    def test_ppt_content_extraction(self):
        generator = BilingualDataGenerator()
        
        sample = generator.generate_sample(language="zh")
        
        self.assertIsNotNone(sample.sections)
        self.assertGreater(len(sample.sections), 0)
    
    def test_visual_element_detection(self):
        generator = BilingualDataGenerator()
        
        sample = generator.generate_sample(language="zh")
        
        self.assertIsInstance(sample.visual_elements, list)


class TestChineseDataset(unittest.TestCase):
    
    def test_dataset_creation(self):
        dataset = SyntheticBilingualDataset(num_samples=10)
        
        self.assertEqual(len(dataset), 10)
    
    def test_dataset_item(self):
        dataset = SyntheticBilingualDataset(num_samples=10)
        
        item = dataset[0]
        
        self.assertIn('image', item)
        self.assertIn('language_label', item)
        self.assertIn('title', item)
        
        self.assertEqual(item['language'], "zh")
    
    def test_image_shape(self):
        dataset = SyntheticBilingualDataset(num_samples=10)
        
        item = dataset[0]
        
        self.assertEqual(item['image'].shape[0], 3)
        self.assertEqual(item['image'].shape[1], 224)
        self.assertEqual(item['image'].shape[2], 224)


class TestChineseEndToEnd(unittest.TestCase):
    
    def test_full_pipeline(self):
        config = ViTConfig()
        model = MultilingualViT(config)
        
        generator = BilingualDataGenerator()
        
        sample = generator.generate_sample(language="zh")
        
        from PIL import Image
        import numpy as np
        
        if sample.image is not None:
            image_array = np.array(sample.image)
            image_tensor = torch.from_numpy(image_array).float().permute(2, 0, 1) / 255.0
            image_tensor = image_tensor.unsqueeze(0)
            
            outputs = model(image_tensor)
            
            self.assertIn('language_logits', outputs)
            
            language_idx = outputs['language_logits'].argmax(dim=-1).item()
            self.assertEqual(language_idx, 0)


class TestChineseEdgeCases(unittest.TestCase):
    
    def test_mixed_language_content(self):
        generator = BilingualDataGenerator()
        
        sample = generator.generate_sample(language="mixed")
        
        self.assertIsNotNone(sample)
        self.assertEqual(sample.language, "mixed")
    
    def test_empty_content(self):
        generator = DescriptionGenerator()
        
        description = generator.generate_description(
            visual_features=torch.randn(1, 197, 512),
            title="",
            text_content="",
        )
        
        self.assertIsNotNone(description.title)
        self.assertIsNotNone(description.text_content)
    
    def test_long_text_handling(self):
        generator = BilingualDataGenerator()
        
        long_text = "人工智能技术" * 100
        sample = generator.generate_sample(language="zh")
        sample.text_content = long_text
        
        self.assertGreater(len(sample.text_content), 100)


if __name__ == "__main__":
    unittest.main(verbosity=2)

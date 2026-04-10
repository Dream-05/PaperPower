"""
Cross-Lingual Search Tests
中英互搜测试
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import torch

from retrieval.bilingual_embedder import (
    BilingualEmbedder,
    CrossLingualEmbedder,
    EmbedderConfig,
    SymmetricInfoNCELoss,
    InfoNCELoss,
)
from retrieval.cross_lingual_index import (
    CrossLingualIndex,
    Document,
    SearchResult,
    VectorIndex,
    InvertedIndex,
    ParallelDocumentLinker,
)
from retrieval.query_router import (
    QueryRouter,
    QueryAnalyzer,
    LanguageDetector,
    Language,
    QueryAnalysis,
    RoutedQuery,
)


class TestLanguageDetector(unittest.TestCase):
    
    def setUp(self):
        self.detector = LanguageDetector()
    
    def test_detect_chinese(self):
        text = "人工智能技术正在快速发展"
        lang = self.detector.detect(text)
        self.assertEqual(lang, Language.CHINESE)
    
    def test_detect_english(self):
        text = "Artificial intelligence is developing rapidly"
        lang = self.detector.detect(text)
        self.assertEqual(lang, Language.ENGLISH)
    
    def test_detect_mixed(self):
        text = "AI技术正在快速发展"
        lang = self.detector.detect(text)
        self.assertEqual(lang, Language.MIXED)
    
    def test_get_language_stats(self):
        text = "AI技术"
        stats = self.detector.get_language_stats(text)
        
        self.assertIn('zh', stats)
        self.assertIn('en', stats)
        self.assertGreater(stats['zh'], 0)
        self.assertGreater(stats['en'], 0)


class TestQueryAnalyzer(unittest.TestCase):
    
    def setUp(self):
        self.analyzer = QueryAnalyzer()
    
    def test_analyze_chinese_query(self):
        query = "神经网络模型"
        analysis = self.analyzer.analyze(query)
        
        self.assertEqual(analysis.detected_language, Language.CHINESE)
        self.assertEqual(len(analysis.zh_components), 1)
        self.assertIn("神经网络模型", analysis.zh_components)
    
    def test_analyze_english_query(self):
        query = "neural network model"
        analysis = self.analyzer.analyze(query)
        
        self.assertEqual(analysis.detected_language, Language.ENGLISH)
        self.assertGreater(len(analysis.en_components), 0)
    
    def test_analyze_mixed_query(self):
        query = "Transformer模型在NLP中的应用"
        analysis = self.analyzer.analyze(query)
        
        self.assertEqual(analysis.detected_language, Language.MIXED)
        self.assertGreater(len(analysis.zh_components), 0)
        self.assertGreater(len(analysis.en_components), 0)


class TestQueryRouter(unittest.TestCase):
    
    def setUp(self):
        self.router = QueryRouter()
    
    def test_route_chinese_query(self):
        query = "深度学习"
        routed = self.router.route(query)
        
        self.assertEqual(routed.language, Language.CHINESE)
        self.assertIn('zh', routed.target_indexes)
        self.assertIn('en', routed.target_indexes)
        self.assertGreater(routed.boost_factors['zh'], routed.boost_factors['en'])
    
    def test_route_english_query(self):
        query = "deep learning"
        routed = self.router.route(query)
        
        self.assertEqual(routed.language, Language.ENGLISH)
        self.assertIn('zh', routed.target_indexes)
        self.assertIn('en', routed.target_indexes)
        self.assertGreater(routed.boost_factors['en'], routed.boost_factors['zh'])
    
    def test_route_mixed_query(self):
        query = "Attention机制在NLP中的应用"
        routed = self.router.route(query)
        
        self.assertEqual(routed.language, Language.MIXED)
        self.assertIn('zh', routed.target_indexes)
        self.assertIn('en', routed.target_indexes)


class TestBilingualEmbedder(unittest.TestCase):
    
    def setUp(self):
        self.config = EmbedderConfig(
            vocab_size=1000,
            hidden_size=128,
            num_hidden_layers=2,
        )
        self.model = BilingualEmbedder(self.config)
    
    def test_model_initialization(self):
        self.assertIsNotNone(self.model)
        self.assertEqual(self.config.hidden_size, 128)
    
    def test_forward_pass(self):
        input_ids = torch.randint(0, 1000, (2, 32))
        
        outputs = self.model(input_ids)
        
        self.assertIn('hidden_states', outputs)
        self.assertIn('pooled_output', outputs)
        self.assertEqual(outputs['pooled_output'].shape, (2, 128))
    
    def test_encode(self):
        input_ids = torch.randint(0, 1000, (2, 32))
        
        embeddings = self.model.encode(input_ids)
        
        self.assertEqual(embeddings.shape, (2, 128))
        
        norms = torch.norm(embeddings, dim=-1)
        self.assertTrue(torch.allclose(norms, torch.ones_like(norms), atol=1e-5))
    
    def test_language_detection(self):
        input_ids = torch.randint(0, 1000, (2, 32))
        
        languages = self.model.detect_language(input_ids)
        
        self.assertEqual(len(languages), 2)
        for lang in languages:
            self.assertIn(lang, ["zh", "en", "mixed", "unknown"])


class TestCrossLingualEmbedder(unittest.TestCase):
    
    def setUp(self):
        self.config = EmbedderConfig(
            vocab_size=1000,
            hidden_size=128,
            num_hidden_layers=2,
        )
        self.model = CrossLingualEmbedder(self.config)
    
    def test_cross_lingual_forward(self):
        input_ids = torch.randint(0, 1000, (2, 32))
        
        outputs = self.model(input_ids, language="zh")
        
        self.assertIn('aligned_output', outputs)
        self.assertEqual(outputs['aligned_output'].shape, (2, 128))
    
    def test_encode_cross_lingual(self):
        input_ids = torch.randint(0, 1000, (2, 32))
        
        zh_emb = self.model.encode_cross_lingual(input_ids, language="zh")
        en_emb = self.model.encode_cross_lingual(input_ids, language="en")
        
        self.assertEqual(zh_emb.shape, (2, 128))
        self.assertEqual(en_emb.shape, (2, 128))
    
    def test_similarity(self):
        emb1 = torch.randn(3, 128)
        emb2 = torch.randn(3, 128)
        
        similarity = self.model.similarity(emb1, emb2)
        
        self.assertEqual(similarity.shape, (3, 3))


class TestVectorIndex(unittest.TestCase):
    
    def setUp(self):
        self.index = VectorIndex(embedding_dim=128)
    
    def test_add_document(self):
        doc_id = "doc_1"
        embedding = np.random.randn(128).astype(np.float32)
        
        self.index.add_document(doc_id, embedding)
        
        self.assertIn(doc_id, self.index.embeddings)
    
    def test_search(self):
        for i in range(5):
            embedding = np.random.randn(128).astype(np.float32)
            self.index.add_document(f"doc_{i}", embedding)
        
        query = np.random.randn(128).astype(np.float32)
        results = self.index.search(query, top_k=3)
        
        self.assertEqual(len(results), 3)
        for doc_id, score in results:
            self.assertIn(doc_id, [f"doc_{i}" for i in range(5)])


class TestCrossLingualIndex(unittest.TestCase):
    
    def setUp(self):
        self.index = CrossLingualIndex(embedding_dim=128)
    
    def test_add_zh_document(self):
        embedding = np.random.randn(128).astype(np.float32)
        
        self.index.add_document(
            doc_id="zh_1",
            text="人工智能技术",
            language="zh",
            embedding=embedding,
        )
        
        stats = self.index.get_stats()
        self.assertEqual(stats['zh_documents'], 1)
    
    def test_add_en_document(self):
        embedding = np.random.randn(128).astype(np.float32)
        
        self.index.add_document(
            doc_id="en_1",
            text="Artificial intelligence technology",
            language="en",
            embedding=embedding,
        )
        
        stats = self.index.get_stats()
        self.assertEqual(stats['en_documents'], 1)
    
    def test_cross_lingual_search(self):
        zh_emb = np.random.randn(128).astype(np.float32)
        en_emb = np.random.randn(128).astype(np.float32)
        
        self.index.add_document("zh_1", "深度学习", "zh", zh_emb)
        self.index.add_document("en_1", "deep learning", "en", en_emb)
        
        query = np.random.randn(128).astype(np.float32)
        results = self.index.search(query, query_language="zh", top_k=2)
        
        self.assertEqual(len(results), 2)
    
    def test_parallel_link(self):
        zh_emb = np.random.randn(128).astype(np.float32)
        en_emb = np.random.randn(128).astype(np.float32)
        
        self.index.add_document("zh_1", "机器学习", "zh", zh_emb, parallel_doc_id="en_1")
        self.index.add_document("en_1", "machine learning", "en", en_emb)
        
        parallel = self.index.get_parallel_document("zh_1")
        
        self.assertIsNotNone(parallel)
        self.assertEqual(parallel.doc_id, "en_1")


class TestSymmetricInfoNCELoss(unittest.TestCase):
    
    def setUp(self):
        self.loss_fn = SymmetricInfoNCELoss(temperature=0.05)
    
    def test_loss_computation(self):
        zh_emb = torch.randn(4, 128)
        en_emb = torch.randn(4, 128)
        
        loss_dict = self.loss_fn(zh_emb, en_emb)
        
        self.assertIn('loss_zh', loss_dict)
        self.assertIn('loss_en', loss_dict)
        self.assertIn('total_loss', loss_dict)
        
        self.assertGreater(loss_dict['total_loss'].item(), 0)


class TestEndToEndSearch(unittest.TestCase):
    
    def test_full_pipeline(self):
        config = EmbedderConfig(
            vocab_size=1000,
            hidden_size=128,
            num_hidden_layers=2,
        )
        model = CrossLingualEmbedder(config)
        index = CrossLingualIndex(embedding_dim=128)
        
        zh_docs = [
            ("zh_1", "人工智能技术正在快速发展"),
            ("zh_2", "机器学习是人工智能的核心"),
        ]
        
        en_docs = [
            ("en_1", "Artificial intelligence is developing rapidly"),
            ("en_2", "Machine learning is the core of AI"),
        ]
        
        for doc_id, text in zh_docs:
            input_ids = torch.randint(0, 1000, (1, 32))
            with torch.no_grad():
                embedding = model.encode_cross_lingual(input_ids, language="zh").numpy()[0]
            index.add_document(doc_id, text, "zh", embedding)
        
        for doc_id, text in en_docs:
            input_ids = torch.randint(0, 1000, (1, 32))
            with torch.no_grad():
                embedding = model.encode_cross_lingual(input_ids, language="en").numpy()[0]
            index.add_document(doc_id, text, "en", embedding)
        
        query_input = torch.randint(0, 1000, (1, 32))
        with torch.no_grad():
            query_emb = model.encode_cross_lingual(query_input, language="zh").numpy()[0]
        
        results = index.search(query_emb, query_language="zh", top_k=4)
        
        self.assertEqual(len(results), 4)


if __name__ == "__main__":
    unittest.main(verbosity=2)

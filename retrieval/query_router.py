"""
Query Router
语言检测+路由 - 智能处理混合查询
"""

import re
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from enum import Enum
import numpy as np


class Language(Enum):
    CHINESE = "zh"
    ENGLISH = "en"
    MIXED = "mixed"
    OTHER = "other"


@dataclass
class QueryAnalysis:
    original_query: str
    detected_language: Language
    zh_components: List[str]
    en_components: List[str]
    tokens: List[str]
    confidence: float


@dataclass
class RoutedQuery:
    query: str
    language: Language
    target_indexes: List[str]
    boost_factors: Dict[str, float]
    query_components: Dict[str, List[str]]


class LanguageDetector:
    CJK_PATTERN = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf]')
    LATIN_PATTERN = re.compile(r'[a-zA-Z]')
    
    def __init__(self):
        self._compile_patterns()
    
    def _compile_patterns(self):
        self.chinese_word_pattern = re.compile(r'[\u4e00-\u9fff]+')
        self.english_word_pattern = re.compile(r'[a-zA-Z]+')
        self.number_pattern = re.compile(r'\d+')
        self.punctuation_pattern = re.compile(r'[，。！？；：""''（）（）【】《》、·…—～.,!?;:\'"()\[\]{}<>]')
    
    def detect(self, text: str) -> Language:
        if not text:
            return Language.OTHER
        
        cjk_chars = len(self.CJK_PATTERN.findall(text))
        latin_chars = len(self.LATIN_PATTERN.findall(text))
        
        total_alpha = cjk_chars + latin_chars
        
        if total_alpha == 0:
            return Language.OTHER
        
        cjk_ratio = cjk_chars / total_alpha
        latin_ratio = latin_chars / total_alpha
        
        if cjk_ratio > 0.7:
            return Language.CHINESE
        elif latin_ratio > 0.7:
            return Language.ENGLISH
        elif cjk_ratio > 0.1 and latin_ratio > 0.1:
            return Language.MIXED
        elif cjk_ratio > latin_ratio:
            return Language.CHINESE
        else:
            return Language.ENGLISH
    
    def get_language_stats(self, text: str) -> Dict[str, float]:
        if not text:
            return {'zh': 0.0, 'en': 0.0, 'other': 1.0}
        
        cjk_chars = len(self.CJK_PATTERN.findall(text))
        latin_chars = len(self.LATIN_PATTERN.findall(text))
        total_chars = len(text)
        
        return {
            'zh': cjk_chars / total_chars if total_chars > 0 else 0.0,
            'en': latin_chars / total_chars if total_chars > 0 else 0.0,
            'other': (total_chars - cjk_chars - latin_chars) / total_chars if total_chars > 0 else 0.0,
        }


class QueryAnalyzer:
    def __init__(self):
        self.language_detector = LanguageDetector()
        
        self.technical_terms = {
            'zh': ['神经网络', '深度学习', '机器学习', '自然语言处理', '计算机视觉', '人工智能', '算法', '模型', '训练', '推理'],
            'en': ['neural network', 'deep learning', 'machine learning', 'NLP', 'computer vision', 'AI', 'algorithm', 'model', 'training', 'inference'],
        }
        
        self.term_translations = {
            '神经网络': 'neural network',
            '深度学习': 'deep learning',
            '机器学习': 'machine learning',
            '自然语言处理': 'NLP',
            '计算机视觉': 'computer vision',
            '人工智能': 'AI',
            '算法': 'algorithm',
            '模型': 'model',
            '训练': 'training',
            '推理': 'inference',
        }
    
    def analyze(self, query: str) -> QueryAnalysis:
        language = self.language_detector.detect(query)
        
        zh_components = self._extract_chinese_components(query)
        en_components = self._extract_english_components(query)
        
        tokens = self._tokenize(query, language)
        
        confidence = self._calculate_confidence(query, language)
        
        return QueryAnalysis(
            original_query=query,
            detected_language=language,
            zh_components=zh_components,
            en_components=en_components,
            tokens=tokens,
            confidence=confidence,
        )
    
    def _extract_chinese_components(self, query: str) -> List[str]:
        pattern = re.compile(r'[\u4e00-\u9fff]+')
        return pattern.findall(query)
    
    def _extract_english_components(self, query: str) -> List[str]:
        pattern = re.compile(r'[a-zA-Z]+')
        return pattern.findall(query)
    
    def _tokenize(self, query: str, language: Language) -> List[str]:
        tokens = []
        
        if language == Language.CHINESE:
            tokens = list(query)
        elif language == Language.ENGLISH:
            tokens = query.lower().split()
        else:
            zh_parts = self._extract_chinese_components(query)
            en_parts = self._extract_english_components(query)
            
            for part in zh_parts:
                tokens.extend(list(part))
            
            for part in en_parts:
                tokens.append(part.lower())
        
        return tokens
    
    def _calculate_confidence(self, query: str, language: Language) -> float:
        stats = self.language_detector.get_language_stats(query)
        
        if language == Language.CHINESE:
            return stats['zh']
        elif language == Language.ENGLISH:
            return stats['en']
        elif language == Language.MIXED:
            return min(stats['zh'], stats['en']) * 2
        else:
            return 0.5


class QueryRouter:
    def __init__(self):
        self.analyzer = QueryAnalyzer()
        
        self.routing_strategies = {
            Language.CHINESE: self._route_chinese,
            Language.ENGLISH: self._route_english,
            Language.MIXED: self._route_mixed,
            Language.OTHER: self._route_other,
        }
    
    def route(self, query: str) -> RoutedQuery:
        analysis = self.analyzer.analyze(query)
        
        strategy = self.routing_strategies.get(analysis.detected_language, self._route_other)
        
        return strategy(analysis)
    
    def _route_chinese(self, analysis: QueryAnalysis) -> RoutedQuery:
        return RoutedQuery(
            query=analysis.original_query,
            language=Language.CHINESE,
            target_indexes=['zh', 'en'],
            boost_factors={'zh': 1.0, 'en': 0.85},
            query_components={
                'zh': analysis.zh_components,
                'en': self._translate_components(analysis.zh_components),
            },
        )
    
    def _route_english(self, analysis: QueryAnalysis) -> RoutedQuery:
        return RoutedQuery(
            query=analysis.original_query,
            language=Language.ENGLISH,
            target_indexes=['en', 'zh'],
            boost_factors={'en': 1.0, 'zh': 0.85},
            query_components={
                'en': analysis.en_components,
                'zh': self._translate_components_en_to_zh(analysis.en_components),
            },
        )
    
    def _route_mixed(self, analysis: QueryAnalysis) -> RoutedQuery:
        zh_weight = len(''.join(analysis.zh_components)) / max(len(analysis.original_query), 1)
        en_weight = len(' '.join(analysis.en_components)) / max(len(analysis.original_query), 1)
        
        total_weight = zh_weight + en_weight
        zh_weight = zh_weight / total_weight if total_weight > 0 else 0.5
        en_weight = en_weight / total_weight if total_weight > 0 else 0.5
        
        return RoutedQuery(
            query=analysis.original_query,
            language=Language.MIXED,
            target_indexes=['zh', 'en'],
            boost_factors={'zh': zh_weight, 'en': en_weight},
            query_components={
                'zh': analysis.zh_components,
                'en': analysis.en_components,
            },
        )
    
    def _route_other(self, analysis: QueryAnalysis) -> RoutedQuery:
        return RoutedQuery(
            query=analysis.original_query,
            language=Language.OTHER,
            target_indexes=['zh', 'en'],
            boost_factors={'zh': 0.5, 'en': 0.5},
            query_components={
                'zh': [],
                'en': analysis.tokens,
            },
        )
    
    def _translate_components(self, zh_components: List[str]) -> List[str]:
        translated = []
        for component in zh_components:
            if component in self.analyzer.term_translations:
                translated.append(self.analyzer.term_translations[component])
        return translated
    
    def _translate_components_en_to_zh(self, en_components: List[str]) -> List[str]:
        reverse_translations = {v: k for k, v in self.analyzer.term_translations.items()}
        translated = []
        for component in en_components:
            lower_component = component.lower()
            if lower_component in reverse_translations:
                translated.append(reverse_translations[lower_component])
        return translated


class CrossLingualSearchEngine:
    def __init__(self, embedder, index):
        self.embedder = embedder
        self.index = index
        self.router = QueryRouter()
    
    def search(
        self,
        query: str,
        top_k: int = 10,
        include_parallel: bool = True,
    ) -> List[Dict[str, Any]]:
        routed_query = self.router.route(query)
        
        query_embedding = self._encode_query(query, routed_query.language)
        
        results = self.index.search(
            query_embedding=query_embedding,
            query_language=routed_query.language.value,
            top_k=top_k * 2,
            include_parallel=include_parallel,
        )
        
        scored_results = []
        for result in results:
            boost = routed_query.boost_factors.get(result.language, 1.0)
            adjusted_score = result.score * boost
            
            scored_results.append({
                'doc_id': result.doc_id,
                'text': result.text,
                'language': result.language,
                'score': adjusted_score,
                'original_score': result.score,
                'metadata': result.metadata,
            })
        
        scored_results.sort(key=lambda x: x['score'], reverse=True)
        
        return scored_results[:top_k]
    
    def _encode_query(self, query: str, language: Language) -> np.ndarray:
        import torch
        
        tokens = query.lower().split() if language == Language.ENGLISH else list(query)
        
        token_ids = [hash(t) % 50000 for t in tokens]
        
        while len(token_ids) < 32:
            token_ids.append(0)
        token_ids = token_ids[:32]
        
        input_ids = torch.tensor([token_ids])
        
        with torch.no_grad():
            embedding = self.embedder.encode_cross_lingual(
                input_ids,
                language=language.value if language != Language.OTHER else None,
            )
        
        return embedding.numpy()[0]
    
    def search_with_translation(
        self,
        query: str,
        target_language: Optional[str] = None,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        results = self.search(query, top_k=top_k)
        
        if target_language:
            filtered_results = [r for r in results if r['language'] == target_language]
            if filtered_results:
                return filtered_results
        
        return results


def create_router() -> QueryRouter:
    return QueryRouter()


def create_search_engine(embedder, index) -> CrossLingualSearchEngine:
    return CrossLingualSearchEngine(embedder, index)


if __name__ == "__main__":
    router = QueryRouter()
    
    queries = [
        "神经网络",
        "Transformer architecture",
        "Attention机制在NLP中的应用",
        "机器学习model training",
    ]
    
    for query in queries:
        routed = router.route(query)
        print(f"\n查询: {query}")
        print(f"  检测语言: {routed.language.value}")
        print(f"  目标索引: {routed.target_indexes}")
        print(f"  提升因子: {routed.boost_factors}")
        print(f"  中文组件: {routed.query_components.get('zh', [])}")
        print(f"  英文组件: {routed.query_components.get('en', [])}")

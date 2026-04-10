"""
Retrieval Package
跨语言语义检索引擎 - 支持中英跨语言检索
"""

from .bilingual_embedder import (
    BilingualEmbedder,
    CrossLingualEmbedder,
    EmbedderConfig,
    TransformerEmbeddings,
    SelfAttention,
    TransformerLayer,
    InfoNCELoss,
    SymmetricInfoNCELoss,
    create_embedder,
    create_cross_lingual_embedder,
)

from .cross_lingual_index import (
    CrossLingualIndex,
    Document,
    SearchResult,
    VectorIndex,
    InvertedIndex,
    ParallelDocumentLinker,
    HybridIndex,
    create_index,
    create_hybrid_index,
)

from .query_router import (
    QueryRouter,
    QueryAnalyzer,
    LanguageDetector,
    Language,
    QueryAnalysis,
    RoutedQuery,
    CrossLingualSearchEngine,
    create_router,
    create_search_engine,
)

from .align_trainer import (
    AlignmentTrainer,
    TrainingConfig,
    ParallelPair,
    MonolingualPair,
    HardNegative,
    ParallelDataset,
    MonolingualDataset,
    create_trainer,
    generate_sample_data,
)

__all__ = [
    'BilingualEmbedder',
    'CrossLingualEmbedder',
    'EmbedderConfig',
    'TransformerEmbeddings',
    'SelfAttention',
    'TransformerLayer',
    'InfoNCELoss',
    'SymmetricInfoNCELoss',
    'create_embedder',
    'create_cross_lingual_embedder',
    'CrossLingualIndex',
    'Document',
    'SearchResult',
    'VectorIndex',
    'InvertedIndex',
    'ParallelDocumentLinker',
    'HybridIndex',
    'create_index',
    'create_hybrid_index',
    'QueryRouter',
    'QueryAnalyzer',
    'LanguageDetector',
    'Language',
    'QueryAnalysis',
    'RoutedQuery',
    'CrossLingualSearchEngine',
    'create_router',
    'create_search_engine',
    'AlignmentTrainer',
    'TrainingConfig',
    'ParallelPair',
    'MonolingualPair',
    'HardNegative',
    'ParallelDataset',
    'MonolingualDataset',
    'create_trainer',
    'generate_sample_data',
]

__version__ = '1.0.0'

"""
Cross-Lingual Index
统一索引管理 - 支持中英跨语言检索
"""

import json
import pickle
import numpy as np
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass, field
from pathlib import Path
from collections import defaultdict
import heapq

import torch
import torch.nn.functional as F


@dataclass
class Document:
    doc_id: str
    text: str
    language: str
    embedding: Optional[np.ndarray] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'doc_id': self.doc_id,
            'text': self.text,
            'language': self.language,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Document':
        return cls(
            doc_id=data['doc_id'],
            text=data['text'],
            language=data['language'],
            metadata=data.get('metadata', {}),
        )


@dataclass
class SearchResult:
    doc_id: str
    text: str
    language: str
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class InvertedIndex:
    def __init__(self):
        self.index: Dict[str, List[str]] = defaultdict(list)
        self.doc_tokens: Dict[str, List[str]] = {}
    
    def add_document(self, doc_id: str, tokens: List[str]):
        self.doc_tokens[doc_id] = tokens
        
        for token in tokens:
            if doc_id not in self.index[token]:
                self.index[token].append(doc_id)
    
    def remove_document(self, doc_id: str):
        if doc_id in self.doc_tokens:
            tokens = self.doc_tokens[doc_id]
            for token in tokens:
                if token in self.index and doc_id in self.index[token]:
                    self.index[token].remove(doc_id)
                    if not self.index[token]:
                        del self.index[token]
            del self.doc_tokens[doc_id]
    
    def search(self, query_tokens: List[str]) -> List[str]:
        doc_scores: Dict[str, int] = defaultdict(int)
        
        for token in query_tokens:
            if token in self.index:
                for doc_id in self.index[token]:
                    doc_scores[doc_id] += 1
        
        sorted_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)
        return [doc_id for doc_id, _ in sorted_docs]


class VectorIndex:
    def __init__(self, embedding_dim: int = 384):
        self.embedding_dim = embedding_dim
        self.embeddings: Dict[str, np.ndarray] = {}
        self.doc_ids: List[str] = []
        self._embedding_matrix: Optional[np.ndarray] = None
        self._needs_rebuild = True
    
    def add_document(self, doc_id: str, embedding: np.ndarray):
        if embedding.shape[0] != self.embedding_dim:
            raise ValueError(f"Embedding dimension mismatch: {embedding.shape[0]} vs {self.embedding_dim}")
        
        self.embeddings[doc_id] = embedding
        self._needs_rebuild = True
    
    def remove_document(self, doc_id: str):
        if doc_id in self.embeddings:
            del self.embeddings[doc_id]
            self._needs_rebuild = True
    
    def _rebuild_matrix(self):
        self.doc_ids = list(self.embeddings.keys())
        if self.doc_ids:
            self._embedding_matrix = np.stack([self.embeddings[doc_id] for doc_id in self.doc_ids])
        else:
            self._embedding_matrix = None
        self._needs_rebuild = False
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
    ) -> List[Tuple[str, float]]:
        if self._needs_rebuild:
            self._rebuild_matrix()
        
        if self._embedding_matrix is None or len(self.doc_ids) == 0:
            return []
        
        query_embedding = query_embedding / (np.linalg.norm(query_embedding) + 1e-9)
        
        norms = np.linalg.norm(self._embedding_matrix, axis=1, keepdims=True) + 1e-9
        normalized_matrix = self._embedding_matrix / norms
        
        similarities = np.dot(normalized_matrix, query_embedding)
        
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = [(self.doc_ids[i], similarities[i]) for i in top_indices]
        
        return results


class ParallelDocumentLinker:
    def __init__(self):
        self.links: Dict[str, str] = {}
        self.reverse_links: Dict[str, str] = {}
    
    def add_link(self, zh_doc_id: str, en_doc_id: str):
        self.links[zh_doc_id] = en_doc_id
        self.reverse_links[en_doc_id] = zh_doc_id
    
    def remove_link(self, doc_id: str):
        if doc_id in self.links:
            linked_id = self.links[doc_id]
            del self.links[doc_id]
            if linked_id in self.reverse_links:
                del self.reverse_links[linked_id]
        
        if doc_id in self.reverse_links:
            linked_id = self.reverse_links[doc_id]
            del self.reverse_links[doc_id]
            if linked_id in self.links:
                del self.links[linked_id]
    
    def get_parallel_doc(self, doc_id: str) -> Optional[str]:
        return self.links.get(doc_id) or self.reverse_links.get(doc_id)


class CrossLingualIndex:
    def __init__(self, embedding_dim: int = 384):
        self.embedding_dim = embedding_dim
        
        self.documents: Dict[str, Document] = {}
        
        self.zh_index = VectorIndex(embedding_dim)
        self.en_index = VectorIndex(embedding_dim)
        
        self.inverted_index = InvertedIndex()
        
        self.parallel_linker = ParallelDocumentLinker()
        
        self.language_stats = {"zh": 0, "en": 0, "mixed": 0}
    
    def add_document(
        self,
        doc_id: str,
        text: str,
        language: str,
        embedding: np.ndarray,
        metadata: Optional[Dict[str, Any]] = None,
        parallel_doc_id: Optional[str] = None,
    ):
        doc = Document(
            doc_id=doc_id,
            text=text,
            language=language,
            embedding=embedding,
            metadata=metadata or {},
        )
        
        self.documents[doc_id] = doc
        
        if language == "zh":
            self.zh_index.add_document(doc_id, embedding)
        elif language == "en":
            self.en_index.add_document(doc_id, embedding)
        else:
            self.zh_index.add_document(doc_id, embedding)
            self.en_index.add_document(doc_id, embedding)
        
        tokens = text.lower().split()
        self.inverted_index.add_document(doc_id, tokens)
        
        self.language_stats[language] = self.language_stats.get(language, 0) + 1
        
        if parallel_doc_id:
            if language == "zh":
                self.parallel_linker.add_link(doc_id, parallel_doc_id)
            else:
                self.parallel_linker.add_link(parallel_doc_id, doc_id)
    
    def remove_document(self, doc_id: str):
        if doc_id not in self.documents:
            return
        
        doc = self.documents[doc_id]
        
        if doc.language == "zh":
            self.zh_index.remove_document(doc_id)
        elif doc.language == "en":
            self.en_index.remove_document(doc_id)
        else:
            self.zh_index.remove_document(doc_id)
            self.en_index.remove_document(doc_id)
        
        self.inverted_index.remove_document(doc_id)
        self.parallel_linker.remove_link(doc_id)
        
        self.language_stats[doc.language] = max(0, self.language_stats.get(doc.language, 0) - 1)
        
        del self.documents[doc_id]
    
    def search(
        self,
        query_embedding: np.ndarray,
        query_language: Optional[str] = None,
        top_k: int = 10,
        include_parallel: bool = True,
    ) -> List[SearchResult]:
        results: Dict[str, float] = {}
        
        if query_language == "zh":
            zh_results = self.zh_index.search(query_embedding, top_k * 2)
            for doc_id, score in zh_results:
                results[doc_id] = max(results.get(doc_id, 0), score)
            
            en_results = self.en_index.search(query_embedding, top_k)
            for doc_id, score in en_results:
                results[doc_id] = max(results.get(doc_id, 0), score * 0.9)
        
        elif query_language == "en":
            en_results = self.en_index.search(query_embedding, top_k * 2)
            for doc_id, score in en_results:
                results[doc_id] = max(results.get(doc_id, 0), score)
            
            zh_results = self.zh_index.search(query_embedding, top_k)
            for doc_id, score in zh_results:
                results[doc_id] = max(results.get(doc_id, 0), score * 0.9)
        
        else:
            zh_results = self.zh_index.search(query_embedding, top_k)
            en_results = self.en_index.search(query_embedding, top_k)
            
            for doc_id, score in zh_results:
                results[doc_id] = score
            for doc_id, score in en_results:
                results[doc_id] = max(results.get(doc_id, 0), score)
        
        sorted_results = sorted(results.items(), key=lambda x: x[1], reverse=True)[:top_k]
        
        search_results = []
        for doc_id, score in sorted_results:
            if doc_id in self.documents:
                doc = self.documents[doc_id]
                
                result = SearchResult(
                    doc_id=doc_id,
                    text=doc.text,
                    language=doc.language,
                    score=score,
                    metadata=doc.metadata.copy(),
                )
                
                if include_parallel:
                    parallel_id = self.parallel_linker.get_parallel_doc(doc_id)
                    if parallel_id and parallel_id in self.documents:
                        result.metadata['parallel_doc_id'] = parallel_id
                
                search_results.append(result)
        
        return search_results
    
    def search_by_text(
        self,
        query_tokens: List[str],
        language: Optional[str] = None,
    ) -> List[str]:
        return self.inverted_index.search(query_tokens)
    
    def get_document(self, doc_id: str) -> Optional[Document]:
        return self.documents.get(doc_id)
    
    def get_parallel_document(self, doc_id: str) -> Optional[Document]:
        parallel_id = self.parallel_linker.get_parallel_doc(doc_id)
        if parallel_id:
            return self.documents.get(parallel_id)
        return None
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            'total_documents': len(self.documents),
            'zh_documents': self.language_stats.get('zh', 0),
            'en_documents': self.language_stats.get('en', 0),
            'mixed_documents': self.language_stats.get('mixed', 0),
            'parallel_links': len(self.parallel_linker.links),
        }
    
    def save(self, path: Union[str, Path]):
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        
        docs_data = {doc_id: doc.to_dict() for doc_id, doc in self.documents.items()}
        with open(path / "documents.json", 'w', encoding='utf-8') as f:
            json.dump(docs_data, f, ensure_ascii=False, indent=2)
        
        embeddings_data = {doc_id: doc.embedding.tolist() for doc_id, doc in self.documents.items() if doc.embedding is not None}
        with open(path / "embeddings.pkl", 'wb') as f:
            pickle.dump(embeddings_data, f)
        
        links_data = {
            'links': self.parallel_linker.links,
            'reverse_links': self.parallel_linker.reverse_links,
        }
        with open(path / "parallel_links.json", 'w') as f:
            json.dump(links_data, f)
    
    def load(self, path: Union[str, Path]):
        path = Path(path)
        
        with open(path / "documents.json", 'r', encoding='utf-8') as f:
            docs_data = json.load(f)
        
        with open(path / "embeddings.pkl", 'rb') as f:
            embeddings_data = pickle.load(f)
        
        for doc_id, doc_dict in docs_data.items():
            embedding = np.array(embeddings_data.get(doc_id, []))
            doc = Document(
                doc_id=doc_dict['doc_id'],
                text=doc_dict['text'],
                language=doc_dict['language'],
                embedding=embedding if len(embedding) > 0 else None,
                metadata=doc_dict.get('metadata', {}),
            )
            self.documents[doc_id] = doc
            
            if doc.language == "zh":
                self.zh_index.add_document(doc_id, embedding)
            elif doc.language == "en":
                self.en_index.add_document(doc_id, embedding)
            
            tokens = doc.text.lower().split()
            self.inverted_index.add_document(doc_id, tokens)
        
        with open(path / "parallel_links.json", 'r') as f:
            links_data = json.load(f)
        
        self.parallel_linker.links = links_data.get('links', {})
        self.parallel_linker.reverse_links = links_data.get('reverse_links', {})
        
        self._update_stats()
    
    def _update_stats(self):
        self.language_stats = {"zh": 0, "en": 0, "mixed": 0}
        for doc in self.documents.values():
            self.language_stats[doc.language] = self.language_stats.get(doc.language, 0) + 1


class HybridIndex:
    def __init__(self, embedding_dim: int = 384, alpha: float = 0.7):
        self.vector_index = CrossLingualIndex(embedding_dim)
        self.alpha = alpha
    
    def add_document(
        self,
        doc_id: str,
        text: str,
        language: str,
        embedding: np.ndarray,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.vector_index.add_document(doc_id, text, language, embedding, metadata)
    
    def search(
        self,
        query_embedding: np.ndarray,
        query_tokens: List[str],
        query_language: Optional[str] = None,
        top_k: int = 10,
    ) -> List[SearchResult]:
        vector_results = self.vector_index.search(query_embedding, query_language, top_k * 2)
        
        token_results = self.vector_index.search_by_text(query_tokens, query_language)
        
        vector_scores = {r.doc_id: r.score for r in vector_results}
        
        max_token_score = len(token_results) if token_results else 1
        token_scores = {doc_id: (max_token_score - i) / max_token_score for i, doc_id in enumerate(token_results)}
        
        all_doc_ids = set(vector_scores.keys()) | set(token_scores.keys())
        
        combined_scores = {}
        for doc_id in all_doc_ids:
            v_score = vector_scores.get(doc_id, 0)
            t_score = token_scores.get(doc_id, 0)
            combined_scores[doc_id] = self.alpha * v_score + (1 - self.alpha) * t_score
        
        sorted_doc_ids = sorted(combined_scores.keys(), key=lambda x: combined_scores[x], reverse=True)[:top_k]
        
        results = []
        for doc_id in sorted_doc_ids:
            doc = self.vector_index.get_document(doc_id)
            if doc:
                results.append(SearchResult(
                    doc_id=doc_id,
                    text=doc.text,
                    language=doc.language,
                    score=combined_scores[doc_id],
                    metadata=doc.metadata,
                ))
        
        return results


def create_index(embedding_dim: int = 384) -> CrossLingualIndex:
    return CrossLingualIndex(embedding_dim)


def create_hybrid_index(embedding_dim: int = 384, alpha: float = 0.7) -> HybridIndex:
    return HybridIndex(embedding_dim, alpha)


if __name__ == "__main__":
    index = create_index(embedding_dim=384)
    
    zh_docs = [
        ("zh_1", "人工智能技术正在快速发展", "zh"),
        ("zh_2", "机器学习是人工智能的核心", "zh"),
        ("zh_3", "深度学习模型需要大量数据", "zh"),
    ]
    
    en_docs = [
        ("en_1", "Artificial intelligence is developing rapidly", "en"),
        ("en_2", "Machine learning is the core of AI", "en"),
        ("en_3", "Deep learning models need large data", "en"),
    ]
    
    for doc_id, text, lang in zh_docs:
        embedding = np.random.randn(384).astype(np.float32)
        index.add_document(doc_id, text, lang, embedding)
    
    for doc_id, text, lang in en_docs:
        embedding = np.random.randn(384).astype(np.float32)
        index.add_document(doc_id, text, lang, embedding)
    
    index.parallel_linker.add_link("zh_1", "en_1")
    index.parallel_linker.add_link("zh_2", "en_2")
    
    print("索引统计:", index.get_stats())
    
    query_emb = np.random.randn(384).astype(np.float32)
    results = index.search(query_emb, query_language="zh", top_k=5)
    
    print("\n搜索结果:")
    for r in results:
        print(f"  {r.doc_id} ({r.language}): {r.text[:30]}... (score: {r.score:.4f})")
    
    parallel = index.get_parallel_document("zh_1")
    if parallel:
        print(f"\nzh_1的平行文档: {parallel.doc_id} - {parallel.text}")

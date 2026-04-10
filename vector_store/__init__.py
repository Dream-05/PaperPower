"""
FAISS向量数据库 - 零成本实现
Facebook AI Similarity Search，完全本地化，支持百万级向量检索
"""

import os
import json
import pickle
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("警告: FAISS未安装，使用纯NumPy实现。建议安装: pip install faiss-cpu")


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
            'metadata': self.metadata
        }


@dataclass
class SearchResult:
    doc_id: str
    text: str
    language: str
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class FAISSVectorStore:
    """FAISS向量存储 - 高性能向量检索"""
    
    def __init__(
        self,
        embedding_dim: int = 384,
        index_type: str = "ivf",
        nlist: int = 100,
        storage_path: str = None
    ):
        self.embedding_dim = embedding_dim
        self.index_type = index_type
        self.nlist = nlist
        self.storage_path = storage_path or "data/vectors"
        
        self.documents: Dict[str, Document] = {}
        self.doc_id_to_idx: Dict[str, int] = {}
        self.idx_to_doc_id: Dict[int, str] = {}
        self._next_idx = 0
        
        self._init_index()
    
    def _init_index(self):
        """初始化FAISS索引"""
        if FAISS_AVAILABLE:
            if self.index_type == "flat":
                self.index = faiss.IndexFlatIP(self.embedding_dim)
            elif self.index_type == "ivf":
                quantizer = faiss.IndexFlatIP(self.embedding_dim)
                self.index = faiss.IndexIVFFlat(
                    quantizer, 
                    self.embedding_dim, 
                    self.nlist,
                    faiss.METRIC_INNER_PRODUCT
                )
                self._index_trained = False
            elif self.index_type == "hnsw":
                self.index = faiss.IndexHNSWFlat(self.embedding_dim, 32)
            else:
                self.index = faiss.IndexFlatIP(self.embedding_dim)
        else:
            self.index = None
            self.embeddings_matrix = None
    
    def add_document(
        self,
        doc_id: str,
        text: str,
        embedding: np.ndarray,
        language: str = "zh",
        metadata: Dict[str, Any] = None
    ):
        """添加文档"""
        if embedding.shape[0] != self.embedding_dim:
            raise ValueError(f"嵌入维度不匹配: {embedding.shape[0]} vs {self.embedding_dim}")
        
        embedding = embedding.astype(np.float32)
        if embedding.ndim == 1:
            embedding = embedding.reshape(1, -1)
        
        if FAISS_AVAILABLE:
            if self.index_type == "ivf" and not getattr(self, '_index_trained', True):
                if self.index.ntotal == 0:
                    self.index.train(embedding)
                self._index_trained = True
            
            if self.index_type == "ivf" and not self.index.is_trained:
                train_data = np.random.randn(1000, self.embedding_dim).astype(np.float32)
                self.index.train(train_data)
            
            self.index.add(embedding)
        else:
            if self.embeddings_matrix is None:
                self.embeddings_matrix = embedding
            else:
                self.embeddings_matrix = np.vstack([self.embeddings_matrix, embedding])
        
        doc = Document(
            doc_id=doc_id,
            text=text,
            language=language,
            embedding=embedding.flatten(),
            metadata=metadata or {}
        )
        
        self.documents[doc_id] = doc
        self.doc_id_to_idx[doc_id] = self._next_idx
        self.idx_to_doc_id[self._next_idx] = doc_id
        self._next_idx += 1
    
    def add_documents_batch(
        self,
        doc_ids: List[str],
        texts: List[str],
        embeddings: np.ndarray,
        languages: List[str] = None,
        metadata_list: List[Dict] = None
    ):
        """批量添加文档"""
        embeddings = embeddings.astype(np.float32)
        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)
        
        if FAISS_AVAILABLE:
            if self.index_type == "ivf" and not self.index.is_trained:
                if embeddings.shape[0] >= self.nlist:
                    self.index.train(embeddings)
                else:
                    train_data = np.random.randn(max(1000, self.nlist * 10), self.embedding_dim).astype(np.float32)
                    self.index.train(train_data)
            
            self.index.add(embeddings)
        else:
            if self.embeddings_matrix is None:
                self.embeddings_matrix = embeddings
            else:
                self.embeddings_matrix = np.vstack([self.embeddings_matrix, embeddings])
        
        for i, doc_id in enumerate(doc_ids):
            doc = Document(
                doc_id=doc_id,
                text=texts[i],
                language=languages[i] if languages else "zh",
                embedding=embeddings[i],
                metadata=metadata_list[i] if metadata_list else {}
            )
            
            self.documents[doc_id] = doc
            self.doc_id_to_idx[doc_id] = self._next_idx
            self.idx_to_doc_id[self._next_idx] = doc_id
            self._next_idx += 1
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        language: str = None,
        min_score: float = 0.0
    ) -> List[SearchResult]:
        """搜索相似文档"""
        if len(self.documents) == 0:
            return []
        
        query_embedding = query_embedding.astype(np.float32)
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        if FAISS_AVAILABLE:
            query_embedding = query_embedding / (np.linalg.norm(query_embedding) + 1e-9)
            
            scores, indices = self.index.search(query_embedding, min(top_k * 2, len(self.documents)))
            
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1:
                    continue
                
                doc_id = self.idx_to_doc_id.get(idx)
                if doc_id is None:
                    continue
                
                doc = self.documents[doc_id]
                
                if language and doc.language != language:
                    continue
                
                if score < min_score:
                    continue
                
                results.append(SearchResult(
                    doc_id=doc_id,
                    text=doc.text,
                    language=doc.language,
                    score=float(score),
                    metadata=doc.metadata.copy()
                ))
                
                if len(results) >= top_k:
                    break
            
            return results
        else:
            if self.embeddings_matrix is None:
                return []
            
            query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-9)
            matrix_norm = self.embeddings_matrix / (np.linalg.norm(self.embeddings_matrix, axis=1, keepdims=True) + 1e-9)
            
            similarities = np.dot(matrix_norm, query_norm.T).flatten()
            
            top_indices = np.argsort(similarities)[::-1][:top_k * 2]
            
            results = []
            for idx in top_indices:
                doc_id = self.idx_to_doc_id.get(idx)
                if doc_id is None:
                    continue
                
                doc = self.documents[doc_id]
                score = similarities[idx]
                
                if language and doc.language != language:
                    continue
                
                if score < min_score:
                    continue
                
                results.append(SearchResult(
                    doc_id=doc_id,
                    text=doc.text,
                    language=doc.language,
                    score=float(score),
                    metadata=doc.metadata.copy()
                ))
                
                if len(results) >= top_k:
                    break
            
            return results
    
    def delete_document(self, doc_id: str) -> bool:
        """删除文档（标记删除）"""
        if doc_id not in self.documents:
            return False
        
        del self.documents[doc_id]
        idx = self.doc_id_to_idx.pop(doc_id, None)
        if idx is not None:
            del self.idx_to_doc_id[idx]
        
        return True
    
    def get_document(self, doc_id: str) -> Optional[Document]:
        """获取文档"""
        return self.documents.get(doc_id)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        languages = {}
        for doc in self.documents.values():
            languages[doc.language] = languages.get(doc.language, 0) + 1
        
        return {
            "total_documents": len(self.documents),
            "embedding_dim": self.embedding_dim,
            "index_type": self.index_type,
            "languages": languages,
            "faiss_available": FAISS_AVAILABLE
        }
    
    def save(self, path: str = None):
        """保存索引"""
        path = Path(path or self.storage_path)
        path.mkdir(parents=True, exist_ok=True)
        
        if FAISS_AVAILABLE:
            faiss.write_index(self.index, str(path / "index.faiss"))
        
        docs_data = {
            doc_id: {
                'doc_id': doc.doc_id,
                'text': doc.text,
                'language': doc.language,
                'metadata': doc.metadata
            }
            for doc_id, doc in self.documents.items()
        }
        
        with open(path / "documents.json", 'w', encoding='utf-8') as f:
            json.dump(docs_data, f, ensure_ascii=False, indent=2)
        
        with open(path / "mappings.pkl", 'wb') as f:
            pickle.dump({
                'doc_id_to_idx': self.doc_id_to_idx,
                'idx_to_doc_id': self.idx_to_doc_id,
                'next_idx': self._next_idx
            }, f)
        
        if not FAISS_AVAILABLE and self.embeddings_matrix is not None:
            np.save(str(path / "embeddings.npy"), self.embeddings_matrix)
    
    def load(self, path: str = None):
        """加载索引"""
        path = Path(path or self.storage_path)
        
        if not path.exists():
            return
        
        if FAISS_AVAILABLE and (path / "index.faiss").exists():
            self.index = faiss.read_index(str(path / "index.faiss"))
        
        with open(path / "documents.json", 'r', encoding='utf-8') as f:
            docs_data = json.load(f)
        
        for doc_id, doc_dict in docs_data.items():
            self.documents[doc_id] = Document(
                doc_id=doc_dict['doc_id'],
                text=doc_dict['text'],
                language=doc_dict['language'],
                metadata=doc_dict.get('metadata', {})
            )
        
        with open(path / "mappings.pkl", 'rb') as f:
            mappings = pickle.load(f)
            self.doc_id_to_idx = mappings['doc_id_to_idx']
            self.idx_to_doc_id = mappings['idx_to_doc_id']
            self._next_idx = mappings['next_idx']
        
        if not FAISS_AVAILABLE and (path / "embeddings.npy").exists():
            self.embeddings_matrix = np.load(str(path / "embeddings.npy"))


class CrossLingualVectorStore:
    """跨语言向量存储"""
    
    def __init__(self, embedding_dim: int = 384, storage_path: str = None):
        self.embedding_dim = embedding_dim
        self.storage_path = storage_path or "data/vectors/cross_lingual"
        
        self.zh_store = FAISSVectorStore(
            embedding_dim=embedding_dim,
            storage_path=f"{self.storage_path}/zh"
        )
        self.en_store = FAISSVectorStore(
            embedding_dim=embedding_dim,
            storage_path=f"{self.storage_path}/en"
        )
        
        self.parallel_links: Dict[str, str] = {}
    
    def add_document(
        self,
        doc_id: str,
        text: str,
        embedding: np.ndarray,
        language: str = "zh",
        metadata: Dict = None,
        parallel_doc_id: str = None
    ):
        """添加文档"""
        store = self.zh_store if language == "zh" else self.en_store
        store.add_document(doc_id, text, embedding, language, metadata)
        
        if parallel_doc_id:
            if language == "zh":
                self.parallel_links[doc_id] = parallel_doc_id
            else:
                self.parallel_links[parallel_doc_id] = doc_id
    
    def search(
        self,
        query_embedding: np.ndarray,
        query_language: str = "zh",
        top_k: int = 10,
        cross_lingual: bool = True
    ) -> List[SearchResult]:
        """跨语言搜索"""
        primary_store = self.zh_store if query_language == "zh" else self.en_store
        secondary_store = self.en_store if query_language == "zh" else self.zh_store
        
        results = primary_store.search(query_embedding, top_k=top_k)
        
        if cross_lingual:
            cross_results = secondary_store.search(query_embedding, top_k=top_k // 2)
            
            for r in cross_results:
                r.score *= 0.9
            
            results.extend(cross_results)
            results.sort(key=lambda x: x.score, reverse=True)
            results = results[:top_k]
        
        for r in results:
            parallel_id = self.parallel_links.get(r.doc_id)
            if parallel_id:
                r.metadata['parallel_doc_id'] = parallel_id
        
        return results
    
    def get_parallel_document(self, doc_id: str) -> Optional[Document]:
        """获取平行文档"""
        parallel_id = self.parallel_links.get(doc_id)
        if parallel_id:
            if doc_id in self.zh_store.documents:
                return self.en_store.get_document(parallel_id)
            else:
                return self.zh_store.get_document(parallel_id)
        return None
    
    def save(self):
        """保存"""
        self.zh_store.save()
        self.en_store.save()
        
        path = Path(self.storage_path)
        path.mkdir(parents=True, exist_ok=True)
        
        with open(path / "parallel_links.json", 'w') as f:
            json.dump(self.parallel_links, f)
    
    def load(self):
        """加载"""
        self.zh_store.load()
        self.en_store.load()
        
        path = Path(self.storage_path)
        links_file = path / "parallel_links.json"
        
        if links_file.exists():
            with open(links_file, 'r') as f:
                self.parallel_links = json.load(f)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计"""
        return {
            "zh_documents": len(self.zh_store.documents),
            "en_documents": len(self.en_store.documents),
            "parallel_links": len(self.parallel_links),
            "embedding_dim": self.embedding_dim
        }


faiss_store = FAISSVectorStore()
cross_lingual_store = CrossLingualVectorStore()

"""
零成本向量数据库
使用FAISS实现，无需Milvus/Qdrant等付费服务
"""

import os
import json
import time
import pickle
import threading
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import sqlite3
import numpy as np

try:
    import faiss
    HAS_FAISS = True
except ImportError:
    HAS_FAISS = False

from retrieval.cross_lingual_index import Document, SearchResult


@dataclass
class VectorDocument:
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


class SimpleVectorIndex:
    """简单向量索引（无FAISS时的回退方案）"""
    
    def __init__(self, embedding_dim: int = 384):
        self.embedding_dim = embedding_dim
        self.embeddings: Dict[str, np.ndarray] = {}
        self.doc_ids: List[str] = []
        self._embedding_matrix: Optional[np.ndarray] = None
        self._needs_rebuild = True
    
    def add(self, doc_id: str, embedding: np.ndarray):
        if embedding.shape[0] != self.embedding_dim:
            raise ValueError(f"Embedding dimension mismatch: {embedding.shape[0]} vs {self.embedding_dim}")
        
        self.embeddings[doc_id] = embedding.astype(np.float32)
        self._needs_rebuild = True
    
    def remove(self, doc_id: str):
        if doc_id in self.embeddings:
            del self.embeddings[doc_id]
            self._needs_rebuild = True
    
    def _rebuild_matrix(self):
        self.doc_ids = list(self.embeddings.keys())
        if self.doc_ids:
            self._embedding_matrix = np.stack([self.embeddings[doc_id] for doc_id in self.doc_ids])
            faiss.normalize_L2(self._embedding_matrix) if HAS_FAISS else None
        else:
            self._embedding_matrix = None
        self._needs_rebuild = False
    
    def search(self, query_embedding: np.ndarray, top_k: int = 10) -> List[Tuple[str, float]]:
        if self._needs_rebuild:
            self._rebuild_matrix()
        
        if self._embedding_matrix is None or len(self.doc_ids) == 0:
            return []
        
        query = query_embedding.astype(np.float32)
        query = query / (np.linalg.norm(query) + 1e-9)
        
        similarities = np.dot(self._embedding_matrix, query)
        
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        return [(self.doc_ids[i], float(similarities[i])) for i in top_indices]


class FAISSVectorIndex:
    """FAISS向量索引"""
    
    def __init__(self, embedding_dim: int = 384, use_gpu: bool = False):
        self.embedding_dim = embedding_dim
        self.use_gpu = use_gpu
        
        self.index = faiss.IndexFlatIP(embedding_dim)
        
        if use_gpu and faiss.get_num_gpus() > 0:
            res = faiss.StandardGpuResources()
            self.index = faiss.index_cpu_to_gpu(res, 0, self.index)
        
        self.doc_ids: List[str] = []
        self.id_to_idx: Dict[str, int] = {}
        self.idx_to_id: Dict[int, str] = {}
    
    def add(self, doc_id: str, embedding: np.ndarray):
        if doc_id in self.id_to_idx:
            return
        
        vec = embedding.astype(np.float32).reshape(1, -1)
        faiss.normalize_L2(vec)
        
        idx = len(self.doc_ids)
        self.doc_ids.append(doc_id)
        self.id_to_idx[doc_id] = idx
        self.idx_to_id[idx] = doc_id
        
        self.index.add(vec)
    
    def remove(self, doc_id: str):
        if doc_id not in self.id_to_idx:
            return
        
        self.index.remove_ids(np.array([self.id_to_idx[doc_id]]))
        del self.id_to_idx[doc_id]
        del self.idx_to_id[self.id_to_idx[doc_id]]
    
    def search(self, query_embedding: np.ndarray, top_k: int = 10) -> List[Tuple[str, float]]:
        if len(self.doc_ids) == 0:
            return []
        
        query = query_embedding.astype(np.float32).reshape(1, -1)
        faiss.normalize_L2(query)
        
        top_k = min(top_k, len(self.doc_ids))
        scores, indices = self.index.search(query, top_k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx >= 0 and idx in self.idx_to_id:
                results.append((self.idx_to_id[idx], float(scores[0][i])))
        
        return results
    
    def save(self, path: str):
        if self.use_gpu:
            cpu_index = faiss.index_gpu_to_cpu(self.index)
            faiss.write_index(cpu_index, path)
        else:
            faiss.write_index(self.index, path)
        
        with open(path + '.meta', 'wb') as f:
            pickle.dump({
                'doc_ids': self.doc_ids,
                'id_to_idx': self.id_to_idx,
                'idx_to_id': self.idx_to_id
            }, f)
    
    def load(self, path: str):
        self.index = faiss.read_index(path)
        
        with open(path + '.meta', 'rb') as f:
            meta = pickle.load(f)
            self.doc_ids = meta['doc_ids']
            self.id_to_idx = meta['id_to_idx']
            self.idx_to_id = meta['idx_to_id']


class ZeroCostVectorDB:
    """零成本向量数据库"""
    
    def __init__(
        self,
        embedding_dim: int = 384,
        db_path: str = "data/vectordb/vectors.db",
        use_faiss: bool = True
    ):
        self.embedding_dim = embedding_dim
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        if use_faiss and HAS_FAISS:
            self.vector_index = FAISSVectorIndex(embedding_dim)
            self.index_type = "faiss"
        else:
            self.vector_index = SimpleVectorIndex(embedding_dim)
            self.index_type = "simple"
        
        self.documents: Dict[str, VectorDocument] = {}
        self.language_index: Dict[str, set] = {"zh": set(), "en": set(), "mixed": set()}
        
        self._init_db()
        
        self.lock = threading.RLock()
        
        self.stats = {
            'total_docs': 0,
            'total_searches': 0,
            'avg_search_time': 0.0
        }
    
    def _init_db(self):
        """初始化SQLite存储"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS documents (
                    doc_id TEXT PRIMARY KEY,
                    text TEXT NOT NULL,
                    language TEXT NOT NULL,
                    metadata TEXT,
                    created_at REAL,
                    updated_at REAL
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS embeddings (
                    doc_id TEXT PRIMARY KEY,
                    embedding BLOB,
                    FOREIGN KEY (doc_id) REFERENCES documents(doc_id)
                )
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_language ON documents(language)
            ''')
            conn.commit()
    
    def add_document(
        self,
        doc_id: str,
        text: str,
        language: str,
        embedding: np.ndarray,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """添加文档"""
        with self.lock:
            now = time.time()
            
            doc = VectorDocument(
                doc_id=doc_id,
                text=text,
                language=language,
                embedding=embedding,
                metadata=metadata or {}
            )
            
            self.documents[doc_id] = doc
            self.language_index[language].add(doc_id)
            
            self.vector_index.add(doc_id, embedding)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO documents (doc_id, text, language, metadata, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (doc_id, text, language, json.dumps(metadata or {}), now, now))
                
                cursor.execute('''
                    INSERT OR REPLACE INTO embeddings (doc_id, embedding)
                    VALUES (?, ?)
                ''', (doc_id, embedding.tobytes()))
                
                conn.commit()
            
            self.stats['total_docs'] = len(self.documents)
            return True
    
    def add_documents_batch(
        self,
        documents: List[Tuple[str, str, str, np.ndarray, Optional[Dict]]]
    ) -> int:
        """批量添加文档"""
        success_count = 0
        for doc_id, text, language, embedding, metadata in documents:
            if self.add_document(doc_id, text, language, embedding, metadata):
                success_count += 1
        return success_count
    
    def remove_document(self, doc_id: str) -> bool:
        """删除文档"""
        with self.lock:
            if doc_id not in self.documents:
                return False
            
            doc = self.documents[doc_id]
            self.language_index[doc.language].discard(doc_id)
            
            del self.documents[doc_id]
            self.vector_index.remove(doc_id)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM documents WHERE doc_id = ?', (doc_id,))
                cursor.execute('DELETE FROM embeddings WHERE doc_id = ?', (doc_id,))
                conn.commit()
            
            self.stats['total_docs'] = len(self.documents)
            return True
    
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10,
        language: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[SearchResult]:
        """搜索"""
        start_time = time.time()
        
        with self.lock:
            results = self.vector_index.search(query_embedding, top_k * 2)
            
            search_results = []
            for doc_id, score in results:
                if score < min_score:
                    continue
                
                if doc_id not in self.documents:
                    continue
                
                doc = self.documents[doc_id]
                
                if language and doc.language != language:
                    continue
                
                search_results.append(SearchResult(
                    doc_id=doc_id,
                    text=doc.text,
                    language=doc.language,
                    score=score,
                    metadata=doc.metadata.copy()
                ))
                
                if len(search_results) >= top_k:
                    break
            
            search_time = time.time() - start_time
            self.stats['total_searches'] += 1
            self.stats['avg_search_time'] = (
                (self.stats['avg_search_time'] * (self.stats['total_searches'] - 1) + search_time)
                / self.stats['total_searches']
            )
            
            return search_results
    
    def search_by_text(
        self,
        query: str,
        embedder,
        top_k: int = 10,
        language: Optional[str] = None
    ) -> List[SearchResult]:
        """文本搜索"""
        embedding = embedder.encode(query)
        return self.search(embedding, top_k, language)
    
    def get_document(self, doc_id: str) -> Optional[VectorDocument]:
        """获取文档"""
        return self.documents.get(doc_id)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计"""
        return {
            **self.stats,
            'index_type': self.index_type,
            'languages': {
                lang: len(docs) for lang, docs in self.language_index.items()
            }
        }
    
    def save_index(self, path: str = "data/vectordb/faiss.index"):
        """保存索引"""
        if self.index_type == "faiss":
            self.vector_index.save(path)
    
    def load_index(self, path: str = "data/vectordb/faiss.index"):
        """加载索引"""
        if self.index_type == "faiss" and os.path.exists(path):
            self.vector_index.load(path)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM documents')
            
            for row in cursor.fetchall():
                doc = VectorDocument(
                    doc_id=row['doc_id'],
                    text=row['text'],
                    language=row['language'],
                    metadata=json.loads(row['metadata'] or '{}')
                )
                self.documents[doc.doc_id] = doc
                self.language_index[doc.language].add(doc.doc_id)
            
            cursor.execute('SELECT doc_id, embedding FROM embeddings')
            for row in cursor.fetchall():
                doc_id = row['doc_id']
                if doc_id in self.documents:
                    embedding = np.frombuffer(row['embedding'], dtype=np.float32)
                    self.documents[doc_id].embedding = embedding
                    self.vector_index.add(doc_id, embedding)
        
        self.stats['total_docs'] = len(self.documents)
    
    def clear(self):
        """清空数据库"""
        with self.lock:
            self.documents.clear()
            for lang in self.language_index:
                self.language_index[lang].clear()
            
            if self.index_type == "faiss":
                self.vector_index = FAISSVectorIndex(self.embedding_dim)
            else:
                self.vector_index = SimpleVectorIndex(self.embedding_dim)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM documents')
                cursor.execute('DELETE FROM embeddings')
                conn.commit()
            
            self.stats['total_docs'] = 0


vector_db = ZeroCostVectorDB()


def get_vector_db() -> ZeroCostVectorDB:
    return vector_db


if __name__ == "__main__":
    db = ZeroCostVectorDB(embedding_dim=384)
    
    docs = [
        ("doc_1", "人工智能正在改变世界", "zh", np.random.randn(384).astype(np.float32)),
        ("doc_2", "Machine learning is powerful", "en", np.random.randn(384).astype(np.float32)),
        ("doc_3", "深度学习模型需要大量数据", "zh", np.random.randn(384).astype(np.float32)),
    ]
    
    for doc_id, text, lang, emb in docs:
        db.add_document(doc_id, text, lang, emb)
        print(f"添加文档: {doc_id}")
    
    query = np.random.randn(384).astype(np.float32)
    results = db.search(query, top_k=2)
    
    print("\n搜索结果:")
    for r in results:
        print(f"  {r.doc_id} ({r.language}): {r.text[:30]}... (score: {r.score:.4f})")
    
    print(f"\n统计: {db.get_stats()}")
    print("\n✅ 零成本向量数据库测试通过！")

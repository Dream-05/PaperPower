"""
本地缓存系统 - 零成本实现
基于SQLite + 内存双层缓存，无需Redis
"""

import os
import json
import sqlite3
import hashlib
import threading
from datetime import datetime, timedelta
from typing import Optional, Any, Dict, Callable
from dataclasses import dataclass
from pathlib import Path
from functools import wraps
import time


@dataclass
class CacheEntry:
    key: str
    value: Any
    expires_at: datetime
    created_at: datetime
    hit_count: int = 0


class MemoryCache:
    """内存缓存层 - 超快速访问"""
    
    def __init__(self, max_size: int = 1000):
        self._cache: Dict[str, CacheEntry] = {}
        self._max_size = max_size
        self._lock = threading.RLock()
        self._stats = {"hits": 0, "misses": 0}
    
    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self._stats["misses"] += 1
                return None
            
            if datetime.utcnow() > entry.expires_at:
                del self._cache[key]
                self._stats["misses"] += 1
                return None
            
            entry.hit_count += 1
            self._stats["hits"] += 1
            return entry.value
    
    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        with self._lock:
            if len(self._cache) >= self._max_size:
                self._evict_lru()
            
            self._cache[key] = CacheEntry(
                key=key,
                value=value,
                expires_at=datetime.utcnow() + timedelta(seconds=ttl_seconds),
                created_at=datetime.utcnow()
            )
    
    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self):
        with self._lock:
            self._cache.clear()
    
    def _evict_lru(self):
        """LRU淘汰策略"""
        if not self._cache:
            return
        
        lru_key = min(self._cache.keys(), key=lambda k: self._cache[k].hit_count)
        del self._cache[lru_key]
    
    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self._stats["hits"] + self._stats["misses"]
            hit_rate = self._stats["hits"] / total if total > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._stats["hits"],
                "misses": self._stats["misses"],
                "hit_rate": f"{hit_rate:.2%}"
            }


class SQLiteCache:
    """SQLite持久化缓存层 - 数据持久化"""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            cache_dir = Path("data/cache")
            cache_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(cache_dir / "cache.db")
        
        self.db_path = db_path
        self._init_db()
    
    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_db(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at TEXT,
                created_at TEXT,
                hit_count INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_expires_at ON cache(expires_at)')
        
        conn.commit()
        conn.close()
    
    def get(self, key: str) -> Optional[Any]:
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT value, expires_at FROM cache WHERE key = ?",
            (key,)
        )
        row = cursor.fetchone()
        
        if row is None:
            conn.close()
            return None
        
        if row['expires_at']:
            expires_at = datetime.fromisoformat(row['expires_at'])
            if datetime.utcnow() > expires_at:
                cursor.execute("DELETE FROM cache WHERE key = ?", (key,))
                conn.commit()
                conn.close()
                return None
        
        cursor.execute(
            "UPDATE cache SET hit_count = hit_count + 1 WHERE key = ?",
            (key,)
        )
        conn.commit()
        conn.close()
        
        return json.loads(row['value'])
    
    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        conn = self._get_connection()
        cursor = conn.cursor()
        
        expires_at = (datetime.utcnow() + timedelta(seconds=ttl_seconds)).isoformat()
        created_at = datetime.utcnow().isoformat()
        value_json = json.dumps(value, ensure_ascii=False)
        
        cursor.execute('''
            INSERT OR REPLACE INTO cache (key, value, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        ''', (key, value_json, expires_at, created_at))
        
        conn.commit()
        conn.close()
    
    def delete(self, key: str) -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cache WHERE key = ?", (key,))
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        return affected > 0
    
    def clear_expired(self) -> int:
        """清理过期缓存"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM cache WHERE expires_at < ?",
            (datetime.utcnow().isoformat(),)
        )
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        return affected
    
    def get_stats(self) -> Dict[str, Any]:
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM cache")
        total = cursor.fetchone()[0]
        
        cursor.execute(
            "SELECT COUNT(*) FROM cache WHERE expires_at > ?",
            (datetime.utcnow().isoformat(),)
        )
        active = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(hit_count) FROM cache")
        total_hits = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            "total_entries": total,
            "active_entries": active,
            "total_hits": total_hits
        }


class HybridCache:
    """混合缓存 - 内存 + SQLite双层架构"""
    
    def __init__(
        self,
        memory_max_size: int = 1000,
        db_path: str = None,
        default_ttl: int = 3600
    ):
        self.memory_cache = MemoryCache(max_size=memory_max_size)
        self.sqlite_cache = SQLiteCache(db_path=db_path)
        self.default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存（先查内存，再查SQLite）"""
        value = self.memory_cache.get(key)
        if value is not None:
            return value
        
        value = self.sqlite_cache.get(key)
        if value is not None:
            self.memory_cache.set(key, value, self.default_ttl)
            return value
        
        return None
    
    def set(self, key: str, value: Any, ttl_seconds: int = None):
        """设置缓存（同时写入内存和SQLite）"""
        ttl = ttl_seconds or self.default_ttl
        self.memory_cache.set(key, value, ttl)
        self.sqlite_cache.set(key, value, ttl)
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        m_deleted = self.memory_cache.delete(key)
        s_deleted = self.sqlite_cache.delete(key)
        return m_deleted or s_deleted
    
    def get_or_compute(
        self,
        key: str,
        compute_fn: Callable[[], Any],
        ttl_seconds: int = None
    ) -> Any:
        """获取缓存，不存在则计算并缓存"""
        value = self.get(key)
        if value is not None:
            return value
        
        value = compute_fn()
        self.set(key, value, ttl_seconds)
        return value
    
    async def get_or_compute_async(
        self,
        key: str,
        compute_fn: Callable,
        ttl_seconds: int = None
    ) -> Any:
        """异步获取缓存，不存在则计算并缓存"""
        value = self.get(key)
        if value is not None:
            return value
        
        value = await compute_fn()
        self.set(key, value, ttl_seconds)
        return value
    
    def clear_all(self):
        """清空所有缓存"""
        self.memory_cache.clear()
        conn = self.sqlite_cache._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cache")
        conn.commit()
        conn.close()
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        return {
            "memory": self.memory_cache.get_stats(),
            "sqlite": self.sqlite_cache.get_stats()
        }


def cache_key(*args, **kwargs) -> str:
    """生成缓存键"""
    key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True)
    return hashlib.md5(key_data.encode()).hexdigest()


def cached(ttl_seconds: int = 3600, key_prefix: str = ""):
    """缓存装饰器"""
    def decorator(func: Callable) -> Callable:
        _cache = HybridCache()
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key_str = f"{key_prefix}:{func.__name__}:{cache_key(*args, **kwargs)}"
            return _cache.get_or_compute(
                cache_key_str,
                lambda: func(*args, **kwargs),
                ttl_seconds
            )
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            cache_key_str = f"{key_prefix}:{func.__name__}:{cache_key(*args, **kwargs)}"
            return await _cache.get_or_compute_async(
                cache_key_str,
                lambda: func(*args, **kwargs),
                ttl_seconds
            )
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return wrapper
    
    return decorator


hybrid_cache = HybridCache()


class ResponseCache:
    """API响应缓存"""
    
    def __init__(self, cache: HybridCache = None):
        self.cache = cache or hybrid_cache
    
    def cache_response(self, endpoint: str, params: Dict, response: Any, ttl: int = 300):
        """缓存API响应"""
        key = self._make_key(endpoint, params)
        self.cache.set(key, response, ttl)
    
    def get_cached_response(self, endpoint: str, params: Dict) -> Optional[Any]:
        """获取缓存的响应"""
        key = self._make_key(endpoint, params)
        return self.cache.get(key)
    
    def _make_key(self, endpoint: str, params: Dict) -> str:
        params_str = json.dumps(params, sort_keys=True, ensure_ascii=False)
        params_hash = hashlib.md5(params_str.encode()).hexdigest()
        return f"api:{endpoint}:{params_hash}"


class EmbeddingCache:
    """向量嵌入缓存 - 避免重复计算"""
    
    def __init__(self, cache: HybridCache = None):
        self.cache = cache or hybrid_cache
    
    def get_embedding(self, text: str) -> Optional[list]:
        """获取缓存的嵌入向量"""
        key = self._make_key(text)
        return self.cache.get(key)
    
    def cache_embedding(self, text: str, embedding: list, ttl: int = 86400):
        """缓存嵌入向量"""
        key = self._make_key(text)
        self.cache.set(key, embedding, ttl)
    
    def _make_key(self, text: str) -> str:
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        return f"embedding:{text_hash}"


response_cache = ResponseCache()
embedding_cache = EmbeddingCache()

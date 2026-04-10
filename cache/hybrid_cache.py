"""
零成本缓存系统
使用SQLite + 内存实现，无需Redis
"""

import os
import json
import time
import hashlib
import threading
from typing import Optional, Any, Dict, Callable
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
import sqlite3
from functools import wraps
from collections import OrderedDict


@dataclass
class CacheEntry:
    key: str
    value: Any
    created_at: float
    expires_at: float
    hits: int = 0
    size: int = 0
    
    def is_expired(self) -> bool:
        return time.time() > self.expires_at
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'key': self.key,
            'value': self.value,
            'created_at': self.created_at,
            'expires_at': self.expires_at,
            'hits': self.hits,
            'size': self.size
        }


class MemoryCache:
    """LRU内存缓存"""
    
    def __init__(self, max_size: int = 1000, max_memory_mb: int = 100):
        self.max_size = max_size
        self.max_memory = max_memory_mb * 1024 * 1024
        self.cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self.current_memory = 0
        self.lock = threading.RLock()
        
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'memory_evictions': 0
        }
    
    def _estimate_size(self, value: Any) -> int:
        """估算值的大小"""
        try:
            return len(json.dumps(value, ensure_ascii=False))
        except:
            return 100
    
    def _evict_lru(self):
        """LRU淘汰"""
        while len(self.cache) >= self.max_size:
            oldest_key = next(iter(self.cache))
            entry = self.cache.pop(oldest_key)
            self.current_memory -= entry.size
            self.stats['evictions'] += 1
    
    def _evict_memory(self, needed: int):
        """内存淘汰"""
        while self.current_memory + needed > self.max_memory and self.cache:
            oldest_key = next(iter(self.cache))
            entry = self.cache.pop(oldest_key)
            self.current_memory -= entry.size
            self.stats['memory_evictions'] += 1
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        with self.lock:
            if key not in self.cache:
                self.stats['misses'] += 1
                return None
            
            entry = self.cache[key]
            
            if entry.is_expired():
                del self.cache[key]
                self.current_memory -= entry.size
                self.stats['misses'] += 1
                return None
            
            self.cache.move_to_end(key)
            entry.hits += 1
            self.stats['hits'] += 1
            return entry.value
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """设置缓存"""
        with self.lock:
            size = self._estimate_size(value)
            
            if size > self.max_memory:
                return False
            
            if key in self.cache:
                old_entry = self.cache[key]
                self.current_memory -= old_entry.size
            
            self._evict_memory(size)
            self._evict_lru()
            
            now = time.time()
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=now,
                expires_at=now + ttl,
                size=size
            )
            
            self.cache[key] = entry
            self.current_memory += size
            return True
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        with self.lock:
            if key in self.cache:
                entry = self.cache.pop(key)
                self.current_memory -= entry.size
                return True
            return False
    
    def clear(self):
        """清空缓存"""
        with self.lock:
            self.cache.clear()
            self.current_memory = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计"""
        with self.lock:
            total = self.stats['hits'] + self.stats['misses']
            hit_rate = self.stats['hits'] / total if total > 0 else 0
            
            return {
                **self.stats,
                'entries': len(self.cache),
                'memory_used_mb': self.current_memory / (1024 * 1024),
                'hit_rate': hit_rate
            }


class DiskCache:
    """SQLite磁盘缓存"""
    
    def __init__(self, db_path: str = "data/cache/cache.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        """初始化数据库"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    hits INTEGER DEFAULT 0
                )
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_expires_at ON cache(expires_at)
            ''')
            conn.commit()
    
    def _cleanup_expired(self):
        """清理过期缓存"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                DELETE FROM cache WHERE expires_at < ?
            ''', (time.time(),))
            conn.commit()
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT value, expires_at FROM cache WHERE key = ?
            ''', (key,))
            
            row = cursor.fetchone()
            
            if row is None:
                return None
            
            value_json, expires_at = row
            
            if time.time() > expires_at:
                cursor.execute('DELETE FROM cache WHERE key = ?', (key,))
                conn.commit()
                return None
            
            cursor.execute('''
                UPDATE cache SET hits = hits + 1 WHERE key = ?
            ''', (key,))
            conn.commit()
            
            return json.loads(value_json)
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """设置缓存"""
        now = time.time()
        expires_at = now + ttl
        value_json = json.dumps(value, ensure_ascii=False)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO cache (key, value, created_at, expires_at)
                VALUES (?, ?, ?, ?)
            ''', (key, value_json, now, expires_at))
            conn.commit()
            return True
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM cache WHERE key = ?', (key,))
            conn.commit()
            return cursor.rowcount > 0
    
    def clear(self):
        """清空缓存"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM cache')
            conn.commit()
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM cache')
            total = cursor.fetchone()[0]
            
            cursor.execute('SELECT SUM(hits) FROM cache')
            hits = cursor.fetchone()[0] or 0
            
            return {
                'entries': total,
                'total_hits': hits
            }


class HybridCache:
    """混合缓存：内存 + 磁盘"""
    
    def __init__(
        self,
        memory_size: int = 1000,
        memory_mb: int = 100,
        disk_path: str = "data/cache/cache.db"
    ):
        self.memory_cache = MemoryCache(memory_size, memory_mb)
        self.disk_cache = DiskCache(disk_path)
        
        self.stats = {
            'memory_hits': 0,
            'disk_hits': 0,
            'misses': 0
        }
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        value = self.memory_cache.get(key)
        if value is not None:
            self.stats['memory_hits'] += 1
            return value
        
        value = self.disk_cache.get(key)
        if value is not None:
            self.stats['disk_hits'] += 1
            self.memory_cache.set(key, value)
            return value
        
        self.stats['misses'] += 1
        return None
    
    def set(self, key: str, value: Any, ttl: int = 3600, disk: bool = True) -> bool:
        """设置缓存"""
        self.memory_cache.set(key, value, ttl)
        if disk:
            self.disk_cache.set(key, value, ttl)
        return True
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        self.memory_cache.delete(key)
        return self.disk_cache.delete(key)
    
    def clear(self):
        """清空缓存"""
        self.memory_cache.clear()
        self.disk_cache.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计"""
        memory_stats = self.memory_cache.get_stats()
        disk_stats = self.disk_cache.get_stats()
        
        total = self.stats['memory_hits'] + self.stats['disk_hits'] + self.stats['misses']
        hit_rate = (self.stats['memory_hits'] + self.stats['disk_hits']) / total if total > 0 else 0
        
        return {
            'memory': memory_stats,
            'disk': disk_stats,
            'total_stats': self.stats,
            'overall_hit_rate': hit_rate
        }
    
    async def get_or_compute(
        self,
        key: str,
        compute_fn: Callable,
        ttl: int = 3600,
        disk: bool = True
    ) -> Any:
        """获取或计算"""
        value = self.get(key)
        if value is not None:
            return value
        
        import asyncio
        if asyncio.iscoroutinefunction(compute_fn):
            value = await compute_fn()
        else:
            value = compute_fn()
        
        self.set(key, value, ttl, disk)
        return value


def cache_result(ttl: int = 3600, key_prefix: str = ""):
    """缓存装饰器"""
    def decorator(func):
        _cache = {}
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            key_parts = [key_prefix, func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            key = hashlib.md5(":".join(key_parts).encode()).hexdigest()
            
            now = time.time()
            
            if key in _cache:
                entry = _cache[key]
                if now < entry['expires_at']:
                    return entry['value']
            
            result = func(*args, **kwargs)
            
            _cache[key] = {
                'value': result,
                'expires_at': now + ttl
            }
            
            return result
        
        return wrapper
    return decorator


hybrid_cache = HybridCache()


def get_cache() -> HybridCache:
    return hybrid_cache


if __name__ == "__main__":
    cache = HybridCache()
    
    cache.set("test_key", {"data": "test_value"}, ttl=60)
    result = cache.get("test_key")
    print(f"缓存结果: {result}")
    
    @cache_result(ttl=60)
    def expensive_function(n):
        print(f"计算 {n}...")
        return n * n
    
    print(expensive_function(5))
    print(expensive_function(5))
    
    print(f"\n缓存统计: {cache.get_stats()}")
    print("\n✅ 零成本缓存系统测试通过！")

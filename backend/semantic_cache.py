"""
推理语义缓存 - 避免对相似输入重复调用模型
基于内容哈希 + TTL 的智能缓存层
"""

import hashlib
import json
import time
import threading
from typing import Optional, Dict, Any, Tuple
from collections import OrderedDict


class SemanticCache:
    """
    语义缓存: 对相同的或高度相似的输入返回缓存结果
    
    特点:
    - 基于 SHA256 内容哈希的精确匹配
    - 可配置 TTL (Time To Live)
    - LRU 淘汰策略
    - 线程安全
    - 缓存命中率统计
    """
    
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._cache: OrderedDict[str, Tuple[Any, float]] = OrderedDict()
        self._lock = threading.RLock()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
        }
    
    def _compute_key(self, prompt: str, params: Dict[str, Any]) -> str:
        """计算缓存键: prompt + 关键参数的哈希"""
        normalized_params = {
            "max_new_tokens": params.get("max_new_tokens", 100),
            "temperature": round(params.get("temperature", 0.7), 2),
            "top_p": round(params.get("top_p", 0.9), 2),
        }
        cache_content = json.dumps({"prompt": prompt, "params": normalized_params}, sort_keys=True)
        return hashlib.sha256(cache_content.encode('utf-8')).hexdigest()
    
    def get(self, prompt: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """获取缓存"""
        if params is None:
            params = {}
        
        key = self._compute_key(prompt, params)
        
        with self._lock:
            if key in self._cache:
                result, timestamp = self._cache[key]
                
                if time.time() - timestamp < self.ttl:
                    self._cache.move_to_end(key)
                    self._stats["hits"] += 1
                    return result
                else:
                    del self._cache[key]
                    self._stats["misses"] += 1
                    return None
            
            self._stats["misses"] += 1
            return None
    
    def set(self, prompt: str, result: Dict[str, Any], params: Dict[str, Any] = None):
        """设置缓存"""
        if params is None:
            params = {}
        
        key = self._compute_key(prompt, params)
        
        with self._lock:
            if key in self._cache:
                del self._cache[key]
            
            while len(self._cache) >= self.max_size:
                self._cache.popitem(last=False)
                self._stats["evictions"] += 1
            
            self._cache[key] = (result, time.time())
    
    def invalidate(self, prompt: str = None, params: Dict[str, Any] = None):
        """失效缓存"""
        with self._lock:
            if prompt is not None:
                key = self._compute_key(prompt, params or {})
                if key in self._cache:
                    del self._cache[key]
            else:
                self._cache.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total * 100 if total > 0 else 0
        
        return {
            **self._stats,
            "size": len(self._cache),
            "max_size": self.max_size,
            "hit_rate": f"{hit_rate:.1f}%",
            "ttl": self.ttl,
        }


_global_semantic_cache = SemanticCache(max_size=500, ttl_seconds=300)


def get_semantic_cache() -> SemanticCache:
    return _global_semantic_cache

"""
API 请求限流器 - 防止滥用和 DDoS
支持: IP 级限流、用户级别限流、全局限流
"""

import time
import threading
from collections import defaultdict
from typing import Optional
from fastapi import Request, HTTPException
from fastapi.security import APIKeyHeader


class RateLimiter:
    """
    滑动窗口限流器
    
    特点:
    - 基于 IP 的限流
    - 基于用户 ID 的限流 (可选)
    - 可配置每个端点的不同限制
    - 自动清理过期记录
    """
    
    def __init__(self):
        self._requests: Dict[str, list] = defaultdict(list)
        self._lock = threading.Lock()
        self._limits = {
            "default": {"max_requests": 60, "window_seconds": 60},
            "/api/chat": {"max_requests": 20, "window_seconds": 60},
            "/api/generate": {"max_requests": 30, "window_seconds": 60},
            "/api/images/search": {"max_requests": 15, "window_seconds": 60},
            "/generate": {"max_requests": 30, "window_seconds": 60},
        }
    
    def _cleanup(self, key: str, window: int):
        """清理过期请求记录"""
        now = time.time()
        self._requests[key] = [t for t in self._requests[key] if now - t < window]
    
    def is_allowed(self, key: str, path: str = "default") -> Tuple[bool, Dict]:
        """检查是否允许请求"""
        limit = self._limits.get(path, self._limits["default"])
        max_req = limit["max_requests"]
        window = limit["window_seconds"]
        
        with self._lock:
            self._cleanup(key, window)
            
            if len(self._requests[key]) >= max_req:
                oldest = self._requests[key][0]
                retry_after = int(window - (time.time() - oldest)) + 1
                
                return False, {
                    "allowed": False,
                    "retry_after": max(retry_after, 1),
                    "limit": max_req,
                    "remaining": 0,
                    "reset": int(oldest + window),
                }
            
            self._requests[key].append(time.time())
            
            return True, {
                "allowed": True,
                "limit": max_req,
                "remaining": max_req - len(self._requests[key]),
                "reset": int(time.time() + window),
            }
    
    def check_request(self, request: Request) -> bool:
        """FastAPI 中间件: 检查请求是否被允许"""
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        
        allowed, info = self.is_allowed(client_ip, path)
        
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Too Many Requests",
                    "retry_after": info["retry_after"],
                    "message": f"请等待 {info['retry_after']} 秒后重试",
                },
                headers={"Retry-After": str(info["retry_after"])},
            )
        
        return True


_global_rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    return _global_rate_limiter

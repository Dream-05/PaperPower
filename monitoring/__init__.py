"""
监控和日志系统 - 零成本实现
完全本地化，无需Datadog/Prometheus云服务
"""

import os
import json
import sqlite3
import time
import threading
import psutil
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from pathlib import Path
from collections import defaultdict
import logging
import traceback
from functools import wraps


@dataclass
class MetricPoint:
    name: str
    value: float
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class LogEntry:
    level: str
    message: str
    timestamp: datetime
    logger_name: str
    extra: Dict[str, Any] = field(default_factory=dict)
    exception: str = None


class MetricsStore:
    """指标存储 - SQLite实现"""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            data_dir = Path("data/monitoring")
            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(data_dir / "metrics.db")
        
        self.db_path = db_path
        self._init_db()
        
        self._counters: Dict[str, float] = defaultdict(float)
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = defaultdict(list)
        self._lock = threading.RLock()
    
    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                value REAL NOT NULL,
                timestamp TEXT NOT NULL,
                tags TEXT
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_name ON metrics(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON metrics(timestamp)')
        
        conn.commit()
        conn.close()
    
    def counter(self, name: str, value: float = 1, tags: Dict = None):
        """计数器"""
        with self._lock:
            self._counters[name] += value
            self._save_metric(name, self._counters[name], tags)
    
    def gauge(self, name: str, value: float, tags: Dict = None):
        """仪表盘"""
        with self._lock:
            self._gauges[name] = value
            self._save_metric(name, value, tags)
    
    def histogram(self, name: str, value: float, tags: Dict = None):
        """直方图"""
        with self._lock:
            self._histograms[name].append(value)
            if len(self._histograms[name]) > 1000:
                self._histograms[name] = self._histograms[name][-500:]
            self._save_metric(name, value, tags)
    
    def timing(self, name: str, value_ms: float, tags: Dict = None):
        """计时"""
        self.histogram(name, value_ms, tags)
    
    def _save_metric(self, name: str, value: float, tags: Dict = None):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO metrics (name, value, timestamp, tags)
            VALUES (?, ?, ?, ?)
        ''', (
            name,
            value,
            datetime.utcnow().isoformat(),
            json.dumps(tags or {})
        ))
        
        conn.commit()
        conn.close()
    
    def get_metrics(
        self,
        name: str,
        start_time: datetime = None,
        end_time: datetime = None,
        limit: int = 1000
    ) -> List[MetricPoint]:
        """获取指标"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = "SELECT name, value, timestamp, tags FROM metrics WHERE name = ?"
        params = [name]
        
        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time.isoformat())
        
        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time.isoformat())
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [
            MetricPoint(
                name=row[0],
                value=row[1],
                timestamp=datetime.fromisoformat(row[2]),
                tags=json.loads(row[3]) if row[3] else {}
            )
            for row in rows
        ]
    
    def get_stats(self, name: str, hours: int = 24) -> Dict[str, float]:
        """获取统计"""
        start_time = datetime.utcnow() - timedelta(hours=hours)
        metrics = self.get_metrics(name, start_time=start_time)
        
        if not metrics:
            return {"count": 0, "avg": 0, "min": 0, "max": 0}
        
        values = [m.value for m in metrics]
        
        return {
            "count": len(values),
            "avg": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
            "sum": sum(values)
        }
    
    def cleanup_old_metrics(self, days: int = 30):
        """清理旧指标"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        cursor.execute("DELETE FROM metrics WHERE timestamp < ?", (cutoff,))
        
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        
        return deleted


class LogStore:
    """日志存储"""
    
    def __init__(self, db_path: str = None, max_memory_logs: int = 10000):
        if db_path is None:
            data_dir = Path("data/monitoring")
            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(data_dir / "logs.db")
        
        self.db_path = db_path
        self.max_memory_logs = max_memory_logs
        self._init_db()
        
        self._memory_logs: List[LogEntry] = []
        self._lock = threading.RLock()
    
    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                logger_name TEXT,
                extra TEXT,
                exception TEXT
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_level ON logs(level)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON logs(timestamp)')
        
        conn.commit()
        conn.close()
    
    def log(
        self,
        level: str,
        message: str,
        logger_name: str = "app",
        extra: Dict = None,
        exception: str = None
    ):
        """记录日志"""
        entry = LogEntry(
            level=level,
            message=message,
            timestamp=datetime.utcnow(),
            logger_name=logger_name,
            extra=extra or {},
            exception=exception
        )
        
        with self._lock:
            self._memory_logs.append(entry)
            if len(self._memory_logs) > self.max_memory_logs:
                self._memory_logs = self._memory_logs[-self.max_memory_logs // 2:]
        
        self._save_log(entry)
    
    def _save_log(self, entry: LogEntry):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO logs (level, message, timestamp, logger_name, extra, exception)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            entry.level,
            entry.message,
            entry.timestamp.isoformat(),
            entry.logger_name,
            json.dumps(entry.extra, ensure_ascii=False),
            entry.exception
        ))
        
        conn.commit()
        conn.close()
    
    def get_logs(
        self,
        level: str = None,
        logger_name: str = None,
        start_time: datetime = None,
        end_time: datetime = None,
        search: str = None,
        limit: int = 100
    ) -> List[LogEntry]:
        """获取日志"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = "SELECT level, message, timestamp, logger_name, extra, exception FROM logs WHERE 1=1"
        params = []
        
        if level:
            query += " AND level = ?"
            params.append(level)
        
        if logger_name:
            query += " AND logger_name = ?"
            params.append(logger_name)
        
        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time.isoformat())
        
        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time.isoformat())
        
        if search:
            query += " AND message LIKE ?"
            params.append(f"%{search}%")
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [
            LogEntry(
                level=row[0],
                message=row[1],
                timestamp=datetime.fromisoformat(row[2]),
                logger_name=row[3],
                extra=json.loads(row[4]) if row[4] else {},
                exception=row[5]
            )
            for row in rows
        ]
    
    def get_stats(self, hours: int = 24) -> Dict[str, Any]:
        """获取日志统计"""
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT level, COUNT(*) FROM logs 
            WHERE timestamp >= ? 
            GROUP BY level
        ''', (start_time.isoformat(),))
        
        by_level = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor.execute(
            "SELECT COUNT(*) FROM logs WHERE timestamp >= ?",
            (start_time.isoformat(),)
        )
        total = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "total": total,
            "by_level": by_level,
            "error_rate": by_level.get("ERROR", 0) / total if total > 0 else 0
        }


class SystemMonitor:
    """系统监控"""
    
    def __init__(self, metrics_store: MetricsStore = None):
        self.metrics = metrics_store or MetricsStore()
        self._running = False
        self._thread: Optional[threading.Thread] = None
    
    def start(self, interval_seconds: int = 60):
        """启动监控"""
        if self._running:
            return
        
        self._running = True
        self._thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval_seconds,),
            daemon=True
        )
        self._thread.start()
    
    def stop(self):
        """停止监控"""
        self._running = False
    
    def _monitor_loop(self, interval: int):
        """监控循环"""
        while self._running:
            self._collect_metrics()
            time.sleep(interval)
    
    def _collect_metrics(self):
        """收集系统指标"""
        cpu_percent = psutil.cpu_percent(interval=1)
        self.metrics.gauge("system.cpu.percent", cpu_percent)
        
        memory = psutil.virtual_memory()
        self.metrics.gauge("system.memory.percent", memory.percent)
        self.metrics.gauge("system.memory.used_gb", memory.used / (1024**3))
        self.metrics.gauge("system.memory.available_gb", memory.available / (1024**3))
        
        disk = psutil.disk_usage('/')
        self.metrics.gauge("system.disk.percent", disk.percent)
        self.metrics.gauge("system.disk.used_gb", disk.used / (1024**3))
        
        try:
            net_io = psutil.net_io_counters()
            self.metrics.gauge("system.network.bytes_sent_mb", net_io.bytes_sent / (1024**2))
            self.metrics.gauge("system.network.bytes_recv_mb", net_io.bytes_recv / (1024**2))
        except Exception:
            pass
    
    def get_status(self) -> Dict[str, Any]:
        """获取系统状态"""
        return {
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory": {
                "percent": psutil.virtual_memory().percent,
                "used_gb": round(psutil.virtual_memory().used / (1024**3), 2),
                "available_gb": round(psutil.virtual_memory().available / (1024**3), 2)
            },
            "disk": {
                "percent": psutil.disk_usage('/').percent,
                "used_gb": round(psutil.disk_usage('/').used / (1024**3), 2)
            }
        }


class PerformanceTracker:
    """性能追踪"""
    
    def __init__(self, metrics_store: MetricsStore = None):
        self.metrics = metrics_store or MetricsStore()
    
    def track_time(self, operation: str, tags: Dict = None):
        """时间追踪装饰器"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start = time.time()
                try:
                    result = func(*args, **kwargs)
                    elapsed_ms = (time.time() - start) * 1000
                    self.metrics.timing(f"perf.{operation}", elapsed_ms, tags)
                    return result
                except Exception as e:
                    elapsed_ms = (time.time() - start) * 1000
                    self.metrics.timing(f"perf.{operation}.error", elapsed_ms, tags)
                    raise
            
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start = time.time()
                try:
                    result = await func(*args, **kwargs)
                    elapsed_ms = (time.time() - start) * 1000
                    self.metrics.timing(f"perf.{operation}", elapsed_ms, tags)
                    return result
                except Exception as e:
                    elapsed_ms = (time.time() - start) * 1000
                    self.metrics.timing(f"perf.{operation}.error", elapsed_ms, tags)
                    raise
            
            import asyncio
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            return wrapper
        
        return decorator
    
    def track_calls(self, operation: str, tags: Dict = None):
        """调用次数追踪装饰器"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                self.metrics.counter(f"calls.{operation}", tags=tags)
                return func(*args, **kwargs)
            
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                self.metrics.counter(f"calls.{operation}", tags=tags)
                return await func(*args, **kwargs)
            
            import asyncio
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            return wrapper
        
        return decorator


class MonitoringService:
    """监控服务 - 统一接口"""
    
    def __init__(self):
        self.metrics = MetricsStore()
        self.logs = LogStore()
        self.system = SystemMonitor(self.metrics)
        self.performance = PerformanceTracker(self.metrics)
    
    def start(self):
        """启动监控"""
        self.system.start()
    
    def stop(self):
        """停止监控"""
        self.system.stop()
    
    def record_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        latency_ms: float,
        user_id: str = None
    ):
        """记录请求"""
        tags = {
            "endpoint": endpoint,
            "method": method,
            "status": str(status_code)
        }
        
        self.metrics.counter("requests.total", tags=tags)
        self.metrics.timing("requests.latency", latency_ms, tags=tags)
        
        if status_code >= 400:
            self.metrics.counter("requests.errors", tags=tags)
    
    def record_model_inference(
        self,
        model: str,
        tokens: int,
        latency_ms: float,
        success: bool
    ):
        """记录模型推理"""
        tags = {"model": model, "success": str(success)}
        
        self.metrics.counter("model.inferences", tags=tags)
        self.metrics.histogram("model.tokens", tokens, tags=tags)
        self.metrics.timing("model.latency", latency_ms, tags=tags)
    
    def log_info(self, message: str, **extra):
        """记录信息日志"""
        self.logs.log("INFO", message, extra=extra)
    
    def log_error(self, message: str, exception: Exception = None, **extra):
        """记录错误日志"""
        exc_str = str(exception) if exception else None
        if exception:
            exc_str = f"{type(exception).__name__}: {str(exception)}\n{traceback.format_exc()}"
        self.logs.log("ERROR", message, exception=exc_str, extra=extra)
    
    def log_warning(self, message: str, **extra):
        """记录警告日志"""
        self.logs.log("WARNING", message, extra=extra)
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """获取仪表盘数据"""
        return {
            "system": self.system.get_status(),
            "requests": {
                "total_24h": self.metrics.get_stats("requests.total")["count"],
                "avg_latency_ms": self.metrics.get_stats("requests.latency")["avg"],
                "error_rate": self._calculate_error_rate()
            },
            "models": {
                "total_inferences_24h": self.metrics.get_stats("model.inferences")["count"],
                "avg_latency_ms": self.metrics.get_stats("model.latency")["avg"]
            },
            "logs": self.logs.get_stats(hours=24)
        }
    
    def _calculate_error_rate(self) -> float:
        total = self.metrics.get_stats("requests.total")["count"]
        errors = self.metrics.get_stats("requests.errors")["count"]
        return errors / total if total > 0 else 0


monitoring = MonitoringService()


def setup_logging():
    """设置日志"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('logs/app.log', encoding='utf-8')
        ]
    )

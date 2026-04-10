"""
异步任务队列 - 零成本实现
基于线程池/进程池，无需RabbitMQ/Celery
"""

import os
import json
import uuid
import sqlite3
import threading
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Callable, List
from dataclasses import dataclass, asdict
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, Future
from enum import Enum
import queue
import time


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(Enum):
    LOW = 1
    NORMAL = 5
    HIGH = 10
    URGENT = 20


@dataclass
class Task:
    id: str
    name: str
    func_name: str
    args: Dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.NORMAL
    result: Any = None
    error: str = None
    created_at: datetime = None
    started_at: datetime = None
    completed_at: datetime = None
    progress: float = 0.0
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.metadata is None:
            self.metadata = {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "func_name": self.func_name,
            "args": self.args,
            "status": self.status.value,
            "priority": self.priority.value,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "progress": self.progress,
            "metadata": self.metadata
        }


class TaskRegistry:
    """任务函数注册表"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._functions: Dict[str, Callable] = {}
        return cls._instance
    
    def register(self, name: str, func: Callable):
        """注册任务函数"""
        self._functions[name] = func
    
    def get(self, name: str) -> Optional[Callable]:
        """获取任务函数"""
        return self._functions.get(name)
    
    def list_tasks(self) -> List[str]:
        """列出所有注册的任务"""
        return list(self._functions.keys())


def task(name: str):
    """任务装饰器"""
    def decorator(func: Callable):
        registry = TaskRegistry()
        registry.register(name, func)
        return func
    return decorator


class TaskQueue:
    """任务队列 - 基于线程池"""
    
    def __init__(
        self,
        max_workers: int = 4,
        db_path: str = None,
        auto_start: bool = True
    ):
        self.max_workers = max_workers
        self.registry = TaskRegistry()
        
        if db_path is None:
            data_dir = Path("data/tasks")
            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(data_dir / "tasks.db")
        
        self.db_path = db_path
        self._init_db()
        
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._task_queue: queue.PriorityQueue = queue.PriorityQueue()
        self._futures: Dict[str, Future] = {}
        self._running = False
        self._worker_thread: Optional[threading.Thread] = None
        
        self._callbacks: Dict[str, List[Callable]] = {
            "on_complete": [],
            "on_error": [],
            "on_progress": []
        }
        
        if auto_start:
            self.start()
    
    def _init_db(self):
        """初始化数据库"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                func_name TEXT NOT NULL,
                args TEXT,
                status TEXT DEFAULT 'pending',
                priority INTEGER DEFAULT 5,
                result TEXT,
                error TEXT,
                created_at TEXT,
                started_at TEXT,
                completed_at TEXT,
                progress REAL DEFAULT 0.0,
                metadata TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def submit(
        self,
        func_name: str,
        args: Dict[str, Any] = None,
        name: str = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        metadata: Dict = None
    ) -> str:
        """提交任务"""
        task_id = str(uuid.uuid4())
        
        task = Task(
            id=task_id,
            name=name or func_name,
            func_name=func_name,
            args=args or {},
            priority=priority,
            metadata=metadata
        )
        
        self._save_task(task)
        
        self._task_queue.put((
            -priority.value,
            task.created_at.timestamp(),
            task_id
        ))
        
        return task_id
    
    def _save_task(self, task: Task):
        """保存任务到数据库"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO tasks 
            (id, name, func_name, args, status, priority, result, error,
             created_at, started_at, completed_at, progress, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            task.id,
            task.name,
            task.func_name,
            json.dumps(task.args, ensure_ascii=False),
            task.status.value,
            task.priority.value,
            json.dumps(task.result, ensure_ascii=False) if task.result else None,
            task.error,
            task.created_at.isoformat() if task.created_at else None,
            task.started_at.isoformat() if task.started_at else None,
            task.completed_at.isoformat() if task.completed_at else None,
            task.progress,
            json.dumps(task.metadata, ensure_ascii=False) if task.metadata else None
        ))
        
        conn.commit()
        conn.close()
    
    def _update_task_status(
        self,
        task_id: str,
        status: TaskStatus,
        result: Any = None,
        error: str = None,
        progress: float = None
    ):
        """更新任务状态"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        updates = ["status = ?"]
        values = [status.value]
        
        if result is not None:
            updates.append("result = ?")
            values.append(json.dumps(result, ensure_ascii=False))
        
        if error is not None:
            updates.append("error = ?")
            values.append(error)
        
        if progress is not None:
            updates.append("progress = ?")
            values.append(progress)
        
        if status == TaskStatus.RUNNING:
            updates.append("started_at = ?")
            values.append(datetime.utcnow().isoformat())
        
        if status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
            updates.append("completed_at = ?")
            values.append(datetime.utcnow().isoformat())
        
        values.append(task_id)
        
        cursor.execute(
            f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?",
            values
        )
        
        conn.commit()
        conn.close()
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return self._row_to_task(row)
        return None
    
    def _row_to_task(self, row: sqlite3.Row) -> Task:
        """数据库行转Task对象"""
        return Task(
            id=row['id'],
            name=row['name'],
            func_name=row['func_name'],
            args=json.loads(row['args']) if row['args'] else {},
            status=TaskStatus(row['status']),
            priority=TaskPriority(row['priority']),
            result=json.loads(row['result']) if row['result'] else None,
            error=row['error'],
            created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None,
            started_at=datetime.fromisoformat(row['started_at']) if row['started_at'] else None,
            completed_at=datetime.fromisoformat(row['completed_at']) if row['completed_at'] else None,
            progress=row['progress'] or 0.0,
            metadata=json.loads(row['metadata']) if row['metadata'] else {}
        )
    
    def _execute_task(self, task_id: str):
        """执行任务"""
        task = self.get_task(task_id)
        if not task:
            return
        
        func = self.registry.get(task.func_name)
        if not func:
            self._update_task_status(
                task_id,
                TaskStatus.FAILED,
                error=f"未找到任务函数: {task.func_name}"
            )
            return
        
        self._update_task_status(task_id, TaskStatus.RUNNING)
        
        try:
            result = func(**task.args)
            self._update_task_status(task_id, TaskStatus.COMPLETED, result=result)
            
            for callback in self._callbacks["on_complete"]:
                try:
                    callback(task_id, result)
                except Exception:
                    pass
        
        except Exception as e:
            self._update_task_status(task_id, TaskStatus.FAILED, error=str(e))
            
            for callback in self._callbacks["on_error"]:
                try:
                    callback(task_id, str(e))
                except Exception:
                    pass
    
    def _worker(self):
        """工作线程"""
        while self._running:
            try:
                priority, timestamp, task_id = self._task_queue.get(timeout=1.0)
                
                task = self.get_task(task_id)
                if task and task.status == TaskStatus.PENDING:
                    future = self._executor.submit(self._execute_task, task_id)
                    self._futures[task_id] = future
            
            except queue.Empty:
                continue
            except Exception:
                pass
    
    def start(self):
        """启动任务队列"""
        if self._running:
            return
        
        self._running = True
        self._worker_thread = threading.Thread(target=self._worker, daemon=True)
        self._worker_thread.start()
    
    def stop(self):
        """停止任务队列"""
        self._running = False
        self._executor.shutdown(wait=False)
    
    def cancel(self, task_id: str) -> bool:
        """取消任务"""
        task = self.get_task(task_id)
        if not task:
            return False
        
        if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
            return False
        
        if task_id in self._futures:
            self._futures[task_id].cancel()
        
        self._update_task_status(task_id, TaskStatus.CANCELLED)
        return True
    
    def get_result(self, task_id: str, timeout: float = None) -> Any:
        """获取任务结果（阻塞）"""
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        if task.status == TaskStatus.COMPLETED:
            return task.result
        
        if task.status == TaskStatus.FAILED:
            raise RuntimeError(task.error)
        
        if task_id in self._futures:
            try:
                return self._futures[task_id].result(timeout=timeout)
            except Exception as e:
                raise RuntimeError(str(e))
        
        raise RuntimeError("任务未执行")
    
    def wait(self, task_id: str, timeout: float = None) -> Task:
        """等待任务完成"""
        start_time = time.time()
        
        while True:
            task = self.get_task(task_id)
            if not task:
                raise ValueError(f"任务不存在: {task_id}")
            
            if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                return task
            
            if timeout and (time.time() - start_time) > timeout:
                raise TimeoutError("等待超时")
            
            time.sleep(0.1)
    
    def list_tasks(
        self,
        status: TaskStatus = None,
        limit: int = 100
    ) -> List[Task]:
        """列出任务"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        if status:
            cursor.execute(
                "SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?",
                (status.value, limit)
            )
        else:
            cursor.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?",
                (limit,)
            )
        
        rows = cursor.fetchall()
        conn.close()
        
        return [self._row_to_task(row) for row in rows]
    
    def on_complete(self, callback: Callable):
        """注册完成回调"""
        self._callbacks["on_complete"].append(callback)
    
    def on_error(self, callback: Callable):
        """注册错误回调"""
        self._callbacks["on_error"].append(callback)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        stats = {}
        for status in TaskStatus:
            cursor.execute(
                "SELECT COUNT(*) FROM tasks WHERE status = ?",
                (status.value,)
            )
            stats[status.value] = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "total_tasks": sum(stats.values()),
            "by_status": stats,
            "queue_size": self._task_queue.qsize(),
            "active_workers": len([f for f in self._futures.values() if not f.done()])
        }


task_queue = TaskQueue()


@task("generate_ppt")
def generate_ppt_task(topic: str, style: str = "tech", slides: int = 10):
    """PPT生成任务"""
    time.sleep(2)
    return {
        "topic": topic,
        "style": style,
        "slides": slides,
        "file_path": f"output/ppt/{topic}.pptx"
    }


@task("train_model")
def train_model_task(config: Dict[str, Any]):
    """模型训练任务"""
    time.sleep(5)
    return {
        "status": "completed",
        "model_path": "output/models/latest.pt"
    }


@task("process_document")
def process_document_task(file_path: str, operations: List[str]):
    """文档处理任务"""
    time.sleep(1)
    return {
        "file_path": file_path,
        "operations": operations,
        "result": "processed"
    }

"""
任务调度器

实现：
- 任务队列管理
- 并发控制
- 优先级调度
- 任务状态追踪
"""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, Coroutine
from collections import defaultdict
import threading
import heapq


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
    """任务"""
    task_id: str
    task_type: str
    params: Dict[str, Any]
    user_id: str
    session_id: Optional[str] = None
    priority: TaskPriority = TaskPriority.NORMAL
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    progress: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __lt__(self, other):
        return self.priority.value > other.priority.value
    
    def to_dict(self) -> Dict:
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "params": self.params,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "priority": self.priority.value,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "progress": self.progress,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class TaskResult:
    """任务结果"""
    task_id: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: float = 0.0


class TaskQueue:
    """任务队列"""
    
    def __init__(self, max_concurrent: int = 5):
        self.queue: List[Task] = []
        self.running: Dict[str, Task] = {}
        self.completed: Dict[str, Task] = {}
        self.max_concurrent = max_concurrent
        self._lock = threading.Lock()
        self._handlers: Dict[str, Callable] = {}
        self._event = asyncio.Event()
    
    def register_handler(self, task_type: str, handler: Callable[[Task], Coroutine]):
        """注册任务处理器"""
        self._handlers[task_type] = handler
    
    def submit(
        self,
        task_type: str,
        params: Dict[str, Any],
        user_id: str,
        session_id: Optional[str] = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        metadata: Optional[Dict] = None
    ) -> Task:
        """提交任务"""
        task = Task(
            task_id=str(uuid.uuid4())[:12],
            task_type=task_type,
            params=params,
            user_id=user_id,
            session_id=session_id,
            priority=priority,
            metadata=metadata or {},
        )
        
        with self._lock:
            heapq.heappush(self.queue, task)
        
        self._event.set()
        return task
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        with self._lock:
            if task_id in self.running:
                return self.running[task_id]
            if task_id in self.completed:
                return self.completed[task_id]
        
        for task in self.queue:
            if task.task_id == task_id:
                return task
        
        return None
    
    def cancel(self, task_id: str) -> bool:
        """取消任务"""
        with self._lock:
            if task_id in self.running:
                self.running[task_id].status = TaskStatus.CANCELLED
                return True
            
            for i, task in enumerate(self.queue):
                if task.task_id == task_id:
                    self.queue.pop(i)
                    heapq.heapify(self.queue)
                    task.status = TaskStatus.CANCELLED
                    self.completed[task_id] = task
                    return True
        
        return False
    
    def get_pending_count(self) -> int:
        """获取待处理任务数"""
        return len(self.queue)
    
    def get_running_count(self) -> int:
        """获取运行中任务数"""
        return len(self.running)
    
    def get_user_tasks(self, user_id: str) -> List[Task]:
        """获取用户任务"""
        tasks = []
        
        with self._lock:
            for task in self.running.values():
                if task.user_id == user_id:
                    tasks.append(task)
            
            for task in self.completed.values():
                if task.user_id == user_id:
                    tasks.append(task)
        
        for task in self.queue:
            if task.user_id == user_id:
                tasks.append(task)
        
        return tasks


class TaskOrchestrator:
    """任务调度器"""
    
    def __init__(self, max_concurrent: int = 5):
        self.queue = TaskQueue(max_concurrent)
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    async def start(self):
        """启动调度器"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
    
    async def stop(self):
        """停止调度器"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    async def _run_loop(self):
        """运行循环"""
        while self._running:
            try:
                await self._process_next()
                await asyncio.sleep(0.1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Task processing error: {e}")
                await asyncio.sleep(1)
    
    async def _process_next(self):
        """处理下一个任务"""
        if self.queue.get_running_count() >= self.queue.max_concurrent:
            return
        
        if self.queue.get_pending_count() == 0:
            await asyncio.sleep(0.5)
            return
        
        with self.queue._lock:
            if not self.queue.queue:
                return
            
            task = heapq.heappop(self.queue.queue)
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.now()
            self.queue.running[task.task_id] = task
        
        try:
            handler = self.queue._handlers.get(task.task_type)
            
            if handler:
                result = await handler(task)
                task.result = result
                task.status = TaskStatus.COMPLETED
            else:
                task.result = await self._default_handler(task)
                task.status = TaskStatus.COMPLETED
        
        except Exception as e:
            task.error = str(e)
            task.status = TaskStatus.FAILED
        
        finally:
            task.completed_at = datetime.now()
            
            with self.queue._lock:
                del self.queue.running[task.task_id]
                self.queue.completed[task.task_id] = task
    
    async def _default_handler(self, task: Task) -> Any:
        """默认处理器"""
        await asyncio.sleep(1)
        return {"message": f"Task {task.task_id} completed", "params": task.params}
    
    def submit_task(
        self,
        task_type: str,
        params: Dict[str, Any],
        user_id: str,
        session_id: Optional[str] = None,
        priority: TaskPriority = TaskPriority.NORMAL
    ) -> Task:
        """提交任务"""
        return self.queue.submit(
            task_type=task_type,
            params=params,
            user_id=user_id,
            session_id=session_id,
            priority=priority,
        )
    
    def get_task_status(self, task_id: str) -> Optional[Dict]:
        """获取任务状态"""
        task = self.queue.get_task(task_id)
        if task:
            return task.to_dict()
        return None
    
    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        return self.queue.cancel(task_id)
    
    def get_user_tasks(self, user_id: str) -> List[Dict]:
        """获取用户任务"""
        tasks = self.queue.get_user_tasks(user_id)
        return [t.to_dict() for t in tasks]
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "pending": self.queue.get_pending_count(),
            "running": self.queue.get_running_count(),
            "completed": len(self.queue.completed),
            "max_concurrent": self.queue.max_concurrent,
        }


orchestrator = TaskOrchestrator()


async def initialize_orchestrator():
    """初始化调度器"""
    await orchestrator.start()


async def shutdown_orchestrator():
    """关闭调度器"""
    await orchestrator.stop()


# ==================== DAG工作流支持 ====================

class DAGNode:
    """DAG节点"""
    def __init__(self, node_id: str, task_type: str, params: Dict[str, Any]):
        self.node_id = node_id
        self.task_type = task_type
        self.params = params
        self.dependencies: List[str] = []
        self.status = TaskStatus.PENDING
        self.result: Optional[Any] = None
        self.error: Optional[str] = None


class DAGWorkflow:
    """DAG工作流"""
    def __init__(self, workflow_id: str, name: str):
        self.workflow_id = workflow_id
        self.name = name
        self.nodes: Dict[str, DAGNode] = {}
        self.edges: List[tuple] = []  # (source_id, target_id)
    
    def add_node(self, node: DAGNode):
        """添加节点"""
        self.nodes[node.node_id] = node
    
    def add_edge(self, source_id: str, target_id: str):
        """添加边"""
        self.edges.append((source_id, target_id))
        if target_id in self.nodes:
            self.nodes[target_id].dependencies.append(source_id)
    
    def get_ready_nodes(self) -> List[DAGNode]:
        """获取可以执行的节点"""
        ready = []
        for node in self.nodes.values():
            if node.status != TaskStatus.PENDING:
                continue
            
            # 检查依赖是否完成
            deps_completed = all(
                self.nodes[dep_id].status == TaskStatus.COMPLETED
                for dep_id in node.dependencies
                if dep_id in self.nodes
            )
            
            if deps_completed:
                ready.append(node)
        
        return ready
    
    def is_completed(self) -> bool:
        """检查工作流是否完成"""
        return all(
            node.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]
            for node in self.nodes.values()
        )


class DAGTaskOrchestrator:
    """DAG工作流任务调度器"""
    
    def __init__(self, base_orchestrator: TaskOrchestrator):
        self.base_orchestrator = base_orchestrator
        self.workflows: Dict[str, DAGWorkflow] = {}
        self.workflow_instances: Dict[str, Dict] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    def create_workflow(self, workflow_id: str, name: str) -> DAGWorkflow:
        """创建工作流"""
        workflow = DAGWorkflow(workflow_id, name)
        self.workflows[workflow_id] = workflow
        return workflow
    
    def get_workflow(self, workflow_id: str) -> Optional[DAGWorkflow]:
        """获取工作流"""
        return self.workflows.get(workflow_id)
    
    async def execute_workflow(self, workflow_id: str, user_id: str, 
                              context: Optional[Dict[str, Any]] = None) -> str:
        """执行工作流"""
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            raise ValueError(f"工作流不存在: {workflow_id}")
        
        # 创建工作流实例
        instance_id = str(uuid.uuid4())[:12]
        self.workflow_instances[instance_id] = {
            "workflow_id": workflow_id,
            "user_id": user_id,
            "context": context or {},
            "status": "running",
            "started_at": datetime.now().isoformat(),
            "completed_at": None,
            "results": {}
        }
        
        # 执行工作流
        await self._execute_workflow_instance(instance_id, workflow, context or {})
        
        return instance_id
    
    async def _execute_workflow_instance(self, instance_id: str, 
                                        workflow: DAGWorkflow, 
                                        context: Dict[str, Any]):
        """执行工作流实例"""
        instance = self.workflow_instances[instance_id]
        
        try:
            # 循环执行直到完成
            while not workflow.is_completed():
                # 获取可执行的节点
                ready_nodes = workflow.get_ready_nodes()
                
                if not ready_nodes:
                    # 检查是否有失败的节点
                    failed = [n for n in workflow.nodes.values() 
                             if n.status == TaskStatus.FAILED]
                    if failed:
                        raise Exception(f"工作流执行失败，节点失败: {[n.node_id for n in failed]}")
                    
                    # 等待一段时间
                    await asyncio.sleep(0.1)
                    continue
                
                # 并行执行可执行的节点
                tasks = [
                    self._execute_node(instance_id, node, context)
                    for node in ready_nodes
                ]
                await asyncio.gather(*tasks)
            
            # 更新实例状态
            instance["status"] = "completed"
            instance["completed_at"] = datetime.now().isoformat()
            
            # 收集结果
            for node in workflow.nodes.values():
                instance["results"][node.node_id] = {
                    "status": node.status.value,
                    "result": node.result,
                    "error": node.error
                }
        
        except Exception as e:
            instance["status"] = "failed"
            instance["error"] = str(e)
            instance["completed_at"] = datetime.now().isoformat()
    
    async def _execute_node(self, instance_id: str, node: DAGNode, 
                           context: Dict[str, Any]):
        """执行节点"""
        node.status = TaskStatus.RUNNING
        
        try:
            # 合并上下文
            params = {**node.params, **context}
            
            # 提交任务到基础调度器
            task = self.base_orchestrator.submit_task(
                task_type=node.task_type,
                params=params,
                user_id=self.workflow_instances[instance_id]["user_id"],
                session_id=instance_id
            )
            
            # 等待任务完成
            while task.status not in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                await asyncio.sleep(0.1)
            
            # 更新节点状态
            node.status = task.status
            node.result = task.result
            node.error = task.error
        
        except Exception as e:
            node.status = TaskStatus.FAILED
            node.error = str(e)
    
    def get_workflow_instance(self, instance_id: str) -> Optional[Dict]:
        """获取工作流实例"""
        return self.workflow_instances.get(instance_id)
    
    def list_workflows(self) -> List[Dict]:
        """列出所有工作流"""
        return [
            {
                "workflow_id": w.workflow_id,
                "name": w.name,
                "node_count": len(w.nodes),
                "edge_count": len(w.edges)
            }
            for w in self.workflows.values()
        ]


# 创建DAG调度器实例
dag_orchestrator = DAGTaskOrchestrator(orchestrator)

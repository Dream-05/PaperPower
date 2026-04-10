"""
多智能体编排器 - 核心调度系统
Multi-Agent Orchestrator - Core Scheduling System
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Type
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid
import json

from .message_bus import MessageBus, AgentMessage, MessageType, MessagePriority, get_message_bus

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """任务状态"""
    PENDING = "pending"
    PLANNING = "planning"
    EXECUTING = "executing"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    """任务定义"""
    id: str
    description: str
    task_type: str
    priority: int = 1
    status: TaskStatus = TaskStatus.PENDING
    assigned_agent: Optional[str] = None
    subtasks: List['Task'] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    result: Any = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "description": self.description,
            "task_type": self.task_type,
            "priority": self.priority,
            "status": self.status.value,
            "assigned_agent": self.assigned_agent,
            "subtasks": [st.to_dict() for st in self.subtasks],
            "dependencies": self.dependencies,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "metadata": self.metadata
        }


@dataclass
class AgentCapability:
    """智能体能力描述"""
    name: str
    description: str
    task_types: List[str]
    priority: int = 1
    max_concurrent_tasks: int = 3
    current_tasks: int = 0


class MultiAgentOrchestrator:
    """多智能体编排器"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.message_bus = get_message_bus()
        self.agents: Dict[str, Any] = {}
        self.agent_capabilities: Dict[str, AgentCapability] = {}
        self.tasks: Dict[str, Task] = {}
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
        self._task_counter = 0
        self._lock = asyncio.Lock()
        
        self._execution_history: List[Dict[str, Any]] = []
        self._max_history = 1000
        
        logger.info("MultiAgentOrchestrator initialized")
    
    def _generate_task_id(self) -> str:
        self._task_counter += 1
        return f"task_{datetime.now().strftime('%Y%m%d%H%M%S')}_{self._task_counter}"
    
    async def register_agent(self, agent: Any, capability: AgentCapability):
        """注册智能体"""
        agent_name = capability.name
        self.agents[agent_name] = agent
        self.agent_capabilities[agent_name] = capability
        await self.message_bus.register_agent(agent_name)
        logger.info(f"Agent registered: {agent_name} - {capability.description}")
    
    async def unregister_agent(self, agent_name: str):
        """注销智能体"""
        if agent_name in self.agents:
            del self.agents[agent_name]
            del self.agent_capabilities[agent_name]
            await self.message_bus.unregister_agent(agent_name)
            logger.info(f"Agent unregistered: {agent_name}")
    
    async def submit_task(self, description: str, task_type: str = "general",
                         priority: int = 1, metadata: Optional[Dict] = None) -> str:
        """提交任务"""
        task_id = self._generate_task_id()
        task = Task(
            id=task_id,
            description=description,
            task_type=task_type,
            priority=priority,
            metadata=metadata or {}
        )
        
        async with self._lock:
            self.tasks[task_id] = task
            await self.task_queue.put(task)
        
        logger.info(f"Task submitted: {task_id} - {description}")
        return task_id
    
    async def submit_complex_task(self, description: str, subtasks: List[Dict[str, Any]],
                                  priority: int = 1) -> str:
        """提交复杂任务（包含子任务）"""
        task_id = self._generate_task_id()
        task = Task(
            id=task_id,
            description=description,
            task_type="complex",
            priority=priority
        )
        
        for subtask_data in subtasks:
            subtask = Task(
                id=f"{task_id}_sub_{len(task.subtasks)}",
                description=subtask_data.get("description", ""),
                task_type=subtask_data.get("task_type", "general"),
                priority=subtask_data.get("priority", priority),
                dependencies=subtask_data.get("dependencies", [])
            )
            task.subtasks.append(subtask)
        
        async with self._lock:
            self.tasks[task_id] = task
            await self.task_queue.put(task)
        
        logger.info(f"Complex task submitted: {task_id} with {len(subtasks)} subtasks")
        return task_id
    
    def _find_best_agent(self, task_type: str) -> Optional[str]:
        """为任务类型找到最佳智能体"""
        best_agent = None
        best_priority = -1
        
        for agent_name, capability in self.agent_capabilities.items():
            if task_type in capability.task_types:
                if capability.current_tasks < capability.max_concurrent_tasks:
                    if capability.priority > best_priority:
                        best_agent = agent_name
                        best_priority = capability.priority
        
        return best_agent
    
    async def _dispatch_task(self, task: Task) -> bool:
        """分发任务到智能体"""
        agent_name = self._find_best_agent(task.task_type)
        
        if not agent_name:
            logger.warning(f"No available agent for task type: {task.task_type}")
            return False
        
        task.assigned_agent = agent_name
        task.status = TaskStatus.EXECUTING
        task.started_at = datetime.now()
        
        self.agent_capabilities[agent_name].current_tasks += 1
        self.message_bus.update_agent_status(agent_name, "working")
        
        message = AgentMessage(
            id=f"msg_{task.id}",
            sender="orchestrator",
            receiver=agent_name,
            message_type=MessageType.TASK_ASSIGN,
            content=task.to_dict(),
            priority=MessagePriority.NORMAL if task.priority <= 1 else MessagePriority.HIGH,
            requires_response=True
        )
        
        await self.message_bus.send(message)
        logger.info(f"Task dispatched: {task.id} -> {agent_name}")
        return True
    
    async def _handle_task_result(self, message: AgentMessage):
        """处理任务结果"""
        content = message.content
        task_id = content.get("task_id")
        
        if task_id not in self.tasks:
            logger.warning(f"Unknown task result: {task_id}")
            return
        
        task = self.tasks[task_id]
        task.result = content.get("result")
        task.error = content.get("error")
        
        if task.assigned_agent and task.assigned_agent in self.agent_capabilities:
            self.agent_capabilities[task.assigned_agent].current_tasks -= 1
        
        if task.error:
            task.status = TaskStatus.FAILED
            logger.error(f"Task failed: {task_id} - {task.error}")
        else:
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now()
            logger.info(f"Task completed: {task_id}")
        
        self._add_to_history({
            "task_id": task_id,
            "agent": task.assigned_agent,
            "status": task.status.value,
            "duration": (task.completed_at - task.started_at).total_seconds() if task.completed_at and task.started_at else None
        })
    
    def _add_to_history(self, record: Dict[str, Any]):
        """添加执行记录"""
        self._execution_history.append(record)
        if len(self._execution_history) > self._max_history:
            self._execution_history.pop(0)
    
    async def start(self):
        """启动编排器"""
        self._running = True
        logger.info("Orchestrator started")
        
        asyncio.create_task(self._process_queue())
        asyncio.create_task(self._listen_for_results())
    
    async def stop(self):
        """停止编排器"""
        self._running = False
        logger.info("Orchestrator stopped")
    
    async def _process_queue(self):
        """处理任务队列"""
        while self._running:
            try:
                task = await asyncio.wait_for(self.task_queue.get(), timeout=1.0)
                await self._dispatch_task(task)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing queue: {e}")
    
    async def _listen_for_results(self):
        """监听智能体返回的结果"""
        while self._running:
            try:
                message = await self.message_bus.receive("orchestrator", timeout=1.0)
                if message and message.message_type == MessageType.TASK_RESULT:
                    await self._handle_task_result(message)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error listening for results: {e}")
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态"""
        if task_id in self.tasks:
            return self.tasks[task_id].to_dict()
        return None
    
    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """获取所有任务"""
        return [task.to_dict() for task in self.tasks.values()]
    
    def get_agent_status(self) -> Dict[str, Any]:
        """获取所有智能体状态"""
        return {
            name: {
                "capability": cap.description,
                "task_types": cap.task_types,
                "current_tasks": cap.current_tasks,
                "max_tasks": cap.max_concurrent_tasks,
                "available": cap.current_tasks < cap.max_concurrent_tasks
            }
            for name, cap in self.agent_capabilities.items()
        }
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        total = len(self.tasks)
        completed = sum(1 for t in self.tasks.values() if t.status == TaskStatus.COMPLETED)
        failed = sum(1 for t in self.tasks.values() if t.status == TaskStatus.FAILED)
        pending = sum(1 for t in self.tasks.values() if t.status == TaskStatus.PENDING)
        executing = sum(1 for t in self.tasks.values() if t.status == TaskStatus.EXECUTING)
        
        return {
            "total_tasks": total,
            "completed": completed,
            "failed": failed,
            "pending": pending,
            "executing": executing,
            "success_rate": completed / total if total > 0 else 0,
            "agents": len(self.agents),
            "message_bus": self.message_bus.get_statistics()
        }
    
    async def process_user_instruction(self, instruction: str) -> Dict[str, Any]:
        """处理用户指令 - 主入口"""
        task_id = await self.submit_task(
            description=instruction,
            task_type="user_instruction",
            priority=10,
            metadata={"source": "user", "timestamp": datetime.now().isoformat()}
        )
        
        return {
            "task_id": task_id,
            "status": "submitted",
            "message": f"任务已提交: {instruction}"
        }


_orchestrator: Optional[MultiAgentOrchestrator] = None


def get_orchestrator() -> MultiAgentOrchestrator:
    """获取全局编排器实例"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MultiAgentOrchestrator()
    return _orchestrator

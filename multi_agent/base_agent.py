"""
基础智能体类 - 所有智能体的基类
Base Agent Class
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from abc import ABC, abstractmethod
from enum import Enum
import json

from .message_bus import MessageBus, AgentMessage, MessageType, MessagePriority, get_message_bus

logger = logging.getLogger(__name__)


class AgentState(Enum):
    """智能体状态"""
    IDLE = "idle"
    WORKING = "working"
    WAITING = "waiting"
    ERROR = "error"


@dataclass
class AgentResult:
    """智能体执行结果"""
    success: bool
    output: Any
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    """基础智能体类"""
    
    def __init__(self, name: str, description: str, task_types: List[str], config: Optional[Dict[str, Any]] = None):
        self.name = name
        self.description = description
        self.task_types = task_types
        self.config = config or {}
        self.state = AgentState.IDLE
        self.message_bus = get_message_bus()
        self.message_queue: Optional[asyncio.Queue] = None
        self.tools: Dict[str, Any] = {}
        self.memory: List[Dict[str, Any]] = []
        self.current_task: Optional[Dict[str, Any]] = None
        self._running = False
        self._task_count = 0
        self._success_count = 0
        
        logger.info(f"Agent initialized: {name}")
    
    async def start(self):
        """启动智能体"""
        self.message_queue = await self.message_bus.register_agent(self.name)
        self._running = True
        self.message_bus.update_agent_status(self.name, "idle")
        
        asyncio.create_task(self._message_loop())
        logger.info(f"Agent started: {self.name}")
    
    async def stop(self):
        """停止智能体"""
        self._running = False
        await self.message_bus.unregister_agent(self.name)
        logger.info(f"Agent stopped: {self.name}")
    
    async def _message_loop(self):
        """消息处理循环"""
        while self._running:
            try:
                message = await self.message_bus.receive(self.name, timeout=1.0)
                if message:
                    await self._handle_message(message)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"{self.name} message loop error: {e}")
                await asyncio.sleep(1)
    
    async def _handle_message(self, message: AgentMessage):
        """处理接收到的消息"""
        if message.message_type == MessageType.TASK_ASSIGN:
            await self._handle_task(message)
        elif message.message_type == MessageType.QUERY:
            await self._handle_query(message)
        elif message.message_type == MessageType.COLLABORATION_REQUEST:
            await self._handle_collaboration(message)
    
    async def _handle_task(self, message: AgentMessage):
        """处理任务"""
        self.state = AgentState.WORKING
        self.message_bus.update_agent_status(self.name, "working")
        self.current_task = message.content
        
        task_id = message.content.get("id", "unknown")
        logger.info(f"{self.name} processing task: {task_id}")
        
        try:
            result = await self.execute(message.content)
            
            self._task_count += 1
            if result.success:
                self._success_count += 1
            
            self._add_to_memory({
                "task_id": task_id,
                "success": result.success,
                "timestamp": datetime.now().isoformat()
            })
            
            response = AgentMessage(
                id=f"result_{task_id}",
                sender=self.name,
                receiver=message.sender,
                message_type=MessageType.TASK_RESULT,
                content={
                    "task_id": task_id,
                    "result": result.output,
                    "error": result.error,
                    "agent": self.name
                },
                correlation_id=message.id
            )
            await self.message_bus.send(response)
            
        except Exception as e:
            logger.error(f"{self.name} task execution error: {e}")
            error_response = AgentMessage(
                id=f"result_{task_id}",
                sender=self.name,
                receiver=message.sender,
                message_type=MessageType.TASK_RESULT,
                content={
                    "task_id": task_id,
                    "result": None,
                    "error": str(e),
                    "agent": self.name
                },
                correlation_id=message.id
            )
            await self.message_bus.send(error_response)
        
        finally:
            self.state = AgentState.IDLE
            self.message_bus.update_agent_status(self.name, "idle")
            self.current_task = None
    
    async def _handle_query(self, message: AgentMessage):
        """处理查询"""
        response_content = await self.answer_query(message.content)
        
        response = AgentMessage(
            id=f"response_{message.id}",
            sender=self.name,
            receiver=message.sender,
            message_type=MessageType.RESPONSE,
            content=response_content,
            correlation_id=message.id
        )
        await self.message_bus.send(response)
    
    async def _handle_collaboration(self, message: AgentMessage):
        """处理协作请求"""
        result = await self.collaborate(message.content)
        
        response = AgentMessage(
            id=f"collab_{message.id}",
            sender=self.name,
            receiver=message.sender,
            message_type=MessageType.RESPONSE,
            content=result,
            correlation_id=message.id
        )
        await self.message_bus.send(response)
    
    @abstractmethod
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行任务 - 子类必须实现"""
        pass
    
    async def answer_query(self, query: Any) -> Any:
        """回答查询"""
        return {"answer": "I can help with that", "agent": self.name}
    
    async def collaborate(self, request: Any) -> Any:
        """协作处理"""
        return {"status": "collaboration accepted", "agent": self.name}
    
    async def send_message(self, receiver: str, message_type: MessageType, content: Any,
                          requires_response: bool = False) -> str:
        """发送消息给其他智能体"""
        message = AgentMessage(
            id=f"{self.name}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{len(self.memory)}",
            sender=self.name,
            receiver=receiver,
            message_type=message_type,
            content=content,
            requires_response=requires_response
        )
        await self.message_bus.send(message)
        return message.id
    
    async def request_help(self, target_agent: str, task_data: Dict[str, Any]) -> Any:
        """请求其他智能体帮助"""
        message = AgentMessage(
            id=f"help_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            sender=self.name,
            receiver=target_agent,
            message_type=MessageType.COLLABORATION_REQUEST,
            content=task_data,
            requires_response=True
        )
        await self.message_bus.send(message)
        
        response = await self.message_bus.receive(self.name, timeout=30.0)
        if response and response.correlation_id == message.id:
            return response.content
        return None
    
    def register_tool(self, name: str, tool: Any):
        """注册工具"""
        self.tools[name] = tool
        logger.info(f"{self.name} registered tool: {name}")
    
    def _add_to_memory(self, entry: Dict[str, Any]):
        """添加到记忆"""
        entry['timestamp'] = datetime.now().isoformat()
        self.memory.append(entry)
        if len(self.memory) > 100:
            self.memory.pop(0)
    
    def get_status(self) -> Dict[str, Any]:
        """获取智能体状态"""
        return {
            "name": self.name,
            "description": self.description,
            "task_types": self.task_types,
            "state": self.state.value,
            "tools_count": len(self.tools),
            "memory_count": len(self.memory),
            "current_task": self.current_task is not None,
            "task_count": self._task_count,
            "success_count": self._success_count,
            "success_rate": self._success_count / self._task_count if self._task_count > 0 else 0
        }
    
    def clear_memory(self):
        """清空记忆"""
        self.memory = []
        logger.info(f"{self.name} cleared memory")

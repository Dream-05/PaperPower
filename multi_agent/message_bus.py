"""
消息总线 - 智能体间通信核心
Message Bus for Inter-Agent Communication
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from collections import defaultdict
import json

logger = logging.getLogger(__name__)


class MessageType(Enum):
    """消息类型"""
    TASK_ASSIGN = "task_assign"
    TASK_RESULT = "task_result"
    QUERY = "query"
    RESPONSE = "response"
    FEEDBACK = "feedback"
    BROADCAST = "broadcast"
    ERROR = "error"
    STATUS_UPDATE = "status_update"
    COLLABORATION_REQUEST = "collaboration_request"


class MessagePriority(Enum):
    """消息优先级"""
    LOW = 1
    NORMAL = 5
    HIGH = 10
    URGENT = 20


@dataclass
class AgentMessage:
    """智能体消息"""
    id: str
    sender: str
    receiver: str
    message_type: MessageType
    content: Any
    priority: MessagePriority = MessagePriority.NORMAL
    requires_response: bool = False
    correlation_id: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "sender": self.sender,
            "receiver": self.receiver,
            "message_type": self.message_type.value,
            "content": self.content,
            "priority": self.priority.value,
            "requires_response": self.requires_response,
            "correlation_id": self.correlation_id,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AgentMessage':
        return cls(
            id=data["id"],
            sender=data["sender"],
            receiver=data["receiver"],
            message_type=MessageType(data["message_type"]),
            content=data["content"],
            priority=MessagePriority(data.get("priority", 5)),
            requires_response=data.get("requires_response", False),
            correlation_id=data.get("correlation_id"),
            timestamp=datetime.fromisoformat(data["timestamp"]) if isinstance(data["timestamp"], str) else data["timestamp"],
            metadata=data.get("metadata", {})
        )


class MessageBus:
    """消息总线 - 智能体间异步通信"""
    
    def __init__(self, max_queue_size: int = 1000):
        self.max_queue_size = max_queue_size
        self._queues: Dict[str, asyncio.Queue] = {}
        self._subscribers: Dict[str, List[Callable]] = defaultdict(list)
        self._message_history: List[AgentMessage] = []
        self._max_history = 1000
        self._message_counter = 0
        self._lock = asyncio.Lock()
        self._agent_status: Dict[str, str] = {}
        logger.info("MessageBus initialized")
    
    def _generate_message_id(self) -> str:
        self._message_counter += 1
        return f"msg_{datetime.now().strftime('%Y%m%d%H%M%S')}_{self._message_counter}"
    
    async def register_agent(self, agent_name: str) -> asyncio.Queue:
        """注册智能体，返回其消息队列"""
        async with self._lock:
            if agent_name not in self._queues:
                self._queues[agent_name] = asyncio.Queue(maxsize=self.max_queue_size)
                self._agent_status[agent_name] = "idle"
                logger.info(f"Agent registered: {agent_name}")
            return self._queues[agent_name]
    
    async def unregister_agent(self, agent_name: str):
        """注销智能体"""
        async with self._lock:
            if agent_name in self._queues:
                del self._queues[agent_name]
                del self._agent_status[agent_name]
                logger.info(f"Agent unregistered: {agent_name}")
    
    async def send(self, message: AgentMessage) -> bool:
        """发送消息"""
        if message.receiver == "broadcast":
            return await self._broadcast(message)
        
        if message.receiver not in self._queues:
            logger.warning(f"Receiver not found: {message.receiver}")
            return False
        
        try:
            await self._queues[message.receiver].put(message)
            self._add_to_history(message)
            logger.debug(f"Message sent: {message.sender} -> {message.receiver} [{message.message_type.value}]")
            return True
        except asyncio.QueueFull:
            logger.error(f"Queue full for agent: {message.receiver}")
            return False
    
    async def _broadcast(self, message: AgentMessage):
        """广播消息给所有智能体"""
        success = True
        for agent_name, queue in self._queues.items():
            if agent_name != message.sender:
                try:
                    broadcast_msg = AgentMessage(
                        id=self._generate_message_id(),
                        sender=message.sender,
                        receiver=agent_name,
                        message_type=message.message_type,
                        content=message.content,
                        priority=message.priority,
                        requires_response=message.requires_response,
                        correlation_id=message.correlation_id,
                        metadata=message.metadata
                    )
                    await queue.put(broadcast_msg)
                except asyncio.QueueFull:
                    logger.error(f"Queue full for agent: {agent_name}")
                    success = False
        
        self._add_to_history(message)
        return success
    
    async def receive(self, agent_name: str, timeout: float = 1.0) -> Optional[AgentMessage]:
        """接收消息"""
        if agent_name not in self._queues:
            return None
        
        try:
            message = await asyncio.wait_for(
                self._queues[agent_name].get(),
                timeout=timeout
            )
            return message
        except asyncio.TimeoutError:
            return None
    
    def subscribe(self, event_type: str, callback: Callable):
        """订阅事件"""
        self._subscribers[event_type].append(callback)
    
    async def _notify_subscribers(self, event_type: str, data: Any):
        """通知订阅者"""
        for callback in self._subscribers.get(event_type, []):
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(data)
                else:
                    callback(data)
            except Exception as e:
                logger.error(f"Subscriber callback error: {e}")
    
    def _add_to_history(self, message: AgentMessage):
        """添加到历史记录"""
        self._message_history.append(message)
        if len(self._message_history) > self._max_history:
            self._message_history.pop(0)
    
    def get_history(self, agent_name: Optional[str] = None, limit: int = 100) -> List[Dict]:
        """获取消息历史"""
        history = self._message_history
        if agent_name:
            history = [m for m in history if m.sender == agent_name or m.receiver == agent_name]
        return [m.to_dict() for m in history[-limit:]]
    
    def update_agent_status(self, agent_name: str, status: str):
        """更新智能体状态"""
        self._agent_status[agent_name] = status
    
    def get_agent_status(self, agent_name: str) -> str:
        """获取智能体状态"""
        return self._agent_status.get(agent_name, "unknown")
    
    def get_all_status(self) -> Dict[str, str]:
        """获取所有智能体状态"""
        return self._agent_status.copy()
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "registered_agents": len(self._queues),
            "total_messages": len(self._message_history),
            "queue_sizes": {name: q.qsize() for name, q in self._queues.items()},
            "agent_status": self._agent_status.copy()
        }


_message_bus: Optional[MessageBus] = None


def get_message_bus() -> MessageBus:
    """获取全局消息总线实例"""
    global _message_bus
    if _message_bus is None:
        _message_bus = MessageBus()
    return _message_bus

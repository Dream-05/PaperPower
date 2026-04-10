"""
基础智能体类
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod
import logging
import asyncio
from datetime import datetime

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
    
    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        self.name = name
        self.config = config or {}
        self.state = AgentState.IDLE
        self.tools: Dict[str, Any] = {}
        self.memory: List[Dict[str, Any]] = []
        self.current_task: Optional[Dict[str, Any]] = None
        self._initialize()
    
    def _initialize(self):
        """初始化智能体"""
        logger.info(f"初始化智能体: {self.name}")
    
    def register_tool(self, name: str, tool: Any):
        """注册工具"""
        self.tools[name] = tool
        logger.info(f"{self.name} 注册工具: {name}")
    
    def add_to_memory(self, entry: Dict[str, Any]):
        """添加到记忆"""
        entry['timestamp'] = datetime.now().isoformat()
        self.memory.append(entry)
    
    def get_recent_memory(self, count: int = 10) -> List[Dict[str, Any]]:
        """获取最近的记忆"""
        return self.memory[-count:] if self.memory else []
    
    @abstractmethod
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行任务（抽象方法）"""
        pass
    
    async def run(self, task: Dict[str, Any]) -> AgentResult:
        """运行智能体"""
        logger.info(f"{self.name} 开始执行任务")
        
        self.state = AgentState.WORKING
        self.current_task = task
        
        try:
            result = await self.execute(task)
            self.state = AgentState.IDLE
            self.add_to_memory({
                "task": task,
                "result": result,
                "status": "success"
            })
            return result
        
        except Exception as e:
            self.state = AgentState.ERROR
            error_msg = str(e)
            logger.error(f"{self.name} 执行失败: {error_msg}")
            
            self.add_to_memory({
                "task": task,
                "error": error_msg,
                "status": "failed"
            })
            
            return AgentResult(
                success=False,
                output=None,
                error=error_msg
            )
        
        finally:
            self.current_task = None
    
    def get_status(self) -> Dict[str, Any]:
        """获取智能体状态"""
        return {
            "name": self.name,
            "state": self.state.value,
            "tools_count": len(self.tools),
            "memory_count": len(self.memory),
            "current_task": self.current_task is not None
        }
    
    def clear_memory(self):
        """清空记忆"""
        self.memory = []
        logger.info(f"{self.name} 清空记忆")

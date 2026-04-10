"""
多智能体系统初始化和启动
Multi-Agent System Initialization and Startup
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

from .orchestrator import MultiAgentOrchestrator, AgentCapability, get_orchestrator
from .message_bus import get_message_bus
from .agents.mini_ai_commander import MiniAICommander
from .agents.planner_agent import PlannerAgent
from .agents.excel_agent import ExcelAgent
from .agents.ppt_agent import PPTAgent
from .agents.word_agent import WordAgent
from .agents.search_agent import SearchAgent
from .agents.data_agent import DataAgent
from .agents.reviewer_agent import ReviewerAgent
from .agents.monitor_agent import MonitorAgent

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MultiAgentSystem:
    """多智能体系统"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.orchestrator = get_orchestrator()
        self.message_bus = get_message_bus()
        self.agents: Dict[str, Any] = {}
        self._initialized = False
        self._running = False
    
    async def initialize(self) -> bool:
        """初始化系统"""
        if self._initialized:
            return True
        
        logger.info("Initializing Multi-Agent System...")
        
        try:
            await self._register_agents()
            
            await self.orchestrator.start()
            
            for agent in self.agents.values():
                await agent.start()
            
            self._initialized = True
            logger.info("Multi-Agent System initialized successfully")
            return True
        
        except Exception as e:
            logger.error(f"Failed to initialize system: {e}")
            return False
    
    async def _register_agents(self):
        """注册所有智能体"""
        agent_configs = [
            (MiniAICommander(), AgentCapability(
                name="MiniAICommander",
                description="总指挥官 - 任务理解与分发",
                task_types=["user_instruction", "command", "task_delegation"],
                priority=10,
                max_concurrent_tasks=5
            )),
            (PlannerAgent(), AgentCapability(
                name="PlannerAgent",
                description="规划师 - 任务分解与策略",
                task_types=["planning", "task_decomposition", "strategy"],
                priority=8,
                max_concurrent_tasks=3
            )),
            (ExcelAgent(), AgentCapability(
                name="ExcelAgent",
                description="表格专家 - Excel数据处理",
                task_types=["excel_analysis", "excel", "spreadsheet", "data_analysis", "formula"],
                priority=5,
                max_concurrent_tasks=3
            )),
            (PPTAgent(), AgentCapability(
                name="PPTAgent",
                description="演示专家 - PPT生成与设计",
                task_types=["ppt_generation", "ppt", "presentation", "slides"],
                priority=5,
                max_concurrent_tasks=3
            )),
            (WordAgent(), AgentCapability(
                name="WordAgent",
                description="文档专家 - Word文档生成",
                task_types=["document_writing", "word", "document", "report"],
                priority=5,
                max_concurrent_tasks=3
            )),
            (SearchAgent(), AgentCapability(
                name="SearchAgent",
                description="搜索专家 - 信息检索",
                task_types=["search", "query", "lookup", "information_retrieval"],
                priority=6,
                max_concurrent_tasks=5
            )),
            (DataAgent(), AgentCapability(
                name="DataAgent",
                description="数据专家 - 数据分析与可视化",
                task_types=["data_visualization", "data_analysis", "statistics", "chart"],
                priority=5,
                max_concurrent_tasks=3
            )),
            (ReviewerAgent(), AgentCapability(
                name="ReviewerAgent",
                description="审核员 - 质量把控",
                task_types=["review", "quality_check", "validation", "feedback"],
                priority=7,
                max_concurrent_tasks=5
            )),
            (MonitorAgent(), AgentCapability(
                name="MonitorAgent",
                description="监控员 - 系统监控",
                task_types=["monitoring", "status_check", "alert", "progress"],
                priority=4,
                max_concurrent_tasks=10
            )),
        ]
        
        for agent, capability in agent_configs:
            await self.orchestrator.register_agent(agent, capability)
            self.agents[agent.name] = agent
            logger.info(f"Registered agent: {agent.name}")
    
    async def process_instruction(self, instruction: str) -> Dict[str, Any]:
        """处理用户指令 - 主入口"""
        if not self._initialized:
            await self.initialize()
        
        logger.info(f"Processing instruction: {instruction[:100]}...")
        
        task_id = await self.orchestrator.submit_task(
            description=instruction,
            task_type="user_instruction",
            priority=10,
            metadata={"source": "user", "timestamp": datetime.now().isoformat()}
        )
        
        return {
            "task_id": task_id,
            "status": "submitted",
            "message": f"任务已提交，正在处理中..."
        }
    
    async def get_task_result(self, task_id: str, timeout: float = 30.0) -> Dict[str, Any]:
        """获取任务结果"""
        import asyncio
        
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < timeout:
            status = self.orchestrator.get_task_status(task_id)
            if status:
                if status["status"] in ["completed", "failed"]:
                    return status
            await asyncio.sleep(0.5)
        
        return {"status": "timeout", "message": "任务处理超时"}
    
    async def get_system_status(self) -> Dict[str, Any]:
        """获取系统状态"""
        return {
            "initialized": self._initialized,
            "running": self._running,
            "agents": self.orchestrator.get_agent_status(),
            "statistics": self.orchestrator.get_statistics(),
            "message_bus": self.message_bus.get_statistics()
        }
    
    async def shutdown(self):
        """关闭系统"""
        logger.info("Shutting down Multi-Agent System...")
        
        for agent in self.agents.values():
            await agent.stop()
        
        await self.orchestrator.stop()
        
        self._running = False
        self._initialized = False
        logger.info("Multi-Agent System shutdown complete")
    
    async def run_forever(self):
        """持续运行"""
        if not self._initialized:
            await self.initialize()
        
        self._running = True
        logger.info("Multi-Agent System running...")
        
        try:
            while self._running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            logger.info("Received shutdown signal")
        finally:
            await self.shutdown()


_system: Optional[MultiAgentSystem] = None


async def get_system() -> MultiAgentSystem:
    """获取全局系统实例"""
    global _system
    if _system is None:
        _system = MultiAgentSystem()
        await _system.initialize()
    return _system


async def process_user_instruction(instruction: str) -> Dict[str, Any]:
    """处理用户指令的便捷函数"""
    system = await get_system()
    return await system.process_instruction(instruction)

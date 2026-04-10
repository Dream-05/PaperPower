"""
多智能体协作系统
Multi-Agent Collaboration System
"""

from .orchestrator import MultiAgentOrchestrator, get_orchestrator, TaskStatus, Task, AgentCapability
from .message_bus import MessageBus, AgentMessage, MessageType, MessagePriority, get_message_bus
from .base_agent import BaseAgent, AgentResult, AgentState
from .system import MultiAgentSystem, get_system, process_user_instruction
from .ai_inference import AIInferenceService, AIResponse, ai_service, get_ai_response
from .agents.mini_ai_commander import MiniAICommander
from .agents.planner_agent import PlannerAgent
from .agents.excel_agent import ExcelAgent
from .agents.ppt_agent import PPTAgent
from .agents.word_agent import WordAgent
from .agents.search_agent import SearchAgent
from .agents.data_agent import DataAgent
from .agents.reviewer_agent import ReviewerAgent
from .agents.monitor_agent import MonitorAgent

__all__ = [
    'MultiAgentOrchestrator',
    'get_orchestrator',
    'TaskStatus',
    'Task',
    'AgentCapability',
    'MessageBus',
    'AgentMessage',
    'MessageType',
    'MessagePriority',
    'get_message_bus',
    'BaseAgent',
    'AgentResult',
    'AgentState',
    'MultiAgentSystem',
    'get_system',
    'process_user_instruction',
    'AIInferenceService',
    'AIResponse',
    'ai_service',
    'get_ai_response',
    'MiniAICommander',
    'PlannerAgent',
    'ExcelAgent',
    'PPTAgent',
    'WordAgent',
    'SearchAgent',
    'DataAgent',
    'ReviewerAgent',
    'MonitorAgent',
]

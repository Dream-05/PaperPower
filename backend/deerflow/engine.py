"""
DeerFlow核心引擎
基于LangGraph的多智能体协作工作流引擎
"""

from typing import Dict, List, Any, Optional, TypedDict, Annotated
from dataclasses import dataclass, field
from enum import Enum
import asyncio
import logging
from datetime import datetime

try:
    from langgraph.graph import StateGraph, END
    from langgraph.checkpoint.memory import MemorySaver
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    logging.warning("LangGraph未安装，DeerFlow引擎将使用简化模式")

logger = logging.getLogger(__name__)


class WorkflowState(TypedDict):
    """工作流状态"""
    task_id: str
    user_input: str
    current_step: str
    plan: List[Dict[str, Any]]
    results: Dict[str, Any]
    messages: List[Dict[str, Any]]
    status: str
    error: Optional[str]


class TaskType(Enum):
    """任务类型"""
    RESEARCH = "research"
    DOCUMENT_GENERATION = "document_generation"
    DATA_ANALYSIS = "data_analysis"
    CODE_EXECUTION = "code_execution"
    MULTIMEDIA_CREATION = "multimedia_creation"
    GENERAL = "general"


@dataclass
class Task:
    """任务定义"""
    task_id: str
    task_type: TaskType
    description: str
    priority: int = 1
    dependencies: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class DeerFlowEngine:
    """DeerFlow核心引擎"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.memory_saver = MemorySaver() if LANGGRAPH_AVAILABLE else None
        self.workflow_graph = None
        self.agents = {}
        self.tools = {}
        self._initialize_engine()
    
    def _initialize_engine(self):
        """初始化引擎"""
        logger.info("初始化DeerFlow引擎...")
        
        # 初始化工作流图
        if LANGGRAPH_AVAILABLE:
            self._build_workflow_graph()
        else:
            logger.warning("使用简化模式，工作流图不可用")
        
        logger.info("DeerFlow引擎初始化完成")
    
    def _build_workflow_graph(self):
        """构建工作流图"""
        if not LANGGRAPH_AVAILABLE:
            return
        
        # 创建状态图
        workflow = StateGraph(WorkflowState)
        
        # 添加节点
        workflow.add_node("coordinator", self._coordinator_node)
        workflow.add_node("planner", self._planner_node)
        workflow.add_node("researcher", self._researcher_node)
        workflow.add_node("coder", self._coder_node)
        workflow.add_node("reporter", self._reporter_node)
        
        # 设置入口点
        workflow.set_entry_point("coordinator")
        
        # 添加边
        workflow.add_edge("coordinator", "planner")
        workflow.add_conditional_edges(
            "planner",
            self._should_continue,
            {
                "research": "researcher",
                "code": "coder",
                "report": "reporter",
                "end": END
            }
        )
        workflow.add_edge("researcher", "reporter")
        workflow.add_edge("coder", "reporter")
        workflow.add_edge("reporter", END)
        
        # 编译工作流
        self.workflow_graph = workflow.compile(checkpointer=self.memory_saver)
    
    async def _coordinator_node(self, state: WorkflowState) -> WorkflowState:
        """协调器节点"""
        logger.info(f"协调器处理任务: {state['task_id']}")
        state['current_step'] = 'coordinator'
        state['status'] = 'processing'
        return state
    
    async def _planner_node(self, state: WorkflowState) -> WorkflowState:
        """规划器节点"""
        logger.info(f"规划器制定计划: {state['task_id']}")
        state['current_step'] = 'planner'
        
        # 简单的计划生成
        plan = [
            {"step": 1, "action": "analyze", "description": "分析用户需求"},
            {"step": 2, "action": "research", "description": "收集相关信息"},
            {"step": 3, "action": "synthesize", "description": "综合分析结果"},
            {"step": 4, "action": "report", "description": "生成报告"}
        ]
        state['plan'] = plan
        return state
    
    async def _researcher_node(self, state: WorkflowState) -> WorkflowState:
        """研究员节点"""
        logger.info(f"研究员执行研究: {state['task_id']}")
        state['current_step'] = 'researcher'
        
        # 模拟研究结果
        state['results']['research'] = {
            "status": "completed",
            "findings": ["研究结果1", "研究结果2"]
        }
        return state
    
    async def _coder_node(self, state: WorkflowState) -> WorkflowState:
        """编码员节点"""
        logger.info(f"编码员执行代码: {state['task_id']}")
        state['current_step'] = 'coder'
        
        # 模拟代码执行结果
        state['results']['code'] = {
            "status": "completed",
            "output": "代码执行完成"
        }
        return state
    
    async def _reporter_node(self, state: WorkflowState) -> WorkflowState:
        """报告员节点"""
        logger.info(f"报告员生成报告: {state['task_id']}")
        state['current_step'] = 'reporter'
        
        # 模拟报告生成
        state['results']['report'] = {
            "status": "completed",
            "content": "报告内容"
        }
        state['status'] = 'completed'
        return state
    
    def _should_continue(self, state: WorkflowState) -> str:
        """决定下一步操作"""
        if not state.get('plan'):
            return "end"
        
        # 简单的路由逻辑
        user_input = state.get('user_input', '').lower()
        if '研究' in user_input or 'research' in user_input:
            return "research"
        elif '代码' in user_input or 'code' in user_input:
            return "code"
        else:
            return "report"
    
    async def execute_task(self, task: Task) -> Dict[str, Any]:
        """执行任务"""
        logger.info(f"开始执行任务: {task.task_id}")
        
        # 初始化状态
        initial_state: WorkflowState = {
            "task_id": task.task_id,
            "user_input": task.description,
            "current_step": "init",
            "plan": [],
            "results": {},
            "messages": [],
            "status": "pending",
            "error": None
        }
        
        try:
            if LANGGRAPH_AVAILABLE and self.workflow_graph:
                # 使用LangGraph执行工作流
                config = {"configurable": {"thread_id": task.task_id}}
                result = await self.workflow_graph.ainvoke(initial_state, config)
                return result
            else:
                # 简化模式：顺序执行
                return await self._execute_simple_workflow(initial_state)
        
        except Exception as e:
            logger.error(f"任务执行失败: {e}")
            return {
                "task_id": task.task_id,
                "status": "failed",
                "error": str(e)
            }
    
    async def _execute_simple_workflow(self, state: WorkflowState) -> WorkflowState:
        """简化工作流执行（无LangGraph）"""
        state = await self._coordinator_node(state)
        state = await self._planner_node(state)
        
        # 根据计划执行
        for step in state['plan']:
            action = step.get('action')
            if action == 'research':
                state = await self._researcher_node(state)
            elif action == 'code':
                state = await self._coder_node(state)
        
        state = await self._reporter_node(state)
        return state
    
    def register_agent(self, name: str, agent: Any):
        """注册智能体"""
        self.agents[name] = agent
        logger.info(f"注册智能体: {name}")
    
    def register_tool(self, name: str, tool: Any):
        """注册工具"""
        self.tools[name] = tool
        logger.info(f"注册工具: {name}")
    
    def get_status(self) -> Dict[str, Any]:
        """获取引擎状态"""
        return {
            "langgraph_available": LANGGRAPH_AVAILABLE,
            "agents_count": len(self.agents),
            "tools_count": len(self.tools),
            "status": "ready"
        }

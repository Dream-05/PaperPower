"""
规划师智能体 - 任务分解和执行策略
Planner Agent - Task Decomposition and Execution Strategy
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass
import json

from ..base_agent import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


@dataclass
class PlanStep:
    """计划步骤"""
    step_id: int
    action: str
    description: str
    agent: str
    dependencies: List[int]
    estimated_time: int
    status: str = "pending"


class PlannerAgent(BaseAgent):
    """规划师智能体 - 任务分解和策略制定"""
    
    TASK_TEMPLATES = {
        "research": [
            {"action": "analyze", "description": "分析研究目标和范围", "agent": "SearchAgent"},
            {"action": "search", "description": "搜索相关资料", "agent": "SearchAgent"},
            {"action": "extract", "description": "提取关键信息", "agent": "DataAgent"},
            {"action": "synthesize", "description": "综合分析结果", "agent": "DataAgent"},
            {"action": "report", "description": "生成研究报告", "agent": "WordAgent"}
        ],
        "document_generation": [
            {"action": "analyze", "description": "分析文档需求", "agent": "WordAgent"},
            {"action": "outline", "description": "生成文档大纲", "agent": "WordAgent"},
            {"action": "research", "description": "收集相关资料", "agent": "SearchAgent"},
            {"action": "write", "description": "撰写文档内容", "agent": "WordAgent"},
            {"action": "format", "description": "格式化文档", "agent": "WordAgent"},
            {"action": "review", "description": "审核文档质量", "agent": "ReviewerAgent"}
        ],
        "data_analysis": [
            {"action": "load", "description": "加载数据", "agent": "ExcelAgent"},
            {"action": "clean", "description": "数据清洗", "agent": "DataAgent"},
            {"action": "analyze", "description": "数据分析", "agent": "DataAgent"},
            {"action": "visualize", "description": "数据可视化", "agent": "DataAgent"},
            {"action": "report", "description": "生成分析报告", "agent": "WordAgent"}
        ],
        "ppt_generation": [
            {"action": "analyze", "description": "分析PPT需求", "agent": "PPTAgent"},
            {"action": "outline", "description": "生成PPT大纲", "agent": "PPTAgent"},
            {"action": "research", "description": "收集素材资料", "agent": "SearchAgent"},
            {"action": "design", "description": "设计幻灯片", "agent": "PPTAgent"},
            {"action": "optimize", "description": "优化PPT效果", "agent": "PPTAgent"}
        ],
        "general": [
            {"action": "analyze", "description": "分析任务需求", "agent": "MiniAICommander"},
            {"action": "plan", "description": "制定执行计划", "agent": "PlannerAgent"},
            {"action": "execute", "description": "执行任务", "agent": "ReporterAgent"},
            {"action": "review", "description": "审核结果", "agent": "ReviewerAgent"}
        ]
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="PlannerAgent",
            description="规划师 - 任务分解和执行策略制定",
            task_types=["planning", "task_decomposition", "strategy"],
            config=config
        )
        self.plans: Dict[str, List[PlanStep]] = {}
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行规划任务"""
        description = task.get("description", "")
        task_type = task.get("task_type", "general")
        task_id = task.get("id", "")
        
        logger.info(f"PlannerAgent creating plan for: {description[:50]}...")
        
        try:
            plan = await self._create_plan(description, task_type)
            
            self.plans[task_id] = plan
            
            return AgentResult(
                success=True,
                output={
                    "plan_id": task_id,
                    "steps": [self._step_to_dict(s) for s in plan],
                    "total_steps": len(plan),
                    "estimated_time": sum(s.estimated_time for s in plan),
                    "message": f"已创建{len(plan)}步执行计划"
                }
            )
        
        except Exception as e:
            logger.error(f"PlannerAgent error: {e}")
            return AgentResult(success=False, output=None, error=str(e))
    
    async def _create_plan(self, description: str, task_type: str) -> List[PlanStep]:
        """创建执行计划"""
        template = self.TASK_TEMPLATES.get(task_type, self.TASK_TEMPLATES["general"])
        
        plan = []
        for i, step_template in enumerate(template):
            step = PlanStep(
                step_id=i + 1,
                action=step_template["action"],
                description=step_template["description"],
                agent=step_template["agent"],
                dependencies=[j + 1 for j in range(i) if i > 0],
                estimated_time=self._estimate_time(step_template["action"])
            )
            plan.append(step)
        
        return plan
    
    def _estimate_time(self, action: str) -> int:
        """估算步骤时间（秒）"""
        time_estimates = {
            "analyze": 5,
            "search": 15,
            "extract": 10,
            "synthesize": 20,
            "report": 30,
            "outline": 10,
            "research": 20,
            "write": 60,
            "format": 15,
            "review": 10,
            "load": 5,
            "clean": 15,
            "visualize": 20,
            "design": 30,
            "optimize": 15,
            "plan": 10,
            "execute": 30
        }
        return time_estimates.get(action, 15)
    
    def _step_to_dict(self, step: PlanStep) -> Dict[str, Any]:
        """步骤转字典"""
        return {
            "step_id": step.step_id,
            "action": step.action,
            "description": step.description,
            "agent": step.agent,
            "dependencies": step.dependencies,
            "estimated_time": step.estimated_time,
            "status": step.status
        }
    
    async def adjust_plan(self, plan_id: str, adjustments: Dict[str, Any]) -> AgentResult:
        """动态调整计划"""
        if plan_id not in self.plans:
            return AgentResult(success=False, output=None, error="Plan not found")
        
        plan = self.plans[plan_id]
        
        if "add_steps" in adjustments:
            for step_data in adjustments["add_steps"]:
                new_step = PlanStep(
                    step_id=len(plan) + 1,
                    action=step_data.get("action", "custom"),
                    description=step_data.get("description", ""),
                    agent=step_data.get("agent", "ReporterAgent"),
                    dependencies=step_data.get("dependencies", []),
                    estimated_time=step_data.get("estimated_time", 15)
                )
                plan.append(new_step)
        
        if "remove_steps" in adjustments:
            step_ids = adjustments["remove_steps"]
            plan = [s for s in plan if s.step_id not in step_ids]
        
        self.plans[plan_id] = plan
        
        return AgentResult(
            success=True,
            output={"plan_id": plan_id, "steps": [self._step_to_dict(s) for s in plan]}
        )
    
    def get_plan(self, plan_id: str) -> Optional[List[Dict[str, Any]]]:
        """获取计划"""
        if plan_id in self.plans:
            return [self._step_to_dict(s) for s in self.plans[plan_id]]
        return None

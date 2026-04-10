"""
规划器模块
任务分解和执行策略制定
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import logging
import re

logger = logging.getLogger(__name__)


@dataclass
class PlanStep:
    """计划步骤"""
    step_id: str
    action: str
    description: str
    dependencies: List[str] = field(default_factory=list)
    estimated_time: int = 0
    priority: int = 1
    status: str = "pending"
    result: Optional[Dict[str, Any]] = None


@dataclass
class ExecutionPlan:
    """执行计划"""
    plan_id: str
    goal: str
    steps: List[PlanStep]
    created_at: datetime
    status: str = "pending"
    metadata: Dict[str, Any] = field(default_factory=dict)


class Planner:
    """规划器 - 任务分解和执行策略制定"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.plans: Dict[str, ExecutionPlan] = {}
        self.templates = self._load_templates()
        self._initialize()
    
    def _initialize(self):
        """初始化规划器"""
        logger.info("初始化规划器...")
        logger.info("规划器初始化完成")
    
    def _load_templates(self) -> Dict[str, List[Dict[str, Any]]]:
        """加载计划模板"""
        return {
            "research": [
                {"action": "analyze", "description": "分析研究目标和范围"},
                {"action": "search", "description": "搜索相关资料"},
                {"action": "extract", "description": "提取关键信息"},
                {"action": "synthesize", "description": "综合分析结果"},
                {"action": "report", "description": "生成研究报告"}
            ],
            "document_generation": [
                {"action": "analyze", "description": "分析文档需求"},
                {"action": "outline", "description": "生成文档大纲"},
                {"action": "research", "description": "收集相关资料"},
                {"action": "write", "description": "撰写文档内容"},
                {"action": "format", "description": "格式化文档"},
                {"action": "review", "description": "审核文档质量"}
            ],
            "data_analysis": [
                {"action": "load", "description": "加载数据"},
                {"action": "clean", "description": "数据清洗"},
                {"action": "analyze", "description": "数据分析"},
                {"action": "visualize", "description": "数据可视化"},
                {"action": "report", "description": "生成分析报告"}
            ],
            "code_execution": [
                {"action": "analyze", "description": "分析代码需求"},
                {"action": "write", "description": "编写代码"},
                {"action": "test", "description": "测试代码"},
                {"action": "execute", "description": "执行代码"},
                {"action": "report", "description": "生成执行报告"}
            ],
            "multimedia_creation": [
                {"action": "analyze", "description": "分析创作需求"},
                {"action": "research", "description": "收集素材"},
                {"action": "design", "description": "设计内容结构"},
                {"action": "create", "description": "创建多媒体内容"},
                {"action": "optimize", "description": "优化内容质量"}
            ],
            "general": [
                {"action": "analyze", "description": "分析任务需求"},
                {"action": "plan", "description": "制定执行计划"},
                {"action": "execute", "description": "执行任务"},
                {"action": "review", "description": "审核结果"}
            ]
        }
    
    def create_plan(self, goal: str, task_type: str = "general", 
                   context: Optional[Dict[str, Any]] = None) -> ExecutionPlan:
        """创建执行计划"""
        import uuid
        
        plan_id = str(uuid.uuid4())
        
        # 获取模板
        template = self.templates.get(task_type, self.templates["general"])
        
        # 创建步骤
        steps = []
        for i, step_template in enumerate(template):
            step = PlanStep(
                step_id=f"{plan_id}_step_{i}",
                action=step_template["action"],
                description=step_template["description"],
                dependencies=[f"{plan_id}_step_{j}" for j in range(i) if i > 0],
                priority=i + 1
            )
            steps.append(step)
        
        # 创建计划
        plan = ExecutionPlan(
            plan_id=plan_id,
            goal=goal,
            steps=steps,
            created_at=datetime.now(),
            metadata={"task_type": task_type, "context": context or {}}
        )
        
        self.plans[plan_id] = plan
        logger.info(f"创建执行计划: {plan_id} - {goal}")
        
        return plan
    
    def evaluate_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """评估上下文的充分性"""
        evaluation = {
            "sufficient": True,
            "missing_info": [],
            "recommendations": []
        }
        
        # 检查必要的信息
        if not context.get("user_input"):
            evaluation["sufficient"] = False
            evaluation["missing_info"].append("用户输入")
        
        if not context.get("task_type"):
            evaluation["recommendations"].append("建议明确任务类型")
        
        return evaluation
    
    def adjust_plan(self, plan_id: str, adjustments: Dict[str, Any]) -> Optional[ExecutionPlan]:
        """动态调整计划"""
        plan = self.plans.get(plan_id)
        if not plan:
            return None
        
        # 应用调整
        if "add_steps" in adjustments:
            for step_data in adjustments["add_steps"]:
                step = PlanStep(
                    step_id=f"{plan_id}_step_{len(plan.steps)}",
                    action=step_data.get("action", "custom"),
                    description=step_data.get("description", ""),
                    priority=step_data.get("priority", 1)
                )
                plan.steps.append(step)
        
        if "remove_steps" in adjustments:
            step_ids_to_remove = adjustments["remove_steps"]
            plan.steps = [s for s in plan.steps if s.step_id not in step_ids_to_remove]
        
        if "modify_steps" in adjustments:
            for modification in adjustments["modify_steps"]:
                step_id = modification.get("step_id")
                for step in plan.steps:
                    if step.step_id == step_id:
                        if "description" in modification:
                            step.description = modification["description"]
                        if "priority" in modification:
                            step.priority = modification["priority"]
        
        logger.info(f"调整计划: {plan_id}")
        return plan
    
    def get_next_step(self, plan_id: str) -> Optional[PlanStep]:
        """获取下一步要执行的步骤"""
        plan = self.plans.get(plan_id)
        if not plan:
            return None
        
        # 找到第一个pending状态的步骤
        for step in plan.steps:
            if step.status == "pending":
                # 检查依赖是否完成
                dependencies_met = all(
                    self._get_step_status(plan, dep_id) == "completed"
                    for dep_id in step.dependencies
                )
                if dependencies_met:
                    return step
        
        return None
    
    def _get_step_status(self, plan: ExecutionPlan, step_id: str) -> str:
        """获取步骤状态"""
        for step in plan.steps:
            if step.step_id == step_id:
                return step.status
        return "unknown"
    
    def update_step_status(self, plan_id: str, step_id: str, status: str, 
                          result: Optional[Dict[str, Any]] = None):
        """更新步骤状态"""
        plan = self.plans.get(plan_id)
        if not plan:
            return False
        
        for step in plan.steps:
            if step.step_id == step_id:
                step.status = status
                if result:
                    step.result = result
                logger.info(f"更新步骤状态: {step_id} -> {status}")
                return True
        
        return False
    
    def get_plan_status(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """获取计划状态"""
        plan = self.plans.get(plan_id)
        if not plan:
            return None
        
        completed = sum(1 for s in plan.steps if s.status == "completed")
        total = len(plan.steps)
        
        return {
            "plan_id": plan_id,
            "goal": plan.goal,
            "status": plan.status,
            "progress": f"{completed}/{total}",
            "completion_rate": completed / total if total > 0 else 0,
            "steps": [
                {
                    "step_id": s.step_id,
                    "action": s.action,
                    "description": s.description,
                    "status": s.status
                }
                for s in plan.steps
            ]
        }
    
    def optimize_plan(self, plan_id: str) -> Optional[ExecutionPlan]:
        """优化计划"""
        plan = self.plans.get(plan_id)
        if not plan:
            return None
        
        # 简单的优化：按优先级排序
        plan.steps.sort(key=lambda s: s.priority)
        
        logger.info(f"优化计划: {plan_id}")
        return plan

"""
MiniAI总指挥官 - 任务理解与分发核心
MiniAI Commander - Task Understanding and Distribution Core
"""

import asyncio
import logging
import re
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass
import json

from ..base_agent import BaseAgent, AgentResult
from ..message_bus import MessageType, MessagePriority

logger = logging.getLogger(__name__)


@dataclass
class TaskIntent:
    """任务意图"""
    intent_type: str
    confidence: float
    entities: Dict[str, Any]
    subtasks: List[Dict[str, Any]]
    priority: int


class MiniAICommander(BaseAgent):
    """MiniAI总指挥官 - 用户指令理解和任务分发"""
    
    INTENT_PATTERNS = {
        "ppt_generation": [
            r"生成?ppt", r"制作?演示", r"创建?幻灯片", r"ppt报告",
            r"presentation", r"slides"
        ],
        "excel_analysis": [
            r"分析?数据", r"excel", r"表格", r"数据统计", r"图表",
            r"spreadsheet", r"data analysis"
        ],
        "document_writing": [
            r"写?文档", r"生成?报告", r"起草?文件", r"word",
            r"document", r"report", r"write"
        ],
        "search": [
            r"搜索", r"查找", r"查询", r"找", r"检索",
            r"search", r"find", r"lookup"
        ],
        "data_visualization": [
            r"可视化", r"画图", r"图表", r"数据展示",
            r"visualize", r"chart", r"graph"
        ],
        "email": [
            r"邮件", r"发送", r"写信", r"email", r"mail"
        ],
        "schedule": [
            r"日程", r"安排", r"计划", r"提醒", r"schedule", r"calendar"
        ],
        "code": [
            r"代码", r"编程", r"脚本", r"code", r"program", r"script"
        ],
        "translation": [
            r"翻译", r"translate", r"中英", r"英中"
        ],
        "summary": [
            r"总结", r"摘要", r"概括", r"summary", r"summarize"
        ]
    }
    
    AGENT_MAPPING = {
        "ppt_generation": "PPTAgent",
        "excel_analysis": "ExcelAgent",
        "document_writing": "WordAgent",
        "search": "SearchAgent",
        "data_visualization": "DataAgent",
        "email": "EmailAgent",
        "schedule": "CalendarAgent",
        "code": "CoderAgent",
        "translation": "TranslateAgent",
        "summary": "ReporterAgent"
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="MiniAICommander",
            description="总指挥官 - 理解用户指令并分发给专业智能体",
            task_types=["user_instruction", "command", "task_delegation"],
            config=config
        )
        self.conversation_history: List[Dict[str, Any]] = []
        self.user_preferences: Dict[str, Any] = {}
        self._pending_tasks: Dict[str, Any] = {}
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行用户指令处理"""
        description = task.get("description", "")
        task_id = task.get("id", "")
        
        logger.info(f"MiniAI processing instruction: {description[:100]}...")
        
        try:
            intent = await self._understand_intent(description)
            
            if intent.intent_type == "complex":
                plan = await self._create_execution_plan(intent, description)
                results = await self._execute_plan(plan, task_id)
                return AgentResult(
                    success=True,
                    output={
                        "intent": intent.intent_type,
                        "plan": plan,
                        "results": results,
                        "message": f"复杂任务已分解并执行完成"
                    }
                )
            else:
                result = await self._delegate_to_agent(intent, description, task_id)
                return AgentResult(
                    success=True,
                    output={
                        "intent": intent.intent_type,
                        "delegated_to": self.AGENT_MAPPING.get(intent.intent_type, "Unknown"),
                        "result": result,
                        "message": f"任务已分发给{self.AGENT_MAPPING.get(intent.intent_type, '相应')}智能体"
                    }
                )
        
        except Exception as e:
            logger.error(f"MiniAI execution error: {e}")
            return AgentResult(
                success=False,
                output=None,
                error=str(e)
            )
    
    async def _understand_intent(self, text: str) -> TaskIntent:
        """理解用户意图"""
        text_lower = text.lower()
        
        matched_intents = []
        entities = self._extract_entities(text)
        
        for intent_type, patterns in self.INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    matched_intents.append(intent_type)
                    break
        
        if len(matched_intents) > 1:
            subtasks = []
            for intent in matched_intents:
                subtasks.append({
                    "task_type": intent,
                    "agent": self.AGENT_MAPPING.get(intent, "Unknown"),
                    "description": f"执行{intent}相关任务"
                })
            
            return TaskIntent(
                intent_type="complex",
                confidence=0.9,
                entities=entities,
                subtasks=subtasks,
                priority=self._determine_priority(text)
            )
        
        if matched_intents:
            return TaskIntent(
                intent_type=matched_intents[0],
                confidence=0.85,
                entities=entities,
                subtasks=[],
                priority=self._determine_priority(text)
            )
        
        return TaskIntent(
            intent_type="general",
            confidence=0.5,
            entities=entities,
            subtasks=[],
            priority=1
        )
    
    def _extract_entities(self, text: str) -> Dict[str, Any]:
        """提取实体信息"""
        entities = {}
        
        number_pattern = r'\d+(?:\.\d+)?'
        numbers = re.findall(number_pattern, text)
        if numbers:
            entities["numbers"] = numbers
        
        date_pattern = r'\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?|\d{1,2}月\d{1,2}[日]?'
        dates = re.findall(date_pattern, text)
        if dates:
            entities["dates"] = dates
        
        file_pattern = r'[\w\-]+\.(?:xlsx?|docx?|pptx?|pdf|txt|csv)'
        files = re.findall(file_pattern, text, re.IGNORECASE)
        if files:
            entities["files"] = files
        
        return entities
    
    def _determine_priority(self, text: str) -> int:
        """确定任务优先级"""
        if any(word in text for word in ["紧急", "urgent", "立即", "马上", "尽快"]):
            return 10
        elif any(word in text for word in ["重要", "important", "优先"]):
            return 7
        else:
            return 5
    
    async def _create_execution_plan(self, intent: TaskIntent, description: str) -> Dict[str, Any]:
        """创建执行计划"""
        plan = {
            "original_task": description,
            "created_at": datetime.now().isoformat(),
            "steps": []
        }
        
        for i, subtask in enumerate(intent.subtasks):
            step = {
                "step_id": i + 1,
                "task_type": subtask["task_type"],
                "agent": subtask["agent"],
                "description": subtask["description"],
                "status": "pending",
                "dependencies": [] if i == 0 else [f"step_{i}"]
            }
            plan["steps"].append(step)
        
        return plan
    
    async def _execute_plan(self, plan: Dict[str, Any], parent_task_id: str) -> List[Dict[str, Any]]:
        """执行计划"""
        results = []
        
        for step in plan["steps"]:
            agent_name = step["agent"]
            
            message_content = {
                "task_id": f"{parent_task_id}_step_{step['step_id']}",
                "description": step["description"],
                "task_type": step["task_type"],
                "parent_task": parent_task_id
            }
            
            await self.send_message(
                receiver=agent_name,
                message_type=MessageType.TASK_ASSIGN,
                content=message_content,
                requires_response=True
            )
            
            self._pending_tasks[message_content["task_id"]] = {
                "step": step,
                "status": "executing"
            }
            
            results.append({
                "step_id": step["step_id"],
                "agent": agent_name,
                "status": "delegated"
            })
        
        return results
    
    async def _delegate_to_agent(self, intent: TaskIntent, description: str, task_id: str) -> Dict[str, Any]:
        """分发给专业智能体"""
        agent_name = self.AGENT_MAPPING.get(intent.intent_type, "ReporterAgent")
        
        message_content = {
            "task_id": task_id,
            "description": description,
            "task_type": intent.intent_type,
            "entities": intent.entities,
            "priority": intent.priority
        }
        
        await self.send_message(
            receiver=agent_name,
            message_type=MessageType.TASK_ASSIGN,
            content=message_content,
            requires_response=True
        )
        
        return {
            "delegated_to": agent_name,
            "task_id": task_id,
            "status": "delegated"
        }
    
    async def answer_query(self, query: Any) -> Any:
        """回答用户查询"""
        if isinstance(query, dict):
            question = query.get("question", str(query))
        else:
            question = str(query)
        
        intent = await self._understand_intent(question)
        
        return {
            "answer": f"我理解您想要{intent.intent_type}，我可以帮您处理",
            "intent": intent.intent_type,
            "confidence": intent.confidence,
            "agent": self.name
        }
    
    def get_conversation_context(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取对话上下文"""
        return self.conversation_history[-limit:]
    
    def add_to_conversation(self, role: str, content: str):
        """添加到对话历史"""
        self.conversation_history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
        if len(self.conversation_history) > 100:
            self.conversation_history.pop(0)
    
    def get_status(self) -> Dict[str, Any]:
        """获取状态"""
        status = super().get_status()
        status.update({
            "conversation_length": len(self.conversation_history),
            "pending_tasks": len(self._pending_tasks),
            "user_preferences": len(self.user_preferences)
        })
        return status

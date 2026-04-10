"""
Word智能体 - 文档处理专家
Word Agent - Document Processing Expert
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import re

from ..base_agent import BaseAgent, AgentResult
from ..real_functions import real_executor

logger = logging.getLogger(__name__)


class WordAgent(BaseAgent):
    """Word智能体 - 文档处理专家"""
    
    DOCUMENT_TEMPLATES = {
        "报告": {
            "sections": ["摘要", "背景", "方法", "结果", "结论"],
            "style": "正式"
        },
        "方案": {
            "sections": ["项目概述", "目标", "实施计划", "预算", "风险"],
            "style": "专业"
        },
        "总结": {
            "sections": ["工作回顾", "成果展示", "问题分析", "改进计划"],
            "style": "简洁"
        },
        "通知": {
            "sections": ["标题", "正文", "落款"],
            "style": "正式"
        },
        "合同": {
            "sections": ["甲方", "乙方", "条款", "签字"],
            "style": "法律"
        }
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="WordAgent",
            description="文档专家 - Word文档生成、编辑、格式化",
            task_types=["document_writing", "word", "document", "report"],
            config=config
        )
        self.documents: Dict[str, Dict[str, Any]] = {}
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行Word相关任务"""
        description = task.get("description", "")
        task_type = task.get("task_type", "document_writing")
        entities = task.get("entities", {})
        
        logger.info(f"WordAgent processing: {description[:50]}...")
        
        try:
            if "大纲" in description or "outline" in description.lower():
                result = await self._generate_outline(description, entities)
            elif "格式" in description or "format" in description.lower():
                result = await self._format_document(description, entities)
            elif "模板" in description or "template" in description.lower():
                result = await self._apply_template(description, entities)
            else:
                result = await self._generate_document(description, entities)
            
            return AgentResult(
                success=True,
                output=result,
                metadata={"agent": self.name, "task_type": task_type}
            )
        
        except Exception as e:
            logger.error(f"WordAgent error: {e}")
            return AgentResult(success=False, output=None, error=str(e))
    
    async def _generate_outline(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """生成文档大纲"""
        doc_type = self._detect_document_type(description)
        template = self.DOCUMENT_TEMPLATES.get(doc_type, self.DOCUMENT_TEMPLATES["报告"])
        
        outline = {
            "type": "document_outline",
            "document_type": doc_type,
            "sections": []
        }
        
        for i, section in enumerate(template["sections"], 1):
            outline["sections"].append({
                "section_number": i,
                "title": section,
                "content_hint": f"{section}内容要点...",
                "word_count_estimate": 300
            })
        
        outline["total_sections"] = len(template["sections"])
        outline["estimated_word_count"] = len(template["sections"]) * 300
        
        return outline
    
    async def _generate_document(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """生成完整文档 - 调用真实功能"""
        doc_type = self._detect_document_type(description)
        outline = await self._generate_outline(description, entities)
        title = self._extract_title(description)
        
        sections = []
        for section in outline["sections"]:
            sections.append({
                "title": section["title"],
                "content": f"{section['title']}的内容详情..."
            })
        
        real_result = await real_executor.create_word(title, f"文档类型: {doc_type}", sections)
        
        document = {
            "type": "full_document",
            "metadata": {
                "title": title,
                "document_type": doc_type,
                "created_at": datetime.now().isoformat(),
                "author": "智办AI"
            },
            "content": {
                "sections": sections
            },
            "real_file": real_result,
            "formatting": {
                "font": "宋体",
                "font_size": 12,
                "line_spacing": 1.5,
                "margins": {"top": 2.54, "bottom": 2.54, "left": 3.17, "right": 3.17}
            },
            "message": real_result.get("message", "文档生成完成")
        }
        
        return document
    
    async def _format_document(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """格式化文档"""
        return {
            "type": "document_formatting",
            "formatting_options": {
                "字体": {
                    "标题": {"字体": "黑体", "字号": 16, "加粗": True},
                    "正文": {"字体": "宋体", "字号": 12},
                    "引用": {"字体": "楷体", "字号": 11, "斜体": True}
                },
                "段落": {
                    "行距": 1.5,
                    "段前": 0.5,
                    "段后": 0.5,
                    "首行缩进": 2
                },
                "页面": {
                    "纸张大小": "A4",
                    "页边距": {"上": 2.54, "下": 2.54, "左": 3.17, "右": 3.17}
                }
            },
            "styles": ["标题1", "标题2", "标题3", "正文", "引用", "列表"]
        }
    
    async def _apply_template(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """应用模板"""
        return {
            "type": "template_application",
            "available_templates": [
                {"name": "工作报告", "description": "适用于工作汇报、项目总结"},
                {"name": "会议纪要", "description": "适用于会议记录"},
                {"name": "通知公告", "description": "适用于公司通知"},
                {"name": "合同协议", "description": "适用于商务合同"},
                {"name": "策划方案", "description": "适用于项目策划"}
            ]
        }
    
    def _detect_document_type(self, description: str) -> str:
        """检测文档类型"""
        if any(word in description for word in ["报告", "汇报", "总结"]):
            return "报告"
        elif any(word in description for word in ["方案", "计划", "策划"]):
            return "方案"
        elif any(word in description for word in ["通知", "公告"]):
            return "通知"
        elif any(word in description for word in ["合同", "协议"]):
            return "合同"
        else:
            return "报告"
    
    def _extract_title(self, description: str) -> str:
        """提取文档标题"""
        patterns = [
            r"关于(.+?)的",
            r"标题[是为](.+?)(?:的|文档)",
            r"写(.+?)(?:文档|报告)"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, description)
            if match:
                return match.group(1).strip()
        
        return "文档标题"
    
    async def answer_query(self, query: Any) -> Any:
        """回答文档相关问题"""
        return {
            "answer": f"我可以帮您生成各类文档，包括报告、方案、总结、通知等",
            "agent": self.name
        }

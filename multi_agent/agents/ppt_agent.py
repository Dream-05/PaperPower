"""
PPT智能体 - 演示文稿生成专家
PPT Agent - Presentation Generation Expert
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


class PPTAgent(BaseAgent):
    """PPT智能体 - 演示文稿生成专家"""
    
    SLIDE_TEMPLATES = {
        "title": {
            "layout": "标题页",
            "elements": ["标题", "副标题", "日期"]
        },
        "content": {
            "layout": "内容页",
            "elements": ["标题", "正文", "要点列表"]
        },
        "two_column": {
            "layout": "两栏布局",
            "elements": ["标题", "左栏内容", "右栏内容"]
        },
        "image": {
            "layout": "图文页",
            "elements": ["标题", "图片", "说明文字"]
        },
        "chart": {
            "layout": "图表页",
            "elements": ["标题", "图表", "数据说明"]
        },
        "conclusion": {
            "layout": "结论页",
            "elements": ["标题", "总结要点", "联系方式"]
        }
    }
    
    THEMES = {
        "商务": {"primary": "#1E3A5F", "secondary": "#4A90D9", "accent": "#F5A623"},
        "科技": {"primary": "#2C3E50", "secondary": "#3498DB", "accent": "#1ABC9C"},
        "简约": {"primary": "#333333", "secondary": "#666666", "accent": "#00BFFF"},
        "创意": {"primary": "#8E44AD", "secondary": "#E74C3C", "accent": "#F39C12"},
        "学术": {"primary": "#003366", "secondary": "#336699", "accent": "#CC6600"}
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="PPTAgent",
            description="演示专家 - PPT设计、内容生成、幻灯片制作",
            task_types=["ppt_generation", "ppt", "presentation", "slides"],
            config=config
        )
        self.presentations: Dict[str, Dict[str, Any]] = {}
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行PPT相关任务"""
        description = task.get("description", "")
        task_type = task.get("task_type", "ppt_generation")
        entities = task.get("entities", {})
        
        logger.info(f"PPTAgent processing: {description[:50]}...")
        
        try:
            if "大纲" in description or "outline" in description.lower():
                result = await self._generate_outline(description, entities)
            elif "设计" in description or "design" in description.lower():
                result = await self._design_slides(description, entities)
            elif "模板" in description or "template" in description.lower():
                result = await self._apply_template(description, entities)
            else:
                result = await self._generate_ppt(description, entities)
            
            return AgentResult(
                success=True,
                output=result,
                metadata={"agent": self.name, "task_type": task_type}
            )
        
        except Exception as e:
            logger.error(f"PPTAgent error: {e}")
            return AgentResult(success=False, output=None, error=str(e))
    
    async def _generate_outline(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """生成PPT大纲"""
        topic = self._extract_topic(description)
        
        outline = {
            "title": topic,
            "slides": [
                {
                    "slide_number": 1,
                    "type": "title",
                    "title": topic,
                    "subtitle": "演示文稿副标题",
                    "notes": "开场白，介绍主题背景"
                },
                {
                    "slide_number": 2,
                    "type": "content",
                    "title": "目录",
                    "content": ["背景介绍", "核心内容", "案例分析", "总结展望"],
                    "notes": "展示整体结构"
                },
                {
                    "slide_number": 3,
                    "type": "content",
                    "title": "背景介绍",
                    "content": [
                        "行业现状与发展趋势",
                        "面临的挑战与机遇",
                        "研究/项目的必要性"
                    ],
                    "notes": "建立背景认知"
                },
                {
                    "slide_number": 4,
                    "type": "content",
                    "title": "核心内容",
                    "content": [
                        "主要观点/方法一",
                        "主要观点/方法二",
                        "主要观点/方法三"
                    ],
                    "notes": "展开核心论述"
                },
                {
                    "slide_number": 5,
                    "type": "two_column",
                    "title": "对比分析",
                    "left_content": ["方案A特点", "优势分析"],
                    "right_content": ["方案B特点", "优势分析"],
                    "notes": "对比展示"
                },
                {
                    "slide_number": 6,
                    "type": "chart",
                    "title": "数据展示",
                    "chart_type": "bar",
                    "data_description": "关键数据指标对比",
                    "notes": "用数据支撑观点"
                },
                {
                    "slide_number": 7,
                    "type": "conclusion",
                    "title": "总结与展望",
                    "content": [
                        "核心要点回顾",
                        "未来发展方向",
                        "行动建议"
                    ],
                    "notes": "收尾总结"
                }
            ],
            "total_slides": 7,
            "estimated_time": "15-20分钟演示"
        }
        
        return {
            "type": "outline_generation",
            "outline": outline,
            "tips": [
                "每页PPT建议不超过6个要点",
                "使用简洁的标题和关键词",
                "配合图表增强视觉效果"
            ]
        }
    
    async def _design_slides(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """设计幻灯片"""
        theme = "商务"
        for theme_name in self.THEMES.keys():
            if theme_name in description:
                theme = theme_name
                break
        
        design = {
            "type": "slide_design",
            "theme": theme,
            "colors": self.THEMES[theme],
            "fonts": {
                "title": {"name": "微软雅黑", "size": 36, "bold": True},
                "subtitle": {"name": "微软雅黑", "size": 24},
                "body": {"name": "微软雅黑", "size": 18}
            },
            "layout_rules": {
                "margins": {"top": 50, "bottom": 50, "left": 60, "right": 60},
                "title_position": "top",
                "content_alignment": "left"
            },
            "animation_suggestions": [
                "标题：淡入效果",
                "要点：逐条显示",
                "图表：擦除效果"
            ]
        }
        
        return design
    
    async def _apply_template(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """应用模板"""
        return {
            "type": "template_application",
            "available_templates": [
                {"name": "商务报告", "slides": 10, "style": "专业简洁"},
                {"name": "项目汇报", "slides": 12, "style": "数据驱动"},
                {"name": "产品介绍", "slides": 8, "style": "图文并茂"},
                {"name": "培训课件", "slides": 15, "style": "互动教学"},
                {"name": "年度总结", "slides": 20, "style": "全面展示"}
            ],
            "customization_options": [
                "修改配色方案",
                "调整字体样式",
                "添加公司Logo",
                "自定义页眉页脚"
            ]
        }
    
    async def _generate_ppt(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """生成完整PPT - 调用真实功能"""
        outline = await self._generate_outline(description, entities)
        design = await self._design_slides(description, entities)
        
        topic = outline["outline"]["title"]
        slides = outline["outline"]["slides"]
        
        real_result = await real_executor.create_ppt(topic, slides)
        
        ppt = {
            "type": "full_ppt_generation",
            "metadata": {
                "title": topic,
                "created_at": datetime.now().isoformat(),
                "total_slides": len(slides)
            },
            "outline": outline["outline"],
            "design": design,
            "real_file": real_result,
            "generation_steps": [
                "1. 分析主题，生成内容大纲 ✓",
                "2. 设计视觉风格和配色 ✓",
                "3. 创建各页幻灯片内容 ✓",
                "4. 生成PPT文件 ✓" if real_result.get("success") else "4. 生成PPT文件（需要安装python-pptx）",
            ],
            "export_options": ["PPTX", "PDF", "图片序列"],
            "message": real_result.get("message", "PPT生成完成")
        }
        
        return ppt
    
    def _extract_topic(self, description: str) -> str:
        """提取PPT主题"""
        patterns = [
            r"关于(.+?)的",
            r"主题[是为](.+?)(?:的|ppt)",
            r"制作(.+?)ppt",
            r"生成(.+?)演示"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return "演示文稿"
    
    async def answer_query(self, query: Any) -> Any:
        """回答PPT相关问题"""
        if isinstance(query, dict):
            question = query.get("question", str(query))
        else:
            question = str(query)
        
        return {
            "answer": f"关于PPT问题'{question}'，我可以帮您生成大纲、设计幻灯片、应用模板",
            "agent": self.name
        }

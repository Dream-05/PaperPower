"""
报告员智能体
负责生成报告和总结
"""

from typing import Dict, List, Any, Optional
import logging
import asyncio
from datetime import datetime

from .base import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class ReporterAgent(BaseAgent):
    """报告员智能体"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__("ReporterAgent", config)
        self.reports: List[Dict[str, Any]] = []
        self.templates = self._load_templates()
    
    def _load_templates(self) -> Dict[str, str]:
        """加载报告模板"""
        return {
            "research": """
# 研究报告

## 摘要
{summary}

## 研究背景
{background}

## 研究方法
{methodology}

## 研究发现
{findings}

## 结论与建议
{conclusions}
""",
            "data_analysis": """
# 数据分析报告

## 概述
{summary}

## 数据描述
{data_description}

## 分析方法
{methodology}

## 分析结果
{results}

## 可视化
{visualizations}

## 结论
{conclusions}
""",
            "project": """
# 项目报告

## 项目概述
{summary}

## 项目目标
{objectives}

## 实施过程
{implementation}

## 成果展示
{deliverables}

## 问题与挑战
{challenges}

## 下一步计划
{next_steps}
""",
            "general": """
# 报告

## 概述
{summary}

## 详细内容
{content}

## 结论
{conclusions}
"""
        }
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行报告生成任务"""
        report_type = task.get("report_type", "general")
        data = task.get("data", {})
        
        logger.info(f"报告员开始生成报告: {report_type}")
        
        # 根据报告类型生成报告
        if report_type == "research":
            result = await self._generate_research_report(data)
        elif report_type == "data_analysis":
            result = await self._generate_data_analysis_report(data)
        elif report_type == "project":
            result = await self._generate_project_report(data)
        else:
            result = await self._generate_general_report(data)
        
        return result
    
    async def _generate_research_report(self, data: Dict[str, Any]) -> AgentResult:
        """生成研究报告"""
        logger.info("生成研究报告")
        
        # 提取数据
        summary = data.get("summary", "研究摘要")
        background = data.get("background", "研究背景")
        methodology = data.get("methodology", "研究方法")
        findings = data.get("findings", [])
        conclusions = data.get("conclusions", "结论与建议")
        
        # 格式化研究发现
        findings_text = "\n".join([
            f"- {finding}" if isinstance(finding, str) 
            else f"- {finding.get('title', '发现')}: {finding.get('description', '')}"
            for finding in findings
        ]) if findings else "暂无研究发现"
        
        # 生成报告
        report = self.templates["research"].format(
            summary=summary,
            background=background,
            methodology=methodology,
            findings=findings_text,
            conclusions=conclusions
        )
        
        report_data = {
            "type": "research",
            "content": report,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "word_count": len(report.split())
            }
        }
        
        self.reports.append(report_data)
        
        return AgentResult(
            success=True,
            output=report_data
        )
    
    async def _generate_data_analysis_report(self, data: Dict[str, Any]) -> AgentResult:
        """生成数据分析报告"""
        logger.info("生成数据分析报告")
        
        # 提取数据
        summary = data.get("summary", "数据分析概述")
        data_description = data.get("data_description", "数据描述")
        methodology = data.get("methodology", "分析方法")
        results = data.get("results", {})
        visualizations = data.get("visualizations", [])
        conclusions = data.get("conclusions", "结论")
        
        # 格式化分析结果
        results_text = "\n".join([
            f"- {key}: {value}"
            for key, value in results.items()
        ]) if results else "暂无分析结果"
        
        # 格式化可视化
        viz_text = "\n".join([
            f"- {viz}" if isinstance(viz, str)
            else f"- {viz.get('title', '图表')}"
            for viz in visualizations
        ]) if visualizations else "暂无可视化"
        
        # 生成报告
        report = self.templates["data_analysis"].format(
            summary=summary,
            data_description=data_description,
            methodology=methodology,
            results=results_text,
            visualizations=viz_text,
            conclusions=conclusions
        )
        
        report_data = {
            "type": "data_analysis",
            "content": report,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "word_count": len(report.split())
            }
        }
        
        self.reports.append(report_data)
        
        return AgentResult(
            success=True,
            output=report_data
        )
    
    async def _generate_project_report(self, data: Dict[str, Any]) -> AgentResult:
        """生成项目报告"""
        logger.info("生成项目报告")
        
        # 提取数据
        summary = data.get("summary", "项目概述")
        objectives = data.get("objectives", "项目目标")
        implementation = data.get("implementation", "实施过程")
        deliverables = data.get("deliverables", [])
        challenges = data.get("challenges", [])
        next_steps = data.get("next_steps", "下一步计划")
        
        # 格式化成果
        deliverables_text = "\n".join([
            f"- {item}" for item in deliverables
        ]) if deliverables else "暂无成果"
        
        # 格式化挑战
        challenges_text = "\n".join([
            f"- {challenge}" for challenge in challenges
        ]) if challenges else "暂无挑战"
        
        # 生成报告
        report = self.templates["project"].format(
            summary=summary,
            objectives=objectives,
            implementation=implementation,
            deliverables=deliverables_text,
            challenges=challenges_text,
            next_steps=next_steps
        )
        
        report_data = {
            "type": "project",
            "content": report,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "word_count": len(report.split())
            }
        }
        
        self.reports.append(report_data)
        
        return AgentResult(
            success=True,
            output=report_data
        )
    
    async def _generate_general_report(self, data: Dict[str, Any]) -> AgentResult:
        """生成通用报告"""
        logger.info("生成通用报告")
        
        # 提取数据
        summary = data.get("summary", "报告概述")
        content = data.get("content", "详细内容")
        conclusions = data.get("conclusions", "结论")
        
        # 生成报告
        report = self.templates["general"].format(
            summary=summary,
            content=content,
            conclusions=conclusions
        )
        
        report_data = {
            "type": "general",
            "content": report,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "word_count": len(report.split())
            }
        }
        
        self.reports.append(report_data)
        
        return AgentResult(
            success=True,
            output=report_data
        )
    
    async def summarize(self, text: str, max_length: int = 200) -> AgentResult:
        """生成摘要"""
        logger.info("生成摘要")
        
        # 简单的摘要生成
        sentences = text.split('。')
        summary = '。'.join(sentences[:3]) if len(sentences) > 3 else text
        
        if len(summary) > max_length:
            summary = summary[:max_length] + "..."
        
        return AgentResult(
            success=True,
            output={
                "original_length": len(text),
                "summary_length": len(summary),
                "summary": summary
            }
        )
    
    def get_reports(self) -> List[Dict[str, Any]]:
        """获取所有报告"""
        return self.reports
    
    def get_latest_report(self) -> Optional[Dict[str, Any]]:
        """获取最新报告"""
        return self.reports[-1] if self.reports else None

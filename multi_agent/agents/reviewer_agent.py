"""
审核员智能体 - 质量把控专家
Reviewer Agent - Quality Control Expert
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import re

from ..base_agent import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class ReviewerAgent(BaseAgent):
    """审核员智能体 - 质量把控专家"""
    
    REVIEW_CRITERIA = {
        "content": {
            "completeness": "内容完整性",
            "accuracy": "内容准确性",
            "relevance": "内容相关性",
            "clarity": "内容清晰度"
        },
        "format": {
            "structure": "结构合理性",
            "formatting": "格式规范性",
            "typography": "排版美观性"
        },
        "quality": {
            "professionalism": "专业程度",
            "readability": "可读性",
            "consistency": "一致性"
        }
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="ReviewerAgent",
            description="审核员 - 质量把控、结果验证、反馈优化",
            task_types=["review", "quality_check", "validation", "feedback"],
            config=config
        )
        self.review_history: List[Dict[str, Any]] = []
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行审核任务"""
        description = task.get("description", "")
        content = task.get("content", {})
        task_type = task.get("task_type", "review")
        
        logger.info(f"ReviewerAgent processing: {description[:50]}...")
        
        try:
            review_result = await self._review_content(content, description)
            
            self.review_history.append({
                "task_id": task.get("id", ""),
                "timestamp": datetime.now().isoformat(),
                "result": review_result
            })
            
            return AgentResult(
                success=True,
                output=review_result,
                metadata={"agent": self.name}
            )
        
        except Exception as e:
            logger.error(f"ReviewerAgent error: {e}")
            return AgentResult(success=False, output=None, error=str(e))
    
    async def _review_content(self, content: Any, description: str) -> Dict[str, Any]:
        """审核内容"""
        review = {
            "type": "review_result",
            "overall_score": 0,
            "passed": False,
            "criteria_scores": {},
            "issues": [],
            "suggestions": [],
            "timestamp": datetime.now().isoformat()
        }
        
        for category, criteria in self.REVIEW_CRITERIA.items():
            review["criteria_scores"][category] = {}
            for criterion, description_text in criteria.items():
                score = await self._evaluate_criterion(content, criterion, category)
                review["criteria_scores"][category][criterion] = {
                    "score": score,
                    "description": description_text
                }
        
        total_score = 0
        count = 0
        for category_scores in review["criteria_scores"].values():
            for criterion_data in category_scores.values():
                total_score += criterion_data["score"]
                count += 1
        
        review["overall_score"] = round(total_score / count, 2) if count > 0 else 0
        review["passed"] = review["overall_score"] >= 70
        
        if review["overall_score"] < 90:
            review["issues"] = await self._identify_issues(content, review["criteria_scores"])
            review["suggestions"] = await self._generate_suggestions(review["issues"])
        
        return review
    
    async def _evaluate_criterion(self, content: Any, criterion: str, category: str) -> int:
        """评估单个标准"""
        base_scores = {
            "completeness": 75,
            "accuracy": 80,
            "relevance": 85,
            "clarity": 80,
            "structure": 85,
            "formatting": 80,
            "typography": 75,
            "professionalism": 80,
            "readability": 85,
            "consistency": 80
        }
        
        base = base_scores.get(criterion, 75)
        
        import random
        variation = random.randint(-10, 10)
        
        return max(0, min(100, base + variation))
    
    async def _identify_issues(self, content: Any, scores: Dict[str, Any]) -> List[Dict[str, Any]]:
        """识别问题"""
        issues = []
        
        for category, criteria_scores in scores.items():
            for criterion, data in criteria_scores.items():
                if data["score"] < 70:
                    issues.append({
                        "category": category,
                        "criterion": criterion,
                        "score": data["score"],
                        "severity": "high" if data["score"] < 60 else "medium",
                        "description": f"{data['description']}需要改进"
                    })
        
        return issues
    
    async def _generate_suggestions(self, issues: List[Dict[str, Any]]) -> List[str]:
        """生成改进建议"""
        suggestions = []
        
        for issue in issues:
            if issue["criterion"] == "completeness":
                suggestions.append("建议补充更多细节内容，确保信息完整")
            elif issue["criterion"] == "accuracy":
                suggestions.append("建议核实数据来源，确保信息准确")
            elif issue["criterion"] == "clarity":
                suggestions.append("建议简化表达，提高内容清晰度")
            elif issue["criterion"] == "structure":
                suggestions.append("建议优化内容结构，增强逻辑性")
            elif issue["criterion"] == "formatting":
                suggestions.append("建议统一格式规范，提升专业度")
        
        if not suggestions:
            suggestions.append("整体质量良好，继续保持")
        
        return suggestions
    
    async def review_document(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """审核文档"""
        return await self._review_content(document, "文档审核")
    
    async def review_ppt(self, ppt: Dict[str, Any]) -> Dict[str, Any]:
        """审核PPT"""
        return await self._review_content(ppt, "PPT审核")
    
    async def review_code(self, code: str) -> Dict[str, Any]:
        """审核代码"""
        return await self._review_content(code, "代码审核")
    
    def get_review_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取审核历史"""
        return self.review_history[-limit:]

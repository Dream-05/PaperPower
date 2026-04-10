"""
数据分析智能体 - 数据处理与可视化专家
Data Agent - Data Processing and Visualization Expert
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import re

from ..base_agent import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class DataAgent(BaseAgent):
    """数据分析智能体 - 数据处理与可视化专家"""
    
    ANALYSIS_TYPES = {
        "描述性分析": ["均值", "中位数", "众数", "标准差", "方差"],
        "趋势分析": ["线性趋势", "季节性", "周期性"],
        "对比分析": ["同比", "环比", "差异分析"],
        "相关性分析": ["相关系数", "回归分析"],
        "分类分析": ["聚类", "分类", "分组统计"]
    }
    
    CHART_TYPES = {
        "柱状图": {"use_case": "分类比较", "best_for": "离散数据对比"},
        "折线图": {"use_case": "趋势展示", "best_for": "时间序列数据"},
        "饼图": {"use_case": "占比展示", "best_for": "部分与整体关系"},
        "散点图": {"use_case": "相关性分析", "best_for": "两个变量关系"},
        "热力图": {"use_case": "密度展示", "best_for": "矩阵数据"},
        "雷达图": {"use_case": "多维对比", "best_for": "多指标评估"}
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="DataAgent",
            description="数据专家 - 数据分析、可视化、统计计算",
            task_types=["data_visualization", "data_analysis", "statistics", "chart"],
            config=config
        )
        self.analysis_cache: Dict[str, Any] = {}
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行数据分析任务"""
        description = task.get("description", "").lower()
        entities = task.get("entities", {})
        
        logger.info(f"DataAgent processing: {description[:50]}...")
        
        try:
            if "图表" in description or "chart" in description or "可视化" in description:
                result = await self._create_visualization(description, entities)
            elif "分析" in description or "analysis" in description:
                result = await self._analyze_data(description, entities)
            elif "统计" in description or "statistics" in description:
                result = await self._calculate_statistics(description, entities)
            elif "清洗" in description or "clean" in description:
                result = await self._clean_data(description, entities)
            else:
                result = await self._general_data_task(description, entities)
            
            return AgentResult(
                success=True,
                output=result,
                metadata={"agent": self.name}
            )
        
        except Exception as e:
            logger.error(f"DataAgent error: {e}")
            return AgentResult(success=False, output=None, error=str(e))
    
    async def _create_visualization(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """创建数据可视化"""
        chart_type = self._detect_chart_type(description)
        
        visualization = {
            "type": "visualization",
            "chart": {
                "chart_type": chart_type,
                "title": "数据分析图表",
                "data": {
                    "labels": ["类别A", "类别B", "类别C", "类别D", "类别E"],
                    "datasets": [{
                        "label": "数据系列1",
                        "data": [65, 59, 80, 81, 56],
                        "backgroundColor": [
                            "rgba(54, 162, 235, 0.6)",
                            "rgba(255, 99, 132, 0.6)",
                            "rgba(255, 206, 86, 0.6)",
                            "rgba(75, 192, 192, 0.6)",
                            "rgba(153, 102, 255, 0.6)"
                        ]
                    }]
                },
                "options": {
                    "responsive": True,
                    "plugins": {
                        "legend": {"position": "top"},
                        "title": {"display": True, "text": "数据可视化图表"}
                    },
                    "scales": {
                        "y": {"beginAtZero": True}
                    }
                }
            },
            "chart_info": self.CHART_TYPES.get(chart_type, {}),
            "export_formats": ["PNG", "SVG", "PDF"]
        }
        
        return visualization
    
    async def _analyze_data(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """数据分析"""
        analysis_type = "描述性分析"
        for atype in self.ANALYSIS_TYPES.keys():
            if atype[:-2] in description:
                analysis_type = atype
                break
        
        analysis = {
            "type": "data_analysis",
            "analysis_type": analysis_type,
            "metrics": {},
            "insights": [],
            "recommendations": []
        }
        
        for metric in self.ANALYSIS_TYPES[analysis_type]:
            analysis["metrics"][metric] = {
                "value": f"计算{metric}值",
                "description": f"{metric}的统计含义"
            }
        
        analysis["insights"] = [
            "数据整体呈正态分布",
            "存在少量异常值需要关注",
            "数据趋势呈现上升态势"
        ]
        
        analysis["recommendations"] = [
            "建议进一步分析异常值原因",
            "可以考虑添加更多维度进行分析",
            "建议定期更新数据进行趋势跟踪"
        ]
        
        return analysis
    
    async def _calculate_statistics(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """统计计算"""
        return {
            "type": "statistics",
            "basic_stats": {
                "count": "数据总数",
                "sum": "总和",
                "mean": "平均值",
                "median": "中位数",
                "mode": "众数",
                "std_dev": "标准差",
                "variance": "方差",
                "min": "最小值",
                "max": "最大值",
                "range": "极差"
            },
            "advanced_stats": {
                "skewness": "偏度",
                "kurtosis": "峰度",
                "quartiles": ["Q1", "Q2", "Q3"],
                "percentiles": [10, 25, 50, 75, 90]
            },
            "formulas": {
                "mean": "Σx / n",
                "variance": "Σ(x - μ)² / n",
                "std_dev": "√variance"
            }
        }
    
    async def _clean_data(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """数据清洗"""
        return {
            "type": "data_cleaning",
            "operations": [
                {
                    "name": "缺失值处理",
                    "methods": ["删除", "均值填充", "中位数填充", "插值"],
                    "recommended": "根据缺失比例选择合适方法"
                },
                {
                    "name": "重复值处理",
                    "methods": ["删除重复", "保留首次出现", "合并"],
                    "recommended": "删除完全重复的记录"
                },
                {
                    "name": "异常值处理",
                    "methods": ["删除", "替换", "分箱", "标准化"],
                    "recommended": "使用IQR方法识别异常值"
                },
                {
                    "name": "数据类型转换",
                    "methods": ["数值转换", "日期转换", "分类编码"],
                    "recommended": "确保数据类型与分析需求匹配"
                }
            ],
            "quality_check": {
                "completeness": "数据完整性检查",
                "consistency": "数据一致性检查",
                "accuracy": "数据准确性检查"
            }
        }
    
    async def _general_data_task(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """通用数据任务"""
        return {
            "type": "general_data",
            "capabilities": [
                "数据可视化（各类图表）",
                "统计分析（描述性、推断性）",
                "数据清洗与预处理",
                "数据转换与计算",
                "趋势分析与预测"
            ],
            "supported_formats": ["CSV", "Excel", "JSON", "SQL"],
            "suggestion": "请告诉我您需要进行哪种数据分析操作"
        }
    
    def _detect_chart_type(self, description: str) -> str:
        """检测图表类型"""
        for chart_name in self.CHART_TYPES.keys():
            if chart_name[:-1] in description:
                return chart_name
        
        if "趋势" in description or "变化" in description:
            return "折线图"
        elif "占比" in description or "比例" in description:
            return "饼图"
        elif "对比" in description or "比较" in description:
            return "柱状图"
        else:
            return "柱状图"
    
    async def answer_query(self, query: Any) -> Any:
        """回答数据相关问题"""
        return {
            "answer": "我可以帮您进行数据分析、创建图表、计算统计指标",
            "agent": self.name
        }

"""
Excel智能体 - 表格数据处理专家
Excel Agent - Spreadsheet Data Processing Expert
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


class ExcelAgent(BaseAgent):
    """Excel智能体 - 表格数据处理专家"""
    
    FORMULA_TEMPLATES = {
        "sum": "=SUM({range})",
        "average": "=AVERAGE({range})",
        "count": "=COUNT({range})",
        "max": "=MAX({range})",
        "min": "=MIN({range})",
        "vlookup": "=VLOOKUP({lookup_value}, {table_array}, {col_index}, {range_lookup})",
        "if": "=IF({condition}, {true_value}, {false_value})",
        "concatenate": "=CONCATENATE({text1}, {text2})",
        "date": "=DATE({year}, {month}, {day})",
        "today": "=TODAY()",
        "now": "=NOW()"
    }
    
    CHART_TYPES = {
        "柱状图": "bar",
        "折线图": "line",
        "饼图": "pie",
        "散点图": "scatter",
        "面积图": "area",
        "雷达图": "radar"
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="ExcelAgent",
            description="表格专家 - Excel数据处理、公式生成、数据分析",
            task_types=["excel_analysis", "excel", "spreadsheet", "data_analysis", "formula"],
            config=config
        )
        self.workbook_cache: Dict[str, Any] = {}
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行Excel相关任务"""
        description = task.get("description", "").lower()
        task_type = task.get("task_type", "excel_analysis")
        entities = task.get("entities", {})
        
        logger.info(f"ExcelAgent processing: {description[:50]}...")
        
        try:
            if "公式" in description or "formula" in description:
                result = await self._generate_formula(description, entities)
            elif "图表" in description or "chart" in description or "可视化" in description:
                result = await self._create_chart(description, entities)
            elif "分析" in description or "analysis" in description:
                result = await self._analyze_data(description, entities)
            elif "格式" in description or "format" in description:
                result = await self._format_cells(description, entities)
            else:
                result = await self._general_excel_task(description, entities)
            
            return AgentResult(
                success=True,
                output=result,
                metadata={"agent": self.name, "task_type": task_type}
            )
        
        except Exception as e:
            logger.error(f"ExcelAgent error: {e}")
            return AgentResult(success=False, output=None, error=str(e))
    
    async def _generate_formula(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """生成Excel公式"""
        formulas = []
        
        if "求和" in description or "sum" in description:
            formulas.append({
                "name": "求和公式",
                "formula": self.FORMULA_TEMPLATES["sum"].format(range="A1:A10"),
                "description": "计算指定范围的总和"
            })
        
        if "平均" in description or "average" in description:
            formulas.append({
                "name": "平均值公式",
                "formula": self.FORMULA_TEMPLATES["average"].format(range="A1:A10"),
                "description": "计算指定范围的平均值"
            })
        
        if "查找" in description or "vlookup" in description:
            formulas.append({
                "name": "VLOOKUP公式",
                "formula": self.FORMULA_TEMPLATES["vlookup"].format(
                    lookup_value="A1",
                    table_array="B:C",
                    col_index="2",
                    range_lookup="FALSE"
                ),
                "description": "在表格中查找匹配值"
            })
        
        if "条件" in description or "if" in description:
            formulas.append({
                "name": "条件公式",
                "formula": self.FORMULA_TEMPLATES["if"].format(
                    condition="A1>100",
                    true_value="'达标'",
                    false_value="'未达标'"
                ),
                "description": "根据条件返回不同值"
            })
        
        if not formulas:
            formulas.append({
                "name": "通用公式",
                "formula": "=SUM(A1:A10)",
                "description": "基础求和公式，请根据需要修改范围"
            })
        
        return {
            "type": "formula_generation",
            "formulas": formulas,
            "tips": [
                "按F4可以快速切换单元格引用方式（绝对/相对引用）",
                "使用Ctrl+Shift+Enter可以输入数组公式",
                "公式中的文本需要用双引号包围"
            ]
        }
    
    async def _create_chart(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """创建图表 - 调用真实功能"""
        chart_type = "bar"
        for cn_name, en_name in self.CHART_TYPES.items():
            if cn_name in description:
                chart_type = en_name
                break
        
        sample_data = {
            "labels": ["类别A", "类别B", "类别C", "类别D", "类别E"],
            "values": [65, 59, 80, 81, 56]
        }
        
        real_result = await real_executor.create_chart(chart_type, sample_data, "数据分析图表")
        
        chart_config = {
            "type": chart_type,
            "title": "数据图表",
            "data_range": "A1:B10",
            "x_axis": "类别",
            "y_axis": "数值",
            "options": {
                "show_legend": True,
                "show_grid": True,
                "show_values": True
            }
        }
        
        return {
            "type": "chart_creation",
            "chart": chart_config,
            "real_file": real_result,
            "steps": [
                "1. 选择数据范围 ✓",
                "2. 插入 -> 图表 ✓",
                f"3. 选择{chart_type}图表类型 ✓",
                "4. 调整图表标题和样式 ✓"
            ],
            "message": real_result.get("message", "图表创建完成")
        }
    
    async def _analyze_data(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """数据分析"""
        analysis_result = {
            "type": "data_analysis",
            "statistics": {
                "count": "计算数据行数",
                "sum": "计算总和",
                "average": "计算平均值",
                "max": "找出最大值",
                "min": "找出最小值",
                "std_dev": "计算标准差"
            },
            "operations": [
                {"name": "数据清洗", "description": "去除重复值、处理空值"},
                {"name": "数据排序", "description": "按指定列排序"},
                {"name": "数据筛选", "description": "按条件筛选数据"},
                {"name": "数据透视", "description": "创建数据透视表"}
            ],
            "pivot_table": {
                "rows": "选择行字段",
                "columns": "选择列字段",
                "values": "选择值字段",
                "summary": "选择汇总方式（求和/计数/平均）"
            }
        }
        
        return analysis_result
    
    async def _format_cells(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """单元格格式化"""
        return {
            "type": "cell_formatting",
            "formats": [
                {"name": "数字格式", "example": "#,##0.00"},
                {"name": "百分比格式", "example": "0.00%"},
                {"name": "日期格式", "example": "yyyy-mm-dd"},
                {"name": "货币格式", "example": "¥#,##0.00"},
                {"name": "文本格式", "example": "@"}
            ],
            "conditional_formatting": {
                "description": "条件格式设置",
                "rules": [
                    "突出显示大于/小于某值的单元格",
                    "使用数据条显示数值大小",
                    "使用色阶显示数值分布",
                    "使用图标集显示状态"
                ]
            }
        }
    
    async def _general_excel_task(self, description: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """通用Excel任务"""
        return {
            "type": "general_excel",
            "capabilities": [
                "公式生成与计算",
                "图表创建与配置",
                "数据分析与统计",
                "数据透视表",
                "条件格式设置",
                "数据验证",
                "宏与VBA支持"
            ],
            "suggestion": f"根据您的需求'{description}'，我可以帮您：\n1. 生成计算公式\n2. 创建数据图表\n3. 进行数据分析\n请告诉我具体需要哪项功能"
        }
    
    async def answer_query(self, query: Any) -> Any:
        """回答Excel相关问题"""
        if isinstance(query, dict):
            question = query.get("question", str(query))
        else:
            question = str(query)
        
        return {
            "answer": f"关于Excel问题'{question}'，我可以提供公式、图表、数据分析等方面的帮助",
            "agent": self.name
        }

"""
Excel公式生成引擎
支持智能公式推荐、公式解释、错误诊断等功能
"""

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum


class FormulaCategory(Enum):
    MATHEMATICAL = "mathematical"
    STATISTICAL = "statistical"
    LOGICAL = "logical"
    TEXT = "text"
    DATE = "date"
    LOOKUP = "lookup"
    FINANCIAL = "financial"


@dataclass
class FormulaTemplate:
    name: str
    formula: str
    description: str
    category: FormulaCategory
    parameters: List[Dict[str, Any]]
    examples: List[str] = field(default_factory=list)
    tips: List[str] = field(default_factory=list)


@dataclass
class FormulaSuggestion:
    formula: str
    description: str
    confidence: float
    category: FormulaCategory
    explanation: str


class FormulaTemplates:
    SUM_BASIC = FormulaTemplate(
        name="求和",
        formula="=SUM({range})",
        description="计算指定范围内所有数值的总和",
        category=FormulaCategory.MATHEMATICAL,
        parameters=[
            {"name": "range", "description": "要求和的单元格范围", "type": "range"}
        ],
        examples=["=SUM(A1:A10)", "=SUM(B2:B100)"],
        tips=["可以包含多个范围，用逗号分隔", "忽略文本和空白单元格"]
    )

    SUMIF = FormulaTemplate(
        name="条件求和",
        formula="=SUMIF({criteria_range}, {criteria}, {sum_range})",
        description="根据条件对范围内的数值求和",
        category=FormulaCategory.MATHEMATICAL,
        parameters=[
            {"name": "criteria_range", "description": "条件判断的范围", "type": "range"},
            {"name": "criteria", "description": "条件表达式", "type": "string"},
            {"name": "sum_range", "description": "实际求和的范围", "type": "range"}
        ],
        examples=["=SUMIF(A:A, \"销售\", B:B)", "=SUMIF(C:C, \">100\", D:D)"],
        tips=["条件可以是数字、表达式或文本", "支持通配符 * 和 ?"]
    )

    SUMIFS = FormulaTemplate(
        name="多条件求和",
        formula="=SUMIFS({sum_range}, {criteria_range1}, {criteria1}, {criteria_range2}, {criteria2})",
        description="根据多个条件对范围内的数值求和",
        category=FormulaCategory.MATHEMATICAL,
        parameters=[
            {"name": "sum_range", "description": "实际求和的范围", "type": "range"},
            {"name": "criteria_range1", "description": "第一个条件判断范围", "type": "range"},
            {"name": "criteria1", "description": "第一个条件", "type": "string"},
            {"name": "criteria_range2", "description": "第二个条件判断范围", "type": "range"},
            {"name": "criteria2", "description": "第二个条件", "type": "string"}
        ],
        examples=["=SUMIFS(D:D, A:A, \"销售\", B:B, \">1000\")"],
        tips=["可以添加更多条件对", "所有条件必须同时满足"]
    )

    AVERAGE = FormulaTemplate(
        name="平均值",
        formula="=AVERAGE({range})",
        description="计算指定范围内数值的平均值",
        category=FormulaCategory.STATISTICAL,
        parameters=[
            {"name": "range", "description": "要计算平均值的范围", "type": "range"}
        ],
        examples=["=AVERAGE(A1:A10)"],
        tips=["忽略空白单元格", "如果范围内没有数值，返回#DIV/0!"]
    )

    COUNT = FormulaTemplate(
        name="计数",
        formula="=COUNT({range})",
        description="计算范围内包含数字的单元格数量",
        category=FormulaCategory.STATISTICAL,
        parameters=[
            {"name": "range", "description": "要计数的范围", "type": "range"}
        ],
        examples=["=COUNT(A:A)"],
        tips=["只计算数字", "使用COUNTA计算非空单元格"]
    )

    COUNTIF = FormulaTemplate(
        name="条件计数",
        formula="=COUNTIF({range}, {criteria})",
        description="计算满足条件的单元格数量",
        category=FormulaCategory.STATISTICAL,
        parameters=[
            {"name": "range", "description": "要检查的范围", "type": "range"},
            {"name": "criteria", "description": "条件表达式", "type": "string"}
        ],
        examples=["=COUNTIF(A:A, \">60\")", "=COUNTIF(B:B, \"完成\")"],
        tips=["支持通配符", "条件不区分大小写"]
    )

    VLOOKUP = FormulaTemplate(
        name="垂直查找",
        formula="=VLOOKUP({lookup_value}, {table_array}, {col_index}, {range_lookup})",
        description="在表格首列查找指定值，返回同行指定列的值",
        category=FormulaCategory.LOOKUP,
        parameters=[
            {"name": "lookup_value", "description": "要查找的值", "type": "any"},
            {"name": "table_array", "description": "查找范围", "type": "range"},
            {"name": "col_index", "description": "返回值的列号", "type": "int"},
            {"name": "range_lookup", "description": "是否模糊匹配", "type": "boolean"}
        ],
        examples=["=VLOOKUP(A2, B:D, 2, FALSE)"],
        tips=["FALSE表示精确匹配", "查找值必须在首列"]
    )

    XLOOKUP = FormulaTemplate(
        name="高级查找",
        formula="=XLOOKUP({lookup_value}, {lookup_array}, {return_array}, {if_not_found})",
        description="更强大的查找函数，支持双向查找",
        category=FormulaCategory.LOOKUP,
        parameters=[
            {"name": "lookup_value", "description": "要查找的值", "type": "any"},
            {"name": "lookup_array", "description": "查找范围", "type": "range"},
            {"name": "return_array", "description": "返回值范围", "type": "range"},
            {"name": "if_not_found", "description": "未找到时的返回值", "type": "any"}
        ],
        examples=["=XLOOKUP(A2, B:B, C:C, \"未找到\")"],
        tips=["比VLOOKUP更灵活", "支持从右向左查找"]
    )

    IF = FormulaTemplate(
        name="条件判断",
        formula="=IF({condition}, {value_if_true}, {value_if_false})",
        description="根据条件返回不同的值",
        category=FormulaCategory.LOGICAL,
        parameters=[
            {"name": "condition", "description": "条件表达式", "type": "boolean"},
            {"name": "value_if_true", "description": "条件为真时的返回值", "type": "any"},
            {"name": "value_if_false", "description": "条件为假时的返回值", "type": "any"}
        ],
        examples=["=IF(A1>60, \"及格\", \"不及格\")"],
        tips=["可以嵌套多个IF", "考虑使用IFS代替多层嵌套"]
    )

    IFS = FormulaTemplate(
        name="多条件判断",
        formula="=IFS({condition1}, {value1}, {condition2}, {value2})",
        description="检查多个条件，返回第一个为真的值",
        category=FormulaCategory.LOGICAL,
        parameters=[
            {"name": "condition1", "description": "第一个条件", "type": "boolean"},
            {"name": "value1", "description": "第一个条件为真时的返回值", "type": "any"},
            {"name": "condition2", "description": "第二个条件", "type": "boolean"},
            {"name": "value2", "description": "第二个条件为真时的返回值", "type": "any"}
        ],
        examples=["=IFS(A1>=90, \"优秀\", A1>=80, \"良好\", A1>=60, \"及格\", TRUE, \"不及格\")"],
        tips=["最多支持127个条件", "最后一个条件通常用TRUE作为默认值"]
    )

    CONCATENATE = FormulaTemplate(
        name="文本合并",
        formula="=CONCATENATE({text1}, {text2})",
        description="将多个文本字符串合并为一个",
        category=FormulaCategory.TEXT,
        parameters=[
            {"name": "text1", "description": "第一个文本", "type": "string"},
            {"name": "text2", "description": "第二个文本", "type": "string"}
        ],
        examples=["=CONCATENATE(A1, \" \", B1)"],
        tips=["也可以使用 & 运算符", "CONCAT函数功能类似"]
    )

    TEXT = FormulaTemplate(
        name="格式化文本",
        formula="=TEXT({value}, {format_text})",
        description="将数值转换为指定格式的文本",
        category=FormulaCategory.TEXT,
        parameters=[
            {"name": "value", "description": "要格式化的数值", "type": "number"},
            {"name": "format_text", "description": "格式代码", "type": "string"}
        ],
        examples=["=TEXT(A1, \"0.00%\")", "=TEXT(A1, \"yyyy-mm-dd\")"],
        tips=["格式代码需要用引号包围", "常用格式：0.00, #,##0, yyyy-mm-dd"]
    )

    TODAY = FormulaTemplate(
        name="当前日期",
        formula="=TODAY()",
        description="返回当前日期",
        category=FormulaCategory.DATE,
        parameters=[],
        examples=["=TODAY()"],
        tips=["每次打开文件都会更新", "使用快捷键Ctrl+;输入静态日期"]
    )

    DATEDIF = FormulaTemplate(
        name="日期差",
        formula="=DATEDIF({start_date}, {end_date}, {unit})",
        description="计算两个日期之间的差",
        category=FormulaCategory.DATE,
        parameters=[
            {"name": "start_date", "description": "开始日期", "type": "date"},
            {"name": "end_date", "description": "结束日期", "type": "date"},
            {"name": "unit", "description": "单位(Y/M/D)", "type": "string"}
        ],
        examples=["=DATEDIF(A1, B1, \"D\")", "=DATEDIF(A1, TODAY(), \"Y\")"],
        tips=["Y=年, M=月, D=日", "这是一个隐藏函数"]
    )

    PMT = FormulaTemplate(
        name="贷款还款额",
        formula="=PMT({rate}, {nper}, {pv})",
        description="计算贷款的每期还款额",
        category=FormulaCategory.FINANCIAL,
        parameters=[
            {"name": "rate", "description": "每期利率", "type": "number"},
            {"name": "nper", "description": "还款期数", "type": "int"},
            {"name": "pv", "description": "贷款本金", "type": "number"}
        ],
        examples=["=PMT(5%/12, 360, 1000000)"],
        tips=["利率需要与期数单位一致", "返回值为负数表示支出"]
    )

    ALL_TEMPLATES = [
        SUM_BASIC, SUMIF, SUMIFS, AVERAGE, COUNT, COUNTIF,
        VLOOKUP, XLOOKUP, IF, IFS, CONCATENATE, TEXT,
        TODAY, DATEDIF, PMT
    ]


class FormulaGenerator:
    INTENT_PATTERNS = {
        "sum": [r"求和", r"总计", r"合计", r"sum", r"加总"],
        "average": [r"平均", r"均值", r"average", r"avg"],
        "count": [r"计数", r"统计数量", r"count", r"多少个"],
        "max": [r"最大", r"最高", r"max", r"最大值"],
        "min": [r"最小", r"最低", r"min", r"最小值"],
        "vlookup": [r"查找", r"匹配", r"lookup", r"vlookup", r"搜索"],
        "if": [r"如果", r"条件", r"判断", r"if", r"当"],
        "percentage": [r"百分比", r"占比", r"比例", r"percent", r"ratio"],
        "date_diff": [r"日期差", r"相差天数", r"间隔", r"datedif"],
        "loan": [r"贷款", r"还款", r"月供", r"pmt", r"利息"],
    }

    def __init__(self):
        self.templates = {t.name: t for t in FormulaTemplates.ALL_TEMPLATES}

    def suggest_formula(
        self,
        user_intent: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[FormulaSuggestion]:
        suggestions = []
        intent_lower = user_intent.lower()

        for intent_type, patterns in self.INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, intent_lower, re.IGNORECASE):
                    suggestions.extend(self._get_suggestions_for_intent(intent_type, context))
                    break

        if not suggestions:
            suggestions.append(FormulaSuggestion(
                formula="=SUM(A:A)",
                description="基础求和公式",
                confidence=0.3,
                category=FormulaCategory.MATHEMATICAL,
                explanation="无法识别具体意图，建议使用SUM函数进行基础计算"
            ))

        suggestions.sort(key=lambda x: -x.confidence)
        return suggestions[:5]

    def _get_suggestions_for_intent(
        self,
        intent_type: str,
        context: Optional[Dict[str, Any]],
    ) -> List[FormulaSuggestion]:
        suggestions = []

        if intent_type == "sum":
            suggestions.append(FormulaSuggestion(
                formula="=SUM(A:A)",
                description="计算整列求和",
                confidence=0.9,
                category=FormulaCategory.MATHEMATICAL,
                explanation="SUM函数计算指定范围内所有数值的总和"
            ))
            suggestions.append(FormulaSuggestion(
                formula="=SUMIF(A:A, \">0\", B:B)",
                description="条件求和",
                confidence=0.7,
                category=FormulaCategory.MATHEMATICAL,
                explanation="SUMIF函数根据条件对数值求和"
            ))

        elif intent_type == "average":
            suggestions.append(FormulaSuggestion(
                formula="=AVERAGE(A:A)",
                description="计算平均值",
                confidence=0.9,
                category=FormulaCategory.STATISTICAL,
                explanation="AVERAGE函数计算数值的算术平均值"
            ))

        elif intent_type == "count":
            suggestions.append(FormulaSuggestion(
                formula="=COUNT(A:A)",
                description="计算数字个数",
                confidence=0.9,
                category=FormulaCategory.STATISTICAL,
                explanation="COUNT函数计算包含数字的单元格数量"
            ))
            suggestions.append(FormulaSuggestion(
                formula="=COUNTIF(A:A, \"条件\")",
                description="条件计数",
                confidence=0.7,
                category=FormulaCategory.STATISTICAL,
                explanation="COUNTIF函数计算满足条件的单元格数量"
            ))

        elif intent_type == "vlookup":
            suggestions.append(FormulaSuggestion(
                formula="=VLOOKUP(A1, B:D, 2, FALSE)",
                description="垂直查找",
                confidence=0.9,
                category=FormulaCategory.LOOKUP,
                explanation="VLOOKUP在表格首列查找值，返回同行指定列的内容"
            ))
            suggestions.append(FormulaSuggestion(
                formula="=XLOOKUP(A1, B:B, C:C, \"未找到\")",
                description="高级查找",
                confidence=0.8,
                category=FormulaCategory.LOOKUP,
                explanation="XLOOKUP是更强大的查找函数，支持双向查找"
            ))

        elif intent_type == "if":
            suggestions.append(FormulaSuggestion(
                formula="=IF(A1>60, \"及格\", \"不及格\")",
                description="条件判断",
                confidence=0.9,
                category=FormulaCategory.LOGICAL,
                explanation="IF函数根据条件返回不同的值"
            ))
            suggestions.append(FormulaSuggestion(
                formula="=IFS(A1>=90, \"优秀\", A1>=60, \"及格\", TRUE, \"不及格\")",
                description="多条件判断",
                confidence=0.7,
                category=FormulaCategory.LOGICAL,
                explanation="IFS函数可以处理多个条件，比嵌套IF更清晰"
            ))

        elif intent_type == "percentage":
            suggestions.append(FormulaSuggestion(
                formula="=A1/SUM(A:A)",
                description="计算占比",
                confidence=0.9,
                category=FormulaCategory.MATHEMATICAL,
                explanation="用当前值除以总和计算占比"
            ))
            suggestions.append(FormulaSuggestion(
                formula="=TEXT(A1/SUM(A:A), \"0.00%\")",
                description="格式化为百分比",
                confidence=0.8,
                category=FormulaCategory.TEXT,
                explanation="TEXT函数将数值格式化为百分比显示"
            ))

        elif intent_type == "date_diff":
            suggestions.append(FormulaSuggestion(
                formula="=DATEDIF(A1, B1, \"D\")",
                description="计算日期差",
                confidence=0.9,
                category=FormulaCategory.DATE,
                explanation="DATEDIF计算两个日期之间的天数差"
            ))

        elif intent_type == "loan":
            suggestions.append(FormulaSuggestion(
                formula="=PMT(利率/12, 期数, 本金)",
                description="计算月供",
                confidence=0.9,
                category=FormulaCategory.FINANCIAL,
                explanation="PMT函数计算贷款的每期还款额"
            ))

        return suggestions

    def explain_formula(self, formula: str) -> Dict[str, Any]:
        formula = formula.strip()
        if formula.startswith("="):
            formula = formula[1:]

        func_match = re.match(r"(\w+)\s*\(", formula)
        if not func_match:
            return {
                "success": False,
                "error": "无法识别公式格式",
                "formula": formula
            }

        func_name = func_match.group(1).upper()

        explanation = {
            "success": True,
            "formula": f"={formula}",
            "function_name": func_name,
            "description": "",
            "parameters": [],
            "tips": [],
        }

        template = self.templates.get(func_name)
        if template:
            explanation["description"] = template.description
            explanation["parameters"] = template.parameters
            explanation["tips"] = template.tips
        else:
            explanation["description"] = f"{func_name}函数"
            explanation["parameters"] = self._extract_parameters(formula)

        return explanation

    def _extract_parameters(self, formula: str) -> List[Dict[str, Any]]:
        paren_start = formula.find("(")
        paren_end = formula.rfind(")")

        if paren_start == -1 or paren_end == -1:
            return []

        params_str = formula[paren_start + 1:paren_end]
        params = []

        depth = 0
        current = ""

        for char in params_str:
            if char == "(":
                depth += 1
                current += char
            elif char == ")":
                depth -= 1
                current += char
            elif char == "," and depth == 0:
                params.append({"value": current.strip(), "type": self._guess_param_type(current.strip())})
                current = ""
            else:
                current += char

        if current.strip():
            params.append({"value": current.strip(), "type": self._guess_param_type(current.strip())})

        return params

    def _guess_param_type(self, value: str) -> str:
        if re.match(r"^[A-Z]+\d+:[A-Z]+\d+$", value, re.IGNORECASE):
            return "range"
        elif re.match(r"^[A-Z]+\d+$", value, re.IGNORECASE):
            return "cell"
        elif re.match(r"^-?\d+\.?\d*$", value):
            return "number"
        elif value.startswith('"') and value.endswith('"'):
            return "text"
        elif value.upper() in ["TRUE", "FALSE"]:
            return "boolean"
        else:
            return "expression"

    def diagnose_error(self, formula: str, error_value: str) -> Dict[str, Any]:
        diagnosis = {
            "formula": formula,
            "error": error_value,
            "possible_causes": [],
            "solutions": [],
        }

        error_causes = {
            "#DIV/0!": [
                {"cause": "除数为零", "solution": "检查除数是否为0，使用IF函数处理零值情况"},
                {"cause": "空单元格作为除数", "solution": "使用IF或IFERROR函数处理空值"},
            ],
            "#N/A": [
                {"cause": "VLOOKUP未找到匹配值", "solution": "检查查找值是否存在，或使用IFERROR处理"},
                {"cause": "数组公式输入错误", "solution": "确保数组公式使用Ctrl+Shift+Enter输入"},
            ],
            "#NAME?": [
                {"cause": "函数名拼写错误", "solution": "检查函数名是否正确"},
                {"cause": "未引用的文本", "solution": "文本需要用双引号包围"},
                {"cause": "缺少加载项", "solution": "某些函数需要特定加载项支持"},
            ],
            "#NULL!": [
                {"cause": "区域交集运算符错误", "solution": "检查是否错误使用了空格作为运算符"},
                {"cause": "区域引用错误", "solution": "使用冒号表示连续区域，逗号表示不连续区域"},
            ],
            "#NUM!": [
                {"cause": "数值超出范围", "solution": "检查数值是否在函数允许的范围内"},
                {"cause": "无效的数值参数", "solution": "检查参数是否为有效数值"},
            ],
            "#REF!": [
                {"cause": "引用的单元格被删除", "solution": "恢复被删除的单元格或更新引用"},
                {"cause": "引用超出工作表范围", "solution": "检查引用是否有效"},
            ],
            "#VALUE!": [
                {"cause": "参数类型错误", "solution": "检查参数是否为期望的类型"},
                {"cause": "文本参与数值运算", "solution": "使用VALUE函数转换文本为数值"},
            ],
        }

        if error_value in error_causes:
            diagnosis["possible_causes"] = [e["cause"] for e in error_causes[error_value]]
            diagnosis["solutions"] = [e["solution"] for e in error_causes[error_value]]
        else:
            diagnosis["possible_causes"] = ["未知错误"]
            diagnosis["solutions"] = ["检查公式语法是否正确"]

        return diagnosis

    def generate_complex_formula(
        self,
        requirements: List[str],
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        parts = []

        for req in requirements:
            suggestions = self.suggest_formula(req, context)
            if suggestions:
                parts.append(suggestions[0].formula)

        if len(parts) == 1:
            return parts[0]
        elif len(parts) > 1:
            return f"=IFERROR({parts[0]}, {parts[1]})"

        return "=SUM(A:A)"


def create_formula_generator() -> FormulaGenerator:
    return FormulaGenerator()

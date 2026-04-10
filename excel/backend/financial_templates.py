"""
财务报表模板库
支持预算表、资产负债表、现金流量表等标准财务报表模板
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
import json


class ReportType(Enum):
    BUDGET = "budget"
    BALANCE_SHEET = "balance_sheet"
    CASH_FLOW = "cash_flow"
    INCOME_STATEMENT = "income_statement"
    PROFIT_LOSS = "profit_loss"


class IndustryType(Enum):
    MANUFACTURING = "manufacturing"
    INTERNET = "internet"
    RETAIL = "retail"
    SERVICE = "service"
    FINANCE = "finance"
    CONSTRUCTION = "construction"
    GENERAL = "general"


@dataclass
class TemplateItem:
    name: str
    code: str
    level: int
    parent_code: Optional[str] = None
    formula: Optional[str] = None
    is_subtotal: bool = False
    is_total: bool = False
    default_value: float = 0.0
    children: List['TemplateItem'] = field(default_factory=list)


@dataclass
class FinancialTemplate:
    name: str
    report_type: ReportType
    industry: IndustryType
    items: List[TemplateItem]
    formulas: Dict[str, str]
    validation_rules: List[Dict[str, Any]]
    description: str = ""


class FinancialTemplateLibrary:
    def __init__(self):
        self.templates: Dict[str, FinancialTemplate] = {}
        self._initialize_templates()
    
    def _initialize_templates(self):
        self._create_budget_templates()
        self._create_balance_sheet_templates()
        self._create_cash_flow_templates()
        self._create_income_statement_templates()
    
    def _create_budget_templates(self):
        budget_items = [
            TemplateItem(name="收入预算", code="A", level=1, is_subtotal=True),
            TemplateItem(name="主营业务收入", code="A01", level=2, parent_code="A"),
            TemplateItem(name="其他业务收入", code="A02", level=2, parent_code="A"),
            TemplateItem(name="投资收益", code="A03", level=2, parent_code="A"),
            TemplateItem(name="营业外收入", code="A04", level=2, parent_code="A"),
            TemplateItem(name="收入合计", code="A99", level=1, formula="SUM(A01:A04)", is_total=True),
            
            TemplateItem(name="支出预算", code="B", level=1, is_subtotal=True),
            TemplateItem(name="人工成本", code="B01", level=2, parent_code="B"),
            TemplateItem(name="  工资薪金", code="B0101", level=3, parent_code="B01"),
            TemplateItem(name="  社保公积金", code="B0102", level=3, parent_code="B01"),
            TemplateItem(name="  福利费", code="B0103", level=3, parent_code="B01"),
            TemplateItem(name="材料成本", code="B02", level=2, parent_code="B"),
            TemplateItem(name="  原材料", code="B0201", level=3, parent_code="B02"),
            TemplateItem(name="  辅助材料", code="B0202", level=3, parent_code="B02"),
            TemplateItem(name="运营费用", code="B03", level=2, parent_code="B"),
            TemplateItem(name="  房租物业", code="B0301", level=3, parent_code="B03"),
            TemplateItem(name="  水电费", code="B0302", level=3, parent_code="B03"),
            TemplateItem(name="  办公费", code="B0303", level=3, parent_code="B03"),
            TemplateItem(name="  差旅费", code="B0304", level=3, parent_code="B03"),
            TemplateItem(name="营销费用", code="B04", level=2, parent_code="B"),
            TemplateItem(name="  广告费", code="B0401", level=3, parent_code="B04"),
            TemplateItem(name="  推广费", code="B0402", level=3, parent_code="B04"),
            TemplateItem(name="研发费用", code="B05", level=2, parent_code="B"),
            TemplateItem(name="财务费用", code="B06", level=2, parent_code="B"),
            TemplateItem(name="  利息支出", code="B0601", level=3, parent_code="B06"),
            TemplateItem(name="  手续费", code="B0602", level=3, parent_code="B06"),
            TemplateItem(name="支出合计", code="B99", level=1, formula="SUM(B01:B06)", is_total=True),
            
            TemplateItem(name="预算结余", code="C99", level=1, formula="A99-B99", is_total=True),
        ]
        
        self.templates["budget_general"] = FinancialTemplate(
            name="通用预算表",
            report_type=ReportType.BUDGET,
            industry=IndustryType.GENERAL,
            items=budget_items,
            formulas={
                "A99": "=SUM(A01,A02,A03,A04)",
                "B99": "=SUM(B01,B02,B03,B04,B05,B06)",
                "C99": "=A99-B99",
            },
            validation_rules=[
                {"rule": "C99 >= 0", "message": "预算结余为负，建议调整支出"},
                {"rule": "B01 > 0", "message": "人工成本未填写"},
            ],
            description="适用于各类企业的通用预算模板",
        )
    
    def _create_balance_sheet_templates(self):
        balance_items = [
            TemplateItem(name="资产", code="A", level=1, is_subtotal=True),
            TemplateItem(name="流动资产", code="A1", level=2, parent_code="A", is_subtotal=True),
            TemplateItem(name="  货币资金", code="A101", level=3, parent_code="A1"),
            TemplateItem(name="  交易性金融资产", code="A102", level=3, parent_code="A1"),
            TemplateItem(name="  应收票据", code="A103", level=3, parent_code="A1"),
            TemplateItem(name="  应收账款", code="A104", level=3, parent_code="A1"),
            TemplateItem(name="  预付款项", code="A105", level=3, parent_code="A1"),
            TemplateItem(name="  其他应收款", code="A106", level=3, parent_code="A1"),
            TemplateItem(name="  存货", code="A107", level=3, parent_code="A1"),
            TemplateItem(name="流动资产合计", code="A199", level=2, formula="SUM(A101:A107)", is_total=True),
            
            TemplateItem(name="非流动资产", code="A2", level=2, parent_code="A", is_subtotal=True),
            TemplateItem(name="  长期股权投资", code="A201", level=3, parent_code="A2"),
            TemplateItem(name="  固定资产", code="A202", level=3, parent_code="A2"),
            TemplateItem(name="  在建工程", code="A203", level=3, parent_code="A2"),
            TemplateItem(name="  无形资产", code="A204", level=3, parent_code="A2"),
            TemplateItem(name="  长期待摊费用", code="A205", level=3, parent_code="A2"),
            TemplateItem(name="非流动资产合计", code="A299", level=2, formula="SUM(A201:A205)", is_total=True),
            TemplateItem(name="资产总计", code="A999", level=1, formula="A199+A299", is_total=True),
            
            TemplateItem(name="负债", code="B", level=1, is_subtotal=True),
            TemplateItem(name="流动负债", code="B1", level=2, parent_code="B", is_subtotal=True),
            TemplateItem(name="  短期借款", code="B101", level=3, parent_code="B1"),
            TemplateItem(name="  应付票据", code="B102", level=3, parent_code="B1"),
            TemplateItem(name="  应付账款", code="B103", level=3, parent_code="B1"),
            TemplateItem(name="  预收款项", code="B104", level=3, parent_code="B1"),
            TemplateItem(name="  应付职工薪酬", code="B105", level=3, parent_code="B1"),
            TemplateItem(name="  应交税费", code="B106", level=3, parent_code="B1"),
            TemplateItem(name="流动负债合计", code="B199", level=2, formula="SUM(B101:B106)", is_total=True),
            
            TemplateItem(name="非流动负债", code="B2", level=2, parent_code="B", is_subtotal=True),
            TemplateItem(name="  长期借款", code="B201", level=3, parent_code="B2"),
            TemplateItem(name="  应付债券", code="B202", level=3, parent_code="B2"),
            TemplateItem(name="非流动负债合计", code="B299", level=2, formula="SUM(B201:B202)", is_total=True),
            TemplateItem(name="负债合计", code="B999", level=1, formula="B199+B299", is_total=True),
            
            TemplateItem(name="所有者权益", code="C", level=1, is_subtotal=True),
            TemplateItem(name="  实收资本", code="C01", level=2, parent_code="C"),
            TemplateItem(name="  资本公积", code="C02", level=2, parent_code="C"),
            TemplateItem(name="  盈余公积", code="C03", level=2, parent_code="C"),
            TemplateItem(name="  未分配利润", code="C04", level=2, parent_code="C"),
            TemplateItem(name="所有者权益合计", code="C999", level=1, formula="SUM(C01:C04)", is_total=True),
            
            TemplateItem(name="负债和所有者权益总计", code="D999", level=1, formula="B999+C999", is_total=True),
        ]
        
        self.templates["balance_sheet_general"] = FinancialTemplate(
            name="资产负债表",
            report_type=ReportType.BALANCE_SHEET,
            industry=IndustryType.GENERAL,
            items=balance_items,
            formulas={
                "A199": "=SUM(A101:A107)",
                "A299": "=SUM(A201:A205)",
                "A999": "=A199+A299",
                "B199": "=SUM(B101:B106)",
                "B299": "=SUM(B201:B202)",
                "B999": "=B199+B299",
                "C999": "=SUM(C01:C04)",
                "D999": "=B999+C999",
            },
            validation_rules=[
                {"rule": "A999 == D999", "message": "资产总计必须等于负债和所有者权益总计"},
            ],
            description="标准资产负债表模板",
        )
    
    def _create_cash_flow_templates(self):
        cash_flow_items = [
            TemplateItem(name="一、经营活动产生的现金流量", code="A", level=1, is_subtotal=True),
            TemplateItem(name="  销售商品、提供劳务收到的现金", code="A01", level=2, parent_code="A"),
            TemplateItem(name="  收到的税费返还", code="A02", level=2, parent_code="A"),
            TemplateItem(name="  收到其他与经营活动有关的现金", code="A03", level=2, parent_code="A"),
            TemplateItem(name="经营活动现金流入小计", code="A99", level=1, formula="SUM(A01:A03)", is_subtotal=True),
            TemplateItem(name="  购买商品、接受劳务支付的现金", code="A10", level=2, parent_code="A"),
            TemplateItem(name="  支付给职工以及为职工支付的现金", code="A11", level=2, parent_code="A"),
            TemplateItem(name="  支付的各项税费", code="A12", level=2, parent_code="A"),
            TemplateItem(name="  支付其他与经营活动有关的现金", code="A13", level=2, parent_code="A"),
            TemplateItem(name="经营活动现金流出小计", code="A98", level=1, formula="SUM(A10:A13)", is_subtotal=True),
            TemplateItem(name="经营活动产生的现金流量净额", code="A97", level=1, formula="A99-A98", is_total=True),
            
            TemplateItem(name="二、投资活动产生的现金流量", code="B", level=1, is_subtotal=True),
            TemplateItem(name="  收回投资收到的现金", code="B01", level=2, parent_code="B"),
            TemplateItem(name="  取得投资收益收到的现金", code="B02", level=2, parent_code="B"),
            TemplateItem(name="投资活动现金流入小计", code="B99", level=1, formula="SUM(B01:B02)", is_subtotal=True),
            TemplateItem(name="  购建固定资产支付的现金", code="B10", level=2, parent_code="B"),
            TemplateItem(name="  投资支付的现金", code="B11", level=2, parent_code="B"),
            TemplateItem(name="投资活动现金流出小计", code="B98", level=1, formula="SUM(B10:B11)", is_subtotal=True),
            TemplateItem(name="投资活动产生的现金流量净额", code="B97", level=1, formula="B99-B98", is_total=True),
            
            TemplateItem(name="三、筹资活动产生的现金流量", code="C", level=1, is_subtotal=True),
            TemplateItem(name="  吸收投资收到的现金", code="C01", level=2, parent_code="C"),
            TemplateItem(name="  取得借款收到的现金", code="C02", level=2, parent_code="C"),
            TemplateItem(name="筹资活动现金流入小计", code="C99", level=1, formula="SUM(C01:C02)", is_subtotal=True),
            TemplateItem(name="  偿还债务支付的现金", code="C10", level=2, parent_code="C"),
            TemplateItem(name="  分配股利支付的现金", code="C11", level=2, parent_code="C"),
            TemplateItem(name="筹资活动现金流出小计", code="C98", level=1, formula="SUM(C10:C11)", is_subtotal=True),
            TemplateItem(name="筹资活动产生的现金流量净额", code="C97", level=1, formula="C99-C98", is_total=True),
            
            TemplateItem(name="四、现金及现金等价物净增加额", code="D99", level=1, formula="A97+B97+C97", is_total=True),
            TemplateItem(name="  期初现金及现金等价物余额", code="D01", level=2, parent_code="D"),
            TemplateItem(name="五、期末现金及现金等价物余额", code="D999", level=1, formula="D99+D01", is_total=True),
        ]
        
        self.templates["cash_flow_general"] = FinancialTemplate(
            name="现金流量表",
            report_type=ReportType.CASH_FLOW,
            industry=IndustryType.GENERAL,
            items=cash_flow_items,
            formulas={
                "A99": "=SUM(A01:A03)",
                "A98": "=SUM(A10:A13)",
                "A97": "=A99-A98",
                "B99": "=SUM(B01:B02)",
                "B98": "=SUM(B10:B11)",
                "B97": "=B99-B98",
                "C99": "=SUM(C01:C02)",
                "C98": "=SUM(C10:C11)",
                "C97": "=C99-C98",
                "D99": "=A97+B97+C97",
                "D999": "=D99+D01",
            },
            validation_rules=[],
            description="标准现金流量表模板",
        )
    
    def _create_income_statement_templates(self):
        income_items = [
            TemplateItem(name="一、营业收入", code="A01", level=1),
            TemplateItem(name="减：营业成本", code="A02", level=1),
            TemplateItem(name="  税金及附加", code="A03", level=1),
            TemplateItem(name="  销售费用", code="A04", level=1),
            TemplateItem(name="  管理费用", code="A05", level=1),
            TemplateItem(name="  财务费用", code="A06", level=1),
            TemplateItem(name="加：其他收益", code="A07", level=1),
            TemplateItem(name="  投资收益", code="A08", level=1),
            TemplateItem(name="二、营业利润", code="A99", level=1, formula="A01-A02-A03-A04-A05-A06+A07+A08", is_subtotal=True),
            TemplateItem(name="加：营业外收入", code="B01", level=1),
            TemplateItem(name="减：营业外支出", code="B02", level=1),
            TemplateItem(name="三、利润总额", code="B99", level=1, formula="A99+B01-B02", is_subtotal=True),
            TemplateItem(name="减：所得税费用", code="C01", level=1),
            TemplateItem(name="四、净利润", code="C99", level=1, formula="B99-C01", is_total=True),
        ]
        
        self.templates["income_statement_general"] = FinancialTemplate(
            name="利润表",
            report_type=ReportType.INCOME_STATEMENT,
            industry=IndustryType.GENERAL,
            items=income_items,
            formulas={
                "A99": "=A01-A02-A03-A04-A05-A06+A07+A08",
                "B99": "=A99+B01-B02",
                "C99": "=B99-C01",
            },
            validation_rules=[],
            description="标准利润表模板",
        )
    
    def get_template(self, template_id: str) -> Optional[FinancialTemplate]:
        return self.templates.get(template_id)
    
    def get_templates_by_type(self, report_type: ReportType) -> List[FinancialTemplate]:
        return [t for t in self.templates.values() if t.report_type == report_type]
    
    def get_templates_by_industry(self, industry: IndustryType) -> List[FinancialTemplate]:
        return [t for t in self.templates.values() if t.industry == industry]
    
    def list_templates(self) -> List[Dict[str, str]]:
        return [
            {
                "id": tid,
                "name": t.name,
                "type": t.report_type.value,
                "industry": t.industry.value,
                "description": t.description,
            }
            for tid, t in self.templates.items()
        ]
    
    def generate_workbook_structure(
        self,
        template_id: str,
        include_formulas: bool = True,
    ) -> Dict[str, Any]:
        template = self.get_template(template_id)
        if not template:
            return {"error": f"模板 {template_id} 不存在"}
        
        structure = {
            "name": template.name,
            "sheets": [
                {
                    "name": template.name,
                    "columns": ["项目", "金额"],
                    "rows": [],
                }
            ],
            "formulas": {},
            "validations": [],
        }
        
        for item in template.items:
            indent = "  " * (item.level - 1)
            row = {
                "项目": f"{indent}{item.name}",
                "金额": item.default_value,
                "code": item.code,
                "is_total": item.is_total,
                "is_subtotal": item.is_subtotal,
            }
            structure["sheets"][0]["rows"].append(row)
            
            if include_formulas and item.formula:
                structure["formulas"][item.code] = item.formula
        
        structure["validations"] = template.validation_rules
        
        return structure
    
    def create_custom_template(
        self,
        name: str,
        report_type: ReportType,
        industry: IndustryType,
        items: List[Dict[str, Any]],
        formulas: Dict[str, str],
        validation_rules: List[Dict[str, Any]],
    ) -> str:
        template_items = []
        for item_data in items:
            template_items.append(TemplateItem(
                name=item_data.get("name", ""),
                code=item_data.get("code", ""),
                level=item_data.get("level", 1),
                parent_code=item_data.get("parent_code"),
                formula=item_data.get("formula"),
                is_subtotal=item_data.get("is_subtotal", False),
                is_total=item_data.get("is_total", False),
                default_value=item_data.get("default_value", 0.0),
            ))
        
        template_id = f"custom_{name.lower().replace(' ', '_')}"
        
        self.templates[template_id] = FinancialTemplate(
            name=name,
            report_type=report_type,
            industry=industry,
            items=template_items,
            formulas=formulas,
            validation_rules=validation_rules,
        )
        
        return template_id


def create_template_library() -> FinancialTemplateLibrary:
    return FinancialTemplateLibrary()

import pytest
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from excel.backend.formula_generator import (
    FormulaCategory,
    FormulaTemplate,
    FormulaSuggestion,
    FormulaTemplates,
    FormulaGenerator,
)


class TestFormulaGenerator:
    """测试公式生成器"""

    def setup_method(self):
        self.generator = FormulaGenerator()

    def test_suggest_formula_sum(self):
        suggestions = self.generator.suggest_formula("求和")
        
        assert len(suggestions) > 0
        assert any("SUM" in s.formula for s in suggestions)

    def test_suggest_formula_average(self):
        suggestions = self.generator.suggest_formula("计算平均值")
        
        assert len(suggestions) > 0
        assert any("AVERAGE" in s.formula for s in suggestions)

    def test_suggest_formula_vlookup(self):
        suggestions = self.generator.suggest_formula("查找匹配")
        
        assert len(suggestions) > 0
        assert any("LOOKUP" in s.formula for s in suggestions)

    def test_suggest_formula_if(self):
        suggestions = self.generator.suggest_formula("条件判断")
        
        assert len(suggestions) > 0
        assert any("IF" in s.formula for s in suggestions)

    def test_explain_formula(self):
        explanation = self.generator.explain_formula("=SUM(A1:A10)")
        
        assert explanation["success"] == True
        assert explanation["function_name"] == "SUM"

    def test_explain_formula_vlookup(self):
        explanation = self.generator.explain_formula("=VLOOKUP(A1, B:D, 2, FALSE)")
        
        assert explanation["success"] == True
        assert explanation["function_name"] == "VLOOKUP"

    def test_diagnose_error_div_zero(self):
        diagnosis = self.generator.diagnose_error("=A1/0", "#DIV/0!")
        
        assert "除数" in diagnosis["possible_causes"][0] or "零" in diagnosis["possible_causes"][0]

    def test_diagnose_error_ref(self):
        diagnosis = self.generator.diagnose_error("=A99999", "#REF!")
        
        assert len(diagnosis["possible_causes"]) > 0
        assert len(diagnosis["solutions"]) > 0

    def test_generate_complex_formula(self):
        formula = self.generator.generate_complex_formula(["求和", "条件"])
        
        assert formula.startswith("=")

    def test_unknown_intent(self):
        suggestions = self.generator.suggest_formula("随机文本xyz")
        
        assert len(suggestions) > 0


class TestFormulaTemplates:
    """测试公式模板"""

    def test_sum_template(self):
        template = FormulaTemplates.SUM_BASIC
        
        assert template.name == "求和"
        assert "SUM" in template.formula
        assert len(template.parameters) > 0

    def test_vlookup_template(self):
        template = FormulaTemplates.VLOOKUP
        
        assert template.name == "垂直查找"
        assert len(template.parameters) == 4

    def test_all_templates_exist(self):
        templates = FormulaTemplates.ALL_TEMPLATES
        
        assert len(templates) > 0
        assert all(isinstance(t, FormulaTemplate) for t in templates)


class TestFormulaSuggestion:
    """测试公式建议"""

    def test_suggestion_creation(self):
        suggestion = FormulaSuggestion(
            formula="=SUM(A:A)",
            description="计算整列求和",
            confidence=0.9,
            category=FormulaCategory.MATHEMATICAL,
            explanation="SUM函数计算指定范围内所有数值的总和"
        )
        
        assert suggestion.formula == "=SUM(A:A)"
        assert suggestion.confidence == 0.9


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

import pytest
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from excel.backend.financial_analyzer import (
    FinancialMetrics,
    BudgetVariance,
    TrendAnalysis,
    FinancialAnalyzer,
)


class TestFinancialAnalyzer:
    """测试财务分析器"""

    def setup_method(self):
        self.analyzer = FinancialAnalyzer()

    def test_analyze_financial_data(self):
        data = [
            {"收入": 10000, "成本": 6000},
            {"收入": 15000, "成本": 8000},
            {"收入": 20000, "成本": 10000},
        ]
        
        result = self.analyzer.analyze_financial_data(data)
        
        assert "metrics" in result
        assert "ratios" in result
        assert result["metrics"]["revenue"] == 45000

    def test_calculate_roi(self):
        roi = self.analyzer.calculate_roi(
            investment=100000,
            returns=120000
        )
        
        assert roi["roi"] == pytest.approx(20.0, rel=0.01)

    def test_budget_variance_analysis(self):
        budget_data = [
            {"项目": "收入", "金额": 100000},
            {"项目": "成本", "金额": 60000},
        ]
        actual_data = [
            {"项目": "收入", "金额": 95000},
            {"项目": "成本", "金额": 65000},
        ]
        
        variances = self.analyzer.budget_variance_analysis(
            budget_data, actual_data, "项目", "金额"
        )
        
        assert len(variances) == 2

    def test_break_even_analysis(self):
        result = self.analyzer.break_even_analysis(
            fixed_costs=100000,
            variable_cost_per_unit=60,
            price_per_unit=100
        )
        
        assert result["break_even_units"] == 2500

    def test_depreciation_schedule(self):
        schedule = self.analyzer.depreciation_schedule(
            asset_cost=100000,
            salvage_value=10000,
            useful_life_years=5,
            method="straight_line"
        )
        
        assert len(schedule) == 5
        assert all(d["depreciation"] > 0 for d in schedule)

    def test_cash_flow_analysis(self):
        data = [
            {"日期": "2024-01", "金额": 100, "类型": "收入"},
            {"日期": "2024-02", "金额": -50, "类型": "支出"},
        ]
        
        result = self.analyzer.cash_flow_analysis(
            data, "日期", "金额", "类型"
        )
        
        assert "total_inflow" in result
        assert "total_outflow" in result


class TestFinancialMetrics:
    """测试财务指标"""

    def test_metrics_creation(self):
        metrics = FinancialMetrics(
            revenue=1000000,
            cost=600000,
            profit=400000,
            profit_margin=40.0,
            growth_rate=0.15
        )
        
        assert metrics.revenue == 1000000
        assert metrics.profit == 400000
        assert metrics.profit_margin == 40.0


class TestBudgetVariance:
    """测试预算差异"""

    def test_variance_creation(self):
        variance = BudgetVariance(
            category="销售收入",
            budgeted=100000,
            actual=95000,
            variance=-5000,
            variance_percent=-5.0,
            status="超支"
        )
        
        assert variance.category == "销售收入"
        assert variance.variance == -5000
        assert variance.status == "超支"


class TestTrendAnalysis:
    """测试趋势分析"""

    def test_trend_creation(self):
        trend = TrendAnalysis(
            metric_name="收入",
            values=[100, 110, 120, 130],
            trend_direction="上升",
            average_change=10.0,
            forecast_next=140.0
        )
        
        assert trend.metric_name == "收入"
        assert trend.trend_direction == "上升"
        assert len(trend.values) == 4


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

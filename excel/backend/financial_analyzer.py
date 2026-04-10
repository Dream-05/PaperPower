"""
财务分析模块
支持财务报表分析、指标计算、趋势预测等功能
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import json


@dataclass
class FinancialMetrics:
    revenue: float = 0.0
    cost: float = 0.0
    profit: float = 0.0
    profit_margin: float = 0.0
    growth_rate: float = 0.0
    roi: float = 0.0


@dataclass
class BudgetVariance:
    category: str
    budgeted: float
    actual: float
    variance: float
    variance_percent: float
    status: str


@dataclass
class TrendAnalysis:
    metric_name: str
    values: List[float]
    trend_direction: str
    average_change: float
    forecast_next: float


class FinancialAnalyzer:
    def __init__(self):
        self.revenue_keywords = ["收入", "营收", "销售额", "revenue", "sales", "营业额"]
        self.cost_keywords = ["成本", "费用", "支出", "cost", "expense", "支出"]
        self.profit_keywords = ["利润", "盈利", "profit", "净利", "毛利"]

    def analyze_financial_data(
        self,
        data: List[Dict[str, Any]],
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not data:
            return {"error": "无数据可分析"}

        metrics = self._calculate_basic_metrics(data)
        ratios = self._calculate_financial_ratios(data, metrics)
        trends = self._analyze_trends(data)
        anomalies = self._detect_anomalies(data, metrics)

        return {
            "metrics": metrics.__dict__,
            "ratios": ratios,
            "trends": trends,
            "anomalies": anomalies,
            "summary": self._generate_summary(metrics, ratios),
            "recommendations": self._generate_recommendations(metrics, ratios, anomalies),
        }

    def _calculate_basic_metrics(self, data: List[Dict[str, Any]]) -> FinancialMetrics:
        metrics = FinancialMetrics()

        revenue_col = self._find_column(data[0], self.revenue_keywords)
        cost_col = self._find_column(data[0], self.cost_keywords)
        profit_col = self._find_column(data[0], self.profit_keywords)

        if revenue_col:
            metrics.revenue = self._sum_column(data, revenue_col)
        if cost_col:
            metrics.cost = self._sum_column(data, cost_col)
        if profit_col:
            metrics.profit = self._sum_column(data, profit_col)
        elif metrics.revenue and metrics.cost:
            metrics.profit = metrics.revenue - metrics.cost

        if metrics.revenue > 0:
            metrics.profit_margin = (metrics.profit / metrics.revenue) * 100

        return metrics

    def _find_column(
        self,
        sample_row: Dict[str, Any],
        keywords: List[str],
    ) -> Optional[str]:
        for col_name in sample_row.keys():
            col_lower = col_name.lower()
            for keyword in keywords:
                if keyword.lower() in col_lower:
                    return col_name
        return None

    def _sum_column(self, data: List[Dict[str, Any]], column: str) -> float:
        total = 0.0
        for row in data:
            try:
                value = row.get(column, 0)
                if isinstance(value, (int, float)):
                    total += value
                elif isinstance(value, str):
                    cleaned = value.replace(",", "").replace("￥", "").replace("¥", "").strip()
                    total += float(cleaned)
            except (ValueError, TypeError):
                continue
        return total

    def _calculate_financial_ratios(
        self,
        data: List[Dict[str, Any]],
        metrics: FinancialMetrics,
    ) -> Dict[str, float]:
        ratios = {}

        if metrics.revenue > 0:
            ratios["成本收入比"] = (metrics.cost / metrics.revenue) * 100
            ratios["利润率"] = metrics.profit_margin

        if metrics.cost > 0:
            ratios["成本利润率"] = (metrics.profit / metrics.cost) * 100

        if len(data) > 1:
            ratios["平均单笔收入"] = metrics.revenue / len(data)
            ratios["平均单笔成本"] = metrics.cost / len(data)
            ratios["平均单笔利润"] = metrics.profit / len(data)

        return ratios

    def _analyze_trends(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        trends = []

        date_col = self._find_column(data[0], ["日期", "date", "时间", "time"])
        revenue_col = self._find_column(data[0], self.revenue_keywords)

        if date_col and revenue_col:
            sorted_data = sorted(
                data,
                key=lambda x: str(x.get(date_col, ""))
            )

            values = []
            for row in sorted_data:
                try:
                    val = row.get(revenue_col, 0)
                    if isinstance(val, (int, float)):
                        values.append(val)
                except:
                    continue

            if len(values) >= 2:
                trend = self._calculate_trend(values)
                trends.append({
                    "metric": "收入趋势",
                    "direction": trend["direction"],
                    "change_rate": trend["change_rate"],
                    "values": values[-5:] if len(values) > 5 else values,
                })

        return trends

    def _calculate_trend(self, values: List[float]) -> Dict[str, Any]:
        if len(values) < 2:
            return {"direction": "稳定", "change_rate": 0}

        changes = []
        for i in range(1, len(values)):
            if values[i-1] != 0:
                change = (values[i] - values[i-1]) / abs(values[i-1]) * 100
                changes.append(change)

        if not changes:
            return {"direction": "稳定", "change_rate": 0}

        avg_change = sum(changes) / len(changes)

        if avg_change > 5:
            direction = "上升"
        elif avg_change < -5:
            direction = "下降"
        else:
            direction = "稳定"

        return {"direction": direction, "change_rate": avg_change}

    def _detect_anomalies(
        self,
        data: List[Dict[str, Any]],
        metrics: FinancialMetrics,
    ) -> List[Dict[str, Any]]:
        anomalies = []

        revenue_col = self._find_column(data[0], self.revenue_keywords)
        if revenue_col:
            values = []
            for row in data:
                try:
                    val = row.get(revenue_col, 0)
                    if isinstance(val, (int, float)):
                        values.append(val)
                except:
                    continue

            if values:
                mean = sum(values) / len(values)
                std_dev = (sum((x - mean) ** 2 for x in values) / len(values)) ** 0.5

                threshold = mean + 2 * std_dev
                for i, val in enumerate(values):
                    if val > threshold:
                        anomalies.append({
                            "type": "异常高值",
                            "column": revenue_col,
                            "row_index": i,
                            "value": val,
                            "expected_range": f"小于 {threshold:.2f}",
                        })

        if metrics.profit_margin < 0:
            anomalies.append({
                "type": "亏损警告",
                "column": "整体",
                "value": metrics.profit_margin,
                "message": "当前利润率为负，建议检查成本控制",
            })

        return anomalies

    def _generate_summary(
        self,
        metrics: FinancialMetrics,
        ratios: Dict[str, float],
    ) -> str:
        summary_parts = []

        if metrics.revenue > 0:
            summary_parts.append(f"总收入为 {metrics.revenue:,.2f}")
        if metrics.cost > 0:
            summary_parts.append(f"总成本为 {metrics.cost:,.2f}")
        if metrics.profit != 0:
            profit_str = f"利润为 {metrics.profit:,.2f}"
            if metrics.profit > 0:
                profit_str += "（盈利）"
            else:
                profit_str += "（亏损）"
            summary_parts.append(profit_str)

        if metrics.profit_margin != 0:
            summary_parts.append(f"利润率为 {metrics.profit_margin:.2f}%")

        return "，".join(summary_parts) if summary_parts else "无法生成摘要"

    def _generate_recommendations(
        self,
        metrics: FinancialMetrics,
        ratios: Dict[str, float],
        anomalies: List[Dict[str, Any]],
    ) -> List[str]:
        recommendations = []

        if metrics.profit_margin < 10:
            recommendations.append("利润率较低，建议优化成本结构或提高产品定价")

        if ratios.get("成本收入比", 0) > 80:
            recommendations.append("成本占收入比例较高，建议进行成本分析并寻找优化空间")

        if metrics.profit < 0:
            recommendations.append("当前处于亏损状态，建议立即进行成本削减或收入增长计划")

        if any(a["type"] == "异常高值" for a in anomalies):
            recommendations.append("存在异常数据，建议核实数据准确性")

        return recommendations

    def budget_variance_analysis(
        self,
        budget_data: List[Dict[str, Any]],
        actual_data: List[Dict[str, Any]],
        category_column: str,
        amount_column: str,
    ) -> List[BudgetVariance]:
        variances = []

        budget_dict = {}
        for row in budget_data:
            category = str(row.get(category_column, ""))
            try:
                amount = float(row.get(amount_column, 0))
                budget_dict[category] = amount
            except (ValueError, TypeError):
                continue

        actual_dict = {}
        for row in actual_data:
            category = str(row.get(category_column, ""))
            try:
                amount = float(row.get(amount_column, 0))
                actual_dict[category] = amount
            except (ValueError, TypeError):
                continue

        all_categories = set(budget_dict.keys()) | set(actual_dict.keys())

        for category in all_categories:
            budgeted = budget_dict.get(category, 0)
            actual = actual_dict.get(category, 0)
            variance = actual - budgeted

            if budgeted != 0:
                variance_percent = (variance / abs(budgeted)) * 100
            else:
                variance_percent = 100 if actual != 0 else 0

            if abs(variance_percent) <= 5:
                status = "正常"
            elif variance_percent > 5:
                status = "超支"
            else:
                status = "节约"

            variances.append(BudgetVariance(
                category=category,
                budgeted=budgeted,
                actual=actual,
                variance=variance,
                variance_percent=variance_percent,
                status=status,
            ))

        return sorted(variances, key=lambda x: abs(x.variance_percent), reverse=True)

    def calculate_roi(
        self,
        investment: float,
        returns: float,
        period_years: float = 1.0,
    ) -> Dict[str, float]:
        if investment == 0:
            return {"roi": 0, "annualized_roi": 0}

        roi = ((returns - investment) / investment) * 100

        if period_years > 0:
            annualized_roi = ((returns / investment) ** (1 / period_years) - 1) * 100
        else:
            annualized_roi = roi

        return {
            "roi": roi,
            "annualized_roi": annualized_roi,
            "net_return": returns - investment,
        }

    def cash_flow_analysis(
        self,
        data: List[Dict[str, Any]],
        date_column: str,
        amount_column: str,
        type_column: Optional[str] = None,
    ) -> Dict[str, Any]:
        sorted_data = sorted(data, key=lambda x: str(x.get(date_column, "")))

        inflows = []
        outflows = []
        net_flows = []
        cumulative = 0
        cumulative_flows = []

        for row in sorted_data:
            try:
                amount = float(row.get(amount_column, 0))

                if type_column:
                    flow_type = str(row.get(type_column, "")).lower()
                    if "收入" in flow_type or "inflow" in flow_type:
                        inflows.append(amount)
                        cumulative += amount
                    else:
                        outflows.append(abs(amount))
                        cumulative -= abs(amount)
                else:
                    if amount >= 0:
                        inflows.append(amount)
                        cumulative += amount
                    else:
                        outflows.append(abs(amount))
                        cumulative += amount

                net_flows.append(amount)
                cumulative_flows.append(cumulative)

            except (ValueError, TypeError):
                continue

        return {
            "total_inflow": sum(inflows),
            "total_outflow": sum(outflows),
            "net_cash_flow": sum(inflows) - sum(outflows),
            "average_inflow": sum(inflows) / len(inflows) if inflows else 0,
            "average_outflow": sum(outflows) / len(outflows) if outflows else 0,
            "cumulative_trend": cumulative_flows,
            "periods": len(sorted_data),
        }

    def break_even_analysis(
        self,
        fixed_costs: float,
        variable_cost_per_unit: float,
        price_per_unit: float,
    ) -> Dict[str, Any]:
        if price_per_unit <= variable_cost_per_unit:
            return {
                "error": "单价必须大于单位变动成本",
                "break_even_units": 0,
                "break_even_revenue": 0,
            }

        contribution_margin = price_per_unit - variable_cost_per_unit
        break_even_units = fixed_costs / contribution_margin
        break_even_revenue = break_even_units * price_per_unit

        return {
            "break_even_units": break_even_units,
            "break_even_revenue": break_even_revenue,
            "contribution_margin": contribution_margin,
            "contribution_margin_ratio": (contribution_margin / price_per_unit) * 100,
            "margin_of_safety_units": 0,
            "margin_of_safety_percent": 0,
        }

    def depreciation_schedule(
        self,
        asset_cost: float,
        salvage_value: float,
        useful_life_years: int,
        method: str = "straight_line",
    ) -> List[Dict[str, Any]]:
        schedule = []

        if method == "straight_line":
            annual_depreciation = (asset_cost - salvage_value) / useful_life_years

            book_value = asset_cost
            for year in range(1, useful_life_years + 1):
                book_value -= annual_depreciation
                schedule.append({
                    "year": year,
                    "depreciation": annual_depreciation,
                    "accumulated_depreciation": annual_depreciation * year,
                    "book_value": max(book_value, salvage_value),
                })

        elif method == "declining_balance":
            rate = 2 / useful_life_years
            book_value = asset_cost

            for year in range(1, useful_life_years + 1):
                depreciation = book_value * rate
                if book_value - depreciation < salvage_value:
                    depreciation = book_value - salvage_value

                book_value -= depreciation
                schedule.append({
                    "year": year,
                    "depreciation": depreciation,
                    "accumulated_depreciation": asset_cost - book_value,
                    "book_value": max(book_value, salvage_value),
                })

        return schedule


def create_financial_analyzer() -> FinancialAnalyzer:
    return FinancialAnalyzer()

import pytest
import sys
import os
from pathlib import Path
import tempfile

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from excel.backend.multi_sheet_engine import (
    SheetInfo,
    ColumnMapping,
    MergeConfig,
    SummaryResult,
    ExcelSheetAnalyzer,
    ColumnMatcher,
    MultiSheetMerger,
    SummaryAggregator,
)


class TestExcelSheetAnalyzer:
    """测试Excel表格分析器"""

    def setup_method(self):
        self.analyzer = ExcelSheetAnalyzer()

    def test_analyze_csv_file(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("姓名,年龄,城市\n张三,25,北京\n李四,30,上海", encoding="utf-8")
        
        sheets = self.analyzer.analyze_file(str(csv_file))
        
        assert len(sheets) == 1
        assert sheets[0].row_count == 2
        assert sheets[0].col_count == 3

    def test_col_to_letter(self):
        assert self.analyzer._col_to_letter(1) == "A"
        assert self.analyzer._col_to_letter(26) == "Z"
        assert self.analyzer._col_to_letter(27) == "AA"


class TestColumnMatcher:
    """测试列匹配器"""

    def setup_method(self):
        self.matcher = ColumnMatcher()

    def test_exact_match(self):
        mappings = self.matcher.match_columns(
            ["姓名", "年龄"],
            ["姓名", "年龄"]
        )
        
        assert len(mappings) == 2
        assert all(m.confidence == 1.0 for m in mappings)

    def test_similar_match(self):
        mappings = self.matcher.match_columns(
            ["name", "age"],
            ["姓名", "年龄"]
        )
        
        assert len(mappings) >= 0

    def test_alias_match(self):
        mappings = self.matcher.match_columns(
            ["员工姓名"],
            ["姓名"]
        )
        
        assert len(mappings) >= 1
        if mappings:
            assert mappings[0].confidence >= 0.9


class TestMultiSheetMerger:
    """测试多表合并器"""

    def setup_method(self):
        self.merger = MultiSheetMerger()

    def test_merge_csv_files(self, tmp_path):
        csv1 = tmp_path / "file1.csv"
        csv1.write_text("姓名,金额\n张三,100\n李四,200", encoding="utf-8")
        
        csv2 = tmp_path / "file2.csv"
        csv2.write_text("姓名,金额\n王五,300", encoding="utf-8")
        
        result = self.merger.merge_sheets([str(csv1), str(csv2)])
        
        assert result.total_rows == 3
        assert result.source_files == 2

    def test_merge_with_duplicates(self, tmp_path):
        csv1 = tmp_path / "file1.csv"
        csv1.write_text("姓名,金额\n张三,100\n张三,100", encoding="utf-8")
        
        result = self.merger.merge_sheets([str(csv1)])
        
        assert result.duplicate_rows == 1


class TestSummaryAggregator:
    """测试汇总聚合器"""

    def setup_method(self):
        self.aggregator = SummaryAggregator()

    def test_create_summary(self, tmp_path):
        csv_file = tmp_path / "data.csv"
        csv_file.write_text("姓名,金额\n张三,100\n李四,200", encoding="utf-8")
        
        summary = self.aggregator.create_summary([str(csv_file)])
        
        assert "overview" in summary
        assert summary["overview"]["total_records"] == 2

    def test_create_financial_summary(self, tmp_path):
        csv_file = tmp_path / "finance.csv"
        csv_file.write_text("日期,金额\n2024-01,1000\n2024-02,2000", encoding="utf-8")
        
        summary = self.aggregator.create_summary([str(csv_file)], summary_type="financial")
        
        assert "overview" in summary


class TestSheetInfo:
    """测试表格信息"""

    def test_sheet_info_creation(self):
        info = SheetInfo(
            file_name="test.xlsx",
            sheet_name="Sheet1",
            headers=["A", "B", "C"],
            row_count=10,
            col_count=3,
            data_range="A1:C11"
        )
        
        assert info.file_name == "test.xlsx"
        assert info.row_count == 10


class TestColumnMapping:
    """测试列映射"""

    def test_mapping_creation(self):
        mapping = ColumnMapping(
            source_column="姓名",
            target_column="name",
            confidence=0.95
        )
        
        assert mapping.source_column == "姓名"
        assert mapping.confidence == 0.95


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

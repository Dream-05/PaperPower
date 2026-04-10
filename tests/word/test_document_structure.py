import sys
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from word.backend.document_engine import (
    DocumentEngine,
    BreakType,
    PageOrientation,
    Margins,
    SectionProperties,
    ParagraphStyle,
    create_document,
    smart_paginate,
)


class TestDocumentEngine:
    def test_create_document(self):
        doc = create_document()
        assert doc is not None
        assert len(doc.sections) == 1
        assert len(doc.content) == 0

    def test_add_paragraph(self):
        doc = DocumentEngine()
        result = doc.add_paragraph("测试段落", "正文")

        assert result["success"] == True
        assert len(doc.content) == 1
        assert doc.content[0]["type"] == "paragraph"
        assert doc.content[0]["text"] == "测试段落"

    def test_add_heading(self):
        doc = DocumentEngine()
        result = doc.add_heading("标题测试", level=1)

        assert result["success"] == True
        assert len(doc.content) == 1

    def test_add_list_item(self):
        doc = DocumentEngine()
        result = doc.add_list_item("列表项", list_type="bullet", level=0)

        assert result["success"] == True
        assert "•" in doc.content[0]["text"]

    def test_add_table(self):
        doc = DocumentEngine()
        result = doc.add_table(rows=3, cols=2)

        assert result["success"] == True
        assert result["rows"] == 3
        assert result["cols"] == 2

    def test_add_image(self):
        doc = DocumentEngine()
        result = doc.add_image("test.png", width=300, height=200)

        assert result["success"] == True
        assert doc.content[0]["type"] == "image"


class TestPageBreaks:
    def test_insert_page_break(self):
        doc = DocumentEngine()
        result = doc.insert_page_break(reason="chapter_end")

        assert result["success"] == True
        assert result["type"] == "page_break"
        assert result["reason"] == "chapter_end"

    def test_insert_page_break_invalid_reason(self):
        doc = DocumentEngine()
        result = doc.insert_page_break(reason="invalid")

        assert result["success"] == True
        assert result["reason"] == "user_request"


class TestSectionBreaks:
    def test_insert_section_break(self):
        doc = DocumentEngine()
        result = doc.insert_section_break(break_type="next_page")

        assert result["success"] == True
        assert result["type"] == "section_break"
        assert len(doc.sections) == 2

    def test_set_section_properties(self):
        doc = DocumentEngine()
        result = doc.set_section_properties(
            margins={"top": 2.0, "bottom": 2.0, "left": 2.5, "right": 2.5},
            orientation="landscape",
        )

        assert result["success"] == True
        assert doc.sections[0].orientation == PageOrientation.LANDSCAPE


class TestStyles:
    def test_default_styles_exist(self):
        doc = DocumentEngine()

        assert "正文" in doc.styles
        assert "标题1" in doc.styles
        assert "标题2" in doc.styles

    def test_define_custom_style(self):
        doc = DocumentEngine()
        custom_style = ParagraphStyle(
            name="自定义样式",
            font_name_zh="楷体",
            font_size=14.0,
            bold=True,
        )

        result = doc.define_style(custom_style)

        assert result["success"] == True
        assert "自定义样式" in doc.styles

    def test_apply_style(self):
        doc = DocumentEngine()
        doc.add_paragraph("段落1", "正文")
        doc.add_paragraph("段落2", "正文")

        result = doc.apply_style("标题1", [0])

        assert result["success"] == True
        assert doc.content[0]["style"]["name"] == "标题1"


class TestDocumentStructure:
    def test_get_document_structure(self):
        doc = DocumentEngine()
        doc.add_heading("第一章", level=1)
        doc.add_paragraph("正文内容", "正文")
        doc.add_heading("第二章", level=1)

        structure = doc.get_document_structure()

        assert structure["total_paragraphs"] == 3
        assert len(structure["headings"]) == 2

    def test_to_dict(self):
        doc = DocumentEngine()
        doc.add_paragraph("测试", "正文")

        data = doc.to_dict()

        assert "sections" in data
        assert "styles" in data
        assert "content" in data

    def test_from_dict(self):
        doc1 = DocumentEngine()
        doc1.add_paragraph("测试", "正文")

        data = doc1.to_dict()
        doc2 = DocumentEngine.from_dict(data)

        assert len(doc2.content) == 1
        assert doc2.content[0]["text"] == "测试"


class TestSmartPaginate:
    def test_smart_paginate_empty(self):
        doc = DocumentEngine()
        breaks = smart_paginate(doc)

        assert len(breaks) == 0

    def test_smart_paginate_with_content(self):
        doc = DocumentEngine()
        for i in range(20):
            doc.add_paragraph(f"段落{i}", "正文")

        breaks = smart_paginate(doc, max_paragraphs_per_page=10)

        assert len(breaks) > 0

    def test_smart_paginate_with_headings(self):
        doc = DocumentEngine()
        doc.add_heading("第一章", level=1)
        for i in range(5):
            doc.add_paragraph(f"段落{i}", "正文")
        doc.add_heading("第二章", level=1)

        breaks = smart_paginate(doc)

        assert len(breaks) > 0


class TestMargins:
    def test_margins_to_dict(self):
        margins = Margins(top=2.0, bottom=2.0, left=2.5, right=2.5)
        data = margins.to_dict()

        assert data["top"] == 2.0
        assert data["left"] == 2.5


class TestSectionProperties:
    def test_section_properties_to_dict(self):
        props = SectionProperties()
        data = props.to_dict()

        assert "margins" in data
        assert "orientation" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

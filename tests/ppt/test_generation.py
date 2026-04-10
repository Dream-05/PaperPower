import pytest
import sys
import os
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ppt.backend.ppt_generator import (
    PPTStyle,
    PageType,
    PPTConfig,
    PageInfo,
    PPTRequest,
    PPTResult,
    IntentParser,
    PPTGenerator,
    PPTPipeline,
)


class TestIntentParser:
    """测试意图解析器"""

    def setup_method(self):
        self.parser = IntentParser()

    def test_parse_basic_input(self):
        request = self.parser.parse("科技风项目介绍PPT")
        
        assert len(request.keywords) > 0
        assert request.style == PPTStyle.TECH

    def test_extract_keywords(self):
        keywords = self.parser._extract_keywords("做一个关于人工智能的商业计划PPT")
        
        assert len(keywords) > 0

    def test_detect_tech_style(self):
        style = self.parser._detect_style("做一个科技风的产品介绍")
        
        assert style == PPTStyle.TECH

    def test_detect_business_style(self):
        style = self.parser._detect_style("商务汇报PPT")
        
        assert style == PPTStyle.BUSINESS

    def test_detect_minimal_style(self):
        style = self.parser._detect_style("极简风格的设计展示")
        
        assert style == PPTStyle.MINIMAL

    def test_estimate_pages_explicit(self):
        pages = self.parser._estimate_pages("做一个15页的产品介绍PPT")
        
        assert pages == 15

    def test_estimate_pages_brief(self):
        pages = self.parser._estimate_pages("简短的项目汇报")
        
        assert pages == 8

    def test_suggest_structure_project_intro(self):
        request = PPTRequest(user_input="项目介绍PPT")
        structure = self.parser.suggest_structure(request)
        
        assert "封面" in structure
        assert "封底" in structure
        assert len(structure) >= 5


class TestPPTGenerator:
    """测试PPT生成器"""

    def setup_method(self):
        self.generator = PPTGenerator()

    def test_generate_basic_ppt(self):
        request = PPTRequest(
            user_input="科技风项目介绍",
            keywords=["科技", "项目"],
            style=PPTStyle.TECH,
            page_count=8
        )
        
        result = asyncio.run(self.generator.generate(request))
        
        assert result.success
        assert len(result.pages) > 0
        assert result.metadata["style"] == "tech"

    def test_create_pages(self):
        request = PPTRequest(
            user_input="测试PPT",
            keywords=["测试"],
            style=PPTStyle.BUSINESS
        )
        structure = ["封面", "目录", "内容", "封底"]
        
        pages = asyncio.run(self.generator._create_pages(request, structure))
        
        assert len(pages) == 4
        assert pages[0].page_type == PageType.COVER
        assert pages[-1].page_type == PageType.END

    def test_determine_page_type(self):
        assert self.generator._determine_page_type(0, 5, "封面") == PageType.COVER
        assert self.generator._determine_page_type(1, 5, "目录") == PageType.TOC
        assert self.generator._determine_page_type(4, 5, "封底") == PageType.END


class TestPPTPipeline:
    """测试PPT生成流水线"""

    def setup_method(self):
        self.pipeline = PPTPipeline()

    def test_run_basic(self):
        result = asyncio.run(self.pipeline.run("科技风项目介绍PPT"))
        
        assert result.success
        assert result.file_path is not None or result.metadata is not None


class TestPPTConfig:
    """测试PPT配置"""

    def test_default_config(self):
        config = PPTConfig()
        
        assert config.style == PPTStyle.MODERN
        assert config.page_count == 12
        assert config.aspect_ratio == (16, 9)

    def test_custom_config(self):
        config = PPTConfig(
            title="测试标题",
            style=PPTStyle.BUSINESS,
            page_count=15
        )
        
        assert config.title == "测试标题"
        assert config.style == PPTStyle.BUSINESS
        assert config.page_count == 15


class TestPageInfo:
    """测试页面信息"""

    def test_page_info_creation(self):
        page = PageInfo(
            page_type=PageType.CONTENT,
            title="测试标题",
            subtitle="测试副标题",
            content=["要点1", "要点2"],
            notes="讲者备注"
        )
        
        assert page.page_type == PageType.CONTENT
        assert len(page.content) == 2
        assert page.notes == "讲者备注"


class TestPPTRequest:
    """测试PPT请求"""

    def test_request_creation(self):
        request = PPTRequest(
            user_input="测试输入",
            keywords=["关键词1", "关键词2"],
            style=PPTStyle.CREATIVE,
            page_count=12,
            user_id="user123"
        )
        
        assert request.user_input == "测试输入"
        assert len(request.keywords) == 2
        assert request.style == PPTStyle.CREATIVE


class TestPPTResult:
    """测试PPT结果"""

    def test_success_result(self):
        result = PPTResult(
            success=True,
            file_path="/path/to/ppt.pptx",
            pages=[PageInfo(page_type=PageType.COVER, title="封面")],
            metadata={"style": "tech"}
        )
        
        assert result.success
        assert result.error is None

    def test_error_result(self):
        result = PPTResult(
            success=False,
            error="生成失败"
        )
        
        assert not result.success
        assert result.error == "生成失败"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

import pytest
import sys
import os
from pathlib import Path
import asyncio

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from word.backend.content_generator import (
    ContentGenerator,
    ContentContext,
    SearchResult,
    SearchCache,
    WebSearcher,
)


class TestWebSearcher:
    """测试网页搜索器"""

    def setup_method(self):
        self.searcher = WebSearcher()

    def test_extract_keywords(self):
        keywords = self.searcher.extract_keywords("写一篇关于人工智能的报告")
        
        assert len(keywords) > 0

    def test_extract_keywords_empty(self):
        keywords = self.searcher.extract_keywords("")
        
        assert keywords == []

    def test_extract_keywords_short(self):
        keywords = self.searcher.extract_keywords("测试")
        
        assert isinstance(keywords, list)


class TestSearchCache:
    """测试搜索缓存"""

    def setup_method(self):
        import tempfile
        self.temp_dir = tempfile.mkdtemp()
        self.cache = SearchCache(cache_dir=self.temp_dir)

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_cache_set_and_get(self):
        result = SearchResult(
            title="测试",
            url="https://example.com",
            snippet="测试摘要",
            source="bing"
        )
        
        self.cache.set("test_key", [result])
        cached = self.cache.get("test_key")
        
        assert cached is not None
        assert len(cached) == 1

    def test_cache_miss(self):
        cached = self.cache.get("nonexistent")
        
        assert cached is None


class TestContentGenerator:
    """测试内容生成器"""

    def setup_method(self):
        self.generator = ContentGenerator()

    @pytest.mark.asyncio
    async def test_generate_short_instruction(self):
        result = await self.generator.generate("写一个简短的问候")
        
        assert result is not None
        assert len(result) > 0

    @pytest.mark.asyncio
    async def test_generate_with_context(self):
        context = ContentContext(
            document_type="报告",
            topic="人工智能",
            style="正式"
        )
        
        result = await self.generator.generate("介绍AI发展", context=context)
        
        assert result is not None

    def test_detect_document_type(self):
        doc_type = self.generator._detect_document_type("写一份项目报告")
        
        assert doc_type is not None

    @pytest.mark.asyncio
    async def test_rewrite(self):
        result = await self.generator.rewrite("这是一段测试文本", "更加正式")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_continue_writing(self):
        result = await self.generator.continue_writing("人工智能正在改变世界。")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_summarize(self):
        text = "人工智能（AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。"
        result = await self.generator.summarize(text)
        
        assert result is not None


class TestContentContext:
    """测试内容上下文"""

    def test_default_context(self):
        context = ContentContext()
        
        assert context.document_type == "general"
        assert context.topic == ""

    def test_custom_context(self):
        context = ContentContext(
            document_type="报告",
            topic="AI",
            style="正式",
            length_hint=1000
        )
        
        assert context.document_type == "报告"
        assert context.topic == "AI"
        assert context.length_hint == 1000


class TestSearchResult:
    """测试搜索结果"""

    def test_search_result_creation(self):
        result = SearchResult(
            title="测试标题",
            url="https://example.com",
            snippet="测试摘要",
            source="bing"
        )
        
        assert result.title == "测试标题"
        assert result.url == "https://example.com"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

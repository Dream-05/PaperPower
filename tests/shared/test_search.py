import pytest
import sys
import os
import tempfile
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from shared.search_engine import (
    SearchType,
    SearchSource,
    SearchResult,
    SearchRequest,
    SearchCache,
    KeywordExpander,
    BingSearcher,
    UnsplashSearcher,
    UnifiedSearchEngine,
)


class TestSearchCache:
    """测试搜索缓存"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.cache = SearchCache(Path(self.temp_dir), default_ttl=60)

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_set_and_get(self):
        results = [
            SearchResult(
                title="测试结果",
                url="https://example.com",
                snippet="测试摘要",
                source=SearchSource.BING,
            )
        ]
        
        self.cache.set("test_key", results)
        cached = self.cache.get("test_key")
        
        assert cached is not None
        assert len(cached) == 1
        assert cached[0].title == "测试结果"

    def test_get_nonexistent(self):
        cached = self.cache.get("nonexistent_key")
        assert cached is None


class TestKeywordExpander:
    """测试关键词扩展器"""

    def setup_method(self):
        self.expander = KeywordExpander()

    def test_expand_tech_style(self):
        expanded = self.expander.expand("科技风PPT")
        
        assert len(expanded) > 1
        assert any("科技" in kw for kw in expanded)

    def test_expand_business_style(self):
        expanded = self.expander.expand("商务风汇报")
        
        assert len(expanded) > 1

    def test_to_english(self):
        english = self.expander.to_english("科技风PPT模板")
        
        assert "tech" in english.lower() or "presentation" in english.lower()


class TestSearchRequest:
    """测试搜索请求"""

    def test_cache_key_generation(self):
        request1 = SearchRequest(query="测试", search_type=SearchType.WEB)
        request2 = SearchRequest(query="测试", search_type=SearchType.WEB)
        request3 = SearchRequest(query="其他", search_type=SearchType.WEB)
        
        assert request1.get_cache_key() == request2.get_cache_key()
        assert request1.get_cache_key() != request3.get_cache_key()

    def test_default_values(self):
        request = SearchRequest(query="测试")
        
        assert request.search_type == SearchType.WEB
        assert request.max_results == 10
        assert request.language == "zh-CN"
        assert request.safe_search == True


class TestSearchResult:
    """测试搜索结果"""

    def test_to_dict(self):
        result = SearchResult(
            title="测试标题",
            url="https://example.com",
            snippet="测试摘要",
            source=SearchSource.BING,
            search_type=SearchType.WEB,
            score=0.9,
        )
        
        d = result.to_dict()
        
        assert d["title"] == "测试标题"
        assert d["url"] == "https://example.com"
        assert d["source"] == "bing"
        assert d["score"] == 0.9


class TestBingSearcher:
    """测试Bing搜索器"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.cache = SearchCache(Path(self.temp_dir))
        self.searcher = BingSearcher(cache=self.cache)

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_mock_search(self):
        import asyncio
        request = SearchRequest(
            query="测试搜索",
            search_type=SearchType.WEB,
            max_results=5,
        )
        
        results = asyncio.run(self.searcher.search(request))
        
        assert len(results) > 0
        assert all(r.source == SearchSource.BING for r in results)


class TestUnsplashSearcher:
    """测试Unsplash搜索器"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.cache = SearchCache(Path(self.temp_dir))
        self.searcher = UnsplashSearcher(cache=self.cache)

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_mock_search(self):
        import asyncio
        request = SearchRequest(
            query="科技背景",
            search_type=SearchType.IMAGE,
            max_results=5,
        )
        
        results = asyncio.run(self.searcher.search(request))
        
        assert len(results) > 0
        assert all(r.search_type == SearchType.IMAGE for r in results)


class TestUnifiedSearchEngine:
    """测试统一搜索引擎"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.engine = UnifiedSearchEngine(cache=SearchCache(Path(self.temp_dir)))

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_search(self):
        import asyncio
        results = asyncio.run(self.engine.search(
            query="测试搜索",
            search_type=SearchType.WEB,
            max_results=10,
        ))
        
        assert isinstance(results, list)

    def test_search_images(self):
        import asyncio
        results = asyncio.run(self.engine.search_images(
            query="科技背景",
            max_results=10,
        ))
        
        assert isinstance(results, list)

    def test_search_academic(self):
        import asyncio
        results = asyncio.run(self.engine.search_academic(
            query="machine learning",
            max_results=5,
        ))
        
        assert isinstance(results, list)

    def test_get_default_sources(self):
        web_sources = self.engine._get_default_sources(SearchType.WEB)
        assert SearchSource.BING in web_sources
        
        image_sources = self.engine._get_default_sources(SearchType.IMAGE)
        assert SearchSource.BING in image_sources
        assert SearchSource.UNSPLASH in image_sources


class TestSearchTypes:
    """测试搜索类型枚举"""

    def test_search_type_values(self):
        assert SearchType.WEB.value == "web"
        assert SearchType.IMAGE.value == "image"
        assert SearchType.ACADEMIC.value == "academic"
        assert SearchType.TEMPLATE.value == "template"

    def test_search_source_values(self):
        assert SearchSource.BING.value == "bing"
        assert SearchSource.UNSPLASH.value == "unsplash"
        assert SearchSource.ARXIV.value == "arxiv"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

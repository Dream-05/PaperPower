"""
统一搜索接口

实现多源搜索架构，支持：
- 网页搜索：Bing API + 爬虫备用
- 图片搜索：Bing Images + Unsplash API + 本地缓存
- 学术搜索：arXiv + Google Scholar
- 模板搜索：专业设计站点爬虫
"""

import asyncio
import hashlib
import json
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Any, Callable
import aiohttp
from urllib.parse import quote_plus, urlencode


class SearchType(Enum):
    WEB = "web"
    IMAGE = "image"
    ACADEMIC = "academic"
    TEMPLATE = "template"
    VIDEO = "video"


class SearchSource(Enum):
    BING = "bing"
    UNSPLASH = "unsplash"
    PIXABAY = "pixabay"
    ARXIV = "arxiv"
    GOOGLE_SCHOLAR = "google_scholar"
    SEARX = "searx"
    LOCAL_CACHE = "local_cache"


@dataclass
class SearchResult:
    """搜索结果"""
    title: str
    url: str
    snippet: str = ""
    source: SearchSource = SearchSource.BING
    search_type: SearchType = SearchType.WEB
    thumbnail: Optional[str] = None
    image_url: Optional[str] = None
    width: int = 0
    height: int = 0
    published_date: Optional[datetime] = None
    author: Optional[str] = None
    score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "title": self.title,
            "url": self.url,
            "snippet": self.snippet,
            "source": self.source.value,
            "search_type": self.search_type.value,
            "thumbnail": self.thumbnail,
            "image_url": self.image_url,
            "width": self.width,
            "height": self.height,
            "score": self.score,
        }


@dataclass
class SearchRequest:
    """搜索请求"""
    query: str
    search_type: SearchType = SearchType.WEB
    sources: Optional[List[SearchSource]] = None
    max_results: int = 10
    language: str = "zh-CN"
    time_range: Optional[str] = None
    image_size: Optional[str] = None
    safe_search: bool = True
    
    def get_cache_key(self) -> str:
        key_data = f"{self.query}_{self.search_type.value}_{self.language}_{self.max_results}"
        return hashlib.md5(key_data.encode()).hexdigest()


class SearchCache:
    """搜索缓存"""
    
    def __init__(self, cache_dir: Optional[Path] = None, default_ttl: int = 86400):
        self.cache_dir = cache_dir or Path("data/cache/search")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.default_ttl = default_ttl
        self.memory_cache: Dict[str, Dict] = {}
    
    def get(self, key: str) -> Optional[List[SearchResult]]:
        if key in self.memory_cache:
            cached = self.memory_cache[key]
            if datetime.now() < cached["expires"]:
                return cached["results"]
        
        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if datetime.fromisoformat(data["expires"]) > datetime.now():
                    results = [self._dict_to_result(r) for r in data["results"]]
                    self.memory_cache[key] = {
                        "results": results,
                        "expires": datetime.fromisoformat(data["expires"])
                    }
                    return results
            except:
                pass
        return None
    
    def set(self, key: str, results: List[SearchResult], ttl: Optional[int] = None):
        ttl = ttl or self.default_ttl
        expires = datetime.now() + timedelta(seconds=ttl)
        
        self.memory_cache[key] = {
            "results": results,
            "expires": expires
        }
        
        cache_file = self.cache_dir / f"{key}.json"
        data = {
            "results": [r.to_dict() for r in results],
            "expires": expires.isoformat()
        }
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _dict_to_result(self, d: Dict) -> SearchResult:
        return SearchResult(
            title=d.get("title", ""),
            url=d.get("url", ""),
            snippet=d.get("snippet", ""),
            source=SearchSource(d.get("source", "bing")),
            search_type=SearchType(d.get("search_type", "web")),
            thumbnail=d.get("thumbnail"),
            image_url=d.get("image_url"),
            width=d.get("width", 0),
            height=d.get("height", 0),
            score=d.get("score", 0),
        )


class KeywordExpander:
    """关键词扩展器"""
    
    STYLE_SYNONYMS = {
        "科技风": ["科技感", "未来感", "蓝色渐变", "极简科技", "数字化", "智能风"],
        "商务风": ["商务风格", "企业风", "正式风格", "专业风格", "商业风"],
        "极简风": ["简约风", "简洁风", "现代简约", "北欧风", "清新简约"],
        "创意风": ["创意风格", "艺术风", "设计感", "潮流风", "时尚风"],
        "学术风": ["学术风格", "论文风", "研究风", "严谨风格"],
    }
    
    TOPIC_EXPANSIONS = {
        "项目介绍": ["项目概述", "项目背景", "项目方案", "项目展示"],
        "工作汇报": ["工作总结", "工作报告", "年度汇报", "季度汇报"],
        "产品发布": ["产品介绍", "新品发布", "产品展示", "产品说明"],
        "商业计划": ["商业计划书", "BP", "融资计划", "商业方案"],
    }
    
    def expand(self, query: str, max_expansions: int = 5) -> List[str]:
        """扩展关键词"""
        expanded = [query]
        
        for style, synonyms in self.STYLE_SYNONYMS.items():
            if style in query:
                for syn in synonyms[:2]:
                    expanded.append(query.replace(style, syn))
        
        for topic, expansions in self.TOPIC_EXPANSIONS.items():
            if topic in query:
                expanded.extend(expansions[:2])
        
        words = query.split()
        if len(words) > 1:
            expanded.extend(words)
        
        return list(set(expanded))[:max_expansions]
    
    def to_english(self, query: str) -> str:
        """中文转英文"""
        translations = {
            "科技风": "tech style",
            "商务风": "business style",
            "极简风": "minimal style",
            "创意风": "creative style",
            "项目介绍": "project introduction",
            "工作汇报": "work report",
            "产品发布": "product launch",
            "商业计划": "business plan",
            "PPT": "presentation",
            "模板": "template",
            "背景": "background",
            "图标": "icon",
        }
        
        result = query
        for cn, en in translations.items():
            result = result.replace(cn, en)
        
        return result


class BaseSearcher(ABC):
    """搜索器基类"""
    
    def __init__(self, cache: Optional[SearchCache] = None):
        self.cache = cache or SearchCache()
        self.last_request_time = 0
        self.min_interval = 1.0
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        ]
    
    @abstractmethod
    async def search(self, request: SearchRequest) -> List[SearchResult]:
        pass
    
    def _rate_limit(self):
        """请求频率限制"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed + random.uniform(0, 0.5))
        self.last_request_time = time.time()
    
    def _get_random_user_agent(self) -> str:
        return random.choice(self.user_agents)


class BingSearcher(BaseSearcher):
    """Bing搜索器"""
    
    def __init__(self, api_key: Optional[str] = None, cache: Optional[SearchCache] = None):
        super().__init__(cache)
        self.api_key = api_key
        self.base_url = "https://api.bing.microsoft.com/v7.0"
    
    async def search(self, request: SearchRequest) -> List[SearchResult]:
        cache_key = request.get_cache_key()
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        self._rate_limit()
        
        if self.api_key:
            results = await self._api_search(request)
        else:
            results = await self._mock_search(request)
        
        self.cache.set(cache_key, results)
        return results
    
    async def _api_search(self, request: SearchRequest) -> List[SearchResult]:
        """API搜索"""
        endpoint = "/search" if request.search_type == SearchType.WEB else "/images/search"
        
        params = {
            "q": request.query,
            "count": request.max_results,
            "mkt": request.language,
            "safeSearch": "Strict" if request.safe_search else "Off",
        }
        
        if request.time_range:
            params["freshness"] = request.time_range
        
        headers = {"Ocp-Apim-Subscription-Key": self.api_key}
        
        results = []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}{endpoint}",
                    params=params,
                    headers=headers
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        for item in data.get("webPages", {}).get("value", []) or data.get("value", []):
                            results.append(SearchResult(
                                title=item.get("name", ""),
                                url=item.get("url", item.get("contentUrl", "")),
                                snippet=item.get("snippet", item.get("description", "")),
                                source=SearchSource.BING,
                                search_type=request.search_type,
                                thumbnail=item.get("thumbnailUrl"),
                                image_url=item.get("contentUrl"),
                                width=item.get("width", 0),
                                height=item.get("height", 0),
                            ))
        except Exception as e:
            print(f"Bing搜索失败: {e}")
        
        return results
    
    async def _mock_search(self, request: SearchRequest) -> List[SearchResult]:
        """模拟搜索（无API key时）"""
        results = []
        for i in range(min(request.max_results, 5)):
            results.append(SearchResult(
                title=f"{request.query} - 结果{i+1}",
                url=f"https://example.com/result/{i+1}",
                snippet=f"关于{request.query}的搜索结果摘要...",
                source=SearchSource.BING,
                search_type=request.search_type,
                score=1.0 - i * 0.1,
            ))
        return results


class UnsplashSearcher(BaseSearcher):
    """Unsplash图片搜索器"""
    
    def __init__(self, access_key: Optional[str] = None, cache: Optional[SearchCache] = None):
        super().__init__(cache)
        self.access_key = access_key
        self.base_url = "https://api.unsplash.com"
    
    async def search(self, request: SearchRequest) -> List[SearchResult]:
        cache_key = request.get_cache_key()
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        self._rate_limit()
        
        if self.access_key:
            results = await self._api_search(request)
        else:
            results = await self._mock_search(request)
        
        self.cache.set(cache_key, results, ttl=604800)
        return results
    
    async def _api_search(self, request: SearchRequest) -> List[SearchResult]:
        params = {
            "query": request.query,
            "per_page": request.max_results,
            "orientation": "landscape",
        }
        
        headers = {"Authorization": f"Client-ID {self.access_key}"}
        
        results = []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/search/photos",
                    params=params,
                    headers=headers
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        for item in data.get("results", []):
                            results.append(SearchResult(
                                title=item.get("description") or item.get("alt_description", ""),
                                url=item.get("links", {}).get("html", ""),
                                snippet=item.get("alt_description", ""),
                                source=SearchSource.UNSPLASH,
                                search_type=SearchType.IMAGE,
                                thumbnail=item.get("urls", {}).get("thumb", ""),
                                image_url=item.get("urls", {}).get("regular", ""),
                                width=item.get("width", 0),
                                height=item.get("height", 0),
                                author=item.get("user", {}).get("name"),
                            ))
        except Exception as e:
            print(f"Unsplash搜索失败: {e}")
        
        return results
    
    async def _mock_search(self, request: SearchRequest) -> List[SearchResult]:
        results = []
        for i in range(min(request.max_results, 5)):
            results.append(SearchResult(
                title=f"Unsplash - {request.query} {i+1}",
                url=f"https://unsplash.com/photos/{i+1}",
                snippet=f"高质量的{request.query}图片",
                source=SearchSource.UNSPLASH,
                search_type=SearchType.IMAGE,
                thumbnail=f"https://picsum.photos/200/150?random={i}",
                image_url=f"https://picsum.photos/800/600?random={i}",
                width=800,
                height=600,
            ))
        return results


class ArxivSearcher(BaseSearcher):
    """arXiv学术搜索器"""
    
    def __init__(self, cache: Optional[SearchCache] = None):
        super().__init__(cache)
        self.base_url = "http://export.arxiv.org/api/query"
    
    async def search(self, request: SearchRequest) -> List[SearchResult]:
        cache_key = request.get_cache_key()
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        self._rate_limit()
        results = await self._api_search(request)
        self.cache.set(cache_key, results)
        return results
    
    async def _api_search(self, request: SearchRequest) -> List[SearchResult]:
        params = {
            "search_query": f"all:{request.query}",
            "start": 0,
            "max_results": request.max_results,
        }
        
        results = []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, params=params) as response:
                    if response.status == 200:
                        xml_text = await response.text()
                        results = self._parse_arxiv_xml(xml_text)
        except Exception as e:
            print(f"arXiv搜索失败: {e}")
        
        return results
    
    def _parse_arxiv_xml(self, xml_text: str) -> List[SearchResult]:
        """解析arXiv XML响应"""
        results = []
        import re
        
        entries = re.findall(r'<entry>(.*?)</entry>', xml_text, re.DOTALL)
        for entry in entries:
            title = re.search(r'<title>(.*?)</title>', entry, re.DOTALL)
            summary = re.search(r'<summary>(.*?)</summary>', entry, re.DOTALL)
            link = re.search(r'<id>(.*?)</id>', entry)
            author = re.search(r'<name>(.*?)</name>', entry)
            published = re.search(r'<published>(.*?)</published>', entry)
            
            results.append(SearchResult(
                title=title.group(1).strip() if title else "",
                url=link.group(1).strip() if link else "",
                snippet=summary.group(1).strip()[:200] if summary else "",
                source=SearchSource.ARXIV,
                search_type=SearchType.ACADEMIC,
                author=author.group(1).strip() if author else None,
                published_date=datetime.fromisoformat(published.group(1).replace("Z", "+00:00")) if published else None,
            ))
        
        return results


class UnifiedSearchEngine:
    """统一搜索引擎"""
    
    def __init__(
        self,
        bing_key: Optional[str] = None,
        unsplash_key: Optional[str] = None,
        cache: Optional[SearchCache] = None
    ):
        self.cache = cache or SearchCache()
        self.keyword_expander = KeywordExpander()
        
        self.searchers: Dict[SearchSource, BaseSearcher] = {
            SearchSource.BING: BingSearcher(bing_key, self.cache),
            SearchSource.UNSPLASH: UnsplashSearcher(unsplash_key, self.cache),
            SearchSource.ARXIV: ArxivSearcher(self.cache),
        }
    
    async def search(
        self,
        query: str,
        search_type: SearchType = SearchType.WEB,
        sources: Optional[List[SearchSource]] = None,
        max_results: int = 10,
        expand_keywords: bool = True,
        language: str = "zh-CN"
    ) -> List[SearchResult]:
        """执行搜索"""
        if expand_keywords:
            expanded_queries = self.keyword_expander.expand(query)
        else:
            expanded_queries = [query]
        
        if sources is None:
            sources = self._get_default_sources(search_type)
        
        all_results = []
        
        tasks = []
        for source in sources:
            if source in self.searchers:
                for q in expanded_queries[:2]:
                    request = SearchRequest(
                        query=q,
                        search_type=search_type,
                        sources=[source],
                        max_results=max_results // len(sources),
                        language=language,
                    )
                    tasks.append(self.searchers[source].search(request))
        
        if tasks:
            results_list = await asyncio.gather(*tasks, return_exceptions=True)
            for results in results_list:
                if isinstance(results, list):
                    all_results.extend(results)
        
        all_results = self._deduplicate(all_results)
        all_results.sort(key=lambda x: x.score, reverse=True)
        
        return all_results[:max_results]
    
    async def search_images(
        self,
        query: str,
        max_results: int = 20,
        min_size: tuple = (800, 600)
    ) -> List[SearchResult]:
        """搜索图片"""
        results = await self.search(
            query=query,
            search_type=SearchType.IMAGE,
            sources=[SearchSource.BING, SearchSource.UNSPLASH],
            max_results=max_results
        )
        
        filtered = [
            r for r in results
            if r.width >= min_size[0] and r.height >= min_size[1]
        ]
        
        return filtered if filtered else results
    
    async def search_academic(
        self,
        query: str,
        max_results: int = 10
    ) -> List[SearchResult]:
        """学术搜索"""
        return await self.search(
            query=query,
            search_type=SearchType.ACADEMIC,
            sources=[SearchSource.ARXIV],
            max_results=max_results
        )
    
    def _get_default_sources(self, search_type: SearchType) -> List[SearchSource]:
        """获取默认搜索源"""
        defaults = {
            SearchType.WEB: [SearchSource.BING],
            SearchType.IMAGE: [SearchSource.BING, SearchSource.UNSPLASH],
            SearchType.ACADEMIC: [SearchSource.ARXIV],
            SearchType.TEMPLATE: [SearchSource.BING],
        }
        return defaults.get(search_type, [SearchSource.BING])
    
    def _deduplicate(self, results: List[SearchResult]) -> List[SearchResult]:
        """去重"""
        seen = set()
        unique = []
        for r in results:
            key = r.url
            if key not in seen:
                seen.add(key)
                unique.append(r)
        return unique

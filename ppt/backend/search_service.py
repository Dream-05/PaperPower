#!/usr/bin/env python3
"""
网络搜索和图片搜索服务
支持Google Custom Search、Bing Search、Unsplash、Pexels等API
"""

import os
import asyncio
import aiohttp
import json
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime
import hashlib


@dataclass
class SearchResult:
    """搜索结果"""
    title: str
    url: str
    snippet: str
    source: str
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


@dataclass
class ImageResult:
    """图片搜索结果"""
    id: str
    url: str
    thumbnail_url: str
    description: str
    photographer: str
    source: str
    width: int
    height: int
    download_url: Optional[str] = None


class WebSearchService:
    """网络搜索服务"""
    
    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.google_cx = os.getenv("GOOGLE_CX")
        self.bing_api_key = os.getenv("BING_API_KEY")
        
    async def search(self, query: str, num_results: int = 10) -> List[SearchResult]:
        """执行网络搜索"""
        results = []
        
        # 尝试Google搜索
        if self.google_api_key and self.google_cx:
            try:
                google_results = await self._google_search(query, num_results)
                results.extend(google_results)
            except Exception as e:
                print(f"Google search failed: {e}")
        
        # 尝试Bing搜索
        if self.bing_api_key and len(results) < num_results:
            try:
                bing_results = await self._bing_search(query, num_results - len(results))
                results.extend(bing_results)
            except Exception as e:
                print(f"Bing search failed: {e}")
        
        # 如果没有API密钥，使用DuckDuckGo（无需API密钥）
        if not results:
            try:
                ddg_results = await self._duckduckgo_search(query, num_results)
                results.extend(ddg_results)
            except Exception as e:
                print(f"DuckDuckGo search failed: {e}")
        
        return results[:num_results]
    
    async def _google_search(self, query: str, num_results: int) -> List[SearchResult]:
        """Google Custom Search"""
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": self.google_api_key,
            "cx": self.google_cx,
            "q": query,
            "num": num_results
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
                
        results = []
        for item in data.get("items", []):
            results.append(SearchResult(
                title=item.get("title", ""),
                url=item.get("link", ""),
                snippet=item.get("snippet", ""),
                source="Google",
                image_url=item.get("pagemap", {}).get("cse_thumbnail", [{}])[0].get("src"),
                thumbnail_url=item.get("pagemap", {}).get("cse_thumbnail", [{}])[0].get("src")
            ))
        
        return results
    
    async def _bing_search(self, query: str, num_results: int) -> List[SearchResult]:
        """Bing Search API"""
        url = "https://api.bing.microsoft.com/v7.0/search"
        headers = {"Ocp-Apim-Subscription-Key": self.bing_api_key}
        params = {"q": query, "count": num_results}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                data = await response.json()
        
        results = []
        for item in data.get("webPages", {}).get("value", []):
            results.append(SearchResult(
                title=item.get("name", ""),
                url=item.get("url", ""),
                snippet=item.get("snippet", ""),
                source="Bing",
                image_url=item.get("thumbnail", {}).get("url"),
                thumbnail_url=item.get("thumbnail", {}).get("url")
            ))
        
        return results
    
    async def _duckduckgo_search(self, query: str, num_results: int) -> List[SearchResult]:
        """DuckDuckGo搜索（无需API密钥）"""
        url = "https://api.duckduckgo.com/"
        params = {
            "q": query,
            "format": "json",
            "no_html": 1,
            "skip_disambig": 1
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
        
        results = []
        
        # 相关主题
        for topic in data.get("RelatedTopics", [])[:num_results]:
            if isinstance(topic, dict) and "Text" in topic:
                results.append(SearchResult(
                    title=topic.get("Text", "").split(" - ")[0] if " - " in topic.get("Text", "") else topic.get("Text", "")[:50],
                    url=topic.get("FirstURL", ""),
                    snippet=topic.get("Text", ""),
                    source="DuckDuckGo",
                    thumbnail_url=topic.get("Icon", {}).get("URL")
                ))
        
        return results


class ImageSearchService:
    """图片搜索服务"""
    
    def __init__(self, download_dir: Optional[Path] = None):
        self.unsplash_api_key = os.getenv("UNSPLASH_API_KEY")
        self.pexels_api_key = os.getenv("PEXELS_API_KEY")
        self.pixabay_api_key = os.getenv("PIXABAY_API_KEY")
        self.download_dir = download_dir or Path("data/assets/ppt_images")
        self.download_dir.mkdir(parents=True, exist_ok=True)
    
    async def search_images(self, query: str, num_results: int = 20) -> List[ImageResult]:
        """搜索图片"""
        results = []
        
        # 并行搜索多个图片源
        tasks = []
        
        if self.unsplash_api_key:
            tasks.append(self._unsplash_search(query, num_results // 3))
        
        if self.pexels_api_key:
            tasks.append(self._pexels_search(query, num_results // 3))
        
        if self.pixabay_api_key:
            tasks.append(self._pixabay_search(query, num_results // 3))
        
        if tasks:
            search_results = await asyncio.gather(*tasks, return_exceptions=True)
            for result in search_results:
                if isinstance(result, list):
                    results.extend(result)
        
        # 如果没有API密钥，使用占位图片服务
        if not results:
            results = await self._placeholder_search(query, num_results)
        
        return results[:num_results]
    
    async def _unsplash_search(self, query: str, num_results: int) -> List[ImageResult]:
        """Unsplash图片搜索"""
        url = "https://api.unsplash.com/search/photos"
        headers = {"Authorization": f"Client-ID {self.unsplash_api_key}"}
        params = {"query": query, "per_page": num_results}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                data = await response.json()
        
        results = []
        for item in data.get("results", []):
            results.append(ImageResult(
                id=item.get("id", ""),
                url=item.get("urls", {}).get("regular", ""),
                thumbnail_url=item.get("urls", {}).get("thumb", ""),
                description=item.get("description") or item.get("alt_description", ""),
                photographer=item.get("user", {}).get("name", ""),
                source="Unsplash",
                width=item.get("width", 0),
                height=item.get("height", 0),
                download_url=item.get("urls", {}).get("full", "")
            ))
        
        return results
    
    async def _pexels_search(self, query: str, num_results: int) -> List[ImageResult]:
        """Pexels图片搜索"""
        url = "https://api.pexels.com/v1/search"
        headers = {"Authorization": self.pexels_api_key}
        params = {"query": query, "per_page": num_results}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                data = await response.json()
        
        results = []
        for item in data.get("photos", []):
            results.append(ImageResult(
                id=str(item.get("id", "")),
                url=item.get("src", {}).get("large", ""),
                thumbnail_url=item.get("src", {}).get("tiny", ""),
                description=item.get("alt", ""),
                photographer=item.get("photographer", ""),
                source="Pexels",
                width=item.get("width", 0),
                height=item.get("height", 0),
                download_url=item.get("src", {}).get("original", "")
            ))
        
        return results
    
    async def _pixabay_search(self, query: str, num_results: int) -> List[ImageResult]:
        """Pixabay图片搜索"""
        url = "https://pixabay.com/api/"
        params = {
            "key": self.pixabay_api_key,
            "q": query,
            "per_page": num_results,
            "image_type": "photo"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                data = await response.json()
        
        results = []
        for item in data.get("hits", []):
            results.append(ImageResult(
                id=str(item.get("id", "")),
                url=item.get("webformatURL", ""),
                thumbnail_url=item.get("previewURL", ""),
                description=item.get("tags", ""),
                photographer=item.get("user", ""),
                source="Pixabay",
                width=item.get("webformatWidth", 0),
                height=item.get("webformatHeight", 0),
                download_url=item.get("largeImageURL", "")
            ))
        
        return results
    
    async def _placeholder_search(self, query: str, num_results: int) -> List[ImageResult]:
        """占位图片搜索（用于演示）"""
        results = []
        for i in range(num_results):
            width = 800
            height = 600
            results.append(ImageResult(
                id=f"placeholder_{i}",
                url=f"https://picsum.photos/seed/{query.replace(' ', '_')}_{i}/{width}/{height}",
                thumbnail_url=f"https://picsum.photos/seed/{query.replace(' ', '_')}_{i}/200/150",
                description=f"Placeholder image for {query}",
                photographer="Picsum Photos",
                source="Picsum",
                width=width,
                height=height,
                download_url=f"https://picsum.photos/seed/{query.replace(' ', '_')}_{i}/{width}/{height}"
            ))
        
        return results
    
    async def download_image(self, image: ImageResult, filename: Optional[str] = None) -> str:
        """下载图片"""
        if not filename:
            hash_input = f"{image.id}_{image.url}"
            filename = f"{hashlib.md5(hash_input.encode()).hexdigest()}.jpg"
        
        file_path = self.download_dir / filename
        
        # 如果文件已存在，直接返回
        if file_path.exists():
            return str(file_path)
        
        # 下载图片
        download_url = image.download_url or image.url
        
        async with aiohttp.ClientSession() as session:
            async with session.get(download_url) as response:
                if response.status == 200:
                    content = await response.read()
                    with open(file_path, "wb") as f:
                        f.write(content)
                    return str(file_path)
        
        raise Exception(f"Failed to download image: {image.url}")
    
    async def download_images(self, images: List[ImageResult]) -> List[str]:
        """批量下载图片"""
        tasks = [self.download_image(img) for img in images]
        return await asyncio.gather(*tasks, return_exceptions=True)


class TemplateSearchService:
    """PPT模板搜索服务"""
    
    def __init__(self, download_dir: Optional[Path] = None):
        self.download_dir = download_dir or Path("data/assets/ppt_templates")
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.web_search = WebSearchService()
    
    async def search_templates(self, query: str, num_results: int = 10) -> List[Dict[str, Any]]:
        """搜索PPT模板"""
        search_query = f"{query} PPT模板 PowerPoint template"
        results = await self.web_search.search(search_query, num_results)
        
        templates = []
        for result in results:
            templates.append({
                "title": result.title,
                "url": result.url,
                "description": result.snippet,
                "thumbnail": result.thumbnail_url,
                "source": result.source
            })
        
        return templates
    
    async def search_elements(self, style: str, category: str = "icons") -> List[Dict[str, Any]]:
        """搜索PPT元素（图标、形状、背景等）"""
        search_query = f"{style} {category} PPT elements"
        results = await self.web_search.search(search_query, 20)
        
        elements = []
        for result in results:
            elements.append({
                "title": result.title,
                "url": result.url,
                "description": result.snippet,
                "thumbnail": result.thumbnail_url,
                "type": category
            })
        
        return elements


class ContentResearchService:
    """内容研究服务 - 搜索相关内容用于PPT生成"""
    
    def __init__(self):
        self.web_search = WebSearchService()
        self.image_search = ImageSearchService()
    
    async def research_topic(self, topic: str) -> Dict[str, Any]:
        """研究主题，收集相关信息"""
        # 并行执行多个搜索
        web_task = self.web_search.search(topic, 10)
        images_task = self.image_search.search_images(topic, 20)
        
        web_results, image_results = await asyncio.gather(web_task, images_task)
        
        # 提取关键信息
        key_points = []
        for result in web_results:
            if result.snippet:
                key_points.append(result.snippet)
        
        return {
            "topic": topic,
            "web_results": [
                {
                    "title": r.title,
                    "url": r.url,
                    "snippet": r.snippet,
                    "source": r.source
                }
                for r in web_results
            ],
            "images": [
                {
                    "id": img.id,
                    "url": img.url,
                    "thumbnail": img.thumbnail_url,
                    "description": img.description,
                    "photographer": img.photographer,
                    "source": img.source
                }
                for img in image_results
            ],
            "key_points": key_points[:5],
            "researched_at": datetime.now().isoformat()
        }

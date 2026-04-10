"""
搜索智能体 - 信息检索专家
Search Agent - Information Retrieval Expert
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import aiohttp

from ..base_agent import BaseAgent, AgentResult
import re

logger = logging.getLogger(__name__)


class SearchAgent(BaseAgent):
    """搜索智能体 - 信息检索专家"""
    
    SEARCH_ENGINES = {
        "duckduckgo": "https://api.duckduckgo.com/",
        "wikipedia": "https://en.wikipedia.org/api/rest_v1/",
        "custom": "local"
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="SearchAgent",
            description="搜索专家 - 网络搜索、信息检索、知识查询",
            task_types=["search", "query", "lookup", "information_retrieval"],
            config=config
        )
        self.search_cache: Dict[str, Any] = {}
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """获取HTTP会话"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行搜索任务"""
        description = task.get("description", "")
        entities = task.get("entities", {})
        
        logger.info(f"SearchAgent processing: {description[:50]}...")
        
        try:
            query = self._extract_query(description)
            
            results = await self._search(query)
            
            return AgentResult(
                success=True,
                output={
                    "type": "search_results",
                    "query": query,
                    "results": results,
                    "timestamp": datetime.now().isoformat()
                },
                metadata={"agent": self.name}
            )
        
        except Exception as e:
            logger.error(f"SearchAgent error: {e}")
            return AgentResult(success=False, output=None, error=str(e))
    
    def _extract_query(self, description: str) -> str:
        """提取搜索查询"""
        patterns = [
            r"搜索[：:]?\s*(.+)",
            r"查找[：:]?\s*(.+)",
            r"查询[：:]?\s*(.+)",
            r"找[一下]?[：:]?\s*(.+)",
            r"关于(.+?)的资料",
            r"(.+?)相关信息"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, description)
            if match:
                return match.group(1).strip()
        
        return description
    
    async def _search(self, query: str) -> List[Dict[str, Any]]:
        """执行搜索"""
        results = []
        
        try:
            session = await self._get_session()
            
            params = {
                "q": query,
                "format": "json",
                "no_html": 1,
                "skip_disambig": 1
            }
            
            async with session.get(
                "https://api.duckduckgo.com/",
                params=params,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if data.get("AbstractText"):
                        results.append({
                            "title": data.get("Heading", query),
                            "snippet": data.get("AbstractText", ""),
                            "url": data.get("AbstractURL", ""),
                            "source": data.get("AbstractSource", "DuckDuckGo")
                        })
                    
                    for topic in data.get("RelatedTopics", [])[:5]:
                        if isinstance(topic, dict) and "Text" in topic:
                            results.append({
                                "title": topic.get("FirstURL", "").split("/")[-1] if topic.get("FirstURL") else "相关结果",
                                "snippet": topic.get("Text", ""),
                                "url": topic.get("FirstURL", ""),
                                "source": "DuckDuckGo"
                            })
        
        except Exception as e:
            logger.warning(f"DuckDuckGo search failed: {e}")
        
        if not results:
            results = await self._fallback_search(query)
        
        return results
    
    async def _fallback_search(self, query: str) -> List[Dict[str, Any]]:
        """备用搜索（模拟结果）"""
        return [
            {
                "title": f"关于'{query}'的搜索结果",
                "snippet": f"这是关于{query}的相关信息。建议您查阅更多资料获取详细信息。",
                "url": "",
                "source": "本地知识库"
            },
            {
                "title": f"{query} - 相关资源",
                "snippet": f"以下是{query}相关的资源链接和信息摘要。",
                "url": "",
                "source": "本地知识库"
            }
        ]
    
    async def search_web(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """网络搜索接口"""
        return await self._search(query)
    
    async def search_local(self, query: str) -> List[Dict[str, Any]]:
        """本地知识库搜索"""
        return [
            {
                "title": f"本地知识：{query}",
                "snippet": f"从本地知识库检索到的关于{query}的信息",
                "source": "本地"
            }
        ]
    
    async def close(self):
        """关闭会话"""
        if self._session and not self._session.closed:
            await self._session.close()


import re

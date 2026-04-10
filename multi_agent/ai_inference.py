"""
AI推理服务 - 集成多种免费AI API
AI Inference Service - Multiple Free AI APIs Integration
"""

import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import json
import os

logger = logging.getLogger(__name__)


@dataclass
class AIResponse:
    """AI响应"""
    success: bool
    content: str
    model: str
    provider: str
    tokens_used: int = 0
    latency_ms: int = 0
    error: Optional[str] = None


class AIProvider:
    """AI提供商基类"""
    
    async def generate(self, prompt: str, **kwargs) -> AIResponse:
        raise NotImplementedError


class DeepSeekProvider(AIProvider):
    """DeepSeek API - 免费额度大"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY", "")
        self.base_url = "https://api.deepseek.com/v1/chat/completions"
    
    async def generate(self, prompt: str, system_prompt: str = "", **kwargs) -> AIResponse:
        if not self.api_key:
            return AIResponse(
                success=False,
                content="",
                model="deepseek",
                provider="deepseek",
                error="API key not configured"
            )
        
        start_time = datetime.now()
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                data = {
                    "model": kwargs.get("model", "deepseek-chat"),
                    "messages": [
                        {"role": "system", "content": system_prompt or "你是一个专业的AI助手。"},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": kwargs.get("max_tokens", 2048),
                    "temperature": kwargs.get("temperature", 0.7)
                }
                
                async with session.post(self.base_url, headers=headers, json=data, timeout=30) as response:
                    if response.status == 200:
                        result = await response.json()
                        content = result["choices"][0]["message"]["content"]
                        latency = int((datetime.now() - start_time).total_seconds() * 1000)
                        
                        return AIResponse(
                            success=True,
                            content=content,
                            model="deepseek-chat",
                            provider="deepseek",
                            tokens_used=result.get("usage", {}).get("total_tokens", 0),
                            latency_ms=latency
                        )
                    else:
                        error = await response.text()
                        return AIResponse(
                            success=False,
                            content="",
                            model="deepseek",
                            provider="deepseek",
                            error=f"API error: {response.status} - {error}"
                        )
        
        except Exception as e:
            return AIResponse(
                success=False,
                content="",
                model="deepseek",
                provider="deepseek",
                error=str(e)
            )


class QwenProvider(AIProvider):
    """通义千问 API - 免费额度"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("QWEN_API_KEY", "")
        self.base_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    
    async def generate(self, prompt: str, system_prompt: str = "", **kwargs) -> AIResponse:
        if not self.api_key:
            return AIResponse(
                success=False,
                content="",
                model="qwen",
                provider="qwen",
                error="API key not configured"
            )
        
        start_time = datetime.now()
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                data = {
                    "model": kwargs.get("model", "qwen-turbo"),
                    "input": {
                        "messages": [
                            {"role": "system", "content": system_prompt or "你是一个专业的AI助手。"},
                            {"role": "user", "content": prompt}
                        ]
                    },
                    "parameters": {
                        "max_tokens": kwargs.get("max_tokens", 2048),
                        "temperature": kwargs.get("temperature", 0.7)
                    }
                }
                
                async with session.post(self.base_url, headers=headers, json=data, timeout=30) as response:
                    if response.status == 200:
                        result = await response.json()
                        content = result["output"]["text"]
                        latency = int((datetime.now() - start_time).total_seconds() * 1000)
                        
                        return AIResponse(
                            success=True,
                            content=content,
                            model="qwen-turbo",
                            provider="qwen",
                            latency_ms=latency
                        )
                    else:
                        error = await response.text()
                        return AIResponse(
                            success=False,
                            content="",
                            model="qwen",
                            provider="qwen",
                            error=f"API error: {response.status}"
                        )
        
        except Exception as e:
            return AIResponse(
                success=False,
                content="",
                model="qwen",
                provider="qwen",
                error=str(e)
            )


class OllamaProvider(AIProvider):
    """Ollama本地模型 - 完全免费"""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
    
    async def generate(self, prompt: str, system_prompt: str = "", **kwargs) -> AIResponse:
        start_time = datetime.now()
        
        try:
            async with aiohttp.ClientSession() as session:
                data = {
                    "model": kwargs.get("model", "qwen2:7b"),
                    "messages": [
                        {"role": "system", "content": system_prompt or "你是一个专业的AI助手。"},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": False
                }
                
                async with session.post(f"{self.base_url}/api/chat", json=data, timeout=60) as response:
                    if response.status == 200:
                        result = await response.json()
                        content = result["message"]["content"]
                        latency = int((datetime.now() - start_time).total_seconds() * 1000)
                        
                        return AIResponse(
                            success=True,
                            content=content,
                            model=kwargs.get("model", "qwen2:7b"),
                            provider="ollama",
                            latency_ms=latency
                        )
                    else:
                        return AIResponse(
                            success=False,
                            content="",
                            model="ollama",
                            provider="ollama",
                            error=f"Ollama error: {response.status}"
                        )
        
        except aiohttp.ClientConnectorError:
            return AIResponse(
                success=False,
                content="",
                model="ollama",
                provider="ollama",
                error="Ollama服务未启动，请运行: ollama serve"
            )
        except Exception as e:
            return AIResponse(
                success=False,
                content="",
                model="ollama",
                provider="ollama",
                error=str(e)
            )


class LocalRuleProvider(AIProvider):
    """本地规则引擎 - 无需API，完全离线"""
    
    INTENT_RESPONSES = {
        "ppt_generation": "我将为您生成PPT演示文稿。请告诉我主题和主要内容要点。",
        "excel_analysis": "我将帮您处理Excel数据。请描述您需要的数据分析或公式需求。",
        "document_writing": "我将帮您撰写文档。请告诉我文档类型和主要内容要求。",
        "search": "我将为您搜索相关信息。请告诉我您想查找什么内容。",
        "data_visualization": "我将为您创建数据可视化图表。请描述数据类型和展示需求。",
        "email": "我将帮您处理邮件相关任务。",
        "schedule": "我将帮您管理日程安排。",
        "code": "我将帮您编写代码。请描述您的编程需求。",
        "translation": "我将帮您翻译内容。请提供需要翻译的文本。",
        "summary": "我将帮您生成摘要。请提供需要总结的内容。"
    }
    
    async def generate(self, prompt: str, system_prompt: str = "", **kwargs) -> AIResponse:
        import re
        
        prompt_lower = prompt.lower()
        
        if "ppt" in prompt_lower or "演示" in prompt_lower or "幻灯片" in prompt_lower:
            intent = "ppt_generation"
        elif "excel" in prompt_lower or "表格" in prompt_lower or "数据" in prompt_lower:
            intent = "excel_analysis"
        elif "文档" in prompt_lower or "报告" in prompt_lower or "word" in prompt_lower:
            intent = "document_writing"
        elif "搜索" in prompt_lower or "查找" in prompt_lower:
            intent = "search"
        elif "图表" in prompt_lower or "可视化" in prompt_lower:
            intent = "data_visualization"
        else:
            intent = "general"
        
        response_content = self.INTENT_RESPONSES.get(intent, f"我理解您的需求，正在为您处理：{prompt[:50]}...")
        
        return AIResponse(
            success=True,
            content=response_content,
            model="local-rule",
            provider="local",
            latency_ms=1
        )


class AIInferenceService:
    """AI推理服务 - 统一接口"""
    
    def __init__(self):
        self.providers: Dict[str, AIProvider] = {}
        self._initialize_providers()
        self._provider_priority = ["ollama", "deepseek", "qwen", "local"]
    
    def _initialize_providers(self):
        """初始化所有提供商"""
        self.providers["local"] = LocalRuleProvider()
        self.providers["ollama"] = OllamaProvider()
        self.providers["deepseek"] = DeepSeekProvider()
        self.providers["qwen"] = QwenProvider()
        
        logger.info(f"Initialized {len(self.providers)} AI providers")
    
    async def generate(self, prompt: str, system_prompt: str = "", 
                       provider: Optional[str] = None, **kwargs) -> AIResponse:
        """生成响应"""
        if provider and provider in self.providers:
            return await self.providers[provider].generate(prompt, system_prompt, **kwargs)
        
        for provider_name in self._provider_priority:
            if provider_name in self.providers:
                response = await self.providers[provider_name].generate(prompt, system_prompt, **kwargs)
                if response.success:
                    return response
        
        return await self.providers["local"].generate(prompt, system_prompt, **kwargs)
    
    async def understand_intent(self, text: str) -> Dict[str, Any]:
        """理解用户意图"""
        system_prompt = """你是一个意图识别专家。分析用户输入并返回JSON格式的意图信息。
返回格式：{"intent": "意图类型", "confidence": 0.95, "entities": {}, "action": "建议操作"}
意图类型包括：ppt_generation, excel_analysis, document_writing, search, data_visualization, email, schedule, code, translation, summary, general"""
        
        response = await self.generate(text, system_prompt, max_tokens=256)
        
        try:
            if response.success and "{" in response.content:
                json_str = response.content[response.content.find("{"):response.content.rfind("}")+1]
                return json.loads(json_str)
        except:
            pass
        
        return {
            "intent": "general",
            "confidence": 0.5,
            "entities": {},
            "action": "process"
        }
    
    async def plan_task(self, task_description: str) -> List[Dict[str, Any]]:
        """规划任务"""
        system_prompt = """你是一个任务规划专家。将复杂任务分解为步骤。
返回JSON数组格式：[{"step": 1, "action": "动作", "agent": "智能体", "description": "描述"}]
可用智能体：ExcelAgent, PPTAgent, WordAgent, SearchAgent, DataAgent"""
        
        response = await self.generate(task_description, system_prompt, max_tokens=512)
        
        try:
            if response.success and "[" in response.content:
                json_str = response.content[response.content.find("["):response.content.rfind("]")+1]
                return json.loads(json_str)
        except:
            pass
        
        return [{"step": 1, "action": "process", "agent": "ReporterAgent", "description": task_description}]
    
    def get_available_providers(self) -> List[str]:
        """获取可用提供商"""
        return list(self.providers.keys())


ai_service = AIInferenceService()


async def get_ai_response(prompt: str, **kwargs) -> AIResponse:
    """获取AI响应的便捷函数"""
    return await ai_service.generate(prompt, **kwargs)

"""
Ollama集成模块
本地大模型推理引擎，支持Ollama API
支持离线运行、隐私保护、多模型管理
"""

import os
import json
import httpx
import logging
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class OllamaModelType(Enum):
    CHAT = "chat"
    EMBEDDING = "embedding"


@dataclass
class OllamaModel:
    name: str
    size: str
    digest: str
    modified_at: str
    capabilities: List[str] = field(default_factory=list)
    loaded: bool = False
    
    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'size': self.size,
            'digest': self.digest,
            'modified_at': self.modified_at,
            'capabilities': self.capabilities,
            'loaded': self.loaded,
        }


@dataclass
class OllamaConfig:
    base_url: str = "http://localhost:11434"
    default_model: str = "qwen2.5:7b"
    timeout: int = 120
    keep_alive: str = "5m"
    
    def to_dict(self) -> Dict:
        return {
            'base_url': self.base_url,
            'default_model': self.default_model,
            'timeout': self.timeout,
            'keep_alive': self.keep_alive,
        }


class OllamaEngine:
    """Ollama引擎 - 本地大模型推理"""
    
    def __init__(self, config: Optional[OllamaConfig] = None):
        self.config = config or OllamaConfig()
        self.client = httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=self.config.timeout,
        )
        self.models: Dict[str, OllamaModel] = {}
        self._initialized = False
        self._available = False
        
    async def initialize(self) -> bool:
        """初始化Ollama连接"""
        try:
            if await self.health_check():
                self._available = True
                await self.load_available_models()
                self._initialized = True
                logger.info(f"Ollama initialized: {self.config.base_url}")
                return True
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
            self._available = False
        return False
    
    async def health_check(self) -> bool:
        """检查Ollama服务状态"""
        try:
            response = await self.client.get("/api/tags")
            return response.status_code == 200
        except:
            return False
    
    async def load_available_models(self) -> List[str]:
        """加载可用模型列表"""
        try:
            response = await self.client.get("/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = []
                for model_data in data.get('models', []):
                    model_name = model_data.get('name', '')
                    if model_name:
                        self.models[model_name] = OllamaModel(
                            name=model_name,
                            size=model_data.get('size', 'unknown'),
                            digest=model_data.get('digest', ''),
                            modified_at=model_data.get('modified_at', ''),
                            capabilities=['chat', 'completion'],
                        )
                        models.append(model_name)
                logger.info(f"Loaded {len(models)} models: {models}")
                return models
        except Exception as e:
            logger.error(f"Failed to load models: {e}")
        return []
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """聊天补全 - Ollama API"""
        model_name = model or self.config.default_model
        
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": stream,
            "keep_alive": self.config.keep_alive,
            **kwargs
        }
        
        try:
            response = await self.client.post(
                "/api/chat",
                json=payload,
            )
            
            if response.status_code == 200:
                result = response.json()
                if model_name in self.models:
                    pass
                return result
            else:
                logger.error(f"Chat failed: {response.status_code}")
                return {"error": response.text, "status_code": response.status_code}
        except Exception as e:
            logger.error(f"Chat error: {e}")
            return {"error": str(e)}
    
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """流式聊天补全"""
        model_name = model or self.config.default_model
        
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": True,
            "keep_alive": self.config.keep_alive,
            **kwargs
        }
        
        try:
            async with self.client.stream(
                "POST",
                "/api/chat",
                json=payload,
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            chunk = json.loads(line)
                            if "message" in chunk:
                                content = chunk["message"].get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"[Error: {e}]"
    
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """文本生成"""
        model_name = model or self.config.default_model
        
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": stream,
            "keep_alive": self.config.keep_alive,
            **kwargs
        }
        
        try:
            response = await self.client.post(
                "/api/generate",
                json=payload,
            )
            
            if response.status_code == 200:
                result = response.json()
                return result
            else:
                logger.error(f"Generate failed: {response.status_code}")
                return {"error": response.text, "status_code": response.status_code}
        except Exception as e:
            logger.error(f"Generate error: {e}")
            return {"error": str(e)}
    
    async def embeddings(
        self,
        input_text: str,
        model: Optional[str] = None,
    ) -> List[float]:
        """获取文本嵌入向量"""
        model_name = model or "nomic-embed-text"
        
        payload = {
            "model": model_name,
            "input": input_text,
        }
        
        try:
            response = await self.client.post(
                "/api/embeddings",
                json=payload,
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('embedding', [])
            else:
                logger.error(f"Embeddings failed: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Embeddings error: {e}")
            return []
    
    async def pull_model(self, model_name: str, stream: bool = False) -> bool:
        """下载模型"""
        payload = {
            "name": model_name,
            "stream": stream,
        }
        
        try:
            response = await self.client.post(
                "/api/pull",
                json=payload,
            )
            
            if response.status_code == 200:
                logger.info(f"Model pulled: {model_name}")
                return True
            else:
                logger.error(f"Pull failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Pull error: {e}")
            return False
    
    async def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """获取模型详情"""
        try:
            response = await self.client.post(
                "/api/show",
                json={"name": model_name},
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": response.text}
        except Exception as e:
            return {"error": str(e)}
    
    def get_models(self) -> List[Dict]:
        """获取所有模型信息"""
        return [m.to_dict() for m in self.models.values()]
    
    def is_available(self) -> bool:
        """检查Ollama是否可用"""
        return self._available
    
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized
    
    async def close(self):
        """关闭连接"""
        await self.client.aclose()
        self._initialized = False


ollama_engine = OllamaEngine()


async def initialize_ollama(config: Optional[OllamaConfig] = None) -> OllamaEngine:
    """初始化Ollama引擎"""
    global ollama_engine
    ollama_engine = OllamaEngine(config)
    await ollama_engine.initialize()
    return ollama_engine


def get_ollama() -> OllamaEngine:
    """获取Ollama实例"""
    return ollama_engine

"""
LocalAI集成模块
本地大模型推理引擎，兼容OpenAI API
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


class ModelType(Enum):
    CHAT = "chat"
    EMBEDDING = "embedding"
    IMAGE = "image"
    AUDIO = "audio"


@dataclass
class LocalModel:
    name: str
    model_type: ModelType
    size: str
    quantization: str
    context_length: int
    capabilities: List[str] = field(default_factory=list)
    loaded: bool = False
    last_used: Optional[datetime] = None
    
    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'type': self.model_type.value,
            'size': self.size,
            'quantization': self.quantization,
            'context_length': self.context_length,
            'capabilities': self.capabilities,
            'loaded': self.loaded,
            'last_used': self.last_used.isoformat() if self.last_used else None,
        }


@dataclass
class LocalAIConfig:
    base_url: str = "http://localhost:8080"
    api_key: str = ""
    default_model: str = "llama-3-8b-instruct"
    timeout: int = 120
    max_retries: int = 3
    auto_start: bool = True
    gpu_layers: int = 35
    threads: int = 4
    context_size: int = 4096
    
    def to_dict(self) -> Dict:
        return {
            'base_url': self.base_url,
            'api_key': self.api_key,
            'default_model': self.default_model,
            'timeout': self.timeout,
            'max_retries': self.max_retries,
            'auto_start': self.auto_start,
            'gpu_layers': self.gpu_layers,
            'threads': self.threads,
            'context_size': self.context_size,
        }


class LocalAIEngine:
    """LocalAI引擎 - 本地大模型推理"""
    
    def __init__(self, config: Optional[LocalAIConfig] = None):
        self.config = config or LocalAIConfig()
        self.client = httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=self.config.timeout,
        )
        self.models: Dict[str, LocalModel] = {}
        self._initialized = False
        self._available = False
        
    async def initialize(self) -> bool:
        """初始化LocalAI连接"""
        try:
            if await self.health_check():
                self._available = True
                await self.load_available_models()
                self._initialized = True
                logger.info(f"LocalAI initialized: {self.config.base_url}")
                return True
        except Exception as e:
            logger.warning(f"LocalAI not available: {e}")
            self._available = False
        return False
    
    async def health_check(self) -> bool:
        """检查LocalAI服务状态"""
        try:
            response = await self.client.get("/health")
            return response.status_code == 200
        except:
            return False
    
    async def load_available_models(self) -> List[str]:
        """加载可用模型列表"""
        try:
            response = await self.client.get("/v1/models")
            if response.status_code == 200:
                data = response.json()
                models = []
                for model_data in data.get('data', []):
                    model_id = model_data.get('id', '')
                    if model_id:
                        self.models[model_id] = LocalModel(
                            name=model_id,
                            model_type=ModelType.CHAT,
                            size="unknown",
                            quantization="unknown",
                            context_length=self.config.context_size,
                            capabilities=['chat', 'completion'],
                        )
                        models.append(model_id)
                logger.info(f"Loaded {len(models)} models: {models}")
                return models
        except Exception as e:
            logger.error(f"Failed to load models: {e}")
        return []
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """聊天补全 - OpenAI兼容API"""
        model_name = model or self.config.default_model
        
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
            **kwargs
        }
        
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        
        try:
            response = await self.client.post(
                "/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            
            if response.status_code == 200:
                result = response.json()
                if model_name in self.models:
                    self.models[model_name].last_used = datetime.now()
                return result
            else:
                logger.error(f"Chat completion failed: {response.status_code}")
                return {"error": response.text, "status_code": response.status_code}
        except Exception as e:
            logger.error(f"Chat completion error: {e}")
            return {"error": str(e)}
    
    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """流式聊天补全"""
        model_name = model or self.config.default_model
        
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            **kwargs
        }
        
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        
        try:
            async with self.client.stream(
                "POST",
                "/v1/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            if chunk.get("choices"):
                                delta = chunk["choices"][0].get("delta", {})
                                if "content" in delta:
                                    yield delta["content"]
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"[Error: {e}]"
    
    async def embeddings(
        self,
        input_text: str,
        model: Optional[str] = None,
    ) -> List[float]:
        """获取文本嵌入向量"""
        model_name = model or f"{self.config.default_model}-embeddings"
        
        payload = {
            "model": model_name,
            "input": input_text,
        }
        
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        
        try:
            response = await self.client.post(
                "/v1/embeddings",
                json=payload,
                headers=headers,
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('data', [{}])[0].get('embedding', [])
            else:
                logger.error(f"Embeddings failed: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Embeddings error: {e}")
            return []
    
    async def transcribe(
        self,
        audio_path: str,
        model: Optional[str] = None,
        language: str = "zh",
    ) -> str:
        """语音转文字"""
        model_name = model or "whisper-1"
        
        try:
            with open(audio_path, 'rb') as audio_file:
                files = {'file': audio_file}
                data = {
                    'model': model_name,
                    'language': language,
                }
                
                response = await self.client.post(
                    "/v1/audio/transcriptions",
                    files=files,
                    data=data,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get('text', '')
                else:
                    logger.error(f"Transcription failed: {response.status_code}")
                    return ""
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return ""
    
    async def text_to_speech(
        self,
        text: str,
        model: Optional[str] = None,
        voice: str = "default",
        output_path: Optional[str] = None,
    ) -> Optional[bytes]:
        """文字转语音"""
        model_name = model or "tts-1"
        
        payload = {
            "model": model_name,
            "input": text,
            "voice": voice,
        }
        
        try:
            response = await self.client.post(
                "/v1/audio/speech",
                json=payload,
            )
            
            if response.status_code == 200:
                audio_data = response.content
                if output_path:
                    with open(output_path, 'wb') as f:
                        f.write(audio_data)
                return audio_data
            else:
                logger.error(f"TTS failed: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return None
    
    async def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        size: str = "512x512",
        n: int = 1,
    ) -> List[str]:
        """图像生成"""
        model_name = model or "stablediffusion"
        
        payload = {
            "model": model_name,
            "prompt": prompt,
            "size": size,
            "n": n,
        }
        
        try:
            response = await self.client.post(
                "/v1/images/generations",
                json=payload,
            )
            
            if response.status_code == 200:
                result = response.json()
                return [img.get('url', '') or img.get('b64_json', '') 
                        for img in result.get('data', [])]
            else:
                logger.error(f"Image generation failed: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Image generation error: {e}")
            return []
    
    async def load_model(self, model_name: str) -> bool:
        """加载模型到内存"""
        try:
            response = await self.client.post(
                "/models/load",
                json={"model": model_name},
            )
            if response.status_code == 200:
                if model_name in self.models:
                    self.models[model_name].loaded = True
                logger.info(f"Model loaded: {model_name}")
                return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
        return False
    
    async def unload_model(self, model_name: str) -> bool:
        """卸载模型"""
        try:
            response = await self.client.post(
                "/models/unload",
                json={"model": model_name},
            )
            if response.status_code == 200:
                if model_name in self.models:
                    self.models[model_name].loaded = False
                logger.info(f"Model unloaded: {model_name}")
                return True
        except Exception as e:
            logger.error(f"Failed to unload model: {e}")
        return False
    
    def get_models(self) -> List[Dict]:
        """获取所有模型信息"""
        return [m.to_dict() for m in self.models.values()]
    
    def is_available(self) -> bool:
        """检查LocalAI是否可用"""
        return self._available
    
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized
    
    async def close(self):
        """关闭连接"""
        await self.client.aclose()
        self._initialized = False


local_ai_engine = LocalAIEngine()


async def initialize_local_ai(config: Optional[LocalAIConfig] = None) -> LocalAIEngine:
    """初始化LocalAI引擎"""
    global local_ai_engine
    local_ai_engine = LocalAIEngine(config)
    await local_ai_engine.initialize()
    return local_ai_engine


def get_local_ai() -> LocalAIEngine:
    """获取LocalAI实例"""
    return local_ai_engine

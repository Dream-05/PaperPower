"""
模型推理服务 - 零成本实现
支持本地模型加载、推理优化、模型路由
"""

import os
import json
import time
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable, Union
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum
import threading
import hashlib


class ModelType(Enum):
    LOCAL_TRANSFORMER = "local_transformer"
    LOCAL_ONNX = "local_onnx"
    LOCAL_GGUF = "local_gguf"
    CLOUD_OPENAI = "cloud_openai"
    CLOUD_ANTHROPIC = "cloud_anthropic"


class ModelCapability(Enum):
    TEXT_GENERATION = "text_generation"
    EMBEDDING = "embedding"
    CHAT = "chat"
    MULTIMODAL = "multimodal"


@dataclass
class ModelConfig:
    name: str
    model_type: ModelType
    model_path: str
    capabilities: List[ModelCapability] = field(default_factory=list)
    max_tokens: int = 2048
    context_length: int = 4096
    supports_streaming: bool = True
    supports_system_prompt: bool = True
    temperature: float = 0.7
    top_p: float = 0.9
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "model_type": self.model_type.value,
            "model_path": self.model_path,
            "capabilities": [c.value for c in self.capabilities],
            "max_tokens": self.max_tokens,
            "context_length": self.context_length,
            "supports_streaming": self.supports_streaming,
            "supports_system_prompt": self.supports_system_prompt
        }


@dataclass
class GenerationResult:
    text: str
    model: str
    tokens_generated: int
    latency_ms: float
    finish_reason: str = "stop"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatMessage:
    role: str
    content: str


class ModelRegistry:
    """模型注册表"""
    
    def __init__(self):
        self._models: Dict[str, ModelConfig] = {}
        self._instances: Dict[str, Any] = {}
        self._loaders: Dict[ModelType, Callable] = {}
    
    def register(self, config: ModelConfig):
        """注册模型"""
        self._models[config.name] = config
    
    def get_config(self, name: str) -> Optional[ModelConfig]:
        """获取模型配置"""
        return self._models.get(name)
    
    def list_models(self) -> List[ModelConfig]:
        """列出所有模型"""
        return list(self._models.values())
    
    def register_loader(self, model_type: ModelType, loader: Callable):
        """注册模型加载器"""
        self._loaders[model_type] = loader
    
    def get_instance(self, name: str) -> Optional[Any]:
        """获取模型实例"""
        return self._instances.get(name)
    
    def set_instance(self, name: str, instance: Any):
        """设置模型实例"""
        self._instances[name] = instance


model_registry = ModelRegistry()


class LocalModelEngine:
    """本地模型引擎"""
    
    def __init__(self, models_dir: str = "output/models"):
        self.models_dir = Path(models_dir)
        self.registry = model_registry
        self._setup_default_models()
    
    def _setup_default_models(self):
        """设置默认模型"""
        if self.models_dir.exists():
            for model_dir in self.models_dir.iterdir():
                if model_dir.is_dir():
                    config_file = model_dir / "config.json"
                    if config_file.exists():
                        with open(config_file, 'r', encoding='utf-8') as f:
                            config_data = json.load(f)
                        
                        config = ModelConfig(
                            name=config_data.get("name", model_dir.name),
                            model_type=ModelType.LOCAL_TRANSFORMER,
                            model_path=str(model_dir),
                            max_tokens=config_data.get("max_tokens", 2048),
                            context_length=config_data.get("context_length", 4096)
                        )
                        self.registry.register(config)
    
    def load_model(self, name: str) -> bool:
        """加载模型"""
        config = self.registry.get_config(name)
        if not config:
            return False
        
        try:
            if config.model_type == ModelType.LOCAL_TRANSFORMER:
                return self._load_transformer(config)
            elif config.model_type == ModelType.LOCAL_ONNX:
                return self._load_onnx(config)
            else:
                return False
        except Exception as e:
            print(f"加载模型失败: {e}")
            return False
    
    def _load_transformer(self, config: ModelConfig) -> bool:
        """加载Transformer模型"""
        try:
            import torch
            from model.bilingual_transformer import load_pretrained, ModelConfig as BTConfig
            
            model_path = Path(config.model_path)
            model = load_pretrained(model_path)
            model.eval()
            
            self.registry.set_instance(config.name, model)
            return True
        except ImportError:
            return False
        except Exception:
            return False
    
    def _load_onnx(self, config: ModelConfig) -> bool:
        """加载ONNX模型"""
        try:
            import onnxruntime as ort
            
            onnx_path = Path(config.model_path) / "model.onnx"
            if not onnx_path.exists():
                return False
            
            session = ort.InferenceSession(str(onnx_path))
            self.registry.set_instance(config.name, session)
            return True
        except ImportError:
            return False
    
    def generate(
        self,
        model_name: str,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.7,
        top_p: float = 0.9,
        **kwargs
    ) -> GenerationResult:
        """生成文本"""
        start_time = time.time()
        
        model = self.registry.get_instance(model_name)
        config = self.registry.get_config(model_name)
        
        if not model or not config:
            return GenerationResult(
                text="",
                model=model_name,
                tokens_generated=0,
                latency_ms=0,
                finish_reason="error",
                metadata={"error": "模型未加载"}
            )
        
        try:
            if config.model_type == ModelType.LOCAL_TRANSFORMER:
                result = self._generate_transformer(
                    model, prompt, max_tokens, temperature, top_p
                )
            else:
                result = {"text": "", "tokens": 0}
            
            latency = (time.time() - start_time) * 1000
            
            return GenerationResult(
                text=result["text"],
                model=model_name,
                tokens_generated=result["tokens"],
                latency_ms=latency,
                finish_reason="stop"
            )
        
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            return GenerationResult(
                text="",
                model=model_name,
                tokens_generated=0,
                latency_ms=latency,
                finish_reason="error",
                metadata={"error": str(e)}
            )
    
    def _generate_transformer(
        self,
        model,
        prompt: str,
        max_tokens: int,
        temperature: float,
        top_p: float
    ) -> Dict[str, Any]:
        """Transformer模型生成"""
        import torch
        
        try:
            tokenizer = getattr(model, 'tokenizer', None)
            if tokenizer is None:
                from tokenizer.international_tokenizer import InternationalTokenizer
                tokenizer = InternationalTokenizer()
            
            input_ids = tokenizer.encode(prompt)
            input_tensor = torch.tensor([input_ids])
            
            with torch.no_grad():
                output_ids = model.generate(
                    input_tensor,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p
                )
            
            output_text = tokenizer.decode(output_ids[0].tolist())
            new_tokens = len(output_ids[0]) - len(input_ids)
            
            return {
                "text": output_text,
                "tokens": new_tokens
            }
        except Exception as e:
            return {"text": f"生成失败: {str(e)}", "tokens": 0}
    
    def chat(
        self,
        model_name: str,
        messages: List[ChatMessage],
        max_tokens: int = 512,
        **kwargs
    ) -> GenerationResult:
        """对话生成"""
        prompt = self._build_chat_prompt(messages)
        return self.generate(model_name, prompt, max_tokens, **kwargs)
    
    def _build_chat_prompt(self, messages: List[ChatMessage]) -> str:
        """构建对话提示"""
        parts = []
        for msg in messages:
            if msg.role == "system":
                parts.append(f"<|system|>{msg.content}")
            elif msg.role == "user":
                parts.append(f"<|user|>{msg.content}")
            elif msg.role == "assistant":
                parts.append(f"<|assistant|{msg.content}")
        
        parts.append("<|assistant|")
        return "\n".join(parts)


class CloudModelEngine:
    """云端模型引擎（备用）"""
    
    def __init__(self):
        self.api_keys = {
            "openai": os.environ.get("OPENAI_API_KEY", ""),
            "anthropic": os.environ.get("ANTHROPIC_API_KEY", "")
        }
    
    def is_available(self, provider: str) -> bool:
        """检查API是否可用"""
        return bool(self.api_keys.get(provider))
    
    async def generate_openai(
        self,
        prompt: str,
        model: str = "gpt-3.5-turbo",
        max_tokens: int = 512,
        **kwargs
    ) -> GenerationResult:
        """OpenAI生成"""
        if not self.is_available("openai"):
            return GenerationResult(
                text="",
                model="openai",
                tokens_generated=0,
                latency_ms=0,
                finish_reason="error",
                metadata={"error": "OpenAI API key not configured"}
            )
        
        start_time = time.time()
        
        try:
            import openai
            openai.api_key = self.api_keys["openai"]
            
            response = await openai.ChatCompletion.acreate(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens
            )
            
            latency = (time.time() - start_time) * 1000
            
            return GenerationResult(
                text=response.choices[0].message.content,
                model=model,
                tokens_generated=response.usage.completion_tokens,
                latency_ms=latency,
                finish_reason=response.choices[0].finish_reason
            )
        
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            return GenerationResult(
                text="",
                model=model,
                tokens_generated=0,
                latency_ms=latency,
                finish_reason="error",
                metadata={"error": str(e)}
            )


class IntelligentModelRouter:
    """智能模型路由器"""
    
    def __init__(self, local_engine: LocalModelEngine, cloud_engine: CloudModelEngine):
        self.local_engine = local_engine
        self.cloud_engine = cloud_engine
        self._stats = {
            "local_calls": 0,
            "cloud_calls": 0,
            "total_tokens": 0,
            "total_latency_ms": 0
        }
    
    def route(
        self,
        prompt: str,
        max_tokens: int = 512,
        prefer_local: bool = True,
        complexity_threshold: float = 0.5
    ) -> str:
        """路由到合适的模型"""
        complexity = self._estimate_complexity(prompt)
        
        if prefer_local and complexity < complexity_threshold:
            local_models = self.local_engine.registry.list_models()
            if local_models:
                return local_models[0].name
        
        if self.cloud_engine.is_available("openai"):
            return "gpt-3.5-turbo"
        
        local_models = self.local_engine.registry.list_models()
        if local_models:
            return local_models[0].name
        
        return "default"
    
    def _estimate_complexity(self, prompt: str) -> float:
        """估计任务复杂度"""
        complexity = 0.0
        
        if len(prompt) > 1000:
            complexity += 0.2
        
        complex_keywords = [
            "分析", "推理", "为什么", "解释", "比较",
            "analyze", "reason", "why", "explain", "compare"
        ]
        for kw in complex_keywords:
            if kw in prompt.lower():
                complexity += 0.1
        
        if any(c in prompt for c in "代码code函数function"):
            complexity += 0.2
        
        return min(complexity, 1.0)
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int = 512,
        **kwargs
    ) -> GenerationResult:
        """智能生成"""
        model_name = self.route(prompt, max_tokens, **kwargs)
        
        if model_name.startswith("gpt"):
            result = await self.cloud_engine.generate_openai(
                prompt, model_name, max_tokens, **kwargs
            )
            self._stats["cloud_calls"] += 1
        else:
            result = self.local_engine.generate(
                model_name, prompt, max_tokens, **kwargs
            )
            self._stats["local_calls"] += 1
        
        self._stats["total_tokens"] += result.tokens_generated
        self._stats["total_latency_ms"] += result.latency_ms
        
        return result
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计"""
        total_calls = self._stats["local_calls"] + self._stats["cloud_calls"]
        avg_latency = (
            self._stats["total_latency_ms"] / total_calls 
            if total_calls > 0 else 0
        )
        
        return {
            "local_calls": self._stats["local_calls"],
            "cloud_calls": self._stats["cloud_calls"],
            "total_tokens": self._stats["total_tokens"],
            "avg_latency_ms": avg_latency
        }


class ModelService:
    """模型服务 - 统一接口"""
    
    def __init__(self, models_dir: str = "output/models"):
        self.local_engine = LocalModelEngine(models_dir)
        self.cloud_engine = CloudModelEngine()
        self.router = IntelligentModelRouter(self.local_engine, self.cloud_engine)
        
        self._preload_models()
    
    def _preload_models(self):
        """预加载模型"""
        for config in self.local_engine.registry.list_models():
            self.local_engine.load_model(config.name)
    
    def generate(
        self,
        prompt: str,
        model: str = None,
        max_tokens: int = 512,
        temperature: float = 0.7,
        **kwargs
    ) -> GenerationResult:
        """生成文本"""
        if model:
            return self.local_engine.generate(
                model, prompt, max_tokens, temperature, **kwargs
            )
        
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(
            self.router.generate(prompt, max_tokens, **kwargs)
        )
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        max_tokens: int = 512,
        **kwargs
    ) -> GenerationResult:
        """对话"""
        chat_messages = [
            ChatMessage(role=m["role"], content=m["content"])
            for m in messages
        ]
        
        if model:
            return self.local_engine.chat(model, chat_messages, max_tokens, **kwargs)
        
        prompt = self.local_engine._build_chat_prompt(chat_messages)
        return self.generate(prompt, max_tokens=max_tokens, **kwargs)
    
    def stream_generate(
        self,
        prompt: str,
        model: str = None,
        max_tokens: int = 512,
        **kwargs
    ):
        """流式生成"""
        result = self.generate(prompt, model, max_tokens, **kwargs)
        
        chunk_size = 10
        text = result.text
        
        for i in range(0, len(text), chunk_size):
            yield text[i:i+chunk_size]
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """获取可用模型"""
        models = []
        
        for config in self.local_engine.registry.list_models():
            instance = self.local_engine.registry.get_instance(config.name)
            models.append({
                **config.to_dict(),
                "loaded": instance is not None,
                "source": "local"
            })
        
        if self.cloud_engine.is_available("openai"):
            models.append({
                "name": "gpt-3.5-turbo",
                "model_type": "cloud_openai",
                "source": "cloud",
                "loaded": True,
                "capabilities": ["chat", "text_generation"]
            })
        
        return models
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计"""
        return {
            "router": self.router.get_stats(),
            "models": len(self.local_engine.registry.list_models())
        }


model_service = ModelService()

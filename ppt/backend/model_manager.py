#!/usr/bin/env python3
"""
模型管理系统
支持本地小模型、免费大模型和自定义API
"""

import os
import json
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ModelConfig:
    """模型配置"""
    name: str
    type: str  # local, free, custom
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    enabled: bool = True
    priority: int = 100


class ModelManager:
    """模型管理器"""
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or Path("data/models/config.json")
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_default_config()
        self.models = self._load_config()
    
    def _init_default_config(self):
        """初始化默认配置"""
        if not self.config_path.exists():
            default_config = {
                "models": [
                    {
                        "name": "本地小模型",
                        "type": "local",
                        "enabled": True,
                        "priority": 100
                    },
                    {
                        "name": "DeepSeek-V2.5",
                        "type": "free",
                        "base_url": "https://api.deepseek.com/v1",
                        "model": "deepseek-chat",
                        "enabled": True,
                        "priority": 90
                    },
                    {
                        "name": "Qwen 2.5",
                        "type": "free",
                        "base_url": "https://dashscope.aliyuncs.com/api/v1",
                        "model": "qwen2.5-3b-chat",
                        "enabled": True,
                        "priority": 80
                    },
                    {
                        "name": "OpenAI GPT-4o",
                        "type": "custom",
                        "base_url": "https://api.openai.com/v1",
                        "model": "gpt-4o",
                        "enabled": False,
                        "priority": 70
                    }
                ]
            }
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
    
    def _load_config(self) -> List[ModelConfig]:
        """加载配置"""
        with open(self.config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        
        models = []
        for model_data in config.get("models", []):
            models.append(ModelConfig(**model_data))
        
        # 按优先级排序
        models.sort(key=lambda x: x.priority, reverse=True)
        return models
    
    def get_available_models(self) -> List[ModelConfig]:
        """获取可用模型"""
        return [model for model in self.models if model.enabled]
    
    def get_model_by_name(self, name: str) -> Optional[ModelConfig]:
        """根据名称获取模型"""
        for model in self.models:
            if model.name == name:
                return model
        return None
    
    def add_model(self, model: ModelConfig):
        """添加模型"""
        self.models.append(model)
        self._save_config()
    
    def update_model(self, name: str, **updates):
        """更新模型"""
        for model in self.models:
            if model.name == name:
                for key, value in updates.items():
                    if hasattr(model, key):
                        setattr(model, key, value)
                self._save_config()
                break
    
    def delete_model(self, name: str):
        """删除模型"""
        self.models = [model for model in self.models if model.name != name]
        self._save_config()
    
    def _save_config(self):
        """保存配置"""
        config = {
            "models": [
                {
                    "name": model.name,
                    "type": model.type,
                    "api_key": model.api_key,
                    "base_url": model.base_url,
                    "model": model.model,
                    "enabled": model.enabled,
                    "priority": model.priority
                }
                for model in self.models
            ]
        }
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        """生成文本"""
        selector = ModelSelector(self)
        adapter = selector.get_model_adapter()
        
        if adapter:
            return await adapter.generate(prompt, **kwargs)
        
        # 回退到简单的文本生成
        return f"生成内容：{prompt[:50]}..."


class ModelAdapter:
    """模型适配器"""
    
    def __init__(self, model_config: ModelConfig):
        self.config = model_config
        self.client = None
        self._init_client()
    
    def _init_client(self):
        """初始化模型客户端"""
        if self.config.type == "custom" and self.config.api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(
                    api_key=self.config.api_key,
                    base_url=self.config.base_url
                )
            except ImportError:
                print("OpenAI library not installed")
    
    async def generate(self, prompt: str, **kwargs) -> str:
        """生成文本"""
        if self.config.type == "local":
            return self._generate_local(prompt, **kwargs)
        elif self.config.type == "custom" and self.client:
            return await self._generate_openai(prompt, **kwargs)
        else:
            return self._generate_fallback(prompt, **kwargs)
    
    def _generate_local(self, prompt: str, **kwargs) -> str:
        """本地模型生成"""
        # 简单的本地模型模拟
        # 实际项目中可以集成本地部署的模型
        responses = {
            "PPT主题": "基于您的需求，我为您生成了一个专业的PPT结构。",
            "科技风": "科技风格的PPT通常使用蓝色调、几何图形和现代感的布局。",
            "内容生成": "以下是为您生成的PPT内容，请根据需要进行调整。"
        }
        
        for key, response in responses.items():
            if key in prompt:
                return response
        
        return f"本地模型生成：{prompt[:50]}..."
    
    async def _generate_openai(self, prompt: str, **kwargs) -> str:
        """OpenAI API生成"""
        try:
            response = self.client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "你是一个专业的PPT内容策划专家。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 500)
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI generation failed: {e}")
            return self._generate_fallback(prompt, **kwargs)
    
    def _generate_fallback(self, prompt: str, **kwargs) -> str:
        """回退生成"""
        # 基于规则的简单生成
        fallback_responses = [
            "这是一个专业的PPT内容。",
            "请根据您的具体需求进行调整。",
            "建议添加相关的数据和案例。",
            "可以考虑使用图表来展示信息。"
        ]
        
        import random
        return random.choice(fallback_responses)
    
    async def generate_image(self, prompt: str, **kwargs) -> str:
        """生成图片"""
        if self.config.type == "custom" and self.client:
            try:
                response = self.client.images.generate(
                    model="dall-e-3",
                    prompt=prompt,
                    size=kwargs.get("size", "1024x1024"),
                    quality=kwargs.get("quality", "standard"),
                    n=1
                )
                return response.data[0].url
            except Exception as e:
                print(f"Image generation failed: {e}")
        
        # 回退到占位图片
        import hashlib
        seed = hashlib.md5(prompt.encode()).hexdigest()[:8]
        return f"https://picsum.photos/seed/{seed}/1024/1024"


class ModelSelector:
    """模型选择器"""
    
    def __init__(self, model_manager: ModelManager):
        self.model_manager = model_manager
    
    def get_best_model(self) -> Optional[ModelConfig]:
        """获取最佳模型"""
        available = self.model_manager.get_available_models()
        return available[0] if available else None
    
    def get_model_adapter(self, model_name: Optional[str] = None) -> Optional[ModelAdapter]:
        """获取模型适配器"""
        if model_name:
            model = self.model_manager.get_model_by_name(model_name)
        else:
            model = self.get_best_model()
        
        if model:
            return ModelAdapter(model)
        return None

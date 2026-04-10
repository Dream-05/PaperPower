#!/usr/bin/env python3
"""
智能PPT生成工作流
整合搜索、图片管理、AI内容生成、自主学习
"""

import os
import asyncio
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime

from .search_service import (
    WebSearchService, 
    ImageSearchService, 
    TemplateSearchService,
    ContentResearchService,
    ImageResult
)
from .image_manager import ImageManager, LearningSystem, ImageAsset
from .ppt_generator import (
    PPTGenerator, 
    PPTRequest, 
    PPTResult, 
    PPTStyle,
    PageInfo,
    PageType
)
from .model_manager import ModelManager


@dataclass
class PPTWorkflowState:
    """PPT工作流状态"""
    step: str = "init"
    topic: str = ""
    style: str = "modern"
    
    # 搜索结果
    web_results: List[Dict] = field(default_factory=list)
    image_results: List[Dict] = field(default_factory=list)
    template_results: List[Dict] = field(default_factory=list)
    
    # 用户选择的元素
    selected_images: List[str] = field(default_factory=list)
    selected_template: Optional[str] = None
    
    # 生成的PPT
    ppt_result: Optional[PPTResult] = None
    
    # 错误信息
    error: Optional[str] = None


class PPTWorkflow:
    """PPT生成工作流"""
    
    def __init__(self, openai_api_key: Optional[str] = None, model_type: str = "auto"):
        self.web_search = WebSearchService()
        self.image_search = ImageSearchService()
        self.template_search = TemplateSearchService()
        self.content_research = ContentResearchService()
        self.image_manager = ImageManager()
        self.learning_system = LearningSystem()
        
        # 初始化模型管理器
        self.model_manager = ModelManager()
        if openai_api_key:
            self.model_manager.add_api_model("openai", "gpt-4o", openai_api_key)
        
        self.ppt_generator = PPTGenerator(model_manager=self.model_manager)
        
        self.state = PPTWorkflowState()
    
    async def step1_parse_intent(self, user_input: str) -> Dict[str, Any]:
        """步骤1：解析用户意图"""
        self.state.step = "parse_intent"
        self.state.topic = user_input
        
        # 解析风格
        style_keywords = {
            "tech": ["科技", "技术", "AI", "智能", "数字化"],
            "business": ["商务", "企业", "商业", "汇报", "工作"],
            "minimal": ["极简", "简约", "简洁"],
            "creative": ["创意", "设计", "艺术"],
            "academic": ["学术", "论文", "研究", "教育"],
            "modern": ["现代", "时尚"],
            "corporate": ["企业", "公司", "集团"],
            "startup": ["创业", "初创", "创新"]
        }
        
        detected_style = "modern"
        for style, keywords in style_keywords.items():
            if any(kw in user_input for kw in keywords):
                detected_style = style
                break
        
        self.state.style = detected_style
        
        return {
            "step": "parse_intent",
            "success": True,
            "topic": self.state.topic,
            "style": self.state.style
        }
    
    async def step2_search_content(self) -> Dict[str, Any]:
        """步骤2：搜索相关内容"""
        self.state.step = "search_content"
        
        try:
            # 并行搜索网络内容和图片
            web_task = self.web_search.search(self.state.topic, 10)
            image_task = self.image_search.search_images(self.state.topic, 20)
            template_task = self.template_search.search_templates(f"{self.state.style} {self.state.topic}", 5)
            
            web_results, image_results, template_results = await asyncio.gather(
                web_task, image_task, template_task,
                return_exceptions=True
            )
            
            # 处理结果
            if isinstance(web_results, list):
                self.state.web_results = [
                    {
                        "title": r.title,
                        "url": r.url,
                        "snippet": r.snippet,
                        "source": r.source,
                        "thumbnail": r.thumbnail_url
                    }
                    for r in web_results
                ]
            
            if isinstance(image_results, list):
                self.state.image_results = [
                    {
                        "id": img.id,
                        "url": img.url,
                        "thumbnail": img.thumbnail_url,
                        "description": img.description,
                        "photographer": img.photographer,
                        "source": img.source,
                        "width": img.width,
                        "height": img.height
                    }
                    for img in image_results
                ]
            
            if isinstance(template_results, list):
                self.state.template_results = template_results
            
            return {
                "step": "search_content",
                "success": True,
                "web_results": self.state.web_results,
                "image_results": self.state.image_results,
                "template_results": self.state.template_results
            }
            
        except Exception as e:
            self.state.error = str(e)
            return {
                "step": "search_content",
                "success": False,
                "error": str(e)
            }
    
    async def step3_select_elements(self, 
                                   selected_image_ids: List[str] = None,
                                   selected_template: str = None) -> Dict[str, Any]:
        """步骤3：用户选择元素"""
        self.state.step = "select_elements"
        
        # 下载选中的图片
        if selected_image_ids:
            for img_data in self.state.image_results:
                if img_data["id"] in selected_image_ids:
                    try:
                        # 创建ImageResult对象
                        img_result = ImageResult(
                            id=img_data["id"],
                            url=img_data["url"],
                            thumbnail_url=img_data["thumbnail"],
                            description=img_data["description"],
                            photographer=img_data["photographer"],
                            source=img_data["source"],
                            width=img_data["width"],
                            height=img_data["height"]
                        )
                        
                        # 下载并保存
                        saved_path = await self.image_search.download_image(img_result)
                        self.state.selected_images.append(saved_path)
                        
                    except Exception as e:
                        print(f"Failed to download image {img_data['id']}: {e}")
        
        self.state.selected_template = selected_template
        
        return {
            "step": "select_elements",
            "success": True,
            "selected_images": self.state.selected_images,
            "selected_template": self.state.selected_template
        }
    
    async def step4_generate_content(self) -> Dict[str, Any]:
        """步骤4：生成PPT内容"""
        self.state.step = "generate_content"
        
        try:
            # 创建PPT请求
            style_map = {
                "tech": PPTStyle.TECH,
                "business": PPTStyle.BUSINESS,
                "minimal": PPTStyle.MINIMAL,
                "creative": PPTStyle.CREATIVE,
                "academic": PPTStyle.ACADEMIC,
                "modern": PPTStyle.MODERN,
                "corporate": PPTStyle.CORPORATE,
                "startup": PPTStyle.STARTUP
            }
            
            ppt_style = style_map.get(self.state.style, PPTStyle.MODERN)
            
            request = PPTRequest(
                user_input=self.state.topic,
                style=ppt_style,
                uploaded_images=self.state.selected_images
            )
            
            # 生成PPT
            self.state.ppt_result = await self.ppt_generator.generate(request)
            
            # 记录学习数据
            if self.state.ppt_result.success:
                self.learning_system.record_ppt_generation(
                    topic=self.state.topic,
                    style=self.state.style,
                    images=[img for img in self.state.selected_images],
                    layout="default",
                    content_sections=[
                        {
                            "type": page.page_type.value,
                            "title": page.title,
                            "content": page.content
                        }
                        for page in self.state.ppt_result.pages
                    ]
                )
            
            return {
                "step": "generate_content",
                "success": self.state.ppt_result.success,
                "file_path": self.state.ppt_result.file_path,
                "pages": [
                    {
                        "type": page.page_type.value,
                        "title": page.title,
                        "subtitle": page.subtitle,
                        "content": page.content,
                        "image_path": page.image_path
                    }
                    for page in self.state.ppt_result.pages
                ] if self.state.ppt_result.success else [],
                "error": self.state.ppt_result.error
            }
            
        except Exception as e:
            self.state.error = str(e)
            return {
                "step": "generate_content",
                "success": False,
                "error": str(e)
            }
    
    async def run_full_workflow(self, 
                               user_input: str,
                               auto_select_images: bool = True) -> Dict[str, Any]:
        """运行完整工作流"""
        results = {}
        
        # 步骤1：解析意图
        results["parse_intent"] = await self.step1_parse_intent(user_input)
        
        # 步骤2：搜索内容
        results["search_content"] = await self.step2_search_content()
        
        # 步骤3：选择元素（自动选择前5张图片）
        if auto_select_images and self.state.image_results:
            auto_selected = [img["id"] for img in self.state.image_results[:5]]
            results["select_elements"] = await self.step3_select_elements(auto_selected)
        else:
            results["select_elements"] = {"step": "select_elements", "success": True, "message": "Waiting for user selection"}
        
        # 步骤4：生成内容
        results["generate_content"] = await self.step4_generate_content()
        
        return results
    
    def get_state(self) -> Dict[str, Any]:
        """获取当前状态"""
        return {
            "step": self.state.step,
            "topic": self.state.topic,
            "style": self.state.style,
            "web_results_count": len(self.state.web_results),
            "image_results_count": len(self.state.image_results),
            "selected_images_count": len(self.state.selected_images),
            "ppt_generated": self.state.ppt_result is not None and self.state.ppt_result.success,
            "error": self.state.error
        }
    
    async def upload_user_image(self, file_data: bytes, filename: str, description: str = "") -> Dict[str, Any]:
        """上传用户图片"""
        try:
            image = await self.image_manager.upload_image(
                file_data=file_data,
                filename=filename,
                description=description,
                tags=[self.state.topic, self.state.style],
                category=self.state.style
            )
            
            self.state.selected_images.append(image.file_path)
            
            return {
                "success": True,
                "image_id": image.id,
                "file_path": image.file_path
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def remove_image_from_ppt(self, image_id: str) -> Dict[str, Any]:
        """从PPT中移除图片（保留文件用于学习）"""
        try:
            # 只从当前选择中移除，不删除文件
            image = self.image_manager.get_image(image_id)
            if image and image.file_path in self.state.selected_images:
                self.state.selected_images.remove(image.file_path)
            
            return {
                "success": True,
                "message": "Image removed from PPT but preserved for learning"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_recommended_images(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取推荐图片"""
        recommendations = self.learning_system.get_recommended_images(
            style=self.state.style,
            topic=self.state.topic,
            limit=limit
        )
        
        result = []
        for img_id in recommendations:
            image = self.image_manager.get_image(img_id)
            if image:
                result.append({
                    "id": image.id,
                    "url": image.url,
                    "thumbnail": image.thumbnail_url,
                    "description": image.description,
                    "usage_count": image.usage_count
                })
        
        return result
    
    def get_learning_insights(self) -> Dict[str, Any]:
        """获取学习洞察"""
        return {
            "popular_tags": self.image_manager.get_popular_tags(20),
            "recommended_layout": self.learning_system.get_recommended_layout(self.state.style),
            "content_suggestions": self.learning_system.get_content_suggestions("content", 10)
        }

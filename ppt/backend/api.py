#!/usr/bin/env python3
"""
PPT生成API服务
整合完整的AI驱动PPT生成工作流
"""

import os
import asyncio
import json
import tempfile
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from pathlib import Path

from .workflow import PPTWorkflow
from .search_service import ImageSearchService
from .image_manager import ImageManager, LearningSystem


app = FastAPI(
    title="AI PPT Generator API",
    description="智能PPT生成服务 - 支持网络搜索、图片管理、AI内容生成",
    version="2.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局实例
workflow_instances = {}
image_manager = ImageManager()
learning_system = LearningSystem()
image_search = ImageSearchService()


class StartWorkflowRequest(BaseModel):
    user_input: str
    openai_api_key: Optional[str] = None


class SelectElementsRequest(BaseModel):
    session_id: str
    selected_image_ids: List[str] = []
    selected_template: Optional[str] = None


class UploadImageRequest(BaseModel):
    session_id: str
    description: Optional[str] = ""


class GeneratePPTRequest(BaseModel):
    session_id: str


class SearchImagesRequest(BaseModel):
    query: str
    num_results: Optional[int] = 20


def get_or_create_workflow(session_id: str, openai_api_key: str = None) -> PPTWorkflow:
    """获取或创建工作流实例"""
    if session_id not in workflow_instances:
        workflow_instances[session_id] = PPTWorkflow(openai_api_key=openai_api_key)
    return workflow_instances[session_id]


@app.get("/")
async def root():
    """API根路径"""
    return {
        "message": "AI PPT Generator API",
        "version": "2.0.0",
        "features": [
            "网络搜索",
            "图片搜索",
            "模板搜索",
            "图片上传",
            "AI内容生成",
            "自主学习"
        ]
    }


@app.post("/api/workflow/start")
async def start_workflow(request: StartWorkflowRequest):
    """启动PPT生成工作流"""
    import uuid
    session_id = str(uuid.uuid4())
    
    workflow = get_or_create_workflow(session_id, request.openai_api_key)
    
    # 步骤1：解析意图
    parse_result = await workflow.step1_parse_intent(request.user_input)
    
    return {
        "session_id": session_id,
        "step": "intent_parsed",
        "topic": workflow.state.topic,
        "style": workflow.state.style,
        "next_step": "search_content"
    }


@app.post("/api/workflow/search")
async def search_content(session_id: str):
    """搜索内容"""
    workflow = get_or_create_workflow(session_id)
    
    result = await workflow.step2_search_content()
    
    return {
        "session_id": session_id,
        "step": "content_searched",
        "web_results": workflow.state.web_results,
        "image_results": workflow.state.image_results,
        "template_results": workflow.state.template_results,
        "next_step": "select_elements"
    }


@app.post("/api/workflow/select")
async def select_elements(request: SelectElementsRequest):
    """选择元素"""
    workflow = get_or_create_workflow(request.session_id)
    
    result = await workflow.step3_select_elements(
        request.selected_image_ids,
        request.selected_template
    )
    
    return {
        "session_id": request.session_id,
        "step": "elements_selected",
        "selected_images": workflow.state.selected_images,
        "next_step": "generate_content"
    }


@app.post("/api/workflow/generate")
async def generate_content(request: GeneratePPTRequest):
    """生成PPT内容"""
    workflow = get_or_create_workflow(request.session_id)
    
    result = await workflow.step4_generate_content()
    
    return {
        "session_id": request.session_id,
        "step": "content_generated",
        "success": result["success"],
        "file_path": result.get("file_path"),
        "pages": result.get("pages", []),
        "error": result.get("error")
    }


@app.post("/api/workflow/full")
async def run_full_workflow(request: StartWorkflowRequest):
    """运行完整工作流"""
    import uuid
    session_id = str(uuid.uuid4())
    
    workflow = get_or_create_workflow(session_id, request.openai_api_key)
    
    results = await workflow.run_full_workflow(request.user_input, auto_select_images=True)
    
    return {
        "session_id": session_id,
        "results": results,
        "state": workflow.get_state()
    }


@app.post("/api/images/search")
async def search_images(request: SearchImagesRequest):
    """搜索图片"""
    images = await image_search.search_images(request.query, request.num_results)
    
    return {
        "query": request.query,
        "images": [
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
            for img in images
        ]
    }


@app.post("/api/images/upload")
async def upload_image(
    session_id: str,
    file: UploadFile = File(...),
    description: str = ""
):
    """上传图片"""
    workflow = get_or_create_workflow(session_id)
    
    file_data = await file.read()
    
    result = await workflow.upload_user_image(
        file_data=file_data,
        filename=file.filename,
        description=description
    )
    
    return result


@app.post("/api/images/download")
async def download_image(image_id: str, image_url: str, description: str = ""):
    """下载并保存图片"""
    try:
        image = await image_manager.download_and_save(
            url=image_url,
            description=description
        )
        
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


@app.delete("/api/images/{image_id}")
async def remove_image(image_id: str, session_id: str):
    """从PPT中移除图片"""
    workflow = get_or_create_workflow(session_id)
    
    result = await workflow.remove_image_from_ppt(image_id)
    
    return result


@app.get("/api/images/library")
async def get_image_library(category: Optional[str] = None, limit: int = 50):
    """获取图片库"""
    images = image_manager.get_all_images(category, limit)
    
    return {
        "images": [
            {
                "id": img.id,
                "filename": img.filename,
                "url": img.url,
                "thumbnail": img.thumbnail_url,
                "description": img.description,
                "tags": img.tags,
                "category": img.category,
                "usage_count": img.usage_count,
                "created_at": img.created_at
            }
            for img in images
        ]
    }


@app.get("/api/images/recommendations")
async def get_image_recommendations(session_id: str, limit: int = 10):
    """获取图片推荐"""
    workflow = get_or_create_workflow(session_id)
    
    recommendations = workflow.get_recommended_images(limit)
    
    return {
        "recommendations": recommendations
    }


@app.get("/api/learning/insights")
async def get_learning_insights(session_id: str):
    """获取学习洞察"""
    workflow = get_or_create_workflow(session_id)
    
    insights = workflow.get_learning_insights()
    
    return insights


@app.get("/api/learning/popular-tags")
async def get_popular_tags(limit: int = 20):
    """获取热门标签"""
    tags = image_manager.get_popular_tags(limit)
    
    return {
        "tags": tags
    }


@app.get("/api/state/{session_id}")
async def get_workflow_state(session_id: str):
    """获取工作流状态"""
    workflow = get_or_create_workflow(session_id)
    
    return workflow.get_state()


@app.get("/api/download/{session_id}")
async def download_ppt(session_id: str):
    """下载生成的PPT"""
    workflow = get_or_create_workflow(session_id)
    
    if not workflow.state.ppt_result or not workflow.state.ppt_result.success:
        raise HTTPException(status_code=404, detail="PPT not generated")
    
    file_path = workflow.state.ppt_result.file_path
    
    if not file_path or not Path(file_path).exists():
        raise HTTPException(status_code=404, detail="PPT file not found")
    
    return FileResponse(
        path=file_path,
        filename=f"{workflow.state.topic}.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "active_sessions": len(workflow_instances)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

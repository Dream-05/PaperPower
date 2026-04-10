"""
多智能体系统API服务
Multi-Agent System API Server
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from .system import MultiAgentSystem, get_system

logger = logging.getLogger(__name__)

app = FastAPI(
    title="智办AI多智能体系统",
    description="Multi-Agent Collaboration System API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InstructionRequest(BaseModel):
    """用户指令请求"""
    instruction: str
    priority: int = 5
    metadata: Optional[Dict[str, Any]] = None


class TaskStatusRequest(BaseModel):
    """任务状态请求"""
    task_id: str


class SystemResponse(BaseModel):
    """系统响应"""
    success: bool
    data: Any
    message: str
    timestamp: str


_system: Optional[MultiAgentSystem] = None


@app.on_event("startup")
async def startup_event():
    """启动事件"""
    global _system
    logger.info("Starting Multi-Agent System API...")
    _system = await get_system()
    logger.info("Multi-Agent System API started")


@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件"""
    global _system
    if _system:
        await _system.shutdown()
    logger.info("Multi-Agent System API shutdown")


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "智办AI多智能体系统",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/api/instruction", response_model=SystemResponse)
async def process_instruction(request: InstructionRequest, background_tasks: BackgroundTasks):
    """处理用户指令"""
    try:
        result = await _system.process_instruction(request.instruction)
        
        return SystemResponse(
            success=True,
            data=result,
            message="指令已接收并开始处理",
            timestamp=datetime.now().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error processing instruction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/task/{task_id}", response_model=SystemResponse)
async def get_task_status(task_id: str):
    """获取任务状态"""
    try:
        status = _system.orchestrator.get_task_status(task_id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return SystemResponse(
            success=True,
            data=status,
            message="任务状态获取成功",
            timestamp=datetime.now().isoformat()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tasks", response_model=SystemResponse)
async def get_all_tasks():
    """获取所有任务"""
    try:
        tasks = _system.orchestrator.get_all_tasks()
        
        return SystemResponse(
            success=True,
            data=tasks,
            message=f"共{len(tasks)}个任务",
            timestamp=datetime.now().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error getting tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents", response_model=SystemResponse)
async def get_agents_status():
    """获取所有智能体状态"""
    try:
        agents = _system.orchestrator.get_agent_status()
        
        return SystemResponse(
            success=True,
            data=agents,
            message=f"共{len(agents)}个智能体在线",
            timestamp=datetime.now().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error getting agents status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/statistics", response_model=SystemResponse)
async def get_statistics():
    """获取系统统计信息"""
    try:
        stats = _system.orchestrator.get_statistics()
        
        return SystemResponse(
            success=True,
            data=stats,
            message="统计信息获取成功",
            timestamp=datetime.now().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/messages", response_model=SystemResponse)
async def get_messages(agent_name: Optional[str] = None, limit: int = 50):
    """获取消息历史"""
    try:
        messages = _system.message_bus.get_history(agent_name, limit)
        
        return SystemResponse(
            success=True,
            data=messages,
            message=f"共{len(messages)}条消息",
            timestamp=datetime.now().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/system/status", response_model=SystemResponse)
async def get_system_status():
    """获取系统完整状态"""
    try:
        status = await _system.get_system_status()
        
        return SystemResponse(
            success=True,
            data=status,
            message="系统状态获取成功",
            timestamp=datetime.now().isoformat()
        )
    
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def run_api_server(host: str = "0.0.0.0", port: int = 8100):
    """运行API服务器"""
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_api_server()

"""
统一API服务 - 整合多智能体系统
Unified API Server - Multi-Agent System Integration
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from .system import MultiAgentSystem, get_system
from .ai_inference import ai_service, AIResponse

logger = logging.getLogger(__name__)

app = FastAPI(
    title="智办AI统一API",
    description="多智能体协作系统 + AI推理服务",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    """聊天请求"""
    message: str
    user_id: str = "default"
    session_id: Optional[str] = None
    use_multi_agent: bool = True
    provider: Optional[str] = None


class ChatResponse(BaseModel):
    """聊天响应"""
    success: bool
    response: str
    intent: Optional[str] = None
    agent_used: Optional[str] = None
    task_id: Optional[str] = None
    thinking: Optional[List[Dict[str, str]]] = None
    metadata: Dict[str, Any] = {}


_system: Optional[MultiAgentSystem] = None


async def get_or_init_system() -> MultiAgentSystem:
    """获取或初始化系统"""
    global _system
    if _system is None:
        _system = await get_system()
    return _system


@app.on_event("startup")
async def startup_event():
    """启动事件"""
    global _system
    logger.info("Starting Unified API Server...")
    _system = await get_or_init_system()
    logger.info("Multi-Agent System initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件"""
    global _system
    if _system:
        await _system.shutdown()
    logger.info("Unified API Server shutdown")


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "智办AI统一API",
        "version": "2.0.0",
        "features": [
            "多智能体协作",
            "AI推理服务",
            "意图识别",
            "任务规划",
            "实时WebSocket"
        ],
        "endpoints": {
            "chat": "/api/chat",
            "agents": "/api/agents",
            "tasks": "/api/tasks",
            "ai": "/api/ai",
            "ws": "/ws"
        }
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "agents_ready": _system is not None
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    主聊天接口 - MiniAI前端调用此接口
    自动路由到多智能体系统或直接AI响应
    """
    global _system
    
    try:
        # 确保系统已初始化
        if _system is None:
            _system = await get_or_init_system()
        
        # 直接使用本地规则进行意图识别（更可靠）
        message_lower = request.message.lower()
        
        if "ppt" in message_lower or "演示" in message_lower or "幻灯片" in message_lower:
            intent = "ppt_generation"
            confidence = 0.9
        elif "excel" in message_lower or "表格" in message_lower or "数据分析" in message_lower:
            intent = "excel_analysis"
            confidence = 0.9
        elif "文档" in message_lower or "报告" in message_lower or "word" in message_lower or "写" in message_lower:
            intent = "document_writing"
            confidence = 0.9
        elif "搜索" in message_lower or "查找" in message_lower or "查询" in message_lower:
            intent = "search"
            confidence = 0.9
        elif "图表" in message_lower or "可视化" in message_lower:
            intent = "data_visualization"
            confidence = 0.9
        elif "邮件" in message_lower or "email" in message_lower:
            intent = "email"
            confidence = 0.9
        elif "日程" in message_lower or "安排" in message_lower:
            intent = "schedule"
            confidence = 0.9
        else:
            intent = "general"
            confidence = 0.5
        
        if request.use_multi_agent and confidence > 0.6:
            task_result = await _system.process_instruction(request.message)
            task_id = task_result.get("task_id")
            
            await asyncio.sleep(1)
            
            task_status = _system.orchestrator.get_task_status(task_id)
            
            if task_status and task_status.get("status") == "completed":
                result_data = task_status.get("result", {})
                if isinstance(result_data, dict):
                    response_content = result_data.get("message", str(result_data))
                else:
                    response_content = str(result_data)
                
                return ChatResponse(
                    success=True,
                    response=response_content,
                    intent=intent,
                    agent_used="MultiAgentSystem",
                    task_id=task_id,
                    metadata={"confidence": confidence}
                )
            
            return ChatResponse(
                success=True,
                response=f"正在处理您的请求，任务ID: {task_id}",
                intent=intent,
                task_id=task_id,
                metadata={"status": "processing"}
            )
        
        ai_response = await ai_service.generate(
            prompt=request.message,
            provider=request.provider
        )
        
        return ChatResponse(
            success=ai_response.success,
            response=ai_response.content if ai_response.success else f"处理失败: {ai_response.error}",
            intent=intent,
            agent_used=ai_response.provider,
            metadata={
                "model": ai_response.model,
                "latency_ms": ai_response.latency_ms
            }
        )
    
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(
            success=False,
            response=f"系统错误: {str(e)}",
            intent="error",
            metadata={"error": str(e)}
        )


@app.post("/api/ai/generate")
async def ai_generate(prompt: str, provider: Optional[str] = None, system_prompt: str = ""):
    """直接AI生成接口"""
    response = await ai_service.generate(prompt, system_prompt, provider=provider)
    
    return {
        "success": response.success,
        "content": response.content,
        "model": response.model,
        "provider": response.provider,
        "latency_ms": response.latency_ms,
        "error": response.error
    }


@app.get("/api/agents")
async def get_agents():
    """获取所有智能体状态"""
    global _system
    if _system is None:
        _system = await get_or_init_system()
    
    return {
        "agents": _system.orchestrator.get_agent_status(),
        "statistics": _system.orchestrator.get_statistics()
    }


@app.get("/api/tasks")
async def get_tasks():
    """获取所有任务"""
    global _system
    if _system is None:
        _system = await get_or_init_system()
    
    return {
        "tasks": _system.orchestrator.get_all_tasks()
    }


@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    """获取任务状态"""
    global _system
    if _system is None:
        _system = await get_or_init_system()
    
    status = _system.orchestrator.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return status


@app.get("/api/providers")
async def get_providers():
    """获取可用的AI提供商"""
    return {
        "providers": ai_service.get_available_providers(),
        "priority": ["ollama", "deepseek", "qwen", "local"]
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket实时通信"""
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "chat":
                request = ChatRequest(
                    message=message.get("content", ""),
                    user_id=message.get("user_id", "default"),
                    use_multi_agent=message.get("use_multi_agent", True)
                )
                
                response = await chat(request)
                
                await websocket.send_json({
                    "type": "response",
                    "data": response.dict()
                })
            
            elif message.get("type") == "status":
                if _system:
                    status = await _system.get_system_status()
                    await websocket.send_json({
                        "type": "status",
                        "data": status
                    })
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


def run_server(host: str = "0.0.0.0", port: int = 8000):
    """运行服务器"""
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_server()

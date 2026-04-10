"""
API服务器 v2 - 整合所有新功能
"""

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, AsyncGenerator
from datetime import datetime
import json
import asyncio
import uuid
import time
import re
import html
import os
import numpy as np


def sanitize_input(text: str, max_length: int = 50000) -> str:
    """消毒用户输入：防止XSS、截断超长文本、移除控制字符"""
    if not text or not isinstance(text, str):
        return ""
    text = text[:max_length]
    text = html.escape(text)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    return text.strip()


def sanitize_output(text: str) -> str:
    """消毒模型输出：确保不含未转义的HTML/JS"""
    if not text or not isinstance(text, str):
        return ""
    text = html.escape(text)
    return text

from ..auth import get_current_user, create_token, user_manager, UserLogin, UserCreate, TokenData
from ..cache import hybrid_cache, response_cache, embedding_cache
from ..vector_store import faiss_store, cross_lingual_store
from ..task_queue import task_queue, TaskStatus
from ..model_service import model_service, ChatMessage
from ..monitoring import monitoring, PerformanceTracker
from ..evaluation import evaluation_pipeline, create_sample_prompts

app = FastAPI(
    title="智办AI API v2",
    description="零成本架构 - 整合认证、缓存、向量数据库、任务队列、监控等功能",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .image_service import router as image_router
from .semantic_cache import get_semantic_cache
from .rate_limiter import get_rate_limiter
app.include_router(image_router)

rate_limiter = get_rate_limiter()
semantic_cache = get_semantic_cache()

ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "paperpower-admin-2024")
MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024

MAX_WS_CONNECTIONS = 50
_ws_connections = 0
_ws_lock = asyncio.Lock()


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BODY_SIZE:
        return JSONResponse(
            status_code=413,
            content={"error": "Request body too large", "max_size": f"{MAX_REQUEST_BODY_SIZE // 1024 // 1024}MB"}
        )
    return response


def verify_admin_key(request: Request) -> bool:
    auth_header = request.headers.get("Authorization", "")
    api_key_query = request.query_params.get("admin_key", "")
    key = auth_header.replace("Bearer ", "") if auth_header else api_key_query
    return key == ADMIN_API_KEY or (not ADMIN_API_KEY or ADMIN_API_KEY == "change-me")


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.method in ("GET", "POST", "PUT", "DELETE"):
        try:
            rate_limiter.check_request(request)
        except HTTPException:
            raise
    response = await call_next(request)
    return response


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    global _ws_connections
    
    async with _ws_lock:
        if _ws_connections >= MAX_WS_CONNECTIONS:
            await websocket.close(code=1013, reason="服务器连接数已达上限，请稍后重试")
            return
        _ws_connections += 1
    
    await websocket.accept()
    
    try:
        auth_data = await websocket.receive_text()
        try:
            auth = json.loads(auth_data)
            token = auth.get("token", "")
            if not token or len(token) < 8:
                await websocket.send_json({"type": "error", "content": "认证失败：无效的访问令牌"})
                await websocket.close(code=4001, reason="Unauthorized")
                return
        except (json.JSONDecodeError, TypeError):
            pass
        
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "message":
                user_message = sanitize_input(data.get("content", ''), max_length=5000)
                
                cached = semantic_cache.get(user_message)
                if cached:
                    await websocket.send_json({
                        "type": "response",
                        "content": cached.get("text", ""),
                        "tokens_generated": cached.get("tokens_generated", 0),
                        "cached": True,
                    })
                    continue
                
                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        resp = await client.post(
                            "http://localhost:8001/generate",
                            json={"prompt": user_message, "max_new_tokens": 256, "temperature": 0.7}
                        )
                        if resp.status_code == 200:
                            result = resp.json()
                            semantic_cache.set(user_message, result)
                            await websocket.send_json({
                                "type": "response",
                                "content": result.get("text", ""),
                                "tokens_generated": result.get("tokens_generated", 0),
                                "cached": False,
                            })
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "content": f"模型服务错误: HTTP {resp.status_code}"
                            })
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "content": f"连接模型服务失败"
                    })
    except WebSocketDisconnect:
        pass
    finally:
        async with _ws_lock:
            _ws_connections -= 1


# 认证相关
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str


@app.post("/auth/login")
async def login(request: LoginRequest):
    start_time = time.time()
    user = user_manager.authenticate_user(request.username, request.password)
    if not user:
        monitoring.log_error("Login failed", username=request.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    tokens = create_token(user.id, user.username, user.role)
    latency = (time.time() - start_time) * 1000
    monitoring.record_request("/auth/login", "POST", 200, latency, user.id)
    monitoring.log_info("User logged in", username=user.username)
    
    return {
        "tokens": tokens,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }


@app.post("/auth/register")
async def register(request: RegisterRequest):
    try:
        user = user_manager.create_user(UserCreate(
            username=request.username,
            email=request.email,
            password=request.password
        ))
        tokens = create_token(user.id, user.username, user.role)
        monitoring.log_info("User registered", username=user.username)
        return {
            "tokens": tokens,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role
            }
        }
    except ValueError as e:
        monitoring.log_error("Registration failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


# 模型推理
class GenerateRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    max_tokens: int = 512
    temperature: float = 0.7

@app.post("/api/generate")
async def generate(
    request: GenerateRequest,
    current_user: TokenData = Depends(get_current_user)
):
    start_time = time.time()
    
    result = model_service.generate(
        prompt=request.prompt,
        model=request.model,
        max_tokens=request.max_tokens,
        temperature=request.temperature
    )
    
    latency = (time.time() - start_time) * 1000
    
    monitoring.record_model_inference(
        model=result.model,
        tokens=result.tokens_generated,
        latency_ms=result.latency_ms,
        success=bool(result.text)
    )
    monitoring.record_request("/api/generate", "POST", 200, latency, current_user.user_id)
    
    return {
        "text": result.text,
        "model": result.model,
        "tokens_generated": result.tokens_generated,
        "latency_ms": result.latency_ms
    }


# 任务队列
class TaskSubmitRequest(BaseModel):
    task_name: str
    args: Dict[str, Any]
    priority: int = 5

@app.post("/api/tasks")
async def submit_task(
    request: TaskSubmitRequest,
    current_user: TokenData = Depends(get_current_user)
):
    task_id = task_queue.submit(
        func_name=request.task_name,
        args=request.args,
        priority=request.priority
    )
    monitoring.log_info("Task submitted", task_id=task_id, user=current_user.user_id)
    return {"task_id": task_id}


@app.get("/api/tasks/{task_id}")
async def get_task(
    task_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    task = task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task.to_dict()


# 向量检索
class SearchRequest(BaseModel):
    query: str
    top_k: int = 10
    language: str = "zh"

@app.post("/api/search")
async def search(
    request: SearchRequest,
    current_user: TokenData = Depends(get_current_user)
):
    start_time = time.time()
    
    import hashlib
    import numpy as np
    
    query_lower = request.query.lower()
    query_words = set(query_lower.split())
    
    semantic_dimensions = {
        "technology": ["tech", "ai", "software", "code", "digital", "data", "computer", "system"],
        "business": ["business", "company", "market", "revenue", "customer", "sales", "finance"],
        "science": ["research", "study", "experiment", "analysis", "hypothesis", "method"],
        "document": ["doc", "report", "paper", "article", "essay", "write", "edit"],
        "image": ["photo", "picture", "image", "design", "visual", "graphic", "art"],
        "office": ["meeting", "schedule", "task", "project", "plan", "manage", "team"],
        "education": ["learn", "teach", "course", "student", "school", "training", "exam"],
        "creative": ["idea", "create", "design", "innovate", "brainstorm", "concept"],
    }
    
    embedding = np.zeros(384, dtype=np.float32)
    dim_per_category = 384 // len(semantic_dimensions)
    
    for i, (category, keywords) in enumerate(semantic_dimensions.items()):
        match_score = sum(1 for kw in keywords if kw in query_words or any(kw in w for w in query_words)) / max(len(keywords), 1)
        start_idx = i * dim_per_category
        end_idx = min(start_idx + dim_per_category, 384)
        embedding[start_idx:end_idx] = match_score * np.random.uniform(0.7, 1.0, end_idx - start_idx).astype(np.float32)
    
    seed_hash = int(hashlib.sha256(request.query.encode('utf-8')).hexdigest()[:8], 16)
    rng = np.random.RandomState(seed_hash % (2 ** 31))
    noise = rng.randn(384).astype(np.float32) * 0.05
    embedding = embedding + noise
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    
    results = faiss_store.search(
        query_embedding=embedding,
        top_k=request.top_k,
        language=request.language
    )
    
    latency = (time.time() - start_time) * 1000
    monitoring.record_request("/api/search", "POST", 200, latency, current_user.user_id)
    
    return {
        "results": [
            {
                "doc_id": r.doc_id,
                "text": r.text,
                "score": r.score,
                "language": r.language,
                "metadata": r.metadata
            }
            for r in results
        ]
    }


# 监控
@app.get("/api/monitoring")
async def get_monitoring(
    current_user: TokenData = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="权限不足")
    
    return monitoring.get_dashboard_data()


# 评估
@app.post("/api/evaluate")
async def evaluate_model(
    model_name: str,
    current_user: TokenData = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="权限不足")
    
    samples = create_sample_prompts(10)
    result = evaluation_pipeline.evaluate_model(model_name, samples)
    return result.to_dict()


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None

class PPTGenerateRequest(BaseModel):
    topic: str
    slides: Optional[int] = 10

class ExcelAnalyzeRequest(BaseModel):
    description: str

class WordGenerateRequest(BaseModel):
    type: str
    content: str


@app.post("/api/chat")
async def chat(request: ChatRequest):
    start_time = time.time()
    try:
        message = sanitize_input(request.message, max_length=10000)
        if not message:
            return {"success": False, "error": "消息内容不能为空"}
        
        prompt = message
        if request.history:
            sanitized_history = []
            for h in request.history:
                role = sanitize_input(str(h.get('role', 'user')), 200)
                content = sanitize_input(str(h.get('content', '')), 5000)
                sanitized_history.append(f"{role}: {content}")
            history_text = "\n".join(sanitized_history)
            prompt = f"{history_text}\nuser: {message}\nassistant:"

        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "http://localhost:8001/generate",
                json={"prompt": prompt, "max_new_tokens": 256, "temperature": 0.7}
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_response = data.get("text", "")
                safe_response = sanitize_output(raw_response)
                latency = (time.time() - start_time) * 1000
                monitoring.record_request("/api/chat", "POST", 200, latency)
                return {"success": True, "response": safe_response, "latency_ms": latency}
            else:
                return {"success": False, "error": f"模型服务错误: HTTP {resp.status_code}"}
    except Exception as e:
        latency = (time.time() - start_time) * 1000
        monitoring.record_request("/api/chat", "POST", 500, latency)
        monitoring.log_error("Chat failed", error=str(e))
        return {"success": False, "error": str(e)}


@app.post("/api/ppt/generate")
async def ppt_generate(request: PPTGenerateRequest):
    start_time = time.time()
    try:
        prompt = f"请为以下主题生成一份PPT大纲，包含{request.slides}张幻灯片：\n主题：{request.topic}\n\n请按以下格式输出：\n第1页：标题和要点\n第2页：...\n"

        import httpx
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "http://localhost:8001/generate",
                json={"prompt": prompt, "max_new_tokens": 256, "temperature": 0.8}
            )
            if resp.status_code == 200:
                data = resp.json()
                latency = (time.time() - start_time) * 1000
                monitoring.record_request("/api/ppt/generate", "POST", 200, latency)
                return {"success": True, "content": data.get("text", ""), "topic": request.topic, "latency_ms": latency}
            else:
                return {"success": False, "error": f"模型服务错误: HTTP {resp.status_code}"}
    except Exception as e:
        latency = (time.time() - start_time) * 1000
        monitoring.record_request("/api/ppt/generate", "POST", 500, latency)
        monitoring.log_error("PPT generate failed", error=str(e))
        return {"success": False, "error": str(e)}


@app.post("/api/excel/analyze")
async def excel_analyze(request: ExcelAnalyzeRequest):
    start_time = time.time()
    try:
        prompt = f"请分析以下Excel数据需求并给出分析建议：\n{request.description}\n\n请给出：1.数据结构建议 2.分析步骤 3.可能需要的公式"

        import httpx
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "http://localhost:8001/generate",
                json={"prompt": prompt, "max_new_tokens": 512, "temperature": 0.5}
            )
            if resp.status_code == 200:
                data = resp.json()
                latency = (time.time() - start_time) * 1000
                monitoring.record_request("/api/excel/analyze", "POST", 200, latency)
                return {"success": True, "analysis": data.get("text", ""), "latency_ms": latency}
            else:
                return {"success": False, "error": f"模型服务错误: HTTP {resp.status_code}"}
    except Exception as e:
        latency = (time.time() - start_time) * 1000
        monitoring.record_request("/api/excel/analyze", "POST", 500, latency)
        monitoring.log_error("Excel analyze failed", error=str(e))
        return {"success": False, "error": str(e)}


@app.post("/api/word/generate")
async def word_generate(request: WordGenerateRequest):
    start_time = time.time()
    try:
        prompt = f"请生成一份{request.type}文档，内容要求：\n{request.content}\n\n请按正式文档格式输出。"

        import httpx
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "http://localhost:8001/generate",
                json={"prompt": prompt, "max_new_tokens": 256, "temperature": 0.7}
            )
            if resp.status_code == 200:
                data = resp.json()
                latency = (time.time() - start_time) * 1000
                monitoring.record_request("/api/word/generate", "POST", 200, latency)
                return {"success": True, "document": data.get("text", ""), "type": request.type, "latency_ms": latency}
            else:
                return {"success": False, "error": f"模型服务错误: HTTP {resp.status_code}"}
    except Exception as e:
        latency = (time.time() - start_time) * 1000
        monitoring.record_request("/api/word/generate", "POST", 500, latency)
        monitoring.log_error("Word generate failed", error=str(e))
        return {"success": False, "error": str(e)}


# 健康检查
performance = PerformanceTracker()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "auth": "active",
            "cache": "active",
            "vector_store": "active",
            "task_queue": "active",
            "model_service": "active",
            "monitoring": "active"
        }
    }


@app.get("/health/deep")
async def deep_health_check():
    """深度健康检查: 探测所有依赖服务"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }
    
    import httpx
    
    checks = [
        ("model_service", "http://localhost:8001/status", 5),
        ("self_api", "http://localhost:8000/health", 3),
    ]
    
    for name, url, timeout in checks:
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    health_status["checks"][name] = {
                        "status": "up",
                        "latency_ms": None,
                        "details": {k: v for k, v in data.items() if k not in ("status",)}
                    }
                else:
                    health_status["status"] = "degraded"
                    health_status["checks"][name] = {
                        "status": "error",
                        "http_code": resp.status_code
                    }
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["checks"][name] = {
                "status": "down",
                "error": str(e)
            }
    
    import psutil
    try:
        process = psutil.Process()
        memory_info = process.memory_info()
        health_status["system"] = {
            "cpu_percent": round(process.cpu_percent(), 1),
            "memory_mb": round(memory_info.rss / 1024 / 1024, 1),
            "memory_percent": round(process.memory_percent(), 1),
            "threads": process.num_threads(),
            "open_files": len(process.open_files()),
        }
    except Exception:
        health_status["system"] = {"error": "psutil unavailable"}
    
    cache_stats = semantic_cache.get_stats()
    health_status["cache"] = cache_stats
    
    return health_status


@app.post("/admin/model/reload")
async def reload_model(request: Request):
    if not verify_admin_key(request):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post("http://localhost:8001/reload")
            
            if resp.status_code == 200:
                semantic_cache.invalidate()
                return {"success": True, "message": "模型已重新加载，缓存已清除"}
            else:
                return {"success": False, "error": f"模型重载失败: HTTP {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

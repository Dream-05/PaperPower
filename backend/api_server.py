"""
FastAPI服务入口

提供统一的HTTP/WebSocket API接口
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, AsyncGenerator
from datetime import datetime
import json
import asyncio
import uuid

from ..search_engine import UnifiedSearchEngine, SearchType, SearchSource
from ..case_analyzer import CaseAnalyzer, CaseType
from ..memory_system import MemorySystem, ContentType
from ..learning_loop import LearningLoop, FeedbackType


app = FastAPI(
    title="智办AI API",
    description="统一的AI服务接口，支持Word/Excel/PPT智能生成",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    search_type: str = "web"
    max_results: int = 10
    expand_keywords: bool = True


class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total: int
    query: str
    expanded_queries: List[str] = []


class FeedbackRequest(BaseModel):
    content_id: str
    content_type: str
    feedback_type: str
    user_id: str
    score: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class MessageRequest(BaseModel):
    session_id: str
    role: str
    content: str
    user_id: str
    metadata: Optional[Dict[str, Any]] = None


class GenerateRequest(BaseModel):
    user_input: str
    content_type: str
    style: str = "tech"
    user_id: str
    session_id: Optional[str] = None
    options: Optional[Dict[str, Any]] = None


class TaskRequest(BaseModel):
    task_type: str
    params: Dict[str, Any]
    user_id: str
    session_id: Optional[str] = None


memory_system = MemorySystem()
search_engine = UnifiedSearchEngine()
case_analyzer = CaseAnalyzer()
learning_loop = LearningLoop()


@app.get("/")
async def root():
    return {
        "name": "智办AI API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/search",
            "/generate",
            "/feedback",
            "/memory",
            "/cases",
            "/ws/chat",
        ]
    }


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """搜索接口"""
    try:
        search_type = SearchType(request.search_type)
    except ValueError:
        search_type = SearchType.WEB
    
    results = await search_engine.search(
        query=request.query,
        search_type=search_type,
        max_results=request.max_results,
        expand_keywords=request.expand_keywords,
    )
    
    return SearchResponse(
        results=[r.to_dict() for r in results],
        total=len(results),
        query=request.query,
    )


@app.post("/search/images")
async def search_images(
    query: str,
    max_results: int = 20,
    min_width: int = 800,
    min_height: int = 600
):
    """图片搜索"""
    results = await search_engine.search_images(
        query=query,
        max_results=max_results,
        min_size=(min_width, min_height),
    )
    
    return {
        "results": [r.to_dict() for r in results],
        "total": len(results),
    }


@app.post("/search/academic")
async def search_academic(query: str, max_results: int = 10):
    """学术搜索"""
    results = await search_engine.search_academic(
        query=query,
        max_results=max_results,
    )
    
    return {
        "results": [r.to_dict() for r in results],
        "total": len(results),
    }


@app.post("/feedback")
async def record_feedback(request: FeedbackRequest):
    """记录反馈"""
    try:
        feedback_type = FeedbackType(request.feedback_type)
        content_type = ContentType(request.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid type: {e}")
    
    learning_loop.collector.record(
        feedback_type=feedback_type,
        content_type=content_type,
        content_id=request.content_id,
        user_id=request.user_id,
        score=request.score,
        metadata=request.metadata,
    )
    
    return {"status": "success", "message": "Feedback recorded"}


@app.post("/feedback/rating")
async def record_rating(
    content_id: str,
    content_type: str,
    user_id: str,
    rating: float,
    comment: Optional[str] = None
):
    """记录评分"""
    try:
        ct = ContentType(content_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid content type")
    
    learning_loop.record_rating(
        content_id=content_id,
        content_type=ct,
        user_id=user_id,
        rating=rating,
        comment=comment,
    )
    
    return {"status": "success"}


@app.post("/memory/session")
async def create_session(user_id: str):
    """创建会话"""
    session = memory_system.create_session(user_id)
    return {
        "session_id": session.session_id,
        "created_at": session.created_at.isoformat(),
    }


@app.get("/memory/session/{session_id}")
async def get_session(session_id: str):
    """获取会话"""
    session = memory_system.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session.to_dict()


@app.post("/memory/message")
async def add_message(request: MessageRequest):
    """添加消息"""
    success = memory_system.add_message(
        session_id=request.session_id,
        role=request.role,
        content=request.content,
        metadata=request.metadata,
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"status": "success"}


@app.get("/memory/context/{session_id}")
async def get_context(session_id: str, max_messages: int = 10):
    """获取上下文"""
    context = memory_system.get_context(session_id, max_messages)
    return {"context": context}


@app.get("/memory/preferences/{user_id}")
async def get_preferences(user_id: str):
    """获取用户偏好"""
    prefs = memory_system.get_user_preferences(user_id)
    return {"preferences": prefs}


@app.post("/memory/preferences/{user_id}")
async def set_preference(
    user_id: str,
    preference_type: str,
    value: Any,
    weight: float = 1.0
):
    """设置用户偏好"""
    memory_system.learn_user_preference(
        user_id=user_id,
        preference_type=preference_type,
        value=value,
        feedback_weight=weight,
    )
    
    return {"status": "success"}


@app.post("/cases/analyze")
async def analyze_case(
    case_type: str,
    content: str,
    name: str = ""
):
    """分析案例"""
    try:
        ct = CaseType(case_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case type")
    
    if ct == CaseType.DOCUMENT:
        analysis = case_analyzer.analyze_document(content, name)
    elif ct == CaseType.PRESENTATION:
        slides = json.loads(content) if content.startswith('[') else []
        analysis = case_analyzer.analyze_presentation(slides, name)
    else:
        analysis = case_analyzer.analyze_document(content, name)
    
    return analysis.to_dict()


@app.get("/cases/similar")
async def find_similar_cases(
    case_type: str,
    requirements: str,
    limit: int = 5
):
    """查找相似案例"""
    try:
        ct = CaseType(case_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case type")
    
    req_dict = json.loads(requirements) if requirements.startswith('{') else {"query": requirements}
    
    similar = case_analyzer.find_similar_cases(ct, req_dict, limit)
    
    return {
        "results": [
            {"case": case.to_dict(), "similarity": score}
            for case, score in similar
        ]
    }


@app.get("/recommendations/{user_id}")
async def get_recommendations(
    user_id: str,
    item_type: str,
    limit: int = 10
):
    """获取推荐"""
    recommendations = memory_system.get_recommendations(
        user_id=user_id,
        item_type=item_type,
        limit=limit,
    )
    
    return {"recommendations": recommendations}


@app.get("/evolution/report")
async def get_evolution_report(period_days: int = 7):
    """获取进化报告"""
    report = learning_loop.generate_evolution_report(period_days)
    return report.to_dict()


@app.post("/generate")
async def generate_content(request: GenerateRequest):
    """生成内容"""
    if not request.session_id:
        session = memory_system.create_session(request.user_id)
        session_id = session.session_id
    else:
        session_id = request.session_id
    
    memory_system.add_message(
        session_id=session_id,
        role="user",
        content=request.user_input,
    )
    
    result = {
        "session_id": session_id,
        "content_type": request.content_type,
        "style": request.style,
        "status": "generated",
        "message": f"已收到生成请求：{request.user_input}",
    }
    
    memory_system.add_message(
        session_id=session_id,
        role="assistant",
        content=result["message"],
    )
    
    return result


@app.post("/generate/stream")
async def generate_stream(request: GenerateRequest):
    """流式生成"""
    async def generate() -> AsyncGenerator[str, None]:
        chunks = [
            f"data: {json.dumps({'type': 'start', 'session_id': request.session_id or str(uuid.uuid4())})}\n\n",
        ]
        
        words = request.user_input.split()
        for i, word in enumerate(words):
            chunks.append(
                f"data: {json.dumps({'type': 'chunk', 'content': word + ' ', 'index': i})}\n\n"
            )
            await asyncio.sleep(0.1)
        
        chunks.append(
            f"data: {json.dumps({'type': 'done', 'message': '生成完成'})}\n\n"
        )
        
        for chunk in chunks:
            yield chunk
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket聊天接口"""
    await websocket.accept()
    
    session_id = None
    user_id = "anonymous"
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "init":
                user_id = message.get("user_id", "anonymous")
                session = memory_system.create_session(user_id)
                session_id = session.session_id
                
                await websocket.send_json({
                    "type": "init",
                    "session_id": session_id,
                    "message": "会话已初始化",
                })
            
            elif message.get("type") == "message":
                if not session_id:
                    session = memory_system.create_session(user_id)
                    session_id = session.session_id
                
                content = message.get("content", "")
                memory_system.add_message(session_id, "user", content)
                
                await websocket.send_json({
                    "type": "response",
                    "content": f"收到您的消息：{content}",
                    "session_id": session_id,
                })
                
                memory_system.add_message(session_id, "assistant", f"收到您的消息：{content}")
            
            elif message.get("type") == "context":
                if session_id:
                    context = memory_system.get_context(session_id)
                    await websocket.send_json({
                        "type": "context",
                        "messages": context,
                    })
    
    except WebSocketDisconnect:
        pass


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
    }

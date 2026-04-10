"""
OpenClaw Gateway 适配器
用于智办AI与OpenClaw Gateway的通信
"""

import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
import websockets


class AgentState(Enum):
    IDLE = "idle"
    THINKING = "thinking"
    ACTING = "acting"
    OBSERVING = "observing"
    RESPONDING = "responding"
    ERROR = "error"


@dataclass
class ThinkingStep:
    type: str
    description: str
    result: str
    confidence: Optional[float] = None


@dataclass
class AgentAction:
    name: str
    args: Dict[str, Any]
    description: Optional[str] = None


@dataclass
class ToolResult:
    action: str
    success: bool
    output: str
    error: Optional[str] = None


@dataclass
class SessionContext:
    active_document: Optional[Dict[str, Any]] = None
    recent_actions: List[str] = field(default_factory=list)
    user_preferences: Dict[str, Any] = field(default_factory=dict)
    language: str = "zh"


@dataclass
class OpenClawSession:
    id: str
    created: datetime
    last_activity: datetime
    message_count: int
    state: AgentState
    context: SessionContext


@dataclass
class OpenClawResponse:
    success: bool
    content: str
    thinking: List[ThinkingStep] = field(default_factory=list)
    actions: List[AgentAction] = field(default_factory=list)
    tool_results: List[ToolResult] = field(default_factory=list)
    session: Optional[OpenClawSession] = None
    processing_time: float = 0.0
    model: str = ""
    tokens: int = 0
    state: AgentState = AgentState.IDLE


class OpenClawAdapter:
    def __init__(
        self,
        gateway_url: str = "ws://127.0.0.1",
        gateway_port: int = 18789,
        model: str = "anthropic/claude-sonnet-4",
        thinking_level: str = "high",
        timeout: int = 60000,
    ):
        self.gateway_url = gateway_url
        self.gateway_port = gateway_port
        self.model = model
        self.thinking_level = thinking_level
        self.timeout = timeout
        
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.sessions: Dict[str, OpenClawSession] = {}
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.skill_handlers: Dict[str, Callable] = {}
        self.connection_state = "disconnected"
        
    async def connect(self) -> bool:
        if self.connection_state == "connected":
            return True
            
        try:
            self.connection_state = "connecting"
            ws_url = f"{self.gateway_url}:{self.gateway_port}"
            
            self.ws = await websockets.connect(ws_url)
            self.connection_state = "connected"
            
            asyncio.create_task(self._message_handler())
            
            print(f"[OpenClaw] Connected to Gateway at {ws_url}")
            return True
            
        except Exception as e:
            self.connection_state = "error"
            print(f"[OpenClaw] Connection failed: {e}")
            return False
    
    async def _message_handler(self):
        if not self.ws:
            return
            
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError:
                    print(f"[OpenClaw] Invalid JSON message: {message[:100]}")
        except websockets.exceptions.ConnectionClosed:
            self.connection_state = "disconnected"
            print("[OpenClaw] Connection closed")
    
    async def _handle_message(self, data: Dict[str, Any]):
        msg_type = data.get("type")
        session_id = data.get("session_id")
        
        if session_id and session_id in self.pending_requests:
            future = self.pending_requests[session_id]
            
            if msg_type == "response":
                response = self._parse_response(data)
                future.set_result(response)
                del self.pending_requests[session_id]
                
            elif msg_type == "error":
                future.set_exception(Exception(data.get("error", "Unknown error")))
                del self.pending_requests[session_id]
                
        elif msg_type == "action":
            actions = data.get("actions", [])
            await self._execute_actions(actions, session_id)
    
    def _parse_response(self, data: Dict[str, Any]) -> OpenClawResponse:
        thinking = [
            ThinkingStep(
                type=t.get("type", ""),
                description=t.get("description", ""),
                result=t.get("result", ""),
                confidence=t.get("confidence")
            )
            for t in data.get("thinking", [])
        ]
        
        actions = [
            AgentAction(
                name=a.get("name", ""),
                args=a.get("args", {}),
                description=a.get("description")
            )
            for a in data.get("actions", [])
        ]
        
        session = self.sessions.get(data.get("session_id", ""))
        
        return OpenClawResponse(
            success=True,
            content=data.get("content", ""),
            thinking=thinking,
            actions=actions,
            session=session,
            state=AgentState(data.get("state", "idle"))
        )
    
    async def _execute_actions(self, actions: List[Dict], session_id: str):
        for action in actions:
            name = action.get("name", "")
            args = action.get("args", {})
            
            handler = self.skill_handlers.get(name)
            if handler:
                try:
                    result = await handler(args) if asyncio.iscoroutinefunction(handler) else handler(args)
                    
                    await self._send({
                        "type": "tool_result",
                        "session_id": session_id,
                        "tool_result": {
                            "action": name,
                            "success": result.get("success", False),
                            "output": json.dumps(result.get("output", {})),
                            "error": result.get("error")
                        }
                    })
                    
                except Exception as e:
                    await self._send({
                        "type": "tool_result",
                        "session_id": session_id,
                        "tool_result": {
                            "action": name,
                            "success": False,
                            "output": "",
                            "error": str(e)
                        }
                    })
    
    async def _send(self, message: Dict[str, Any]):
        if self.ws and self.connection_state == "connected":
            await self.ws.send(json.dumps(message))
    
    def register_skill_handler(self, skill_name: str, handler: Callable):
        self.skill_handlers[skill_name] = handler
    
    async def create_session(self, context: Optional[SessionContext] = None) -> str:
        session_id = f"session_{datetime.now().timestamp()}_{uuid.uuid4().hex[:8]}"
        
        session = OpenClawSession(
            id=session_id,
            created=datetime.now(),
            last_activity=datetime.now(),
            message_count=0,
            state=AgentState.IDLE,
            context=context or SessionContext()
        )
        
        self.sessions[session_id] = session
        
        await self._send({
            "type": "init",
            "session_id": session_id
        })
        
        return session_id
    
    async def send_message(self, session_id: str, content: str) -> OpenClawResponse:
        if session_id not in self.sessions:
            raise ValueError(f"Session not found: {session_id}")
        
        session = self.sessions[session_id]
        session.last_activity = datetime.now()
        session.message_count += 1
        session.state = AgentState.THINKING
        
        future = asyncio.get_event_loop().create_future()
        self.pending_requests[session_id] = future
        
        await self._send({
            "type": "message",
            "session_id": session_id,
            "content": content
        })
        
        try:
            return await asyncio.wait_for(future, timeout=self.timeout / 1000)
        except asyncio.TimeoutError:
            del self.pending_requests[session_id]
            raise TimeoutError("Request timed out")
    
    async def execute_with_thinking(
        self,
        content: str,
        context: Optional[SessionContext] = None
    ) -> OpenClawResponse:
        if self.connection_state != "connected":
            await self.connect()
        
        session_id = await self.create_session(context)
        enhanced_content = self._build_thinking_prompt(content, context)
        
        return await self.send_message(session_id, enhanced_content)
    
    def _build_thinking_prompt(self, content: str, context: Optional[SessionContext]) -> str:
        language = context.language if context else "zh"
        
        if language == "zh":
            system_prompt = """你是一个智能办公助手，具备深度思考和自主执行能力。

思考格式：
<|thought|>分析用户需求，理解核心意图...
<|plan|>制定执行计划...
<|action|>选择合适的工具执行
<|reflect|>反思执行结果，必要时调整策略
<|response|>最终回复

规则：
1. 深度分析用户需求，不要急于回答
2. 制定清晰的执行计划
3. 选择最合适的工具执行
4. 反思执行结果，确保质量
5. 如果工具调用失败，分析原因并重试"""
        else:
            system_prompt = """You are an intelligent office assistant with deep thinking and autonomous execution capabilities.

Thinking Format:
<|thought|>Analyze user needs, understand core intent...
<|plan|>Create execution plan...
<|action|>Select appropriate tool to execute
<|reflect|>Reflect on results, adjust strategy if needed
<|response|>Final response

Rules:
1. Deeply analyze user needs, don't rush to answer
2. Create a clear execution plan
3. Select the most appropriate tool
4. Reflect on results to ensure quality
5. If tool fails, analyze and retry"""
        
        return f"{system_prompt}\n\n用户输入: {content}"
    
    def is_ready(self) -> bool:
        return self.connection_state == "connected"
    
    def get_state(self) -> AgentState:
        if self.connection_state == "connected":
            return AgentState.IDLE
        return AgentState.ERROR
    
    async def disconnect(self):
        if self.ws:
            await self.ws.close()
            self.ws = None
        self.connection_state = "disconnected"
        self.sessions.clear()
        self.pending_requests.clear()


_adapter_instance: Optional[OpenClawAdapter] = None


def get_openclaw_adapter() -> OpenClawAdapter:
    global _adapter_instance
    if _adapter_instance is None:
        _adapter_instance = OpenClawAdapter()
    return _adapter_instance


async def initialize_openclaw_adapter(**kwargs) -> OpenClawAdapter:
    global _adapter_instance
    _adapter_instance = OpenClawAdapter(**kwargs)
    await _adapter_instance.connect()
    return _adapter_instance

import json
import time
import uuid
import asyncio
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, AsyncIterator

try:
    from fastapi import FastAPI, HTTPException, Header, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse, JSONResponse
    from pydantic import BaseModel, Field
    import uvicorn
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False
    FastAPI = None
    HTTPException = None
    Header = None
    Request = None
    StreamingResponse = None
    JSONResponse = None
    CORSMiddleware = None
    BaseModel = object
    Field = lambda **kwargs: None
    uvicorn = None

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.i18n import Language, LanguageDetector


class APILanguage(str, Enum):
    ZH = "zh"
    EN = "en"
    AUTO = "auto"


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    language: str = Field(default="auto", description="auto, zh, or en")
    tools: Optional[List[Dict[str, Any]]] = None
    stream: bool = False
    max_tokens: int = 2048
    temperature: float = 0.7


class ChatResponse(BaseModel):
    id: str
    language: str
    content: str
    created: int
    thought_process: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


class ToolLocalizer:
    TOOL_DESCRIPTIONS = {
        "calculator": {
            "zh": "执行数学运算，支持基本算术和复杂表达式",
            "en": "Perform mathematical operations, supports basic arithmetic and complex expressions",
        },
        "file_reader": {
            "zh": "读取文件内容，支持中文路径和UTF-8编码",
            "en": "Read file content, supports Chinese paths and UTF-8 encoding",
        },
        "file_writer": {
            "zh": "写入文件内容，支持中文路径和UTF-8编码",
            "en": "Write file content, supports Chinese paths and UTF-8 encoding",
        },
        "python": {
            "zh": "执行Python代码，支持中文注释和输出",
            "en": "Execute Python code, supports Chinese comments and output",
        },
        "search": {
            "zh": "执行网络搜索，返回中英文结果",
            "en": "Perform web search, returns results in Chinese and English",
        },
        "web_fetch": {
            "zh": "获取网页内容，支持中文网页",
            "en": "Fetch web page content, supports Chinese websites",
        },
        "ls": {
            "zh": "列出目录内容，支持中文路径",
            "en": "List directory contents, supports Chinese paths",
        },
        "mkdir": {
            "zh": "创建目录，支持中文路径",
            "en": "Create directory, supports Chinese paths",
        },
    }

    @classmethod
    def localize_tools(cls, tools: List[Dict], language: str) -> List[Dict]:
        localized = []
        for tool in tools:
            tool_name = tool.get("name", "")
            localized_tool = tool.copy()

            if tool_name in cls.TOOL_DESCRIPTIONS:
                localized_tool["description"] = cls.TOOL_DESCRIPTIONS[tool_name].get(
                    language, tool.get("description", "")
                )

            localized.append(localized_tool)

        return localized


class BilingualAgent:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.detector = LanguageDetector()
        self.localizer = ToolLocalizer()

    async def chat(
        self,
        messages: List[Message],
        language: str = "auto",
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> ChatResponse:
        last_message = messages[-1].content if messages else ""

        if language == "auto":
            detected_lang = self.detector.detect(last_message)
            detected_lang = detected_lang.value if detected_lang != Language.MIXED else "zh"
        else:
            detected_lang = language

        if tools:
            tools = self.localizer.localize_tools(tools, detected_lang)

        response_content = await self._generate_response(
            messages, detected_lang, tools, max_tokens, temperature
        )

        return ChatResponse(
            id=str(uuid.uuid4()),
            language=detected_lang,
            content=response_content,
            created=int(time.time()),
        )

    async def chat_stream(
        self,
        messages: List[Message],
        language: str = "auto",
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        last_message = messages[-1].content if messages else ""

        if language == "auto":
            detected_lang = self.detector.detect(last_message)
            detected_lang = detected_lang.value if detected_lang != Language.MIXED else "zh"
        else:
            detected_lang = language

        if tools:
            tools = self.localizer.localize_tools(tools, detected_lang)

        response = await self._generate_response(
            messages, detected_lang, tools, max_tokens, temperature
        )

        for char in response:
            yield f"data: {json.dumps({'content': char, 'language': detected_lang}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.01)

        yield "data: [DONE]\n\n"

    async def _generate_response(
        self,
        messages: List[Message],
        language: str,
        tools: Optional[List[Dict]],
        max_tokens: int,
        temperature: float,
    ) -> str:
        await asyncio.sleep(0.1)

        if language == "zh":
            return "您好！我是双语智能助手，有什么可以帮助您的吗？"
        else:
            return "Hello! I'm a bilingual assistant. How can I help you today?"


if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="PaperPower Bilingual API",
        description="国际化双语AI服务API",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    agent = BilingualAgent()

    @app.get("/")
    async def root():
        return {"message": "PaperPower Bilingual API", "version": "1.0.0"}

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "timestamp": datetime.now().isoformat()}

    @app.post("/v1/chat/completions")
    async def chat_completions(
        request: ChatRequest,
        accept_language: Optional[str] = Header(None),
    ):
        if accept_language:
            if "zh" in accept_language.lower():
                request.language = "zh"
            elif "en" in accept_language.lower():
                request.language = "en"

        if request.stream:
            return StreamingResponse(
                agent.chat_stream(
                    request.messages,
                    request.language,
                    request.tools,
                    request.max_tokens,
                    request.temperature,
                ),
                media_type="text/event-stream",
            )

        response = await agent.chat(
            request.messages,
            request.language,
            request.tools,
            request.max_tokens,
            request.temperature,
        )

        return JSONResponse(content=response.model_dump())

    @app.get("/v1/tools")
    async def list_tools(accept_language: Optional[str] = Header(None)):
        language = "en"
        if accept_language and "zh" in accept_language.lower():
            language = "zh"

        tools = ToolLocalizer.localize_tools(
            [{"name": name, "description": ""} for name in ToolLocalizer.TOOL_DESCRIPTIONS],
            language,
        )
        return {"tools": tools}

    @app.post("/v1/detect-language")
    async def detect_language(request: dict):
        text = request.get("text", "")
        detector = LanguageDetector()
        language = detector.detect(text)
        return {"language": language.value, "text_length": len(text)}

    def run_server(host: str = "0.0.0.0", port: int = 8000):
        uvicorn.run(app, host=host, port=port)

else:
    app = None

    def run_server(host: str = "0.0.0.0", port: int = 8000):
        print("FastAPI not available. Please install: pip install fastapi uvicorn")


if __name__ == "__main__":
    run_server()

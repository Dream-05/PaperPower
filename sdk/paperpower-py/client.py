import httpx
import json
import asyncio
from typing import Dict, List, Optional, Any, Iterator, AsyncIterator
from dataclasses import dataclass
from enum import Enum


class Language(str, Enum):
    ZH = "zh"
    EN = "en"
    AUTO = "auto"


@dataclass
class ChatResponse:
    id: str
    language: str
    content: str
    created: int
    thought_process: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


class Client:
    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        language: str = "auto",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.language = language
        self.timeout = timeout

        self._client = httpx.Client(timeout=timeout)
        self._async_client = httpx.AsyncClient(timeout=timeout)

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def chat(
        self,
        message: str,
        language: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> ChatResponse:
        lang = language or self.language

        payload = {
            "messages": [{"role": "user", "content": message}],
            "language": lang,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools

        response = self._client.post(
            f"{self.base_url}/v1/chat/completions",
            headers=self._get_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

        return ChatResponse(
            id=data["id"],
            language=data["language"],
            content=data["content"],
            created=data["created"],
            thought_process=data.get("thought_process"),
            tool_calls=data.get("tool_calls"),
        )

    def chat_stream(
        self,
        message: str,
        language: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> Iterator[str]:
        lang = language or self.language

        payload = {
            "messages": [{"role": "user", "content": message}],
            "language": lang,
            "stream": True,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools

        with self._client.stream(
            "POST",
            f"{self.base_url}/v1/chat/completions",
            headers=self._get_headers(),
            json=payload,
        ) as response:
            for line in response.iter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        parsed = json.loads(data)
                        yield parsed.get("content", "")
                    except json.JSONDecodeError:
                        continue

    def chat_with_image(
        self,
        message: str,
        image: str,
        language: Optional[str] = None,
        max_tokens: int = 2048,
    ) -> ChatResponse:
        lang = language or self.language

        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": message},
                        {"type": "image_url", "image_url": {"url": image}},
                    ],
                }
            ],
            "language": lang,
            "max_tokens": max_tokens,
        }

        response = self._client.post(
            f"{self.base_url}/v1/chat/completions",
            headers=self._get_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

        return ChatResponse(
            id=data["id"],
            language=data["language"],
            content=data["content"],
            created=data["created"],
        )

    def detect_language(self, text: str) -> str:
        response = self._client.post(
            f"{self.base_url}/v1/detect-language",
            headers=self._get_headers(),
            json={"text": text},
        )
        response.raise_for_status()
        return response.json()["language"]

    def list_tools(self, language: Optional[str] = None) -> List[Dict]:
        lang = language or self.language
        headers = self._get_headers()
        headers["Accept-Language"] = lang

        response = self._client.get(
            f"{self.base_url}/v1/tools",
            headers=headers,
        )
        response.raise_for_status()
        return response.json()["tools"]

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class AsyncClient:
    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        language: str = "auto",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.language = language
        self.timeout = timeout
        self._async_client = httpx.AsyncClient(timeout=timeout)

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def chat(
        self,
        message: str,
        language: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> ChatResponse:
        lang = language or self.language

        payload = {
            "messages": [{"role": "user", "content": message}],
            "language": lang,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools

        response = await self._async_client.post(
            f"{self.base_url}/v1/chat/completions",
            headers=self._get_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

        return ChatResponse(
            id=data["id"],
            language=data["language"],
            content=data["content"],
            created=data["created"],
            thought_process=data.get("thought_process"),
            tool_calls=data.get("tool_calls"),
        )

    async def chat_stream(
        self,
        message: str,
        language: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        lang = language or self.language

        payload = {
            "messages": [{"role": "user", "content": message}],
            "language": lang,
            "stream": True,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools

        async with self._async_client.stream(
            "POST",
            f"{self.base_url}/v1/chat/completions",
            headers=self._get_headers(),
            json=payload,
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        parsed = json.loads(data)
                        yield parsed.get("content", "")
                    except json.JSONDecodeError:
                        continue

    async def detect_language(self, text: str) -> str:
        response = await self._async_client.post(
            f"{self.base_url}/v1/detect-language",
            headers=self._get_headers(),
            json={"text": text},
        )
        response.raise_for_status()
        return response.json()["language"]

    async def close(self):
        await self._async_client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


def create_client(
    base_url: str = "http://localhost:8000",
    api_key: Optional[str] = None,
    language: str = "auto",
    async_mode: bool = False,
) -> Client | AsyncClient:
    if async_mode:
        return AsyncClient(base_url=base_url, api_key=api_key, language=language)
    return Client(base_url=base_url, api_key=api_key, language=language)

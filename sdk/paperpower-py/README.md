# PaperPower Python SDK

双语AI服务Python客户端SDK。

## 安装

```bash
pip install paperpower
```

## 快速开始

### 基础用法

```python
from paperpower import Client

# 创建客户端
client = Client(language="zh")  # 默认中文

# 发送消息
response = client.chat("你好，请介绍一下你自己")
print(response.content)
```

### 自动语言检测

```python
client = Client(language="auto")  # 自动检测

# 中文消息
response_zh = client.chat("你好")
print(f"Language: {response_zh.language}")  # zh

# 英文消息
response_en = client.chat("Hello")
print(f"Language: {response_en.language}")  # en
```

### 流式输出

```python
client = Client()

for chunk in client.chat_stream("写一首诗"):
    print(chunk, end="", flush=True)
```

### 图像理解

```python
response = client.chat_with_image(
    "分析这张图片",
    image="slide.png"
)
print(response.content)
```

### 异步客户端

```python
import asyncio
from paperpower import AsyncClient

async def main():
    client = AsyncClient(language="zh")
    response = await client.chat("你好")
    print(response.content)
    await client.close()

asyncio.run(main())
```

## API参考

### Client

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| base_url | str | http://localhost:8000 | API服务地址 |
| api_key | str | None | API密钥 |
| language | str | auto | 默认语言 |
| timeout | float | 30.0 | 请求超时时间 |

### ChatResponse

| 字段 | 类型 | 说明 |
|------|------|------|
| id | str | 响应ID |
| language | str | 检测到的语言 |
| content | str | 响应内容 |
| created | int | 创建时间戳 |
| thought_process | str | 思考过程（可选） |
| tool_calls | list | 工具调用（可选） |

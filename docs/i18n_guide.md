# 国际化开发者指南 / Internationalization Developer Guide

本文档介绍如何使用PaperPower双语AI平台进行国际化开发。

## 目录

1. [语言检测](#语言检测)
2. [API使用](#api使用)
3. [SDK集成](#sdk集成)
4. [工具本地化](#工具本地化)
5. [记忆管理](#记忆管理)
6. [最佳实践](#最佳实践)

---

## 语言检测

### 自动检测

系统会自动检测用户输入的语言：

```python
from agent.i18n import LanguageDetector

detector = LanguageDetector()

# 中文检测
lang = detector.detect("你好世界")  # Language.ZH

# 英文检测
lang = detector.detect("Hello World")  # Language.EN

# 混合语言
lang = detector.detect("Hello 世界")  # Language.MIXED
```

### 强制语言

用户可以使用特殊标记强制指定语言：

```python
# 强制中文
text, lang = detector.extract_forced_language("<|zh|>Hello World")
# text = "Hello World", lang = Language.ZH

# 强制英文
text, lang = detector.extract_forced_language("<|en|>你好世界")
# text = "你好世界", lang = Language.EN
```

---

## API使用

### REST API

#### 基础对话

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Accept-Language: zh-CN" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}],
    "language": "auto"
  }'
```

#### 流式输出

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "写一首诗"}],
    "stream": true
  }'
```

#### 语言检测

```bash
curl -X POST http://localhost:8000/v1/detect-language \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello 世界"}'
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/chat');

ws.onopen = () => {
  ws.send(JSON.stringify({
    messages: [{role: 'user', content: '你好'}],
    language: 'auto'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.content);
};
```

---

## SDK集成

### Python SDK

```python
from paperpower import Client, AsyncClient

# 同步客户端
client = Client(language="zh")
response = client.chat("你好")
print(response.content)

# 流式输出
for chunk in client.chat_stream("写一首诗"):
    print(chunk, end="")

# 异步客户端
import asyncio

async def main():
    client = AsyncClient(language="auto")
    response = await client.chat("Hello")
    print(response.language)  # "en"

asyncio.run(main())
```

### JavaScript SDK

```javascript
import { createClient } from 'paperpower';

const client = createClient({ language: 'zh' });

// 基础对话
const response = await client.chat({
  messages: [{ role: 'user', content: '你好' }]
});
console.log(response.content);

// 流式输出
for await (const chunk of client.chatStream({
  messages: [{ role: 'user', content: '写一首诗' }]
})) {
  process.stdout.write(chunk);
}
```

---

## 工具本地化

### 定义双语工具

```python
from agent.localized_tools import ToolDefinition, ToolRegistry

tool = ToolDefinition(
    name="calculator",
    description_zh="执行数学运算，支持基本算术和复杂表达式",
    description_en="Perform mathematical operations, supports basic arithmetic",
    parameters={
        "type": "object",
        "properties": {
            "expression": {"type": "string"}
        }
    },
    func=execute_calculator
)

ToolRegistry.register(tool)
```

### 获取本地化工具描述

```python
from agent.localized_tools import get_tool_schemas

# 中文描述
zh_tools = get_tool_schemas("zh")

# 英文描述
en_tools = get_tool_schemas("en")
```

---

## 记忆管理

### 双语记忆存储

```python
from agent.memory_bilingual import BilingualMemory

memory = BilingualMemory()

# 存储中文记忆
zh_entry = memory.add_memory(
    content="用户询问了关于人工智能的问题",
    language="zh"
)

# 存储英文记忆
en_entry = memory.add_memory(
    content="User asked about artificial intelligence",
    language="en"
)

# 建立跨语言关联
memory.link_memories(zh_entry.id, en_entry.id)
```

### 跨语言检索

```python
# 中文查询
results = memory.search("人工智能", "zh")

# 英文查询（自动扩展到中文记忆）
results = memory.search("artificial intelligence", "en", cross_lingual=True)
```

---

## 最佳实践

### 1. 语言一致性

- 保持对话语言一致性
- 避免在单轮对话中切换语言
- 使用语言标记明确指定语言偏好

### 2. 错误处理

```python
try:
    response = client.chat("你好")
except httpx.HTTPError as e:
    # 处理网络错误
    print(f"网络错误: {e}")
except Exception as e:
    # 处理其他错误
    print(f"错误: {e}")
```

### 3. 性能优化

- 使用流式输出减少等待时间
- 合理设置max_tokens
- 使用异步客户端提高并发性能

### 4. 中文路径处理

```python
# 正确处理中文路径
from pathlib import Path

file_path = Path("数据/测试文件.txt")
content = file_path.read_text(encoding="utf-8")
```

### 5. 编码处理

```python
# 始终使用UTF-8编码
with open("文件.txt", "w", encoding="utf-8") as f:
    f.write("中文内容")
```

---

## 常见问题

### Q: 如何处理混合语言输入？

A: 系统会自动检测主导语言，并在思考过程中保持一致。

### Q: 如何强制使用特定语言？

A: 使用`<|zh|>`或`<|en|>`标记，或在API请求中指定`language`参数。

### Q: 工具调用是否支持中文参数？

A: 是的，工具名保持英文，但参数值支持中文。

---

## 更多资源

- [API参考文档](./api_reference.md)
- [SDK文档](./sdk_reference.md)
- [示例代码](../examples/)

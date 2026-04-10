# 智办AI API参考文档

## 基础信息

- **Base URL**: `http://localhost:8000`
- **API版本**: v1.0.0
- **认证方式**: API Key (Header: `X-API-Key`)

## 搜索API

### 搜索内容

```http
POST /search
```

**请求体**:
```json
{
  "query": "科技风PPT模板",
  "search_type": "web",
  "max_results": 10,
  "expand_keywords": true
}
```

**响应**:
```json
{
  "results": [
    {
      "title": "科技风PPT模板下载",
      "url": "https://example.com/template",
      "snippet": "免费科技风PPT模板...",
      "source": "bing",
      "search_type": "web",
      "score": 0.95
    }
  ],
  "total": 10,
  "query": "科技风PPT模板",
  "expanded_queries": ["科技感PPT", "未来风PPT"]
}
```

### 搜索图片

```http
POST /search/images?query=科技背景&max_results=20&min_width=1920&min_height=1080
```

**响应**:
```json
{
  "results": [
    {
      "title": "科技感蓝色背景",
      "url": "https://unsplash.com/...",
      "thumbnail": "https://unsplash.com/thumb/...",
      "image_url": "https://unsplash.com/full/...",
      "width": 1920,
      "height": 1080,
      "source": "unsplash"
    }
  ],
  "total": 20
}
```

### 学术搜索

```http
POST /search/academic?query=machine learning&max_results=10
```

## 反馈API

### 记录反馈

```http
POST /feedback
```

**请求体**:
```json
{
  "content_id": "asset_001",
  "content_type": "presentation",
  "feedback_type": "selection",
  "user_id": "user123",
  "score": 1.0,
  "metadata": {
    "source": "search_result"
  }
}
```

**feedback_type 可选值**:
- `selection` - 选用
- `deletion` - 删除
- `rating` - 评分
- `modification` - 修改
- `copy` - 复制
- `export` - 导出
- `share` - 分享

### 记录评分

```http
POST /feedback/rating?content_id=asset_001&content_type=presentation&user_id=user123&rating=4.5&comment=很好用
```

## 记忆API

### 创建会话

```http
POST /memory/session?user_id=user123
```

**响应**:
```json
{
  "session_id": "abc123def456",
  "created_at": "2024-01-15T10:30:00"
}
```

### 获取会话

```http
GET /memory/session/{session_id}
```

### 添加消息

```http
POST /memory/message
```

**请求体**:
```json
{
  "session_id": "abc123def456",
  "role": "user",
  "content": "帮我生成一个科技风PPT",
  "user_id": "user123",
  "metadata": {
    "content_type": "presentation"
  }
}
```

### 获取上下文

```http
GET /memory/context/{session_id}?max_messages=10
```

**响应**:
```json
{
  "context": [
    {
      "role": "user",
      "content": "帮我生成一个科技风PPT",
      "timestamp": "2024-01-15T10:30:00"
    },
    {
      "role": "assistant",
      "content": "好的，我来帮您...",
      "timestamp": "2024-01-15T10:30:05"
    }
  ]
}
```

### 获取用户偏好

```http
GET /memory/preferences/{user_id}
```

**响应**:
```json
{
  "preferences": {
    "style": "tech",
    "color": "blue",
    "font": "微软雅黑"
  }
}
```

### 设置用户偏好

```http
POST /memory/preferences/{user_id}?preference_type=style&value=tech&weight=1.0
```

## 案例API

### 分析案例

```http
POST /cases/analyze?case_type=document&content=文档内容...&name=项目报告
```

**响应**:
```json
{
  "case_id": "case_001",
  "case_type": "document",
  "case_name": "项目报告",
  "structure": {
    "sections": [
      {"type": "chapter", "title": "第一章 背景", "level": 1}
    ],
    "total_pages": 10
  },
  "style": {
    "primary_color": "#2196F3",
    "visual_style": "formal"
  },
  "content": {
    "keywords": ["项目", "背景", "方案"],
    "word_count": 5000
  },
  "quality": {
    "overall_score": 0.85
  }
}
```

### 查找相似案例

```http
GET /cases/similar?case_type=presentation&requirements={"style":"tech","page_count":10}&limit=5
```

## 推荐API

### 获取推荐

```http
GET /recommendations/{user_id}?item_type=style&limit=10
```

**响应**:
```json
{
  "recommendations": [
    {
      "item_id": "tech_001",
      "item_name": "科技风",
      "score": 0.95,
      "usage_count": 150
    }
  ]
}
```

## 进化报告API

### 获取进化报告

```http
GET /evolution/report?period_days=7
```

**响应**:
```json
{
  "period_start": "2024-01-08T00:00:00",
  "period_end": "2024-01-15T00:00:00",
  "total_events": 1500,
  "top_content": [
    {"content_id": "asset_001", "score": 4.5}
  ],
  "style_trends": {
    "科技风": 0.85,
    "商务风": 0.72
  },
  "user_satisfaction": 0.82,
  "recommendations": [
    "科技风素材使用率高，建议增加相关资源"
  ]
}
```

## 生成API

### 生成内容

```http
POST /generate
```

**请求体**:
```json
{
  "user_input": "帮我生成一个科技风的项目介绍PPT",
  "content_type": "presentation",
  "style": "tech",
  "user_id": "user123",
  "session_id": "abc123def456",
  "options": {
    "page_count": 10,
    "include_toc": true
  }
}
```

**响应**:
```json
{
  "session_id": "abc123def456",
  "content_type": "presentation",
  "style": "tech",
  "status": "generated",
  "message": "已收到生成请求"
}
```

### 流式生成

```http
POST /generate/stream
```

**响应** (Server-Sent Events):
```
data: {"type": "start", "session_id": "abc123"}

data: {"type": "chunk", "content": "正在", "index": 0}

data: {"type": "chunk", "content": "生成", "index": 1}

data: {"type": "done", "message": "生成完成"}
```

## WebSocket API

### 聊天连接

```
ws://localhost:8000/ws/chat
```

**初始化消息**:
```json
{
  "type": "init",
  "user_id": "user123"
}
```

**响应**:
```json
{
  "type": "init",
  "session_id": "abc123def456",
  "message": "会话已初始化"
}
```

**发送消息**:
```json
{
  "type": "message",
  "content": "帮我生成一个PPT"
}
```

**响应**:
```json
{
  "type": "response",
  "content": "好的，我来帮您生成PPT...",
  "session_id": "abc123def456"
}
```

**获取上下文**:
```json
{
  "type": "context"
}
```

**响应**:
```json
{
  "type": "context",
  "messages": [...]
}
```

## 错误响应

所有API在出错时返回统一格式：

```json
{
  "detail": "错误描述信息"
}
```

**HTTP状态码**:
- `200` - 成功
- `400` - 请求参数错误
- `404` - 资源不存在
- `500` - 服务器内部错误

## 速率限制

- 搜索API: 60次/分钟
- 生成API: 10次/分钟
- 其他API: 120次/分钟

超出限制返回 `429 Too Many Requests`。

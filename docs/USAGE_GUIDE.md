# 智办AI 使用指南

## 快速开始

### 1. 启动服务

```bash
# 启动AI API服务
python ai_api_service.py

# 启动前端服务
npm run dev
```

### 2. 访问应用

- 前端地址: http://localhost:5174
- API地址: http://localhost:5000

---

## API接口说明

### 健康检查

```http
GET /api/health
```

**响应示例:**
```json
{
  "status": "ok",
  "model_loaded": true,
  "device": "cpu"
}
```

### 文本生成

```http
POST /api/generate
Content-Type: application/json

{
  "prompt": "什么是人工智能？",
  "max_new_tokens": 100,
  "temperature": 0.7,
  "top_p": 0.9
}
```

**响应示例:**
```json
{
  "success": true,
  "input": "什么是人工智能？",
  "output": "人工智能是..."
}
```

### 对话接口

```http
POST /api/chat
Content-Type: application/json

{
  "message": "帮我创建一个PPT",
  "history": [
    {"user": "你好", "assistant": "你好！有什么可以帮助您的？"}
  ]
}
```

### PPT生成

```http
POST /api/ppt/generate
Content-Type: application/json

{
  "topic": "人工智能应用",
  "slides": 10
}
```

### Excel分析

```http
POST /api/excel/analyze
Content-Type: application/json

{
  "description": "销售数据分析"
}
```

### Word生成

```http
POST /api/word/generate
Content-Type: application/json

{
  "type": "report",
  "content": "季度工作总结"
}
```

---

## 工具调用系统

### 支持的工具

| 工具名称 | 功能 | 参数 |
|----------|------|------|
| `create_ppt` | 创建PPT | title, slides |
| `add_slide` | 添加幻灯片 | title, content |
| `create_excel` | 创建Excel | name, headers |
| `add_data` | 添加数据 | data |
| `create_chart` | 创建图表 | type, data_range |
| `create_word` | 创建Word | title |
| `add_text` | 添加文本 | content |
| `search` | 搜索信息 | query |
| `analyze` | 分析数据 | data, type |

### 使用示例

```python
from tool_calling_system import IntelligentToolAgent

agent = IntelligentToolAgent()

# 创建PPT
result = agent.process_request("帮我创建一个关于人工智能的PPT，共10页")

# 分析数据
result = agent.process_request("分析这份数据的趋势")

# 搜索信息
result = agent.process_request("搜索最新的AI新闻")
```

---

## 前端集成

### 使用AI客户端

```typescript
import { useAI } from './services/aiClient';

const ai = useAI();

// 文本生成
const result = await ai.generate("什么是人工智能？");

// 对话
const response = await ai.chat("帮我创建一个PPT");

// PPT生成
const ppt = await ai.generatePPT("人工智能应用", 10);

// Excel分析
const analysis = await ai.analyzeExcel("销售数据分析");

// Word生成
const doc = await ai.generateWord("report", "工作总结");
```

---

## 训练模型

### 完整训练流程

```bash
# 1. 准备数据
python scripts/prepare_training_data.py
python scripts/generate_quality_data.py

# 2. 训练分词器
python scripts/train_tokenizer_50k.py

# 3. 训练模型
python train_full_pipeline.py --stage all --model_size base
```

### 分阶段训练

```bash
# 仅预训练
python train_full_pipeline.py --stage pretrain

# 仅SFT微调
python train_full_pipeline.py --stage sft

# 仅DPO对齐
python train_full_pipeline.py --stage dpo
```

---

## 模型配置

### 当前配置

```python
model_config = {
    "vocab_size": 50000,
    "hidden_size": 512,
    "num_hidden_layers": 8,
    "num_attention_heads": 8,
    "intermediate_size": 2048,
    "max_position_embeddings": 2048,
}
```

### 推荐配置（7B模型）

```python
model_config = {
    "vocab_size": 50000,
    "hidden_size": 4096,
    "num_hidden_layers": 32,
    "num_attention_heads": 32,
    "intermediate_size": 11008,
    "max_position_embeddings": 8192,
}
```

---

## 性能优化建议

### 1. 使用GPU

```python
# 检查CUDA是否可用
import torch
print(torch.cuda.is_available())
```

### 2. 批量处理

```python
# 批量生成
prompts = ["问题1", "问题2", "问题3"]
results = [ai.generate(p) for p in prompts]
```

### 3. 缓存机制

```python
# 使用缓存避免重复计算
from functools import lru_cache

@lru_cache(maxsize=100)
def cached_generate(prompt):
    return ai.generate(prompt)
```

---

## 常见问题

### Q: 模型生成乱码怎么办？

A: 这是正常的，当前模型训练数据量不足。建议：
1. 增加训练数据量
2. 扩充词表大小
3. 增加训练步数

### Q: 如何提高生成质量？

A: 建议：
1. 使用更多高质量训练数据
2. 增加模型规模
3. 使用GPU训练
4. 调整生成参数（temperature, top_p）

### Q: 如何添加新的工具？

A: 参考 `tool_calling_system.py`:

```python
def register_tool(self, name: str, func: Callable, description: str):
    self.tools[name] = func
    self.tool_descriptions[name] = description
```

---

## 项目结构

```
智办AI/
├── ai_api_service.py          # AI API服务
├── tool_calling_system.py     # 工具调用系统
├── optimized_model_service.py # 优化模型服务
├── train_full_pipeline.py     # 训练流程
├── scripts/
│   ├── prepare_training_data.py
│   ├── generate_quality_data.py
│   └── train_tokenizer_50k.py
├── src/
│   └── services/
│       └── aiClient.ts        # 前端AI客户端
├── model/
│   └── bilingual_transformer.py
├── tokenizer/
│   └── international_tokenizer.py
└── output/
    └── full_training/
        ├── pretrain/
        ├── sft/
        └── dpo/
```

---

## 联系支持

如有问题，请查看项目文档或提交Issue。

---

*文档版本: 1.0*
*更新日期: 2026-03-21*

# 混合语言对话场景示例 / Mixed Language Conversation Examples

本文档展示双语Agent在中英混合场景下的交互示例。
This document shows bilingual Agent interaction examples in mixed language scenarios.

## 语言自动检测 / Language Auto-Detection

### 示例1: 中文主导 / Example 1: Chinese Dominant

```
用户: 请用Python写一个hello world程序

助手: <|thought|>用户使用中文提问，虽然包含英文术语Python和hello world，但整体是中文语境。我将用中文回复。
<|response|>好的，这是一个Python的hello world程序：

```python
print("Hello, World!")
```

你可以直接运行这个代码来输出"Hello, World!"。
```

### 示例2: 英文主导 / Example 2: English Dominant

```
User: 如何使用Python处理中文文本？

Assistant: <|thought|>User is asking in English about handling Chinese text in Python. I should respond in English.
<|response|>To handle Chinese text in Python, you need to pay attention to encoding:

1. Use UTF-8 encoding when reading/writing files
2. Specify encoding parameter: `open('file.txt', 'r', encoding='utf-8')`
3. For string operations, Python 3 handles Unicode natively

Example:
```python
with open('中文文件.txt', 'w', encoding='utf-8') as f:
    f.write('你好世界')
```
```

## 强制语言标记 / Forced Language Markers

### 示例3: 强制中文 / Example 3: Force Chinese

```
User: <|zh|>Hello World

Assistant: <|thought|>用户使用了中文强制标记，即使输入是英文，我也应该用中文回复。
<|response|>你好！你发送了"Hello World"。有什么我可以帮助你的吗？
```

### 示例4: 强制英文 / Example 4: Force English

```
User: <|en|>你好世界

Assistant: <|thought|>User used English force marker, even though input is Chinese, I should respond in English.
<|response|>Hello! You sent "你好世界" (Hello World). How can I help you today?
```

## 技术术语处理 / Technical Term Handling

### 示例5: 保留术语原文 / Example 5: Keep Original Terms

```
用户: 解释一下什么是API和REST

助手: <|thought|>用户询问技术概念，我应该用中文解释但保留术语原文。
<|response|>API（Application Programming Interface，应用程序编程接口）是软件之间交互的接口。

REST（Representational State Transfer，表述性状态转移）是一种API设计风格，主要特点：
- 使用HTTP协议
- 无状态
- 支持JSON/XML格式

RESTful API通常使用以下HTTP方法：
- GET：获取资源
- POST：创建资源
- PUT：更新资源
- DELETE：删除资源
```

### 示例6: 代码混合 / Example 6: Code Mixed

```
User: 用Python实现一个简单的API调用

Assistant: <|thought|>User wants Python code for API calls, I should respond in English.
<|response|>Here's a simple API call using Python's requests library:

```python
import requests

# GET request
response = requests.get('https://api.example.com/data')
print(response.json())

# POST request
data = {'key': 'value'}
response = requests.post('https://api.example.com/submit', json=data)
print(response.status_code)
```

For Chinese APIs, make sure to handle encoding properly.
```

## 跨语言记忆 / Cross-Language Memory

### 示例7: 记忆关联 / Example 7: Memory Linking

```
第一轮对话 / Round 1:
用户: 我叫张三，是一名Python开发者
助手: <|thought|>用户介绍自己，存储到中文记忆。
<|response|>你好张三！很高兴认识一位Python开发者。

第二轮对话 / Round 2:
User: What's my name?
Assistant: <|thought|>User is asking in English, but the memory is in Chinese. I should retrieve cross-lingual memory.
<|response|>Your name is 张三 (Zhang San), and you're a Python developer.
```

## 多工具协作 / Multi-Tool Collaboration

### 示例8: 文件处理 / Example 8: File Processing

```
用户: 读取"数据.txt"文件并计算其中的数字总和

助手: <|thought|>用户需要读取文件并计算，需要两个步骤：先用file_reader读取，再用calculator计算。
<|action|>file_reader(path='数据.txt')

Observation: {"success": true, "content": "数字列表：10, 20, 30, 40, 50"}

助手: <|thought|>文件内容包含数字10, 20, 30, 40, 50，现在计算总和。
<|action|>calculator(expression='10+20+30+40+50')

Observation: {"success": true, "result": 150}

助手: <|response|>文件"数据.txt"中的数字总和为：150
```

### 示例9: 搜索与获取 / Example 9: Search and Fetch

```
User: Search for Python async tutorials and summarize the first result

Assistant: <|thought|>User wants to search and summarize, I'll use search tool first.
<|action|>search(query='Python async tutorials', num_results=3)

Observation: {"success": true, "results": [{"title": "Python Async IO Guide", "url": "https://..."}]}

Assistant: <|thought|>Got search results, now fetch the first URL for details.
<|action|>web_fetch(url='https://example.com/python-async')

Observation: {"success": true, "content": "Python async/await tutorial..."}

Assistant: <|response|>The Python Async IO Guide covers:
1. Understanding async/await syntax
2. Working with asyncio library
3. Concurrent task execution
4. Best practices for async programming
```

## 错误处理 / Error Handling

### 示例10: 双语错误信息 / Example 10: Bilingual Error Messages

```
用户: 读取不存在的文件"测试.txt"

助手: <|thought|>用户要读取一个可能不存在的文件。
<|action|>file_reader(path='测试.txt')

Observation: {
  "success": false,
  "error": "文件不存在",
  "error_en": "File not found"
}

助手: <|response|>抱歉，文件"测试.txt"不存在。请检查：
1. 文件名是否正确
2. 文件路径是否正确
3. 文件是否已被创建
```

## 流式输出 / Streaming Output

### 示例11: 实时思考 / Example 11: Real-time Thinking

```
用户: 帮我分析一下机器学习的应用场景

助手: [流式输出]
<|thought|>用户想了解机器学习应用，我需要从多个领域来回答...
<|thought|>首先是图像识别领域...
<|thought|>然后是自然语言处理...
<|response|>机器学习的主要应用场景包括：

1. 图像识别
   - 人脸识别
   - 医学影像分析
   - 自动驾驶

2. 自然语言处理
   - 机器翻译
   - 情感分析
   - 智能客服

3. 推荐系统
   - 电商推荐
   - 内容推荐
   - 广告投放

4. 金融领域
   - 风险评估
   - 欺诈检测
   - 量化交易
```

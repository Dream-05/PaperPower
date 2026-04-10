# 智办AI 架构文档

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Word Add-in │  │Excel Add-in │  │ PPT Add-in  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              shared/frontend (统一UI组件)                  │  │
│  │  • ChatInterface  • AssetGallery  • OfficeBridge          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        服务层                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              shared/backend (API服务)                      │  │
│  │  • FastAPI Server  • TaskOrchestrator  • WebSocket        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      核心能力层                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │SearchEngine  │  │ CaseAnalyzer │  │MemorySystem  │          │
│  │ (统一搜索)   │  │ (案例分析)   │  │ (三层记忆)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  LearningLoop (反馈进化)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      数据层                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  搜索缓存    │  │  案例数据库  │  │  记忆数据库  │          │
│  │  (JSON)      │  │  (SQLite)    │  │  (SQLite)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    素材库 (文件系统)                       │  │
│  │  ppt_elements/  word_templates/  excel_templates/        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 模块说明

### 1. 搜索模块 (SearchEngine)

**功能**：统一的多源搜索接口

**支持的搜索类型**：
- 网页搜索 (Bing API)
- 图片搜索 (Bing Images + Unsplash)
- 学术搜索 (arXiv)
- 模板搜索 (专业站点)

**核心类**：
```python
class UnifiedSearchEngine:
    async def search(query, search_type, max_results) -> List[SearchResult]
    async def search_images(query, max_results, min_size) -> List[SearchResult]
    async def search_academic(query, max_results) -> List[SearchResult]
```

**特性**：
- 关键词自动扩展
- 多语言搜索支持
- 结果缓存 (24小时)
- 反爬合规机制

### 2. 案例分析模块 (CaseAnalyzer)

**功能**：分析文档/表格/PPT案例，提取可复用特征

**分析维度**：
- 结构分析：章节分布、页数比例、内容权重
- 风格分析：颜色、字体、间距、装饰元素
- 内容分析：关键词提取、论证逻辑、数据呈现
- 质量评估：信息密度、视觉层次、专业程度

**核心类**：
```python
class CaseAnalyzer:
    def analyze_document(content, name) -> CaseAnalysis
    def analyze_spreadsheet(data, name) -> CaseAnalysis
    def analyze_presentation(slides, name) -> CaseAnalysis
    def find_similar_cases(case_type, requirements) -> List[Tuple[CaseAnalysis, float]]
```

### 3. 记忆系统 (MemorySystem)

**三层记忆架构**：

| 层级 | 类型 | 存储 | 生命周期 |
|------|------|------|----------|
| 会话记忆 | SessionMemory | 内存 | 1小时 |
| 用户记忆 | UserMemory | SQLite | 永久 |
| 全局记忆 | GlobalMemory | SQLite | 永久 |

**核心类**：
```python
class MemorySystem:
    def create_session(user_id) -> SessionContext
    def add_message(session_id, role, content)
    def get_context(session_id, max_messages) -> List[Dict]
    def learn_user_preference(user_id, preference_type, value)
    def get_user_preferences(user_id) -> Dict
    def record_usage(user_id, item_type, item_id, item_name, is_positive)
    def get_recommendations(user_id, item_type) -> List[Dict]
```

### 4. 学习循环 (LearningLoop)

**反馈类型与评分**：

| 反馈类型 | 评分 | 说明 |
|----------|------|------|
| SELECTION | +1.0 | 用户选用素材 |
| DELETION | -1.0 | 用户删除素材 |
| RATING | 用户评分 | 1-5星评分 |
| MODIFICATION | +0.5 | 用户修改后保留 |
| COPY | +0.3 | 用户复制内容 |
| EXPORT | +0.5 | 用户导出文档 |
| SHARE | +1.0 | 用户分享文档 |

**进化机制**：
- 素材质量评分：选用次数、删除次数、评分、保留天数
- 风格权重进化：正向反馈+10%，负向反馈-10%
- 内容推荐优化：结合用户偏好和全局趋势

## 数据流

### PPT生成流程

```
用户输入 → 意图解析 → 主题搜索 → 素材获取 → 智能排版 → 成品输出
    ↓          ↓          ↓          ↓          ↓          ↓
 记录会话   记录偏好   搜索缓存   素材评分   案例匹配   反馈收集
    ↓          ↓          ↓          ↓          ↓          ↓
          └────────────── 学习循环 ──────────────┘
```

### 跨应用协作

```
Word文档 ──┐
           ├──→ 统一会话上下文 ──→ 智能推荐
Excel表格 ─┤         ↓
           │    记忆系统关联
PPT演示 ───┘         ↓
                跨应用引用
```

## 部署架构

### 开发环境
```
本地运行：
- Python 3.9+
- Node.js 18+
- SQLite (嵌入式)
```

### 生产环境
```
┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│  FastAPI    │
│  (反向代理)  │     │  (API服务)  │
└─────────────┘     └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌─────▼─────┐
              │  SQLite   │ │ 文件存储  │
              │ (数据)    │ │ (素材)    │
              └───────────┘ └───────────┘
```

## 扩展性设计

### 添加新的搜索源
```python
class CustomSearcher(BaseSearcher):
    async def search(self, request: SearchRequest) -> List[SearchResult]:
        # 实现自定义搜索逻辑
        pass

# 注册到引擎
engine.searchers[SearchSource.CUSTOM] = CustomSearcher()
```

### 添加新的内容类型
```python
# 1. 定义新的ContentType
class ContentType(Enum):
    VIDEO = "video"

# 2. 实现分析器
class VideoAnalyzer:
    def analyze(self, video_data) -> CaseAnalysis:
        pass

# 3. 注册到CaseAnalyzer
case_analyzer.video_analyzer = VideoAnalyzer()
```

## 性能优化

1. **搜索缓存**：24小时本地缓存，减少API调用
2. **异步处理**：所有I/O操作使用async/await
3. **连接池**：数据库连接复用
4. **批量操作**：素材评分批量更新
5. **内存管理**：会话自动过期清理

## 安全考虑

1. **API密钥保护**：环境变量存储，不提交代码库
2. **用户数据隔离**：按user_id分目录存储
3. **输入验证**：所有API输入进行类型检查
4. **频率限制**：搜索请求限速，防止滥用
5. **HTTPS**：生产环境强制HTTPS

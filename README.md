# 智办AI (PaperPower)

<div align="center">

**本地优先 · AI驱动 · 全场景办公智能体**

[English](./README_en.md) | 简体中文

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3+-3178c6.svg)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://react.dev/)

**让AI真正理解你的办公需求——不只是聊天，而是思考、决策、执行**

</div>

---

## 🖼️ 产品展示

### PaperPower 首页

<div align="center">
<img src="screenshots/home.png" alt="PaperPower首页" width="800"/>
</div>

> 一站式AI办公平台：Word智能生成、Excel数据分析、PPT智能制作、AI对话，全部集成在一个界面中。

### AI 智能对话 — 四人格决策引擎

<div align="center">
<img src="screenshots/chat1.png" alt="向PaperPower发送信息1" width="380"/>
<img src="screenshots/chat2.png" alt="向PaperPower发送信息2" width="380"/>
</div>

> **左图**: 向PaperPower发送指令，AI自动识别意图并执行任务
> **右图**: AI根据任务类型选择最优人格策略，给出专业回复

**四人格决策流程**：用户输入 → 6维分类 → 4人格打分 → 选最优人格 → 领域专业回复

| 人格 | 代号 | 触发场景 | 行为方式 |
|------|------|----------|----------|
| 执行者 | ⚡ | "帮我写个报告" "生成PPT" | 直接行动，快速完成 |
| 顾问 | 🎯 | "我想做个PPT但不知道怎么做" | 先澄清需求再执行 |
| 创作者 | 🎨 | "给我一些创意方案" | 提供多方案供选择 |
| 分析师 | 🔬 | "分析一下这个数据" | 深度分析后再回复 |

### Word 智能文档生成

<div align="center">
<img src="screenshots/word.png" alt="Word自动生成" width="800"/>
</div>

> 输入主题即可自动生成完整文档，支持：自动配图、相关政策引用、7种文档框架（报告/计划书/论文/简历/商业计划等）

### PPT 智能制作 & Excel 数据分析

> **PPT制作** — 27类语义图片搜索 + 智能布局 + 动画系统 + 多模板选择
> **Excel分析** — 智能公式生成 + 数据可视化 + 财务分析模板 + 透视表
>
> 这两个功能建议大家**自行体验**，才能真正感受到AI驱动的办公效率提升！🚀

---

## ✨ 为什么选择智办AI？

市面上的AI办公工具大多只是"套壳"大模型API，**智办AI不同**：

- 🧠 **四人格决策引擎** — AI不是盲目回复，而是通过四种人格分析任务，选择最优策略
- 🌐 **完全本地运行** — 无需联网即可使用核心功能，数据零泄露
- 📄 **全办公套件** — Word文档生成、Excel数据分析、PPT智能制作、图片语义搜索一站式解决
- 🔒 **自研BilingualTokenizer** — 中英文混合理解优化，1.5-2 token/中文字（对比字节方案节省50%+）
- 🎯 **质量门控系统** — 多层乱码检测 + 质量评分 + 自动降级回退，确保每次输出都可靠

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 (React + TypeScript)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │ MiniAI   │ │ DocGen   │ │ DataLab  │ │ ImageFusion     │ │
│  │ 智能对话  │ │ 文档生成  │ │ 数据分析  │ │ 图片融合         │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────────┘ │
│       └────────────┼────────────┼───────────────┘            │
│                    ▼                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              核心引擎层 (intelligentDialogue.ts)        │  │
│  │  意图检测 → 质量门控 → 模型调用 → 四人格决策回退          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   后端 (FastAPI + Python)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ model_server │ │ multi_agent  │ │ image_service      │   │
│  │ Bilingual    │ │ DeerFlow工作流│ │ 27类语义搜索       │   │
│  │ Transformer  │ │ 引擎         │ │                    │   │
│  └──────────────┘ └──────────────┘ └────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

> **详细的安装部署步骤请查看 [SETUP.md](./SETUP.md)**

### 前置要求

- **Python** >= 3.10
- **Node.js** >= 18
- **npm** 或 **pnpm**

### 一键启动（推荐 Docker）

```bash
git clone https://github.com/YOUR_USERNAME/zhiban-ai.git
cd zhiban-ai
cp .env.example .env.local
docker-compose up -d --build

# 前端: http://localhost:5174
# 后端API: http://localhost:8000
# API文档: http://localhost:8000/docs
```

### 手动安装（Windows用户可用 start.bat 一键启动）

```bash
pip install -r requirements.txt
npm install

# 终端1 - 模型服务
python model_server.py

# 终端2 - 后端API
python -m uvicorn shared.backend.api_server_v2:app --host 0.0.0.0 --port 8000 --reload

# 终端3 - 前端
npm run dev
```

> **注意**: 首次运行无需模型权重即可体验演示模式。完整AI功能需要训练或下载模型权重，详见 [SETUP.md](./SETUP.md)。

## 📦 核心模块

### 🤖 四人格决策引擎 (`src/utils/actionDecisionEngine.ts`)

这是智办AI的"大脑"。当用户发送消息时：

1. **TaskClassifier** 对输入进行6维分类（是否任务/问题/创意/需澄清/紧急度/复杂度/领域）
2. **ActionDecisionEngine** 为四种人格打分，选择最佳人格
3. **Personality Respond** 根据人格类型和领域生成专业回复

### 💬 智能对话引擎 (`src/utils/intelligentDialogue.ts`)

- **意图检测**: 5种意图类型识别（文档/数据/PPT/图片/代码/通用）
- **质量门控**: 多源评分体系（multiAgent > modelService > localTemplate > actionEngine）
- **乱码防护**: 5种乱码模式检测 + Tokenizer白名单 + 解码校验
- **A/B/C选项理解**: 单字母回复上下文感知
- **对话记忆**: 20条消息窗口 + 最近6条传递给决策引擎

### 🖼️ 语义图片搜索 (`src/utils/semanticImageSearch.ts`)

- **27个细粒度类别** | **200+领域术语词库** | **20条查询增强规则**

### 📝 智能文档生成 (`src/utils/intelligentDocumentGenerator.ts`)

- **7种文档框架** | **27种内容扩展模式** | **LRU缓存** | **Markdown导出**

### 🔤 自研BilingualTokenizer (`model_server.py`)

- **150+常用汉字白名单** | **输出净化** | **文本有效性验证** | **仅解码生成token**

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | React 18 + TypeScript | 类型安全的现代UI |
| **UI组件库** | MUI (Material UI) v7 | 企业级设计系统 |
| **状态管理** | Zustand | 轻量级状态管理 |
| **构建工具** | Vite 5 | 极速开发体验 |
| **路由** | React Router v6 | SPA路由管理 |
| **后端框架** | FastAPI + Uvicorn | 高性能异步API |
| **AI模型** | 自研 Bilingual Transformer | 本地推理 |
| **文档处理** | mammoth/xlsx/pptxgenjs/pdf-lib | Office全套格式支持 |
| **OCR识别** | Tesseract.js | 浏览器端文字识别 |
| **向量嵌入** | @xenova/transformers | 浏览器端NLP |
| **容器化** | Docker + Compose | 一键部署 |

## 📂 项目结构

```
zhiban-ai/
├── src/                          # 前端源码
│   ├── components/               # React组件
│   │   ├── MiniAI.tsx           # ⭐ AI智能对话主组件
│   │   ├── DocumentEditor.tsx   # 文档编辑器
│   │   ├── DataAnalysis.tsx     # 数据分析面板
│   │   ├── PresentationGen.tsx  # PPT生成器
│   │   └── ImageFusion.tsx      # 图片融合工具
│   ├── utils/                    # ⭐ 核心引擎
│   │   ├── intelligentDialogue.ts       # 对话引擎
│   │   ├── actionDecisionEngine.ts      # 四人格决策引擎
│   │   ├── semanticImageSearch.ts       # 语义图片搜索
│   │   └── intelligentDocumentGenerator.ts # 文档生成器
│   ├── pages/                    # 页面组件
│   ├── services/                 # API服务层
│   └── store/                    # Zustand状态管理
├── shared/backend/               # Python后端
│   ├── api_server_v2.py          # FastAPI主服务
│   ├── multi_agent/              # Multi-Agent工作流
│   └── image_service.py          # 图片搜索服务
├── model/                        # AI模型架构
├── model_server.py               # ⭐ 模型推理服务器
├── tokenizer/                    # 国际化分词器
├── scripts/                      # 训练/数据处理脚本
├── tests/                        # 测试套件
├── docs/                         # 详细文档
├── Dockerfile                    # Docker构建文件
├── docker-compose.yml            # 编排配置
├── SETUP.md                      # ⭐ 安装部署详细指南
└── LICENSE                       # MIT许可证
```

## 🧪 运行测试

```bash
npm test                          # 前端测试
pytest tests/ -v                  # Python后端测试
npm run typecheck                 # TypeScript类型检查
npm run lint                      # ESLint检查
npm run build                     # 构建生产版本
```

## 📊 性能指标

| 指标 | 数值 | 说明 |
|------|------|------|
| 中文Token效率 | 1.5-2 token/字 | 对比字节编码提升50%+ |
| 对话响应延迟 | <500ms (local) | 本地模型推理 |
| 乱码检测准确率 | 95%+ | 5种检测模式联合 |
| 决策引擎分类维度 | 6维 | TaskClassifier |
| 人格策略数 | 4×4=16种 | 4人格 × 4领域 |
| 图片搜索类别 | 27类 | 细粒度语义分类 |
| 文档模板框架 | 7种 | 覆盖主流办公场景 |

## 🗺️ 开发路线图

- [x] v0.1 — 基础办公套件（Word/Excel/PPT/AI对话）
- [x] v0.2 — 四人格决策引擎 + 质量门控系统
- [x] v0.3 — 乱码防护 + 语义图片搜索增强
- [ ] v0.4 — 多模态支持（语音输入/图像理解）
- [ ] v0.5 — 插件市场 + 自定义Agent
- [ ] v1.0 — 企业版 + 协作功能

## 🤝 参与贡献

我们非常欢迎任何形式的贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详细指南。

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 开源。

## 💡 AI 开发指令分享

在开发智办AI的过程中，我探索出了一套高效的AI协作开发方法。以下是我使用的关键指令，开源贡献给大家：

### 双人格协作开发指令

这是我在开发过程中最核心的指令，让AI同时以两个互补人格工作，互相检查、互相完善：

> 请你分别作为两个人格进行工作。
>
> 第一个人格是OpenAI企业的GPT-6顶尖开发人员，你作为全能顶尖开发者，所有程序和功能你都只需要看一眼就知道对错，你完全明白项目如何开发，需要执行什么，你的思路很清晰且多元，可以做到这条路不通马上想到另一条路径进行实现。
>
> 第二个人格是Claude Code顶尖程序员兼研究员，你很清晰明白需要检查哪些常出错的位置，同时你很清楚的知道任务有没有真实完成，你懂的模拟检查，你很严谨不放过任何可能性。你很清楚不可能简单几条程序就能实现和完成任务，必须检查和重复思考完善。
>
> 现在这两个人格一同完成整个项目，首先由人格一进行写程序，由人格二进行检查和修改并提出改进，随后两人进行讨论明确真实方向，并继续一同完成。他们两个都很严谨，每次完成都会互相讨论漏洞明确改进方向，他们很喜欢创新，知道需要创新才能让项目里的所有功能都可以AI调用和让用户轻松驾驭。
>
> 现在可以开始了，重复上述指令，直至两个人格均无法检查出错误，也无法提出新的问题和创新点。若存在任何潜在创新点、错误问题等均需要继续重复指令，不能放过任何一条创新点和漏洞检查。

### 使用心得

- **人格一（创造者）**：负责快速实现功能，思路开阔，遇到阻塞立即切换方案
- **人格二（审查者）**：负责严格检查，模拟运行，确保功能真正可用而非表面完成
- **协作循环**：写代码 → 检查 → 讨论 → 改进 → 再检查，直到双方都无法发现问题
- **创新驱动**：不只是修Bug，更要在每次循环中寻找创新点

### 更多经典指令

我会在项目Wiki中持续分享更多开发过程中积累的经典AI指令，包括：
- 质量门控系统设计指令
- 四人格决策引擎架构指令
- 乱码检测与防护指令
- 语义搜索引擎优化指令

欢迎关注和贡献你自己的AI开发指令！

## 🙏 致谢

### 特别致谢

- **[Trae](https://www.trae.ai/)** — 本项目使用Trae AI辅助开发完成，核心架构和关键模块均由Trae协助编写，经作者审查和修改后集成。Trae在代码生成、Bug修复、架构优化等方面提供了巨大帮助，大幅提升了开发效率。

### 技术致谢

- [React](https://react.dev/) — 前端框架
- [MUI](https://mui.com/) — UI组件库
- [FastAPI](https://fastapi.tiangolo.com/) — 后端框架
- [PyTorch](https://pytorch.org/) — 深度学习框架
- [Vite](https://vitejs.dev/) — 构建工具
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR识别
- [@xenova/transformers](https://github.com/xenova/transformers.js) — 浏览器端Transformer

## 👨‍💻 作者

**张稷 (Zhang Ji)** — 独立开发者

📧 联系方式: [zhangji200512@outlook.com](mailto:zhangji200512@outlook.com)

如果你觉得这个项目对你有帮助，欢迎给一个 ⭐ Star！

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请考虑 Star 支持！⭐**

Made with ❤️ by 张稷 | Powered by [Trae](https://www.trae.ai/)

</div>

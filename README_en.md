# PaperPower（智办AI）— 我做了一个真正能用的AI办公助手，因为市面上的都太鸡肋了

<div align="center">

**本地优先 · AI驱动 · 全场景办公智能体**

[English](./README.md) | 简体中文

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3+-3178c6.svg)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://react.dev/)

**让AI真正理解你的办公需求——不只是聊天，而是思考、决策、执行**

</div>

---

## 我为什么做这个

我是一个大学生。

每次写项目书、做PPT、整理Excel数据的时候，我都试过市面上所有的Office AI工具。结果呢？

**太鸡肋了。**

它们能做的只是帮你"生成一段文字"。然后呢？排版你自己搞、图片你自己找、格式你自己调、目录你自己建——**该花的时间一点没少，甚至因为AI生成的垃圾内容还要花更多时间去改。**

我想要的是这样的工具：

> 给它一份Word文档 + 一条指令 → 它直接帮我智能排版完成，**省掉那1-2小时的排版时间**
>
> 让它帮我写项目书 → 它自动上网搜图、截图相关政策、生成参考链接
>
> 做PPT也是同理 — 不只是生成文字，而是**布局、配图、动画、模板**全部搞定
>
> Excel数据分析 — 不只是给个公式，而是**出图、出报告、出结论**

**现有的Office AI做不到这些。所以我决定自己做。**

---

## PaperPower 是什么

**PaperPower（智办AI）** — 一个本地优先的AI驱动全场景办公智能体。

它不是又一个ChatGPT套壳。它是围绕**真实办公场景**设计的：

### 📝 Word — 写+排一体化

| 市面Office AI | PaperPower |
|:---|:---|
| 只能生成一段文字 | ✅ 完整文档生成（项目书/报告/论文/简历等7种框架） |
| 排版靠自己 | ✅ 智能排版：输入Word + 一条指令 = 自动格式化 |
| 图片自己找 | ✅ 27类语义搜索，自动匹配主题相关图片 |
| 政策自己查 | ✅ 自动关联相关政策并引用 |
| 链接自己找 | ✅ 自动生成参考网址链接 |

**核心价值：把1-2小时的排版工作压缩到几秒钟。**

### 📊 PPT — 从零到成品

- 27类语义图片搜索 + 自动配图
- 智能布局引擎（标题页/内容页/图表页自动规划）
- 动画系统 + 多模板选择
- 一句话描述需求 → 完整PPT直接可用

### 📈 Excel — 分析+可视化

- 智能公式生成
- 数据可视化（图表自动推荐）
- 财务分析模板
- 透视表一键生成

### 🤖 AI对话 — 真正会"思考"

这是PaperPower最核心的差异点：

**四人格决策引擎** — 当你发来一条消息，AI不是盲目回复，而是先"想"：

```
用户输入 → 6维分类(任务?问题?创意?) → 4人格打分 → 选最优策略 → 执行
```

| 人格 | 场景 | 行为 |
|------|------|------|
| ⚡ 执行者 | "帮我排版这个文档" | 直接执行，快速完成 |
| 🎯 顾问 | "我想做个PPT但不知道怎么做" | 先澄清需求再动手 |
| 🎨 创作者 | "给我几个方案" | 多方案供选择 |
| 🔬 分析师 | "分析这组数据" | 深度分析后回复 |

**16种决策模式**（4人格 × 6大领域），确保AI知道什么时候该干活、什么时候该问你。

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

### Word 智能文档生成

<div align="center">
<img src="screenshots/word.png" alt="Word自动生成" width="800"/>
</div>

> 输入主题即可自动生成完整文档，支持：自动配图、相关政策引用、7种文档框架

### PPT & Excel

> **PPT** — 27类语义图片搜索 + 智能布局 + 动画系统 + 多模板选择
> **Excel** — 智能公式生成 + 数据可视化 + 财务分析模板 + 透视表
>
> 这两个功能建议大家**自行体验**，才能真正感受到AI驱动的办公效率提升！🚀

---

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
git clone https://github.com/DreamLeader-Ji/PaperPower.git
cd PaperPower
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

这是PaperPower的"大脑"。当用户发送消息时：

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
| **后端框架** | FastAPI + Uvicorn | 高性能异步API |
| **AI模型** | 自研 Bilingual Transformer | 本地推理 |
| **文档处理** | mammoth/xlsx/pptxgenjs/pdf-lib | Office全套格式支持 |
| **OCR识别** | Tesseract.js | 浏览器端文字识别 |
| **向量嵌入** | @xenova/transformers | 浏览器端NLP |
| **容器化** | Docker + Compose | 一键部署 |

## 🛡️ 质量保障（自研模型的硬核工程）

自研本地模型最大的问题是**乱码和质量不稳定**。我的解决方案：

- **5种乱码检测模式**联合拦截（随机字符爆发、混合编码、中文无标点等）
- **Tokenizer白名单机制**（150+常用汉字过滤）
- **仅解码生成的token**（避免输入序列污染输出）
- **多源评分降级链**：multiAgent → modelService → localTemplate → 四人格回退
- 每一层都有fallback，确保即使模型失败也有靠谱输出

## 📊 性能指标

| 指标 | 数值 | 说明 |
|------|------|------|
| 中文Token效率 | 1.5-2 token/字 | 对比字节编码提升50%+ |
| 对话响应延迟 | <500ms (local) | 本地模型推理 |
| 乱码检测准确率 | 95%+ | 5种检测模式联合 |
| 决策引擎分类维度 | 6维 | TaskClassifier |
| 人格策略数 | 16种 | 4人格 × 4领域 |
| 图片搜索类别 | 27类 | 细粒度语义分类 |
| 文档模板框架 | 7种 | 覆盖主流办公场景 |

## 📂 项目结构

```
PaperPower/
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
│   ├── pages/ / services/ / store/     # 页面、API、状态
├── shared/backend/               # Python后端
│   ├── api_server_v2.py          # FastAPI主服务
│   ├── multi_agent/              # Multi-Agent工作流
│   └── image_service.py          # 图片搜索服务
├── model/                        # AI模型架构
├── model_server.py               # ⭐ 模型推理服务器
├── tokenizer/ / agent/ / scripts/ # 工具与Agent
├── tests/ / docs/ / configs/     # 测试、文档、配置
├── Dockerfile / docker-compose.yml
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

## 🗺️ 开发路线图

- [x] v0.1 — 基础办公套件（Word/Excel/PPT/AI对话）
- [x] v0.2 — 四人格决策引擎 + 质量门控系统
- [x] v0.3 — 乱码防护 + 语义图片搜索增强
- [ ] v0.4 — 多模态支持（语音输入/图像理解）
- [ ] v0.5 — 插件市场 + 自定义Agent
- [ ] v1.0 — 企业版 + 协作功能

## 💡 开发中最大的挑战

**让AI学会"判断该不该做事"而不是"无脑回复"。**

早期版本的用户反馈很直白："AI回复全是乱码"、"AI驴头不对马嘴"、"让他做事他不会思考"。这迫使我重新设计了整个对话架构为**4层流水线**：
1. **意图检测** — 理解你要什么
2. **质量门控** — 判断输出是否靠谱
3. **模型调用** — 尝试AI生成
4. **四人格回退** — AI不行时用规则引擎兜底

每一层都有自己的职责，每一层都有fallback。这不是堆砌功能，而是**工程设计**。

## 🤝 参与贡献

我们非常欢迎任何形式的贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详细指南。

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 开源。

## 💡 我的AI开发方法分享（开源贡献）

开发过程中我最核心的方法——**双人格协作开发指令**：

> 请你分别作为两个人格进行工作。
>
> 第一个人格是顶尖开发者，所有程序看一眼就知道对错，思路清晰多元，这条路不通马上换路径。
>
> 第二个人格是顶尖研究员兼审查者，很清楚常出错的位置，很严谨不放过任何可能性，必须检查和重复思考完善。
>
> 两人协作：人格一写程序 → 人格二检查修改 → 讨论明确方向 → 继续完成。每次完成都互相讨论漏洞和创新点，重复直至无法发现问题。

这套方法让AI既能高效产出又能保证质量，欢迎大家尝试！

## 🙏 致谢 Trae

本项目使用 **Trae AI** 辅助开发完成。核心架构和关键模块均由Trae协助编写，经我审查修改后集成。Trae在代码生成、Bug修复、架构优化等方面提供了巨大帮助，让我一个人也能完成原本需要团队协作的项目。

## 👨‍💻 作者

**张稷 (Zhang Ji)** — 独立开发者

📧 联系方式: [zhangji200512@outlook.com](mailto:zhangji200512@outlook.com)

如果你觉得这个项目对你有帮助，欢迎给一个 ⭐ Star！

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请考虑 Star 支持！⭐**

Made with ❤️ by 张稷 | Powered by [Trae](https://www.trae.ai/)

*"现有的Office AI太鸡肋了，所以我自己做了一个真正能用的。"*

</div>

# PaperPower — I Built a Real AI Office Assistant Because Existing Ones Suck

<div align="center">

**Local-First · AI-Powered · Full-Scenario Office Intelligence**

[简体中文](./README_zh.md) | English

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3+-3178c6.svg)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://react.dev/)

**Making AI truly understand your office needs — not just chatting, but thinking, deciding, and executing**

</div>

---

## Why I Built This

I'm a university student.

Every time I write project proposals, make PPTs, or organize Excel data, I've tried **every** existing Office AI tool on the market.

**They all suck.**

Here's what they can do: generate a paragraph of text. Then what? You format it yourself, find images yourself, adjust styles yourself, build the table of contents yourself — **the work that actually takes hours? Still all on you.** Sometimes the AI-generated garbage is so bad you spend *even more* time fixing it.

What I wanted was a tool that could:

> Take a Word document + one command → **auto-format everything in seconds** (save those 1-2 hours of formatting)
>
> Write a project proposal → **search images online, screenshot relevant policies, generate reference links**
>
> Make a PPT → not just text generation, but **layout, images, animations, templates** — all done
>
> Analyze Excel data → not just formulas, but **charts, reports, conclusions**

**Existing Office AI tools couldn't do any of this. So I built my own.**

---

## What is PaperPower

**PaperPower (智办AI)** — A local-first, AI-powered full-scenario office intelligence platform.

It's not another ChatGPT wrapper. It's built around **real office workflows**:

### 📝 Word — Write + Format in One Shot

| Existing Office AI | PaperPower |
|:---|:---|
| Only generates text paragraphs | ✅ Complete document generation (7 frameworks: reports, proposals, theses, resumes, business plans...) |
| Format it yourself | ✅ Smart formatting: Word doc + one command = auto-formatted output |
| Find images yourself | ✅ 27-category semantic search, auto-matches topic-relevant images |
| Look up policies yourself | ✅ Auto-references related policies |
| Find links yourself | ✅ Auto-generates reference URLs |

**Core value: Compress 1-2 hours of formatting into seconds.**

### 📊 PPT — From Zero to Done

- 27-category semantic image search with auto-matching
- Smart layout engine (title/content/chart pages auto-planned)
- Animation system + multiple templates
- One sentence description → complete PPT ready to use

### 📈 Excel — Analyze + Visualize

- Smart formula generation
- Data visualization (chart auto-recommendation)
- Financial analysis templates
- One-click pivot tables

### 🤖 AI Chat That Actually "Thinks"

This is PaperPower's core differentiator:

**Four-Personality Decision Engine** — When you send a message, AI doesn't blindly reply. It **thinks first**:

```
User Input → 6-D Classification(task? question? creative?) → 4-Personality Scoring → Best Strategy → Execute
```

| Persona | Scenario | Behavior |
|---------|----------|----------|
| ⚡ Executor | "Format this document for me" | Direct action, fast completion |
| 🎯 Advisor | "I want a PPT but don't know how" | Clarify requirements first |
| 🎨 Creator | "Give me some ideas" | Multiple options to choose from |
| 🔬 Analyst | "Analyze this dataset" | Deep analysis before responding |

**16 decision modes** (4 personalities × 6 domains) — ensuring AI knows when to act vs when to ask.

---

## Product Showcase

### PaperPower Home

<div align="center">
<img src="screenshots/home.png" alt="PaperPower Home" width="800"/>
</div>

> All-in-one AI office platform: Word, Excel, PPT, and AI chat — integrated in one interface.

### AI Smart Chat — Four-Personality Decision Engine

<div align="center">
<img src="screenshots/chat1.png" alt="Send Message to PaperPower 1" width="380"/>
<img src="screenshots/chat2.png" alt="Send Message to PaperPower 2" width="380"/>
</div>

> **Left**: Send instructions, AI identifies intent and executes automatically
> **Right**: AI selects optimal personality strategy based on task type

### Word Intelligent Document Generation

<div align="center">
<img src="screenshots/word.png" alt="Word Auto Generation" width="800"/>
</div>

> Enter a topic → complete document with auto-images, policy references, smart formatting

### PPT & Excel

> Best experienced firsthand! PPT covers layout+images+animations; Excel covers analysis+visualization+reporting.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + TypeScript)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │ MiniAI   │ │ DocGen   │ │ DataLab  │ │ ImageFusion     │ │
│  │ AI Chat  │ │ Documents│ │ Analysis │ │ Image Search     │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────────┘ │
│       └────────────┼────────────┼───────────────┘            │
│                    ▼                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Core Engine Layer                            │  │
│  │  Intent Detection → Quality Gate → Model → 4-Persona   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + Python)                │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ model_server │ │ multi_agent  │ │ image_service      │   │
│  │ Bilingual    │ │ DeerFlow     │ │ 27-Cat Semantic    │   │
│  │ Transformer  │ │ Workflow     │ │ Search             │   │
│  └──────────────┘ └──────────────┘ └────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

> See [SETUP.md](./SETUP.md) for detailed installation guide

### Docker (Recommended)

```bash
git clone https://github.com/DreamLeader-Ji/PaperPower.git
cd PaperPower
cp .env.example .env.local
docker-compose up -d --build

# Frontend: http://localhost:5174
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Manual Install

```bash
pip install -r requirements.txt
npm install

# Terminal 1 - Model server
python model_server.py

# Terminal 2 - Backend API
python -m uvicorn shared.backend.api_server_v2:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3 - Frontend
npm run dev
```

> First run works in demo mode without model weights. Full AI features require trained weights (see SETUP.md).

## Core Modules

### Four-Personality Decision Engine (`src/utils/actionDecisionEngine.ts`)

The "brain" of PaperPower:
1. **TaskClassifier** — 6-D classification (task/question/creative/clarification/urgency/complexity/domain)
2. **ActionDecisionEngine** — Scores all 4 personalities, selects best match
3. **Personality Respond** — Domain-specific professional response per personality

### Intelligent Dialogue Engine (`src/utils/intelligentDialogue.ts`)

- **Intent detection**: 5 intent types (document/data/PPT/image/code/general)
- **Quality gate**: Multi-source scoring (multiAgent > modelService > localTemplate > actionEngine)
- **Garbled text protection**: 5 detection patterns + Tokenizer whitelist + decode validation
- **A/B/C option understanding**: Context-aware single-letter response handling
- **Conversation memory**: 20-message window + recent 6 messages to decision engine

### Semantic Image Search (`src/utils/semanticImageSearch.ts`)

- **27 fine-grained categories** | **200+ domain terms** | **20 query enhancement rules**

### Document Generator (`src/utils/intelligentDocumentGenerator.ts`)

- **7 document frameworks** | **27 content expansion patterns** | LRU cache | Markdown export

### Proprietary BilingualTokenizer (`model_server.py`)

- **150+ Chinese char whitelist** | Output sanitization | Text validity validation | Decode generated tokens only

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + MUI v7 + Zustand + Vite 5 |
| Backend | FastAPI + Python 3.10 + Uvicorn |
| AI Model | Custom Bilingual Transformer (local inference) |
| Office | mammoth + xlsx + pptxgenjs + pdf-lib |
| OCR | Tesseract.js (browser-side) |
| Embeddings | @xenova/transformers (browser-side NLP) |
| Deploy | Docker + Compose |

## Quality Assurance

Self-trained local models have two big problems: **garbled output** and **unstable quality**. My solutions:

- **5 garbled text detection patterns** working together (random chars, mixed encoding, no punctuation, etc.)
- **Tokenizer whitelist** (150+ common Chinese characters filtered)
- **Multi-source scoring degradation chain**: multiAgent → modelService → localTemplate → actionEngine fallback
- **Every layer has fallback** — reliable output even when the model fails

## Performance Metrics

| Metric | Value |
|--------|-------|
| Chinese token efficiency | 1.5-2 tok/char (50%+ better than byte encoding) |
| Response latency | <500ms (local) |
| Garbled text detection | 95%+ accuracy |
| Decision engine dimensions | 6-D TaskClassifier |
| Personality strategies | 16 modes (4 personas × 4 domains) |
| Image search categories | 27 fine-grained semantic categories |
| Document templates | 7 frameworks |

## Project Structure

```
PaperPower/
├── src/                          # Frontend source
│   ├── components/               # React components
│   │   ├── MiniAI.tsx           # AI chat main component
│   │   ├── DocumentEditor.tsx   # Document editor
│   │   ├── DataAnalysis.tsx     # Data analysis panel
│   │   ├── PresentationGen.tsx  # PPT generator
│   │   └── ImageFusion.tsx      # Image fusion tool
│   ├── utils/                    # Core engines
│   │   ├── intelligentDialogue.ts       # Dialogue engine
│   │   ├── actionDecisionEngine.ts      # 4-Personality decision
│   │   ├── semanticImageSearch.ts       # Semantic image search
│   │   └── intelligentDocumentGenerator.ts # Doc generator
│   ├── pages/ / services/ / store/     # Pages, APIs, state
├── shared/backend/               # Python backend
│   ├── api_server_v2.py          # FastAPI main server
│   ├── multi_agent/              # Multi-Agent workflow
│   └── image_service.py          # Image search service
├── model/                        # AI model architecture
├── model_server.py               # Model inference server
├── tokenizer/ / agent/ / scripts/ # Tools & agents
├── tests/ / docs/ / configs/     # Tests, docs, configs
├── Dockerfile / docker-compose.yml
├── SETUP.md                      # Installation guide
└── LICENSE                       # MIT License
```

## Running Tests

```bash
npm test                          # Frontend tests
pytest tests/ -v                  # Backend tests
npm run typecheck                 # TypeScript check
npm run lint                      # ESLint
npm run build                     # Production build
```

## Roadmap

- [x] v0.1 — Basic office suite (Word/Excel/PPT/AI chat)
- [x] v0.2 — 4-personality decision engine + quality gate
- [x] v0.3 — Garbled text protection + enhanced image search
- [ ] v0.4 — Multimodal support (voice input / image understanding)
- [ ] v0.5 — Plugin marketplace + custom agents
- [ ] v1.0 — Enterprise edition + collaboration

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT License](./LICENSE). Copyright (c) 2025 张稷 (Zhang Ji).

## Acknowledgments

### Special Thanks

- **[Trae](https://www.trae.ai/)** — This project was developed with Trae AI assistance. Core architecture and key modules were co-written with Trae, then reviewed and modified by the author. Trae provided tremendous help in code generation, bug fixing, and architecture optimization.

### Technical Thanks

- [React](https://react.dev/) · [MUI](https://mui.com/) · [FastAPI](https://fastapi.tiangolo.com/) · [PyTorch](https://pytorch.org/) · [Vite](https://vitejs.dev/) · [Tesseract.js](https://tesseract.projectnaptha.com/) · [@xenova/transformers](https://github.com/xenova/transformers.js)

## AI Development Methodology (Open Source Contribution)

My core development method — **Dual-Personality Collaborative Development**:

> Act as two personalities working together.
>
> **Personality 1**: Top-tier developer who understands code at a glance, thinks clearly and diversely, immediately switches paths when blocked.
>
> **Personality 2**: Top-tier researcher & reviewer who knows exactly where errors commonly occur, simulates verification rigorously, never misses anything, insists on repeated thinking and refinement.
>
> Both collaborate: Personality 1 writes code → Personality 2 checks & improves → Discuss direction → Continue together. After each completion, both discuss vulnerabilities and innovation points. Repeat until neither can find issues or propose new innovations.

This method ensures AI delivers both efficiency and quality. Feel free to try it!

## Author

**张稷 (Zhang Ji)** — Independent Developer

📧 Contact: [zhangji200512@outlook.com](mailto:zhangji200512@outlook.com)

If you find this project helpful, please give it a ⭐ Star!

---

<div align="center">

**⭐ Star if you find it useful! ⭐**

Made with ❤️ by 张稷 | Powered by [Trae](https://www.trae.ai/)

*"Existing Office AIs are too weak. So I built one that actually works."*

</div>

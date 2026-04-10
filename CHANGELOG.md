# CHANGELOG

All notable changes to 智办AI (PaperPower) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub open source release preparation
- Comprehensive README with architecture diagrams
- MIT License
- Contributing guidelines

## [0.3.0] - 2025-04-10

### Added - 四人格决策引擎 (Four-Personality Decision Engine)
- **TaskClassifier**: 6-dimensional task classification (isTask/isQuestion/isCreative/needsClarification/urgency/complexity/domain)
- **4 Personality Profiles**: Executor⚡, Advisor🎯, Creator🎨, Analyst🔬
- **ActionDecisionEngine**: Multi-personality scoring and selection
- Domain-specific respond methods for each personality (document/data/presentation/image/code/general)
- Conversation history propagation (recent 6 messages → action engine)

### Added - 质量门控系统增强 (Quality Gate Enhancement)
- Source-aware scoring: local template (-0.6) vs model response (-0.3)
- Local template pattern detection with dedicated scoring rule
- Error pattern interception for multi-agent responses (ECONNREFUSED, timeout, etc.)
- Provider availability cache (30s TTL) for Ollama/LocalAI pre-checks

### Added - 乱码防护系统 (Garbled Text Protection)
- 5 garbled text detection patterns:
  - highGarbleRatio (>35% random characters)
  - randomSymbolBurst (consecutive symbols)
  - lowValidCharRatio (<55% valid chars)
  - mixedEncoding detection
  - chineseWithoutPunctuation
- BilingualTokenizer whitelist (150+ common Chinese chars)
- `_sanitize_output()` method for output cleaning
- `is_valid_text()` validation before returning
- Decode-only-generated-tokens fix (avoids input sequence pollution)

### Added - 语义图片搜索增强 (Semantic Image Search)
- Expanded from 8 to **27 fine-grained categories**
- 200+ domain-specific term vocabulary
- 20 query enhancement rules
- Smart loremflickr fallback mechanism

### Added - 智能文档生成器 (Intelligent Document Generator)
- 7 document frameworks (report/proposal/thesis/resume/business plan/etc.)
- 27 content expansion patterns
- LRU cache (capacity 50)
- Markdown export support

### Fixed
- Process indentation error in intelligentDialogue.ts
- Missing isProcessing reset in catch block (prevents UI lockup)
- Panel not auto-closing after navigation
- A/B/C single-letter option not understanding context
- Prompt pollution from conversation history in local model calls
- Generic quickAnswer replaced with category-based answers (AI/coding/business/education)
- Weak document title extraction (now includes year + industry + document type)

### Changed
- MiniAI.tsx complete rewrite (~980 lines) from broken state
- English responses expanded from 1 line to full content for all 4 personalities
- Intent detection now handles single-letter A/B/C/D responses with context awareness

## [0.2.0] - 2025-04-09

### Added
- IntelligentDialogueEngine with intent detection (5 types)
- System prompts for different languages
- Quality assessment system
- Conversation memory (20 message window)
- Multi-tier fallback chain (multiAgent → modelService → localTemplate → actionEngine)

### Fixed
- Catastrophic fragmentation of MiniAI.tsx (30+ incremental edits broke the file)
- 8+ TypeScript errors in original implementation
- Duplicate functions and orphaned code removed

## [0.1.0] - 2025-04-08

### Added
- Initial office suite foundation
- AI chat interface (MiniAI)
- Word document generation
- Excel data analysis
- PPT presentation creation
- Image fusion tool
- Basic bilingual tokenizer
- Model inference server (model_server.py)
- FastAPI backend service
- Docker deployment support

---

## Version Explanation

- **Minor version** (0.x.0): New features or significant changes
- **Patch version** (0.0.x): Bug fixes and minor improvements

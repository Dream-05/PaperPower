# Contributing to 智办AI (PaperPower)

感谢你对智办AI的兴趣！我们欢迎任何形式的贡献。

## 🤝 行为准则

- 尊重所有参与者
- 接受建设性的批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

## 🚀 如何贡献

### 报告Bug

如果你发现了bug，请在GitHub Issues中提交，包含以下信息：

- **Bug描述**: 清晰描述问题
- **复现步骤**: 如何重现这个问题
- **期望行为**: 你期望的正确行为是什么
- **截图**: 如果涉及UI问题，请附上截图
- **环境信息**: 操作系统、Node.js版本、Python版本等

### 建议新功能

我们欢迎功能建议！提交Issue时请包含：

- **用例描述**: 这个功能解决什么问题
- **预期用法**: 你希望如何使用这个功能
- **替代方案**: 你目前是如何解决这个问题的

### 代码贡献

#### 1. 设置开发环境

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/zhiban-ai.git
cd zhiban-ai

# Python环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt

# Node.js环境
npm install
```

#### 2. 分支规范

我们使用以下分支命名约定：

- `feature/xxx` — 新功能
- `fix/xxx` — Bug修复
- `refactor/xxx` — 代码重构
- `docs/xxx` — 文档更新
- `perf/xxx` — 性能优化

#### 3. 代码风格

**TypeScript/JavaScript:**
- 遵循ESLint规则（项目已配置）
- 使用2空格缩进
- 组件使用函数式组件 + Hooks
- Props接口必须定义

**Python:**
- 遵循Black格式化
- 使用Type Hints
- 函数必须有docstring
- 异步操作使用async/await

#### 4. 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type类型:**
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档变更
- `style`: 代码格式（不影响功能）
- `refactor`: 重构（非新功能也不是修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具变更

**示例:**
```
feat(dialogue): add A/B/C option context-aware intent detection

Fix single-letter responses not understanding previous context
by passing recent conversation history to intent detector.

Closes #123
```

#### 5. Pull Request 流程

1. Fork仓库并创建分支
2. 编写代码并确保测试通过
3. 更新相关文档
4. 提交PR，描述清楚改动内容
5. 等待Code Review
6. 根据反馈修改
7. 合并后可删除分支

### PR检查清单

在提交PR前，请确认：

- [ ] 代码遵循项目的代码风格
- [ ] 所有测试通过 (`npm test` 和 `pytest`)
- [ ] TypeScript无类型错误 (`npm run typecheck`)
- [ ] ESLint无警告 (`npm run lint`)
- [ ] 新功能有对应的测试
- [ ] 文档已更新（如适用）
- [ ] Commit messages符合规范

## 🏗️ 项目结构了解

在贡献前，建议先了解核心模块：

| 文件 | 职责 |
|------|------|
| `src/utils/actionDecisionEngine.ts` | 四人格决策引擎 |
| `src/utils/intelligentDialogue.ts` | 对话编排引擎 |
| `src/utils/semanticImageSearch.ts` | 图片语义搜索 |
| `src/utils/intelligentDocumentGenerator.ts` | 文档生成 |
| `src/components/MiniAI.tsx` | AI对话UI |
| `model_server.py` | 模型推理服务 |
| `shared/backend/api_server_v2.py` | FastAPI后端 |

详细架构见 [docs/architecture.md](./docs/architecture.md)

## ❓ 问题？

如果你有任何问题，可以：
- 在GitHub Discussions提问
- 在Issues中提问（标签为`question`）

---

再次感谢你的贡献！🎉

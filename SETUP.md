# 智办AI (PaperPower) 安装部署指南

> **克隆本仓库后，请首先阅读本文档！**

## 系统要求

| 组件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Python | 3.10 | 3.11+ |
| Node.js | 18 | 20+ |
| npm | 9+ | 10+ |
| Git | 2.30+ | 最新版 |
| 内存 | 4GB | 8GB+（训练模式） |
| 磁盘 | 2GB可用 | 5GB+（含模型权重） |

## 快速开始（5分钟体验）

### 方式一：Docker 一键启动（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/YOUR_USERNAME/zhiban-ai.git
cd zhiban-ai

# 2. 复制环境变量配置
cp .env.example .env.local

# 3. Docker Compose 启动（前端 + 后端）
docker-compose up -d --build

# 4. 访问
# 前端界面: http://localhost:5174
# 后端API:   http://localhost:8000
# API文档:   http://localhost:8000/docs
```

### 方式二：手动安装

```bash
# ===== 第1步：克隆仓库 =====
git clone https://github.com/YOUR_USERNAME/zhiban-ai.git
cd zhiban-ai

# ===== 第2步：Python后端环境 =====
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt

# ===== 第3步：Node.js前端环境 =====
npm install

# ===== 第4步：初始化数据目录 =====
# 创建运行时需要的目录结构
mkdir -p data/memory data/learning data/cache data/users data/tasks logs

# ===== 第5步：启动服务 =====

# 终端1 - 启动模型服务
python model_server.py

# 终端2 - 启动后端API
python -m uvicorn shared.backend.api_server_v2:app --host 0.0.0.0 --port 8000 --reload

# 终端3 - 启动前端开发服务器
npm run dev
```

**Windows用户一键启动脚本：**
```bash
start.bat
```

## 关于模型权重的重要说明 ⚠️

### 演示模式（无需额外下载）

本项目**开箱即可运行演示模式**。当系统检测不到预训练模型权重时，会自动使用随机初始化：

```
未找到预训练权重，使用随机初始化（演示模式）
```

演示模式下：
- ✅ 所有UI功能正常（文档编辑、PPT制作、数据分析、图片搜索）
- ✅ 四人格决策引擎正常工作
- ✅ 质量门控和乱码检测正常
- ⚠️ AI对话输出为随机文本（用于测试系统架构）

### 完整模式（需要模型权重）

要获得真正的AI智能对话能力，你需要模型权重文件：

#### 选项A：自行训练

```bash
# 使用项目自带的训练脚本
python scripts/prepare_training_data.py
python train.py --config configs/bilingual_base.yaml
```

训练完成后，权重会保存在 `output/training/final_model/` 目录。

#### 选项B：下载预训练权重

如果作者提供了预训练权重下载链接，可放置到：
```
output/training/final_model/
├── config.json          # 模型配置（仓库中已包含）
└── pytorch_model.bin    # 模型权重（需下载）
```

## 功能模块说明

| 模块 | 入口 | 说明 | 是否需要模型权重 |
|------|------|------|------------------|
| **AI智能对话** | http://localhost:5174 (MiniAI) | 四人格决策引擎 + 对话系统 | 完整模式需要 |
| **Word文档** | WordEditor 页面 | 文档生成与编辑 | 不需要 |
| **Excel分析** | ExcelEditor 页面 | 数据分析与图表 | 不需要 |
| **PPT制作** | PPTGenerator 页面 | 智能PPT生成 | 不需要 |
| **图片搜索** | ImageFusion 页面 | 语义图片搜索 | 不需要 |

## 常见问题

### Q: 安装依赖时报错？

**Python依赖问题：**
```bash
# 如果遇到编译错误，尝试：
pip install --only-binary :all: -r requirements.txt

# 或逐个安装缺失的包
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install fastapi uvicorn pydantic
```

**Node.js依赖问题：**
```bash
# 清除缓存重试
rm -rf node_modules package-lock.json
npm install
```

### Q: 前端页面空白？

```bash
# 确认前端开发服务器正在运行
npm run dev

# 默认地址是 http://localhost:5174（不是5173！）
```

### Q: 后端API连接失败？

```bash
# 1. 确认后端服务已启动
curl http://localhost:8000/health

# 2. 检查端口是否被占用
netstat -ano | findstr :8000

# 3. 查看.env.local中的API配置
cat .env.local | grep API_PORT
```

### Q: AI回复乱码？

这是已知问题，系统已内置多层防护：
1. BilingualTokenizer 白名单过滤
2. 乱码检测自动拦截
3. 质量门控降级回退

如果仍出现乱码，请检查：
- 模型权重是否正确加载
- 是否使用了正确的config.json

### Q: 如何切换语言？

前端界面支持中英文切换，在页面右上角找到语言切换按钮。

## 项目目录结构说明

```
zhiban-ai/
├── src/                      # 前端源码 (React + TypeScript)
│   ├── components/           # UI组件
│   │   ├── MiniAI.tsx       # AI对话主组件
│   │   ├── WordEditor.tsx    # 文档编辑器
│   │   ├── ExcelEditor.tsx   # 电子表格
│   │   ├── PPTGenerator.tsx  # PPT生成器
│   │   └── ImageFusion.tsx   # 图片融合
│   ├── utils/                # 核心引擎
│   │   ├── actionDecisionEngine.ts    # 四人格决策引擎
│   │   ├── intelligentDialogue.ts     # 对话编排引擎
│   │   ├── semanticImageSearch.ts     # 图片搜索
│   │   └── intelligentDocumentGenerator.ts  # 文档生成
│   └── pages/                # 页面路由
├── shared/backend/            # Python后端
│   ├── api_server_v2.py      # FastAPI主服务
│   ├── image_service.py      # 图片搜索服务
│   └── multi_agent/          # 多Agent工作流
├── model/                     # AI模型架构代码
│   └── bilingual_transformer.py  # 双语Transformer
├── model_server.py            # 模型推理服务 ⭐
├── tokenizer/                 # 分词器实现
├── agent/                     # 双语Agent
├── scripts/                   # 工具脚本
├── tests/                     # 测试套件
├── docs/                      # 详细文档
├── configs/                   # 训练配置
├── output/                    # 训练输出（含config.json）
├── Dockerfile                 # Docker构建
├── docker-compose.yml         # 编排配置
├── package.json               # Node.js依赖
├── requirements.txt           # Python依赖
├── .env.example               # 环境变量模板
└── start.bat                  # Windows一键启动
```

## 开发者指南

### 运行测试
```bash
# 前端测试
npm test

# Python后端测试
pytest tests/ -v

# 类型检查
npm run typecheck

# 代码规范
npm run lint
```

### 构建生产版本
```bash
npm run build
# 输出目录: dist/
```

## 技术支持

- 📧 Email: zhangji200512@outlook.com
- 🐛 Issues: [GitHub Issues](https://github.com/YOUR_USERNAME/zhiban-ai/issues)

---

**祝你使用愉快！如有问题欢迎提Issue或邮件联系。**

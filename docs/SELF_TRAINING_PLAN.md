# 智办AI 自研大模型完整实施方案

## 一、项目目标

训练一个具备以下能力的自研大语言模型：
- **思考能力**：理解、推理、分析问题
- **操作能力**：调用工具、执行任务、操作Office文档
- **双语能力**：中英文无缝切换

---

## 二、核心问题诊断

### 当前问题
| 问题 | 现状 | 目标 |
|------|------|------|
| 训练数据 | 22条样本 | 100GB+ (约10亿tokens) |
| 模型规模 | 1.5亿参数 | 7亿-70亿参数 |
| 训练阶段 | 仅预训练 | 预训练→SFT→DPO |
| 工具能力 | 无 | Function Calling训练 |

---

## 三、数据准备方案

### 阶段1：预训练数据（目标：100GB+）

#### 3.1.1 开源数据集下载

```python
# scripts/download_pretrain_data.py

from datasets import load_dataset
import json
from pathlib import Path

def download_pretrain_data():
    """下载开源预训练数据"""
    
    datasets_config = {
        # 中文数据
        "chinese": [
            ("shibing624/medical", "medical_zh", 5),  # 医疗
            ("BELLE-2/Belle-1M", None, 10),  # 通用中文
            ("FreedomIntelligence/Huatuo26M-Lite", None, 5),  # 医疗问答
        ],
        # 英文数据
        "english": [
            ("wikipedia", "20220301.en", 20),  # 维基百科
            ("bookcorpus", None, 15),  # 书籍
            ("openwebtext", None, 20),  # 网页文本
        ],
        # 代码数据
        "code": [
            ("codeparrot/github-code", None, 10),  # GitHub代码
            ("bigcode/the-stack", None, 10),  # 代码栈
        ],
    }
    
    output_dir = Path("data/pretrain")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for lang, datasets in datasets_config.items():
        for dataset_name, subset, size_gb in datasets:
            print(f"Downloading {dataset_name}...")
            try:
                if subset:
                    ds = load_dataset(dataset_name, subset, split="train")
                else:
                    ds = load_dataset(dataset_name, split="train")
                
                output_file = output_dir / f"{dataset_name.replace('/', '_')}.jsonl"
                with open(output_file, 'w', encoding='utf-8') as f:
                    for item in ds:
                        text = item.get('text', '') or item.get('content', '')
                        if text:
                            f.write(json.dumps({'text': text}, ensure_ascii=False) + '\n')
            except Exception as e:
                print(f"Failed to download {dataset_name}: {e}")

if __name__ == "__main__":
    download_pretrain_data()
```

#### 3.1.2 本地数据收集

```
数据来源建议：
├── 网络爬虫
│   ├── 中文：知乎、百度百科、新闻网站
│   ├── 英文：Wikipedia、新闻网站、技术博客
│   └── 工具：scrapy、newspaper3k
│
├── 公开文档
│   ├── 政府公开文件
│   ├── 技术文档
│   ├── 教材教辅
│   └── 专业论文
│
└── 合成数据
    ├── 使用GPT-4生成问答对
    ├── 扩展现有数据
    └── 数据增强
```

### 阶段2：指令微调数据（目标：10万+条）

#### 3.2.1 指令数据格式

```json
// data/instruction/office_tasks.jsonl
{
  "instruction": "帮我创建一个关于人工智能的PPT",
  "input": "主题：人工智能在医疗领域的应用\n要求：10页，包含图表",
  "output": "好的，我将为您创建一个关于人工智能在医疗领域应用的PPT。\n\n## PPT结构规划\n\n1. 封面页：人工智能在医疗领域的应用\n2. 目录页\n3. AI医疗概述\n4. 医学影像诊断\n5. 药物研发\n6. 个性化治疗\n7. 医疗机器人\n8. 数据分析图表\n9. 未来展望\n10. 总结\n\n[执行创建PPT操作...]"
}

// data/instruction/excel_tasks.jsonl
{
  "instruction": "分析这个Excel表格的数据",
  "input": "表格包含销售数据：日期、产品、销售额、地区",
  "output": "我将为您分析这份销售数据。\n\n## 分析步骤\n\n1. 数据概览\n2. 趋势分析\n3. 地区对比\n4. 产品排名\n\n[执行数据分析操作...]"
}
```

#### 3.2.2 指令数据生成脚本

```python
# scripts/generate_instruction_data.py

import json
from pathlib import Path

INSTRUCTION_TEMPLATES = {
    "ppt_generation": [
        "帮我创建一个关于{topic}的PPT",
        "请生成一份{topic}的演示文稿",
        "我需要一个关于{topic}的幻灯片",
    ],
    "excel_analysis": [
        "分析这个Excel表格中的{data_type}数据",
        "请帮我处理这份{data_type}报表",
        "对这份{data_type}数据进行统计分析",
    ],
    "word_editing": [
        "帮我写一篇关于{topic}的文章",
        "请编辑这份文档，{action}",
        "将这段文字{action}",
    ],
    "tool_calling": [
        "使用{tool}来{action}",
        "调用{tool}完成{action}",
        "请{action}，使用{tool}",
    ],
}

def generate_office_instructions():
    """生成Office相关指令数据"""
    
    topics = [
        "人工智能", "机器学习", "深度学习", "数据分析",
        "项目管理", "市场营销", "财务报告", "产品介绍",
    ]
    
    data_types = ["销售", "财务", "用户", "库存", "生产"]
    
    actions = ["格式化", "总结要点", "翻译成英文", "扩展内容", "精简文字"]
    
    tools = ["搜索工具", "图表生成器", "数据分析模块", "模板库"]
    
    instructions = []
    
    # PPT指令
    for template in INSTRUCTION_TEMPLATES["ppt_generation"]:
        for topic in topics:
            instructions.append({
                "instruction": template.format(topic=topic),
                "input": "",
                "output": f"好的，我将为您创建关于{topic}的PPT。[调用PPT生成工具]",
                "task_type": "ppt_generation",
                "tools_required": ["ppt_generator"],
            })
    
    # Excel指令
    for template in INSTRUCTION_TEMPLATES["excel_analysis"]:
        for data_type in data_types:
            instructions.append({
                "instruction": template.format(data_type=data_type),
                "input": f"表格包含{data_type}数据",
                "output": f"我将分析这份{data_type}数据。[调用数据分析工具]",
                "task_type": "excel_analysis",
                "tools_required": ["excel_analyzer"],
            })
    
    # 工具调用指令
    for template in INSTRUCTION_TEMPLATES["tool_calling"]:
        for tool in tools:
            for action in ["分析数据", "生成报告", "创建图表"]:
                instructions.append({
                    "instruction": template.format(tool=tool, action=action),
                    "input": "",
                    "output": f"好的，我将使用{tool}来{action}。[调用{tool}]",
                    "task_type": "tool_calling",
                    "tools_required": [tool],
                })
    
    return instructions

def generate_thinking_data():
    """生成思维链训练数据"""
    
    thinking_examples = [
        {
            "instruction": "分析这个问题并给出解决方案",
            "input": "公司销售额连续三个季度下降，需要找出原因并制定对策",
            "output": """让我一步步分析这个问题：

## 思考过程

### 第一步：分析可能的原因
1. 市场因素：竞争对手、市场饱和度、经济环境
2. 产品因素：产品质量、定价策略、产品线老化
3. 销售因素：销售团队、渠道、营销策略
4. 客户因素：客户流失、需求变化

### 第二步：数据验证
需要收集以下数据进行验证：
- 竞争对手销售数据
- 客户流失率
- 产品退货率
- 销售渠道效率

### 第三步：制定对策
基于分析结果，建议：
1. 短期：优化营销策略，提升转化率
2. 中期：产品升级，满足新需求
3. 长期：开拓新市场，多元化发展

## 结论
建议从市场调研开始，收集数据验证假设，然后针对性制定策略。"""
        },
        {
            "instruction": "设计一个解决方案",
            "input": "用户反馈系统响应速度慢",
            "output": """让我分析这个性能问题：

## 思考过程

### 第一步：定位问题
系统响应慢可能的原因：
1. 数据库查询效率低
2. 网络延迟
3. 服务器资源不足
4. 代码逻辑问题

### 第二步：分析方案
针对每个原因的解决方案：
- 数据库：添加索引、优化查询、引入缓存
- 网络：CDN加速、减少请求次数
- 服务器：扩容、负载均衡
- 代码：性能优化、异步处理

### 第三步：优先级排序
1. 立即：添加缓存（效果明显，成本低）
2. 短期：数据库优化
3. 中期：代码重构
4. 长期：架构升级

## 建议方案
优先实施缓存方案，预计可提升50%响应速度。"""
        },
    ]
    
    return thinking_examples

if __name__ == "__main__":
    output_dir = Path("data/instruction")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 生成Office指令
    office_data = generate_office_instructions()
    with open(output_dir / "office_tasks.jsonl", 'w', encoding='utf-8') as f:
        for item in office_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    print(f"Generated {len(office_data)} office instructions")
    
    # 生成思维链数据
    thinking_data = generate_thinking_data()
    with open(output_dir / "thinking_chain.jsonl", 'w', encoding='utf-8') as f:
        for item in thinking_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    print(f"Generated {len(thinking_data)} thinking examples")
```

### 阶段3：偏好对齐数据（目标：1万+条）

```python
# scripts/generate_preference_data.py

import json
from pathlib import Path

def generate_preference_pairs():
    """生成偏好对比数据（用于DPO训练）"""
    
    preference_data = [
        {
            "prompt": "帮我创建一个PPT",
            "chosen": "好的，我来帮您创建PPT。请问您希望PPT的主题是什么？需要多少页？有什么特殊要求吗？",
            "rejected": "好的。",  # 太简短，不好
        },
        {
            "prompt": "分析这份数据",
            "chosen": """我将为您进行数据分析：

1. 首先查看数据结构和基本统计信息
2. 识别关键指标和趋势
3. 生成可视化图表
4. 提供分析结论和建议

请上传您的数据文件，我将开始分析。""",
            "rejected": "请把数据发给我。",
        },
        {
            "prompt": "这个Excel公式怎么写？",
            "chosen": """这个需求可以使用以下公式实现：

```excel
=SUMIF(A:A, "条件", B:B)
```

这个公式的作用是：
- 在A列中查找满足条件的单元格
- 对对应的B列值求和

如果您需要更复杂的条件，可以使用：
```excel
=SUMIFS(B:B, A:A, "条件1", C:C, "条件2")
```

请问这是您需要的功能吗？""",
            "rejected": "用SUMIF函数。",
        },
    ]
    
    return preference_data

if __name__ == "__main__":
    output_dir = Path("data/preference")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    data = generate_preference_pairs()
    with open(output_dir / "dpo_data.jsonl", 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    print(f"Generated {len(data)} preference pairs")
```

---

## 四、模型架构优化

### 4.1 推荐配置：7B模型

```python
# configs/bilingual_7b_optimized.yaml

model:
  name: "zhiban-7b"
  vocab_size: 50000
  hidden_size: 4096
  num_hidden_layers: 32
  num_attention_heads: 32
  intermediate_size: 11008
  max_position_embeddings: 8192
  
  # 位置编码
  rope_theta: 10000.0
  rope_scaling:
    type: "linear"
    factor: 4.0
  
  # 正则化
  hidden_dropout: 0.1
  attention_dropout: 0.1
  layer_norm_eps: 1.0e-6
  
  # 优化选项
  use_flash_attention: true
  gradient_checkpointing: true
  use_language_adapters: true
  
  # 特殊配置
  chinese_char_vocab_size: 8000
  use_cache: true

# 计算参数量
# hidden_size * num_layers * 12 ≈ 4096 * 32 * 12 ≈ 1.57B
# 加上embedding和其他参数，总计约7B
```

### 4.2 添加关键模块

```python
# model/enhanced_modules.py

import torch
import torch.nn as nn
import torch.nn.functional as F

class ToolCallingHead(nn.Module):
    """工具调用预测头"""
    
    def __init__(self, hidden_size: int, num_tools: int = 20):
        super().__init__()
        self.tool_classifier = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.GELU(),
            nn.Linear(hidden_size // 2, num_tools),
        )
        
        self.argument_extractor = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.GELU(),
            nn.Linear(hidden_size, hidden_size),
        )
    
    def forward(self, hidden_states: torch.Tensor):
        tool_logits = self.tool_classifier(hidden_states[:, -1, :])
        arguments = self.argument_extractor(hidden_states)
        return tool_logits, arguments


class ThinkingModule(nn.Module):
    """思维链增强模块"""
    
    def __init__(self, hidden_size: int):
        super().__init__()
        self.thought_proj = nn.Linear(hidden_size, hidden_size)
        self.reasoning_gate = nn.Linear(hidden_size, 1)
    
    def forward(self, hidden_states: torch.Tensor):
        thought = F.gelu(self.thought_proj(hidden_states))
        gate = torch.sigmoid(self.reasoning_gate(hidden_states))
        return hidden_states + gate * thought


class EnhancedBilingualTransformer(nn.Module):
    """增强版双语Transformer"""
    
    def __init__(self, config):
        super().__init__()
        
        # 基础Transformer
        from model.bilingual_transformer import BilingualTransformer
        self.base_model = BilingualTransformer(config)
        
        # 工具调用头
        self.tool_head = ToolCallingHead(config.hidden_size)
        
        # 思维模块
        self.thinking_module = ThinkingModule(config.hidden_size)
    
    def forward(self, input_ids, **kwargs):
        outputs = self.base_model(input_ids, **kwargs)
        
        # 增强处理
        hidden_states = outputs['hidden_states']
        hidden_states = self.thinking_module(hidden_states)
        
        # 工具调用预测
        tool_logits, arguments = self.tool_head(hidden_states)
        
        outputs['tool_logits'] = tool_logits
        outputs['arguments'] = arguments
        
        return outputs
```

---

## 五、完整训练流程

### 5.1 训练阶段概览

```
完整训练流程：

阶段1: 大规模预训练
├── 数据: 100GB+ 文本数据
├── 步数: 300,000 steps
├── 学习率: 1e-4
├── 目标: 学习语言模式和世界知识
└── 预计时间: 2-4周 (多GPU)

阶段2: 指令微调 (SFT)
├── 数据: 10万+ 指令对
├── 步数: 20,000 steps
├── 学习率: 5e-5
├── 方法: LoRA微调
└── 预计时间: 3-5天

阶段3: 偏好对齐 (DPO)
├── 数据: 1万+ 偏好对
├── 步数: 10,000 steps
├── 学习率: 1e-5
└── 预计时间: 1-2天

阶段4: 工具调用训练
├── 数据: 5万+ 工具调用样本
├── 步数: 10,000 steps
└── 预计时间: 1-2天
```

### 5.2 训练脚本

```python
# train_full_pipeline.py

import os
import torch
from pathlib import Path
from datasets import load_dataset
from transformers import TrainingArguments

from model.bilingual_transformer import BilingualTransformer, ModelConfig
from tokenizer.international_tokenizer import MultilingualBPETokenizer
from train.unified_trainer import BilingualTrainer, TrainingConfig

def stage1_pretrain():
    """阶段1: 大规模预训练"""
    print("=" * 60)
    print("Stage 1: Large-scale Pretraining")
    print("=" * 60)
    
    config = TrainingConfig(
        output_dir="output/pretrain",
        max_steps=300000,
        batch_size=8,
        gradient_accumulation_steps=16,
        learning_rate=1e-4,
        warmup_steps=10000,
        use_amp=True,
        amp_dtype="bf16",
    )
    
    # 加载预训练数据
    pretrain_data = load_dataset(
        "json",
        data_files="data/pretrain/*.jsonl",
        split="train"
    )
    
    trainer = BilingualTrainer(config)
    trainer.train(pretrain_data)
    
    trainer.save_checkpoint("pretrain_final")
    print("Stage 1 completed!")


def stage2_sft():
    """阶段2: 指令微调"""
    print("=" * 60)
    print("Stage 2: Supervised Fine-tuning (SFT)")
    print("=" * 60)
    
    config = TrainingConfig(
        output_dir="output/sft",
        max_steps=20000,
        batch_size=16,
        gradient_accumulation_steps=4,
        learning_rate=5e-5,
        warmup_steps=1000,
        lora_config=LoRAConfig(enabled=True, rank=256, alpha=512),
    )
    
    # 加载指令数据
    instruction_data = load_dataset(
        "json",
        data_files="data/instruction/*.jsonl",
        split="train"
    )
    
    # 加载预训练模型
    model = BilingualTransformer.load_pretrained("output/pretrain/pretrain_final")
    
    trainer = BilingualTrainer(config, model=model)
    trainer.train(instruction_data)
    
    trainer.save_checkpoint("sft_final")
    print("Stage 2 completed!")


def stage3_dpo():
    """阶段3: DPO对齐"""
    print("=" * 60)
    print("Stage 3: Direct Preference Optimization (DPO)")
    print("=" * 60)
    
    from train.dpo_trainer import DPOTrainer
    
    config = TrainingConfig(
        output_dir="output/dpo",
        max_steps=10000,
        batch_size=8,
        learning_rate=1e-5,
    )
    
    # 加载偏好数据
    preference_data = load_dataset(
        "json",
        data_files="data/preference/*.jsonl",
        split="train"
    )
    
    # 加载SFT模型
    model = BilingualTransformer.load_pretrained("output/sft/sft_final")
    
    trainer = DPOTrainer(config, model=model)
    trainer.train(preference_data)
    
    trainer.save_checkpoint("dpo_final")
    print("Stage 3 completed!")


def stage4_tool_training():
    """阶段4: 工具调用训练"""
    print("=" * 60)
    print("Stage 4: Tool Calling Training")
    print("=" * 60)
    
    from train.tool_trainer import ToolCallingTrainer
    
    config = TrainingConfig(
        output_dir="output/tool",
        max_steps=10000,
        batch_size=16,
        learning_rate=5e-5,
    )
    
    # 加载工具调用数据
    tool_data = load_dataset(
        "json",
        data_files="data/tool_calling/*.jsonl",
        split="train"
    )
    
    # 加载DPO模型
    model = BilingualTransformer.load_pretrained("output/dpo/dpo_final")
    
    trainer = ToolCallingTrainer(config, model=model)
    trainer.train(tool_data)
    
    trainer.save_checkpoint("final_model")
    print("Stage 4 completed!")
    print("Training pipeline finished!")


def main():
    """执行完整训练流程"""
    
    # 检查数据
    required_dirs = [
        "data/pretrain",
        "data/instruction",
        "data/preference",
        "data/tool_calling",
    ]
    
    for dir_path in required_dirs:
        if not Path(dir_path).exists():
            print(f"Warning: {dir_path} not found, creating...")
            Path(dir_path).mkdir(parents=True, exist_ok=True)
    
    # 执行训练阶段
    stage1_pretrain()
    stage2_sft()
    stage3_dpo()
    stage4_tool_training()


if __name__ == "__main__":
    main()
```

---

## 六、硬件需求与优化

### 6.1 硬件需求

| 模型规模 | GPU需求 | 显存需求 | 训练时间 |
|----------|---------|----------|----------|
| 7B | 4x A100 80GB | 320GB+ | 2-4周 |
| 7B | 8x RTX 4090 | 192GB | 3-5周 |
| 3B | 2x A100 80GB | 160GB | 1-2周 |
| 1.5B | 1x A100 80GB | 80GB | 1周 |

### 6.2 成本优化策略

```python
# 降低成本的优化策略

optimization_strategies = {
    "梯度检查点": {
        "效果": "减少70%显存",
        "代价": "训练速度降低20%",
    },
    "混合精度训练": {
        "效果": "减少50%显存",
        "代价": "可能影响精度",
    },
    "LoRA微调": {
        "效果": "减少90%可训练参数",
        "代价": "可能影响性能上限",
    },
    "DeepSpeed ZeRO-3": {
        "效果": "支持更大模型",
        "代价": "通信开销增加",
    },
    "量化训练 (QLoRA)": {
        "效果": "4-bit量化，大幅减少显存",
        "代价": "精度略有下降",
    },
}
```

---

## 七、实施时间表

```
第1-2周: 数据准备
├── 下载开源数据集
├── 爬取网络数据
├── 生成指令数据
└── 数据清洗和预处理

第3-6周: 预训练
├── 配置训练环境
├── 开始大规模预训练
├── 监控训练进度
└── 保存检查点

第7周: 指令微调
├── 准备指令数据
├── LoRA微调
└── 评估效果

第8周: 对齐和工具训练
├── DPO训练
├── 工具调用训练
└── 最终评估

第9周: 测试和优化
├── 功能测试
├── 性能优化
└── 部署准备
```

---

## 八、快速启动指南

### 第一步：准备数据

```bash
# 创建数据目录
mkdir -p data/pretrain data/instruction data/preference data/tool_calling

# 下载数据（需要时间）
python scripts/download_pretrain_data.py

# 生成指令数据
python scripts/generate_instruction_data.py

# 生成偏好数据
python scripts/generate_preference_data.py
```

### 第二步：配置环境

```bash
# 安装依赖
pip install torch transformers datasets accelerate deepspeed

# 配置DeepSpeed（如果使用）
# 参考 configs/deepspeed_zero2.json
```

### 第三步：开始训练

```bash
# 完整训练流程
python train_full_pipeline.py

# 或者分阶段训练
python train_full_pipeline.py --stage 1  # 仅预训练
python train_full_pipeline.py --stage 2  # 仅SFT
```

---

## 九、预期效果

训练完成后，模型应具备：

1. **语言理解**：理解中英文指令
2. **推理能力**：能够进行简单推理
3. **工具调用**：识别并调用Office工具
4. **任务执行**：完成PPT/Excel/Word相关任务

---

## 十、下一步行动

1. [ ] 确认硬件资源
2. [ ] 开始数据收集
3. [ ] 配置训练环境
4. [ ] 启动预训练
5. [ ] 监控和调整

---

*文档版本: 1.0*
*创建日期: 2026-03-21*

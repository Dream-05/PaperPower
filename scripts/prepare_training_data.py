#!/usr/bin/env python3
"""
数据收集与准备脚本
收集开源数据集用于预训练
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def create_sample_pretrain_data():
    """创建示例预训练数据（用于测试）"""
    
    output_dir = Path("data/pretrain")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    sample_texts = []
    
    topics = [
        ("人工智能", "artificial_intelligence", 100),
        ("机器学习", "machine_learning", 100),
        ("深度学习", "deep_learning", 100),
        ("自然语言处理", "nlp", 100),
        ("计算机视觉", "computer_vision", 100),
        ("数据科学", "data_science", 100),
        ("软件工程", "software_engineering", 100),
        ("云计算", "cloud_computing", 100),
    ]
    
    zh_templates = [
        "{topic}是计算机科学的重要分支，它研究如何让计算机模拟人类智能。{topic}的发展经历了多个阶段，从早期的符号主义到现在的深度学习方法。目前，{topic}已经在医疗、金融、教育等领域得到广泛应用。",
        "在{topic}领域，研究人员致力于解决各种复杂问题。通过算法和模型的不断优化，{topic}技术取得了显著进展。未来，{topic}将继续推动科技创新和产业变革。",
        "{topic}的核心在于数据处理和模式识别。通过分析大量数据，{topic}系统能够学习并做出智能决策。这种能力使得{topic}成为现代科技发展的重要驱动力。",
        "随着计算能力的提升，{topic}技术得到了快速发展。深度神经网络、强化学习等方法在{topic}中发挥着重要作用。这些技术的突破为{topic}的应用开辟了新的可能性。",
        "{topic}的应用场景非常广泛，包括图像识别、语音处理、自然语言理解等。这些应用正在改变人们的生活方式，提高工作效率，创造新的商业价值。",
    ]
    
    en_templates = [
        "{topic} is a crucial branch of computer science that studies how to make computers simulate human intelligence. The development of {topic} has gone through multiple stages, from early symbolism to current deep learning methods. Currently, {topic} has been widely applied in healthcare, finance, education, and other fields.",
        "In the field of {topic}, researchers are dedicated to solving various complex problems. Through continuous optimization of algorithms and models, {topic} technology has made significant progress. In the future, {topic} will continue to drive technological innovation and industrial transformation.",
        "The core of {topic} lies in data processing and pattern recognition. By analyzing large amounts of data, {topic} systems can learn and make intelligent decisions. This capability makes {topic} an important driving force for modern technological development.",
        "With the improvement of computing power, {topic} technology has developed rapidly. Methods such as deep neural networks and reinforcement learning play important roles in {topic}. Breakthroughs in these technologies have opened up new possibilities for {topic} applications.",
        "{topic} has a wide range of application scenarios, including image recognition, speech processing, and natural language understanding. These applications are changing people's lifestyles, improving work efficiency, and creating new business value.",
    ]
    
    for zh_topic, en_topic, count in topics:
        for i in range(count):
            zh_text = zh_templates[i % len(zh_templates)].format(topic=zh_topic)
            en_text = en_templates[i % len(en_templates)].format(topic=en_topic.replace("_", " ").title())
            
            sample_texts.append({"text": zh_text, "language": "zh"})
            sample_texts.append({"text": en_text, "language": "en"})
    
    output_file = output_dir / "sample_pretrain.jsonl"
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in sample_texts:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    logger.info(f"Created {len(sample_texts)} pretrain samples in {output_file}")
    return output_file


def create_instruction_data():
    """创建指令微调数据"""
    
    output_dir = Path("data/instruction")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    instructions = []
    
    office_tasks = [
        {
            "instruction": "帮我创建一个关于人工智能的PPT",
            "input": "主题：人工智能在医疗领域的应用\n要求：10页，包含图表",
            "output": "好的，我将为您创建一个关于人工智能在医疗领域应用的PPT。\n\n## PPT结构规划\n\n1. 封面页：人工智能在医疗领域的应用\n2. 目录页\n3. AI医疗概述\n4. 医学影像诊断\n5. 药物研发\n6. 个性化治疗\n7. 医疗机器人\n8. 数据分析图表\n9. 未来展望\n10. 总结\n\n现在开始创建PPT..."
        },
        {
            "instruction": "分析这个Excel表格的数据",
            "input": "表格包含销售数据：日期、产品、销售额、地区",
            "output": "我将为您分析这份销售数据。\n\n## 分析步骤\n\n1. **数据概览**\n   - 总记录数：统计行数\n   - 时间范围：确定日期范围\n   - 产品种类：统计不同产品\n\n2. **趋势分析**\n   - 销售额随时间变化\n   - 各产品销售占比\n\n3. **地区对比**\n   - 各地区销售额排名\n   - 地区增长趋势\n\n现在开始数据分析..."
        },
        {
            "instruction": "帮我写一篇关于机器学习的文章",
            "input": "要求：800字左右，面向初学者",
            "output": "好的，我来为您撰写一篇面向初学者的机器学习文章。\n\n# 机器学习入门指南\n\n## 什么是机器学习？\n\n机器学习是人工智能的一个重要分支，它让计算机能够从数据中学习，而不需要明确编程。简单来说，机器学习就是让计算机像人类一样，通过经验来改进自己的表现。\n\n## 机器学习的类型\n\n### 1. 监督学习\n监督学习就像老师教学生一样，我们给计算机提供带有标签的数据...\n\n### 2. 无监督学习\n无监督学习则是让计算机自己发现数据中的模式...\n\n### 3. 强化学习\n强化学习通过奖励和惩罚来训练模型...\n\n## 机器学习的应用\n\n机器学习已经渗透到我们生活的方方面面...\n\n## 如何开始学习\n\n1. 学习Python编程\n2. 了解基础数学知识\n3. 实践项目\n\n文章已完成，共约800字。"
        },
        {
            "instruction": "Create a presentation about cloud computing",
            "input": "Topic: Cloud Computing Benefits\nSlides: 8",
            "output": "I'll create a presentation about cloud computing benefits for you.\n\n## Presentation Outline\n\n1. **Title Slide**: Cloud Computing Benefits\n2. **Introduction**: What is Cloud Computing?\n3. **Cost Efficiency**: Reduce IT infrastructure costs\n4. **Scalability**: Scale resources up or down as needed\n5. **Accessibility**: Access from anywhere, anytime\n6. **Security**: Enterprise-grade security features\n7. **Collaboration**: Enhanced team collaboration\n8. **Conclusion**: Key takeaways\n\nCreating the presentation now..."
        },
        {
            "instruction": "帮我格式化这段文字",
            "input": "人工智能是计算机科学的一个分支它企图了解智能的实质并生产出一种新的能以人类智能相似的方式做出反应的智能机器",
            "output": "好的，我来帮您格式化这段文字。\n\n**格式化后的文字：**\n\n人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。\n\n**修改说明：**\n1. 添加了逗号分隔长句\n2. 改善了句子结构\n3. 提高了可读性"
        },
    ]
    
    thinking_tasks = [
        {
            "instruction": "分析这个问题并给出解决方案",
            "input": "公司销售额连续三个季度下降，需要找出原因并制定对策",
            "output": """让我一步步分析这个问题：

## 思考过程

### 第一步：分析可能的原因
1. **市场因素**：竞争对手、市场饱和度、经济环境
2. **产品因素**：产品质量、定价策略、产品线老化
3. **销售因素**：销售团队、渠道、营销策略
4. **客户因素**：客户流失、需求变化

### 第二步：数据验证
需要收集以下数据进行验证：
- 竞争对手销售数据
- 客户流失率
- 产品退货率
- 销售渠道效率

### 第三步：制定对策
基于分析结果，建议：
1. **短期**：优化营销策略，提升转化率
2. **中期**：产品升级，满足新需求
3. **长期**：开拓新市场，多元化发展

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
- **数据库**：添加索引、优化查询、引入缓存
- **网络**：CDN加速、减少请求次数
- **服务器**：扩容、负载均衡
- **代码**：性能优化、异步处理

### 第三步：优先级排序
1. **立即**：添加缓存（效果明显，成本低）
2. **短期**：数据库优化
3. **中期**：代码重构
4. **长期**：架构升级

## 建议方案
优先实施缓存方案，预计可提升50%响应速度。"""
        },
    ]
    
    tool_calling_tasks = [
        {
            "instruction": "使用搜索工具查找最新的AI新闻",
            "input": "",
            "output": "[调用工具: search_tool]\n参数: {\"query\": \"最新AI新闻\", \"limit\": 10}\n\n正在搜索最新的AI新闻...\n\n搜索完成，找到以下相关新闻：\n1. GPT-5发布预告\n2. AI在医疗领域的新突破\n3. 自动驾驶技术进展\n\n需要我详细介绍某条新闻吗？",
            "tools_used": ["search_tool"]
        },
        {
            "instruction": "生成一个销售数据图表",
            "input": "数据：Q1: 100万, Q2: 120万, Q3: 150万, Q4: 180万",
            "output": "[调用工具: chart_generator]\n参数: {\"type\": \"bar\", \"data\": {\"Q1\": 100, \"Q2\": 120, \"Q3\": 150, \"Q4\": 180}, \"title\": \"季度销售额\"}\n\n正在生成图表...\n\n图表已生成！显示销售额呈稳步上升趋势，Q4达到最高180万。\n\n需要我导出图表吗？",
            "tools_used": ["chart_generator"]
        },
    ]
    
    instructions.extend(office_tasks)
    instructions.extend(thinking_tasks)
    instructions.extend(tool_calling_tasks)
    
    for i, item in enumerate(instructions):
        item["id"] = i + 1
        item["task_type"] = "office" if item in office_tasks else ("thinking" if item in thinking_tasks else "tool_calling")
    
    output_file = output_dir / "training_instructions.jsonl"
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in instructions:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    logger.info(f"Created {len(instructions)} instruction samples in {output_file}")
    return output_file


def create_preference_data():
    """创建偏好对齐数据"""
    
    output_dir = Path("data/preference")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    preferences = [
        {
            "prompt": "帮我创建一个PPT",
            "chosen": "好的，我来帮您创建PPT。请问您希望PPT的主题是什么？需要多少页？有什么特殊要求吗？",
            "rejected": "好的。"
        },
        {
            "prompt": "分析这份数据",
            "input": "表格包含销售数据",
            "chosen": """我将为您进行数据分析：

1. 首先查看数据结构和基本统计信息
2. 识别关键指标和趋势
3. 生成可视化图表
4. 提供分析结论和建议

请上传您的数据文件，我将开始分析。""",
            "rejected": "请把数据发给我。"
        },
        {
            "prompt": "这个Excel公式怎么写？",
            "input": "需要计算满足条件的单元格数量",
            "chosen": """这个需求可以使用COUNTIF函数实现：

```excel
=COUNTIF(A:A, "条件")
```

这个公式的作用是：
- 在A列中查找满足条件的单元格
- 返回满足条件的单元格数量

如果需要多个条件，可以使用：
```excel
=COUNTIFS(A:A, "条件1", B:B, "条件2")
```

请问这是您需要的功能吗？""",
            "rejected": "用COUNTIF函数。"
        },
        {
            "prompt": "How do I center text in Word?",
            "chosen": "To center text in Microsoft Word, you have several options:\n\n**Method 1: Using the Ribbon**\n1. Select the text you want to center\n2. Go to the Home tab\n3. Click the Center button in the Paragraph section\n\n**Method 2: Using Keyboard Shortcut**\n- Press Ctrl + E (Windows) or Cmd + E (Mac)\n\n**Method 3: Using the Paragraph Dialog**\n1. Right-click and select Paragraph\n2. Set Alignment to Center\n\nWould you like me to help with any specific formatting needs?",
            "rejected": "Use Ctrl+E to center text."
        },
    ]
    
    output_file = output_dir / "preference_data.jsonl"
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in preferences:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    logger.info(f"Created {len(preferences)} preference samples in {output_file}")
    return output_file


def download_open_source_data():
    """下载开源数据集（可选）"""
    
    logger.info("Attempting to download open-source datasets...")
    
    output_dir = Path("data/pretrain")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        from datasets import load_dataset
        
        datasets_to_download = [
            ("wikipedia", "20220301.zh", "wikipedia_zh.jsonl"),
            ("wikipedia", "20220301.en", "wikipedia_en.jsonl"),
        ]
        
        for dataset_name, subset, output_name in datasets_to_download:
            try:
                logger.info(f"Downloading {dataset_name} ({subset})...")
                ds = load_dataset(dataset_name, subset, split="train", trust_remote_code=True)
                
                output_file = output_dir / output_name
                with open(output_file, 'w', encoding='utf-8') as f:
                    for item in tqdm(ds, desc=f"Writing {output_name}"):
                        text = item.get('text', '')
                        if text:
                            f.write(json.dumps({'text': text}, ensure_ascii=False) + '\n')
                
                logger.info(f"Downloaded {dataset_name} to {output_file}")
            except Exception as e:
                logger.warning(f"Failed to download {dataset_name}: {e}")
                
    except ImportError:
        logger.warning("datasets library not installed. Skipping open-source data download.")
        logger.info("Install with: pip install datasets")


def main():
    """主函数"""
    logger.info("=" * 60)
    logger.info("Starting data preparation...")
    logger.info("=" * 60)
    
    pretrain_file = create_sample_pretrain_data()
    instruction_file = create_instruction_data()
    preference_file = create_preference_data()
    
    logger.info("\n" + "=" * 60)
    logger.info("Data preparation completed!")
    logger.info("=" * 60)
    logger.info(f"Pretrain data: {pretrain_file}")
    logger.info(f"Instruction data: {instruction_file}")
    logger.info(f"Preference data: {preference_file}")
    
    logger.info("\n提示：当前为示例数据，建议下载更多数据以提高模型质量。")
    logger.info("运行 download_open_source_data() 可下载开源数据集。")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Pretraining Data Preparation
预训练数据准备脚本 - 下载、清洗、处理数据
"""

import os
import json
import random
import logging
import re
from pathlib import Path
from typing import List, Dict, Any, Iterator, Optional
from dataclasses import dataclass
from tqdm import tqdm
import hashlib

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class DataConfig:
    output_dir: str = "data/processed"
    cache_dir: str = "data/cache"
    
    zh_samples: int = 100000
    en_samples: int = 100000
    mixed_samples: int = 20000
    
    min_text_length: int = 50
    max_text_length: int = 2048
    
    train_ratio: float = 0.98
    seed: int = 42


class TextCleaner:
    @staticmethod
    def clean(text: str) -> str:
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'https?://\S+', '', text)
        text = text.strip()
        return text
    
    @staticmethod
    def is_valid(text: str, min_len: int = 50, max_len: int = 2048) -> bool:
        if not text or len(text) < min_len or len(text) > max_len:
            return False
        
        alpha_ratio = len(re.findall(r'[a-zA-Z\u4e00-\u9fff]', text)) / len(text)
        if alpha_ratio < 0.5:
            return False
        
        return True


class SyntheticDataGenerator:
    ZH_TEMPLATES = [
        "人工智能是计算机科学的一个重要分支，它试图理解智能的本质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。人工智能的研究领域包括机器学习、深度学习、自然语言处理、计算机视觉等多个方向。",
        "机器学习是人工智能的核心技术之一，它使计算机能够从数据中学习并做出预测或决策，而无需显式编程。常见的机器学习算法包括线性回归、决策树、支持向量机、神经网络等。",
        "深度学习是机器学习的一个子领域，它使用多层神经网络来学习数据的表示。深度学习在图像识别、语音识别、自然语言处理等领域取得了突破性进展，推动了人工智能技术的快速发展。",
        "自然语言处理是人工智能的一个重要分支，它研究如何让计算机理解和生成人类语言。自然语言处理技术广泛应用于机器翻译、情感分析、问答系统、文本摘要等场景。",
        "计算机视觉让机器能够看见和理解世界。通过图像识别、目标检测、语义分割等技术，计算机视觉在自动驾驶、医疗影像分析、安防监控等领域有着广泛的应用。",
        "知识图谱是一种结构化的知识表示方法，它将知识表示为实体和实体之间的关系。知识图谱在搜索引擎、推荐系统、智能问答等领域发挥着重要作用。",
        "强化学习是一种通过与环境交互来学习最优策略的机器学习方法。强化学习在游戏AI、机器人控制、自动驾驶等领域取得了显著成果，如AlphaGo战胜人类围棋冠军。",
        "迁移学习是一种机器学习技术，它允许模型将在一个任务上学到的知识迁移到另一个相关任务上。迁移学习可以显著减少训练数据需求和计算成本。",
        "生成对抗网络（GAN）是一种深度学习模型，由生成器和判别器组成。GAN在图像生成、视频合成、数据增强等领域有着广泛的应用，能够生成逼真的合成数据。",
        "注意力机制是深度学习中的重要技术，它允许模型在处理序列时关注最重要的部分。Transformer架构基于注意力机制，在自然语言处理领域取得了革命性突破。",
    ]
    
    EN_TEMPLATES = [
        "Artificial intelligence is a branch of computer science that attempts to understand the nature of intelligence and produce intelligent machines. AI research includes machine learning, deep learning, natural language processing, computer vision, and many other areas.",
        "Machine learning is a core technology in artificial intelligence that enables computers to learn from data and make predictions without explicit programming. Common machine learning algorithms include linear regression, decision trees, support vector machines, and neural networks.",
        "Deep learning is a subfield of machine learning that uses multi-layer neural networks to learn data representations. Deep learning has achieved breakthrough progress in image recognition, speech recognition, and natural language processing.",
        "Natural language processing is an important branch of AI that studies how computers can understand and generate human language. NLP techniques are widely used in machine translation, sentiment analysis, question answering systems, and text summarization.",
        "Computer vision enables machines to see and understand the world. Through image recognition, object detection, and semantic segmentation, computer vision has broad applications in autonomous driving, medical imaging, and security surveillance.",
        "Knowledge graphs are a structured knowledge representation method that expresses knowledge as entities and their relationships. Knowledge graphs play important roles in search engines, recommendation systems, and intelligent question answering.",
        "Reinforcement learning is a machine learning method that learns optimal policies through interaction with the environment. RL has achieved significant results in game AI, robot control, and autonomous driving, such as AlphaGo defeating the human Go champion.",
        "Transfer learning is a machine learning technique that allows models to transfer knowledge learned from one task to another related task. Transfer learning can significantly reduce training data requirements and computational costs.",
        "Generative Adversarial Networks (GANs) are deep learning models consisting of a generator and a discriminator. GANs have wide applications in image generation, video synthesis, and data augmentation, capable of generating realistic synthetic data.",
        "Attention mechanisms are important techniques in deep learning that allow models to focus on the most important parts when processing sequences. The Transformer architecture, based on attention mechanisms, has achieved revolutionary breakthroughs in NLP.",
    ]
    
    MIXED_TEMPLATES = [
        "Python是一种流行的编程语言，广泛用于人工智能和机器学习开发。Python has become the de facto language for AI and ML development.",
        "深度学习 Deep Learning 是机器学习的一个重要分支，使用神经网络进行特征学习。Neural networks can automatically learn hierarchical features from raw data.",
        "Transformer架构彻底改变了自然语言处理领域。The Transformer architecture has revolutionized the field of natural language processing.",
        "GPT模型能够生成类似人类的文本内容。GPT models can generate human-like text content through autoregressive language modeling.",
        "BERT是一种预训练语言模型，通过掩码语言模型学习双向表示。BERT learns bidirectional representations through masked language modeling.",
        "强化学习在游戏AI中取得了巨大成功。Reinforcement learning has achieved tremendous success in game AI.",
        "计算机视觉让机器能够理解图像和视频。Computer vision enables machines to understand images and videos.",
        "自然语言处理 NLP 是人工智能的核心技术之一。NLP is one of the core technologies in artificial intelligence.",
    ]
    
    @classmethod
    def generate_zh(cls, count: int) -> List[Dict[str, Any]]:
        samples = []
        for i in range(count):
            base = random.choice(cls.ZH_TEMPLATES)
            
            variations = [
                base,
                base + " " + random.choice(cls.ZH_TEMPLATES[:5]),
                f"在人工智能领域，{base}",
                f"研究表明，{base}",
                f"专家指出，{base}",
            ]
            
            text = random.choice(variations)
            samples.append({
                'text': text,
                'language': 'zh',
                'source': 'synthetic',
                'id': f'zh_{i:06d}',
            })
        return samples
    
    @classmethod
    def generate_en(cls, count: int) -> List[Dict[str, Any]]:
        samples = []
        for i in range(count):
            base = random.choice(cls.EN_TEMPLATES)
            
            variations = [
                base,
                base + " " + random.choice(cls.EN_TEMPLATES[:5]),
                f"In the field of AI, {base}",
                f"Research shows that {base}",
                f"Experts point out that {base}",
            ]
            
            text = random.choice(variations)
            samples.append({
                'text': text,
                'language': 'en',
                'source': 'synthetic',
                'id': f'en_{i:06d}',
            })
        return samples
    
    @classmethod
    def generate_mixed(cls, count: int) -> List[Dict[str, Any]]:
        samples = []
        for i in range(count):
            text = random.choice(cls.MIXED_TEMPLATES)
            samples.append({
                'text': text,
                'language': 'mixed',
                'source': 'synthetic',
                'id': f'mixed_{i:06d}',
            })
        return samples


class HuggingFaceDataDownloader:
    DATASET_CONFIGS = {
        'wikipedia_zh': {
            'path': 'wikipedia',
            'name': '20220301.zh',
            'split': 'train',
            'text_field': 'text',
            'language': 'zh',
        },
        'wikipedia_en': {
            'path': 'wikipedia',
            'name': '20220301.en',
            'split': 'train',
            'text_field': 'text',
            'language': 'en',
        },
    }
    
    @classmethod
    def download(cls, dataset_name: str, max_samples: int = 10000, cache_dir: str = "data/cache") -> List[Dict[str, Any]]:
        if dataset_name not in cls.DATASET_CONFIGS:
            logger.warning(f"Unknown dataset: {dataset_name}")
            return []
        
        try:
            from datasets import load_dataset
        except ImportError:
            logger.warning("datasets library not installed, using synthetic data")
            return []
        
        config = cls.DATASET_CONFIGS[dataset_name]
        logger.info(f"Downloading {dataset_name}...")
        
        try:
            dataset = load_dataset(
                config['path'],
                name=config.get('name'),
                split=config['split'],
                streaming=True,
                cache_dir=cache_dir,
            )
            
            samples = []
            for i, item in enumerate(tqdm(dataset, total=max_samples, desc=f"Loading {dataset_name}")):
                if i >= max_samples:
                    break
                
                text = item.get(config['text_field'], '')
                if TextCleaner.is_valid(text):
                    samples.append({
                        'text': TextCleaner.clean(text),
                        'language': config['language'],
                        'source': dataset_name,
                        'id': f'{dataset_name}_{i:06d}',
                    })
            
            logger.info(f"Loaded {len(samples)} samples from {dataset_name}")
            return samples
            
        except Exception as e:
            logger.error(f"Failed to download {dataset_name}: {e}")
            return []


def prepare_pretrain_data(config: DataConfig):
    random.seed(config.seed)
    
    output_dir = Path(config.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    cache_dir = Path(config.cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("="*50)
    logger.info("Preparing Pretraining Data")
    logger.info("="*50)
    
    all_samples = []
    
    logger.info("\n[1/4] Loading Chinese data...")
    zh_samples = SyntheticDataGenerator.generate_zh(config.zh_samples)
    all_samples.extend(zh_samples)
    logger.info(f"Generated {len(zh_samples)} Chinese samples")
    
    logger.info("\n[2/4] Loading English data...")
    en_samples = SyntheticDataGenerator.generate_en(config.en_samples)
    all_samples.extend(en_samples)
    logger.info(f"Generated {len(en_samples)} English samples")
    
    logger.info("\n[3/4] Loading Mixed data...")
    mixed_samples = SyntheticDataGenerator.generate_mixed(config.mixed_samples)
    all_samples.extend(mixed_samples)
    logger.info(f"Generated {len(mixed_samples)} mixed samples")
    
    logger.info("\n[4/4] Trying to load HuggingFace datasets...")
    try:
        hf_zh = HuggingFaceDataDownloader.download('wikipedia_zh', max_samples=5000, cache_dir=str(cache_dir))
        all_samples.extend(hf_zh)
        logger.info(f"Added {len(hf_zh)} samples from Wikipedia Chinese")
    except Exception as e:
        logger.warning(f"Could not load Wikipedia Chinese: {e}")
    
    logger.info(f"\nTotal samples: {len(all_samples)}")
    
    random.shuffle(all_samples)
    
    split_idx = int(len(all_samples) * config.train_ratio)
    train_samples = all_samples[:split_idx]
    eval_samples = all_samples[split_idx:]
    
    logger.info(f"\nTrain samples: {len(train_samples)}")
    logger.info(f"Eval samples: {len(eval_samples)}")
    
    train_path = output_dir / "pretrain_train.jsonl"
    with open(train_path, 'w', encoding='utf-8') as f:
        for sample in tqdm(train_samples, desc="Writing train data"):
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')
    logger.info(f"Saved train data to {train_path}")
    
    eval_path = output_dir / "pretrain_eval.jsonl"
    with open(eval_path, 'w', encoding='utf-8') as f:
        for sample in tqdm(eval_samples, desc="Writing eval data"):
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')
    logger.info(f"Saved eval data to {eval_path}")
    
    stats = {
        'total_samples': len(all_samples),
        'train_samples': len(train_samples),
        'eval_samples': len(eval_samples),
        'zh_samples': sum(1 for s in all_samples if s['language'] == 'zh'),
        'en_samples': sum(1 for s in all_samples if s['language'] == 'en'),
        'mixed_samples': sum(1 for s in all_samples if s['language'] == 'mixed'),
    }
    
    stats_path = output_dir / "data_stats.json"
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    logger.info("\n" + "="*50)
    logger.info("Data Preparation Complete!")
    logger.info("="*50)
    logger.info(f"Statistics: {json.dumps(stats, indent=2)}")
    
    return stats


def prepare_instruction_data(config: DataConfig):
    output_dir = Path(config.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info("Preparing Instruction Data...")
    
    instruction_samples = [
        {
            "instruction": "请解释什么是人工智能",
            "input": "",
            "output": "人工智能（Artificial Intelligence，简称AI）是计算机科学的一个重要分支，它致力于研究和开发能够模拟、延伸和扩展人类智能的理论、方法、技术及应用系统。人工智能的研究包括机器学习、深度学习、自然语言处理、计算机视觉等多个方向。",
            "language": "zh",
        },
        {
            "instruction": "What is machine learning?",
            "input": "",
            "output": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing algorithms that can access data, learn from it, and make predictions or decisions.",
            "language": "en",
        },
        {
            "instruction": "请用Python写一个快速排序算法",
            "input": "",
            "output": "def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)",
            "language": "zh",
        },
        {
            "instruction": "解释深度学习和机器学习的区别",
            "input": "",
            "output": "深度学习是机器学习的一个子集。主要区别在于：\n1. 特征提取：机器学习需要人工设计特征，深度学习可以自动学习特征\n2. 数据量：深度学习通常需要更多数据\n3. 计算资源：深度学习需要更多计算资源\n4. 模型复杂度：深度学习使用多层神经网络，结构更复杂",
            "language": "zh",
        },
        {
            "instruction": "Write a function to calculate fibonacci numbers",
            "input": "",
            "output": "def fibonacci(n):\n    if n <= 0:\n        return []\n    elif n == 1:\n        return [0]\n    elif n == 2:\n        return [0, 1]\n    \n    fib = [0, 1]\n    for i in range(2, n):\n        fib.append(fib[i-1] + fib[i-2])\n    return fib",
            "language": "en",
        },
    ]
    
    for i in range(100):
        lang = random.choice(['zh', 'en'])
        if lang == 'zh':
            instruction_samples.append({
                "instruction": f"请生成一段关于人工智能的文本，主题编号{i+1}",
                "input": "",
                "output": f"人工智能是当今科技发展的重要方向。它通过模拟人类的认知过程，使机器能够执行复杂的任务。随着技术的进步，AI在医疗、教育、金融等领域展现出巨大潜力。主题{i+1}展示了AI技术的多样性和创新性。",
                "language": "zh",
            })
        else:
            instruction_samples.append({
                "instruction": f"Generate text about AI, topic number {i+1}",
                "input": "",
                "output": f"Artificial Intelligence represents a major direction in today's technological development. By simulating human cognitive processes, machines can perform complex tasks. With technological progress, AI shows tremendous potential in healthcare, education, finance, and other fields. Topic {i+1} demonstrates the diversity and innovation of AI technology.",
                "language": "en",
            })
    
    random.shuffle(instruction_samples)
    
    output_path = output_dir / "instruction.jsonl"
    with open(output_path, 'w', encoding='utf-8') as f:
        for sample in instruction_samples:
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')
    
    logger.info(f"Saved {len(instruction_samples)} instruction samples to {output_path}")
    
    return len(instruction_samples)


if __name__ == "__main__":
    config = DataConfig(
        zh_samples=50000,
        en_samples=50000,
        mixed_samples=10000,
    )
    
    prepare_pretrain_data(config)
    prepare_instruction_data(config)

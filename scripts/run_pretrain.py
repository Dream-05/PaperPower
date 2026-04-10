#!/usr/bin/env python3
"""
One-Click Pretraining Script
一键预训练脚本 - 完整的预训练流程
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_step(step_name: str, command: str) -> bool:
    import subprocess
    logger.info(f"\n{'='*60}")
    logger.info(f"Step: {step_name}")
    logger.info(f"{'='*60}")
    logger.info(f"Running: {command}")
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            cwd=Path(__file__).parent.parent,
        )
        logger.info(f"✓ {step_name} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"✗ {step_name} failed with error: {e}")
        return False


def prepare_directories():
    dirs = [
        "data/processed",
        "data/cache",
        "vocab/multilingual_50k",
        "checkpoints/bilingual-7b",
        "runs/bilingual-7b",
        "output",
    ]
    
    for d in dirs:
        Path(d).mkdir(parents=True, exist_ok=True)
    
    logger.info("Created necessary directories")


def create_sample_data():
    logger.info("Creating sample training data...")
    
    data_dir = Path("data/processed")
    data_dir.mkdir(parents=True, exist_ok=True)
    
    zh_samples = [
        "人工智能是计算机科学的一个重要分支，它试图理解智能的本质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。",
        "机器学习是人工智能的核心技术，它使计算机能够从数据中学习并做出预测。",
        "深度学习使用多层神经网络来学习数据的表示，在图像识别和自然语言处理方面取得了突破。",
        "自然语言处理是人工智能的一个重要领域，旨在让计算机理解和生成人类语言。",
        "计算机视觉让机器能够看见世界，在自动驾驶、医疗影像等领域有广泛应用。",
        "知识图谱是一种结构化的知识表示方法，能够描述实体之间的关系。",
        "强化学习通过与环境交互来学习最优策略，在游戏和机器人控制中表现出色。",
        "迁移学习允许模型将在一个任务上学到的知识应用到另一个相关任务上。",
        "生成对抗网络由生成器和判别器组成，能够生成逼真的合成数据。",
        "注意力机制是深度学习中的重要技术，Transformer架构基于此取得了革命性突破。",
    ]
    
    en_samples = [
        "Artificial intelligence is a branch of computer science that attempts to understand the nature of intelligence.",
        "Machine learning is a subset of AI that enables systems to learn and improve from experience.",
        "Deep learning uses multi-layer neural networks to learn representations of data.",
        "Natural language processing enables computers to understand and generate human language.",
        "Computer vision allows machines to interpret and understand visual information.",
        "Knowledge graphs represent knowledge as a network of entities and their relationships.",
        "Reinforcement learning trains agents to make decisions by interacting with an environment.",
        "Transfer learning applies knowledge from one task to improve performance on another.",
        "Generative adversarial networks consist of a generator and a discriminator.",
        "Attention mechanisms allow models to focus on important parts when processing sequences.",
    ]
    
    train_data = []
    for i in range(5000):
        if i % 2 == 0:
            text = zh_samples[i % len(zh_samples)]
            lang = "zh"
        else:
            text = en_samples[i % len(en_samples)]
            lang = "en"
        
        train_data.append({
            "text": text,
            "language": lang,
            "source": "sample",
            "id": f"sample_{i:06d}",
        })
    
    with open(data_dir / "pretrain_train.jsonl", 'w', encoding='utf-8') as f:
        for item in train_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    eval_data = train_data[:100]
    with open(data_dir / "pretrain_eval.jsonl", 'w', encoding='utf-8') as f:
        for item in eval_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    logger.info(f"Created {len(train_data)} training samples")
    logger.info(f"Created {len(eval_data)} evaluation samples")


def create_sample_vocab():
    logger.info("Creating sample vocabulary...")
    
    vocab_dir = Path("vocab/multilingual_50k")
    vocab_dir.mkdir(parents=True, exist_ok=True)
    
    vocab = {
        "": 0,
        "<|zh|>": 1,
        "<|en|>": 2,
        "<|code|>": 3,
        "<|im_start|>": 4,
        "<|im_end|>": 5,
        "<|tool|>": 6,
        "<|thought|>": 7,
        "<|hidden_thought|>": 8,
    }
    
    idx = 9
    for i in range(32, 127):
        char = chr(i)
        if char not in vocab:
            vocab[char] = idx
            idx += 1
    
    for code in range(0x4E00, 0x4E00 + 5000):
        char = chr(code)
        vocab[char] = idx
        idx += 1
    
    with open(vocab_dir / "vocab.json", 'w', encoding='utf-8') as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)
    
    with open(vocab_dir / "merges.txt", 'w', encoding='utf-8') as f:
        f.write("")
    
    config = {"vocab_size": idx, "min_frequency": 2}
    with open(vocab_dir / "config.json", 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)
    
    logger.info(f"Created vocabulary with {idx} tokens")


def run_quick_pretrain():
    logger.info("\n" + "="*60)
    logger.info("QUICK PRETRAINING MODE")
    logger.info("="*60)
    
    prepare_directories()
    
    create_sample_data()
    
    create_sample_vocab()
    
    logger.info("\n" + "="*60)
    logger.info("STARTING TRAINING")
    logger.info("="*60)
    
    from train.config import TrainingConfig, ModelConfig
    from train.unified_trainer import create_trainer
    from data.unified_dataset import BilingualDataset
    from tokenizer.international_tokenizer import MultilingualBPETokenizer
    
    config = TrainingConfig(
        model_config=ModelConfig(
            vocab_size=5000,
            hidden_size=256,
            num_hidden_layers=4,
            num_attention_heads=4,
            intermediate_size=512,
            max_position_embeddings=512,
        ),
        batch_size=4,
        gradient_accumulation_steps=2,
        total_steps=100,
        log_interval=10,
        save_interval=50,
        eval_interval=50,
        output_dir="output/quick_pretrain",
        checkpoint_dir="checkpoints/quick_pretrain",
    )
    
    tokenizer = MultilingualBPETokenizer.load("vocab/multilingual_50k")
    
    train_dataset = BilingualDataset.from_jsonl("data/processed/pretrain_train.jsonl")
    eval_dataset = BilingualDataset.from_jsonl("data/processed/pretrain_eval.jsonl")
    
    trainer = create_trainer(config, tokenizer=tokenizer)
    
    logger.info(f"Model parameters: {trainer.model.get_num_params():,}")
    logger.info(f"Training samples: {len(train_dataset)}")
    logger.info(f"Eval samples: {len(eval_dataset)}")
    
    trainer.train(train_dataset, eval_dataset)
    
    logger.info("\n" + "="*60)
    logger.info("TRAINING COMPLETE!")
    logger.info("="*60)
    
    test_generation(trainer, tokenizer)
    
    return True


def test_generation(trainer, tokenizer):
    logger.info("\n" + "="*60)
    logger.info("TESTING GENERATION")
    logger.info("="*60)
    
    test_prompts = [
        "人工智能是",
        "Machine learning is",
        "深度学习",
    ]
    
    for prompt in test_prompts:
        logger.info(f"\nPrompt: {prompt}")
        try:
            response = trainer.generate(prompt, max_new_tokens=50)
            logger.info(f"Response: {response}")
        except Exception as e:
            logger.error(f"Generation error: {e}")


def run_full_pretrain(args):
    logger.info("\n" + "="*60)
    logger.info("FULL PRETRAINING MODE")
    logger.info("="*60)
    
    prepare_directories()
    
    if not Path("data/processed/pretrain_train.jsonl").exists():
        logger.info("Preparing training data...")
        if not run_step("Data Preparation", "python scripts/prepare_data.py"):
            return False
    
    if not Path("vocab/multilingual_50k/vocab.json").exists():
        logger.info("Training tokenizer...")
        if not run_step("Tokenizer Training", "python scripts/train_tokenizer.py"):
            return False
    
    logger.info("\n" + "="*60)
    logger.info("STARTING FULL TRAINING")
    logger.info("="*60)
    
    train_cmd = f"python train.py --mode pretrain --config {args.config}"
    if args.deepspeed:
        train_cmd += " --deepspeed"
    if args.output_dir:
        train_cmd += f" --output_dir {args.output_dir}"
    
    return run_step("Pretraining", train_cmd)


def main():
    parser = argparse.ArgumentParser(description="One-Click Pretraining")
    parser.add_argument("--mode", type=str, default="quick", choices=["quick", "full"],
                       help="Training mode: quick (demo) or full")
    parser.add_argument("--config", type=str, default="configs/bilingual_7b.yaml",
                       help="Config file for full mode")
    parser.add_argument("--deepspeed", action="store_true",
                       help="Use DeepSpeed for distributed training")
    parser.add_argument("--output_dir", type=str, default=None,
                       help="Output directory")
    args = parser.parse_args()
    
    start_time = datetime.now()
    
    logger.info("="*60)
    logger.info("BILINGUAL LLM PRETRAINING")
    logger.info("="*60)
    logger.info(f"Start time: {start_time}")
    logger.info(f"Mode: {args.mode}")
    
    if args.mode == "quick":
        success = run_quick_pretrain()
    else:
        success = run_full_pretrain(args)
    
    end_time = datetime.now()
    duration = end_time - start_time
    
    logger.info("\n" + "="*60)
    if success:
        logger.info("PRETRAINING COMPLETED SUCCESSFULLY!")
    else:
        logger.info("PRETRAINING FAILED!")
    logger.info(f"Total time: {duration}")
    logger.info("="*60)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())

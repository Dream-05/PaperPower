#!/usr/bin/env python3
"""
大规模数据收集脚本
从多个开源数据源下载训练数据
"""

import os
import json
import logging
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional
from tqdm import tqdm
import urllib.request
import zipfile
import tarfile

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DataCollector:
    """数据收集器"""
    
    def __init__(self, output_dir: str = "data/collection"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.stats = {
            "total_samples": 0,
            "total_size_mb": 0,
            "sources": {}
        }
    
    def download_file(self, url: str, filename: str) -> Path:
        """下载文件"""
        filepath = self.output_dir / filename
        
        if filepath.exists():
            logger.info(f"File already exists: {filepath}")
            return filepath
        
        logger.info(f"Downloading {url}...")
        
        try:
            urllib.request.urlretrieve(url, filepath)
            logger.info(f"Downloaded to {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"Failed to download {url}: {e}")
            return None
    
    def collect_wikipedia(self, language: str = "zh", max_articles: int = 10000):
        """收集维基百科数据"""
        logger.info(f"Collecting Wikipedia {language}...")
        
        try:
            from datasets import load_dataset
            
            subset = f"20220301.{language}"
            ds = load_dataset("wikipedia", subset, split="train", trust_remote_code=True)
            
            output_file = self.output_dir / f"wikipedia_{language}.jsonl"
            
            count = 0
            with open(output_file, 'w', encoding='utf-8') as f:
                for item in tqdm(ds, desc=f"Writing Wikipedia {language}"):
                    if count >= max_articles:
                        break
                    
                    text = item.get('text', '')
                    if text and len(text) > 100:
                        f.write(json.dumps({
                            'text': text,
                            'source': 'wikipedia',
                            'language': language
                        }, ensure_ascii=False) + '\n')
                        count += 1
            
            self.stats["sources"][f"wikipedia_{language}"] = count
            self.stats["total_samples"] += count
            
            logger.info(f"Collected {count} Wikipedia {language} articles")
            
        except ImportError:
            logger.warning("datasets library not installed. Install with: pip install datasets")
        except Exception as e:
            logger.error(f"Failed to collect Wikipedia: {e}")
    
    def collect_common_crawl(self, max_samples: int = 100000):
        """收集Common Crawl数据"""
        logger.info("Collecting Common Crawl...")
        
        try:
            from datasets import load_dataset
            
            ds = load_dataset("c4", "en", split="train", streaming=True, trust_remote_code=True)
            
            output_file = self.output_dir / "common_crawl_en.jsonl"
            
            count = 0
            with open(output_file, 'w', encoding='utf-8') as f:
                for item in tqdm(ds, desc="Writing Common Crawl"):
                    if count >= max_samples:
                        break
                    
                    text = item.get('text', '')
                    if text and len(text) > 100:
                        f.write(json.dumps({
                            'text': text,
                            'source': 'common_crawl',
                            'language': 'en'
                        }, ensure_ascii=False) + '\n')
                        count += 1
            
            self.stats["sources"]["common_crawl_en"] = count
            self.stats["total_samples"] += count
            
            logger.info(f"Collected {count} Common Crawl samples")
            
        except Exception as e:
            logger.error(f"Failed to collect Common Crawl: {e}")
    
    def collect_bookcorpus(self, max_samples: int = 50000):
        """收集书籍数据"""
        logger.info("Collecting BookCorpus...")
        
        try:
            from datasets import load_dataset
            
            ds = load_dataset("bookcorpus", split="train", streaming=True, trust_remote_code=True)
            
            output_file = self.output_dir / "bookcorpus.jsonl"
            
            count = 0
            with open(output_file, 'w', encoding='utf-8') as f:
                for item in tqdm(ds, desc="Writing BookCorpus"):
                    if count >= max_samples:
                        break
                    
                    text = item.get('text', '')
                    if text and len(text) > 100:
                        f.write(json.dumps({
                            'text': text,
                            'source': 'bookcorpus',
                            'language': 'en'
                        }, ensure_ascii=False) + '\n')
                        count += 1
            
            self.stats["sources"]["bookcorpus"] = count
            self.stats["total_samples"] += count
            
            logger.info(f"Collected {count} BookCorpus samples")
            
        except Exception as e:
            logger.error(f"Failed to collect BookCorpus: {e}")
    
    def collect_code_data(self, max_samples: int = 50000):
        """收集代码数据"""
        logger.info("Collecting code data...")
        
        try:
            from datasets import load_dataset
            
            languages = ["python", "javascript", "java", "cpp", "go"]
            
            for lang in languages:
                try:
                    ds = load_dataset(
                        "codeparrot/github-code",
                        languages=[lang],
                        split="train",
                        streaming=True,
                        trust_remote_code=True
                    )
                    
                    output_file = self.output_dir / f"github_{lang}.jsonl"
                    
                    count = 0
                    with open(output_file, 'w', encoding='utf-8') as f:
                        for item in tqdm(ds, desc=f"Writing GitHub {lang}"):
                            if count >= max_samples // len(languages):
                                break
                            
                            code = item.get('code', '')
                            if code and len(code) > 50:
                                f.write(json.dumps({
                                    'text': code,
                                    'source': 'github',
                                    'language': 'code',
                                    'programming_language': lang
                                }, ensure_ascii=False) + '\n')
                                count += 1
                    
                    self.stats["sources"][f"github_{lang}"] = count
                    self.stats["total_samples"] += count
                    
                except Exception as e:
                    logger.warning(f"Failed to collect {lang}: {e}")
            
            logger.info(f"Collected code data from {len(languages)} languages")
            
        except Exception as e:
            logger.error(f"Failed to collect code data: {e}")
    
    def collect_instruction_data(self, max_samples: int = 100000):
        """收集指令微调数据"""
        logger.info("Collecting instruction data...")
        
        datasets_to_try = [
            ("tatsu-lab/alpaca", None, "alpaca"),
            ("vicgalle/alpaca-gpt4", None, "alpaca_gpt4"),
            ("OpenAssistant/oasst1", None, "oasst1"),
        ]
        
        try:
            from datasets import load_dataset
            
            for dataset_name, subset, output_name in datasets_to_try:
                try:
                    if subset:
                        ds = load_dataset(dataset_name, subset, split="train", trust_remote_code=True)
                    else:
                        ds = load_dataset(dataset_name, split="train", trust_remote_code=True)
                    
                    output_file = self.output_dir / f"instruction_{output_name}.jsonl"
                    
                    count = 0
                    with open(output_file, 'w', encoding='utf-8') as f:
                        for item in tqdm(ds, desc=f"Writing {output_name}"):
                            if count >= max_samples // len(datasets_to_try):
                                break
                            
                            instruction = item.get('instruction', '') or item.get('text', '')
                            input_text = item.get('input', '')
                            output_text = item.get('output', '') or item.get('response', '')
                            
                            if instruction:
                                f.write(json.dumps({
                                    'instruction': instruction,
                                    'input': input_text,
                                    'output': output_text,
                                    'source': output_name
                                }, ensure_ascii=False) + '\n')
                                count += 1
                    
                    self.stats["sources"][f"instruction_{output_name}"] = count
                    self.stats["total_samples"] += count
                    
                except Exception as e:
                    logger.warning(f"Failed to collect {dataset_name}: {e}")
            
        except ImportError:
            logger.warning("datasets library not installed")
    
    def generate_synthetic_data(self, num_samples: int = 10000):
        """生成合成数据"""
        logger.info("Generating synthetic data...")
        
        import random
        
        templates = {
            "zh": [
                "{topic}是{field}的重要概念。它{description}。在{application}领域有广泛应用。",
                "关于{topic}，我们需要了解以下几点：首先，{point1}；其次，{point2}；最后，{point3}。",
                "{topic}的发展历程可以追溯到{year}年。当时，{context}。如今，{current}。",
            ],
            "en": [
                "{topic} is an important concept in {field}. It {description}. It has wide applications in {application}.",
                "Regarding {topic}, we need to understand the following: First, {point1}; Second, {point2}; Finally, {point3}.",
                "The development of {topic} can be traced back to {year}. At that time, {context}. Today, {current}.",
            ]
        }
        
        topics_zh = ["人工智能", "机器学习", "深度学习", "自然语言处理", "计算机视觉", "数据科学"]
        topics_en = ["Artificial Intelligence", "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "Data Science"]
        fields_zh = ["计算机科学", "信息技术", "数据科学", "人工智能"]
        fields_en = ["Computer Science", "Information Technology", "Data Science", "AI"]
        
        output_file = self.output_dir / "synthetic_data.jsonl"
        
        count = 0
        with open(output_file, 'w', encoding='utf-8') as f:
            for _ in range(num_samples):
                lang = random.choice(["zh", "en"])
                template = random.choice(templates[lang])
                
                if lang == "zh":
                    text = template.format(
                        topic=random.choice(topics_zh),
                        field=random.choice(fields_zh),
                        description="能够处理复杂问题并提供智能解决方案",
                        application=random.choice(["医疗", "金融", "教育", "交通"]),
                        point1="它具有强大的数据处理能力",
                        point2="可以自动学习和优化",
                        point3="在实际应用中效果显著",
                        year=random.randint(1950, 2020),
                        context="研究人员开始探索这一领域",
                        current="它已成为科技发展的重要驱动力"
                    )
                else:
                    text = template.format(
                        topic=random.choice(topics_en),
                        field=random.choice(fields_en),
                        description="can process complex problems and provide intelligent solutions",
                        application=random.choice(["healthcare", "finance", "education", "transportation"]),
                        point1="it has powerful data processing capabilities",
                        point2="it can automatically learn and optimize",
                        point3="it shows significant results in practical applications",
                        year=random.randint(1950, 2020),
                        context="researchers began exploring this field",
                        current="it has become an important driver of technological development"
                    )
                
                f.write(json.dumps({
                    'text': text,
                    'source': 'synthetic',
                    'language': lang
                }, ensure_ascii=False) + '\n')
                count += 1
        
        self.stats["sources"]["synthetic"] = count
        self.stats["total_samples"] += count
        
        logger.info(f"Generated {count} synthetic samples")
    
    def save_stats(self):
        """保存统计信息"""
        stats_file = self.output_dir / "collection_stats.json"
        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(self.stats, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Stats saved to {stats_file}")
        logger.info(f"Total samples collected: {self.stats['total_samples']}")


def main():
    parser = argparse.ArgumentParser(description="Collect training data")
    parser.add_argument("--wikipedia", action="store_true", help="Collect Wikipedia data")
    parser.add_argument("--common_crawl", action="store_true", help="Collect Common Crawl data")
    parser.add_argument("--books", action="store_true", help="Collect book data")
    parser.add_argument("--code", action="store_true", help="Collect code data")
    parser.add_argument("--instructions", action="store_true", help="Collect instruction data")
    parser.add_argument("--synthetic", action="store_true", help="Generate synthetic data")
    parser.add_argument("--all", action="store_true", help="Collect all data types")
    parser.add_argument("--max_samples", type=int, default=10000, help="Max samples per source")
    parser.add_argument("--output_dir", type=str, default="data/collection", help="Output directory")
    
    args = parser.parse_args()
    
    collector = DataCollector(args.output_dir)
    
    if args.all or args.wikipedia:
        collector.collect_wikipedia("zh", args.max_samples)
        collector.collect_wikipedia("en", args.max_samples)
    
    if args.all or args.common_crawl:
        collector.collect_common_crawl(args.max_samples)
    
    if args.all or args.books:
        collector.collect_bookcorpus(args.max_samples)
    
    if args.all or args.code:
        collector.collect_code_data(args.max_samples)
    
    if args.all or args.instructions:
        collector.collect_instruction_data(args.max_samples)
    
    if args.all or args.synthetic:
        collector.generate_synthetic_data(args.max_samples)
    
    if not any([args.wikipedia, args.common_crawl, args.books, args.code, 
                args.instructions, args.synthetic, args.all]):
        logger.info("No data type specified. Generating synthetic data as demo...")
        collector.generate_synthetic_data(5000)
    
    collector.save_stats()
    
    print("\n" + "=" * 60)
    print("数据收集完成!")
    print("=" * 60)
    print(f"总样本数: {collector.stats['total_samples']}")
    print(f"数据来源: {list(collector.stats['sources'].keys())}")
    print(f"输出目录: {args.output_dir}")


if __name__ == "__main__":
    main()

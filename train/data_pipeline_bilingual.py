import json
import os
import re
import hashlib
import random
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Iterator, Any
from dataclasses import dataclass, field
from datetime import datetime
import gzip
import zipfile


@dataclass
class DataSource:
    name: str
    language: str
    source_type: str
    url: Optional[str] = None
    local_path: Optional[str] = None
    weight: float = 1.0
    enabled: bool = True


@dataclass
class DataStats:
    total_docs: int = 0
    total_tokens: int = 0
    zh_docs: int = 0
    en_docs: int = 0
    mixed_docs: int = 0
    avg_doc_length: float = 0.0


class TextCleaner:
    ZH_PUNCTUATION = "。，、；：？！""''（）【】《》—…"
    EN_PUNCTUATION = ".,;:?!\"'()[]<>-"

    @staticmethod
    def clean_text(text: str, language: str = "auto") -> str:
        text = TextCleaner._normalize_whitespace(text)
        text = TextCleaner._remove_control_chars(text)
        text = TextCleaner._normalize_punctuation(text)
        text = TextCleaner._remove_urls(text, keep_meaning=True)
        text = TextCleaner._remove_emojis(text)
        text = text.strip()
        return text

    @staticmethod
    def _normalize_whitespace(text: str) -> str:
        text = re.sub(r'[\u0000-\u0008\u000b\u000c\u000e-\u001f]', '', text)
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text

    @staticmethod
    def _remove_control_chars(text: str) -> str:
        return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    @staticmethod
    def _normalize_punctuation(text: str) -> str:
        text = re.sub(r'[""″＂]', '"', text)
        text = re.sub(r"[''′＇]", "'", text)
        text = re.sub(r'[—–−]', '-', text)
        text = re.sub(r'\.{3,}', '...', text)
        return text

    @staticmethod
    def _remove_urls(text: str, keep_meaning: bool = False) -> str:
        if keep_meaning:
            return text
        return re.sub(r'https?://\S+', '', text)

    @staticmethod
    def _remove_emojis(text: str) -> str:
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "\U0001F1E0-\U0001F1FF"
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE,
        )
        return emoji_pattern.sub('', text)


class LanguageDetector:
    HAN_PATTERN = re.compile(r'[\u4e00-\u9fff]')
    LATIN_PATTERN = re.compile(r'[a-zA-Z]')

    @classmethod
    def detect(cls, text: str) -> str:
        if not text or not text.strip():
            return "unknown"

        clean_text = re.sub(r'[\s\d!"#$%&\'()*+,\-./:;<=>?@\[\\\]^_`{|}~。，、；：？！""''（）【】《》…—]', '', text)
        if not clean_text:
            return "unknown"

        han_chars = cls.HAN_PATTERN.findall(clean_text)
        latin_chars = cls.LATIN_PATTERN.findall(clean_text)

        han_ratio = len(han_chars) / len(clean_text)
        latin_ratio = len(latin_chars) / len(clean_text)

        if han_ratio > 0.3 and latin_ratio > 0.2:
            return "mixed"
        elif han_ratio > 0.3:
            return "zh"
        elif latin_ratio > 0.3:
            return "en"
        return "unknown"

    @classmethod
    def is_code_switching(cls, text: str) -> bool:
        return cls.detect(text) == "mixed"


class BilingualDataPipeline:
    CHINESE_SOURCES = [
        DataSource("wikipedia_zh", "zh", "wiki", weight=1.0),
        DataSource("baike", "zh", "encyclopedia", weight=0.8),
        DataSource("zhihu", "zh", "qa", weight=0.7),
        DataSource("chinese_books", "zh", "book", weight=0.9),
        DataSource("cnki_abstracts", "zh", "academic", weight=0.6),
        DataSource("common_crawl_zh", "zh", "web", weight=0.8),
        DataSource("the_stack_zh", "zh", "code", weight=0.6),
        DataSource("chinese_literature", "zh", "book", weight=0.7),
        DataSource("academic_papers_zh", "zh", "academic", weight=0.8),
    ]

    ENGLISH_SOURCES = [
        DataSource("wikipedia_en", "en", "wiki", weight=1.0),
        DataSource("bookcorpus", "en", "book", weight=0.9),
        DataSource("openwebtext", "en", "web", weight=0.8),
        DataSource("github_code", "en", "code", weight=0.5),
        DataSource("arxiv", "en", "academic", weight=0.7),
        DataSource("common_crawl_en", "en", "web", weight=0.8),
        DataSource("the_stack_en", "en", "code", weight=0.6),
        DataSource("project_gutenberg", "en", "book", weight=0.7),
        DataSource("academic_papers_en", "en", "academic", weight=0.8),
    ]

    CODE_SWITCH_SOURCES = [
        DataSource("tech_blogs", "mixed", "blog", weight=0.6),
        DataSource("dev_forums", "mixed", "forum", weight=0.5),
        DataSource("academic_papers", "mixed", "academic", weight=0.4),
    ]

    INSTRUCTION_SOURCES = [
        DataSource("daily_dialog_zh", "zh", "conversation", weight=1.0),
        DataSource("daily_dialog_en", "en", "conversation", weight=1.0),
        DataSource("academic_writing_zh", "zh", "writing", weight=0.8),
        DataSource("academic_writing_en", "en", "writing", weight=0.8),
        DataSource("leetcode_zh", "zh", "code", weight=0.7),
        DataSource("leetcode_en", "en", "code", weight=0.7),
        DataSource("ppt_instructions_zh", "zh", "design", weight=0.6),
        DataSource("ppt_instructions_en", "en", "design", weight=0.6),
        DataSource("tool_usage_zh", "zh", "agent", weight=0.5),
        DataSource("tool_usage_en", "en", "agent", weight=0.5),
    ]

    def __init__(
        self,
        output_dir: str = "data/processed",
        cache_dir: str = "data/cache",
        seed: int = 42,
    ):
        self.output_dir = Path(output_dir)
        self.cache_dir = Path(cache_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cleaner = TextCleaner()
        self.detector = LanguageDetector()
        self.seed = seed
        random.seed(seed)
        self.stats = DataStats()

    def process_pretraining_corpus(
        self,
        zh_ratio: float = 0.5,
        en_ratio: float = 0.5,
        code_switch_ratio: float = 0.1,
    ) -> Iterator[Dict[str, Any]]:
        total_ratio = zh_ratio + en_ratio + code_switch_ratio
        zh_norm = zh_ratio / total_ratio
        en_norm = en_ratio / total_ratio
        cs_norm = code_switch_ratio / total_ratio

        zh_stream = self._stream_sources(self.CHINESE_SOURCES)
        en_stream = self._stream_sources(self.ENGLISH_SOURCES)
        cs_stream = self._stream_sources(self.CODE_SWITCH_SOURCES)

        while True:
            rand = random.random()
            if rand < zh_norm:
                try:
                    doc = next(zh_stream)
                    yield self._process_doc(doc, "pretrain")
                except StopIteration:
                    zh_stream = self._stream_sources(self.CHINESE_SOURCES)
            elif rand < zh_norm + en_norm:
                try:
                    doc = next(en_stream)
                    yield self._process_doc(doc, "pretrain")
                except StopIteration:
                    en_stream = self._stream_sources(self.ENGLISH_SOURCES)
            else:
                try:
                    doc = next(cs_stream)
                    yield self._process_doc(doc, "pretrain")
                except StopIteration:
                    cs_stream = self._stream_sources(self.CODE_SWITCH_SOURCES)

    def process_instruction_data(
        self,
        include_translation_pairs: bool = True,
    ) -> Iterator[Dict[str, Any]]:
        for source in self.INSTRUCTION_SOURCES:
            for doc in self._stream_sources([source]):
                processed = self._process_instruction(doc, source)
                if processed:
                    yield processed

        if include_translation_pairs:
            for pair in self._generate_translation_pairs():
                yield pair

    def _stream_sources(self, sources: List[DataSource]) -> Iterator[Dict[str, Any]]:
        for source in sources:
            if not source.enabled:
                continue

            if source.local_path and Path(source.local_path).exists():
                for doc in self._load_local_source(source):
                    yield doc
            elif source.url:
                for doc in self._load_remote_source(source):
                    yield doc
            else:
                for doc in self._generate_synthetic_data(source):
                    yield doc

    def _load_local_source(self, source: DataSource) -> Iterator[Dict[str, Any]]:
        path = Path(source.local_path)
        if path.suffix == ".jsonl":
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        yield json.loads(line)
        elif path.suffix == ".json":
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        yield item
        elif path.suffix in [".txt", ".md"]:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
                for chunk in self._chunk_text(content, max_length=2048):
                    yield {"text": chunk, "source": source.name}

    def _load_remote_source(self, source: DataSource) -> Iterator[Dict[str, Any]]:
        cache_file = self.cache_dir / f"{source.name}.jsonl"

        if cache_file.exists():
            with open(cache_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        yield json.loads(line)
            return

        yield from self._generate_synthetic_data(source)

    def _generate_synthetic_data(self, source: DataSource) -> Iterator[Dict[str, Any]]:
        synthetic_samples = self._get_synthetic_samples(source)
        for sample in synthetic_samples:
            yield sample

    def _get_synthetic_samples(self, source: DataSource) -> List[Dict[str, Any]]:
        samples = {
            "wikipedia_zh": [
                {"text": "人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。", "title": "人工智能"},
                {"text": "机器学习是人工智能的一个重要分支，它使计算机能够从数据中学习并做出决策或预测。", "title": "机器学习"},
                {"text": "深度学习是机器学习的一个子领域，它使用多层神经网络来学习数据的表示。", "title": "深度学习"},
            ],
            "wikipedia_en": [
                {"text": "Artificial intelligence is the simulation of human intelligence processes by machines, especially computer systems.", "title": "Artificial Intelligence"},
                {"text": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience.", "title": "Machine Learning"},
                {"text": "Deep learning is part of a broader family of machine learning methods based on artificial neural networks.", "title": "Deep Learning"},
            ],
            "daily_dialog_zh": [
                {"conversations": [{"role": "user", "content": "你好，今天天气怎么样？"}, {"role": "assistant", "content": "今天天气晴朗，温度适宜，很适合出门散步。"}]},
                {"conversations": [{"role": "user", "content": "能推荐一本好书吗？"}, {"role": "assistant", "content": "我推荐《人类简史》，这本书从宏观角度讲述了人类的发展历程。"}]},
            ],
            "daily_dialog_en": [
                {"conversations": [{"role": "user", "content": "Hello, how's the weather today?"}, {"role": "assistant", "content": "It's sunny and pleasant today, perfect for a walk outside."}]},
                {"conversations": [{"role": "user", "content": "Can you recommend a good book?"}, {"role": "assistant", "content": "I recommend 'Sapiens' by Yuval Noah Harari. It provides a fascinating perspective on human history."}]},
            ],
            "leetcode_zh": [
                {"problem": "两数之和", "description": "给定一个整数数组和一个目标值，找出数组中和为目标值的两个数的索引。", "solution": "使用哈希表可以在O(n)时间复杂度内解决这个问题。"},
                {"problem": "反转链表", "description": "反转一个单链表。", "solution": "可以使用迭代或递归两种方法，迭代方法更节省空间。"},
            ],
            "leetcode_en": [
                {"problem": "Two Sum", "description": "Given an array of integers and a target value, find indices of two numbers that add up to the target.", "solution": "Use a hash map to solve this in O(n) time complexity."},
                {"problem": "Reverse Linked List", "description": "Reverse a singly linked list.", "solution": "Can be solved iteratively or recursively, with iterative approach being more space-efficient."},
            ],
            "tool_usage_zh": [
                {"instruction": "帮我计算 123 * 456", "trajectory": [{"thought": "用户需要数学计算", "action": "calculator", "args": {"expression": "123*456"}}], "result": "计算结果是 56088"},
                {"instruction": "读取配置文件", "trajectory": [{"thought": "用户需要读取文件", "action": "file_reader", "args": {"path": "config.json"}}], "result": "文件内容已读取"},
            ],
            "tool_usage_en": [
                {"instruction": "Calculate 123 * 456", "trajectory": [{"thought": "User needs math calculation", "action": "calculator", "args": {"expression": "123*456"}}], "result": "The result is 56088"},
                {"instruction": "Read the config file", "trajectory": [{"thought": "User needs to read a file", "action": "file_reader", "args": {"path": "config.json"}}], "result": "File content has been read"},
            ],
        }

        return samples.get(source.name, [{"text": f"Sample data for {source.name}", "source": source.name}])

    def _process_doc(self, doc: Dict[str, Any], stage: str) -> Dict[str, Any]:
        text = doc.get("text", "")
        if not text:
            text = doc.get("content", "")
        if not text:
            text = json.dumps(doc, ensure_ascii=False)

        cleaned_text = self.cleaner.clean_text(text)
        language = self.detector.detect(cleaned_text)

        self.stats.total_docs += 1
        self.stats.total_tokens += len(cleaned_text.split())
        if language == "zh":
            self.stats.zh_docs += 1
        elif language == "en":
            self.stats.en_docs += 1
        elif language == "mixed":
            self.stats.mixed_docs += 1

        return {
            "text": cleaned_text,
            "language": language,
            "source": doc.get("source", "unknown"),
            "stage": stage,
            "metadata": {
                "original_length": len(text),
                "cleaned_length": len(cleaned_text),
            },
        }

    def _process_instruction(self, doc: Dict[str, Any], source: DataSource) -> Optional[Dict[str, Any]]:
        if "conversations" in doc:
            conversations = doc["conversations"]
            for conv in conversations:
                if "content" in conv:
                    conv["content"] = self.cleaner.clean_text(conv["content"])

            return {
                "type": "conversation",
                "conversations": conversations,
                "language": source.language,
                "source": source.name,
            }

        elif "problem" in doc:
            return {
                "type": "code",
                "problem": doc["problem"],
                "description": self.cleaner.clean_text(doc.get("description", "")),
                "solution": self.cleaner.clean_text(doc.get("solution", "")),
                "language": source.language,
                "source": source.name,
            }

        elif "instruction" in doc:
            return {
                "type": "agent",
                "instruction": self.cleaner.clean_text(doc["instruction"]),
                "trajectory": doc.get("trajectory", []),
                "result": doc.get("result", ""),
                "language": source.language,
                "source": source.name,
            }

        return None

    def _generate_translation_pairs(self) -> Iterator[Dict[str, Any]]:
        translation_pairs = [
            {"zh": "人工智能正在改变世界", "en": "Artificial intelligence is changing the world"},
            {"zh": "机器学习是人工智能的核心技术", "en": "Machine learning is a core technology of AI"},
            {"zh": "深度学习使用神经网络进行学习", "en": "Deep learning uses neural networks for learning"},
            {"zh": "自然语言处理让计算机理解人类语言", "en": "NLP enables computers to understand human language"},
            {"zh": "计算机视觉让机器能够看见世界", "en": "Computer vision enables machines to see the world"},
        ]

        for pair in translation_pairs:
            yield {
                "type": "translation",
                "zh": pair["zh"],
                "en": pair["en"],
                "source": "translation_pairs",
            }

    def _chunk_text(self, text: str, max_length: int = 2048) -> List[str]:
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) + 2 <= max_length:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = para + "\n\n"

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks

    def save_dataset(
        self,
        data: Iterator[Dict[str, Any]],
        filename: str,
        max_samples: int = 100000,
    ) -> str:
        output_path = self.output_dir / f"{filename}.jsonl"

        with open(output_path, "w", encoding="utf-8") as f:
            count = 0
            for item in data:
                if count >= max_samples:
                    break
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
                count += 1

        self.stats.avg_doc_length = (
            self.stats.total_tokens / self.stats.total_docs
            if self.stats.total_docs > 0
            else 0
        )

        return str(output_path)

    def get_stats(self) -> Dict[str, Any]:
        return {
            "total_docs": self.stats.total_docs,
            "total_tokens": self.stats.total_tokens,
            "zh_docs": self.stats.zh_docs,
            "en_docs": self.stats.en_docs,
            "mixed_docs": self.stats.mixed_docs,
            "avg_doc_length": self.stats.avg_doc_length,
        }


class CurriculumScheduler:
    def __init__(
        self,
        stage_configs: Optional[List[Dict[str, Any]]] = None,
    ):
        self.stage_configs = stage_configs or [
            {
                "name": "stage1_bilingual_pretrain",
                "zh_ratio": 0.5,
                "en_ratio": 0.5,
                "code_switch_ratio": 0.0,
                "target_ppl_zh": 15.0,
                "target_ppl_en": 12.0,
                "duration": "2w",
            },
            {
                "name": "stage2_alignment",
                "zh_ratio": 0.35,
                "en_ratio": 0.35,
                "translation_ratio": 0.3,
                "duration": "1w",
            },
            {
                "name": "stage3_sft",
                "instruction_ratio": 1.0,
                "lora_rank": 128,
                "duration": "3d",
            },
            {
                "name": "stage4_dpo",
                "preference_data_ratio": 1.0,
                "duration": "2d",
            },
        ]
        self.current_stage = 0

    def get_current_config(self) -> Dict[str, Any]:
        if self.current_stage < len(self.stage_configs):
            return self.stage_configs[self.current_stage]
        return self.stage_configs[-1]

    def advance_stage(self) -> bool:
        if self.current_stage < len(self.stage_configs) - 1:
            self.current_stage += 1
            return True
        return False

    def should_advance(self, metrics: Dict[str, float]) -> bool:
        config = self.get_current_config()

        if "target_ppl_zh" in config and "ppl_zh" in metrics:
            if metrics["ppl_zh"] > config["target_ppl_zh"]:
                return False

        if "target_ppl_en" in config and "ppl_en" in metrics:
            if metrics["ppl_en"] > config["target_ppl_en"]:
                return False

        return True


def create_bilingual_dataset(
    output_dir: str = "data/processed",
    pretrain_samples: int = 100000,
    instruction_samples: int = 50000,
) -> Dict[str, str]:
    pipeline = BilingualDataPipeline(output_dir=output_dir)

    pretrain_data = pipeline.process_pretraining_corpus(
        zh_ratio=0.5,
        en_ratio=0.5,
        code_switch_ratio=0.1,
    )
    pretrain_path = pipeline.save_dataset(pretrain_data, "pretrain", pretrain_samples)

    pipeline.stats = DataStats()

    instruction_data = pipeline.process_instruction_data()
    instruction_path = pipeline.save_dataset(instruction_data, "instruction", instruction_samples)

    return {
        "pretrain": pretrain_path,
        "instruction": instruction_path,
        "stats": pipeline.get_stats(),
    }


if __name__ == "__main__":
    result = create_bilingual_dataset(
        output_dir="data/processed",
        pretrain_samples=10000,
        instruction_samples=5000,
    )
    print(f"Pretrain data saved to: {result['pretrain']}")
    print(f"Instruction data saved to: {result['instruction']}")
    print(f"Stats: {result['stats']}")

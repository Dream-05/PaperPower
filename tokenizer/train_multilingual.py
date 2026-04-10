"""
Multilingual BPE Tokenizer Training Script
双语平衡训练脚本
"""

import json
import regex
import unicodedata
import argparse
import random
import math
from pathlib import Path
from typing import Dict, List, Tuple, Set, Optional, Iterator
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing as mp

from .language_detector import LanguageDetector, Language


@dataclass
class TokenizerTrainingConfig:
    vocab_size: int = 50000
    min_frequency: int = 2
    show_progress: bool = True
    
    chinese_chars: int = 3500
    chinese_words: int = 20000
    english_roots: int = 5000
    english_words: int = 15000
    reserved_slots: int = 5000
    
    corpus_ratio: Dict[str, float] = field(default_factory=lambda: {
        'zh': 0.35,
        'en': 0.35,
        'code': 0.15,
        'parallel': 0.10,
        'other': 0.05,
    })


class MultilingualBPETrainer:
    GPT2_PATTERN = regex.compile(
        r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+""",
        regex.IGNORECASE
    )
    
    CJK_PATTERN = regex.compile(r'[\p{Han}\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+')
    
    CHINESE_PUNCT_PATTERN = regex.compile(
        r'[。，！？；：""''（）（）【】《》、·…—～]'
    )
    
    CHINESE_COMMON_WORDS = [
        "我们", "你们", "他们", "这个", "那个", "什么", "一个", "没有", "不是",
        "可以", "这是", "就是", "但是", "因为", "所以", "如果", "虽然", "然后",
        "现在", "已经", "自己", "没有", "我们", "他们", "这个", "一个", "我们",
        "进行", "以及", "其中", "由于", "对于", "关于", "通过", "进行", "能够",
        "应该", "需要", "可能", "这些", "那些", "一些", "其他", "之后", "之前",
        "时候", "地方", "问题", "情况", "方法", "过程", "结果", "原因", "时间",
        "人", "事", "物", "地", "时", "的", "了", "在", "是", "我", "有",
        "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到",
        "说", "要", "去", "你", "会", "着", "没有", "看", "好", "自己", "这",
        "人工智能", "机器学习", "深度学习", "神经网络", "自然语言", "计算机",
        "数据", "算法", "模型", "训练", "预测", "分析", "处理", "系统", "网络",
        "技术", "应用", "开发", "实现", "功能", "模块", "接口", "服务", "平台",
        "用户", "数据", "信息", "内容", "资源", "管理", "操作", "配置", "设置",
    ]
    
    ENGLISH_COMMON_WORDS = [
        "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
        "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
        "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
        "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
        "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
        "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
        "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
        "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
        "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
        "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
        "machine", "learning", "deep", "neural", "network", "natural", "language", "processing",
        "data", "algorithm", "model", "train", "predict", "analyze", "system", "technology",
        "application", "development", "function", "module", "interface", "service", "platform",
        "user", "information", "content", "resource", "management", "configuration",
    ]
    
    def __init__(self, config: TokenizerTrainingConfig):
        self.config = config
        self.language_detector = LanguageDetector()
        
        self.word_freq: Counter = Counter()
        self.pair_freq: Counter = Counter()
        
        self.vocab: Dict[str, int] = {}
        self.merges: List[Tuple[str, str]] = []
        
        self._init_special_tokens()
        self._init_base_vocab()
    
    def _init_special_tokens(self):
        special_tokens = [
            "<|endoftext|>", "<|zh|>", "<|en|>", "<|code|>",
            "<|im_start|>", "<|im_end|>", "<|tool|>",
            "<|thought|>", "<|hidden_thought|>",
        ]
        
        for i, token in enumerate(special_tokens):
            self.vocab[token] = i
    
    def _init_base_vocab(self):
        for char in self.CHINESE_COMMON_WORDS:
            if char not in self.vocab:
                self.vocab[char] = len(self.vocab)
        
        for word in self.ENGLISH_COMMON_WORDS:
            if word not in self.vocab:
                self.vocab[word] = len(self.vocab)
        
        byte_encoder = self._bytes_to_unicode()
        for char_code, char in byte_encoder.items():
            if char not in self.vocab:
                self.vocab[char] = len(self.vocab)
        
        punct = '。，！？；：""''（）（）【】《》、·…—～.,!?;:\'"()[]{}<>-'
        for p in punct:
            if p not in self.vocab:
                self.vocab[p] = len(self.vocab)
    
    def _bytes_to_unicode(self) -> Dict[int, str]:
        bs = list(range(ord("!"), ord("~") + 1))
        bs += list(range(ord("¡"), ord("¬") + 1))
        bs += list(range(ord("®"), ord("ÿ") + 1))
        
        cs = bs[:]
        n = 0
        for b in range(256):
            if b not in bs:
                bs.append(b)
                cs.append(256 + n)
                n += 1
        
        cs = [chr(c) for c in cs]
        return dict(zip(bs, cs))
    
    def train(self, corpus_paths: List[Path], output_path: Path):
        print("Phase 1: Collecting word frequencies...")
        self._collect_word_frequencies(corpus_paths)
        
        print(f"Total unique words: {len(self.word_freq)}")
        
        print("\nPhase 2: Building base vocabulary...")
        self._build_base_vocab()
        
        print(f"Vocabulary size: {len(self.vocab)}")
        
        print("\nPhase 3: Training BPE merges...")
        self._train_merges()
        
        print(f"\nTotal merges: {len(self.merges)}")
        
        print("\nPhase 4: Saving tokenizer...")
        self._save_tokenizer(output_path)
        
        print(f"Tokenizer saved to: {output_path}")
    
    def _collect_word_frequencies(self, corpus_paths: List[Path]):
        for corpus_path in corpus_paths:
            if not corpus_path.exists():
                print(f"Warning: Corpus path {corpus_path} does not exist, skipping...")
                continue
            
            if corpus_path.is_file():
                self._process_file(corpus_path)
            elif corpus_path.is_dir():
                for file_path in corpus_path.rglob("*.txt"):
                    self._process_file(file_path)
    
    def _process_file(self, file_path: Path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    line = unicodedata.normalize('NFKC', line)
                    words = self._tokenize(line)
                    self.word_freq.update(words)
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    def _tokenize(self, text: str) -> List[str]:
        tokens: List[str] = []
        
        segments = self.language_detector.segment_by_language(text)
        
        for segment in segments:
            lang = segment.language
            seg_text = segment.text
            
            if lang == Language.CHINESE:
                tokens.extend(self._tokenize_chinese(seg_text))
            elif lang == Language.ENGLISH:
                tokens.extend(self._tokenize_english(seg_text))
            else:
                tokens.extend(self._tokenize_english(seg_text))
        
        return tokens
    
    def _tokenize_chinese(self, text: str) -> List[str]:
        tokens: List[str] = []
        i = 0
        
        while i < len(text):
            if self.CHINESE_PUNCT_PATTERN.match(text, i):
                match = self.CHINESE_PUNCT_PATTERN.match(text, i)
                tokens.append(match.group())
                i = match.end()
            elif regex.match(r'\p{Han}', text[i]):
                j = i
                while j < len(text) and regex.match(r'\p{Han}', text[j]):
                    j += 1
                
                chinese_word = text[i:j]
                
                if len(chinese_word) >= 2:
                    for k in range(len(chinese_word) - 1):
                        tokens.append(chinese_word[k])
                        tokens.append(chinese_word[k + 1])
                else:
                    tokens.append(chinese_word)
                
                i = j
            elif text[i].isspace():
                i += 1
            else:
                tokens.append(text[i])
                i += 1
        
        return tokens
    
    def _tokenize_english(self, text: str) -> List[str]:
        matches = self.GPT2_PATTERN.findall(text)
        
        result = []
        for match in matches:
            result.append(match)
        
        return result
    
    def _build_base_vocab(self):
        for word, freq in self.word_freq.most_common(100000):
            if word not in self.vocab:
                self.vocab[word] = len(self.vocab)
    
    def _train_merges(self):
        word_cache: Dict[str, Tuple[str, ...]] = {}
        
        for word in self.word_freq.keys():
            word_cache[word] = tuple(word)
        
        self._compute_pair_frequencies(word_cache)
        
        target_vocab_size = self.config.vocab_size
        current_size = len(self.vocab)
        
        merge_count = 0
        max_merges = target_vocab_size - current_size
        
        while len(self.pair_freq) > 0 and merge_count < max_merges:
            if not self.pair_freq:
                break
            
            best_pair = max(self.pair_freq.keys(), key=lambda p: self.pair_freq[p])
            
            if self.pair_freq[best_pair] < self.config.min_frequency:
                break
            
            self.merges.append(best_pair)
            
            self._apply_merge(best_pair, word_cache)
            
            merge_count += 1
            
            if merge_count % 1000 == 0:
                print(f"  Progress: {merge_count}/{max_merges} merges, "
                      f"vocab size: {len(self.vocab)}")
    
    def _compute_pair_frequencies(self, word_cache: Dict[str, Tuple[str, ...]]):
        self.pair_freq.clear()
        
        for word, freq in self.word_freq.items():
            word_tuple = word_cache.get(word, tuple(word))
            
            if len(word_tuple) <= 1:
                continue
            
            for i in range(len(word_tuple) - 1):
                pair = (word_tuple[i], word_tuple[i + 1])
                self.pair_freq[pair] += freq
    
    def _apply_merge(self, merge_pair: Tuple[str, str], word_cache: Dict[str, Tuple[str, ...]]):
        first, second = merge_pair
        new_token = first + second
        
        self.vocab[new_token] = len(self.vocab)
        
        for word in list(word_cache.keys()):
            old_tuple = word_cache[word]
            new_tuple = self._merge_tuple(old_tuple, merge_pair)
            
            if new_tuple != old_tuple:
                word_cache[word] = new_tuple
        
        for pair in list(self.pair_freq.keys()):
            if first in pair or second in pair:
                del self.pair_freq[pair]
        
        self._recompute_pair_frequencies(word_cache)
    
    def _merge_tuple(self, word: Tuple[str, ...], pair: Tuple[str, str]) -> Tuple[str, ...]:
        result: List[str] = []
        i = 0
        
        while i < len(word):
            if i < len(word) - 1 and word[i] == pair[0] and word[i + 1] == pair[1]:
                result.append(pair[0] + pair[1])
                i += 2
            else:
                result.append(word[i])
                i += 1
        
        return tuple(result)
    
    def _recompute_pair_frequencies(self, word_cache: Dict[str, Tuple[str, ...]]):
        temp_freq: Counter = Counter()
        
        for word, freq in self.word_freq.items():
            word_tuple = word_cache.get(word, tuple(word))
            
            if len(word_tuple) <= 1:
                continue
            
            for i in range(len(word_tuple) - 1):
                pair = (word_tuple[i], word_tuple[i + 1])
                temp_freq[pair] += freq
        
        self.pair_freq = temp_freq
    
    def _save_tokenizer(self, output_path: Path):
        output_path.mkdir(parents=True, exist_ok=True)
        
        vocab_path = output_path / "vocab.json"
        with open(vocab_path, 'w', encoding='utf-8') as f:
            json.dump(self.vocab, f, ensure_ascii=False, indent=2)
        
        merges_path = output_path / "merges.txt"
        with open(merges_path, 'w', encoding='utf-8') as f:
            for a, b in self.merges:
                f.write(f"{a} {b}\n")
        
        config = {
            'vocab_size': self.config.vocab_size,
            'chinese_chars': self.config.chinese_chars,
            'chinese_words': self.config.chinese_words,
            'english_roots': self.config.english_roots,
            'english_words': self.config.english_words,
            'reserved_slots': self.config.reserved_slots,
            'corpus_ratio': self.config.corpus_ratio,
        }
        
        config_path = output_path / "config.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)


def train_tokenizer(
    corpus_paths: List[str],
    output_path: str,
    vocab_size: int = 50000,
    min_frequency: int = 2,
):
    config = TokenizerTrainingConfig(
        vocab_size=vocab_size,
        min_frequency=min_frequency,
    )
    
    trainer = MultilingualBPETrainer(config)
    
    paths = [Path(p) for p in corpus_paths]
    output = Path(output_path)
    
    trainer.train(paths, output)
    
    return trainer


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Multilingual BPE Tokenizer")
    
    parser.add_argument(
        "--corpus",
        nargs="+",
        required=True,
        help="Path to corpus files or directories",
    )
    
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output path for tokenizer",
    )
    
    parser.add_argument(
        "--vocab-size",
        type=int,
        default=50000,
        help="Target vocabulary size",
    )
    
    parser.add_argument(
        "--min-frequency",
        type=int,
        default=2,
        help="Minimum frequency for BPE merges",
    )
    
    args = parser.parse_args()
    
    train_tokenizer(
        corpus_paths=args.corpus,
        output_path=args.output,
        vocab_size=args.vocab_size,
        min_frequency=args.min_frequency,
    )

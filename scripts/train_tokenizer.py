#!/usr/bin/env python3
"""
Tokenizer Training Script
分词器训练脚本 - 训练并保存词表
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
from collections import Counter
from tqdm import tqdm
import regex

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class BPETokenizerTrainer:
    def __init__(self, vocab_size: int = 50000, min_frequency: int = 2):
        self.vocab_size = vocab_size
        self.min_frequency = min_frequency
        self.vocab: Dict[str, int] = {}
        self.merges: List[Tuple[str, str]] = []
        self.byte_encoder = self._bytes_to_unicode()
    
    def train(self, texts: List[str]) -> 'BPETokenizerTrainer':
        logger.info("Counting word frequencies...")
        
        word_freqs: Counter = Counter()
        for text in tqdm(texts, desc="Counting"):
            words = self._tokenize_to_words(text)
            for word in words:
                word_freqs[word] += 1
        
        word_freqs = Counter({w: c for w, c in word_freqs.items() if c >= self.min_frequency})
        logger.info(f"Found {len(word_freqs)} unique words")
        
        logger.info("Building initial vocabulary...")
        self._build_initial_vocab(word_freqs)
        logger.info(f"Initial vocab size: {len(self.vocab)}")
        
        logger.info("Learning BPE merges...")
        self._learn_bpe(word_freqs)
        logger.info(f"Final vocab size: {len(self.vocab)}")
        
        return self
    
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
    
    def _tokenize_to_words(self, text: str) -> List[str]:
        pattern = regex.compile(
            r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+""",
            regex.IGNORECASE
        )
        return pattern.findall(text)
    
    def _build_initial_vocab(self, word_freqs: Counter):
        special_tokens = [
            "<|endoftext|>", "<|zh|>", "<|en|>", "<|code|>",
            "<|im_start|>", "<|im_end|>",
            "<|tool|>", "<|thought|>", "<|hidden_thought|>",
        ]
        
        for i, token in enumerate(special_tokens):
            self.vocab[token] = i
        
        char_freqs: Counter = Counter()
        for word, freq in word_freqs.items():
            word_bytes = word.encode('utf-8')
            word_unicode = ''.join(self.byte_encoder[b] for b in word_bytes)
            for char in word_unicode:
                char_freqs[char] += freq
        
        sorted_chars = sorted(char_freqs.items(), key=lambda x: -x[1])
        for char, _ in sorted_chars:
            if char not in self.vocab:
                self.vocab[char] = len(self.vocab)
    
    def _learn_bpe(self, word_freqs: Counter):
        splits: Dict[str, List[str]] = {}
        for word in word_freqs:
            word_bytes = word.encode('utf-8')
            word_unicode = ''.join(self.byte_encoder[b] for b in word_bytes)
            splits[word] = list(word_unicode)
        
        num_merges = self.vocab_size - len(self.vocab)
        
        pbar = tqdm(total=num_merges, desc="Learning BPE")
        
        while len(self.vocab) < self.vocab_size:
            pair_freqs = self._get_pair_freqs(word_freqs, splits)
            
            if not pair_freqs:
                break
            
            best_pair = max(pair_freqs, key=pair_freqs.get)
            
            if pair_freqs[best_pair] < self.min_frequency:
                break
            
            self.merges.append(best_pair)
            new_token = best_pair[0] + best_pair[1]
            self.vocab[new_token] = len(self.vocab)
            
            splits = self._merge_pair(best_pair, word_freqs, splits)
            
            pbar.update(1)
        
        pbar.close()
    
    def _get_pair_freqs(self, word_freqs: Counter, splits: Dict[str, List[str]]) -> Counter:
        pair_freqs: Counter = Counter()
        for word, freq in word_freqs.items():
            split = splits.get(word, [])
            if len(split) < 2:
                continue
            for i in range(len(split) - 1):
                pair = (split[i], split[i + 1])
                pair_freqs[pair] += freq
        return pair_freqs
    
    def _merge_pair(
        self,
        pair: Tuple[str, str],
        word_freqs: Counter,
        splits: Dict[str, List[str]],
    ) -> Dict[str, List[str]]:
        new_splits = {}
        bigram = pair
        replacement = pair[0] + pair[1]
        
        for word in splits:
            split = splits[word]
            new_split = []
            i = 0
            
            while i < len(split):
                if i < len(split) - 1 and split[i] == bigram[0] and split[i + 1] == bigram[1]:
                    new_split.append(replacement)
                    i += 2
                else:
                    new_split.append(split[i])
                    i += 1
            
            new_splits[word] = new_split
        
        return new_splits
    
    def save(self, output_dir: str):
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        vocab_path = output_path / "vocab.json"
        with open(vocab_path, 'w', encoding='utf-8') as f:
            json.dump(self.vocab, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved vocab to {vocab_path}")
        
        merges_path = output_path / "merges.txt"
        with open(merges_path, 'w', encoding='utf-8') as f:
            for pair in self.merges:
                f.write(f"{pair[0]} {pair[1]}\n")
        logger.info(f"Saved merges to {merges_path}")
        
        config = {
            "vocab_size": self.vocab_size,
            "min_frequency": self.min_frequency,
        }
        config_path = output_path / "config.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"Tokenizer saved to {output_dir}")


def load_training_data(data_path: str) -> List[str]:
    texts = []
    data_path = Path(data_path)
    
    if data_path.is_file():
        if data_path.suffix == '.jsonl':
            with open(data_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        if 'text' in data:
                            texts.append(data['text'])
        elif data_path.suffix in ['.txt', '.md']:
            with open(data_path, 'r', encoding='utf-8') as f:
                texts.append(f.read())
    elif data_path.is_dir():
        for file_path in data_path.glob('**/*.jsonl'):
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data = json.loads(line)
                        if 'text' in data:
                            texts.append(data['text'])
    
    return texts


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Train BPE Tokenizer")
    parser.add_argument("--data_path", type=str, default="data/processed", help="Path to training data")
    parser.add_argument("--output_dir", type=str, default="vocab/multilingual_50k", help="Output directory")
    parser.add_argument("--vocab_size", type=int, default=50000, help="Vocabulary size")
    parser.add_argument("--min_frequency", type=int, default=2, help="Minimum frequency")
    args = parser.parse_args()
    
    logger.info("="*50)
    logger.info("Training BPE Tokenizer")
    logger.info("="*50)
    
    logger.info(f"Loading data from {args.data_path}...")
    texts = load_training_data(args.data_path)
    logger.info(f"Loaded {len(texts)} texts")
    
    if len(texts) == 0:
        logger.warning("No training data found. Creating sample data...")
        sample_texts = [
            "人工智能是计算机科学的一个重要分支。",
            "Machine learning is a subset of artificial intelligence.",
            "深度学习使用多层神经网络进行特征学习。",
            "Natural language processing enables computers to understand human language.",
            "Python是一种流行的编程语言，广泛用于AI开发。",
        ] * 1000
        texts = sample_texts
    
    trainer = BPETokenizerTrainer(
        vocab_size=args.vocab_size,
        min_frequency=args.min_frequency,
    )
    
    trainer.train(texts)
    trainer.save(args.output_dir)
    
    logger.info("="*50)
    logger.info("Tokenizer Training Complete!")
    logger.info("="*50)


if __name__ == "__main__":
    main()

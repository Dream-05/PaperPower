#!/usr/bin/env python3
"""
训练50000词表的分词器
"""

import json
import os
from pathlib import Path
from collections import Counter
import re

class BPETokenizerTrainer:
    """BPE分词器训练器"""
    
    def __init__(self, vocab_size=50000):
        self.vocab_size = vocab_size
        self.vocab = {}
        self.merges = []
        self.base_vocab = self._create_base_vocab()
    
    def _create_base_vocab(self):
        """创建基础词表"""
        vocab = {}
        
        special_tokens = [
            "<pad>", "<unk>", "<bos>", "<eos>",
            "<|zh|>", "<|en|>", "<|code|>",
            "<|instruction|>", "<|input|>", "<|output|>",
        ]
        for i, token in enumerate(special_tokens):
            vocab[token] = i
        
        idx = len(vocab)
        for i in range(256):
            vocab[chr(i)] = idx + i
        
        idx = len(vocab)
        common_chinese = "的一是不了在人有我他这个们中来上大为和国地到以说时要就出会可也你对生能而子那得于着下自之年过发后作里如家多成回两者都当等对民起与也个已好从进前明开些成天比又行问但只知学作便点定应关三各能实其向意头力情正业外将两高间由问很最重并物手应战向头文体政美相见被利什二等产或新己制身果加西斯月话合回特代内信表化老给世位次度门任常先海通教儿原东声提立及比员解水名真论处走义各入几口认条平系气题活尔更别打女变四神总何电数安少报才结反受目太量再感建务做接必场件计管期市直德资命山金指克许统区保至队形社便空决治展马科司五基眼书非则听白却界达光放强即像难且权思王象完设式色路记南品住告类求据程北边死张该交规万取拉格望觉术领共确传师观清今切院让识候带导争运笔志认准"
        
        for char in common_chinese:
            if char not in vocab:
                vocab[char] = len(vocab)
        
        return vocab
    
    def train(self, corpus_path, output_dir):
        """训练分词器"""
        print(f"训练分词器，目标词表大小: {self.vocab_size}")
        
        print("读取语料...")
        texts = []
        corpus_path = Path(corpus_path)
        
        if corpus_path.is_file():
            with open(corpus_path, 'r', encoding='utf-8') as f:
                for line in f:
                    try:
                        item = json.loads(line)
                        text = item.get('text', '')
                        if text:
                            texts.append(text)
                    except:
                        pass
        elif corpus_path.is_dir():
            for file_path in corpus_path.glob("*.jsonl"):
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            item = json.loads(line)
                            text = item.get('text', '')
                            if text:
                                texts.append(text)
                        except:
                            pass
        
        print(f"读取了 {len(texts)} 条文本")
        
        print("统计词频...")
        word_freqs = Counter()
        for text in texts:
            words = re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+|[0-9]+|\S+', text)
            for word in words:
                word_freqs[word] += 1
        
        print(f"统计了 {len(word_freqs)} 个不同的词")
        
        self.vocab = self.base_vocab.copy()
        
        print("添加高频词...")
        for word, freq in word_freqs.most_common(self.vocab_size - len(self.vocab)):
            if word not in self.vocab:
                self.vocab[word] = len(self.vocab)
                if len(self.vocab) >= self.vocab_size:
                    break
        
        print(f"最终词表大小: {len(self.vocab)}")
        
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        vocab_file = output_dir / "vocab.json"
        with open(vocab_file, 'w', encoding='utf-8') as f:
            json.dump(self.vocab, f, ensure_ascii=False, indent=2)
        print(f"词表已保存到: {vocab_file}")
        
        config = {
            "vocab_size": len(self.vocab),
            "chinese_chars": sum(1 for k in self.vocab if len(k) == 1 and '\u4e00' <= k <= '\u9fff'),
            "chinese_words": sum(1 for k in self.vocab if len(k) > 1 and any('\u4e00' <= c <= '\u9fff' for c in k)),
            "english_words": sum(1 for k in self.vocab if k.isalpha() and k.isascii()),
            "special_tokens": 10,
        }
        config_file = output_dir / "config.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        print(f"配置已保存到: {config_file}")
        
        merges_file = output_dir / "merges.txt"
        with open(merges_file, 'w', encoding='utf-8') as f:
            f.write("#version: 0.2\n")
        print(f"合并规则已保存到: {merges_file}")
        
        return self.vocab


def main():
    print("=" * 60)
    print("训练50000词表分词器")
    print("=" * 60)
    
    trainer = BPETokenizerTrainer(vocab_size=50000)
    
    vocab = trainer.train(
        corpus_path="data/pretrain/combined_large.jsonl",
        output_dir="vocab/vocab/multilingual_50k"
    )
    
    print("\n" + "=" * 60)
    print("训练完成!")
    print("=" * 60)
    print(f"词表大小: {len(vocab)}")


if __name__ == "__main__":
    main()

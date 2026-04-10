"""
International BPE Tokenizer
生产级多语言BPE Tokenizer，针对中英双语优化
支持预训练词表加载和增量训练
"""

import json
import regex
import unicodedata
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set, Union, Iterator
from collections import defaultdict, Counter
from dataclasses import dataclass, field
import pickle
import logging

logger = logging.getLogger(__name__)


@dataclass
class TokenizerConfig:
    vocab_size: int = 50000
    chinese_chars: int = 8000
    chinese_words: int = 20000
    english_roots: int = 5000
    english_words: int = 15000
    reserved_slots: int = 5000
    
    special_tokens: List[str] = field(default_factory=lambda: [
        "",
        "<|zh|>",
        "<|en|>",
        "<|code|>",
        "<|im_start|>",
        "<|im_end|>",
        "<|tool|>",
        "<|thought|>",
        "<|hidden_thought|>",
        "<|system|>",
        "<|user|>",
        "<|assistant|",
    ])


SPECIAL_TOKENS = {
    "": 0,
    "<|zh|>": 1,
    "<|en|>": 2,
    "<|code|>": 3,
    "<|im_start|>": 4,
    "<|im_end|>": 5,
    "<|tool|>": 6,
    "<|thought|>": 7,
    "<|hidden_thought|>": 8,
    "<|system|>": 9,
    "<|user|>": 10,
    "<|assistant|": 11,
}

SPECIAL_TOKENS_INV = {v: k for k, v in SPECIAL_TOKENS.items()}


class Language:
    CHINESE = "zh"
    ENGLISH = "en"
    JAPANESE = "ja"
    KOREAN = "ko"
    CODE = "code"
    UNKNOWN = "unknown"


class LanguageDetector:
    HAN_PATTERN = regex.compile(r'[\u4e00-\u9fff\u3400-\u4dbf]')
    LATIN_PATTERN = regex.compile(r'[a-zA-Z]')
    HIRAGANA_PATTERN = regex.compile(r'[\u3040-\u309f]')
    KATAKANA_PATTERN = regex.compile(r'[\u30a0-\u30ff]')
    HANGUL_PATTERN = regex.compile(r'[\uac00-\ud7af]')
    
    @classmethod
    def detect(cls, text: str) -> str:
        if not text or not text.strip():
            return Language.UNKNOWN
        
        clean_text = regex.sub(r'[\s\d\p{P}]', '', text)
        if not clean_text:
            return Language.UNKNOWN
        
        han_chars = cls.HAN_PATTERN.findall(clean_text)
        latin_chars = cls.LATIN_PATTERN.findall(clean_text)
        hiragana_chars = cls.HIRAGANA_PATTERN.findall(clean_text)
        hangul_chars = cls.HANGUL_PATTERN.findall(clean_text)
        
        total_len = len(clean_text)
        
        han_ratio = len(han_chars) / total_len
        latin_ratio = len(latin_chars) / total_len
        hiragana_ratio = len(hiragana_chars) / total_len
        hangul_ratio = len(hangul_chars) / total_len
        
        if hiragana_ratio > 0.1:
            return Language.JAPANESE
        if hangul_ratio > 0.1:
            return Language.KOREAN
        if han_ratio > 0.3 and latin_ratio > 0.2:
            return Language.UNKNOWN
        if han_ratio > 0.3:
            return Language.CHINESE
        if latin_ratio > 0.3:
            return Language.ENGLISH
        
        return Language.UNKNOWN
    
    @classmethod
    def segment_by_language(cls, text: str) -> List[Tuple[str, str]]:
        segments = []
        current_segment = ""
        current_lang = None
        
        for char in text:
            char_lang = cls._detect_char_language(char)
            
            if current_lang is None:
                current_lang = char_lang
                current_segment = char
            elif char_lang == current_lang or char_lang == Language.UNKNOWN:
                current_segment += char
            else:
                if current_segment:
                    segments.append((current_segment, current_lang))
                current_segment = char
                current_lang = char_lang
        
        if current_segment:
            segments.append((current_segment, current_lang))
        
        return segments
    
    @classmethod
    def _detect_char_language(cls, char: str) -> str:
        if cls.HAN_PATTERN.match(char):
            return Language.CHINESE
        if cls.LATIN_PATTERN.match(char):
            return Language.ENGLISH
        if cls.HIRAGANA_PATTERN.match(char) or cls.KATAKANA_PATTERN.match(char):
            return Language.JAPANESE
        if cls.HANGUL_PATTERN.match(char):
            return Language.KOREAN
        return Language.UNKNOWN


class MultilingualBPETokenizer:
    GPT2_PATTERN = regex.compile(
        r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+""",
        regex.IGNORECASE
    )
    
    CJK_PATTERN = regex.compile(r'[\p{Han}]+')
    CHINESE_PUNCT_PATTERN = regex.compile(r'[。，！？；：""''（）（）【】《》、·…—～]')
    NUMBER_PATTERN = regex.compile(r'\d+(?:\.\d+)?(?:[eE][+-]?\d+)?')
    WHITESPACE_PATTERN = regex.compile(r'[ \t]+')
    NEWLINE_PATTERN = regex.compile(r'\n+')
    
    def __init__(
        self,
        vocab: Optional[Dict[str, int]] = None,
        merges: Optional[Dict[Tuple[str, str], int]] = None,
        config: Optional[TokenizerConfig] = None,
    ):
        self.config = config or TokenizerConfig()
        self.language_detector = LanguageDetector()
        
        self.vocab: Dict[str, int] = vocab or {}
        self.vocab_inverse: Dict[int, str] = {v: k for k, v in self.vocab.items()}
        self.merges: Dict[Tuple[str, str], int] = merges or {}
        self.merge_ranks: Dict[Tuple[str, str], int] = {}
        
        self.byte_encoder = self._bytes_to_unicode()
        self.byte_decoder = {v: k for k, v in self.byte_encoder.items()}
        
        self.cache: Dict[str, List[str]] = {}
        
        self._init_special_tokens()
        self._compile_patterns()
    
    def _init_special_tokens(self):
        for token, token_id in SPECIAL_TOKENS.items():
            if token not in self.vocab:
                self.vocab[token] = token_id
                self.vocab_inverse[token_id] = token
    
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
    
    def _compile_patterns(self):
        self.token_pattern = regex.compile(
            r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+""",
            regex.IGNORECASE
        )
        self.chinese_word_pattern = regex.compile(r'[\p{Han}]{2,}')
        self.mixed_boundary_pattern = regex.compile(
            r'(?<=[\p{Han}])(?=[a-zA-Z])|(?<=[a-zA-Z])(?=[\p{Han}])'
        )
    
    def _pre_tokenize(self, text: str) -> List[Tuple[str, str]]:
        segments = self.language_detector.segment_by_language(text)
        tokens_with_lang: List[Tuple[str, str]] = []
        
        for segment_text, lang in segments:
            if lang == Language.CHINESE:
                tokens_with_lang.extend(self._pre_tokenize_chinese(segment_text))
            elif lang == Language.ENGLISH:
                tokens_with_lang.extend(self._pre_tokenize_english(segment_text))
            elif lang in (Language.JAPANESE, Language.KOREAN):
                tokens_with_lang.extend(self._pre_tokenize_cjk(segment_text, lang))
            else:
                tokens_with_lang.extend(self._pre_tokenize_general(segment_text))
        
        return tokens_with_lang
    
    def _pre_tokenize_chinese(self, text: str) -> List[Tuple[str, str]]:
        tokens: List[Tuple[str, str]] = []
        i = 0
        
        while i < len(text):
            if self.CHINESE_PUNCT_PATTERN.match(text, i):
                match = self.CHINESE_PUNCT_PATTERN.match(text, i)
                tokens.append((match.group(), Language.CHINESE))
                i = match.end()
            elif self.NUMBER_PATTERN.match(text, i):
                match = self.NUMBER_PATTERN.match(text, i)
                tokens.append((match.group(), Language.CHINESE))
                i = match.end()
            elif self.WHITESPACE_PATTERN.match(text, i):
                match = self.WHITESPACE_PATTERN.match(text, i)
                space_token = 'Ġ' * len(match.group())
                tokens.append((space_token, Language.CHINESE))
                i = match.end()
            elif self.NEWLINE_PATTERN.match(text, i):
                match = self.NEWLINE_PATTERN.match(text, i)
                for _ in range(len(match.group())):
                    tokens.append(('\n', Language.CHINESE))
                i = match.end()
            elif regex.match(r'\p{Han}', text[i]):
                j = i
                while j < len(text) and regex.match(r'\p{Han}', text[j]):
                    j += 1
                chinese_chars = text[i:j]
                
                if chinese_chars in self.vocab:
                    tokens.append((chinese_chars, Language.CHINESE))
                else:
                    for char in chinese_chars:
                        tokens.append((char, Language.CHINESE))
                i = j
            else:
                tokens.append((text[i], Language.CHINESE))
                i += 1
        
        return tokens
    
    def _pre_tokenize_english(self, text: str) -> List[Tuple[str, str]]:
        tokens: List[Tuple[str, str]] = []
        matches = list(self.token_pattern.finditer(text))
        
        for match in matches:
            token = match.group()
            if token.startswith(' '):
                token = 'Ġ' + token[1:]
            tokens.append((token, Language.ENGLISH))
        
        return tokens
    
    def _pre_tokenize_cjk(self, text: str, lang: str) -> List[Tuple[str, str]]:
        tokens: List[Tuple[str, str]] = []
        i = 0
        
        while i < len(text):
            char = text[i]
            if self.WHITESPACE_PATTERN.match(text, i):
                match = self.WHITESPACE_PATTERN.match(text, i)
                space_token = 'Ġ' * len(match.group())
                tokens.append((space_token, lang))
                i = match.end()
            elif self.NEWLINE_PATTERN.match(text, i):
                match = self.NEWLINE_PATTERN.match(text, i)
                for _ in range(len(match.group())):
                    tokens.append(('\n', lang))
                i = match.end()
            else:
                tokens.append((char, lang))
                i += 1
        
        return tokens
    
    def _pre_tokenize_general(self, text: str) -> List[Tuple[str, str]]:
        tokens: List[Tuple[str, str]] = []
        matches = list(self.token_pattern.finditer(text))
        
        for match in matches:
            token = match.group()
            if token.startswith(' '):
                token = 'Ġ' + token[1:]
            tokens.append((token, Language.UNKNOWN))
        
        return tokens
    
    def _get_pairs(self, word: Tuple[str, ...]) -> Set[Tuple[str, str]]:
        pairs: Set[Tuple[str, str]] = set()
        prev_char = word[0]
        
        for char in word[1:]:
            pairs.add((prev_char, char))
            prev_char = char
        
        return pairs
    
    def _bpe(self, token: str) -> List[str]:
        if token in self.cache:
            return self.cache[token]
        
        word = tuple(token)
        
        if len(word) <= 1:
            return [token]
        
        pairs = self._get_pairs(word)
        
        if not pairs:
            return [token]
        
        while True:
            bigram = min(pairs, key=lambda p: self.merge_ranks.get(p, float('inf')))
            
            if bigram not in self.merge_ranks:
                break
            
            first, second = bigram
            new_word: List[str] = []
            i = 0
            
            while i < len(word):
                try:
                    j = word.index(first, i)
                    new_word.extend(word[i:j])
                    i = j
                except ValueError:
                    new_word.extend(word[i:])
                    break
                
                if i < len(word) - 1 and word[i] == first and word[i + 1] == second:
                    new_word.append(first + second)
                    i += 2
                else:
                    new_word.append(word[i])
                    i += 1
            
            word = tuple(new_word)
            
            if len(word) == 1:
                break
            
            pairs = self._get_pairs(word)
        
        result = list(word)
        self.cache[token] = result
        return result
    
    def _tokenize_segment(self, token: str, lang: str) -> List[str]:
        if lang == Language.CHINESE:
            if token in self.vocab:
                return [token]
            
            if regex.match(r'^\p{Han}+$', token):
                if len(token) == 1:
                    return [token]
                
                for i in range(len(token), 0, -1):
                    for j in range(len(token) - i + 1):
                        sub = token[j:j + i]
                        if sub in self.vocab:
                            remaining_before = self._tokenize_segment(token[:j], lang) if j > 0 else []
                            remaining_after = self._tokenize_segment(token[j + i:], lang) if j + i < len(token) else []
                            return remaining_before + [sub] + remaining_after
                
                return list(token)
        
        if token in SPECIAL_TOKENS:
            return [token]
        
        token_bytes = token.encode('utf-8')
        token_unicode = ''.join(self.byte_encoder[b] for b in token_bytes)
        
        return self._bpe(token_unicode)
    
    def encode(self, text: str, add_special_tokens: bool = False) -> List[int]:
        if not text:
            return []
        
        text = unicodedata.normalize('NFKC', text)
        pre_tokens = self._pre_tokenize(text)
        token_ids: List[int] = []
        
        if add_special_tokens:
            lang = self.language_detector.detect(text)
            if lang == Language.CHINESE:
                token_ids.append(SPECIAL_TOKENS["<|zh|>"])
            elif lang == Language.ENGLISH:
                token_ids.append(SPECIAL_TOKENS["<|en|>"])
        
        for token, lang in pre_tokens:
            if token in SPECIAL_TOKENS:
                token_ids.append(SPECIAL_TOKENS[token])
                continue
            
            sub_tokens = self._tokenize_segment(token, lang)
            
            for sub_token in sub_tokens:
                if sub_token in self.vocab:
                    token_ids.append(self.vocab[sub_token])
                else:
                    for char in sub_token:
                        if char in self.vocab:
                            token_ids.append(self.vocab[char])
                        else:
                            char_bytes = char.encode('utf-8')
                            for b in char_bytes:
                                byte_char = self.byte_encoder[b]
                                if byte_char in self.vocab:
                                    token_ids.append(self.vocab[byte_char])
        
        return token_ids
    
    def decode(self, token_ids: List[int], skip_special_tokens: bool = False) -> str:
        tokens: List[str] = []
        
        for token_id in token_ids:
            if token_id in SPECIAL_TOKENS_INV:
                if not skip_special_tokens:
                    tokens.append(SPECIAL_TOKENS_INV[token_id])
            elif token_id in self.vocab_inverse:
                tokens.append(self.vocab_inverse[token_id])
        
        text = ''.join(tokens)
        text = regex.sub(r'Ġ+', lambda m: ' ' * len(m.group()), text)
        
        byte_list: List[int] = []
        for char in text:
            if char in self.byte_decoder:
                byte_list.append(self.byte_decoder[char])
            else:
                byte_list.extend(char.encode('utf-8'))
        
        try:
            return bytes(byte_list).decode('utf-8', errors='replace')
        except Exception:
            return text
    
    def __call__(
        self,
        text: Union[str, List[str]],
        max_length: int = 4096,
        padding: str = 'max_length',
        truncation: bool = True,
        return_tensors: str = 'pt',
        add_special_tokens: bool = False,
    ) -> Dict[str, any]:
        if isinstance(text, str):
            text = [text]
        
        all_input_ids = []
        all_attention_mask = []
        
        for t in text:
            input_ids = self.encode(t, add_special_tokens=add_special_tokens)
            
            if truncation and len(input_ids) > max_length:
                input_ids = input_ids[:max_length]
            
            attention_mask = [1] * len(input_ids)
            
            if padding == 'max_length':
                pad_length = max_length - len(input_ids)
                input_ids = input_ids + [0] * pad_length
                attention_mask = attention_mask + [0] * pad_length
            
            all_input_ids.append(input_ids)
            all_attention_mask.append(attention_mask)
        
        if return_tensors == 'pt':
            import torch
            return {
                'input_ids': torch.tensor(all_input_ids, dtype=torch.long),
                'attention_mask': torch.tensor(all_attention_mask, dtype=torch.long),
            }
        
        return {
            'input_ids': all_input_ids,
            'attention_mask': all_attention_mask,
        }
    
    def get_vocab(self) -> Dict[str, int]:
        return dict(self.vocab)
    
    def get_vocab_size(self) -> int:
        return len(self.vocab)
    
    def token_to_id(self, token: str) -> Optional[int]:
        return self.vocab.get(token)
    
    def id_to_token(self, token_id: int) -> Optional[str]:
        return self.vocab_inverse.get(token_id)
    
    def save(self, path: Union[str, Path]):
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        
        vocab_path = path / "vocab.json"
        with open(vocab_path, 'w', encoding='utf-8') as f:
            json.dump(self.vocab, f, ensure_ascii=False, indent=2)
        
        merges_path = path / "merges.txt"
        with open(merges_path, 'w', encoding='utf-8') as f:
            for (a, b), rank in sorted(self.merge_ranks.items(), key=lambda x: x[1]):
                f.write(f"{a} {b}\n")
        
        config_path = path / "config.json"
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump({
                'vocab_size': self.config.vocab_size,
                'chinese_chars': self.config.chinese_chars,
                'chinese_words': self.config.chinese_words,
                'english_roots': self.config.english_roots,
                'english_words': self.config.english_words,
                'reserved_slots': self.config.reserved_slots,
            }, f, indent=2)
    
    @classmethod
    def load(cls, path: Union[str, Path]) -> 'MultilingualBPETokenizer':
        path = Path(path)
        
        vocab_path = path / "vocab.json"
        if not vocab_path.exists():
            logger.warning(f"Vocab file not found at {vocab_path}, creating new tokenizer")
            return cls()
        
        with open(vocab_path, 'r', encoding='utf-8') as f:
            vocab = json.load(f)
        
        merges: Dict[Tuple[str, str], int] = {}
        merge_ranks: Dict[Tuple[str, str], int] = {}
        merges_path = path / "merges.txt"
        
        if merges_path.exists():
            with open(merges_path, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f):
                    line = line.strip()
                    if line:
                        parts = line.split(' ', 1)
                        if len(parts) == 2:
                            merge = (parts[0], parts[1])
                            merges[merge] = i
                            merge_ranks[merge] = i
        
        config_path = path / "config.json"
        config = None
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config_dict = json.load(f)
                config = TokenizerConfig(**config_dict)
        
        tokenizer = cls(vocab=vocab, merges=merges, config=config)
        tokenizer.merge_ranks = merge_ranks
        
        return tokenizer
    
    @classmethod
    def from_pretrained(cls, model_name: str) -> 'MultilingualBPETokenizer':
        if model_name in ['gpt2', 'gpt2-medium', 'gpt2-large', 'gpt2-xl']:
            return cls._load_gpt2_tokenizer(model_name)
        elif model_name in ['bert-base-chinese', 'bert-base-multilingual-cased']:
            return cls._load_bert_tokenizer(model_name)
        else:
            local_path = Path("vocab") / model_name
            if local_path.exists():
                return cls.load(local_path)
            raise ValueError(f"Unknown tokenizer: {model_name}")
    
    @classmethod
    def _load_gpt2_tokenizer(cls, model_name: str) -> 'MultilingualBPETokenizer':
        try:
            from transformers import GPT2Tokenizer
            hf_tokenizer = GPT2Tokenizer.from_pretrained(model_name)
            
            tokenizer = cls()
            tokenizer.vocab = dict(hf_tokenizer.encoder)
            tokenizer.vocab_inverse = {v: k for k, v in tokenizer.vocab.items()}
            tokenizer.merge_ranks = {tuple(k.split()): v for k, v in hf_tokenizer.bpe_ranks.items()}
            
            return tokenizer
        except ImportError:
            raise ImportError("Please install transformers: pip install transformers")
    
    @classmethod
    def _load_bert_tokenizer(cls, model_name: str) -> 'MultilingualBPETokenizer':
        try:
            from transformers import BertTokenizer
            hf_tokenizer = BertTokenizer.from_pretrained(model_name)
            
            tokenizer = cls()
            tokenizer.vocab = hf_tokenizer.vocab
            tokenizer.vocab_inverse = {v: k for k, v in tokenizer.vocab.items()}
            
            return tokenizer
        except ImportError:
            raise ImportError("Please install transformers: pip install transformers")
    
    def add_tokens(self, tokens: List[str]) -> int:
        added = 0
        for token in tokens:
            if token not in self.vocab:
                new_id = len(self.vocab)
                self.vocab[token] = new_id
                self.vocab_inverse[new_id] = token
                added += 1
        return added
    
    def compute_compression_ratio(self, text: str) -> float:
        if not text:
            return 0.0
        
        char_count = len(text)
        token_count = len(self.encode(text))
        
        if token_count == 0:
            return 0.0
        
        return char_count / token_count
    
    def get_token_stats(self, text: str) -> Dict[str, float]:
        token_ids = self.encode(text)
        
        stats = {
            'char_count': len(text),
            'token_count': len(token_ids),
            'compression_ratio': self.compute_compression_ratio(text),
            'unique_tokens': len(set(token_ids)),
        }
        
        stats['detected_language'] = self.language_detector.detect(text)
        
        return stats


def create_tokenizer(
    vocab_path: Optional[Union[str, Path]] = None,
    config: Optional[TokenizerConfig] = None,
) -> MultilingualBPETokenizer:
    if vocab_path:
        return MultilingualBPETokenizer.load(vocab_path)
    
    return MultilingualBPETokenizer(config=config)


if __name__ == "__main__":
    tokenizer = MultilingualBPETokenizer()
    
    test_texts = [
        "人工智能正在改变世界。",
        "Machine learning is transforming industries.",
        "深度学习 Deep Learning 是AI的核心技术。",
    ]
    
    for text in test_texts:
        stats = tokenizer.get_token_stats(text)
        print(f"Text: {text[:30]}...")
        print(f"  Tokens: {stats['token_count']}, Compression: {stats['compression_ratio']:.2f}")
        print(f"  Language: {stats['detected_language']}")
        print()

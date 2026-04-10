"""
Language Detector Module
自动语言识别模块 - 基于Unicode范围和统计特征
"""

import re
from typing import Dict, List, Tuple, Optional
from collections import Counter
from dataclasses import dataclass
from enum import Enum


class Language(Enum):
    UNKNOWN = "unknown"
    CHINESE = "zh"
    ENGLISH = "en"
    JAPANESE = "ja"
    KOREAN = "ko"
    ARABIC = "ar"
    RUSSIAN = "ru"
    GERMAN = "de"
    FRENCH = "fr"
    SPANISH = "es"
    PORTUGUESE = "pt"
    ITALIAN = "it"
    CODE = "code"
    MIXED = "mixed"


@dataclass
class LanguageSegment:
    language: Language
    text: str
    start: int
    end: int
    confidence: float = 1.0


class LanguageDetector:
    UNICODE_RANGES = {
        Language.CHINESE: [
            (0x4E00, 0x9FFF),
            (0x3400, 0x4DBF),
            (0x20000, 0x2A6DF),
            (0x2A700, 0x2B73F),
            (0x2B740, 0x2B81F),
            (0x2B820, 0x2CEAF),
            (0x2CEB0, 0x2EBEF),
            (0x30000, 0x3134F),
            (0xF900, 0xFAFF),
        ],
        Language.JAPANESE: [
            (0x3040, 0x309F),
            (0x30A0, 0x30FF),
            (0x31F0, 0x31FF),
        ],
        Language.KOREAN: [
            (0xAC00, 0xD7AF),
            (0x1100, 0x11FF),
            (0x3130, 0x318F),
            (0xA960, 0xA97F),
            (0xD7B0, 0xD7FF),
        ],
        Language.ARABIC: [
            (0x0600, 0x06FF),
            (0x0750, 0x077F),
            (0x08A0, 0x08FF),
            (0xFB50, 0xFDFF),
            (0xFE70, 0xFEFF),
        ],
        Language.RUSSIAN: [
            (0x0400, 0x04FF),
            (0x0500, 0x052F),
        ],
    }

    CHINESE_PUNCTUATION = set('。，！？；：""''（）（）【】《》、·…—～')
    ENGLISH_PUNCTUATION = set('.,!?;:\'"()[]{}<>')
    
    CODE_KEYWORDS = {
        'def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif',
        'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'yield',
        'lambda', 'async', 'await', 'True', 'False', 'None', 'and', 'or',
        'not', 'in', 'is', 'pass', 'break', 'continue', 'raise', 'assert',
        'function', 'const', 'let', 'var', 'async', 'await', 'export',
        'interface', 'type', 'extends', 'implements', 'public', 'private',
        'protected', 'static', 'void', 'int', 'string', 'boolean', 'null',
        'undefined', 'console', 'print', 'return', 'package', 'struct',
    }

    def __init__(self):
        self._compile_patterns()

    def _compile_patterns(self):
        self.cjk_pattern = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf\U00020000-\U0002a6df]+')
        self.hiragana_pattern = re.compile(r'[\u3040-\u309f]+')
        self.katakana_pattern = re.compile(r'[\u30a0-\u30ff]+')
        self.hangul_pattern = re.compile(r'[\uac00-\ud7af\u1100-\u11ff]+')
        self.arabic_pattern = re.compile(r'[\u0600-\u06ff]+')
        self.cyrillic_pattern = re.compile(r'[\u0400-\u04ff]+')
        self.latin_pattern = re.compile(r'[a-zA-Z]+')
        self.number_pattern = re.compile(r'\d+')
        self.code_pattern = re.compile(
            r'(def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+|function\s*\(|'
            r'const\s+\w+|let\s+\w+|var\s+\w+|=>|{.*}|if\s*\(|for\s*\(|'
            r'while\s*\(|return\s+|print\(|console\.|async\s+|await\s+|'
            r'#[^\n]*|//.*|/\*.*\*/|\bself\b|\bthis\b)'
        )

    def detect_char_language(self, char: str) -> Language:
        if not char:
            return Language.UNKNOWN
        
        code_point = ord(char)
        
        for lang, ranges in self.UNICODE_RANGES.items():
            for start, end in ranges:
                if start <= code_point <= end:
                    if lang == Language.CHINESE:
                        return Language.CHINESE
                    if lang == Language.JAPANESE:
                        return Language.JAPANESE
                    if lang == Language.KOREAN:
                        return Language.KOREAN
                    return lang
        
        if char.isalpha() and char.isascii():
            return Language.ENGLISH
        
        if char.isdigit():
            return Language.ENGLISH
        
        return Language.UNKNOWN

    def detect_text_language(self, text: str) -> Language:
        if not text:
            return Language.UNKNOWN
        
        lang_counts: Dict[Language, int] = Counter()
        
        for char in text:
            if char.isspace():
                continue
            lang = self.detect_char_language(char)
            lang_counts[lang] += 1
        
        if not lang_counts:
            return Language.UNKNOWN
        
        total = sum(lang_counts.values())
        
        if self._is_code(text):
            return Language.CODE
        
        chinese_ratio = lang_counts.get(Language.CHINESE, 0) / total
        english_ratio = lang_counts.get(Language.ENGLISH, 0) / total
        japanese_ratio = lang_counts.get(Language.JAPANESE, 0) / total
        korean_ratio = lang_counts.get(Language.KOREAN, 0) / total
        
        if chinese_ratio > 0.3 and english_ratio > 0.1:
            return Language.MIXED
        
        if chinese_ratio > 0.5:
            return Language.CHINESE
        if english_ratio > 0.5:
            return Language.ENGLISH
        if japanese_ratio > 0.3:
            return Language.JAPANESE
        if korean_ratio > 0.3:
            return Language.KOREAN
        
        return max(lang_counts, key=lang_counts.get)

    def _is_code(self, text: str) -> bool:
        code_indicators = [
            'def ', 'class ', 'import ', 'from ', 'function', 'const ',
            'let ', 'var ', '=>', '()', '{}', '[]', 'return ', 'print(',
            'console.', 'if (', 'for (', 'while (', 'async ', 'await ',
            'self.', 'this.', 'null', 'undefined', 'True', 'False', 'None',
        ]
        
        indicator_count = sum(1 for ind in code_indicators if ind in text)
        
        if indicator_count >= 3:
            return True
        
        if self.code_pattern.search(text):
            return True
        
        return False

    def segment_by_language(self, text: str) -> List[LanguageSegment]:
        if not text:
            return []
        
        segments: List[LanguageSegment] = []
        current_start = 0
        current_lang = Language.UNKNOWN
        current_text = []
        
        i = 0
        while i < len(text):
            char = text[i]
            
            if char.isspace():
                if current_text:
                    current_text.append(char)
                else:
                    current_start = i + 1
                i += 1
                continue
            
            char_lang = self.detect_char_language(char)
            
            if char_lang == Language.UNKNOWN:
                char_lang = current_lang
            
            if current_lang == Language.UNKNOWN:
                current_lang = char_lang
                current_text.append(char)
            elif char_lang == current_lang or char_lang == Language.UNKNOWN:
                current_text.append(char)
            else:
                if current_text:
                    segment_text = ''.join(current_text)
                    segments.append(LanguageSegment(
                        language=current_lang,
                        text=segment_text,
                        start=current_start,
                        end=current_start + len(segment_text)
                    ))
                
                current_start = i
                current_lang = char_lang
                current_text = [char]
            
            i += 1
        
        if current_text:
            segment_text = ''.join(current_text)
            segments.append(LanguageSegment(
                language=current_lang,
                text=segment_text,
                start=current_start,
                end=current_start + len(segment_text)
            ))
        
        return self._merge_similar_segments(segments)

    def _merge_similar_segments(self, segments: List[LanguageSegment]) -> List[LanguageSegment]:
        if len(segments) <= 1:
            return segments
        
        merged: List[LanguageSegment] = []
        current = segments[0]
        
        for next_seg in segments[1:]:
            if (current.language == next_seg.language or 
                (current.language == Language.UNKNOWN or next_seg.language == Language.UNKNOWN)):
                current = LanguageSegment(
                    language=current.language if current.language != Language.UNKNOWN else next_seg.language,
                    text=current.text + next_seg.text,
                    start=current.start,
                    end=next_seg.end
                )
            else:
                merged.append(current)
                current = next_seg
        
        merged.append(current)
        return merged

    def get_language_stats(self, text: str) -> Dict[Language, float]:
        if not text:
            return {}
        
        lang_counts: Dict[Language, int] = Counter()
        total_chars = 0
        
        for char in text:
            if char.isspace():
                continue
            lang = self.detect_char_language(char)
            lang_counts[lang] += 1
            total_chars += 1
        
        if total_chars == 0:
            return {}
        
        return {lang: count / total_chars for lang, count in lang_counts.items()}

    def is_cjk_text(self, text: str) -> bool:
        stats = self.get_language_stats(text)
        cjk_ratio = (
            stats.get(Language.CHINESE, 0) +
            stats.get(Language.JAPANESE, 0) +
            stats.get(Language.KOREAN, 0)
        )
        return cjk_ratio > 0.5

    def is_chinese_dominant(self, text: str) -> bool:
        stats = self.get_language_stats(text)
        return stats.get(Language.CHINESE, 0) > 0.5

    def is_english_dominant(self, text: str) -> bool:
        stats = self.get_language_stats(text)
        return stats.get(Language.ENGLISH, 0) > 0.5

    def is_mixed_zh_en(self, text: str) -> bool:
        stats = self.get_language_stats(text)
        zh_ratio = stats.get(Language.CHINESE, 0)
        en_ratio = stats.get(Language.ENGLISH, 0)
        return zh_ratio > 0.1 and en_ratio > 0.1


detector = LanguageDetector()


def detect_language(text: str) -> Language:
    return detector.detect_text_language(text)


def segment_by_language(text: str) -> List[LanguageSegment]:
    return detector.segment_by_language(text)


def get_language_stats(text: str) -> Dict[Language, float]:
    return detector.get_language_stats(text)

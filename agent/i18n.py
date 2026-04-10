import re
from enum import Enum
from typing import Optional, Tuple
import unicodedata


class Language(Enum):
    ZH = "zh"
    EN = "en"
    MIXED = "mixed"


class LanguageDetector:
    HAN_PATTERN = re.compile(r'[\u4e00-\u9fff]')
    MARKER_ZH = "<|zh|>"
    MARKER_EN = "<|en|>"

    def __init__(self, han_threshold: float = 0.3):
        self.han_threshold = han_threshold

    def detect(self, text: str) -> Language:
        if not text or not text.strip():
            return Language.EN

        text = text.strip()

        if self.MARKER_ZH in text:
            return Language.ZH
        if self.MARKER_EN in text:
            return Language.EN

        clean_text = re.sub(r'[\s\d!"#$%&\'()*+,\-./:;<=>?@\[\\\]^_`{|}~。，、；：？！""''（）【】《》…—]', '', text)
        if not clean_text:
            return Language.EN

        han_chars = self.HAN_PATTERN.findall(clean_text)
        han_ratio = len(han_chars) / len(clean_text)

        if han_ratio > self.han_threshold:
            return Language.ZH
        elif han_ratio < 0.1:
            return Language.EN
        else:
            return Language.MIXED

    def get_language_code(self, text: str) -> str:
        lang = self.detect(text)
        return lang.value if lang != Language.MIXED else Language.ZH.value

    def extract_forced_language(self, text: str) -> Tuple[str, Optional[Language]]:
        if self.MARKER_ZH in text:
            return text.replace(self.MARKER_ZH, "").strip(), Language.ZH
        if self.MARKER_EN in text:
            return text.replace(self.MARKER_EN, "").strip(), Language.EN
        return text, None


class Translator:
    EN_TO_ZH = {
        "calculator": "计算器",
        "file_reader": "文件读取器",
        "search": "搜索",
        "web_fetch": "网页获取",
        "execute": "执行",
        "result": "结果",
        "error": "错误",
        "success": "成功",
        "thinking": "思考中",
        "thought": "想法",
        "observation": "观察",
        "action": "动作",
        "input": "输入",
        "output": "输出",
        "message": "消息",
        "user": "用户",
        "assistant": "助手",
        "context": "上下文",
        "memory": "记忆",
        "tool": "工具",
        "query": "查询",
        "response": "响应",
        "summary": "摘要",
        "retrieving": "检索中",
        "retrieved": "已检索",
        "calling": "调用",
        "completed": "已完成",
        "failed": "失败",
        "processing": "处理中",
        "waiting": "等待中",
    }

    ZH_TO_EN = {v: k for k, v in EN_TO_ZH.items()}

    @classmethod
    def translate_term(cls, term: str, to_language: Language) -> str:
        if to_language == Language.ZH:
            return cls.EN_TO_ZH.get(term, term)
        return term

    @classmethod
    def translate_message(cls, text: str, to_language: Language) -> str:
        if to_language == Language.EN:
            return text

        result = text
        for en, zh in cls.EN_TO_ZH.items():
            result = result.replace(f" {en} ", f" {zh} ")
            result = result.replace(f" {en}.", f" {zh}。")
            result = result.replace(f" {en},", f" {zh}，")

        return result


class PromptLocalizer:
    TEMPLATES_ZH = {
        "system_start": "你是一个智能助手，用中文思考和回复。",
        "thinking": "思考：",
        "observing": "观察：",
        "acting": "动作：",
        "result": "结果：",
        "error": "错误：",
        "retry": "重试中...",
        "done": "完成。",
        "summarizing": "正在摘要...",
        "retrieving_memory": "正在检索记忆...",
    }

    TEMPLATES_EN = {
        "system_start": "You are an intelligent assistant.",
        "thinking": "Thinking: ",
        "observing": "Observing: ",
        "acting": "Acting: ",
        "result": "Result: ",
        "error": "Error: ",
        "retry": "Retrying...",
        "done": "Done.",
        "summarizing": "Summarizing...",
        "retrieving_memory": "Retrieving memory...",
    }

    @classmethod
    def get_template(cls, key: str, language: Language) -> str:
        templates = cls.TEMPLATES_ZH if language == Language.ZH else cls.TEMPLATES_EN
        return templates.get(key, key)

    @classmethod
    def format_thought(cls, content: str, language: Language) -> str:
        prefix = cls.get_template("thinking", language)
        return f"<|thought|>{prefix}{content}"

    @classmethod
    def format_observation(cls, content: str, language: Language) -> str:
        prefix = cls.get_template("observing", language)
        return f"<|observation|>{prefix}{content}"

    @classmethod
    def format_action(cls, tool_name: str, args: dict, language: Language) -> str:
        prefix = cls.get_template("acting", language)
        args_str = ", ".join(f"{k}={repr(v)}" for k, v in args.items())
        return f"<|action|>{prefix}{tool_name}({args_str})"

    @classmethod
    def format_result(cls, content: str, language: Language) -> str:
        prefix = cls.get_template("result", language)
        return f"{prefix}{content}"


class BilingualFormatter:
    @staticmethod
    def format_tool_call(tool_name: str, args: dict, language: Language) -> str:
        args_str = ", ".join(f"{k}={repr(v)}" for k, v in args.items())
        return f"{tool_name}({args_str})"

    @staticmethod
    def format_response(
        thought: str,
        tool_calls: list,
        results: list,
        language: Language,
    ) -> str:
        lines = []

        lines.append(BilingualFormatter.format_thought(thought, language))

        for tool_call, result in zip(tool_calls, results):
            lines.append(BilingualFormatter.format_action(tool_call, language))
            lines.append(BilingualFormatter.format_result(str(result), language))

        return "\n".join(lines)

    @staticmethod
    def format_thought(content: str, language: Language) -> str:
        return PromptLocalizer.format_thought(content, language)

    @staticmethod
    def format_action(tool_name: str, args: dict, language: Language) -> str:
        return PromptLocalizer.format_action(tool_name, args, language)

    @staticmethod
    def format_result(content: str, language: Language) -> str:
        return PromptLocalizer.format_result(content, language)


def detect_language(text: str) -> Language:
    detector = LanguageDetector()
    return detector.detect(text)


def get_language_code(text: str) -> str:
    detector = LanguageDetector()
    return detector.get_language_code(text)


def translate_to_user_language(text: str, target_language: Language) -> str:
    if target_language == Language.EN:
        return text
    return Translator.translate_message(text, target_language)

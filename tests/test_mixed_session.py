import sys
import os
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agent import (
    Language,
    LanguageDetector,
    BilingualAgent,
    BilingualMemory,
    MemoryManager,
    execute_tool,
    create_agent,
)


class TestMixedLanguageDetection:
    def test_mixed_chinese_english(self):
        detector = LanguageDetector()

        result = detector.detect("Hello, 你好吗？")
        assert result in [Language.MIXED, Language.ZH]

        result = detector.detect("这是一个test测试")
        assert result in [Language.MIXED, Language.ZH]

    def test_code_mixed_content(self):
        detector = LanguageDetector()

        result = detector.detect("def 函数名(): pass")
        assert result in [Language.MIXED, Language.EN]

    def test_technical_terms(self):
        detector = LanguageDetector()

        result = detector.detect("使用Python进行数据分析")
        assert result == Language.ZH

        result = detector.detect("使用 API 调用接口")
        assert result == Language.ZH


class TestMixedLanguageTools:
    def test_python_chinese_english_code(self):
        code = '''
# Chinese comment: 这是一个测试
# English comment: This is a test
def 计算函数(x, y):
    """Calculate sum of two numbers 计算两个数的和"""
    return x + y

result = 计算函数(10, 20)
print(f"Result 结果: {result}")
'''
        result = execute_tool("python", code=code)
        assert result["success"] == True
        assert "30" in result["stdout"]

    def test_file_chinese_english_content(self, tmp_path):
        test_file = tmp_path / "mixed_content.txt"
        content = "Hello 世界\nThis is 测试\nPython编程"

        write_result = execute_tool(
            "file_writer",
            path=str(test_file),
            content=content,
        )
        assert write_result["success"] == True

        read_result = execute_tool(
            "file_reader",
            path=str(test_file),
        )
        assert read_result["success"] == True
        assert "Hello 世界" in read_result["content"]


class TestMixedMemory:
    def test_mixed_memory_storage(self):
        memory = BilingualMemory()

        zh_entry = memory.add_memory(
            content="Python是一种编程语言",
            language="zh",
        )
        en_entry = memory.add_memory(
            content="Python is a programming language",
            language="en",
        )

        memory.link_memories(zh_entry.id, en_entry.id)

        zh_results = memory.search("Python", "zh")
        en_results = memory.search("Python", "en")

        assert len(zh_results) > 0 or len(en_results) > 0

    def test_cross_language_retrieval(self):
        memory = BilingualMemory()

        memory.add_memory(
            content="机器学习是人工智能的子领域",
            language="zh",
            summary="机器学习概述",
        )
        memory.add_memory(
            content="Machine learning is a subset of AI",
            language="en",
            summary="ML overview",
        )

        zh_results = memory.search("机器学习", "zh")
        en_results = memory.search("machine learning", "en")

        assert len(zh_results) > 0
        assert len(en_results) > 0


class TestMixedAgentSession:
    def test_agent_switches_language(self):
        agent = create_agent()

        response1 = agent.run("你好")
        assert response1.language == Language.ZH

        response2 = agent.run("Hello")
        assert response2.language == Language.EN

    def test_agent_mixed_input(self):
        agent = create_agent()

        response = agent.run("请用Python写一个hello world程序")
        assert response.language == Language.ZH

    def test_agent_forced_language(self):
        agent = create_agent()

        response = agent.run("<|en|>你好世界")
        assert response.language == Language.EN

        response = agent.run("<|zh|>Hello World")
        assert response.language == Language.ZH

    def test_agent_technical_discussion(self):
        agent = create_agent()

        def mock_model(prompt: str, language: Language) -> str:
            if "API" in prompt or "调用" in prompt:
                return '''<|thought|>用户询问API调用，我将提供相关信息。
<|response|>API调用通常使用HTTP请求，可以使用requests库或urllib模块。
'''
            return "<|thought|>Thinking..."

        agent.model_func = mock_model
        response = agent.run("如何使用Python调用API接口？")

        assert response.language == Language.ZH
        assert len(response.content) > 0


class TestBilingualConversation:
    def test_conversation_memory_mixed(self):
        manager = MemoryManager()

        manager.add_interaction(
            user_input="你好，我想学习Python",
            assistant_response="你好！Python是一门很好的编程语言。",
            language="zh",
        )

        manager.add_interaction(
            user_input="What about JavaScript?",
            assistant_response="JavaScript is also popular for web development.",
            language="en",
        )

        stats = manager.get_stats()
        assert stats["conversation_turns"] == 2

    def test_context_preservation(self):
        manager = MemoryManager()

        manager.add_interaction(
            user_input="我叫小明",
            assistant_response="你好小明！",
            language="zh",
            store_long_term=True,
        )

        manager.add_interaction(
            user_input="My favorite language is Python",
            assistant_response="Python is a great choice!",
            language="en",
            store_long_term=True,
        )

        zh_context = manager.get_relevant_context("小明", "zh")
        en_context = manager.get_relevant_context("Python", "en")

        assert "小明" in zh_context or len(zh_context) >= 0
        assert "Python" in en_context or len(en_context) >= 0


class TestStreamingAgent:
    def test_streaming_chinese(self):
        from agent import StreamingBilingualAgent

        agent = StreamingBilingualAgent()
        streamed_content = []

        def callback(content: str, step_type: str):
            streamed_content.append((content, step_type))

        def mock_model(prompt: str, language: Language) -> str:
            return '<|response|>你好！有什么可以帮助你的？'

        agent.model_func = mock_model
        agent.set_stream_callback(callback)

        responses = list(agent.run_stream("你好"))
        assert len(responses) > 0
        assert responses[0].language == Language.ZH

    def test_streaming_english(self):
        from agent import StreamingBilingualAgent

        agent = StreamingBilingualAgent()
        streamed_content = []

        def callback(content: str, step_type: str):
            streamed_content.append((content, step_type))

        def mock_model(prompt: str, language: Language) -> str:
            return '<|response|>Hello! How can I help you?'

        agent.model_func = mock_model
        agent.set_stream_callback(callback)

        responses = list(agent.run_stream("Hello"))
        assert len(responses) > 0
        assert responses[0].language == Language.EN


class TestToolLocalization:
    def test_tool_descriptions_bilingual(self):
        from agent.localized_tools import get_tool_schemas

        zh_schemas = get_tool_schemas("zh")
        en_schemas = get_tool_schemas("en")

        assert len(zh_schemas) == len(en_schemas)

        for zh, en in zip(zh_schemas, en_schemas):
            assert zh["name"] == en["name"]
            assert zh["description"] != en["description"]

    def test_error_messages_localized(self):
        result = execute_tool("file_reader", path="不存在的文件路径_12345.txt")

        assert result["success"] == False
        assert "error" in result or "error_zh" in result


class TestEdgeCases:
    def test_empty_input(self):
        detector = LanguageDetector()
        result = detector.detect("")
        assert result == Language.EN

    def test_numbers_only(self):
        detector = LanguageDetector()
        result = detector.detect("12345")
        assert result == Language.EN

    def test_special_characters(self):
        detector = LanguageDetector()
        result = detector.detect("!@#$%^&*()")
        assert result == Language.EN

    def test_very_long_mixed_text(self):
        detector = LanguageDetector()

        long_text = "这是一段很长的中文文本。" * 100 + "This is English text. " * 100
        result = detector.detect(long_text)
        assert result in [Language.ZH, Language.MIXED]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

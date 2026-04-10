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
    get_tool_schemas,
    create_agent,
)


class TestLanguageDetection:
    def test_detect_chinese(self):
        detector = LanguageDetector()
        assert detector.detect("你好，世界") == Language.ZH
        assert detector.detect("这是一个测试") == Language.ZH
        assert detector.detect("今天天气怎么样？") == Language.ZH

    def test_detect_english(self):
        detector = LanguageDetector()
        assert detector.detect("Hello world") == Language.EN
        assert detector.detect("This is a test") == Language.EN
        assert detector.detect("How are you today?") == Language.EN

    def test_detect_mixed(self):
        detector = LanguageDetector()
        result = detector.detect("Hello 你好 world 世界")
        assert result in [Language.MIXED, Language.ZH, Language.EN]

    def test_forced_language_markers(self):
        detector = LanguageDetector()
        assert detector.detect("<|zh|>Hello world") == Language.ZH
        assert detector.detect("<|en|>你好世界") == Language.EN

    def test_extract_forced_language(self):
        detector = LanguageDetector()
        text, lang = detector.extract_forced_language("<|zh|>测试内容")
        assert text == "测试内容"
        assert lang == Language.ZH

        text, lang = detector.extract_forced_language("<|en|>test content")
        assert text == "test content"
        assert lang == Language.EN


class TestChineseTools:
    def test_calculator_chinese(self):
        result = execute_tool("calculator", expression="2+3*4")
        assert result["success"] == True
        assert result["result"] == 14

    def test_calculator_complex(self):
        result = execute_tool("calculator", expression="(10+5)*2")
        assert result["success"] == True
        assert result["result"] == 30

    def test_file_operations_chinese_path(self, tmp_path):
        test_file = tmp_path / "测试文件.txt"
        test_content = "这是中文内容测试"

        write_result = execute_tool(
            "file_writer",
            path=str(test_file),
            content=test_content,
        )
        assert write_result["success"] == True

        read_result = execute_tool(
            "file_reader",
            path=str(test_file),
        )
        assert read_result["success"] == True
        assert read_result["content"] == test_content

    def test_list_directory(self, tmp_path):
        (tmp_path / "文件1.txt").write_text("内容1")
        (tmp_path / "文件2.txt").write_text("内容2")
        (tmp_path / "子目录").mkdir()

        result = execute_tool("ls", path=str(tmp_path))
        assert result["success"] == True
        assert result["count"] == 3

    def test_python_executor_chinese_comments(self):
        code = '''
# 这是一个中文注释
x = "你好世界"
print(x)
'''
        result = execute_tool("python", code=code)
        assert result["success"] == True
        assert "你好世界" in result["stdout"]

    def test_tool_schemas_chinese(self):
        schemas = get_tool_schemas("zh")
        assert len(schemas) > 0

        for schema in schemas:
            assert "name" in schema
            assert "description" in schema
            assert "parameters" in schema


class TestBilingualMemory:
    def test_add_chinese_memory(self):
        memory = BilingualMemory()
        entry = memory.add_memory(
            content="用户询问了关于人工智能的问题",
            language="zh",
        )

        assert entry.language == "zh"
        assert entry.id is not None
        assert len(entry.keywords) > 0

    def test_search_chinese_memory(self):
        memory = BilingualMemory()
        memory.add_memory(
            content="机器学习是人工智能的一个分支",
            language="zh",
        )
        memory.add_memory(
            content="深度学习使用神经网络",
            language="zh",
        )

        results = memory.search("人工智能", "zh")
        assert len(results) > 0
        assert results[0][0].language == "zh"

    def test_cross_lingual_linking(self):
        memory = BilingualMemory()

        zh_entry = memory.add_memory(
            content="人工智能正在快速发展",
            language="zh",
        )
        en_entry = memory.add_memory(
            content="Artificial intelligence is developing rapidly",
            language="en",
        )

        memory.link_memories(zh_entry.id, en_entry.id)

        assert en_entry.id in memory.zh_memories[zh_entry.id].linked_ids
        assert zh_entry.id in memory.en_memories[en_entry.id].linked_ids

    def test_cross_lingual_search(self):
        memory = BilingualMemory()

        zh_entry = memory.add_memory(
            content="机器学习算法",
            language="zh",
        )
        en_entry = memory.add_memory(
            content="Machine learning algorithms",
            language="en",
        )
        memory.link_memories(zh_entry.id, en_entry.id)

        results = memory.search("machine learning", "en", cross_lingual=True)
        assert len(results) > 0


class TestChineseAgentSession:
    def test_agent_chinese_input(self):
        agent = create_agent()

        response = agent.run("你好，请介绍一下你自己")
        assert response.language == Language.ZH
        assert len(response.content) > 0

    def test_agent_chinese_calculation(self):
        agent = create_agent()

        def mock_model(prompt: str, language: Language) -> str:
            if "计算" in prompt or language == Language.ZH:
                return '''<|thought|>用户需要进行计算，我将使用计算器工具。
<|action|>calculator(expression='10+20')
'''
            return "<|thought|>Thinking..."

        agent.model_func = mock_model
        response = agent.run("请帮我计算 10+20")

        assert response.language == Language.ZH
        assert len(response.steps) > 0

    def test_agent_memory_persistence(self):
        agent = create_agent()

        def mock_model(prompt: str, language: Language) -> str:
            if "名字" in prompt:
                return '<|response|>你叫张三。'
            return '<|response|>好的，我记住了。'

        agent.model_func = mock_model
        agent.run("我叫张三")
        agent.run("我的名字是什么？")

        stats = agent.get_memory_stats()
        assert stats["conversation_turns"] == 2

    def test_agent_tool_usage_chinese(self):
        agent = create_agent()

        def mock_model(prompt: str, language: Language) -> str:
            return '''<|thought|>用户想查看当前目录，我将使用ls工具。
<|action|>ls(path='.')
'''

        agent.model_func = mock_model
        response = agent.run("请列出当前目录的文件")

        assert response.language == Language.ZH
        assert len(response.tools_used) > 0
        assert "ls" in response.tools_used

    def test_agent_error_handling_chinese(self):
        agent = create_agent()

        def mock_model(prompt: str, language: Language) -> str:
            return '''<|thought|>用户要读取不存在的文件。
<|action|>file_reader(path='不存在的文件.txt')
'''

        agent.model_func = mock_model
        response = agent.run("请读取不存在的文件.txt")

        assert response.language == Language.ZH
        assert any(step.step_type == "observation" for step in response.steps)


class TestMemoryManager:
    def test_interaction_storage(self):
        manager = MemoryManager()

        manager.add_interaction(
            user_input="你好",
            assistant_response="你好！有什么可以帮助你的？",
            language="zh",
        )

        context = manager.get_relevant_context("你好", "zh")
        assert "你好" in context

    def test_long_term_memory(self):
        manager = MemoryManager()

        manager.add_interaction(
            user_input="我喜欢编程",
            assistant_response="编程是一项很有趣的技能！",
            language="zh",
            store_long_term=True,
        )

        results = manager.search_memories("编程", "zh")
        assert len(results) > 0


class TestAgentState:
    def test_state_transitions(self):
        agent = BilingualAgent()
        assert agent.state.value == "idle"

        def mock_model(prompt: str, language: Language) -> str:
            return '<|response|>测试回复'

        agent.model_func = mock_model
        agent.run("测试输入")
        assert agent.state.value in ["responding", "idle"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

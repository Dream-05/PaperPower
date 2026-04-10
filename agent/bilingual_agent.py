import json
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

from .i18n import (
    Language,
    LanguageDetector,
    PromptLocalizer,
    BilingualFormatter,
    Translator,
)
from .localized_tools import ToolRegistry, get_tool_schemas, execute_tool
from .memory_bilingual import MemoryManager, MemoryEntry


class AgentState(Enum):
    IDLE = "idle"
    THINKING = "thinking"
    ACTING = "acting"
    OBSERVING = "observing"
    RESPONDING = "responding"
    ERROR = "error"


@dataclass
class AgentStep:
    step_type: str
    content: str
    language: Language
    tool_name: Optional[str] = None
    tool_args: Optional[Dict[str, Any]] = None
    result: Optional[Any] = None
    error: Optional[str] = None


@dataclass
class AgentResponse:
    content: str
    language: Language
    steps: List[AgentStep] = field(default_factory=list)
    tools_used: List[str] = field(default_factory=list)
    success: bool = True


class BilingualAgent:
    def __init__(
        self,
        model_func: Optional[Callable] = None,
        memory_path: Optional[str] = None,
        max_steps: int = 10,
        verbose: bool = True,
    ):
        self.model_func = model_func or self._default_model
        self.memory = MemoryManager(storage_path=memory_path)
        self.max_steps = max_steps
        self.verbose = verbose
        self.state = AgentState.IDLE
        self.language_detector = LanguageDetector()

        self.system_prompts = {
            Language.ZH: """你是一个智能助手，用中文思考和回复。

你可以使用以下工具：
{tools}

思考格式：
<|thought|>你的思考过程...
<|action|>工具名(参数)
<|observation|>工具返回结果
<|response|>最终回复

规则：
1. 用中文思考，工具名保持英文
2. 每次只调用一个工具
3. 得到足够信息后给出最终回复
4. 如果工具调用失败，分析原因并重试或给出替代方案
""",
            Language.EN: """You are an intelligent assistant.

Available tools:
{tools}

Format:
<|thought|>Your thinking process...
<|action|>tool_name(args)
<|observation|>Tool result
<|response|>Final response

Rules:
1. Think in English
2. Call one tool at a time
3. Provide final response when you have enough information
4. If tool fails, analyze and retry or provide alternative
""",
        }

    def _default_model(self, prompt: str, language: Language) -> str:
        return self._simulate_response(prompt, language)

    def _simulate_response(self, prompt: str, language: Language) -> str:
        if "<|action|>" in prompt:
            return self._extract_and_simulate_action(prompt, language)
        return self._generate_thinking_response(prompt, language)

    def _extract_and_simulate_action(self, prompt: str, language: Language) -> str:
        action_pattern = r'<\|action\|>(\w+)\(([^)]*)\)'
        match = re.search(action_pattern, prompt)

        if match:
            tool_name = match.group(1)
            args_str = match.group(2)

            args = {}
            if args_str:
                for arg_match in re.finditer(r'(\w+)=(["\']?)([^"\',)]*)\2', args_str):
                    args[arg_match.group(1)] = arg_match.group(3)

            result = execute_tool(tool_name, **args)

            if language == Language.ZH:
                return f"<|observation|>工具执行结果: {json.dumps(result, ensure_ascii=False)}"
            return f"<|observation|>Tool result: {json.dumps(result)}"

        return "<|thought|>无法解析工具调用"

    def _generate_thinking_response(self, prompt: str, language: Language) -> str:
        if "计算" in prompt or "calculate" in prompt.lower():
            if language == Language.ZH:
                return "<|thought|>用户需要进行计算，我将使用计算器工具。\n<|action|>calculator(expression='2+2')"
            return "<|thought|>User needs calculation, I will use calculator.\n<|action|>calculator(expression='2+2')"

        if "文件" in prompt or "file" in prompt.lower():
            if language == Language.ZH:
                return "<|thought|>用户需要文件操作，我将使用文件读取工具。\n<|action|>ls(path='.')"
            return "<|thought|>User needs file operation, I will use file tools.\n<|action|>ls(path='.')"

        if language == Language.ZH:
            return "<|thought|>我理解了用户的问题，让我直接回复。\n<|response|>您好！我是智能助手，有什么可以帮助您的吗？"
        return "<|thought|>I understand the user's question, let me respond directly.\n<|response|>Hello! I'm an intelligent assistant. How can I help you?"

    def detect_language(self, text: str) -> Language:
        clean_text, forced_lang = self.language_detector.extract_forced_language(text)
        if forced_lang:
            return forced_lang
        return self.language_detector.detect(clean_text)

    def _build_prompt(self, user_input: str, language: Language) -> str:
        tools_schema = get_tool_schemas("zh" if language == Language.ZH else "en")
        tools_str = "\n".join([
            f"- {t['name']}: {t['description']}"
            for t in tools_schema
        ])

        system_prompt = self.system_prompts[language].format(tools=tools_str)

        context = self.memory.get_relevant_context(user_input, language.value)

        if context:
            if language == Language.ZH:
                context_section = f"\n=== 相关上下文 ===\n{context}\n"
            else:
                context_section = f"\n=== Relevant Context ===\n{context}\n"
        else:
            context_section = ""

        full_prompt = f"{system_prompt}{context_section}\n用户: {user_input}\n助手:"
        return full_prompt

    def _parse_response(self, response: str, language: Language) -> Tuple[str, Optional[str], Optional[Dict]]:
        thought = ""
        action_name = None
        action_args = None
        final_response = None

        thought_match = re.search(r'<\|thought\|>(.*?)(?=<\||$)', response, re.DOTALL)
        if thought_match:
            thought = thought_match.group(1).strip()

        action_match = re.search(r'<\|action\|>(\w+)\(([^)]*)\)', response)
        if action_match:
            action_name = action_match.group(1)
            args_str = action_match.group(2)

            action_args = {}
            if args_str:
                for arg_match in re.finditer(r'(\w+)=(["\']?)([^"\',)]*)\2', args_str):
                    key = arg_match.group(1)
                    value = arg_match.group(3)
                    action_args[key] = value

        response_match = re.search(r'<\|response\|>(.*?)(?=<\||$)', response, re.DOTALL)
        if response_match:
            final_response = response_match.group(1).strip()

        return thought, action_name, action_args, final_response

    def _execute_action(self, tool_name: str, args: Dict[str, Any]) -> Any:
        return execute_tool(tool_name, **args)

    def _format_observation(self, result: Any, language: Language) -> str:
        if language == Language.ZH:
            return f"<|observation|>结果: {json.dumps(result, ensure_ascii=False, indent=2)}"
        return f"<|observation|>Result: {json.dumps(result, indent=2)}"

    def run(self, user_input: str, language: Optional[Language] = None) -> AgentResponse:
        if language is None:
            language = self.detect_language(user_input)

        clean_input, _ = self.language_detector.extract_forced_language(user_input)

        steps: List[AgentStep] = []
        tools_used: List[str] = []

        self.state = AgentState.THINKING
        current_prompt = self._build_prompt(clean_input, language)

        for step_count in range(self.max_steps):
            self.state = AgentState.THINKING
            response = self.model_func(current_prompt, language)

            thought, action_name, action_args, final_response = self._parse_response(response, language)

            steps.append(AgentStep(
                step_type="thought",
                content=thought,
                language=language,
            ))

            if final_response:
                self.state = AgentState.RESPONDING

                self.memory.add_interaction(
                    clean_input,
                    final_response,
                    language.value,
                    tools_used,
                )

                return AgentResponse(
                    content=final_response,
                    language=language,
                    steps=steps,
                    tools_used=tools_used,
                    success=True,
                )

            if action_name:
                self.state = AgentState.ACTING
                tools_used.append(action_name)

                steps.append(AgentStep(
                    step_type="action",
                    content=f"{action_name}({action_args})",
                    language=language,
                    tool_name=action_name,
                    tool_args=action_args,
                ))

                try:
                    result = self._execute_action(action_name, action_args or {})

                    steps.append(AgentStep(
                        step_type="observation",
                        content=str(result),
                        language=language,
                        result=result,
                    ))

                    observation = self._format_observation(result, language)
                    current_prompt = f"{current_prompt}\n{response}\n{observation}"

                except Exception as e:
                    error_msg = str(e)
                    steps.append(AgentStep(
                        step_type="error",
                        content=error_msg,
                        language=language,
                        error=error_msg,
                    ))

                    if language == Language.ZH:
                        error_obs = f"<|observation|>错误: {error_msg}"
                    else:
                        error_obs = f"<|observation|>Error: {error_msg}"
                    current_prompt = f"{current_prompt}\n{response}\n{error_obs}"
            else:
                if language == Language.ZH:
                    final_response = "我需要更多信息来回答您的问题。"
                else:
                    final_response = "I need more information to answer your question."

                return AgentResponse(
                    content=final_response,
                    language=language,
                    steps=steps,
                    tools_used=tools_used,
                    success=False,
                )

        self.state = AgentState.ERROR
        if language == Language.ZH:
            timeout_msg = "抱歉，我需要更多步骤来完成这个任务。请简化您的问题或分步提问。"
        else:
            timeout_msg = "Sorry, I need more steps to complete this task. Please simplify your question or ask step by step."

        return AgentResponse(
            content=timeout_msg,
            language=language,
            steps=steps,
            tools_used=tools_used,
            success=False,
        )

    def chat(self, user_input: str, language: Optional[Language] = None) -> str:
        response = self.run(user_input, language)
        return response.content

    def get_tools_info(self, language: Language = Language.ZH) -> str:
        tools = get_tool_schemas("zh" if language == Language.ZH else "en")

        if language == Language.ZH:
            lines = ["可用工具:"]
            for tool in tools:
                lines.append(f"  - {tool['name']}: {tool['description']}")
        else:
            lines = ["Available tools:"]
            for tool in tools:
                lines.append(f"  - {tool['name']}: {tool['description']}")

        return "\n".join(lines)

    def get_memory_stats(self) -> Dict[str, Any]:
        return self.memory.get_stats()

    def clear_memory(self):
        self.memory.clear_all()


class StreamingBilingualAgent(BilingualAgent):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._stream_callback: Optional[Callable] = None

    def set_stream_callback(self, callback: Callable):
        self._stream_callback = callback

    def _stream(self, content: str, step_type: str):
        if self._stream_callback:
            self._stream_callback(content, step_type)

    def run_stream(self, user_input: str, language: Optional[Language] = None):
        if language is None:
            language = self.detect_language(user_input)

        clean_input, _ = self.language_detector.extract_forced_language(user_input)

        steps: List[AgentStep] = []
        tools_used: List[str] = []

        self.state = AgentState.THINKING
        current_prompt = self._build_prompt(clean_input, language)

        for step_count in range(self.max_steps):
            self.state = AgentState.THINKING
            response = self.model_func(current_prompt, language)

            thought, action_name, action_args, final_response = self._parse_response(response, language)

            if thought:
                self._stream(thought, "thought")
                steps.append(AgentStep(step_type="thought", content=thought, language=language))

            if final_response:
                self._stream(final_response, "response")
                self.memory.add_interaction(clean_input, final_response, language.value, tools_used)
                yield AgentResponse(
                    content=final_response,
                    language=language,
                    steps=steps,
                    tools_used=tools_used,
                    success=True,
                )
                return

            if action_name:
                self.state = AgentState.ACTING
                tools_used.append(action_name)

                action_str = f"{action_name}({action_args})"
                self._stream(action_str, "action")
                steps.append(AgentStep(
                    step_type="action",
                    content=action_str,
                    language=language,
                    tool_name=action_name,
                    tool_args=action_args,
                ))

                try:
                    result = self._execute_action(action_name, action_args or {})
                    result_str = json.dumps(result, ensure_ascii=(language == Language.ZH))
                    self._stream(result_str, "observation")
                    steps.append(AgentStep(step_type="observation", content=result_str, language=language, result=result))

                    observation = self._format_observation(result, language)
                    current_prompt = f"{current_prompt}\n{response}\n{observation}"
                except Exception as e:
                    error_msg = str(e)
                    self._stream(error_msg, "error")
                    steps.append(AgentStep(step_type="error", content=error_msg, language=language, error=error_msg))

                    if language == Language.ZH:
                        error_obs = f"<|observation|>错误: {error_msg}"
                    else:
                        error_obs = f"<|observation|>Error: {error_msg}"
                    current_prompt = f"{current_prompt}\n{response}\n{error_obs}"


def create_agent(
    model_func: Optional[Callable] = None,
    memory_path: Optional[str] = None,
    streaming: bool = False,
    **kwargs,
) -> BilingualAgent:
    agent_class = StreamingBilingualAgent if streaming else BilingualAgent
    return agent_class(
        model_func=model_func,
        memory_path=memory_path,
        **kwargs,
    )

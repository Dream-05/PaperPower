import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Union


class ToolDefinition:
    def __init__(
        self,
        name: str,
        description_zh: str,
        description_en: str,
        parameters: Dict[str, Any],
        func: Callable,
    ):
        self.name = name
        self.description_zh = description_zh
        self.description_en = description_en
        self.parameters = parameters
        self.func = func

    def get_description(self, language: str) -> str:
        return self.description_zh if language == "zh" else self.description_en


class Calculator:
    name = "calculator"
    description_zh = "执行数学运算，支持基本算术和复杂表达式"
    description_en = "Perform mathematical operations, supports basic arithmetic and complex expressions"

    parameters = {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "数学表达式，如 2+3*4 或 sqrt(16)",
            }
        },
        "required": ["expression"],
    }

    @staticmethod
    def execute(expression: str) -> Dict[str, Any]:
        try:
            allowed_chars = set("0123456789+-*/.()%**sqrtcosintanlogexppowPIE ")
            clean_expr = "".join(c for c in expression if c in allowed_chars or c.isspace())

            result = eval(clean_expr, {"__builtins__": {}, "sqrt": lambda x: x ** 0.5, "pow": pow}, {})

            return {
                "success": True,
                "expression": expression,
                "result": result,
                "type": "number",
            }
        except Exception as e:
            return {
                "success": False,
                "expression": expression,
                "error": str(e),
                "error_zh": f"计算错误: {str(e)}",
            }


class FileReader:
    name = "file_reader"
    description_zh = "读取文件内容，支持中文路径和UTF-8编码"
    description_en = "Read file content, supports Chinese paths and UTF-8 encoding"

    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "文件路径，支持中文路径",
            },
            "encoding": {
                "type": "string",
                "description": "文件编码，默认utf-8",
                "default": "utf-8",
            },
            "lines": {
                "type": "integer",
                "description": "读取行数，默认全部",
                "default": -1,
            },
        },
        "required": ["path"],
    }

    @staticmethod
    def execute(path: str, encoding: str = "utf-8", lines: int = -1) -> Dict[str, Any]:
        try:
            file_path = Path(path)

            if not file_path.exists():
                return {
                    "success": False,
                    "path": path,
                    "error": "文件不存在",
                    "error_en": "File not found",
                }

            if file_path.is_dir():
                return {
                    "success": False,
                    "path": path,
                    "error": "路径是目录，不是文件",
                    "error_en": "Path is a directory, not a file",
                }

            content = file_path.read_text(encoding=encoding)

            if lines > 0:
                content_lines = content.split("\n")
                content = "\n".join(content_lines[:lines])
                truncated = len(content_lines) > lines
            else:
                truncated = False

            return {
                "success": True,
                "path": path,
                "encoding": encoding,
                "content": content,
                "truncated": truncated,
                "char_count": len(content),
            }
        except UnicodeDecodeError:
            try:
                content = file_path.read_text(encoding="gbk")
                return {
                    "success": True,
                    "path": path,
                    "encoding": "gbk",
                    "content": content,
                    "note": "使用GBK编码读取",
                }
            except Exception as e:
                return {
                    "success": False,
                    "path": path,
                    "error": f"编码错误: {str(e)}",
                    "error_en": f"Encoding error: {str(e)}",
                }
        except Exception as e:
            return {
                "success": False,
                "path": path,
                "error": str(e),
                "error_en": str(e),
            }


class FileWriter:
    name = "file_writer"
    description_zh = "写入文件内容，支持中文路径和UTF-8编码"
    description_en = "Write file content, supports Chinese paths and UTF-8 encoding"

    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "文件路径，支持中文路径",
            },
            "content": {
                "type": "string",
                "description": "写入内容",
            },
            "encoding": {
                "type": "string",
                "description": "文件编码，默认utf-8",
                "default": "utf-8",
            },
            "append": {
                "type": "boolean",
                "description": "是否追加模式，默认覆盖",
                "default": False,
            },
        },
        "required": ["path", "content"],
    }

    @staticmethod
    def execute(
        path: str, content: str, encoding: str = "utf-8", append: bool = False
    ) -> Dict[str, Any]:
        try:
            file_path = Path(path)
            file_path.parent.mkdir(parents=True, exist_ok=True)

            mode = "a" if append else "w"
            with open(file_path, mode, encoding=encoding) as f:
                f.write(content)

            return {
                "success": True,
                "path": path,
                "encoding": encoding,
                "bytes_written": len(content.encode(encoding)),
                "mode": "append" if append else "write",
            }
        except Exception as e:
            return {
                "success": False,
                "path": path,
                "error": str(e),
                "error_en": str(e),
            }


class PythonExecutor:
    name = "python"
    description_zh = "执行Python代码，支持中文注释和输出"
    description_en = "Execute Python code, supports Chinese comments and output"

    parameters = {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "要执行的Python代码",
            },
            "timeout": {
                "type": "integer",
                "description": "超时时间(秒)",
                "default": 30,
            },
        },
        "required": ["code"],
    }

    @staticmethod
    def execute(code: str, timeout: int = 30) -> Dict[str, Any]:
        try:
            stdout_capture = []
            stderr_capture = []

            class OutputCapture:
                def write(self, text):
                    if text:
                        stdout_capture.append(text)

                def flush(self):
                    pass

            class ErrorCapture:
                def write(self, text):
                    if text:
                        stderr_capture.append(text)

                def flush(self):
                    pass

            old_stdout = sys.stdout
            old_stderr = sys.stderr

            sys.stdout = OutputCapture()
            sys.stderr = ErrorCapture()

            try:
                exec(code, {"__builtins__": __builtins__}, {})
                success = True
                error_msg = None
            except Exception as e:
                success = False
                error_msg = str(e)
                stderr_capture.append(error_msg)
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr

            stdout_text = "".join(stdout_capture)
            stderr_text = "".join(stderr_capture)

            return {
                "success": success,
                "stdout": stdout_text,
                "stderr": stderr_text,
                "error": error_msg,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_en": str(e),
            }


class WebSearch:
    name = "search"
    description_zh = "执行网络搜索，返回中英文结果"
    description_en = "Perform web search, returns results in Chinese and English"

    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索关键词",
            },
            "num_results": {
                "type": "integer",
                "description": "返回结果数量",
                "default": 5,
            },
            "language": {
                "type": "string",
                "description": "结果语言偏好: zh, en, mixed",
                "default": "mixed",
            },
        },
        "required": ["query"],
    }

    @staticmethod
    def execute(
        query: str, num_results: int = 5, language: str = "mixed"
    ) -> Dict[str, Any]:
        try:
            encoded_query = urllib.parse.quote(query)
            url = f"https://duckduckgo.com/html/?q={encoded_query}&no_html=1&skip_disambig=1"

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            request = urllib.request.Request(url, headers=headers)

            with urllib.request.urlopen(request, timeout=10) as response:
                html = response.read().decode("utf-8")

            results = []
            pattern = r'<a class="result__a" href="([^"]+)"[^>]*>(.+?)</a>'
            matches = re.findall(pattern, html, re.DOTALL)

            for url_match, title_match in matches[:num_results]:
                title = re.sub(r'<[^>]+>', '', title_match).strip()
                results.append({"title": title, "url": url_match})

            if not results:
                results = [{"title": "搜索服务暂时不可用", "url": "", "note": "Search service unavailable"}]

            return {
                "success": True,
                "query": query,
                "results": results,
                "count": len(results),
            }
        except urllib.error.URLError:
            return {
                "success": False,
                "error": "网络连接失败",
                "error_en": "Network connection failed",
                "query": query,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_en": str(e),
            }


class WebFetch:
    name = "web_fetch"
    description_zh = "获取网页内容，支持中文网页"
    description_en = "Fetch web page content, supports Chinese websites"

    parameters = {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "网页URL",
            },
            "max_length": {
                "type": "integer",
                "description": "最大获取字符数",
                "default": 5000,
            },
        },
        "required": ["url"],
    }

    @staticmethod
    def execute(url: str, max_length: int = 5000) -> Dict[str, Any]:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            request = urllib.request.Request(url, headers=headers)

            with urllib.request.urlopen(request, timeout=15) as response:
                html = response.read().decode("utf-8")

            text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<[^>]+>', '', text)
            text = re.sub(r'\s+', ' ', text)
            text = text.strip()

            if len(text) > max_length:
                text = text[:max_length] + "..."

            return {
                "success": True,
                "url": url,
                "content": text,
                "char_count": len(text),
            }
        except Exception as e:
            return {
                "success": False,
                "url": url,
                "error": str(e),
                "error_en": str(e),
            }


class ListDirectory:
    name = "ls"
    description_zh = "列出目录内容，支持中文路径"
    description_en = "List directory contents, supports Chinese paths"

    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "目录路径",
                "default": ".",
            },
            "show_hidden": {
                "type": "boolean",
                "description": "显示隐藏文件",
                "default": False,
            },
        },
        "required": ["path"],
    }

    @staticmethod
    def execute(path: str = ".", show_hidden: bool = False) -> Dict[str, Any]:
        try:
            dir_path = Path(path)

            if not dir_path.exists():
                return {
                    "success": False,
                    "path": path,
                    "error": "目录不存在",
                    "error_en": "Directory not found",
                }

            if not dir_path.is_dir():
                return {
                    "success": False,
                    "path": path,
                    "error": "路径不是目录",
                    "error_en": "Path is not a directory",
                }

            items = []
            for item in dir_path.iterdir():
                if not show_hidden and item.name.startswith("."):
                    continue

                stat = item.stat()
                items.append({
                    "name": item.name,
                    "is_dir": item.is_dir(),
                    "size": stat.st_size,
                })

            items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

            return {
                "success": True,
                "path": path,
                "items": items,
                "count": len(items),
            }
        except Exception as e:
            return {
                "success": False,
                "path": path,
                "error": str(e),
                "error_en": str(e),
            }


class CreateDirectory:
    name = "mkdir"
    description_zh = "创建目录，支持中文路径"
    description_en = "Create directory, supports Chinese paths"

    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "目录路径",
            },
            "parents": {
                "type": "boolean",
                "description": "创建父目录",
                "default": True,
            },
        },
        "required": ["path"],
    }

    @staticmethod
    def execute(path: str, parents: bool = True) -> Dict[str, Any]:
        try:
            dir_path = Path(path)
            dir_path.mkdir(parents=parents, exist_ok=True)

            return {
                "success": True,
                "path": path,
                "created": True,
            }
        except Exception as e:
            return {
                "success": False,
                "path": path,
                "error": str(e),
                "error_en": str(e),
            }


class ToolRegistry:
    _tools: Dict[str, ToolDefinition] = {}

    @classmethod
    def register(cls, tool: ToolDefinition):
        cls._tools[tool.name] = tool

    @classmethod
    def get_tool(cls, name: str) -> Optional[ToolDefinition]:
        return cls._tools.get(name)

    @classmethod
    def list_tools(cls) -> list:
        return list(cls._tools.values())

    @classmethod
    def execute_tool(cls, name: str, **kwargs) -> Dict[str, Any]:
        tool = cls.get_tool(name)
        if not tool:
            return {
                "success": False,
                "error": f"工具不存在: {name}",
                "error_en": f"Tool not found: {name}",
            }

        try:
            return tool.func(**kwargs)
        except TypeError as e:
            return {
                "success": False,
                "error": f"参数错误: {str(e)}",
                "error_en": f"Parameter error: {str(e)}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_en": str(e),
            }


ToolRegistry.register(ToolDefinition(
    Calculator.name,
    Calculator.description_zh,
    Calculator.description_en,
    Calculator.parameters,
    Calculator.execute,
))

ToolRegistry.register(ToolDefinition(
    FileReader.name,
    FileReader.description_zh,
    FileReader.description_en,
    FileReader.parameters,
    FileReader.execute,
))

ToolRegistry.register(ToolDefinition(
    FileWriter.name,
    FileWriter.description_zh,
    FileWriter.description_en,
    FileWriter.parameters,
    FileWriter.execute,
))

ToolRegistry.register(ToolDefinition(
    PythonExecutor.name,
    PythonExecutor.description_zh,
    PythonExecutor.description_en,
    PythonExecutor.parameters,
    PythonExecutor.execute,
))

ToolRegistry.register(ToolDefinition(
    WebSearch.name,
    WebSearch.description_zh,
    WebSearch.description_en,
    WebSearch.parameters,
    WebSearch.execute,
))

ToolRegistry.register(ToolDefinition(
    WebFetch.name,
    WebFetch.description_zh,
    WebFetch.description_en,
    WebFetch.parameters,
    WebFetch.execute,
))

ToolRegistry.register(ToolDefinition(
    ListDirectory.name,
    ListDirectory.description_zh,
    ListDirectory.description_en,
    ListDirectory.parameters,
    ListDirectory.execute,
))

ToolRegistry.register(ToolDefinition(
    CreateDirectory.name,
    CreateDirectory.description_zh,
    CreateDirectory.description_en,
    CreateDirectory.parameters,
    CreateDirectory.execute,
))


def get_tool_schemas(language: str = "zh") -> list:
    schemas = []
    for tool in ToolRegistry.list_tools():
        schemas.append({
            "name": tool.name,
            "description": tool.get_description(language),
            "parameters": tool.parameters,
        })
    return schemas


def execute_tool(name: str, **kwargs) -> Dict[str, Any]:
    return ToolRegistry.execute_tool(name, **kwargs)

"""
工具注册表
管理和注册各种工具
"""

from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
import logging
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ToolDefinition:
    """工具定义"""
    tool_id: str
    name: str
    description: str
    category: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    returns: Dict[str, Any] = field(default_factory=dict)
    examples: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ToolRegistry:
    """工具注册表"""
    
    def __init__(self):
        self.tools: Dict[str, ToolDefinition] = {}
        self.handlers: Dict[str, Callable] = {}
        self.categories: Dict[str, List[str]] = {}
        self._initialize_default_tools()
    
    def _initialize_default_tools(self):
        """初始化默认工具"""
        # 搜索工具
        self.register_tool(ToolDefinition(
            tool_id="web_search",
            name="网络搜索",
            description="在网络上搜索信息",
            category="search",
            parameters={
                "query": {"type": "string", "description": "搜索查询"},
                "max_results": {"type": "integer", "description": "最大结果数", "default": 10}
            },
            returns={
                "results": {"type": "array", "description": "搜索结果列表"}
            }
        ))
        
        # 文档处理工具
        self.register_tool(ToolDefinition(
            tool_id="document_processor",
            name="文档处理器",
            description="处理各种格式的文档",
            category="document",
            parameters={
                "document_path": {"type": "string", "description": "文档路径"},
                "operation": {"type": "string", "description": "操作类型", "enum": ["read", "write", "convert", "analyze"]}
            },
            returns={
                "result": {"type": "object", "description": "处理结果"}
            }
        ))
        
        # 数据分析工具
        self.register_tool(ToolDefinition(
            tool_id="data_analyzer",
            name="数据分析器",
            description="分析数据并生成报告",
            category="analysis",
            parameters={
                "data": {"type": "object", "description": "要分析的数据"},
                "analysis_type": {"type": "string", "description": "分析类型", "enum": ["statistical", "trend", "comparison"]}
            },
            returns={
                "analysis_result": {"type": "object", "description": "分析结果"}
            }
        ))
        
        # 代码执行工具
        self.register_tool(ToolDefinition(
            tool_id="code_executor",
            name="代码执行器",
            description="执行Python代码",
            category="code",
            parameters={
                "code": {"type": "string", "description": "要执行的代码"},
                "language": {"type": "string", "description": "编程语言", "default": "python"}
            },
            returns={
                "output": {"type": "string", "description": "执行输出"},
                "error": {"type": "string", "description": "错误信息"}
            }
        ))
        
        # PPT生成工具
        self.register_tool(ToolDefinition(
            tool_id="ppt_generator",
            name="PPT生成器",
            description="生成演示文稿",
            category="multimedia",
            parameters={
                "topic": {"type": "string", "description": "演示主题"},
                "slides": {"type": "array", "description": "幻灯片内容"},
                "style": {"type": "string", "description": "演示风格", "default": "professional"}
            },
            returns={
                "ppt_path": {"type": "string", "description": "生成的PPT文件路径"}
            }
        ))
        
        # 报告生成工具
        self.register_tool(ToolDefinition(
            tool_id="report_generator",
            name="报告生成器",
            description="生成各种类型的报告",
            category="document",
            parameters={
                "report_type": {"type": "string", "description": "报告类型"},
                "data": {"type": "object", "description": "报告数据"},
                "format": {"type": "string", "description": "输出格式", "enum": ["markdown", "html", "pdf"], "default": "markdown"}
            },
            returns={
                "report_content": {"type": "string", "description": "报告内容"}
            }
        ))
        
        logger.info(f"初始化了 {len(self.tools)} 个默认工具")
    
    def register_tool(self, tool: ToolDefinition):
        """注册工具"""
        self.tools[tool.tool_id] = tool
        
        # 更新分类索引
        if tool.category not in self.categories:
            self.categories[tool.category] = []
        self.categories[tool.category].append(tool.tool_id)
        
        logger.info(f"注册工具: {tool.tool_id} - {tool.name}")
    
    def register_handler(self, tool_id: str, handler: Callable):
        """注册工具处理器"""
        if tool_id not in self.tools:
            logger.warning(f"工具未注册: {tool_id}")
            return False
        
        self.handlers[tool_id] = handler
        logger.info(f"注册工具处理器: {tool_id}")
        return True
    
    def get_tool(self, tool_id: str) -> Optional[ToolDefinition]:
        """获取工具定义"""
        return self.tools.get(tool_id)
    
    def get_tools_by_category(self, category: str) -> List[ToolDefinition]:
        """获取分类下的所有工具"""
        tool_ids = self.categories.get(category, [])
        return [self.tools[tid] for tid in tool_ids if tid in self.tools]
    
    def list_tools(self) -> List[Dict[str, Any]]:
        """列出所有工具"""
        return [
            {
                "tool_id": t.tool_id,
                "name": t.name,
                "description": t.description,
                "category": t.category,
                "parameters": t.parameters
            }
            for t in self.tools.values()
        ]
    
    def list_categories(self) -> List[str]:
        """列出所有分类"""
        return list(self.categories.keys())
    
    async def execute_tool(self, tool_id: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """执行工具"""
        tool = self.tools.get(tool_id)
        if not tool:
            return {
                "success": False,
                "error": f"工具不存在: {tool_id}"
            }
        
        handler = self.handlers.get(tool_id)
        if not handler:
            # 模拟执行
            return await self._simulate_tool_execution(tool, parameters)
        
        try:
            # 执行处理器
            if asyncio.iscoroutinefunction(handler):
                result = await handler(parameters)
            else:
                result = handler(parameters)
            
            return {
                "success": True,
                "tool_id": tool_id,
                "result": result,
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"工具执行失败: {tool_id} - {e}")
            return {
                "success": False,
                "tool_id": tool_id,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _simulate_tool_execution(self, tool: ToolDefinition, 
                                       parameters: Dict[str, Any]) -> Dict[str, Any]:
        """模拟工具执行"""
        logger.info(f"模拟执行工具: {tool.tool_id}")
        
        # 根据工具类型返回模拟结果
        if tool.tool_id == "web_search":
            return {
                "success": True,
                "tool_id": tool.tool_id,
                "result": {
                    "query": parameters.get("query"),
                    "results": [
                        {"title": "搜索结果1", "url": "https://example.com/1", "snippet": "相关内容..."},
                        {"title": "搜索结果2", "url": "https://example.com/2", "snippet": "相关内容..."}
                    ]
                },
                "timestamp": datetime.now().isoformat()
            }
        
        elif tool.tool_id == "document_processor":
            return {
                "success": True,
                "tool_id": tool.tool_id,
                "result": {
                    "operation": parameters.get("operation"),
                    "status": "completed",
                    "message": "文档处理完成"
                },
                "timestamp": datetime.now().isoformat()
            }
        
        elif tool.tool_id == "data_analyzer":
            return {
                "success": True,
                "tool_id": tool.tool_id,
                "result": {
                    "analysis_type": parameters.get("analysis_type"),
                    "statistics": {"mean": 0, "median": 0, "std": 0},
                    "insights": ["洞察1", "洞察2"]
                },
                "timestamp": datetime.now().isoformat()
            }
        
        elif tool.tool_id == "code_executor":
            return {
                "success": True,
                "tool_id": tool.tool_id,
                "result": {
                    "output": "代码执行成功",
                    "execution_time": 0.5
                },
                "timestamp": datetime.now().isoformat()
            }
        
        else:
            return {
                "success": True,
                "tool_id": tool.tool_id,
                "result": {"status": "completed", "message": f"工具 {tool.name} 执行完成"},
                "timestamp": datetime.now().isoformat()
            }
    
    def get_tool_schema(self, tool_id: str) -> Optional[Dict[str, Any]]:
        """获取工具的JSON Schema"""
        tool = self.tools.get(tool_id)
        if not tool:
            return None
        
        return {
            "name": tool.name,
            "description": tool.description,
            "parameters": {
                "type": "object",
                "properties": tool.parameters,
                "required": [k for k, v in tool.parameters.items() if v.get("required", False)]
            },
            "returns": tool.returns
        }

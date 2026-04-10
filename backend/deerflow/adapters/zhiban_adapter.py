"""
智能体适配器
将智办AI现有工具适配到DeerFlow框架
"""

from typing import Dict, List, Any, Optional
import logging
import sys
import os
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

logger = logging.getLogger(__name__)


class ZhibanToolAdapter:
    """智办AI工具适配器"""
    
    def __init__(self):
        self.tools = {}
        self._initialize_tools()
    
    def _initialize_tools(self):
        """初始化智办AI工具"""
        logger.info("初始化智办AI工具适配器...")
        
        # 注册文档处理工具
        self._register_document_tools()
        
        # 注册数据分析工具
        self._register_data_tools()
        
        # 注册PPT生成工具
        self._register_ppt_tools()
        
        # 注册搜索工具
        self._register_search_tools()
        
        logger.info(f"初始化了 {len(self.tools)} 个智办AI工具")
    
    def _register_document_tools(self):
        """注册文档处理工具"""
        try:
            # 尝试导入智办AI的文档处理工具
            from shared.backend.deerflow.tools import ToolRegistry
            
            # 注册Word文档处理
            self.tools["word_processor"] = {
                "name": "Word文档处理器",
                "description": "处理Word文档，支持创建、编辑、格式化等操作",
                "category": "document",
                "handler": self._handle_word_document
            }
            
            # 注册文档格式化
            self.tools["document_formatter"] = {
                "name": "文档格式化器",
                "description": "格式化文档，支持多种格式标准",
                "category": "document",
                "handler": self._handle_document_format
            }
            
            logger.info("注册文档处理工具成功")
        
        except Exception as e:
            logger.warning(f"注册文档处理工具失败: {e}")
    
    def _register_data_tools(self):
        """注册数据分析工具"""
        try:
            # 注册Excel处理
            self.tools["excel_processor"] = {
                "name": "Excel处理器",
                "description": "处理Excel文件，支持数据分析、公式生成等",
                "category": "data",
                "handler": self._handle_excel
            }
            
            # 注册数据分析
            self.tools["data_analyzer"] = {
                "name": "数据分析器",
                "description": "分析数据并生成报告",
                "category": "data",
                "handler": self._handle_data_analysis
            }
            
            logger.info("注册数据分析工具成功")
        
        except Exception as e:
            logger.warning(f"注册数据分析工具失败: {e}")
    
    def _register_ppt_tools(self):
        """注册PPT生成工具"""
        try:
            # 注册PPT生成
            self.tools["ppt_generator"] = {
                "name": "PPT生成器",
                "description": "生成演示文稿，支持多种模板和风格",
                "category": "multimedia",
                "handler": self._handle_ppt_generation
            }
            
            logger.info("注册PPT生成工具成功")
        
        except Exception as e:
            logger.warning(f"注册PPT生成工具失败: {e}")
    
    def _register_search_tools(self):
        """注册搜索工具"""
        try:
            # 注册网络搜索
            self.tools["web_search"] = {
                "name": "网络搜索",
                "description": "在网络上搜索信息",
                "category": "search",
                "handler": self._handle_web_search
            }
            
            # 注册文件搜索
            self.tools["file_search"] = {
                "name": "文件搜索",
                "description": "在本地文件系统中搜索文件",
                "category": "search",
                "handler": self._handle_file_search
            }
            
            logger.info("注册搜索工具成功")
        
        except Exception as e:
            logger.warning(f"注册搜索工具失败: {e}")
    
    async def _handle_word_document(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """处理Word文档"""
        operation = parameters.get("operation", "create")
        content = parameters.get("content", "")
        
        logger.info(f"处理Word文档: {operation}")
        
        # 模拟处理
        return {
            "status": "success",
            "operation": operation,
            "message": f"Word文档{operation}操作完成",
            "content_length": len(content)
        }
    
    async def _handle_document_format(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """格式化文档"""
        format_type = parameters.get("format_type", "standard")
        content = parameters.get("content", "")
        
        logger.info(f"格式化文档: {format_type}")
        
        # 模拟格式化
        return {
            "status": "success",
            "format_type": format_type,
            "message": "文档格式化完成"
        }
    
    async def _handle_excel(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """处理Excel"""
        operation = parameters.get("operation", "read")
        data = parameters.get("data", {})
        
        logger.info(f"处理Excel: {operation}")
        
        # 模拟处理
        return {
            "status": "success",
            "operation": operation,
            "message": f"Excel{operation}操作完成",
            "rows_processed": len(data) if isinstance(data, list) else 0
        }
    
    async def _handle_data_analysis(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """数据分析"""
        data = parameters.get("data", {})
        analysis_type = parameters.get("analysis_type", "statistical")
        
        logger.info(f"数据分析: {analysis_type}")
        
        # 模拟分析
        return {
            "status": "success",
            "analysis_type": analysis_type,
            "statistics": {
                "count": len(data) if isinstance(data, list) else 1,
                "mean": 0,
                "median": 0,
                "std": 0
            },
            "insights": ["数据洞察1", "数据洞察2"]
        }
    
    async def _handle_ppt_generation(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """生成PPT"""
        topic = parameters.get("topic", "")
        slides = parameters.get("slides", [])
        style = parameters.get("style", "professional")
        
        logger.info(f"生成PPT: {topic}")
        
        # 模拟生成
        return {
            "status": "success",
            "topic": topic,
            "slide_count": len(slides) if slides else 10,
            "style": style,
            "message": "PPT生成完成"
        }
    
    async def _handle_web_search(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """网络搜索"""
        query = parameters.get("query", "")
        max_results = parameters.get("max_results", 10)
        
        logger.info(f"网络搜索: {query}")
        
        # 模拟搜索
        return {
            "status": "success",
            "query": query,
            "results": [
                {"title": f"搜索结果{i+1}", "url": f"https://example.com/{i+1}", "snippet": "相关内容..."}
                for i in range(min(max_results, 5))
            ]
        }
    
    async def _handle_file_search(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """文件搜索"""
        query = parameters.get("query", "")
        directory = parameters.get("directory", ".")
        
        logger.info(f"文件搜索: {query} in {directory}")
        
        # 模拟搜索
        return {
            "status": "success",
            "query": query,
            "directory": directory,
            "results": [
                {"name": f"文件{i+1}.txt", "path": f"{directory}/文件{i+1}.txt", "size": 1024}
                for i in range(3)
            ]
        }
    
    def get_tool(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """获取工具"""
        return self.tools.get(tool_name)
    
    def list_tools(self) -> List[str]:
        """列出所有工具"""
        return list(self.tools.keys())
    
    async def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """执行工具"""
        tool = self.tools.get(tool_name)
        if not tool:
            return {
                "status": "error",
                "error": f"工具不存在: {tool_name}"
            }
        
        handler = tool.get("handler")
        if not handler:
            return {
                "status": "error",
                "error": f"工具处理器不存在: {tool_name}"
            }
        
        try:
            result = await handler(parameters)
            return result
        
        except Exception as e:
            logger.error(f"工具执行失败: {tool_name} - {e}")
            return {
                "status": "error",
                "error": str(e)
            }


class AgentAdapter:
    """智能体适配器 - 将智办AI的智能体适配到DeerFlow"""
    
    def __init__(self, zhiban_tool_adapter: ZhibanToolAdapter):
        self.tool_adapter = zhiban_tool_adapter
        self.agents = {}
        self._initialize_agents()
    
    def _initialize_agents(self):
        """初始化智能体"""
        logger.info("初始化智能体适配器...")
        
        # 导入DeerFlow的智能体
        try:
            from shared.backend.deerflow.agents import (
                ResearcherAgent, CoderAgent, ReporterAgent
            )
            
            # 创建智能体实例
            researcher = ResearcherAgent()
            coder = CoderAgent()
            reporter = ReporterAgent()
            
            # 注册工具到智能体
            for tool_name in self.tool_adapter.list_tools():
                tool = self.tool_adapter.get_tool(tool_name)
                if tool:
                    researcher.register_tool(tool_name, tool)
                    coder.register_tool(tool_name, tool)
                    reporter.register_tool(tool_name, tool)
            
            # 注册智能体
            self.agents["researcher"] = researcher
            self.agents["coder"] = coder
            self.agents["reporter"] = reporter
            
            logger.info(f"初始化了 {len(self.agents)} 个智能体")
        
        except Exception as e:
            logger.warning(f"初始化智能体失败: {e}")
    
    def get_agent(self, agent_name: str):
        """获取智能体"""
        return self.agents.get(agent_name)
    
    def list_agents(self) -> List[str]:
        """列出所有智能体"""
        return list(self.agents.keys())
    
    async def run_agent(self, agent_name: str, task: Dict[str, Any]) -> Dict[str, Any]:
        """运行智能体"""
        agent = self.agents.get(agent_name)
        if not agent:
            return {
                "success": False,
                "error": f"智能体不存在: {agent_name}"
            }
        
        try:
            result = await agent.run(task)
            return {
                "success": result.success,
                "output": result.output,
                "error": result.error
            }
        
        except Exception as e:
            logger.error(f"智能体运行失败: {agent_name} - {e}")
            return {
                "success": False,
                "error": str(e)
            }

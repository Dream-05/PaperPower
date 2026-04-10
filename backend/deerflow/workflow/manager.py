"""
工作流管理器
管理工作流定义和实例
"""

from typing import Dict, List, Any, Optional
import logging
import json
import uuid
from datetime import datetime
from pathlib import Path

from .types import (
    WorkflowDefinition, WorkflowInstance, WorkflowStatus,
    WorkflowNode, WorkflowEdge, NodeType
)

logger = logging.getLogger(__name__)


class WorkflowManager:
    """工作流管理器"""
    
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = Path(storage_path) if storage_path else Path("./data/workflows")
        self.workflows: Dict[str, WorkflowDefinition] = {}
        self.instances: Dict[str, WorkflowInstance] = {}
        self.templates: Dict[str, WorkflowDefinition] = {}
        self._initialize()
    
    def _initialize(self):
        """初始化管理器"""
        logger.info("初始化工作流管理器...")
        
        # 确保存储目录存在
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # 加载模板
        self._load_default_templates()
        
        # 加载已保存的工作流
        self._load_workflows()
        
        logger.info(f"工作流管理器初始化完成，已加载 {len(self.workflows)} 个工作流")
    
    def _load_default_templates(self):
        """加载默认模板"""
        # 研究工作流模板
        research_workflow = WorkflowDefinition(
            workflow_id="template_research",
            name="研究工作流",
            description="自动化研究流程",
            nodes=[
                WorkflowNode("start", NodeType.START, "开始"),
                WorkflowNode("analyze", NodeType.TASK, "分析需求", "分析研究目标和范围"),
                WorkflowNode("search", NodeType.TASK, "搜索资料", "搜索相关资料"),
                WorkflowNode("extract", NodeType.TASK, "提取信息", "提取关键信息"),
                WorkflowNode("synthesize", NodeType.TASK, "综合分析", "综合分析结果"),
                WorkflowNode("report", NodeType.TASK, "生成报告", "生成研究报告"),
                WorkflowNode("end", NodeType.END, "结束")
            ],
            edges=[
                WorkflowEdge("e1", "start", "analyze"),
                WorkflowEdge("e2", "analyze", "search"),
                WorkflowEdge("e3", "search", "extract"),
                WorkflowEdge("e4", "extract", "synthesize"),
                WorkflowEdge("e5", "synthesize", "report"),
                WorkflowEdge("e6", "report", "end")
            ]
        )
        self.templates["research"] = research_workflow
        
        # 文档生成工作流模板
        doc_workflow = WorkflowDefinition(
            workflow_id="template_document",
            name="文档生成工作流",
            description="自动化文档生成流程",
            nodes=[
                WorkflowNode("start", NodeType.START, "开始"),
                WorkflowNode("analyze", NodeType.TASK, "分析需求", "分析文档需求"),
                WorkflowNode("outline", NodeType.TASK, "生成大纲", "生成文档大纲"),
                WorkflowNode("research", NodeType.TASK, "收集资料", "收集相关资料"),
                WorkflowNode("write", NodeType.TASK, "撰写内容", "撰写文档内容"),
                WorkflowNode("format", NodeType.TASK, "格式化", "格式化文档"),
                WorkflowNode("review", NodeType.TASK, "审核", "审核文档质量"),
                WorkflowNode("end", NodeType.END, "结束")
            ],
            edges=[
                WorkflowEdge("e1", "start", "analyze"),
                WorkflowEdge("e2", "analyze", "outline"),
                WorkflowEdge("e3", "outline", "research"),
                WorkflowEdge("e4", "research", "write"),
                WorkflowEdge("e5", "write", "format"),
                WorkflowEdge("e6", "format", "review"),
                WorkflowEdge("e7", "review", "end")
            ]
        )
        self.templates["document"] = doc_workflow
        
        # 数据分析工作流模板
        data_workflow = WorkflowDefinition(
            workflow_id="template_data_analysis",
            name="数据分析工作流",
            description="自动化数据分析流程",
            nodes=[
                WorkflowNode("start", NodeType.START, "开始"),
                WorkflowNode("load", NodeType.TASK, "加载数据", "加载数据源"),
                WorkflowNode("clean", NodeType.TASK, "数据清洗", "清洗和处理数据"),
                WorkflowNode("analyze", NodeType.TASK, "数据分析", "执行数据分析"),
                WorkflowNode("visualize", NodeType.TASK, "数据可视化", "创建可视化图表"),
                WorkflowNode("report", NodeType.TASK, "生成报告", "生成分析报告"),
                WorkflowNode("end", NodeType.END, "结束")
            ],
            edges=[
                WorkflowEdge("e1", "start", "load"),
                WorkflowEdge("e2", "load", "clean"),
                WorkflowEdge("e3", "clean", "analyze"),
                WorkflowEdge("e4", "analyze", "visualize"),
                WorkflowEdge("e5", "visualize", "report"),
                WorkflowEdge("e6", "report", "end")
            ]
        )
        self.templates["data_analysis"] = data_workflow
        
        logger.info(f"加载了 {len(self.templates)} 个默认模板")
    
    def _load_workflows(self):
        """加载已保存的工作流"""
        workflows_file = self.storage_path / "workflows.json"
        if workflows_file.exists():
            try:
                with open(workflows_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for workflow_data in data:
                        workflow = self._dict_to_workflow(workflow_data)
                        self.workflows[workflow.workflow_id] = workflow
                logger.info(f"从文件加载了 {len(self.workflows)} 个工作流")
            except Exception as e:
                logger.error(f"加载工作流失败: {e}")
    
    def _save_workflows(self):
        """保存工作流到文件"""
        workflows_file = self.storage_path / "workflows.json"
        try:
            data = [self._workflow_to_dict(w) for w in self.workflows.values()]
            with open(workflows_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            logger.info(f"保存了 {len(self.workflows)} 个工作流")
        except Exception as e:
            logger.error(f"保存工作流失败: {e}")
    
    def _workflow_to_dict(self, workflow: WorkflowDefinition) -> Dict[str, Any]:
        """将工作流转换为字典"""
        return {
            "workflow_id": workflow.workflow_id,
            "name": workflow.name,
            "description": workflow.description,
            "version": workflow.version,
            "nodes": [
                {
                    "node_id": n.node_id,
                    "node_type": n.node_type.value,
                    "name": n.name,
                    "description": n.description,
                    "config": n.config,
                    "position": n.position
                }
                for n in workflow.nodes
            ],
            "edges": [
                {
                    "edge_id": e.edge_id,
                    "source_node_id": e.source_node_id,
                    "target_node_id": e.target_node_id,
                    "condition": e.condition,
                    "label": e.label
                }
                for e in workflow.edges
            ],
            "variables": workflow.variables,
            "metadata": workflow.metadata,
            "created_at": workflow.created_at.isoformat(),
            "updated_at": workflow.updated_at.isoformat()
        }
    
    def _dict_to_workflow(self, data: Dict[str, Any]) -> WorkflowDefinition:
        """将字典转换为工作流"""
        return WorkflowDefinition(
            workflow_id=data["workflow_id"],
            name=data["name"],
            description=data["description"],
            version=data.get("version", "1.0"),
            nodes=[
                WorkflowNode(
                    node_id=n["node_id"],
                    node_type=NodeType(n["node_type"]),
                    name=n["name"],
                    description=n.get("description", ""),
                    config=n.get("config", {}),
                    position=n.get("position", {"x": 0, "y": 0})
                )
                for n in data.get("nodes", [])
            ],
            edges=[
                WorkflowEdge(
                    edge_id=e["edge_id"],
                    source_node_id=e["source_node_id"],
                    target_node_id=e["target_node_id"],
                    condition=e.get("condition"),
                    label=e.get("label", "")
                )
                for e in data.get("edges", [])
            ],
            variables=data.get("variables", {}),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if "updated_at" in data else datetime.now()
        )
    
    def create_workflow(self, name: str, description: str = "", 
                       template: Optional[str] = None) -> WorkflowDefinition:
        """创建工作流"""
        workflow_id = str(uuid.uuid4())
        
        if template and template in self.templates:
            # 基于模板创建
            template_workflow = self.templates[template]
            workflow = WorkflowDefinition(
                workflow_id=workflow_id,
                name=name,
                description=description or template_workflow.description,
                nodes=[
                    WorkflowNode(
                        node_id=n.node_id,
                        node_type=n.node_type,
                        name=n.name,
                        description=n.description,
                        config=n.config.copy(),
                        position=n.position.copy()
                    )
                    for n in template_workflow.nodes
                ],
                edges=[
                    WorkflowEdge(
                        edge_id=e.edge_id,
                        source_node_id=e.source_node_id,
                        target_node_id=e.target_node_id,
                        condition=e.condition,
                        label=e.label
                    )
                    for e in template_workflow.edges
                ],
                variables=template_workflow.variables.copy(),
                metadata={"template": template}
            )
        else:
            # 创建空工作流
            workflow = WorkflowDefinition(
                workflow_id=workflow_id,
                name=name,
                description=description,
                nodes=[
                    WorkflowNode("start", NodeType.START, "开始", position={"x": 100, "y": 100}),
                    WorkflowNode("end", NodeType.END, "结束", position={"x": 100, "y": 500})
                ],
                edges=[]
            )
        
        self.workflows[workflow_id] = workflow
        self._save_workflows()
        
        logger.info(f"创建工作流: {workflow_id} - {name}")
        return workflow
    
    def get_workflow(self, workflow_id: str) -> Optional[WorkflowDefinition]:
        """获取工作流"""
        return self.workflows.get(workflow_id)
    
    def update_workflow(self, workflow_id: str, updates: Dict[str, Any]) -> Optional[WorkflowDefinition]:
        """更新工作流"""
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            return None
        
        # 应用更新
        if "name" in updates:
            workflow.name = updates["name"]
        if "description" in updates:
            workflow.description = updates["description"]
        if "nodes" in updates:
            workflow.nodes = [
                WorkflowNode(**n) if isinstance(n, dict) else n
                for n in updates["nodes"]
            ]
        if "edges" in updates:
            workflow.edges = [
                WorkflowEdge(**e) if isinstance(e, dict) else e
                for e in updates["edges"]
            ]
        if "variables" in updates:
            workflow.variables = updates["variables"]
        
        workflow.updated_at = datetime.now()
        self._save_workflows()
        
        logger.info(f"更新工作流: {workflow_id}")
        return workflow
    
    def delete_workflow(self, workflow_id: str) -> bool:
        """删除工作流"""
        if workflow_id in self.workflows:
            del self.workflows[workflow_id]
            self._save_workflows()
            logger.info(f"删除工作流: {workflow_id}")
            return True
        return False
    
    def list_workflows(self) -> List[Dict[str, Any]]:
        """列出所有工作流"""
        return [
            {
                "workflow_id": w.workflow_id,
                "name": w.name,
                "description": w.description,
                "version": w.version,
                "node_count": len(w.nodes),
                "edge_count": len(w.edges),
                "created_at": w.created_at.isoformat(),
                "updated_at": w.updated_at.isoformat()
            }
            for w in self.workflows.values()
        ]
    
    def create_instance(self, workflow_id: str, context: Optional[Dict[str, Any]] = None) -> Optional[WorkflowInstance]:
        """创建工作流实例"""
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            return None
        
        instance_id = str(uuid.uuid4())
        instance = WorkflowInstance(
            instance_id=instance_id,
            workflow_id=workflow_id,
            status=WorkflowStatus.PENDING,
            context=context or {},
            variables=workflow.variables.copy()
        )
        
        self.instances[instance_id] = instance
        logger.info(f"创建工作流实例: {instance_id}")
        
        return instance
    
    def get_instance(self, instance_id: str) -> Optional[WorkflowInstance]:
        """获取工作流实例"""
        return self.instances.get(instance_id)
    
    def get_templates(self) -> Dict[str, Dict[str, Any]]:
        """获取所有模板"""
        return {
            name: {
                "workflow_id": w.workflow_id,
                "name": w.name,
                "description": w.description,
                "node_count": len(w.nodes),
                "edge_count": len(w.edges)
            }
            for name, w in self.templates.items()
        }

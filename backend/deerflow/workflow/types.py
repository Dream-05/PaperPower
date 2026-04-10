"""
工作流类型定义
"""

from typing import Dict, List, Any, Optional, TypedDict, Literal
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class WorkflowStatus(Enum):
    """工作流状态"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class NodeType(Enum):
    """节点类型"""
    START = "start"
    END = "end"
    TASK = "task"
    CONDITION = "condition"
    PARALLEL = "parallel"
    LOOP = "loop"
    SUBWORKFLOW = "subworkflow"


@dataclass
class WorkflowNode:
    """工作流节点"""
    node_id: str
    node_type: NodeType
    name: str
    description: str = ""
    config: Dict[str, Any] = field(default_factory=dict)
    position: Dict[str, float] = field(default_factory=lambda: {"x": 0, "y": 0})


@dataclass
class WorkflowEdge:
    """工作流边"""
    edge_id: str
    source_node_id: str
    target_node_id: str
    condition: Optional[str] = None
    label: str = ""


@dataclass
class WorkflowDefinition:
    """工作流定义"""
    workflow_id: str
    name: str
    description: str
    version: str = "1.0"
    nodes: List[WorkflowNode] = field(default_factory=list)
    edges: List[WorkflowEdge] = field(default_factory=list)
    variables: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class WorkflowInstance:
    """工作流实例"""
    instance_id: str
    workflow_id: str
    status: WorkflowStatus = WorkflowStatus.PENDING
    context: Dict[str, Any] = field(default_factory=dict)
    current_node_id: Optional[str] = None
    execution_history: List[Dict[str, Any]] = field(default_factory=list)
    variables: Dict[str, Any] = field(default_factory=dict)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


@dataclass
class NodeExecutionResult:
    """节点执行结果"""
    node_id: str
    success: bool
    output: Any
    error: Optional[str] = None
    duration: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)


class WorkflowState(TypedDict):
    """工作流状态（用于LangGraph）"""
    workflow_id: str
    instance_id: str
    current_node: str
    context: Dict[str, Any]
    variables: Dict[str, Any]
    history: List[Dict[str, Any]]
    status: str
    error: Optional[str]

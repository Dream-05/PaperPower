"""
工作流执行器
执行工作流实例
"""

from typing import Dict, List, Any, Optional
import logging
import asyncio
from datetime import datetime
import uuid

from .types import (
    WorkflowDefinition, WorkflowInstance, WorkflowStatus,
    WorkflowNode, NodeType, NodeExecutionResult
)

logger = logging.getLogger(__name__)


class WorkflowExecutor:
    """工作流执行器"""
    
    def __init__(self, workflow_manager, agent_registry: Optional[Dict[str, Any]] = None):
        self.workflow_manager = workflow_manager
        self.agent_registry = agent_registry or {}
        self.running_instances: Dict[str, asyncio.Task] = {}
        self._initialize()
    
    def _initialize(self):
        """初始化执行器"""
        logger.info("初始化工作流执行器...")
        logger.info("工作流执行器初始化完成")
    
    def register_agent(self, name: str, agent: Any):
        """注册智能体"""
        self.agent_registry[name] = agent
        logger.info(f"注册智能体: {name}")
    
    async def execute_instance(self, instance_id: str) -> Dict[str, Any]:
        """执行工作流实例"""
        instance = self.workflow_manager.get_instance(instance_id)
        if not instance:
            return {"success": False, "error": "实例不存在"}
        
        workflow = self.workflow_manager.get_workflow(instance.workflow_id)
        if not workflow:
            return {"success": False, "error": "工作流不存在"}
        
        logger.info(f"开始执行工作流实例: {instance_id}")
        
        # 更新状态
        instance.status = WorkflowStatus.RUNNING
        instance.started_at = datetime.now()
        
        try:
            # 找到起始节点
            start_node = self._find_start_node(workflow)
            if not start_node:
                raise ValueError("工作流没有起始节点")
            
            # 执行工作流
            result = await self._execute_from_node(workflow, instance, start_node)
            
            # 更新状态
            instance.status = WorkflowStatus.COMPLETED
            instance.completed_at = datetime.now()
            
            logger.info(f"工作流实例执行完成: {instance_id}")
            
            return {
                "success": True,
                "instance_id": instance_id,
                "result": result
            }
        
        except Exception as e:
            instance.status = WorkflowStatus.FAILED
            instance.error = str(e)
            instance.completed_at = datetime.now()
            
            logger.error(f"工作流实例执行失败: {instance_id} - {e}")
            
            return {
                "success": False,
                "instance_id": instance_id,
                "error": str(e)
            }
    
    def _find_start_node(self, workflow: WorkflowDefinition) -> Optional[WorkflowNode]:
        """找到起始节点"""
        for node in workflow.nodes:
            if node.node_type == NodeType.START:
                return node
        return None
    
    async def _execute_from_node(self, workflow: WorkflowDefinition, 
                                 instance: WorkflowInstance, 
                                 start_node: WorkflowNode) -> Dict[str, Any]:
        """从指定节点开始执行"""
        current_node = start_node
        results = {}
        
        while current_node and current_node.node_type != NodeType.END:
            # 记录当前节点
            instance.current_node_id = current_node.node_id
            
            # 执行节点
            node_result = await self._execute_node(workflow, instance, current_node)
            results[current_node.node_id] = node_result
            
            # 记录执行历史
            instance.execution_history.append({
                "node_id": current_node.node_id,
                "node_name": current_node.name,
                "timestamp": datetime.now().isoformat(),
                "success": node_result.success,
                "output": node_result.output if node_result.success else None,
                "error": node_result.error
            })
            
            if not node_result.success:
                raise Exception(f"节点执行失败: {current_node.name} - {node_result.error}")
            
            # 找到下一个节点
            current_node = self._get_next_node(workflow, current_node, node_result)
        
        return results
    
    async def _execute_node(self, workflow: WorkflowDefinition, 
                           instance: WorkflowInstance, 
                           node: WorkflowNode) -> NodeExecutionResult:
        """执行单个节点"""
        logger.info(f"执行节点: {node.name} ({node.node_id})")
        
        start_time = datetime.now()
        
        try:
            output = None
            
            if node.node_type == NodeType.START:
                output = {"status": "started"}
            
            elif node.node_type == NodeType.TASK:
                # 执行任务节点
                output = await self._execute_task_node(node, instance)
            
            elif node.node_type == NodeType.CONDITION:
                # 执行条件节点
                output = await self._execute_condition_node(node, instance)
            
            elif node.node_type == NodeType.PARALLEL:
                # 执行并行节点
                output = await self._execute_parallel_node(node, instance, workflow)
            
            else:
                output = {"status": "skipped", "reason": f"未知节点类型: {node.node_type}"}
            
            duration = (datetime.now() - start_time).total_seconds()
            
            return NodeExecutionResult(
                node_id=node.node_id,
                success=True,
                output=output,
                duration=duration
            )
        
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            
            return NodeExecutionResult(
                node_id=node.node_id,
                success=False,
                output=None,
                error=str(e),
                duration=duration
            )
    
    async def _execute_task_node(self, node: WorkflowNode, 
                                instance: WorkflowInstance) -> Dict[str, Any]:
        """执行任务节点"""
        task_type = node.config.get("task_type", "general")
        agent_name = node.config.get("agent", "default")
        
        # 获取智能体
        agent = self.agent_registry.get(agent_name)
        
        if agent:
            # 使用智能体执行
            task = {
                "task_type": task_type,
                "description": node.description,
                "config": node.config,
                "context": instance.context
            }
            result = await agent.run(task)
            return result.output if result.success else {"error": result.error}
        else:
            # 模拟执行
            return {
                "status": "completed",
                "task_type": task_type,
                "message": f"任务 '{node.name}' 执行完成"
            }
    
    async def _execute_condition_node(self, node: WorkflowNode, 
                                     instance: WorkflowInstance) -> Dict[str, Any]:
        """执行条件节点"""
        condition = node.config.get("condition", "true")
        
        # 简单的条件评估
        result = True  # 默认为True
        
        # 可以根据instance.context中的变量进行条件判断
        if condition in instance.context:
            result = bool(instance.context[condition])
        
        return {
            "condition": condition,
            "result": result
        }
    
    async def _execute_parallel_node(self, node: WorkflowNode, 
                                    instance: WorkflowInstance,
                                    workflow: WorkflowDefinition) -> Dict[str, Any]:
        """执行并行节点"""
        # 获取并行任务列表
        parallel_tasks = node.config.get("tasks", [])
        
        if not parallel_tasks:
            return {"status": "no_tasks"}
        
        # 并行执行任务
        results = await asyncio.gather(*[
            self._execute_task_node(
                WorkflowNode(
                    node_id=f"{node.node_id}_parallel_{i}",
                    node_type=NodeType.TASK,
                    name=task.get("name", f"并行任务{i}"),
                    description=task.get("description", ""),
                    config=task.get("config", {})
                ),
                instance
            )
            for i, task in enumerate(parallel_tasks)
        ])
        
        return {
            "status": "completed",
            "task_count": len(parallel_tasks),
            "results": results
        }
    
    def _get_next_node(self, workflow: WorkflowDefinition, 
                      current_node: WorkflowNode, 
                      result: NodeExecutionResult) -> Optional[WorkflowNode]:
        """获取下一个节点"""
        # 找到从当前节点出发的边
        outgoing_edges = [
            e for e in workflow.edges 
            if e.source_node_id == current_node.node_id
        ]
        
        if not outgoing_edges:
            return None
        
        # 简单情况：只有一个出边
        if len(outgoing_edges) == 1:
            target_id = outgoing_edges[0].target_node_id
            return self._get_node_by_id(workflow, target_id)
        
        # 条件分支：根据条件选择下一个节点
        for edge in outgoing_edges:
            if edge.condition:
                # 评估条件
                if self._evaluate_condition(edge.condition, result):
                    target_id = edge.target_node_id
                    return self._get_node_by_id(workflow, target_id)
        
        # 默认：选择第一个边
        target_id = outgoing_edges[0].target_node_id
        return self._get_node_by_id(workflow, target_id)
    
    def _get_node_by_id(self, workflow: WorkflowDefinition, node_id: str) -> Optional[WorkflowNode]:
        """根据ID获取节点"""
        for node in workflow.nodes:
            if node.node_id == node_id:
                return node
        return None
    
    def _evaluate_condition(self, condition: str, result: NodeExecutionResult) -> bool:
        """评估条件"""
        # 简单的条件评估
        if condition == "success":
            return result.success
        elif condition == "failure":
            return not result.success
        else:
            return True
    
    async def start_instance(self, instance_id: str) -> bool:
        """启动工作流实例"""
        if instance_id in self.running_instances:
            logger.warning(f"实例已在运行: {instance_id}")
            return False
        
        # 创建异步任务
        task = asyncio.create_task(self.execute_instance(instance_id))
        self.running_instances[instance_id] = task
        
        logger.info(f"启动工作流实例: {instance_id}")
        return True
    
    async def stop_instance(self, instance_id: str) -> bool:
        """停止工作流实例"""
        if instance_id not in self.running_instances:
            return False
        
        task = self.running_instances[instance_id]
        task.cancel()
        
        try:
            await task
        except asyncio.CancelledError:
            pass
        
        del self.running_instances[instance_id]
        
        # 更新实例状态
        instance = self.workflow_manager.get_instance(instance_id)
        if instance:
            instance.status = WorkflowStatus.CANCELLED
            instance.completed_at = datetime.now()
        
        logger.info(f"停止工作流实例: {instance_id}")
        return True
    
    def get_instance_status(self, instance_id: str) -> Optional[Dict[str, Any]]:
        """获取实例状态"""
        instance = self.workflow_manager.get_instance(instance_id)
        if not instance:
            return None
        
        return {
            "instance_id": instance.instance_id,
            "workflow_id": instance.workflow_id,
            "status": instance.status.value,
            "current_node_id": instance.current_node_id,
            "started_at": instance.started_at.isoformat() if instance.started_at else None,
            "completed_at": instance.completed_at.isoformat() if instance.completed_at else None,
            "error": instance.error,
            "execution_history_count": len(instance.execution_history)
        }

"""
协调器模块
管理工作流生命周期和任务分发
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)


@dataclass
class Session:
    """用户会话"""
    session_id: str
    user_id: str
    created_at: datetime
    last_activity: datetime
    state: Dict[str, Any] = field(default_factory=dict)
    tasks: List[str] = field(default_factory=list)


class Coordinator:
    """协调器 - 管理工作流生命周期和任务分发"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.sessions: Dict[str, Session] = {}
        self.task_queue: List[Dict[str, Any]] = []
        self.active_workflows: Dict[str, Any] = {}
        self._initialize()
    
    def _initialize(self):
        """初始化协调器"""
        logger.info("初始化协调器...")
        logger.info("协调器初始化完成")
    
    def create_session(self, user_id: str) -> Session:
        """创建用户会话"""
        session_id = str(uuid.uuid4())
        session = Session(
            session_id=session_id,
            user_id=user_id,
            created_at=datetime.now(),
            last_activity=datetime.now()
        )
        self.sessions[session_id] = session
        logger.info(f"创建会话: {session_id} for user {user_id}")
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        return self.sessions.get(session_id)
    
    def update_session_activity(self, session_id: str):
        """更新会话活动时间"""
        session = self.sessions.get(session_id)
        if session:
            session.last_activity = datetime.now()
    
    def parse_user_input(self, user_input: str) -> Dict[str, Any]:
        """解析用户输入，识别任务类型和优先级"""
        user_input_lower = user_input.lower()
        
        # 识别任务类型
        task_type = "general"
        if any(keyword in user_input_lower for keyword in ['研究', 'research', '分析', 'analysis']):
            task_type = "research"
        elif any(keyword in user_input_lower for keyword in ['文档', 'document', '报告', 'report', '生成', 'generate']):
            task_type = "document_generation"
        elif any(keyword in user_input_lower for keyword in ['数据', 'data', 'excel', '表格', 'table']):
            task_type = "data_analysis"
        elif any(keyword in user_input_lower for keyword in ['代码', 'code', '执行', 'execute', 'python']):
            task_type = "code_execution"
        elif any(keyword in user_input_lower for keyword in ['ppt', '演示', 'presentation', '播客', 'podcast']):
            task_type = "multimedia_creation"
        
        # 识别优先级
        priority = 1
        if '紧急' in user_input or 'urgent' in user_input_lower:
            priority = 3
        elif '重要' in user_input or 'important' in user_input_lower:
            priority = 2
        
        return {
            "task_type": task_type,
            "priority": priority,
            "description": user_input,
            "parsed_at": datetime.now().isoformat()
        }
    
    def dispatch_task(self, task: Dict[str, Any], session_id: str) -> str:
        """分发任务"""
        task_id = str(uuid.uuid4())
        task['task_id'] = task_id
        task['session_id'] = session_id
        task['status'] = 'queued'
        task['created_at'] = datetime.now().isoformat()
        
        self.task_queue.append(task)
        
        # 更新会话
        session = self.sessions.get(session_id)
        if session:
            session.tasks.append(task_id)
        
        logger.info(f"分发任务: {task_id} - {task['task_type']}")
        return task_id
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态"""
        # 检查队列中的任务
        for task in self.task_queue:
            if task.get('task_id') == task_id:
                return task
        
        # 检查活动工作流
        if task_id in self.active_workflows:
            return {
                "task_id": task_id,
                "status": "running",
                "workflow": self.active_workflows[task_id]
            }
        
        return None
    
    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        # 从队列中移除
        for i, task in enumerate(self.task_queue):
            if task.get('task_id') == task_id:
                self.task_queue.pop(i)
                logger.info(f"取消任务: {task_id}")
                return True
        
        # 取消活动工作流
        if task_id in self.active_workflows:
            del self.active_workflows[task_id]
            logger.info(f"取消活动工作流: {task_id}")
            return True
        
        return False
    
    def get_active_tasks(self) -> List[Dict[str, Any]]:
        """获取活动任务列表"""
        return self.task_queue.copy()
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            "active_sessions": len(self.sessions),
            "queued_tasks": len(self.task_queue),
            "active_workflows": len(self.active_workflows)
        }
    
    def cleanup_expired_sessions(self, max_age_hours: int = 24):
        """清理过期会话"""
        now = datetime.now()
        expired = []
        
        for session_id, session in self.sessions.items():
            age = (now - session.last_activity).total_seconds() / 3600
            if age > max_age_hours:
                expired.append(session_id)
        
        for session_id in expired:
            del self.sessions[session_id]
            logger.info(f"清理过期会话: {session_id}")
        
        return len(expired)

"""
监控员智能体 - 系统监控专家
Monitor Agent - System Monitoring Expert
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

from ..base_agent import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class MonitorAgent(BaseAgent):
    """监控员智能体 - 系统监控专家"""
    
    ALERT_LEVELS = {
        "info": {"threshold": 0, "color": "blue"},
        "warning": {"threshold": 60, "color": "yellow"},
        "error": {"threshold": 80, "color": "orange"},
        "critical": {"threshold": 95, "color": "red"}
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(
            name="MonitorAgent",
            description="监控员 - 系统监控、进度跟踪、告警通知",
            task_types=["monitoring", "status_check", "alert", "progress"],
            config=config
        )
        self.metrics: Dict[str, List[Dict[str, Any]]] = {}
        self.alerts: List[Dict[str, Any]] = []
        self._monitoring_tasks: Dict[str, asyncio.Task] = {}
    
    async def execute(self, task: Dict[str, Any]) -> AgentResult:
        """执行监控任务"""
        description = task.get("description", "").lower()
        task_type = task.get("task_type", "monitoring")
        
        logger.info(f"MonitorAgent processing: {description[:50]}...")
        
        try:
            if "状态" in description or "status" in description:
                result = await self._check_status(task)
            elif "进度" in description or "progress" in description:
                result = await self._track_progress(task)
            elif "告警" in description or "alert" in description:
                result = await self._handle_alert(task)
            elif "统计" in description or "statistics" in description:
                result = await self._get_statistics(task)
            else:
                result = await self._general_monitoring(task)
            
            return AgentResult(
                success=True,
                output=result,
                metadata={"agent": self.name}
            )
        
        except Exception as e:
            logger.error(f"MonitorAgent error: {e}")
            return AgentResult(success=False, output=None, error=str(e))
    
    async def _check_status(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """检查系统状态"""
        from ..orchestrator import get_orchestrator
        
        orchestrator = get_orchestrator()
        stats = orchestrator.get_statistics()
        agent_status = orchestrator.get_agent_status()
        
        status = {
            "type": "system_status",
            "timestamp": datetime.now().isoformat(),
            "overall_health": "healthy",
            "orchestrator": stats,
            "agents": agent_status,
            "message_bus": orchestrator.message_bus.get_statistics()
        }
        
        if stats.get("failed", 0) > 0:
            status["overall_health"] = "degraded"
        
        if stats.get("success_rate", 1) < 0.5:
            status["overall_health"] = "unhealthy"
        
        return status
    
    async def _track_progress(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """跟踪任务进度"""
        from ..orchestrator import get_orchestrator
        
        orchestrator = get_orchestrator()
        all_tasks = orchestrator.get_all_tasks()
        
        progress = {
            "type": "progress_tracking",
            "timestamp": datetime.now().isoformat(),
            "total_tasks": len(all_tasks),
            "by_status": {
                "pending": 0,
                "executing": 0,
                "completed": 0,
                "failed": 0
            },
            "recent_tasks": []
        }
        
        for t in all_tasks:
            status = t.get("status", "pending")
            if status in progress["by_status"]:
                progress["by_status"][status] += 1
        
        progress["recent_tasks"] = all_tasks[-10:]
        progress["completion_rate"] = (
            progress["by_status"]["completed"] / progress["total_tasks"] 
            if progress["total_tasks"] > 0 else 0
        )
        
        return progress
    
    async def _handle_alert(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """处理告警"""
        alert = {
            "type": "alert",
            "timestamp": datetime.now().isoformat(),
            "level": task.get("level", "info"),
            "message": task.get("message", ""),
            "source": task.get("source", "system"),
            "acknowledged": False
        }
        
        self.alerts.append(alert)
        
        return {
            "alert_registered": True,
            "alert": alert,
            "total_alerts": len(self.alerts)
        }
    
    async def _get_statistics(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """获取统计数据"""
        from ..orchestrator import get_orchestrator
        
        orchestrator = get_orchestrator()
        stats = orchestrator.get_statistics()
        
        return {
            "type": "statistics",
            "timestamp": datetime.now().isoformat(),
            "metrics": {
                "tasks": {
                    "total": stats.get("total_tasks", 0),
                    "completed": stats.get("completed", 0),
                    "failed": stats.get("failed", 0),
                    "success_rate": stats.get("success_rate", 0)
                },
                "agents": {
                    "count": stats.get("agents", 0),
                    "status": stats.get("message_bus", {}).get("agent_status", {})
                },
                "messages": {
                    "total": stats.get("message_bus", {}).get("total_messages", 0)
                }
            },
            "health_score": self._calculate_health_score(stats)
        }
    
    async def _general_monitoring(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """通用监控"""
        return {
            "type": "general_monitoring",
            "capabilities": [
                "系统状态检查",
                "任务进度跟踪",
                "告警管理",
                "性能统计"
            ],
            "current_metrics": {
                "active_since": datetime.now().isoformat(),
                "tasks_processed": len(self.memory),
                "alerts_generated": len(self.alerts)
            }
        }
    
    def _calculate_health_score(self, stats: Dict[str, Any]) -> int:
        """计算健康分数"""
        score = 100
        
        success_rate = stats.get("success_rate", 1)
        if success_rate < 0.9:
            score -= int((1 - success_rate) * 50)
        
        failed = stats.get("failed", 0)
        if failed > 0:
            score -= min(failed * 5, 30)
        
        return max(0, score)
    
    def get_alerts(self, level: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """获取告警列表"""
        alerts = self.alerts
        if level:
            alerts = [a for a in alerts if a.get("level") == level]
        return alerts[-limit:]
    
    def clear_alerts(self):
        """清除告警"""
        self.alerts = []
    
    async def start_monitoring(self, target: str, interval: int = 60):
        """开始监控"""
        if target in self._monitoring_tasks:
            return
        
        async def monitor_loop():
            while True:
                try:
                    status = await self._check_status({"target": target})
                    self.metrics.setdefault(target, []).append({
                        "timestamp": datetime.now().isoformat(),
                        "data": status
                    })
                    await asyncio.sleep(interval)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Monitoring error: {e}")
                    await asyncio.sleep(5)
        
        self._monitoring_tasks[target] = asyncio.create_task(monitor_loop())
    
    async def stop_monitoring(self, target: str):
        """停止监控"""
        if target in self._monitoring_tasks:
            self._monitoring_tasks[target].cancel()
            del self._monitoring_tasks[target]

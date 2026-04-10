"""
三层记忆系统

实现：
- 会话记忆：当前对话上下文（10轮）
- 用户记忆：用户偏好、历史项目、常用风格（SQLite持久化）
- 全局记忆：跨用户素材质量、热门趋势（联邦聚合）
"""

import json
import sqlite3
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Any, Deque
import threading
import hashlib


class MemoryType(Enum):
    SESSION = "session"
    USER = "user"
    GLOBAL = "global"


class ContentType(Enum):
    DOCUMENT = "document"
    SPREADSHEET = "spreadsheet"
    PRESENTATION = "presentation"


@dataclass
class Message:
    """消息"""
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class SessionContext:
    """会话上下文"""
    session_id: str
    messages: Deque[Message] = field(default_factory=lambda: deque(maxlen=20))
    current_task: Optional[str] = None
    content_type: Optional[ContentType] = None
    working_file: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None):
        self.messages.append(Message(
            role=role,
            content=content,
            metadata=metadata or {}
        ))
        self.last_activity = datetime.now()
    
    def get_context_window(self, max_messages: int = 10) -> List[Dict]:
        messages = list(self.messages)[-max_messages:]
        return [m.to_dict() for m in messages]
    
    def to_dict(self) -> Dict:
        return {
            "session_id": self.session_id,
            "messages": [m.to_dict() for m in self.messages],
            "current_task": self.current_task,
            "content_type": self.content_type.value if self.content_type else None,
            "working_file": self.working_file,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
        }


@dataclass
class UserPreference:
    """用户偏好"""
    preference_type: str
    value: Any
    weight: float = 1.0
    last_updated: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict:
        return {
            "preference_type": self.preference_type,
            "value": self.value,
            "weight": self.weight,
            "last_updated": self.last_updated.isoformat(),
        }


@dataclass
class UserProject:
    """用户项目"""
    project_id: str
    project_name: str
    content_type: ContentType
    created_at: datetime
    file_path: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "project_id": self.project_id,
            "project_name": self.project_name,
            "content_type": self.content_type.value,
            "created_at": self.created_at.isoformat(),
            "file_path": self.file_path,
            "metadata": self.metadata,
        }


@dataclass
class GlobalTrend:
    """全局趋势"""
    trend_type: str
    item_id: str
    item_name: str
    score: float
    usage_count: int
    last_updated: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict:
        return {
            "trend_type": self.trend_type,
            "item_id": self.item_id,
            "item_name": self.item_name,
            "score": self.score,
            "usage_count": self.usage_count,
            "last_updated": self.last_updated.isoformat(),
        }


class SessionMemory:
    """会话记忆（短期记忆）"""
    
    def __init__(self, max_sessions: int = 100, session_timeout: int = 3600):
        self.sessions: Dict[str, SessionContext] = {}
        self.max_sessions = max_sessions
        self.session_timeout = session_timeout
        self._lock = threading.Lock()
    
    def create_session(self, user_id: str) -> SessionContext:
        session_id = hashlib.md5(f"{user_id}_{datetime.now().timestamp()}".encode()).hexdigest()[:12]
        
        with self._lock:
            if len(self.sessions) >= self.max_sessions:
                self._cleanup_expired()
            
            session = SessionContext(session_id=session_id)
            self.sessions[session_id] = session
            return session
    
    def get_session(self, session_id: str) -> Optional[SessionContext]:
        with self._lock:
            session = self.sessions.get(session_id)
            if session:
                if (datetime.now() - session.last_activity).total_seconds() > self.session_timeout:
                    del self.sessions[session_id]
                    return None
            return session
    
    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict] = None
    ) -> bool:
        session = self.get_session(session_id)
        if session:
            session.add_message(role, content, metadata)
            return True
        return False
    
    def set_current_task(self, session_id: str, task: str, content_type: ContentType):
        session = self.get_session(session_id)
        if session:
            session.current_task = task
            session.content_type = content_type
    
    def get_context(self, session_id: str, max_messages: int = 10) -> List[Dict]:
        session = self.get_session(session_id)
        if session:
            return session.get_context_window(max_messages)
        return []
    
    def _cleanup_expired(self):
        now = datetime.now()
        expired = [
            sid for sid, session in self.sessions.items()
            if (now - session.last_activity).total_seconds() > self.session_timeout
        ]
        for sid in expired:
            del self.sessions[sid]


class UserMemory:
    """用户记忆（中期记忆）"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/memory/users.db")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                preference_type TEXT NOT NULL,
                value TEXT,
                weight REAL DEFAULT 1.0,
                last_updated TEXT,
                UNIQUE(user_id, preference_type)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                project_name TEXT,
                content_type TEXT,
                file_path TEXT,
                created_at TEXT,
                metadata TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                action_type TEXT,
                action_data TEXT,
                created_at TEXT
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_prefs ON user_preferences(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_projects ON user_projects(user_id)')
        
        conn.commit()
        conn.close()
    
    def get_preference(self, user_id: str, preference_type: str) -> Optional[UserPreference]:
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT preference_type, value, weight, last_updated
            FROM user_preferences
            WHERE user_id = ? AND preference_type = ?
        ''', (user_id, preference_type))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return UserPreference(
                preference_type=row[0],
                value=json.loads(row[1]) if row[1] else None,
                weight=row[2],
                last_updated=datetime.fromisoformat(row[3]) if row[3] else datetime.now(),
            )
        return None
    
    def set_preference(
        self,
        user_id: str,
        preference_type: str,
        value: Any,
        weight: float = 1.0
    ):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO user_preferences
            (user_id, preference_type, value, weight, last_updated)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            user_id,
            preference_type,
            json.dumps(value, ensure_ascii=False),
            weight,
            datetime.now().isoformat(),
        ))
        
        conn.commit()
        conn.close()
    
    def get_all_preferences(self, user_id: str) -> Dict[str, UserPreference]:
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT preference_type, value, weight, last_updated
            FROM user_preferences
            WHERE user_id = ?
        ''', (user_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return {
            row[0]: UserPreference(
                preference_type=row[0],
                value=json.loads(row[1]) if row[1] else None,
                weight=row[2],
                last_updated=datetime.fromisoformat(row[3]) if row[3] else datetime.now(),
            )
            for row in rows
        }
    
    def record_project(
        self,
        user_id: str,
        project_name: str,
        content_type: ContentType,
        file_path: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        project_id = hashlib.md5(f"{user_id}_{project_name}_{datetime.now().timestamp()}".encode()).hexdigest()[:12]
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO user_projects
            (user_id, project_id, project_name, content_type, file_path, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            project_id,
            project_name,
            content_type.value,
            file_path,
            datetime.now().isoformat(),
            json.dumps(metadata or {}, ensure_ascii=False),
        ))
        
        conn.commit()
        conn.close()
        
        return project_id
    
    def get_recent_projects(
        self,
        user_id: str,
        limit: int = 10,
        content_type: Optional[ContentType] = None
    ) -> List[UserProject]:
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        if content_type:
            cursor.execute('''
                SELECT project_id, project_name, content_type, created_at, file_path, metadata
                FROM user_projects
                WHERE user_id = ? AND content_type = ?
                ORDER BY created_at DESC
                LIMIT ?
            ''', (user_id, content_type.value, limit))
        else:
            cursor.execute('''
                SELECT project_id, project_name, content_type, created_at, file_path, metadata
                FROM user_projects
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            ''', (user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            UserProject(
                project_id=row[0],
                project_name=row[1],
                content_type=ContentType(row[2]),
                created_at=datetime.fromisoformat(row[3]),
                file_path=row[4],
                metadata=json.loads(row[5]) if row[5] else {},
            )
            for row in rows
        ]
    
    def record_action(
        self,
        user_id: str,
        action_type: str,
        action_data: Dict
    ):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO user_history (user_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, ?)
        ''', (
            user_id,
            action_type,
            json.dumps(action_data, ensure_ascii=False),
            datetime.now().isoformat(),
        ))
        
        conn.commit()
        conn.close()
    
    def get_user_style_preference(self, user_id: str) -> Dict[str, float]:
        """获取用户风格偏好"""
        prefs = self.get_all_preferences(user_id)
        
        style_prefs = {}
        for pref_type, pref in prefs.items():
            if pref_type.startswith("style_"):
                style_prefs[pref.value] = pref.weight
        
        return style_prefs


class GlobalMemory:
    """全局记忆（长期记忆）"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/memory/global.db")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS global_trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trend_type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                item_name TEXT,
                score REAL DEFAULT 0.0,
                usage_count INTEGER DEFAULT 0,
                last_updated TEXT,
                UNIQUE(trend_type, item_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS asset_quality (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id TEXT NOT NULL,
                asset_type TEXT,
                quality_score REAL DEFAULT 0.0,
                usage_count INTEGER DEFAULT 0,
                positive_count INTEGER DEFAULT 0,
                negative_count INTEGER DEFAULT 0,
                last_used TEXT,
                UNIQUE(asset_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS aggregated_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stat_type TEXT NOT NULL,
                stat_key TEXT NOT NULL,
                stat_value TEXT,
                updated_at TEXT,
                UNIQUE(stat_type, stat_key)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def update_trend(
        self,
        trend_type: str,
        item_id: str,
        item_name: str,
        delta_score: float = 0.0,
        delta_usage: int = 1
    ):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO global_trends (trend_type, item_id, item_name, score, usage_count, last_updated)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(trend_type, item_id) DO UPDATE SET
                score = score + ?,
                usage_count = usage_count + ?,
                last_updated = ?
        ''', (
            trend_type, item_id, item_name, delta_score, delta_usage, datetime.now().isoformat(),
            delta_score, delta_usage, datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
    
    def get_trends(
        self,
        trend_type: str,
        limit: int = 10,
        min_usage: int = 5
    ) -> List[GlobalTrend]:
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT trend_type, item_id, item_name, score, usage_count, last_updated
            FROM global_trends
            WHERE trend_type = ? AND usage_count >= ?
            ORDER BY score DESC, usage_count DESC
            LIMIT ?
        ''', (trend_type, min_usage, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            GlobalTrend(
                trend_type=row[0],
                item_id=row[1],
                item_name=row[2],
                score=row[3],
                usage_count=row[4],
                last_updated=datetime.fromisoformat(row[5]) if row[5] else datetime.now(),
            )
            for row in rows
        ]
    
    def update_asset_quality(
        self,
        asset_id: str,
        asset_type: str,
        is_positive: bool = True
    ):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        if is_positive:
            cursor.execute('''
                INSERT INTO asset_quality (asset_id, asset_type, quality_score, usage_count, positive_count, last_used)
                VALUES (?, ?, 1.0, 1, 1, ?)
                ON CONFLICT(asset_id) DO UPDATE SET
                    quality_score = (quality_score * usage_count + 1.0) / (usage_count + 1),
                    usage_count = usage_count + 1,
                    positive_count = positive_count + 1,
                    last_used = ?
            ''', (asset_id, asset_type, datetime.now().isoformat(), datetime.now().isoformat()))
        else:
            cursor.execute('''
                INSERT INTO asset_quality (asset_id, asset_type, quality_score, usage_count, negative_count, last_used)
                VALUES (?, ?, 0.0, 1, 1, ?)
                ON CONFLICT(asset_id) DO UPDATE SET
                    quality_score = (quality_score * usage_count) / (usage_count + 1),
                    usage_count = usage_count + 1,
                    negative_count = negative_count + 1,
                    last_used = ?
            ''', (asset_id, asset_type, datetime.now().isoformat(), datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
    
    def get_top_assets(
        self,
        asset_type: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict]:
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        if asset_type:
            cursor.execute('''
                SELECT asset_id, asset_type, quality_score, usage_count, positive_count, negative_count
                FROM asset_quality
                WHERE asset_type = ?
                ORDER BY quality_score DESC, usage_count DESC
                LIMIT ?
            ''', (asset_type, limit))
        else:
            cursor.execute('''
                SELECT asset_id, asset_type, quality_score, usage_count, positive_count, negative_count
                FROM asset_quality
                ORDER BY quality_score DESC, usage_count DESC
                LIMIT ?
            ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "asset_id": row[0],
                "asset_type": row[1],
                "quality_score": row[2],
                "usage_count": row[3],
                "positive_count": row[4],
                "negative_count": row[5],
            }
            for row in rows
        ]
    
    def set_stat(self, stat_type: str, stat_key: str, stat_value: Any):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO aggregated_stats (stat_type, stat_key, stat_value, updated_at)
            VALUES (?, ?, ?, ?)
        ''', (stat_type, stat_key, json.dumps(stat_value), datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
    
    def get_stat(self, stat_type: str, stat_key: str) -> Optional[Any]:
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT stat_value FROM aggregated_stats
            WHERE stat_type = ? AND stat_key = ?
        ''', (stat_type, stat_key))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None


class MemorySystem:
    """三层记忆系统"""
    
    def __init__(
        self,
        user_db_path: Optional[Path] = None,
        global_db_path: Optional[Path] = None
    ):
        self.session_memory = SessionMemory()
        self.user_memory = UserMemory(user_db_path)
        self.global_memory = GlobalMemory(global_db_path)
    
    def create_session(self, user_id: str) -> SessionContext:
        return self.session_memory.create_session(user_id)
    
    def get_session(self, session_id: str) -> Optional[SessionContext]:
        return self.session_memory.get_session(session_id)
    
    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict] = None
    ):
        self.session_memory.add_message(session_id, role, content, metadata)
    
    def get_context(self, session_id: str, max_messages: int = 10) -> List[Dict]:
        return self.session_memory.get_context(session_id, max_messages)
    
    def learn_user_preference(
        self,
        user_id: str,
        preference_type: str,
        value: Any,
        feedback_weight: float = 1.0
    ):
        existing = self.user_memory.get_preference(user_id, preference_type)
        
        if existing:
            new_weight = existing.weight + feedback_weight * 0.1
            self.user_memory.set_preference(user_id, preference_type, value, new_weight)
        else:
            self.user_memory.set_preference(user_id, preference_type, value, feedback_weight)
    
    def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        prefs = self.user_memory.get_all_preferences(user_id)
        return {k: v.value for k, v in prefs.items()}
    
    def record_usage(
        self,
        user_id: str,
        item_type: str,
        item_id: str,
        item_name: str,
        is_positive: bool = True
    ):
        self.global_memory.update_trend(item_type, item_id, item_name, 1.0 if is_positive else -0.5)
        
        if item_type in ["asset", "template", "style"]:
            self.global_memory.update_asset_quality(item_id, item_type, is_positive)
        
        self.user_memory.record_action(user_id, f"use_{item_type}", {
            "item_id": item_id,
            "item_name": item_name,
            "is_positive": is_positive,
        })
    
    def get_recommendations(
        self,
        user_id: str,
        item_type: str,
        limit: int = 10
    ) -> List[Dict]:
        user_prefs = self.get_user_preferences(user_id)
        pref_key = f"preferred_{item_type}"
        user_preferred = user_prefs.get(pref_key, [])
        
        global_trends = self.global_memory.get_trends(item_type, limit * 2)
        
        recommendations = []
        for trend in global_trends:
            score = trend.score
            if trend.item_id in user_preferred:
                score *= 1.5
            
            recommendations.append({
                "item_id": trend.item_id,
                "item_name": trend.item_name,
                "score": score,
                "usage_count": trend.usage_count,
            })
        
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        return recommendations[:limit]
    
    def get_full_context(
        self,
        session_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        return {
            "session": self.session_memory.get_context(session_id),
            "user_preferences": self.get_user_preferences(user_id),
            "recent_projects": [
                p.to_dict() for p in self.user_memory.get_recent_projects(user_id, limit=5)
            ],
        }

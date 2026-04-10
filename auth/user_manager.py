"""
用户管理器 - SQLite零成本实现
完全本地化用户存储，无需任何云数据库
"""

import os
import sqlite3
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import json

from .auth_service import AuthService, auth_service


@dataclass
class User:
    id: str
    username: str
    email: str
    hashed_password: str
    role: str = "user"
    is_active: bool = True
    created_at: str = None
    last_login: str = None
    preferences: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()
        if self.preferences is None:
            self.preferences = {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "last_login": self.last_login,
            "preferences": self.preferences
        }


@dataclass
class UserCreate:
    username: str
    email: str
    password: str


@dataclass  
class UserLogin:
    username: str
    password: str


class UserManager:
    """用户管理器 - SQLite实现"""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            data_dir = Path("data/users")
            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(data_dir / "users.db")
        
        self.db_path = db_path
        self.auth_service = auth_service
        self._init_db()
    
    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_db(self):
        """初始化数据库表"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                is_active INTEGER DEFAULT 1,
                created_at TEXT,
                last_login TEXT,
                preferences TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT UNIQUE,
                created_at TEXT,
                expires_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_activities (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                activity_type TEXT,
                details TEXT,
                created_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def create_user(self, user_create: UserCreate) -> User:
        """创建用户"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE username = ?", (user_create.username,))
        if cursor.fetchone():
            conn.close()
            raise ValueError(f"用户名 '{user_create.username}' 已存在")
        
        cursor.execute("SELECT id FROM users WHERE email = ?", (user_create.email,))
        if cursor.fetchone():
            conn.close()
            raise ValueError(f"邮箱 '{user_create.email}' 已被注册")
        
        user_id = str(uuid.uuid4())
        hashed_password = self.auth_service.hash_password(user_create.password)
        now = datetime.utcnow().isoformat()
        
        cursor.execute('''
            INSERT INTO users (id, username, email, hashed_password, created_at, preferences)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, user_create.username, user_create.email, hashed_password, now, '{}'))
        
        conn.commit()
        conn.close()
        
        return User(
            id=user_id,
            username=user_create.username,
            email=user_create.email,
            hashed_password=hashed_password,
            created_at=now
        )
    
    def get_user(self, user_id: str) -> Optional[User]:
        """获取用户"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return self._row_to_user(row)
        return None
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """通过用户名获取用户"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return self._row_to_user(row)
        return None
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """通过邮箱获取用户"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return self._row_to_user(row)
        return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """验证用户"""
        user = self.get_user_by_username(username)
        
        if not user:
            return None
        
        if not self.auth_service.verify_password(password, user.hashed_password):
            return None
        
        if not user.is_active:
            return None
        
        self._update_last_login(user.id)
        
        return user
    
    def _update_last_login(self, user_id: str):
        """更新最后登录时间"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET last_login = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), user_id)
        )
        conn.commit()
        conn.close()
    
    def update_user(self, user_id: str, **kwargs) -> Optional[User]:
        """更新用户信息"""
        allowed_fields = {'email', 'role', 'is_active', 'preferences'}
        updates = {k: v for k, v in kwargs.items() if k in allowed_fields}
        
        if not updates:
            return self.get_user(user_id)
        
        if 'preferences' in updates:
            updates['preferences'] = json.dumps(updates['preferences'], ensure_ascii=False)
        
        set_clause = ', '.join(f"{k} = ?" for k in updates.keys())
        values = list(updates.values()) + [user_id]
        
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()
        
        return self.get_user(user_id)
    
    def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        """修改密码"""
        user = self.get_user(user_id)
        
        if not user:
            return False
        
        if not self.auth_service.verify_password(old_password, user.hashed_password):
            return False
        
        new_hashed = self.auth_service.hash_password(new_password)
        
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET hashed_password = ? WHERE id = ?",
            (new_hashed, user_id)
        )
        conn.commit()
        conn.close()
        
        return True
    
    def delete_user(self, user_id: str) -> bool:
        """删除用户"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        
        return affected > 0
    
    def list_users(self, limit: int = 100, offset: int = 0) -> List[User]:
        """列出用户"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset)
        )
        rows = cursor.fetchall()
        conn.close()
        
        return [self._row_to_user(row) for row in rows]
    
    def record_activity(self, user_id: str, activity_type: str, details: Dict = None):
        """记录用户活动"""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO user_activities (id, user_id, activity_type, details, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            str(uuid.uuid4()),
            user_id,
            activity_type,
            json.dumps(details or {}, ensure_ascii=False),
            datetime.utcnow().isoformat()
        ))
        conn.commit()
        conn.close()
    
    def get_user_activities(
        self, 
        user_id: str, 
        activity_type: str = None,
        limit: int = 50
    ) -> List[Dict]:
        """获取用户活动记录"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        if activity_type:
            cursor.execute('''
                SELECT * FROM user_activities 
                WHERE user_id = ? AND activity_type = ?
                ORDER BY created_at DESC LIMIT ?
            ''', (user_id, activity_type, limit))
        else:
            cursor.execute('''
                SELECT * FROM user_activities 
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT ?
            ''', (user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def _row_to_user(self, row: sqlite3.Row) -> User:
        """数据库行转User对象"""
        preferences = row['preferences']
        if isinstance(preferences, str):
            preferences = json.loads(preferences)
        
        return User(
            id=row['id'],
            username=row['username'],
            email=row['email'],
            hashed_password=row['hashed_password'],
            role=row['role'],
            is_active=bool(row['is_active']),
            created_at=row['created_at'],
            last_login=row['last_login'],
            preferences=preferences or {}
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """获取用户统计"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE is_active = 1")
        active_users = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT COUNT(*) FROM users 
            WHERE last_login > datetime('now', '-7 days')
        ''')
        recent_active = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "recent_active_7d": recent_active
        }


user_manager = UserManager()

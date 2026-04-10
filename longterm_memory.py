"""
永久长期记忆系统
完整记录所有历史、偏好、习惯、需求、性格、常用指令
永不丢失，自动增量学习
"""

import json
import sqlite3
import hashlib
import threading
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Set
from dataclasses import dataclass, field, asdict
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class Conversation:
    id: str
    timestamp: datetime
    role: str
    content: str
    intent: Optional[str] = None
    entities: List[Dict] = field(default_factory=list)
    sentiment: Optional[str] = None
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'role': self.role,
            'content': self.content,
            'intent': self.intent,
            'entities': self.entities,
            'sentiment': self.sentiment,
            'metadata': self.metadata,
        }


@dataclass
class UserPreference:
    category: str
    key: str
    value: Any
    confidence: float = 1.0
    source: str = "learned"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    access_count: int = 1

    def to_dict(self) -> Dict:
        return {
            'category': self.category,
            'key': self.key,
            'value': self.value,
            'confidence': self.confidence,
            'source': self.source,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'access_count': self.access_count,
        }


@dataclass
class UserHabit:
    id: str
    pattern: str
    frequency: int
    last_occurred: datetime
    context: Dict = field(default_factory=dict)
    related_actions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'pattern': self.pattern,
            'frequency': self.frequency,
            'last_occurred': self.last_occurred.isoformat(),
            'context': self.context,
            'related_actions': self.related_actions,
        }


@dataclass
class UserProfile:
    user_id: str
    name: Optional[str] = None
    personality_traits: Dict[str, float] = field(default_factory=dict)
    communication_style: Dict[str, Any] = field(default_factory=dict)
    expertise_areas: List[str] = field(default_factory=list)
    goals: List[Dict] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict:
        return asdict(self)


class LongTermMemory:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/memory/longterm.db")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init_database()
        self._cache: Dict[str, Any] = {}
        self._dirty = False

    def _init_database(self):
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    intent TEXT,
                    entities TEXT,
                    sentiment TEXT,
                    metadata TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT,
                    confidence REAL DEFAULT 1.0,
                    source TEXT DEFAULT 'learned',
                    created_at TEXT,
                    updated_at TEXT,
                    access_count INTEGER DEFAULT 1,
                    UNIQUE(category, key)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_habits (
                    id TEXT PRIMARY KEY,
                    pattern TEXT NOT NULL,
                    frequency INTEGER DEFAULT 1,
                    last_occurred TEXT,
                    context TEXT,
                    related_actions TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_profile (
                    user_id TEXT PRIMARY KEY,
                    name TEXT,
                    personality_traits TEXT,
                    communication_style TEXT,
                    expertise_areas TEXT,
                    goals TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS command_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    command TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    context TEXT,
                    result TEXT,
                    success INTEGER DEFAULT 1
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS knowledge_base (
                    id TEXT PRIMARY KEY,
                    topic TEXT NOT NULL,
                    content TEXT NOT NULL,
                    source TEXT,
                    confidence REAL DEFAULT 1.0,
                    created_at TEXT,
                    updated_at TEXT,
                    access_count INTEGER DEFAULT 0
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS daily_summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL UNIQUE,
                    summary TEXT,
                    preferences_extracted TEXT,
                    habits_identified TEXT,
                    goals_updated TEXT,
                    created_at TEXT
                )
            ''')
            
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_conv_timestamp ON conversations(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_conv_role ON conversations(role)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_pref_category ON user_preferences(category)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_habits_pattern ON user_habits(pattern)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_cmd_timestamp ON command_history(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_kb_topic ON knowledge_base(topic)')
            
            conn.commit()

    def save_conversation(self, conversation: Conversation):
        with self._lock:
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO conversations
                    (id, timestamp, role, content, intent, entities, sentiment, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    conversation.id,
                    conversation.timestamp.isoformat(),
                    conversation.role,
                    conversation.content,
                    conversation.intent,
                    json.dumps(conversation.entities, ensure_ascii=False),
                    conversation.sentiment,
                    json.dumps(conversation.metadata, ensure_ascii=False),
                ))
                conn.commit()

    def get_conversations(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        role: Optional[str] = None,
        limit: int = 100
    ) -> List[Conversation]:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            
            query = "SELECT * FROM conversations WHERE 1=1"
            params = []
            
            if start_date:
                query += " AND timestamp >= ?"
                params.append(start_date.isoformat())
            if end_date:
                query += " AND timestamp <= ?"
                params.append(end_date.isoformat())
            if role:
                query += " AND role = ?"
                params.append(role)
            
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return [
                Conversation(
                    id=row[0],
                    timestamp=datetime.fromisoformat(row[1]),
                    role=row[2],
                    content=row[3],
                    intent=row[4],
                    entities=json.loads(row[5]) if row[5] else [],
                    sentiment=row[6],
                    metadata=json.loads(row[7]) if row[7] else {},
                )
                for row in rows
            ]

    def search_conversations(self, query: str, limit: int = 20) -> List[Conversation]:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM conversations
                WHERE content LIKE ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (f'%{query}%', limit))
            
            rows = cursor.fetchall()
            
            return [
                Conversation(
                    id=row[0],
                    timestamp=datetime.fromisoformat(row[1]),
                    role=row[2],
                    content=row[3],
                    intent=row[4],
                    entities=json.loads(row[5]) if row[5] else [],
                    sentiment=row[6],
                    metadata=json.loads(row[7]) if row[7] else {},
                )
                for row in rows
            ]

    def set_preference(self, preference: UserPreference):
        with self._lock:
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO user_preferences
                    (category, key, value, confidence, source, created_at, updated_at, access_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                    ON CONFLICT(category, key) DO UPDATE SET
                        value = excluded.value,
                        confidence = (confidence + excluded.confidence) / 2,
                        updated_at = excluded.updated_at,
                        access_count = access_count + 1
                ''', (
                    preference.category,
                    preference.key,
                    json.dumps(preference.value, ensure_ascii=False),
                    preference.confidence,
                    preference.source,
                    preference.created_at.isoformat(),
                    preference.updated_at.isoformat(),
                ))
                conn.commit()

    def get_preference(self, category: str, key: str) -> Optional[UserPreference]:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT category, key, value, confidence, source, created_at, updated_at, access_count
                FROM user_preferences
                WHERE category = ? AND key = ?
            ''', (category, key))
            
            row = cursor.fetchone()
            if row:
                return UserPreference(
                    category=row[0],
                    key=row[1],
                    value=json.loads(row[2]) if row[2] else None,
                    confidence=row[3],
                    source=row[4],
                    created_at=datetime.fromisoformat(row[5]),
                    updated_at=datetime.fromisoformat(row[6]),
                    access_count=row[7],
                )
            return None

    def get_all_preferences(self, category: Optional[str] = None) -> Dict[str, UserPreference]:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            
            if category:
                cursor.execute('''
                    SELECT category, key, value, confidence, source, created_at, updated_at, access_count
                    FROM user_preferences
                    WHERE category = ?
                ''', (category,))
            else:
                cursor.execute('''
                    SELECT category, key, value, confidence, source, created_at, updated_at, access_count
                    FROM user_preferences
                ''')
            
            rows = cursor.fetchall()
            
            return {
                f"{row[0]}:{row[1]}": UserPreference(
                    category=row[0],
                    key=row[1],
                    value=json.loads(row[2]) if row[2] else None,
                    confidence=row[3],
                    source=row[4],
                    created_at=datetime.fromisoformat(row[5]),
                    updated_at=datetime.fromisoformat(row[6]),
                    access_count=row[7],
                )
                for row in rows
            }

    def record_habit(self, pattern: str, context: Optional[Dict] = None):
        with self._lock:
            habit_id = hashlib.md5(pattern.encode()).hexdigest()[:12]
            
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO user_habits (id, pattern, frequency, last_occurred, context)
                    VALUES (?, ?, 1, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        frequency = frequency + 1,
                        last_occurred = excluded.last_occurred,
                        context = excluded.context
                ''', (
                    habit_id,
                    pattern,
                    datetime.now().isoformat(),
                    json.dumps(context or {}, ensure_ascii=False),
                ))
                conn.commit()

    def get_habits(self, min_frequency: int = 2, limit: int = 50) -> List[UserHabit]:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, pattern, frequency, last_occurred, context, related_actions
                FROM user_habits
                WHERE frequency >= ?
                ORDER BY frequency DESC
                LIMIT ?
            ''', (min_frequency, limit))
            
            rows = cursor.fetchall()
            
            return [
                UserHabit(
                    id=row[0],
                    pattern=row[1],
                    frequency=row[2],
                    last_occurred=datetime.fromisoformat(row[3]),
                    context=json.loads(row[4]) if row[4] else {},
                    related_actions=json.loads(row[5]) if row[5] else [],
                )
                for row in rows
            ]

    def record_command(self, command: str, context: Optional[Dict] = None, result: Optional[str] = None, success: bool = True):
        with self._lock:
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO command_history (command, timestamp, context, result, success)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    command,
                    datetime.now().isoformat(),
                    json.dumps(context or {}, ensure_ascii=False),
                    result,
                    1 if success else 0,
                ))
                conn.commit()

    def get_frequent_commands(self, days: int = 30, limit: int = 20) -> List[Dict]:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT command, COUNT(*) as count, MAX(timestamp) as last_used
                FROM command_history
                WHERE timestamp >= ?
                GROUP BY command
                ORDER BY count DESC
                LIMIT ?
            ''', (
                (datetime.now() - timedelta(days=days)).isoformat(),
                limit
            ))
            
            return [
                {'command': row[0], 'count': row[1], 'last_used': row[2]}
                for row in cursor.fetchall()
            ]

    def save_knowledge(self, topic: str, content: str, source: str = "learned", confidence: float = 1.0):
        with self._lock:
            kb_id = hashlib.md5(f"{topic}:{content}".encode()).hexdigest()[:12]
            
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO knowledge_base
                    (id, topic, content, source, confidence, created_at, updated_at, access_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                    ON CONFLICT(id) DO UPDATE SET
                        content = excluded.content,
                        confidence = (confidence + excluded.confidence) / 2,
                        updated_at = excluded.updated_at
                ''', (
                    kb_id,
                    topic,
                    content,
                    source,
                    confidence,
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                ))
                conn.commit()

    def search_knowledge(self, query: str, limit: int = 10) -> List[Dict]:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, topic, content, source, confidence, access_count
                FROM knowledge_base
                WHERE topic LIKE ? OR content LIKE ?
                ORDER BY confidence DESC, access_count DESC
                LIMIT ?
            ''', (f'%{query}%', f'%{query}%', limit))
            
            results = []
            for row in cursor.fetchall():
                cursor.execute(
                    'UPDATE knowledge_base SET access_count = access_count + 1 WHERE id = ?',
                    (row[0],)
                )
                results.append({
                    'id': row[0],
                    'topic': row[1],
                    'content': row[2],
                    'source': row[3],
                    'confidence': row[4],
                    'access_count': row[5],
                })
            conn.commit()
            
            return results

    def save_daily_summary(
        self,
        date: str,
        summary: str,
        preferences: List[Dict],
        habits: List[Dict],
        goals: List[Dict]
    ):
        with self._lock:
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO daily_summaries
                    (date, summary, preferences_extracted, habits_identified, goals_updated, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    date,
                    summary,
                    json.dumps(preferences, ensure_ascii=False),
                    json.dumps(habits, ensure_ascii=False),
                    json.dumps(goals, ensure_ascii=False),
                    datetime.now().isoformat(),
                ))
                conn.commit()

    def get_user_profile(self, user_id: str = "default") -> UserProfile:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT user_id, name, personality_traits, communication_style, expertise_areas, goals, created_at, updated_at
                FROM user_profile
                WHERE user_id = ?
            ''', (user_id,))
            
            row = cursor.fetchone()
            if row:
                return UserProfile(
                    user_id=row[0],
                    name=row[1],
                    personality_traits=json.loads(row[2]) if row[2] else {},
                    communication_style=json.loads(row[3]) if row[3] else {},
                    expertise_areas=json.loads(row[4]) if row[4] else [],
                    goals=json.loads(row[5]) if row[5] else [],
                    created_at=datetime.fromisoformat(row[6]) if row[6] else datetime.now(),
                    updated_at=datetime.fromisoformat(row[7]) if row[7] else datetime.now(),
                )
            
            profile = UserProfile(user_id=user_id)
            self._save_user_profile(profile)
            return profile

    def _save_user_profile(self, profile: UserProfile):
        with self._lock:
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO user_profile
                    (user_id, name, personality_traits, communication_style, expertise_areas, goals, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    profile.user_id,
                    profile.name,
                    json.dumps(profile.personality_traits, ensure_ascii=False),
                    json.dumps(profile.communication_style, ensure_ascii=False),
                    json.dumps(profile.expertise_areas, ensure_ascii=False),
                    json.dumps(profile.goals, ensure_ascii=False),
                    profile.created_at.isoformat(),
                    datetime.now().isoformat(),
                ))
                conn.commit()

    def update_personality_trait(self, trait: str, value: float):
        profile = self.get_user_profile()
        profile.personality_traits[trait] = value
        self._save_user_profile(profile)

    def update_communication_style(self, style_key: str, value: Any):
        profile = self.get_user_profile()
        profile.communication_style[style_key] = value
        self._save_user_profile(profile)

    def get_context_for_conversation(self, max_messages: int = 10) -> Dict[str, Any]:
        recent_conversations = self.get_conversations(limit=max_messages)
        preferences = self.get_all_preferences()
        habits = self.get_habits(limit=10)
        profile = self.get_user_profile()
        frequent_commands = self.get_frequent_commands(limit=5)
        
        return {
            'recent_conversations': [c.to_dict() for c in recent_conversations],
            'preferences': {k: v.to_dict() for k, v in preferences.items()},
            'habits': [h.to_dict() for h in habits],
            'profile': profile.to_dict(),
            'frequent_commands': frequent_commands,
        }

    def export_all(self) -> Dict[str, Any]:
        return {
            'conversations': [c.to_dict() for c in self.get_conversations(limit=10000)],
            'preferences': {k: v.to_dict() for k, v in self.get_all_preferences().items()},
            'habits': [h.to_dict() for h in self.get_habits(limit=1000)],
            'profile': self.get_user_profile().to_dict(),
            'knowledge': self.search_knowledge('', limit=1000),
            'exported_at': datetime.now().isoformat(),
        }

    def import_data(self, data: Dict[str, Any]):
        if 'conversations' in data:
            for conv_data in data['conversations']:
                conv = Conversation(
                    id=conv_data['id'],
                    timestamp=datetime.fromisoformat(conv_data['timestamp']),
                    role=conv_data['role'],
                    content=conv_data['content'],
                    intent=conv_data.get('intent'),
                    entities=conv_data.get('entities', []),
                    sentiment=conv_data.get('sentiment'),
                    metadata=conv_data.get('metadata', {}),
                )
                self.save_conversation(conv)
        
        if 'preferences' in data:
            for key, pref_data in data['preferences'].items():
                pref = UserPreference(
                    category=pref_data['category'],
                    key=pref_data['key'],
                    value=pref_data['value'],
                    confidence=pref_data.get('confidence', 1.0),
                    source=pref_data.get('source', 'imported'),
                    created_at=datetime.fromisoformat(pref_data['created_at']) if pref_data.get('created_at') else datetime.now(),
                    updated_at=datetime.fromisoformat(pref_data['updated_at']) if pref_data.get('updated_at') else datetime.now(),
                    access_count=pref_data.get('access_count', 1),
                )
                self.set_preference(pref)


long_term_memory = LongTermMemory()

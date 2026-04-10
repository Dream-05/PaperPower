"""
用户专属知识库自动学习模块
每天自动总结对话，提取偏好，记录常用操作目标
形成专属个人模型
"""

import json
import sqlite3
import threading
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from collections import Counter, defaultdict
import logging
import re

logger = logging.getLogger(__name__)


@dataclass
class LearningPattern:
    pattern_id: str
    pattern_type: str
    content: str
    frequency: int
    confidence: float
    first_seen: datetime
    last_seen: datetime
    context: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            'pattern_id': self.pattern_id,
            'pattern_type': self.pattern_type,
            'content': self.content,
            'frequency': self.frequency,
            'confidence': self.confidence,
            'first_seen': self.first_seen.isoformat(),
            'last_seen': self.last_seen.isoformat(),
            'context': self.context,
        }


@dataclass
class UserGoal:
    goal_id: str
    description: str
    category: str
    priority: int
    progress: float
    created_at: datetime
    updated_at: datetime
    milestones: List[Dict] = field(default_factory=list)
    related_patterns: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            'goal_id': self.goal_id,
            'description': self.description,
            'category': self.category,
            'priority': self.priority,
            'progress': self.progress,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'milestones': self.milestones,
            'related_patterns': self.related_patterns,
        }


@dataclass
class DailyInsight:
    date: str
    summary: str
    top_topics: List[str]
    preferences_extracted: Dict
    habits_identified: List[str]
    goals_progress: Dict
    recommendations: List[str]
    
    def to_dict(self) -> Dict:
        return {
            'date': self.date,
            'summary': self.summary,
            'top_topics': self.top_topics,
            'preferences_extracted': self.preferences_extracted,
            'habits_identified': self.habits_identified,
            'goals_progress': self.goals_progress,
            'recommendations': self.recommendations,
        }


class SelfLearningEngine:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/memory/learning.db")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init_database()
        self._pattern_cache: Dict[str, LearningPattern] = {}
        self._learning_enabled = True
        
    def _init_database(self):
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS learning_patterns (
                    pattern_id TEXT PRIMARY KEY,
                    pattern_type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    frequency INTEGER DEFAULT 1,
                    confidence REAL DEFAULT 0.5,
                    first_seen TEXT,
                    last_seen TEXT,
                    context TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_goals (
                    goal_id TEXT PRIMARY KEY,
                    description TEXT NOT NULL,
                    category TEXT,
                    priority INTEGER DEFAULT 5,
                    progress REAL DEFAULT 0.0,
                    created_at TEXT,
                    updated_at TEXT,
                    milestones TEXT,
                    related_patterns TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS daily_insights (
                    date TEXT PRIMARY KEY,
                    summary TEXT,
                    top_topics TEXT,
                    preferences_extracted TEXT,
                    habits_identified TEXT,
                    goals_progress TEXT,
                    recommendations TEXT,
                    created_at TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS conversation_analysis (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT,
                    timestamp TEXT,
                    topics TEXT,
                    intents TEXT,
                    entities TEXT,
                    sentiment TEXT,
                    user_satisfaction REAL,
                    learned_patterns TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS response_optimization (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    context_hash TEXT,
                    user_input TEXT,
                    response TEXT,
                    user_feedback INTEGER,
                    created_at TEXT
                )
            ''')
            
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_pattern_type ON learning_patterns(pattern_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_pattern_content ON learning_patterns(content)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_goals_category ON user_goals(category)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_insights_date ON daily_insights(date)')
            
            conn.commit()
    
    def learn_from_conversation(
        self,
        conversation_id: str,
        user_input: str,
        response: str,
        metadata: Optional[Dict] = None
    ):
        if not self._learning_enabled:
            return
        
        with self._lock:
            topics = self._extract_topics(user_input + " " + response)
            intents = self._extract_intents(user_input)
            entities = self._extract_entities(user_input)
            sentiment = self._analyze_sentiment(user_input)
            
            for topic in topics:
                self._record_pattern('topic', topic, metadata)
            
            for intent in intents:
                self._record_pattern('intent', intent, metadata)
            
            for entity in entities:
                self._record_pattern('entity', entity['value'], {
                    'type': entity['type'],
                    **(metadata or {})
                })
            
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO conversation_analysis
                    (conversation_id, timestamp, topics, intents, entities, sentiment, learned_patterns)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    conversation_id,
                    datetime.now().isoformat(),
                    json.dumps(topics, ensure_ascii=False),
                    json.dumps(intents, ensure_ascii=False),
                    json.dumps(entities, ensure_ascii=False),
                    sentiment,
                    json.dumps(list(self._pattern_cache.keys()), ensure_ascii=False)
                ))
                conn.commit()
    
    def _extract_topics(self, text: str) -> List[str]:
        topics = []
        
        topic_patterns = [
            r'(?:关于|讨论|分析|研究|处理|完成)([^\s，。！？]{2,10})',
            r'([^\s，。！？]{2,8})(?:项目|任务|文档|报告|数据)',
            r'(?:PPT|Excel|Word|文档|表格|演示)([^\s，。！？]{2,10})',
        ]
        
        for pattern in topic_patterns:
            matches = re.findall(pattern, text)
            topics.extend(matches)
        
        keywords = ['人工智能', '数据分析', '报告', '总结', '计划', '会议', '项目']
        for keyword in keywords:
            if keyword in text:
                topics.append(keyword)
        
        return list(set(topics))[:5]
    
    def _extract_intents(self, text: str) -> List[str]:
        intents = []
        
        intent_patterns = {
            'create': ['创建', '生成', '新建', '制作', '写'],
            'edit': ['修改', '编辑', '更新', '更改', '调整'],
            'delete': ['删除', '移除', '清除'],
            'query': ['查询', '搜索', '查找', '找'],
            'analyze': ['分析', '统计', '计算', '评估'],
            'summarize': ['总结', '摘要', '概括'],
            'translate': ['翻译', '转换'],
            'help': ['帮助', '怎么', '如何', '教程'],
        }
        
        text_lower = text.lower()
        for intent, triggers in intent_patterns.items():
            for trigger in triggers:
                if trigger in text_lower:
                    intents.append(intent)
                    break
        
        return list(set(intents))
    
    def _extract_entities(self, text: str) -> List[Dict]:
        entities = []
        
        date_pattern = r'\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?'
        dates = re.findall(date_pattern, text)
        for date in dates:
            entities.append({'type': 'date', 'value': date})
        
        number_pattern = r'\d+(?:\.\d+)?(?:%|万|千|百)?'
        numbers = re.findall(number_pattern, text)
        for num in numbers[:3]:
            entities.append({'type': 'number', 'value': num})
        
        return entities
    
    def _analyze_sentiment(self, text: str) -> str:
        positive_words = ['好', '棒', '优秀', '满意', '感谢', '谢谢', '喜欢', '完美']
        negative_words = ['差', '坏', '问题', '错误', '不满', '失望', '糟糕']
        
        positive_count = sum(1 for word in positive_words if word in text)
        negative_count = sum(1 for word in negative_words if word in text)
        
        if positive_count > negative_count:
            return 'positive'
        elif negative_count > positive_count:
            return 'negative'
        return 'neutral'
    
    def _record_pattern(self, pattern_type: str, content: str, context: Optional[Dict] = None):
        import hashlib
        pattern_id = hashlib.md5(f"{pattern_type}:{content}".encode()).hexdigest()[:12]
        
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT frequency, confidence FROM learning_patterns WHERE pattern_id = ?
            ''', (pattern_id,))
            
            row = cursor.fetchone()
            
            if row:
                new_frequency = row[0] + 1
                new_confidence = min(1.0, row[1] + 0.05)
                
                cursor.execute('''
                    UPDATE learning_patterns
                    SET frequency = ?, confidence = ?, last_seen = ?
                    WHERE pattern_id = ?
                ''', (new_frequency, new_confidence, datetime.now().isoformat(), pattern_id))
            else:
                cursor.execute('''
                    INSERT INTO learning_patterns
                    (pattern_id, pattern_type, content, frequency, confidence, first_seen, last_seen, context)
                    VALUES (?, ?, ?, 1, 0.5, ?, ?, ?)
                ''', (
                    pattern_id,
                    pattern_type,
                    content,
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                    json.dumps(context or {}, ensure_ascii=False)
                ))
            
            conn.commit()
    
    def record_user_feedback(self, context: str, user_input: str, response: str, positive: bool):
        import hashlib
        context_hash = hashlib.md5(context.encode()).hexdigest()[:12]
        
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO response_optimization
                (context_hash, user_input, response, user_feedback, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                context_hash,
                user_input,
                response,
                1 if positive else -1,
                datetime.now().isoformat()
            ))
            conn.commit()
    
    def get_optimized_response(self, context: str) -> Optional[str]:
        import hashlib
        context_hash = hashlib.md5(context.encode()).hexdigest()[:12]
        
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT response, SUM(user_feedback) as total_feedback
                FROM response_optimization
                WHERE context_hash = ?
                GROUP BY response
                ORDER BY total_feedback DESC
                LIMIT 1
            ''', (context_hash,))
            
            row = cursor.fetchone()
            if row and row[1] > 0:
                return row[0]
        return None
    
    def generate_daily_summary(self, date: Optional[str] = None) -> DailyInsight:
        if not date:
            date = datetime.now().strftime('%Y-%m-%d')
        
        start_time = datetime.strptime(date, '%Y-%m-%d')
        end_time = start_time + timedelta(days=1)
        
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT topics, intents, sentiment
                FROM conversation_analysis
                WHERE timestamp >= ? AND timestamp < ?
            ''', (start_time.isoformat(), end_time.isoformat()))
            
            rows = cursor.fetchall()
            
            all_topics = []
            all_intents = []
            sentiments = []
            
            for row in rows:
                all_topics.extend(json.loads(row[0]) if row[0] else [])
                all_intents.extend(json.loads(row[1]) if row[1] else [])
                sentiments.append(row[2])
            
            top_topics = [t for t, _ in Counter(all_topics).most_common(5)]
            
            cursor.execute('''
                SELECT pattern_type, content, frequency
                FROM learning_patterns
                WHERE last_seen >= ? AND last_seen < ?
                ORDER BY frequency DESC
                LIMIT 20
            ''', (start_time.isoformat(), end_time.isoformat()))
            
            patterns = cursor.fetchall()
            habits_identified = [p[1] for p in patterns if p[2] >= 3]
            
            preferences = {}
            for intent, count in Counter(all_intents).items():
                preferences[f'preferred_intent_{intent}'] = count / max(len(rows), 1)
            
            positive_ratio = sentiments.count('positive') / max(len(sentiments), 1)
            
            recommendations = []
            if positive_ratio < 0.5:
                recommendations.append('建议优化响应质量，用户满意度较低')
            if len(habits_identified) > 5:
                recommendations.append('检测到多个使用习惯，可考虑自动化常用操作')
            
            summary = f"今日共分析{len(rows)}次对话，主要话题：{', '.join(top_topics[:3])}"
            
            insight = DailyInsight(
                date=date,
                summary=summary,
                top_topics=top_topics,
                preferences_extracted=preferences,
                habits_identified=habits_identified,
                goals_progress={},
                recommendations=recommendations
            )
            
            self._save_daily_insight(insight)
            
            return insight
    
    def _save_daily_insight(self, insight: DailyInsight):
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO daily_insights
                (date, summary, top_topics, preferences_extracted, habits_identified, goals_progress, recommendations, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                insight.date,
                insight.summary,
                json.dumps(insight.top_topics, ensure_ascii=False),
                json.dumps(insight.preferences_extracted, ensure_ascii=False),
                json.dumps(insight.habits_identified, ensure_ascii=False),
                json.dumps(insight.goals_progress, ensure_ascii=False),
                json.dumps(insight.recommendations, ensure_ascii=False),
                datetime.now().isoformat()
            ))
            conn.commit()
    
    def get_patterns(self, pattern_type: Optional[str] = None, min_frequency: int = 2, limit: int = 50) -> List[LearningPattern]:
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.cursor()
            
            if pattern_type:
                cursor.execute('''
                    SELECT pattern_id, pattern_type, content, frequency, confidence, first_seen, last_seen, context
                    FROM learning_patterns
                    WHERE pattern_type = ? AND frequency >= ?
                    ORDER BY frequency DESC
                    LIMIT ?
                ''', (pattern_type, min_frequency, limit))
            else:
                cursor.execute('''
                    SELECT pattern_id, pattern_type, content, frequency, confidence, first_seen, last_seen, context
                    FROM learning_patterns
                    WHERE frequency >= ?
                    ORDER BY frequency DESC
                    LIMIT ?
                ''', (min_frequency, limit))
            
            return [
                LearningPattern(
                    pattern_id=row[0],
                    pattern_type=row[1],
                    content=row[2],
                    frequency=row[3],
                    confidence=row[4],
                    first_seen=datetime.fromisoformat(row[5]),
                    last_seen=datetime.fromisoformat(row[6]),
                    context=json.loads(row[7]) if row[7] else {}
                )
                for row in cursor.fetchall()
            ]
    
    def predict_user_intent(self, partial_input: str) -> List[Dict]:
        patterns = self.get_patterns(pattern_type='intent', min_frequency=1, limit=20)
        
        predictions = []
        for pattern in patterns:
            if pattern.content in partial_input or partial_input in pattern.content:
                predictions.append({
                    'intent': pattern.content,
                    'confidence': pattern.confidence,
                    'frequency': pattern.frequency
                })
        
        return sorted(predictions, key=lambda x: x['confidence'], reverse=True)[:3]
    
    def get_user_model(self) -> Dict[str, Any]:
        patterns = self.get_patterns(limit=100)
        
        model = {
            'topics': {},
            'intents': {},
            'entities': {},
            'habits': [],
            'preferences': {},
        }
        
        for pattern in patterns:
            if pattern.pattern_type in model:
                if isinstance(model[pattern.pattern_type], dict):
                    model[pattern.pattern_type][pattern.content] = {
                        'frequency': pattern.frequency,
                        'confidence': pattern.confidence
                    }
                elif isinstance(model[pattern.pattern_type], list):
                    model[pattern.pattern_type].append(pattern.to_dict())
        
        model['habits'] = [p.content for p in patterns if p.frequency >= 5]
        
        return model
    
    def enable_learning(self):
        self._learning_enabled = True
    
    def disable_learning(self):
        self._learning_enabled = False
    
    def is_learning_enabled(self) -> bool:
        return self._learning_enabled


self_learning_engine = SelfLearningEngine()

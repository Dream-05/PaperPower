"""
反馈与进化机制

实现：
- 素材评分：选用=+1，删除=-1，长期保留=+5
- 风格进化：根据用户选择调整推荐权重
- 内容进化：生成文案的点击/复制/修改率反馈
- 联邦聚合：跨用户匿名聚合学习
"""

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Any, Callable
import threading
import hashlib
from collections import defaultdict


class FeedbackType(Enum):
    SELECTION = "selection"
    DELETION = "deletion"
    RATING = "rating"
    MODIFICATION = "modification"
    COPY = "copy"
    EXPORT = "export"
    SHARE = "share"


class ContentType(Enum):
    DOCUMENT = "document"
    SPREADSHEET = "spreadsheet"
    PRESENTATION = "presentation"
    ASSET = "asset"
    TEMPLATE = "template"
    FORMULA = "formula"
    TEXT = "text"


@dataclass
class FeedbackEvent:
    """反馈事件"""
    event_id: str
    feedback_type: FeedbackType
    content_type: ContentType
    content_id: str
    user_id: str
    session_id: Optional[str] = None
    score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict:
        return {
            "event_id": self.event_id,
            "feedback_type": self.feedback_type.value,
            "content_type": self.content_type.value,
            "content_id": self.content_id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "score": self.score,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class ContentScore:
    """内容评分"""
    content_id: str
    content_type: ContentType
    base_score: float = 0.0
    selection_count: int = 0
    deletion_count: int = 0
    rating_sum: float = 0.0
    rating_count: int = 0
    modification_count: int = 0
    retention_days: int = 0
    final_score: float = 0.0
    last_updated: datetime = field(default_factory=datetime.now)
    
    def calculate_final_score(self) -> float:
        selection_score = self.selection_count * 1.0
        deletion_score = self.deletion_count * -1.0
        rating_score = (self.rating_sum / self.rating_count) if self.rating_count > 0 else 0
        retention_score = min(self.retention_days * 0.5, 5.0)
        
        self.final_score = (
            selection_score + 
            deletion_score + 
            rating_score * 2 + 
            retention_score +
            self.base_score
        )
        return self.final_score
    
    def to_dict(self) -> Dict:
        return {
            "content_id": self.content_id,
            "content_type": self.content_type.value,
            "base_score": self.base_score,
            "selection_count": self.selection_count,
            "deletion_count": self.deletion_count,
            "rating_sum": self.rating_sum,
            "rating_count": self.rating_count,
            "modification_count": self.modification_count,
            "retention_days": self.retention_days,
            "final_score": self.final_score,
            "last_updated": self.last_updated.isoformat(),
        }


@dataclass
class StyleEvolution:
    """风格进化记录"""
    style_id: str
    style_name: str
    user_id: str
    usage_count: int = 0
    positive_count: int = 0
    negative_count: int = 0
    weight: float = 1.0
    last_used: Optional[datetime] = None
    
    def update_weight(self, is_positive: bool):
        if is_positive:
            self.positive_count += 1
            self.weight = min(2.0, self.weight * 1.1)
        else:
            self.negative_count += 1
            self.weight = max(0.1, self.weight * 0.9)
        self.usage_count += 1
        self.last_used = datetime.now()


@dataclass
class EvolutionReport:
    """进化报告"""
    period_start: datetime
    period_end: datetime
    total_events: int
    top_content: List[Dict]
    style_trends: Dict[str, float]
    user_satisfaction: float
    recommendations: List[str]
    
    def to_dict(self) -> Dict:
        return {
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "total_events": self.total_events,
            "top_content": self.top_content,
            "style_trends": self.style_trends,
            "user_satisfaction": self.user_satisfaction,
            "recommendations": self.recommendations,
        }


class FeedbackCollector:
    """反馈收集器"""
    
    SCORE_MAPPING = {
        FeedbackType.SELECTION: 1.0,
        FeedbackType.DELETION: -1.0,
        FeedbackType.RATING: 0.0,
        FeedbackType.MODIFICATION: 0.5,
        FeedbackType.COPY: 0.3,
        FeedbackType.EXPORT: 0.5,
        FeedbackType.SHARE: 1.0,
    }
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/learning/feedback.db")
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._pending_events: List[FeedbackEvent] = []
        self._lock = threading.Lock()
    
    def _init_db(self):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS feedback_events (
                event_id TEXT PRIMARY KEY,
                feedback_type TEXT NOT NULL,
                content_type TEXT NOT NULL,
                content_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                session_id TEXT,
                score REAL,
                metadata TEXT,
                timestamp TEXT,
                processed INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS content_scores (
                content_id TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                base_score REAL DEFAULT 0,
                selection_count INTEGER DEFAULT 0,
                deletion_count INTEGER DEFAULT 0,
                rating_sum REAL DEFAULT 0,
                rating_count INTEGER DEFAULT 0,
                modification_count INTEGER DEFAULT 0,
                retention_days INTEGER DEFAULT 0,
                final_score REAL DEFAULT 0,
                last_updated TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS style_evolution (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                style_id TEXT NOT NULL,
                style_name TEXT,
                user_id TEXT NOT NULL,
                usage_count INTEGER DEFAULT 0,
                positive_count INTEGER DEFAULT 0,
                negative_count INTEGER DEFAULT 0,
                weight REAL DEFAULT 1.0,
                last_used TEXT,
                UNIQUE(style_id, user_id)
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_content ON feedback_events(content_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_events(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_events(feedback_type)')
        
        conn.commit()
        conn.close()
    
    def record(
        self,
        feedback_type: FeedbackType,
        content_type: ContentType,
        content_id: str,
        user_id: str,
        session_id: Optional[str] = None,
        score: Optional[float] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """记录反馈事件"""
        event_id = hashlib.md5(
            f"{content_id}_{feedback_type.value}_{datetime.now().timestamp()}".encode()
        ).hexdigest()[:12]
        
        if score is None:
            score = self.SCORE_MAPPING.get(feedback_type, 0.0)
        
        event = FeedbackEvent(
            event_id=event_id,
            feedback_type=feedback_type,
            content_type=content_type,
            content_id=content_id,
            user_id=user_id,
            session_id=session_id,
            score=score,
            metadata=metadata or {},
        )
        
        self._save_event(event)
        
        return event_id
    
    def _save_event(self, event: FeedbackEvent):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO feedback_events
            (event_id, feedback_type, content_type, content_id, user_id, session_id, score, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            event.event_id,
            event.feedback_type.value,
            event.content_type.value,
            event.content_id,
            event.user_id,
            event.session_id,
            event.score,
            json.dumps(event.metadata, ensure_ascii=False),
            event.timestamp.isoformat(),
        ))
        
        conn.commit()
        conn.close()
    
    def get_events(
        self,
        content_id: Optional[str] = None,
        user_id: Optional[str] = None,
        feedback_type: Optional[FeedbackType] = None,
        since: Optional[datetime] = None,
        limit: int = 100
    ) -> List[FeedbackEvent]:
        """获取反馈事件"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        query = "SELECT * FROM feedback_events WHERE 1=1"
        params = []
        
        if content_id:
            query += " AND content_id = ?"
            params.append(content_id)
        
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        
        if feedback_type:
            query += " AND feedback_type = ?"
            params.append(feedback_type.value)
        
        if since:
            query += " AND timestamp >= ?"
            params.append(since.isoformat())
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [self._row_to_event(row) for row in rows]
    
    def _row_to_event(self, row) -> FeedbackEvent:
        return FeedbackEvent(
            event_id=row[0],
            feedback_type=FeedbackType(row[1]),
            content_type=ContentType(row[2]),
            content_id=row[3],
            user_id=row[4],
            session_id=row[5],
            score=row[6],
            metadata=json.loads(row[7]) if row[7] else {},
            timestamp=datetime.fromisoformat(row[8]),
        )


class ScoreCalculator:
    """评分计算器"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/learning/feedback.db")
    
    def calculate_content_score(self, content_id: str, content_type: ContentType) -> ContentScore:
        """计算内容评分"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT feedback_type, COUNT(*), SUM(score)
            FROM feedback_events
            WHERE content_id = ?
            GROUP BY feedback_type
        ''', (content_id,))
        
        rows = cursor.fetchall()
        
        score = ContentScore(content_id=content_id, content_type=content_type)
        
        for row in rows:
            feedback_type = FeedbackType(row[0])
            count = row[1]
            
            if feedback_type == FeedbackType.SELECTION:
                score.selection_count = count
            elif feedback_type == FeedbackType.DELETION:
                score.deletion_count = count
            elif feedback_type == FeedbackType.RATING:
                score.rating_count = count
                score.rating_sum = row[2] or 0
            elif feedback_type == FeedbackType.MODIFICATION:
                score.modification_count = count
        
        cursor.execute('''
            SELECT MIN(timestamp) FROM feedback_events
            WHERE content_id = ? AND feedback_type = 'selection'
        ''', (content_id,))
        
        first_selection = cursor.fetchone()[0]
        if first_selection:
            first_date = datetime.fromisoformat(first_selection)
            score.retention_days = (datetime.now() - first_date).days
        
        conn.close()
        
        score.calculate_final_score()
        return score
    
    def update_all_scores(self):
        """更新所有内容评分"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('SELECT DISTINCT content_id, content_type FROM feedback_events')
        contents = cursor.fetchall()
        
        for content_id, content_type in contents:
            score = self.calculate_content_score(content_id, ContentType(content_type))
            
            cursor.execute('''
                INSERT OR REPLACE INTO content_scores
                (content_id, content_type, base_score, selection_count, deletion_count,
                 rating_sum, rating_count, modification_count, retention_days, final_score, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                score.content_id,
                score.content_type.value,
                score.base_score,
                score.selection_count,
                score.deletion_count,
                score.rating_sum,
                score.rating_count,
                score.modification_count,
                score.retention_days,
                score.final_score,
                datetime.now().isoformat(),
            ))
        
        conn.commit()
        conn.close()
    
    def get_top_scored(
        self,
        content_type: Optional[ContentType] = None,
        limit: int = 20
    ) -> List[ContentScore]:
        """获取高分内容"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        if content_type:
            cursor.execute('''
                SELECT content_id, content_type, final_score, selection_count, deletion_count
                FROM content_scores
                WHERE content_type = ?
                ORDER BY final_score DESC
                LIMIT ?
            ''', (content_type.value, limit))
        else:
            cursor.execute('''
                SELECT content_id, content_type, final_score, selection_count, deletion_count
                FROM content_scores
                ORDER BY final_score DESC
                LIMIT ?
            ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            ContentScore(
                content_id=row[0],
                content_type=ContentType(row[1]),
                final_score=row[2],
                selection_count=row[3],
                deletion_count=row[4],
            )
            for row in rows
        ]


class StyleEvolver:
    """风格进化器"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/learning/feedback.db")
    
    def record_style_usage(
        self,
        style_id: str,
        style_name: str,
        user_id: str,
        is_positive: bool = True
    ):
        """记录风格使用"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO style_evolution (style_id, style_name, user_id, usage_count, positive_count, negative_count, weight, last_used)
            VALUES (?, ?, ?, 1, ?, ?, 1.0, ?)
            ON CONFLICT(style_id, user_id) DO UPDATE SET
                usage_count = usage_count + 1,
                positive_count = positive_count + ?,
                negative_count = negative_count + ?,
                weight = CASE
                    WHEN ? = 1 THEN MIN(2.0, weight * 1.1)
                    ELSE MAX(0.1, weight * 0.9)
                END,
                last_used = ?
        ''', (
            style_id, style_name, user_id,
            1 if is_positive else 0, 0 if is_positive else 1,
            datetime.now().isoformat(),
            1 if is_positive else 0, 0 if is_positive else 1,
            1 if is_positive else 0,
            datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
    
    def get_user_style_weights(self, user_id: str) -> Dict[str, float]:
        """获取用户风格权重"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT style_id, style_name, weight
            FROM style_evolution
            WHERE user_id = ?
            ORDER BY weight DESC
        ''', (user_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return {row[1]: row[2] for row in rows}
    
    def get_global_style_trends(self) -> Dict[str, Dict]:
        """获取全局风格趋势"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT style_id, style_name,
                   SUM(usage_count) as total_usage,
                   SUM(positive_count) as total_positive,
                   SUM(negative_count) as total_negative,
                   AVG(weight) as avg_weight
            FROM style_evolution
            GROUP BY style_id, style_name
            ORDER BY total_usage DESC
        ''')
        
        rows = cursor.fetchall()
        conn.close()
        
        return {
            row[1]: {
                "style_id": row[0],
                "total_usage": row[2],
                "positive_rate": row[3] / row[2] if row[2] > 0 else 0,
                "avg_weight": row[5],
            }
            for row in rows
        }


class LearningLoop:
    """学习循环"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path("data/learning/feedback.db")
        self.collector = FeedbackCollector(db_path)
        self.calculator = ScoreCalculator(db_path)
        self.style_evolver = StyleEvolver(db_path)
    
    def record_selection(
        self,
        content_id: str,
        content_type: ContentType,
        user_id: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """记录选择事件"""
        self.collector.record(
            feedback_type=FeedbackType.SELECTION,
            content_type=content_type,
            content_id=content_id,
            user_id=user_id,
            session_id=session_id,
            metadata=metadata,
        )
    
    def record_deletion(
        self,
        content_id: str,
        content_type: ContentType,
        user_id: str,
        reason: Optional[str] = None
    ):
        """记录删除事件"""
        self.collector.record(
            feedback_type=FeedbackType.DELETION,
            content_type=content_type,
            content_id=content_id,
            user_id=user_id,
            metadata={"reason": reason} if reason else None,
        )
    
    def record_rating(
        self,
        content_id: str,
        content_type: ContentType,
        user_id: str,
        rating: float,
        comment: Optional[str] = None
    ):
        """记录评分事件"""
        self.collector.record(
            feedback_type=FeedbackType.RATING,
            content_type=content_type,
            content_id=content_id,
            user_id=user_id,
            score=rating,
            metadata={"comment": comment} if comment else None,
        )
    
    def record_modification(
        self,
        content_id: str,
        content_type: ContentType,
        user_id: str,
        modification_type: str
    ):
        """记录修改事件"""
        self.collector.record(
            feedback_type=FeedbackType.MODIFICATION,
            content_type=content_type,
            content_id=content_id,
            user_id=user_id,
            metadata={"modification_type": modification_type},
        )
    
    def record_style_preference(
        self,
        style_id: str,
        style_name: str,
        user_id: str,
        is_positive: bool = True
    ):
        """记录风格偏好"""
        self.style_evolver.record_style_usage(style_id, style_name, user_id, is_positive)
    
    def get_content_recommendations(
        self,
        content_type: ContentType,
        user_id: str,
        limit: int = 10
    ) -> List[Dict]:
        """获取内容推荐"""
        style_weights = self.style_evolver.get_user_style_weights(user_id)
        
        top_scored = self.calculator.get_top_scored(content_type, limit * 2)
        
        recommendations = []
        for score in top_scored:
            rec = score.to_dict()
            
            if style_weights:
                style_match = 1.0
                for style, weight in style_weights.items():
                    if style in score.content_id.lower():
                        style_match *= weight
                rec["adjusted_score"] = score.final_score * style_match
            else:
                rec["adjusted_score"] = score.final_score
            
            recommendations.append(rec)
        
        recommendations.sort(key=lambda x: x["adjusted_score"], reverse=True)
        return recommendations[:limit]
    
    def generate_evolution_report(
        self,
        period_days: int = 7
    ) -> EvolutionReport:
        """生成进化报告"""
        period_start = datetime.now() - timedelta(days=period_days)
        period_end = datetime.now()
        
        events = self.collector.get_events(since=period_start, limit=10000)
        
        self.calculator.update_all_scores()
        
        top_content = [
            {"content_id": s.content_id, "score": s.final_score}
            for s in self.calculator.get_top_scored(limit=10)
        ]
        
        style_trends = self.style_evolver.get_global_style_trends()
        style_summary = {
            name: data["positive_rate"]
            for name, data in style_trends.items()
        }
        
        positive_events = sum(1 for e in events if e.feedback_type in [FeedbackType.SELECTION, FeedbackType.RATING, FeedbackType.SHARE])
        total_events = len(events)
        user_satisfaction = positive_events / total_events if total_events > 0 else 0.5
        
        recommendations = self._generate_recommendations(events, style_trends)
        
        return EvolutionReport(
            period_start=period_start,
            period_end=period_end,
            total_events=total_events,
            top_content=top_content,
            style_trends=style_summary,
            user_satisfaction=user_satisfaction,
            recommendations=recommendations,
        )
    
    def _generate_recommendations(
        self,
        events: List[FeedbackEvent],
        style_trends: Dict
    ) -> List[str]:
        """生成改进建议"""
        recommendations = []
        
        deletion_events = [e for e in events if e.feedback_type == FeedbackType.DELETION]
        if len(deletion_events) > len(events) * 0.2:
            recommendations.append("删除率较高，建议优化素材质量筛选")
        
        rating_events = [e for e in events if e.feedback_type == FeedbackType.RATING]
        if rating_events:
            avg_rating = sum(e.score for e in rating_events) / len(rating_events)
            if avg_rating < 3.0:
                recommendations.append("平均评分偏低，建议改进内容生成质量")
        
        if style_trends:
            popular_styles = sorted(style_trends.items(), key=lambda x: x[1]["total_usage"], reverse=True)[:3]
            recommendations.append(f"热门风格：{', '.join([s[0] for s in popular_styles])}，可增加相关素材")
        
        if not recommendations:
            recommendations.append("系统运行良好，继续保持")
        
        return recommendations

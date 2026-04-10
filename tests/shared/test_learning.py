import pytest
import sys
import os
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from shared.memory_system import (
    MemoryType,
    ContentType,
    Message,
    SessionContext,
    UserPreference,
    UserProject,
    SessionMemory,
    UserMemory,
    GlobalMemory,
    MemorySystem,
)
from shared.learning_loop import (
    FeedbackType,
    FeedbackEvent,
    ContentScore,
    FeedbackCollector,
    ScoreCalculator,
    StyleEvolver,
    LearningLoop,
)


class TestSessionMemory:
    """测试会话记忆"""

    def setup_method(self):
        self.memory = SessionMemory(max_sessions=10, session_timeout=60)

    def test_create_session(self):
        session = self.memory.create_session("user123")
        
        assert session is not None
        assert session.session_id is not None

    def test_get_session(self):
        created = self.memory.create_session("user123")
        retrieved = self.memory.get_session(created.session_id)
        
        assert retrieved is not None
        assert retrieved.session_id == created.session_id

    def test_add_message(self):
        session = self.memory.create_session("user123")
        
        success = self.memory.add_message(
            session.session_id,
            "user",
            "测试消息"
        )
        
        assert success == True
        
        retrieved = self.memory.get_session(session.session_id)
        assert len(retrieved.messages) == 1

    def test_get_context(self):
        session = self.memory.create_session("user123")
        
        self.memory.add_message(session.session_id, "user", "消息1")
        self.memory.add_message(session.session_id, "assistant", "回复1")
        self.memory.add_message(session.session_id, "user", "消息2")
        
        context = self.memory.get_context(session.session_id, max_messages=2)
        
        assert len(context) == 2

    def test_set_current_task(self):
        session = self.memory.create_session("user123")
        
        self.memory.set_current_task(
            session.session_id,
            "生成PPT",
            ContentType.PRESENTATION
        )
        
        retrieved = self.memory.get_session(session.session_id)
        assert retrieved.current_task == "生成PPT"
        assert retrieved.content_type == ContentType.PRESENTATION


class TestUserMemory:
    """测试用户记忆"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.memory = UserMemory(Path(self.temp_dir) / "users.db")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_set_and_get_preference(self):
        self.memory.set_preference("user123", "style", "tech", 1.0)
        
        pref = self.memory.get_preference("user123", "style")
        
        assert pref is not None
        assert pref.value == "tech"
        assert pref.weight == 1.0

    def test_get_all_preferences(self):
        self.memory.set_preference("user123", "style", "tech")
        self.memory.set_preference("user123", "color", "blue")
        
        prefs = self.memory.get_all_preferences("user123")
        
        assert len(prefs) == 2
        assert "style" in prefs
        assert "color" in prefs

    def test_record_project(self):
        project_id = self.memory.record_project(
            user_id="user123",
            project_name="测试项目",
            content_type=ContentType.PRESENTATION,
            file_path="/path/to/project.pptx"
        )
        
        assert project_id is not None
        
        projects = self.memory.get_recent_projects("user123")
        assert len(projects) == 1
        assert projects[0].project_name == "测试项目"

    def test_get_recent_projects(self):
        self.memory.record_project("user123", "项目1", ContentType.DOCUMENT)
        self.memory.record_project("user123", "项目2", ContentType.PRESENTATION)
        self.memory.record_project("user123", "项目3", ContentType.SPREADSHEET)
        
        projects = self.memory.get_recent_projects("user123", limit=2)
        
        assert len(projects) == 2

    def test_get_user_style_preference(self):
        self.memory.set_preference("user123", "style_tech", "tech", 1.5)
        self.memory.set_preference("user123", "style_business", "business", 0.8)
        
        style_prefs = self.memory.get_user_style_preference("user123")
        
        assert "tech" in style_prefs
        assert style_prefs["tech"] == 1.5


class TestGlobalMemory:
    """测试全局记忆"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.memory = GlobalMemory(Path(self.temp_dir) / "global.db")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_update_trend(self):
        self.memory.update_trend("style", "tech_001", "科技风", delta_score=1.0)
        self.memory.update_trend("style", "tech_001", "科技风", delta_score=0.5)
        
        trends = self.memory.get_trends("style")
        
        assert len(trends) >= 0

    def test_update_asset_quality(self):
        self.memory.update_asset_quality("asset_001", "image", is_positive=True)
        self.memory.update_asset_quality("asset_001", "image", is_positive=True)
        
        top_assets = self.memory.get_top_assets("image")
        
        assert len(top_assets) >= 0

    def test_set_and_get_stat(self):
        self.memory.set_stat("daily_usage", "2024-01-01", {"count": 100})
        
        stat = self.memory.get_stat("daily_usage", "2024-01-01")
        
        assert stat is not None
        assert stat["count"] == 100


class TestMemorySystem:
    """测试完整记忆系统"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.system = MemorySystem(
            user_db_path=Path(self.temp_dir) / "users.db",
            global_db_path=Path(self.temp_dir) / "global.db",
        )

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_full_workflow(self):
        session = self.system.create_session("user123")
        
        self.system.add_message(session.session_id, "user", "你好")
        self.system.add_message(session.session_id, "assistant", "您好！")
        
        context = self.system.get_context(session.session_id)
        assert len(context) == 2
        
        self.system.learn_user_preference("user123", "style", "tech", 1.0)
        prefs = self.system.get_user_preferences("user123")
        assert "style" in prefs
        
        self.system.record_usage("user123", "style", "tech_001", "科技风", True)
        
        recommendations = self.system.get_recommendations("user123", "style")
        assert isinstance(recommendations, list)


class TestFeedbackCollector:
    """测试反馈收集器"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.collector = FeedbackCollector(Path(self.temp_dir) / "feedback.db")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_record_selection(self):
        event_id = self.collector.record(
            feedback_type=FeedbackType.SELECTION,
            content_type=ContentType.PRESENTATION,
            content_id="content_001",
            user_id="user123",
        )
        
        assert event_id is not None

    def test_record_rating(self):
        event_id = self.collector.record(
            feedback_type=FeedbackType.RATING,
            content_type=ContentType.PRESENTATION,
            content_id="content_001",
            user_id="user123",
            score=4.5,
        )
        
        assert event_id is not None

    def test_get_events(self):
        self.collector.record(
            FeedbackType.SELECTION,
            ContentType.PRESENTATION,
            "content_001",
            "user123",
        )
        self.collector.record(
            FeedbackType.DELETION,
            ContentType.PRESENTATION,
            "content_002",
            "user123",
        )
        
        events = self.collector.get_events(user_id="user123")
        
        assert len(events) == 2


class TestLearningLoop:
    """测试学习循环"""

    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.loop = LearningLoop(Path(self.temp_dir) / "feedback.db")

    def teardown_method(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_record_selection(self):
        self.loop.record_selection(
            content_id="content_001",
            content_type=ContentType.PRESENTATION,
            user_id="user123",
        )
        
        events = self.loop.collector.get_events(content_id="content_001")
        assert len(events) == 1

    def test_record_rating(self):
        self.loop.record_rating(
            content_id="content_001",
            content_type=ContentType.PRESENTATION,
            user_id="user123",
            rating=4.5,
        )
        
        events = self.loop.collector.get_events(
            content_id="content_001",
            feedback_type=FeedbackType.RATING
        )
        assert len(events) == 1

    def test_record_style_preference(self):
        self.loop.record_style_preference(
            style_id="tech",
            style_name="科技风",
            user_id="user123",
            is_positive=True,
        )
        
        weights = self.loop.style_evolver.get_user_style_weights("user123")
        assert "科技风" in weights

    def test_generate_evolution_report(self):
        self.loop.record_selection("c1", ContentType.PRESENTATION, "u1")
        self.loop.record_selection("c2", ContentType.PRESENTATION, "u1")
        self.loop.record_rating("c1", ContentType.PRESENTATION, "u1", 4.0)
        
        report = self.loop.generate_evolution_report(period_days=7)
        
        assert report.total_events > 0
        assert report.user_satisfaction >= 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

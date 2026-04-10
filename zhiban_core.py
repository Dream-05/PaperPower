"""
PaperPower核心系统集成入口
整合所有技能模块：长期记忆、语音、唤醒、贾维斯模式、守护进程、自学习、LocalAI
"""

import os
import sys
import json
import logging
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List

from .longterm_memory import LongTermMemory, long_term_memory
from .daemon_process import DaemonProcess, PersistentAgent, daemon, persistent_agent
from .self_learning import SelfLearningEngine, self_learning_engine
from .local_ai import LocalAIEngine, LocalAIConfig, local_ai_engine

logger = logging.getLogger(__name__)


class PaperPowerCore:
    """PaperPower核心系统"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self.memory = long_term_memory
        self.learning = self_learning_engine
        self.daemon = daemon
        self.agent = persistent_agent
        self.local_ai = local_ai_engine
        
        self._jarvis_mode = False
        self._voice_enabled = False
        self._local_ai_enabled = False
        self._initialized = False
        
    def _load_config(self, config_path: Optional[str]) -> Dict:
        default_config = {
            'jarvis_mode': True,
            'voice_enabled': True,
            'auto_start_daemon': True,
            'learning_enabled': True,
            'memory_permanent': True,
            'wake_words': ['PaperPower', 'paper power', '贾维斯'],
            'language': 'zh',
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                logger.warning(f"Failed to load config: {e}")
        
        return default_config
    
    def initialize(self) -> bool:
        """初始化所有模块"""
        if self._initialized:
            return True
        
        logger.info("Initializing PaperPower Core System...")
        
        try:
            Path("data/memory").mkdir(parents=True, exist_ok=True)
            Path("logs").mkdir(parents=True, exist_ok=True)
            
            if self.config.get('jarvis_mode', True):
                self.enable_jarvis_mode()
            
            if self.config.get('learning_enabled', True):
                self.learning.enable_learning()
            
            if self.config.get('auto_start_daemon', True):
                self.start_daemon()
            
            if self.config.get('local_ai_enabled', True):
                self._init_local_ai()
            
            self._initialized = True
            logger.info("PaperPower Core System initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize: {e}")
            return False
    
    def _init_local_ai(self):
        """初始化LocalAI"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            success = loop.run_until_complete(self.local_ai.initialize())
            if success:
                self._local_ai_enabled = True
                logger.info("LocalAI initialized successfully")
            else:
                logger.warning("LocalAI not available, using cloud AI")
        except Exception as e:
            logger.warning(f"LocalAI initialization failed: {e}")
    
    def enable_jarvis_mode(self):
        """启用贾维斯模式"""
        self._jarvis_mode = True
        from .longterm_memory import UserPreference
        pref = UserPreference(
            category='system',
            key='jarvis_mode',
            value=True,
            confidence=1.0,
            source='config'
        )
        self.memory.set_preference(pref)
        logger.info("Jarvis mode enabled")
    
    def disable_jarvis_mode(self):
        """禁用贾维斯模式"""
        self._jarvis_mode = False
    
    def is_jarvis_mode(self) -> bool:
        return self._jarvis_mode
    
    def enable_voice(self):
        """启用语音功能"""
        self._voice_enabled = True
    
    def disable_voice(self):
        """禁用语音功能"""
        self._voice_enabled = False
    
    def is_voice_enabled(self) -> bool:
        return self._voice_enabled
    
    def start_daemon(self) -> bool:
        """启动守护进程"""
        try:
            return self.agent.start()
        except Exception as e:
            logger.error(f"Failed to start daemon: {e}")
            return False
    
    def stop_daemon(self):
        """停止守护进程"""
        self.agent.stop()
    
    def get_daemon_status(self) -> Dict:
        """获取守护进程状态"""
        return self.agent.get_status()
    
    def process_input(
        self,
        user_input: str,
        user_id: str = "default",
        session_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """处理用户输入"""
        import hashlib
        from .longterm_memory import Conversation
        
        conv_id = hashlib.md5(f"{user_id}_{datetime.now().timestamp()}".encode()).hexdigest()[:12]
        
        conv = Conversation(
            id=conv_id,
            timestamp=datetime.now(),
            role='user',
            content=user_input,
            intent=None,
            entities=[],
            sentiment=None,
            metadata=metadata or {}
        )
        self.memory.save_conversation(conv)
        
        self.learning.learn_from_conversation(
            conversation_id=conv_id,
            user_input=user_input,
            response="",
            metadata=metadata
        )
        
        context = self.memory.get_context_for_conversation()
        user_model = self.learning.get_user_model()
        
        response = self._generate_response(user_input, context, user_model)
        
        response_conv = Conversation(
            id=hashlib.md5(f"{conv_id}_response".encode()).hexdigest()[:12],
            timestamp=datetime.now(),
            role='assistant',
            content=response['content'],
            intent=response.get('intent'),
            entities=response.get('entities', []),
            sentiment=None,
            metadata={'jarvis_mode': self._jarvis_mode}
        )
        self.memory.save_conversation(response_conv)
        
        return {
            'success': True,
            'response': response['content'],
            'context': context,
            'user_model': user_model,
            'jarvis_mode': self._jarvis_mode,
        }
    
    def _generate_response(
        self,
        user_input: str,
        context: Dict,
        user_model: Dict
    ) -> Dict[str, Any]:
        """生成响应 - 优先使用本地模型"""
        response_prefix = ""
        if self._jarvis_mode:
            prefixes = ['收到，', '明白，', '好的，', '了解，']
            import random
            response_prefix = random.choice(prefixes)
        
        predicted_intents = self.learning.predict_user_intent(user_input)
        
        # 尝试使用LocalAI
        if self._local_ai_enabled and self.local_ai.is_available():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                messages = [
                    {"role": "system", "content": "你是PaperPower助手，一个专业、简洁、贴心的AI助手。"},
                    {"role": "user", "content": user_input}
                ]
                
                result = loop.run_until_complete(
                    self.local_ai.chat_completion(messages, max_tokens=512)
                )
                
                if result and 'choices' in result:
                    content = result['choices'][0]['message']['content']
                    return {
                        'content': content,
                        'intent': predicted_intents[0]['intent'] if predicted_intents else None,
                        'entities': [],
                        'predictions': predicted_intents,
                        'local': True,
                        'model': result.get('model', 'local')
                    }
            except Exception as e:
                logger.warning(f"LocalAI response failed: {e}")
        
        # 回退到默认响应
        content = f"{response_prefix}正在处理您的请求..."
        
        if '生成' in user_input or '创建' in user_input:
            content = f"{response_prefix}正在为您生成内容..."
        elif '分析' in user_input:
            content = f"{response_prefix}正在分析数据..."
        elif '总结' in user_input:
            content = f"{response_prefix}正在生成总结..."
        
        return {
            'content': content,
            'intent': predicted_intents[0]['intent'] if predicted_intents else None,
            'entities': [],
            'predictions': predicted_intents,
            'local': False
        }
    
    def record_feedback(self, conversation_id: str, positive: bool):
        """记录用户反馈"""
        self.learning.record_user_feedback(
            context=conversation_id,
            user_input="",
            response="",
            positive=positive
        )
    
    def get_daily_summary(self, date: Optional[str] = None) -> Dict:
        """获取每日总结"""
        insight = self.learning.generate_daily_summary(date)
        return insight.to_dict()
    
    def get_user_profile(self, user_id: str = "default") -> Dict:
        """获取用户画像"""
        profile = self.memory.get_user_profile(user_id)
        model = self.learning.get_user_model()
        
        return {
            'profile': profile.to_dict(),
            'learning_model': model,
        }
    
    def export_all_data(self) -> Dict:
        """导出所有数据"""
        return {
            'memory': self.memory.export_all(),
            'learning': self.learning.get_user_model(),
            'config': self.config,
            'exported_at': datetime.now().isoformat(),
        }
    
    def import_data(self, data: Dict):
        """导入数据"""
        if 'memory' in data:
            self.memory.import_data(data['memory'])
        
        logger.info("Data imported successfully")
    
    def get_status(self) -> Dict:
        """获取系统状态"""
        return {
            'initialized': self._initialized,
            'jarvis_mode': self._jarvis_mode,
            'voice_enabled': self._voice_enabled,
            'local_ai_enabled': self._local_ai_enabled,
            'local_ai_available': self.local_ai.is_available() if self._local_ai_enabled else False,
            'learning_enabled': self.learning.is_learning_enabled(),
            'daemon_status': self.get_daemon_status(),
            'memory_stats': {
                'conversations': len(self.memory.get_conversations(limit=10000)),
                'preferences': len(self.memory.get_all_preferences()),
            },
        }
    
    def shutdown(self):
        """关闭系统"""
        logger.info("Shutting down ZhibanAI Core System...")
        self.stop_daemon()
        self._initialized = False


paperpower_core = PaperPowerCore()


def initialize_paperpower(config_path: Optional[str] = None) -> PaperPowerCore:
    """初始化PaperPower核心系统"""
    global paperpower_core
    paperpower_core = PaperPowerCore(config_path)
    paperpower_core.initialize()
    return paperpower_core


def get_paperpower_core() -> PaperPowerCore:
    """获取PaperPower核心实例"""
    return paperpower_core

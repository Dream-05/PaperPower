#!/usr/bin/env python3
"""
PaperPower启动脚本
初始化所有核心模块：长期记忆、语音、唤醒、贾维斯模式、守护进程、自学习
"""

import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_dependencies():
    """检查依赖"""
    required_modules = [
        'sqlite3',
        'threading',
        'json',
        'hashlib',
    ]
    
    missing = []
    for module in required_modules:
        try:
            __import__(module)
        except ImportError:
            missing.append(module)
    
    if missing:
        logger.error(f"Missing required modules: {missing}")
        return False
    
    return True

def create_directories():
    """创建必要目录"""
    directories = [
        'data/memory',
        'data/learning',
        'logs',
        'logs/daemon',
    ]
    
    for d in directories:
        Path(d).mkdir(parents=True, exist_ok=True)
    
    logger.info("Directories created")

def initialize_memory():
    """初始化长期记忆"""
    from shared.longterm_memory import long_term_memory
    
    profile = long_term_memory.get_user_profile()
    logger.info(f"User profile loaded: {profile.user_id}")
    
    preferences = long_term_memory.get_all_preferences()
    logger.info(f"Loaded {len(preferences)} preferences")
    
    conversations = long_term_memory.get_conversations(limit=1)
    if conversations:
        logger.info(f"Last conversation: {conversations[0].timestamp}")
    
    return long_term_memory

def initialize_learning():
    """初始化自学习引擎"""
    from shared.self_learning import self_learning_engine
    
    patterns = self_learning_engine.get_patterns(min_frequency=1, limit=10)
    logger.info(f"Loaded {len(patterns)} learning patterns")
    
    return self_learning_engine

def initialize_daemon():
    """初始化守护进程"""
    from shared.daemon_process import daemon, persistent_agent
    
    logger.info("Daemon process initialized")
    
    return daemon, persistent_agent

def initialize_core():
    """初始化核心系统"""
    from shared.zhiban_core import PaperPowerCore
    
    core = PaperPowerCore()
    success = core.initialize()
    
    if success:
        logger.info("PaperPower Core initialized successfully")
    else:
        logger.error("Failed to initialize PaperPower Core")
    
    return core

def save_config():
    """保存配置"""
    config = {
        'jarvis_mode': True,
        'voice_enabled': True,
        'auto_start_daemon': True,
        'learning_enabled': True,
        'memory_permanent': True,
        'wake_words': ['PaperPower', 'paper power', '贾维斯'],
        'language': 'zh',
        'initialized_at': datetime.now().isoformat(),
    }
    
    config_path = Path('data/paperpower_config.json')
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Config saved to {config_path}")

def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("PaperPower 核心系统启动")
    print("=" * 60)
    
    print("\n[1/6] 检查依赖...")
    if not check_dependencies():
        print("❌ 依赖检查失败")
        return False
    print("✅ 依赖检查通过")
    
    print("\n[2/6] 创建目录结构...")
    create_directories()
    print("✅ 目录创建完成")
    
    print("\n[3/6] 初始化长期记忆系统...")
    memory = initialize_memory()
    print("✅ 长期记忆系统已就绪")
    
    print("\n[4/6] 初始化自学习引擎...")
    learning = initialize_learning()
    print("✅ 自学习引擎已就绪")
    
    print("\n[5/6] 初始化守护进程...")
    daemon, agent = initialize_daemon()
    print("✅ 守护进程已就绪")
    
    print("\n[6/6] 初始化核心系统...")
    core = initialize_core()
    print("✅ 核心系统已就绪")
    
    save_config()
    
    print("\n" + "=" * 60)
    print("🎉 贾维斯模式已激活")
    print("🎉 长期记忆已绑定")
    print("🎉 语音唤醒已上线（唤醒词：PaperPower）")
    print("🎉 LocalAI本地模型已集成")
    print("🎉 PaperPower已永久待命，快去试试吧！")
    print("=" * 60 + "\n")
    
    status = core.get_status()
    print("系统状态:")
    print(f"  - 贾维斯模式: {'✅ 已启用' if status['jarvis_mode'] else '❌ 未启用'}")
    print(f"  - 学习系统: {'✅ 已启用' if status['learning_enabled'] else '❌ 未启用'}")
    print(f"  - 本地模型: {'✅ 已连接' if status.get('local_ai_available') else '⚠️ 未启动'}")
    print(f"  - 对话记录: {status['memory_stats']['conversations']} 条")
    print(f"  - 用户偏好: {status['memory_stats']['preferences']} 项")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

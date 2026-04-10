"""
智办AI统一启动脚本
ZhibanAI Unified Startup Script
"""

import asyncio
import sys
import os
import subprocess
import time
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_dependencies():
    """检查依赖"""
    logger.info("Checking dependencies...")
    
    required_packages = [
        "fastapi", "uvicorn", "aiohttp", "pydantic"
    ]
    
    missing = []
    for pkg in required_packages:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    
    if missing:
        logger.warning(f"Missing packages: {missing}")
        logger.info("Installing missing packages...")
        subprocess.run([
            sys.executable, "-m", "pip", "install"
        ] + missing, check=True)
    
    logger.info("All dependencies satisfied")


def start_backend():
    """启动后端服务"""
    logger.info("Starting backend server...")
    
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", 
         "shared.multi_agent.unified_api:app",
         "--host", "0.0.0.0",
         "--port", "8000",
         "--reload"],
        cwd=Path(__file__).parent
    )


def start_frontend():
    """启动前端服务"""
    logger.info("Starting frontend server...")
    
    return subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=Path(__file__).parent,
        shell=True
    )


async def test_system():
    """测试系统"""
    import aiohttp
    
    logger.info("Testing system...")
    
    await asyncio.sleep(3)
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8000/health", timeout=5) as resp:
                if resp.status == 200:
                    logger.info("Backend health check passed")
                else:
                    logger.error(f"Backend health check failed: {resp.status}")
            
            async with session.post(
                "http://localhost:8000/api/chat",
                json={"message": "测试消息", "use_multi_agent": True}
            ) as resp:
                result = await resp.json()
                if result.get("success"):
                    logger.info("Multi-agent chat test passed")
                    logger.info(f"Response: {result.get('response', '')[:100]}...")
                else:
                    logger.error(f"Chat test failed: {result}")
    
    except Exception as e:
        logger.error(f"System test error: {e}")


def main():
    """主入口"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║                    智办AI 多智能体系统                        ║
║              ZhibanAI Multi-Agent System                      ║
╠══════════════════════════════════════════════════════════════╣
║  功能 Features:                                               ║
║  • 多智能体协作 Multi-Agent Collaboration                     ║
║  • AI推理服务 AI Inference Service                            ║
║  • 意图识别 Intent Recognition                                ║
║  • 任务规划 Task Planning                                     ║
║  • 实时WebSocket Real-time WebSocket                          ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    check_dependencies()
    
    backend_process = None
    frontend_process = None
    
    try:
        backend_process = start_backend()
        
        time.sleep(2)
        
        asyncio.run(test_system())
        
        print("\n" + "=" * 60)
        print("系统已启动!")
        print("System started!")
        print("=" * 60)
        print("\n访问地址 Access URLs:")
        print("  • API文档 API Docs: http://localhost:8000/docs")
        print("  • 健康检查 Health:  http://localhost:8000/health")
        print("  • 聊天接口 Chat:    http://localhost:8000/api/chat")
        print("\n按 Ctrl+C 停止服务")
        print("Press Ctrl+C to stop")
        print("=" * 60 + "\n")
        
        while True:
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n\n正在关闭服务...")
        print("Shutting down...")
    
    finally:
        if backend_process:
            backend_process.terminate()
        if frontend_process:
            frontend_process.terminate()
        
        print("服务已关闭")
        print("Services stopped")


if __name__ == "__main__":
    main()

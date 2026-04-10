"""
后台守护进程模块
支持开机自启、崩溃自动重启、24小时持续运行
"""

import os
import sys
import json
import time
import signal
import logging
import threading
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional, Callable, Dict, Any
from dataclasses import dataclass, field
from enum import Enum


class DaemonStatus(Enum):
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    RESTARTING = "restarting"
    STOPPING = "stopping"
    CRASHED = "crashed"


@dataclass
class DaemonConfig:
    name: str = "PaperPowerDaemon"
    auto_start: bool = True
    auto_restart: bool = True
    max_restart_attempts: int = 5
    restart_delay: float = 5.0
    heartbeat_interval: float = 30.0
    log_path: str = "logs/daemon"
    pid_file: str = "data/daemon.pid"
    status_file: str = "data/daemon_status.json"


@dataclass
class DaemonState:
    status: DaemonStatus = DaemonStatus.STOPPED
    pid: Optional[int] = None
    start_time: Optional[datetime] = None
    restart_count: int = 0
    last_heartbeat: Optional[datetime] = None
    last_error: Optional[str] = None
    uptime_seconds: float = 0.0


class DaemonProcess:
    def __init__(self, config: Optional[DaemonConfig] = None):
        self.config = config or DaemonConfig()
        self.state = DaemonState()
        self.logger = self._setup_logger()
        self._running = False
        self._stop_event = threading.Event()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._watchdog_thread: Optional[threading.Thread] = None
        self._tasks: Dict[str, Callable] = {}
        self._task_threads: Dict[str, threading.Thread] = {}
        
        Path(self.config.log_path).mkdir(parents=True, exist_ok=True)
        Path(self.config.pid_file).parent.mkdir(parents=True, exist_ok=True)

    def _setup_logger(self) -> logging.Logger:
        logger = logging.getLogger(self.config.name)
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            log_file = Path(self.config.log_path) / f"daemon_{datetime.now().strftime('%Y%m%d')}.log"
            file_handler = logging.FileHandler(log_file, encoding='utf-8')
            file_handler.setLevel(logging.INFO)
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
            
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.INFO)
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)
        
        return logger

    def register_task(self, name: str, task: Callable, interval: float = 60.0):
        self._tasks[name] = {'func': task, 'interval': interval, 'last_run': None}

    def _run_task(self, name: str, task_info: Dict):
        while self._running and not self._stop_event.is_set():
            try:
                task_info['func']()
                task_info['last_run'] = datetime.now()
            except Exception as e:
                self.logger.error(f"Task {name} error: {e}")
            
            self._stop_event.wait(task_info['interval'])

    def _heartbeat(self):
        while self._running and not self._stop_event.is_set():
            self.state.last_heartbeat = datetime.now()
            self._save_status()
            self._stop_event.wait(self.config.heartbeat_interval)

    def _watchdog(self):
        while self._running and not self._stop_event.is_set():
            for name, task_info in list(self._tasks.items()):
                thread = self._task_threads.get(name)
                if thread and not thread.is_alive():
                    self.logger.warning(f"Task {name} died, restarting...")
                    new_thread = threading.Thread(
                        target=self._run_task,
                        args=(name, task_info),
                        daemon=True
                    )
                    new_thread.start()
                    self._task_threads[name] = new_thread
            
            self._stop_event.wait(10)

    def _save_status(self):
        status_data = {
            'status': self.state.status.value,
            'pid': self.state.pid,
            'start_time': self.state.start_time.isoformat() if self.state.start_time else None,
            'restart_count': self.state.restart_count,
            'last_heartbeat': self.state.last_heartbeat.isoformat() if self.state.last_heartbeat else None,
            'last_error': self.state.last_error,
            'uptime_seconds': self.state.uptime_seconds,
        }
        
        with open(self.config.status_file, 'w', encoding='utf-8') as f:
            json.dump(status_data, f, ensure_ascii=False, indent=2)

    def _save_pid(self):
        with open(self.config.pid_file, 'w') as f:
            f.write(str(os.getpid()))

    def _cleanup(self):
        if os.path.exists(self.config.pid_file):
            os.remove(self.config.pid_file)

    def start(self):
        if self._running:
            self.logger.warning("Daemon already running")
            return False
        
        self.logger.info(f"Starting daemon: {self.config.name}")
        self.state.status = DaemonStatus.STARTING
        self._save_status()
        
        self._running = True
        self._stop_event.clear()
        self.state.pid = os.getpid()
        self.state.start_time = datetime.now()
        self.state.status = DaemonStatus.RUNNING
        
        self._save_pid()
        self._save_status()
        
        self._heartbeat_thread = threading.Thread(target=self._heartbeat, daemon=True)
        self._heartbeat_thread.start()
        
        self._watchdog_thread = threading.Thread(target=self._watchdog, daemon=True)
        self._watchdog_thread.start()
        
        for name, task_info in self._tasks.items():
            thread = threading.Thread(
                target=self._run_task,
                args=(name, task_info),
                daemon=True
            )
            thread.start()
            self._task_threads[name] = thread
        
        self.logger.info("Daemon started successfully")
        return True

    def stop(self):
        if not self._running:
            return
        
        self.logger.info("Stopping daemon...")
        self.state.status = DaemonStatus.STOPPING
        self._save_status()
        
        self._running = False
        self._stop_event.set()
        
        for thread in self._task_threads.values():
            if thread.is_alive():
                thread.join(timeout=5)
        
        self.state.status = DaemonStatus.STOPPED
        self._save_status()
        self._cleanup()
        
        self.logger.info("Daemon stopped")

    def restart(self):
        self.logger.info("Restarting daemon...")
        self.state.status = DaemonStatus.RESTARTING
        self._save_status()
        
        self.stop()
        time.sleep(self.config.restart_delay)
        
        self.state.restart_count += 1
        self.start()

    def get_status(self) -> Dict[str, Any]:
        if self.state.start_time:
            self.state.uptime_seconds = (datetime.now() - self.state.start_time).total_seconds()
        
        return {
            'status': self.state.status.value,
            'pid': self.state.pid,
            'uptime': self.state.uptime_seconds,
            'restart_count': self.state.restart_count,
            'last_heartbeat': self.state.last_heartbeat.isoformat() if self.state.last_heartbeat else None,
        }

    def is_running(self) -> bool:
        return self._running and self.state.status == DaemonStatus.RUNNING


class PersistentAgent:
    def __init__(self, daemon: Optional[DaemonProcess] = None):
        self.daemon = daemon or DaemonProcess()
        self._setup_persistent_tasks()

    def _setup_persistent_tasks(self):
        self.daemon.register_task('health_check', self._health_check, 60)
        self.daemon.register_task('memory_sync', self._sync_memory, 300)
        self.daemon.register_task('daily_summary', self._daily_summary, 86400)
        self.daemon.register_task('auto_backup', self._auto_backup, 3600)

    def _health_check(self):
        pass

    def _sync_memory(self):
        pass

    def _daily_summary(self):
        pass

    def _auto_backup(self):
        pass

    def start(self):
        return self.daemon.start()

    def stop(self):
        self.daemon.stop()

    def get_status(self):
        return self.daemon.get_status()


def create_windows_service_script():
    return '''
$serviceName = "PaperPowerDaemon"
$scriptPath = "$PSScriptRoot\\daemon_service.ps1"

if (-not (Get-Service -Name $serviceName -ErrorAction SilentlyContinue)) {
    New-Service -Name $serviceName -BinaryPathName "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `$scriptPath" -StartupType Automatic -Description "PaperPower后台守护进程"
    Write-Host "Service created successfully"
} else {
    Write-Host "Service already exists"
}

Start-Service -Name $serviceName
Write-Host "Service started"
'''


def create_autostart_script():
    return '''
#!/usr/bin/env python3
"""开机自启脚本"""
import os
import sys

def setup_autostart():
    if sys.platform == 'win32':
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            0,
            winreg.KEY_SET_VALUE
        )
        script_path = os.path.abspath(__file__)
        winreg.SetValueEx(key, "PaperPower", 0, winreg.REG_SZ, f'pythonw "{script_path}"')
        winreg.CloseKey(key)
        print("Autostart configured for Windows")
    elif sys.platform == 'darwin':
        plist_path = os.path.expanduser("~/Library/LaunchAgents/com.zhiban.ai.plist")
        print(f"Configure launch agent at {plist_path}")
    elif sys.platform.startswith('linux'):
        desktop_path = os.path.expanduser("~/.config/autostart/paperpower.desktop")
        print(f"Configure autostart at {desktop_path}")

if __name__ == "__main__":
    setup_autostart()
'''


daemon = DaemonProcess()
persistent_agent = PersistentAgent(daemon)

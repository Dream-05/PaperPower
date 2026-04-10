"""
适配器模块
连接智办AI现有系统和DeerFlow框架
"""

from .zhiban_adapter import ZhibanToolAdapter, AgentAdapter

__all__ = [
    'ZhibanToolAdapter',
    'AgentAdapter'
]

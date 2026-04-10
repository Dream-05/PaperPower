"""
用户认证系统 - 零成本方案
基于JWT + SQLite实现，无需任何付费服务
"""

from .auth_service import AuthService, get_current_user, create_token, verify_token, TokenData
from .user_manager import UserManager, User, UserCreate, UserLogin, user_manager

__all__ = [
    'AuthService',
    'UserManager', 
    'User',
    'UserCreate',
    'UserLogin',
    'TokenData',
    'user_manager',
    'get_current_user',
    'create_token',
    'verify_token',
]

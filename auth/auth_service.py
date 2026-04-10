"""
JWT认证服务 - 零成本实现
使用PyJWT + passlib，完全本地化，无需任何云服务
"""

import os
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dataclasses import dataclass
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "zhiban-ai-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 7


@dataclass
class TokenData:
    user_id: str
    username: str
    role: str = "user"
    exp: datetime = None


class AuthService:
    """JWT认证服务"""
    
    def __init__(self, secret_key: str = None):
        self.secret_key = secret_key or SECRET_KEY
        self.algorithm = ALGORITHM
        self.pwd_context = pwd_context
    
    def hash_password(self, password: str) -> str:
        """密码哈希"""
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """验证密码"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def create_access_token(
        self, 
        user_id: str, 
        username: str,
        role: str = "user",
        expires_hours: int = None
    ) -> str:
        """创建访问令牌"""
        expire = datetime.utcnow() + timedelta(
            hours=expires_hours or ACCESS_TOKEN_EXPIRE_HOURS
        )
        payload = {
            "sub": user_id,
            "username": username,
            "role": role,
            "type": "access",
            "exp": expire,
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(
        self, 
        user_id: str,
        expires_days: int = None
    ) -> str:
        """创建刷新令牌"""
        expire = datetime.utcnow() + timedelta(
            days=expires_days or REFRESH_TOKEN_EXPIRE_DAYS
        )
        payload = {
            "sub": user_id,
            "type": "refresh",
            "exp": expire,
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """解码令牌"""
        try:
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌已过期",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效令牌",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    def verify_access_token(self, token: str) -> TokenData:
        """验证访问令牌"""
        payload = self.decode_token(token)
        
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌类型错误",
            )
        
        return TokenData(
            user_id=payload["sub"],
            username=payload.get("username", ""),
            role=payload.get("role", "user"),
            exp=datetime.fromtimestamp(payload["exp"])
        )
    
    def verify_refresh_token(self, token: str) -> str:
        """验证刷新令牌"""
        payload = self.decode_token(token)
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌类型错误",
            )
        
        return payload["sub"]


auth_service = AuthService()


def create_token(user_id: str, username: str, role: str = "user") -> Dict[str, str]:
    """创建令牌对"""
    access_token = auth_service.create_access_token(user_id, username, role)
    refresh_token = auth_service.create_refresh_token(user_id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


def verify_token(token: str) -> TokenData:
    """验证令牌"""
    return auth_service.verify_access_token(token)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """获取当前用户（FastAPI依赖）"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return auth_service.verify_access_token(credentials.credentials)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[TokenData]:
    """获取当前用户（可选）"""
    if credentials is None:
        return None
    
    try:
        return auth_service.verify_access_token(credentials.credentials)
    except HTTPException:
        return None


def require_role(required_role: str):
    """角色验证装饰器"""
    async def role_checker(current_user: TokenData = Depends(get_current_user)):
        if current_user.role != required_role and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="权限不足"
            )
        return current_user
    return role_checker

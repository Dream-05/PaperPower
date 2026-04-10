@echo off
chcp 65001 >nul
echo ========================================
echo 智办AI 零成本架构 - 启动脚本
echo ========================================
echo.

echo [1/3] 检查Python环境...
python --version
if errorlevel 1 (
    echo 错误: Python未安装或未添加到PATH
    pause
    exit /b 1
)

echo.
echo [2/3] 安装依赖...
pip install -r requirements.txt -q

echo.
echo [3/3] 验证模块...
python verify_modules.py

echo.
echo ========================================
echo 启动API服务...
echo ========================================
python -m uvicorn shared.backend.api_server_v2:app --reload --port 8000

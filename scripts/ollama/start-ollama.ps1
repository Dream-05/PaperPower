<#
.SYNOPSIS
    Ollama 一键部署脚本 for Windows
.DESCRIPTION
    自动检测、安装和配置Ollama本地AI服务
.EXAMPLE
    .\start-ollama.ps1
    .\start-ollama.ps1 -Model qwen2.5:7b
#>

param(
    [string]$Model = "",
    
    [switch]$Stop,
    
    [switch]$Status,
    
    [switch]$Install
)

$ErrorActionPreference = "Stop"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Ollama {
    try {
        $null = ollama --version 2>&1
        return $true
    } catch {
        return $false
    }
}

function Test-OllamaRunning {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Install-Ollama {
    Write-Header "安装Ollama"
    
    $ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
    
    if (Test-Path $ollamaPath) {
        Write-Host "Ollama已安装在: $ollamaPath" -ForegroundColor Green
        return $true
    }
    
    Write-Host "正在下载Ollama安装程序..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "由于网络问题，请手动下载安装:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "方法1 - 官网下载:" -ForegroundColor White
    Write-Host "  访问: https://ollama.com/download" -ForegroundColor Cyan
    Write-Host "  下载Windows版本并安装" -ForegroundColor Gray
    Write-Host ""
    Write-Host "方法2 - GitHub下载:" -ForegroundColor White
    Write-Host "  访问: https://github.com/ollama/ollama/releases" -ForegroundColor Cyan
    Write-Host "  下载最新的OllamaSetup.exe" -ForegroundColor Gray
    Write-Host ""
    Write-Host "方法3 - 使用镜像(推荐国内用户):" -ForegroundColor White
    Write-Host "  访问: https://ghproxy.com/" -ForegroundColor Cyan
    Write-Host "  输入: https://github.com/ollama/ollama/releases/download/v0.5.7/OllamaSetup.exe" -ForegroundColor Gray
    Write-Host ""
    
    $download = Read-Host "是否已下载安装包? (Y/N)"
    if ($download -eq 'Y' -or $download -eq 'y') {
        $setupPath = Read-Host "请输入安装包路径 (或按Enter使用默认下载路径)"
        if (-not $setupPath) {
            $setupPath = "$env:USERPROFILE\Downloads\OllamaSetup.exe"
        }
        
        if (Test-Path $setupPath) {
            Write-Host "正在安装..." -ForegroundColor Yellow
            Start-Process -FilePath $setupPath -Wait
            Write-Host "安装完成!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "未找到安装包: $setupPath" -ForegroundColor Red
        }
    }
    
    return $false
}

function Start-Ollama {
    Write-Header "启动Ollama服务"
    
    if (-not (Test-Ollama)) {
        Write-Host "Ollama未安装" -ForegroundColor Red
        Install-Ollama
        return
    }
    
    if (Test-OllamaRunning) {
        Write-Host "Ollama服务已在运行" -ForegroundColor Green
    } else {
        Write-Host "正在启动Ollama服务..." -ForegroundColor Yellow
        Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        
        if (Test-OllamaRunning) {
            Write-Host "Ollama服务启动成功!" -ForegroundColor Green
        } else {
            Write-Host "服务启动失败，请手动运行: ollama serve" -ForegroundColor Red
            return
        }
    }
    
    if ($Model) {
        Write-Host ""
        Write-Host "正在下载模型: $Model" -ForegroundColor Yellow
        ollama pull $Model
    }
    
    Show-UsageInfo
}

function Stop-Ollama {
    Write-Header "停止Ollama服务"
    Get-Process -Name "ollama" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "Ollama服务已停止" -ForegroundColor Green
}

function Get-OllamaStatus {
    Write-Header "Ollama服务状态"
    
    if (Test-OllamaRunning) {
        Write-Host "服务状态: 运行中" -ForegroundColor Green
        Write-Host "API地址: http://localhost:11434" -ForegroundColor Cyan
        
        Write-Host ""
        Write-Host "已安装模型:" -ForegroundColor White
        ollama list
    } else {
        Write-Host "服务状态: 未运行" -ForegroundColor Yellow
        Write-Host "运行 '.\start-ollama.ps1' 启动服务" -ForegroundColor Cyan
    }
}

function Show-UsageInfo {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " 使用说明" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "API端点:" -ForegroundColor White
    Write-Host "  聊天: POST http://localhost:11434/api/chat" -ForegroundColor Gray
    Write-Host "  生成: POST http://localhost:11434/api/generate" -ForegroundColor Gray
    Write-Host "  模型: GET  http://localhost:11434/api/tags" -ForegroundColor Gray
    Write-Host ""
    Write-Host "常用命令:" -ForegroundColor White
    Write-Host "  查看状态: .\start-ollama.ps1 -Status" -ForegroundColor Gray
    Write-Host "  停止服务: .\start-ollama.ps1 -Stop" -ForegroundColor Gray
    Write-Host "  下载模型: ollama pull <model-name>" -ForegroundColor Gray
    Write-Host "  运行模型: ollama run <model-name>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "推荐中文模型:" -ForegroundColor White
    Write-Host "  qwen2.5:7b    - 通义千问7B，中文能力强 (推荐)" -ForegroundColor Gray
    Write-Host "  qwen2.5:3b    - 通义千问3B，轻量级" -ForegroundColor Gray
    Write-Host "  qwen2.5:1.5b  - 通义千问1.5B，最小版本" -ForegroundColor Gray
    Write-Host ""
    Write-Host "示例:" -ForegroundColor White
    Write-Host "  ollama pull qwen2.5:7b" -ForegroundColor Gray
    Write-Host "  ollama run qwen2.5:7b" -ForegroundColor Gray
    Write-Host ""
}

# 主逻辑
Write-Header "Ollama 本地AI服务部署工具"

if ($Install) {
    Install-Ollama
    exit 0
}

if ($Status) {
    Get-OllamaStatus
    exit 0
}

if ($Stop) {
    Stop-Ollama
    exit 0
}

Start-Ollama

<#
.SYNOPSIS
    LocalAI 一键部署启动脚本 for Windows
.DESCRIPTION
    自动检测环境、安装Docker（如需要）、启动LocalAI服务
.PARAMETER Mode
    启动模式: cpu, gpu-nvidia, gpu-amd
.PARAMETER Port
    LocalAI服务端口，默认8080
.PARAMETER Model
    预加载模型名称，如 qwen2.5-7b-instruct
.EXAMPLE
    .\start-localai.ps1 -Mode cpu
    .\start-localai.ps1 -Mode gpu-nvidia -Model qwen2.5-7b-instruct
#>

param(
    [ValidateSet("cpu", "gpu-nvidia", "gpu-amd")]
    [string]$Mode = "cpu",
    
    [int]$Port = 8080,
    
    [string]$Model = "",
    
    [switch]$Stop,
    
    [switch]$Status
)

$ErrorActionPreference = "Stop"
$ContainerName = "local-ai"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Docker {
    try {
        $null = docker --version 2>&1
        return $true
    } catch {
        return $false
    }
}

function Test-DockerRunning {
    try {
        $null = docker ps 2>&1
        return $true
    } catch {
        return $false
    }
}

function Install-Docker {
    Write-Header "检测到Docker未安装，正在安装..."
    
    $wslInstalled = wsl --status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "正在启用WSL2..." -ForegroundColor Yellow
        wsl --install --no-distribution
        Write-Host "WSL2已安装，请重启电脑后重新运行此脚本" -ForegroundColor Green
        exit 0
    }
    
    Write-Host "正在下载Docker Desktop..." -ForegroundColor Yellow
    $dockerUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
    $installerPath = "$env:TEMP\DockerDesktopInstaller.exe"
    
    Invoke-WebRequest -Uri $dockerUrl -OutFile $installerPath -UseBasicParsing
    
    Write-Host "正在安装Docker Desktop..." -ForegroundColor Yellow
    Start-Process -FilePath $installerPath -ArgumentList "install", "--quiet" -Wait
    
    Write-Host "Docker Desktop安装完成，请重启电脑后重新运行此脚本" -ForegroundColor Green
    exit 0
}

function Get-LocalAIImage {
    param([string]$Mode)
    
    switch ($Mode) {
        "gpu-nvidia" { 
            return "localai/localai:latest-gpu-nvidia-cuda-12" 
        }
        "gpu-amd" { 
            return "localai/localai:latest-gpu-hipblas" 
        }
        default { 
            return "localai/localai:latest" 
        }
    }
}

function Start-LocalAI {
    param([string]$Mode, [int]$Port, [string]$Model)
    
    $image = Get-LocalAIImage -Mode $Mode
    
    Write-Header "启动LocalAI服务"
    Write-Host "模式: $Mode" -ForegroundColor White
    Write-Host "镜像: $image" -ForegroundColor White
    Write-Host "端口: $Port" -ForegroundColor White
    
    $existingContainer = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}" 2>$null
    if ($existingContainer) {
        Write-Host "检测到已有LocalAI容器，正在移除..." -ForegroundColor Yellow
        docker rm -f $ContainerName 2>$null
    }
    
    Write-Host "正在拉取镜像 (首次运行可能需要几分钟)..." -ForegroundColor Yellow
    docker pull $image
    
    $dockerArgs = @(
        "run", "-d",
        "--name", $ContainerName,
        "-p", "${Port}:8080",
        "-v", "localai-models:/build/models",
        "-v", "localai-data:/build/data"
    )
    
    if ($Mode -eq "gpu-nvidia") {
        $dockerArgs += "--gpus"
        $dockerArgs += "all"
    } elseif ($Mode -eq "gpu-amd") {
        $dockerArgs += "--device=/dev/kfd"
        $dockerArgs += "--device=/dev/dri"
        $dockerArgs += "--group-add=video"
    }
    
    $dockerArgs += $image
    
    Write-Host "正在启动容器..." -ForegroundColor Yellow
    docker $dockerArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "LocalAI服务启动成功!" -ForegroundColor Green
        Write-Host "API地址: http://localhost:$Port" -ForegroundColor Cyan
        Write-Host "Web界面: http://localhost:$Port/ui" -ForegroundColor Cyan
        Write-Host ""
        
        if ($Model) {
            Write-Host "正在加载模型: $Model" -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            docker exec $ContainerName local-ai run $Model
        }
        
        Write-Host "等待服务就绪..." -ForegroundColor Yellow
        $maxWait = 60
        $waited = 0
        while ($waited -lt $maxWait) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 2 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Host "服务已就绪!" -ForegroundColor Green
                    break
                }
            } catch {
                Start-Sleep -Seconds 2
                $waited += 2
                Write-Host "." -NoNewline
            }
        }
        Write-Host ""
        
        Show-UsageInfo -Port $Port
    } else {
        Write-Host "启动失败，请检查Docker日志" -ForegroundColor Red
        docker logs $ContainerName
    }
}

function Stop-LocalAI {
    Write-Header "停止LocalAI服务"
    docker stop $ContainerName 2>$null
    Write-Host "LocalAI服务已停止" -ForegroundColor Green
}

function Get-LocalAIStatus {
    Write-Header "LocalAI服务状态"
    
    $container = docker ps --filter "name=$ContainerName" --format "{{.Names}} {{.Status}}" 2>$null
    if ($container) {
        Write-Host "容器状态: $container" -ForegroundColor Green
        
        try {
            $health = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 2 -UseBasicParsing
            Write-Host "健康检查: OK" -ForegroundColor Green
            
            $models = Invoke-WebRequest -Uri "http://localhost:8080/v1/models" -UseBasicParsing
            Write-Host "已加载模型:" -ForegroundColor Cyan
            Write-Host $models.Content
        } catch {
            Write-Host "服务未就绪或端口未开放" -ForegroundColor Yellow
        }
    } else {
        Write-Host "LocalAI容器未运行" -ForegroundColor Yellow
        Write-Host "运行 '.\start-localai.ps1' 启动服务" -ForegroundColor Cyan
    }
}

function Show-UsageInfo {
    param([int]$Port)
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " 使用说明" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "API端点:" -ForegroundColor White
    Write-Host "  聊天: POST http://localhost:$Port/v1/chat/completions" -ForegroundColor Gray
    Write-Host "  模型: GET  http://localhost:$Port/v1/models" -ForegroundColor Gray
    Write-Host "  嵌入: POST http://localhost:$Port/v1/embeddings" -ForegroundColor Gray
    Write-Host ""
    Write-Host "常用命令:" -ForegroundColor White
    Write-Host "  查看状态: .\start-localai.ps1 -Status" -ForegroundColor Gray
    Write-Host "  停止服务: .\start-localai.ps1 -Stop" -ForegroundColor Gray
    Write-Host "  加载模型: docker exec -it local-ai local-ai run <model-name>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "推荐模型:" -ForegroundColor White
    Write-Host "  中文: qwen2.5-7b-instruct, qwen2.5-3b-instruct" -ForegroundColor Gray
    Write-Host "  英文: llama-3.2-3b-instruct, phi-3-mini" -ForegroundColor Gray
    Write-Host "  多语言: gemma-2-2b-it, mistral-7b-instruct" -ForegroundColor Gray
    Write-Host ""
}

# 主逻辑
Write-Header "LocalAI 本地AI服务部署工具"

if ($Status) {
    Get-LocalAIStatus
    exit 0
}

if ($Stop) {
    Stop-LocalAI
    exit 0
}

if (-not (Test-Docker)) {
    Install-Docker
    exit 0
}

if (-not (Test-DockerRunning)) {
    Write-Host "Docker未运行，正在启动..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "等待Docker启动..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}

Start-LocalAI -Mode $Mode -Port $Port -Model $Model

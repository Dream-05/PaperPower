<#
.SYNOPSIS
    LocalAI 模型下载管理工具
.DESCRIPTION
    下载和管理LocalAI模型
.PARAMETER Model
    模型名称或ID
.PARAMETER List
    列出推荐模型
.PARAMETER Source
    模型来源: gallery, huggingface, ollama
.EXAMPLE
    .\download-model.ps1 -List
    .\download-model.ps1 -Model qwen2.5-7b-instruct
    .\download-model.ps1 -Model huggingface://Qwen/Qwen2.5-7B-Instruct-GGUF -Source huggingface
#>

param(
    [string]$Model = "",
    
    [switch]$List,
    
    [ValidateSet("gallery", "huggingface", "ollama")]
    [string]$Source = "gallery",
    
    [switch]$Installed
)

$ContainerName = "local-ai"

$RecommendedModels = @(
    @{
        Name = "qwen2.5-7b-instruct"
        Size = "4.5GB"
        Language = "中文"
        Description = "通义千问7B，中文能力强，推荐"
        Memory = "8GB+"
    },
    @{
        Name = "qwen2.5-3b-instruct"
        Size = "2GB"
        Language = "中文"
        Description = "通义千问3B，轻量级中文模型"
        Memory = "6GB+"
    },
    @{
        Name = "qwen2.5-1.5b-instruct"
        Size = "1GB"
        Language = "中文"
        Description = "通义千问1.5B，最小中文模型"
        Memory = "4GB+"
    },
    @{
        Name = "llama-3.2-3b-instruct"
        Size = "2GB"
        Language = "英文"
        Description = "Meta Llama 3.2 3B，英文能力强"
        Memory = "6GB+"
    },
    @{
        Name = "phi-3-mini-4k-instruct"
        Size = "2.3GB"
        Language = "英文"
        Description = "微软Phi-3 Mini，小巧高效"
        Memory = "6GB+"
    },
    @{
        Name = "gemma-2-2b-it"
        Size = "1.4GB"
        Language = "多语言"
        Description = "Google Gemma 2 2B，多语言支持"
        Memory = "4GB+"
    },
    @{
        Name = "mistral-7b-instruct"
        Size = "4.3GB"
        Language = "多语言"
        Description = "Mistral 7B，性能优秀"
        Memory = "8GB+"
    }
)

function Show-ModelList {
    Write-Host ""
    Write-Host "推荐模型列表:" -ForegroundColor Cyan
    Write-Host ""
    
    $RecommendedModels | ForEach-Object {
        Write-Host "  $($_.Name)" -ForegroundColor Yellow -NoNewline
        Write-Host " [$($_.Language)] [$($_.Size)] [内存: $($_.Memory)]" -ForegroundColor Gray
        Write-Host "    $($_.Description)" -ForegroundColor White
        Write-Host ""
    }
    
    Write-Host "使用方法:" -ForegroundColor Cyan
    Write-Host "  .\download-model.ps1 -Model <模型名称>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "示例:" -ForegroundColor Cyan
    Write-Host "  .\download-model.ps1 -Model qwen2.5-7b-instruct" -ForegroundColor Gray
    Write-Host ""
}

function Show-InstalledModels {
    Write-Host ""
    Write-Host "已安装模型:" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $result = docker exec $ContainerName local-ai models list 2>&1
        Write-Host $result
    } catch {
        Write-Host "无法获取模型列表，请确保LocalAI服务正在运行" -ForegroundColor Red
        Write-Host "运行 '.\start-localai.ps1' 启动服务" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

function Download-Model {
    param([string]$Model, [string]$Source)
    
    Write-Host ""
    Write-Host "正在下载模型: $Model" -ForegroundColor Cyan
    Write-Host "来源: $Source" -ForegroundColor Gray
    Write-Host ""
    
    $containerRunning = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>$null
    
    if (-not $containerRunning) {
        Write-Host "LocalAI容器未运行，正在启动..." -ForegroundColor Yellow
        & "$PSScriptRoot\start-localai.ps1" -Mode cpu
        
        Write-Host "等待服务启动..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }
    
    $modelUrl = switch ($Source) {
        "huggingface" { "huggingface://$Model" }
        "ollama" { "ollama://$Model" }
        default { $Model }
    }
    
    Write-Host "执行下载命令..." -ForegroundColor Yellow
    docker exec -it $ContainerName local-ai run $modelUrl
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "模型下载完成!" -ForegroundColor Green
        Write-Host "测试命令: curl http://localhost:8080/v1/chat/completions -d '{\"model\": \"$Model\", \"messages\": [{\"role\": \"user\", \"content\": \"你好\"}]}'" -ForegroundColor Gray
    } else {
        Write-Host "模型下载失败" -ForegroundColor Red
    }
}

# 主逻辑
if ($List) {
    Show-ModelList
    exit 0
}

if ($Installed) {
    Show-InstalledModels
    exit 0
}

if (-not $Model) {
    Show-ModelList
    exit 0
}

Download-Model -Model $Model -Source $Source

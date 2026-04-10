$ErrorActionPreference = "Stop"

# Set output encoding to UTF-8
$OutputEncoding = [System.Text.UTF8Encoding]::new()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenClaw Gateway Startup Script" -ForegroundColor Cyan
Write-Host "  ZhiBan AI Integration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Node.js not detected. Please install Node.js 22+ first." -ForegroundColor Red
    Write-Host "Download: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "[CHECK] Node.js version: $nodeVersion" -ForegroundColor Green

# Git check skipped (not required for OpenClaw runtime)
Write-Host "[CHECK] Git check skipped (not required)" -ForegroundColor Green

$openclawInstalled = npm list -g openclaw 2>$null
if ($openclawInstalled -notmatch "openclaw@") {
    Write-Host "[INSTALL] Installing OpenClaw..." -ForegroundColor Yellow
    npm install -g openclaw@latest
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] OpenClaw installation failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "[DONE] OpenClaw installed successfully" -ForegroundColor Green
} else {
    Write-Host "[CHECK] OpenClaw is already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "[CONFIG] Checking OpenClaw configuration..." -ForegroundColor Yellow

$configPath = "$env:USERPROFILE\.openclaw\openclaw.json"
if (-not (Test-Path $configPath)) {
    Write-Host "[CONFIG] Creating default configuration..." -ForegroundColor Yellow
    
    $openclawDir = "$env:USERPROFILE\.openclaw"
    if (-not (Test-Path $openclawDir)) {
        New-Item -ItemType Directory -Path $openclawDir -Force | Out-Null
    }
    
    $defaultConfig = @{
        agent = @{
            model = "anthropic/claude-sonnet-4"
        }
        gateway = @{
            port = 18789
            bind = "127.0.0.1"
        }
    }
    
    $defaultConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding utf8
    Write-Host "[DONE] Default configuration created: $configPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "[START] Starting OpenClaw Gateway..." -ForegroundColor Yellow
Write-Host "       Port: 18789" -ForegroundColor Gray
Write-Host "       Address: ws://127.0.0.1:18789" -ForegroundColor Gray
Write-Host ""

Write-Host "[NOTE] First run requires API Key configuration:" -ForegroundColor Yellow
Write-Host "       1. Set Anthropic API Key:" -ForegroundColor Gray
Write-Host "          $env:ANTHROPIC_API_KEY = 'your-api-key'" -ForegroundColor Gray
Write-Host "       2. Or use OpenAI:" -ForegroundColor Gray
Write-Host "          $env:OPENAI_API_KEY = 'your-api-key'" -ForegroundColor Gray
Write-Host ""

Write-Host "[RUN] Executing: openclaw gateway --port 18789 --verbose" -ForegroundColor Cyan
Write-Host ""

& openclaw gateway --port 18789 --verbose
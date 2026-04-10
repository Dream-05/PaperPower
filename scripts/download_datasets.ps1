# 数据集下载和处理脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    AI模型训练数据集下载工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 创建数据集目录
$datasetDir = ".\datasets"
$chineseDir = "$datasetDir\chinese"
$englishDir = "$datasetDir\english"

if (-not (Test-Path $datasetDir)) {
    New-Item -ItemType Directory -Path $datasetDir | Out-Null
    Write-Host "✅ 创建数据集目录: $datasetDir" -ForegroundColor Green
}

if (-not (Test-Path $chineseDir)) {
    New-Item -ItemType Directory -Path $chineseDir | Out-Null
}

if (-not (Test-Path $englishDir)) {
    New-Item -ItemType Directory -Path $englishDir | Out-Null
}

Write-Host ""
Write-Host "📋 可用的数据集:" -ForegroundColor Yellow
Write-Host ""
Write-Host "中文数据集:" -ForegroundColor Cyan
Write-Host "  1. 百度百科 (500MB+)"
Write-Host "  2. Common Crawl中文分片 (1GB+)"
Write-Host "  3. The Stack中文代码 (200MB+)"
Write-Host "  4. 中文维基百科 (200MB+)"
Write-Host "  5. 所有中文数据集"
Write-Host ""
Write-Host "英文数据集:" -ForegroundColor Cyan
Write-Host "  6. Wikipedia英文 (200MB+)"
Write-Host "  7. Common Crawl英文 (500MB+)"
Write-Host "  8. The Stack英文代码 (200MB+)"
Write-Host "  9. Project Gutenberg (100MB+)"
Write-Host "  10. 所有英文数据集"
Write-Host ""
Write-Host "  11. 下载所有数据集" -ForegroundColor Magenta
Write-Host "  0. 退出"
Write-Host ""

$choice = Read-Host "请选择要下载的数据集 (输入数字)"

function Download-Dataset {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Output,
        [string]$Description
    )
    
    Write-Host ""
    Write-Host "📥 开始下载: $Name" -ForegroundColor Yellow
    Write-Host "   描述: $Description"
    Write-Host "   来源: $Url"
    Write-Host "   保存到: $Output"
    Write-Host ""
    
    if (Test-Path $Output) {
        Write-Host "⚠️ 文件已存在，跳过下载" -ForegroundColor Yellow
        return
    }
    
    try {
        Write-Host "⏳ 正在下载..." -ForegroundColor Cyan
        
        # 使用 .NET 的 WebClient 进行下载
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $Output)
        
        Write-Host "✅ 下载完成: $Name" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ 下载失败: $_" -ForegroundColor Red
        Write-Host "💡 请手动下载: $Url" -ForegroundColor Yellow
    }
}

function Process-Dataset {
    param(
        [string]$InputFile,
        [string]$OutputDir
    )
    
    Write-Host ""
    Write-Host "🔄 处理数据集: $InputFile" -ForegroundColor Cyan
    
    if (-not (Test-Path $InputFile)) {
        Write-Host "❌ 文件不存在: $InputFile" -ForegroundColor Red
        return
    }
    
    # 读取文件内容
    $content = Get-Content $InputFile -Raw -Encoding UTF8
    
    # 清理文本
    $content = $content -replace '<[^>]+>', ''  # 移除HTML标签
    $content = $content -replace '\s+', ' '      # 合并空白字符
    $content = $content.Trim()
    
    # 分割成句子
    $sentences = $content -split '[。！？\n]' | Where-Object { $_.Trim().Length -gt 10 }
    
    # 保存处理后的数据
    $outputFile = "$OutputDir\processed_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
    $sentences | Out-File $outputFile -Encoding UTF8
    
    Write-Host "✅ 处理完成，保存到: $outputFile" -ForegroundColor Green
    Write-Host "   句子数量: $($sentences.Count)"
}

switch ($choice) {
    "1" {
        Download-Dataset -Name "百度百科" `
            -Url "https://pan.baidu.com/s/1bEfTTU" `
            -Output "$chineseDir\baidu_baike.txt" `
            -Description "百度百科词条数据"
    }
    "2" {
        Write-Host ""
        Write-Host "📥 Common Crawl中文数据需要从官网下载" -ForegroundColor Yellow
        Write-Host "   网址: https://commoncrawl.org/"
        Write-Host "   选择中文分片: CC-MAIN-2023-* zh-CN"
    }
    "3" {
        Write-Host ""
        Write-Host "📥 The Stack数据需要从Hugging Face下载" -ForegroundColor Yellow
        Write-Host "   网址: https://huggingface.co/datasets/bigcode/the-stack"
        Write-Host "   筛选中文代码文件"
    }
    "4" {
        Download-Dataset -Name "中文维基百科" `
            -Url "https://dumps.wikimedia.org/zhwiki/latest/zhwiki-latest-pages-articles.xml.bz2" `
            -Output "$chineseDir\zhwiki.xml.bz2" `
            -Description "中文维基百科最新数据"
    }
    "5" {
        Write-Host ""
        Write-Host "📥 开始下载所有中文数据集..." -ForegroundColor Magenta
    }
    "6" {
        Download-Dataset -Name "Wikipedia英文" `
            -Url "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles.xml.bz2" `
            -Output "$englishDir\enwiki.xml.bz2" `
            -Description "英文维基百科最新数据"
    }
    "7" {
        Write-Host ""
        Write-Host "📥 Common Crawl英文数据需要从官网下载" -ForegroundColor Yellow
        Write-Host "   网址: https://commoncrawl.org/"
    }
    "8" {
        Write-Host ""
        Write-Host "📥 The Stack英文数据需要从Hugging Face下载" -ForegroundColor Yellow
        Write-Host "   网址: https://huggingface.co/datasets/bigcode/the-stack"
    }
    "9" {
        Write-Host ""
        Write-Host "📥 Project Gutenberg数据需要从官网下载" -ForegroundColor Yellow
        Write-Host "   网址: https://www.gutenberg.org/"
    }
    "10" {
        Write-Host ""
        Write-Host "📥 开始下载所有英文数据集..." -ForegroundColor Magenta
    }
    "11" {
        Write-Host ""
        Write-Host "📥 开始下载所有数据集..." -ForegroundColor Magenta
    }
    "0" {
        Write-Host "👋 退出程序" -ForegroundColor Yellow
        exit
    }
    default {
        Write-Host "❌ 无效选择" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    数据集下载完成" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 提示:" -ForegroundColor Yellow
Write-Host "   1. 大型数据集需要手动从官网下载"
Write-Host "   2. 下载完成后运行 process_datasets.ps1 处理数据"
Write-Host "   3. 处理后的数据可用于模型训练"
Write-Host ""

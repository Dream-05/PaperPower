#!/usr/bin/env pwsh

# 设置输出编码为 UTF-8
$OutputEncoding = [System.Text.UTF8Encoding]::new()

# 数据目录
$DATA_DIR = "data/training"
$PROCESSED_DIR = "data/processed"

# 创建处理目录
New-Item -ItemType Directory -Path $PROCESSED_DIR -Force | Out-Null

Write-Host "开始预处理训练数据..."

# 1. 处理百度百科数据
Write-Host "1. 处理百度百科数据..."
try {
    $baikeFiles = Get-ChildItem "$DATA_DIR/baike" -File
    foreach ($file in $baikeFiles) {
        if ($file.Extension -eq ".txt") {
            $content = Get-Content $file.FullName -Encoding UTF8 -Raw
            # 清理文本
            $cleaned = $content -replace '\s+', ' ' -replace '[^\p{Han}\p{Latin}\s]', ''
            # 保存处理后的数据
            $outputFile = "$PROCESSED_DIR/baike_processed.txt"
            $cleaned | Out-File $outputFile -Encoding UTF8 -Append
            Write-Host "处理完成: $($file.Name)"
        }
    }
} catch {
    Write-Host "百度百科数据处理失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. 处理 Common Crawl 数据
Write-Host "2. 处理 Common Crawl 数据..."
try {
    $commonCrawlFiles = Get-ChildItem "$DATA_DIR/common_crawl" -File
    foreach ($file in $commonCrawlFiles) {
        if ($file.Extension -eq ".txt") {
            $content = Get-Content $file.FullName -Encoding UTF8 -Raw
            # 清理文本
            $cleaned = $content -replace '\s+', ' ' -replace '[^\p{Latin}\s]', ''
            # 保存处理后的数据
            $outputFile = "$PROCESSED_DIR/common_crawl_processed.txt"
            $cleaned | Out-File $outputFile -Encoding UTF8 -Append
            Write-Host "处理完成: $($file.Name)"
        }
    }
} catch {
    Write-Host "Common Crawl 数据处理失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. 处理 The Stack 代码数据
Write-Host "3. 处理 The Stack 代码数据..."
try {
    $stackFiles = Get-ChildItem "$DATA_DIR/the_stack" -File
    foreach ($file in $stackFiles) {
        if ($file.Extension -eq ".jsonl") {
            $content = Get-Content $file.FullName -Encoding UTF8
            # 清理和提取代码内容
            $processed = @()
            foreach ($line in $content) {
                if ($line.Trim()) {
                    try {
                        $json = $line | ConvertFrom-Json
                        if ($json.content) {
                            $cleaned = $json.content -replace '\s+', ' ' -replace '[^\p{Latin}\p{Han}\d\s\w\p{P}]', ''
                            $processed += $cleaned
                        }
                    } catch {
                        # 跳过无效的 JSON 行
                    }
                }
            }
            # 保存处理后的数据
            $outputFile = "$PROCESSED_DIR/the_stack_processed.txt"
            $processed -join "`n" | Out-File $outputFile -Encoding UTF8 -Append
            Write-Host "处理完成: $($file.Name)"
        }
    }
} catch {
    Write-Host "The Stack 数据处理失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. 处理书籍文本数据
Write-Host "4. 处理书籍文本数据..."
try {
    $booksFiles = Get-ChildItem "$DATA_DIR/books" -File
    foreach ($file in $booksFiles) {
        if ($file.Extension -eq ".txt") {
            $content = Get-Content $file.FullName -Encoding UTF8 -Raw
            # 清理文本
            $cleaned = $content -replace '\s+', ' ' -replace '[^\p{Latin}\p{Han}\s]', ''
            # 保存处理后的数据
            $outputFile = "$PROCESSED_DIR/books_processed.txt"
            $cleaned | Out-File $outputFile -Encoding UTF8 -Append
            Write-Host "处理完成: $($file.Name)"
        }
    }
} catch {
    Write-Host "书籍文本数据处理失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. 处理学术论文数据
Write-Host "5. 处理学术论文数据..."
try {
    $papersFiles = Get-ChildItem "$DATA_DIR/papers" -File
    foreach ($file in $papersFiles) {
        if ($file.Extension -eq ".txt") {
            $content = Get-Content $file.FullName -Encoding UTF8 -Raw
            # 清理文本
            $cleaned = $content -replace '\s+', ' ' -replace '[^\p{Latin}\p{Han}\s]', ''
            # 保存处理后的数据
            $outputFile = "$PROCESSED_DIR/papers_processed.txt"
            $cleaned | Out-File $outputFile -Encoding UTF8 -Append
            Write-Host "处理完成: $($file.Name)"
        }
    }
} catch {
    Write-Host "学术论文数据处理失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. 合并所有处理后的数据
Write-Host "6. 合并所有处理后的数据..."
try {
    $processedFiles = Get-ChildItem "$PROCESSED_DIR" -File
    $allContent = @()
    foreach ($file in $processedFiles) {
        if ($file.Extension -eq ".txt") {
            $content = Get-Content $file.FullName -Encoding UTF8
            $allContent += $content
        }
    }
    # 保存合并后的数据
    $outputFile = "$PROCESSED_DIR/combined_training_data.txt"
    $allContent -join "`n" | Out-File $outputFile -Encoding UTF8
    Write-Host "合并完成，总数据量: $($allContent.Length) 行"
} catch {
    Write-Host "数据合并失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""n所有数据预处理完成！""n" -ForegroundColor Green
Write-Host "处理后的数据存储在: $PROCESSED_DIR"
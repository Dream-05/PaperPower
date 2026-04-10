import { auditLogger } from './compliance'

export interface AnalysisResult {
  type: 'statistics' | 'trend' | 'comparison' | 'correlation' | 'distribution'
  title: string
  summary: string
  insights: string[]
  data?: Record<string, unknown>[]
  auditId: string
}

export interface SummaryResult {
  originalLength: number
  summaryLength: number
  summary: string
  keyPoints: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
  auditId: string
}

export interface TextProcessResult {
  operation: string
  input: string
  output: string
  changes: string[]
  auditId: string
}

export class AIProcessor {
  private static instance: AIProcessor
  
  private constructor() {}
  
  static getInstance(): AIProcessor {
    if (!AIProcessor.instance) {
      AIProcessor.instance = new AIProcessor()
    }
    return AIProcessor.instance
  }
  
  analyzeData(data: Record<string, unknown>[], columns?: string[]): AnalysisResult {
    const insights: string[] = []
    const columnList = columns || (data.length > 0 ? Object.keys(data[0]) : [])
    
    const numericColumns = columnList.filter(col => {
      return data.some(row => typeof row[col] === 'number')
    })
    
    if (numericColumns.length > 0) {
      numericColumns.forEach(col => {
        const values = data.map(row => row[col] as number).filter(v => !isNaN(v))
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0)
          const avg = sum / values.length
          const max = Math.max(...values)
          const min = Math.min(...values)
          
          insights.push(`${col}: 平均值 ${avg.toFixed(2)}, 最大值 ${max}, 最小值 ${min}`)
        }
      })
    }
    
    const textColumns = columnList.filter(col => {
      return data.some(row => typeof row[col] === 'string')
    })
    
    if (textColumns.length > 0) {
      textColumns.forEach(col => {
        const uniqueValues = new Set(data.map(row => row[col]))
        if (uniqueValues.size < data.length * 0.5) {
          insights.push(`${col}: 共 ${uniqueValues.size} 个不同值`)
        }
      })
    }
    
    const auditLog = auditLogger.createAuditLog(
      { rowCount: data.length, columnCount: columnList.length },
      [{
        step: 1,
        operation: 'data_analysis',
        method: 'deterministic_statistics',
        input: { rows: data.length, columns: columnList },
        output: { insights: insights.length },
        evidence: 'analysis_complete'
      }],
      { success: true }
    )
    
    return {
      type: 'statistics',
      title: '数据分析报告',
      summary: `分析了 ${data.length} 行数据，共 ${columnList.length} 列`,
      insights,
      data,
      auditId: auditLog.auditId
    }
  }
  
  generateSummary(text: string, maxLength: number = 200): SummaryResult {
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0)
    const originalLength = text.length
    
    const keySentences: string[] = []
    let currentLength = 0
    
    const scoredSentences = sentences.map(sentence => {
      const words = sentence.split(/\s+/)
      const uniqueWords = new Set(words)
      const score = uniqueWords.size / Math.max(words.length, 1)
      return { sentence, score, length: sentence.length }
    })
    
    scoredSentences.sort((a, b) => b.score - a.score)
    
    for (const item of scoredSentences) {
      if (currentLength + item.length <= maxLength) {
        keySentences.push(item.sentence.trim())
        currentLength += item.length
      }
    }
    
    const summary = keySentences.join('。')
    const summaryLength = summary.length
    
    const keyPoints: string[] = []
    const words = text.split(/\s+/)
    const wordFreq: Record<string, number> = {}
    
    words.forEach(word => {
      if (word.length >= 2) {
        wordFreq[word] = (wordFreq[word] || 0) + 1
      }
    })
    
    const sortedWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    
    sortedWords.forEach(([word, count]) => {
      keyPoints.push(`${word} (出现${count}次)`)
    })
    
    const positiveWords = ['好', '优秀', '成功', '进步', '增长', '提高', '改善', '优化']
    const negativeWords = ['差', '失败', '下降', '问题', '错误', '风险', '损失', '困难']
    
    let positiveCount = 0
    let negativeCount = 0
    
    positiveWords.forEach(word => {
      const matches = text.match(new RegExp(word, 'g'))
      if (matches) positiveCount += matches.length
    })
    
    negativeWords.forEach(word => {
      const matches = text.match(new RegExp(word, 'g'))
      if (matches) negativeCount += matches.length
    })
    
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
    if (positiveCount > negativeCount * 1.5) {
      sentiment = 'positive'
    } else if (negativeCount > positiveCount * 1.5) {
      sentiment = 'negative'
    }
    
    const auditLog = auditLogger.createAuditLog(
      { originalLength, summaryLength, sentiment },
      [{
        step: 1,
        operation: 'text_summarization',
        method: 'extractive_summary',
        input: { textLength: originalLength },
        output: { summaryLength, keyPointsCount: keyPoints.length },
        evidence: 'summary_generated'
      }],
      { success: true }
    )
    
    return {
      originalLength,
      summaryLength,
      summary,
      keyPoints,
      sentiment,
      auditId: auditLog.auditId
    }
  }
  
  processText(text: string, operation: string, params: Record<string, unknown> = {}): TextProcessResult {
    let output = text
    const changes: string[] = []
    
    switch (operation) {
      case 'trim':
        output = text.trim()
        changes.push('去除首尾空白')
        break
        
      case 'normalize':
        output = text.replace(/\s+/g, ' ').trim()
        changes.push('规范化空白字符')
        break
        
      case 'removeEmptyLines':
        output = text.split('\n').filter(line => line.trim()).join('\n')
        changes.push('删除空行')
        break
        
      case 'toLowercase':
        output = text.toLowerCase()
        changes.push('转换为小写')
        break
        
      case 'toUppercase':
        output = text.toUpperCase()
        changes.push('转换为大写')
        break
        
      case 'capitalize':
        output = text.charAt(0).toUpperCase() + text.slice(1)
        changes.push('首字母大写')
        break
        
      case 'removePunctuation':
        output = text.replace(/[，。！？、；：""''（）【】《》]/g, '')
        changes.push('删除标点符号')
        break
        
      case 'extractNumbers':
        const numbers = text.match(/-?\d+\.?\d*/g) || []
        output = numbers.join('\n')
        changes.push(`提取了 ${numbers.length} 个数字`)
        break
        
      case 'extractUrls':
        const urls = text.match(/https?:\/\/[^\s]+/g) || []
        output = urls.join('\n')
        changes.push(`提取了 ${urls.length} 个URL`)
        break
        
      case 'extractEmails':
        const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g) || []
        output = emails.join('\n')
        changes.push(`提取了 ${emails.length} 个邮箱`)
        break
        
      case 'removeDuplicates':
        const lines = text.split('\n')
        const uniqueLines = [...new Set(lines)]
        output = uniqueLines.join('\n')
        changes.push(`删除了 ${lines.length - uniqueLines.length} 个重复行`)
        break
        
      case 'sortLines':
        const sortedLines = text.split('\n').sort((a, b) => a.localeCompare(b, 'zh-CN'))
        output = sortedLines.join('\n')
        changes.push('按行排序')
        break
        
      case 'reverseLines':
        const reversedLines = text.split('\n').reverse()
        output = reversedLines.join('\n')
        changes.push('反转行顺序')
        break
        
      case 'numberLines':
        const numberedLines = text.split('\n').map((line, i) => `${i + 1}. ${line}`)
        output = numberedLines.join('\n')
        changes.push('添加行号')
        break
        
      case 'replace':
        const from = params.from as string || ''
        const to = params.to as string || ''
        const count = (text.match(new RegExp(from, 'g')) || []).length
        output = text.split(from).join(to)
        changes.push(`替换了 ${count} 处 "${from}" 为 "${to}"`)
        break
        
      default:
        changes.push(`未知操作: ${operation}`)
    }
    
    const auditLog = auditLogger.createAuditLog(
      { operation, inputLength: text.length, outputLength: output.length },
      [{
        step: 1,
        operation: 'text_processing',
        method: 'deterministic_transform',
        input: { operation, textLength: text.length },
        output: { outputLength: output.length, changesCount: changes.length },
        evidence: changes.join('; ')
      }],
      { success: true }
    )
    
    return {
      operation,
      input: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      output,
      changes,
      auditId: auditLog.auditId
    }
  }
  
  suggestNextAction(context: {
    fileType?: string
    contentLength?: number
    hasData?: boolean
    hasImages?: boolean
    recentActions?: string[]
  }): string[] {
    const suggestions: string[] = []
    
    if (context.fileType === 'word' || context.fileType === 'docx') {
      suggestions.push('一键格式化文档')
      suggestions.push('检查格式问题')
      suggestions.push('生成文档摘要')
      suggestions.push('润色文本内容')
    }
    
    if (context.fileType === 'excel' || context.fileType === 'xlsx') {
      suggestions.push('分析数据趋势')
      suggestions.push('生成统计报告')
      suggestions.push('创建数据图表')
      suggestions.push('数据透视分析')
    }
    
    if (context.fileType === 'ppt' || context.fileType === 'pptx') {
      suggestions.push('一键美化幻灯片')
      suggestions.push('添加动画效果')
      suggestions.push('统一设计风格')
      suggestions.push('生成演讲备注')
    }
    
    if (context.hasData) {
      suggestions.push('数据可视化')
      suggestions.push('数据对比分析')
      suggestions.push('异常值检测')
    }
    
    if (context.contentLength && context.contentLength > 1000) {
      suggestions.push('生成长文档摘要')
      suggestions.push('提取关键信息')
      suggestions.push('创建目录大纲')
    }
    
    suggestions.push('导出为PDF')
    suggestions.push('分享文档链接')
    
    return suggestions.slice(0, 5)
  }
  
  parseNaturalLanguageCommand(input: string): { operation: string; params: Record<string, unknown> } | null {
    const lowerInput = input.toLowerCase()
    
    if (lowerInput.includes('摘要') || lowerInput.includes('总结')) {
      return { operation: 'summarize', params: {} }
    }
    
    if (lowerInput.includes('分析') || lowerInput.includes('统计')) {
      return { operation: 'analyze', params: {} }
    }
    
    if (lowerInput.includes('格式化') || lowerInput.includes('排版')) {
      return { operation: 'format', params: {} }
    }
    
    if (lowerInput.includes('润色') || lowerInput.includes('优化')) {
      return { operation: 'polish', params: {} }
    }
    
    if (lowerInput.includes('翻译')) {
      const langMatch = input.match(/翻译[为成]?(英语|英文|中文|日语|韩语)/)
      return { 
        operation: 'translate', 
        params: { targetLang: langMatch ? langMatch[1] : '英语' }
      }
    }
    
    if (lowerInput.includes('替换')) {
      const matches = input.match(/["「『]([^"」』]+)["」』]/g)
      if (matches && matches.length >= 2) {
        return {
          operation: 'replace',
          params: {
            from: matches[0].replace(/["「』」]/g, ''),
            to: matches[1].replace(/["「』」]/g, '')
          }
        }
      }
    }
    
    if (lowerInput.includes('删除') && lowerInput.includes('空行')) {
      return { operation: 'removeEmptyLines', params: {} }
    }
    
    if (lowerInput.includes('排序')) {
      return { operation: 'sortLines', params: {} }
    }
    
    if (lowerInput.includes('行号')) {
      return { operation: 'numberLines', params: {} }
    }
    
    return null
  }
}

export const aiProcessor = AIProcessor.getInstance()

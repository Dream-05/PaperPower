import { TextProcessor } from '../localAI/UTF8_ENCODER'

export interface DocumentElement {
  id: string
  type: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6' | 'paragraph' | 'image' | 'table' | 'list' | 'quote' | 'code' | 'unknown'
  content: string
  startIndex: number
  endIndex: number
  level?: number
  currentFormat: ElementFormat
  suggestedFormat?: ElementFormat
  issues: FormatIssue[]
  confidence: number
}

export interface ElementFormat {
  fontFamily?: string
  fontSize?: number
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  alignment?: 'left' | 'center' | 'right' | 'justify'
  lineSpacing?: number
  indent?: number
}

export interface FormatIssue {
  type: 'wrong_heading_level' | 'inconsistent_style' | 'missing_format' | 'misformatted' | 'inconsistent_alignment'
  severity: 'high' | 'medium' | 'low'
  description: string
  suggestion: string
  autoFixable: boolean
}

export interface DocumentAnalysisResult {
  elements: DocumentElement[]
  statistics: {
    totalElements: number
    headings: number
    paragraphs: number
    images: number
    tables: number
    issues: number
    estimatedReadingTime: number
  }
  structure: DocumentStructure
  formatIssues: FormatIssue[]
  suggestions: string[]
}

export interface DocumentStructure {
  outline: OutlineItem[]
  headingHierarchy: Map<number, number>
  averageParagraphLength: number
  imageCount: number
  tableCount: number
}

export interface OutlineItem {
  level: number
  text: string
  index: number
  children: OutlineItem[]
}

export class DocumentAnalyzer {
  private static headingPatterns = [
    { regex: /^#{1}\s+.+$/gm, level: 1, type: 'heading1' as const },
    { regex: /^#{2}\s+.+$/gm, level: 2, type: 'heading2' as const },
    { regex: /^#{3}\s+.+$/gm, level: 3, type: 'heading3' as const },
    { regex: /^#{4}\s+.+$/gm, level: 4, type: 'heading4' as const },
    { regex: /^#{5}\s+.+$/gm, level: 5, type: 'heading5' as const },
    { regex: /^#{6}\s+.+$/gm, level: 6, type: 'heading6' as const },
  ]

  private static chineseHeadingPatterns = [
    { regex: /第[一二三四五六七八九十]+[章节部分]/g, level: 1, type: 'heading1' as const },
    { regex: /[一二三四五六七八九十]+、[^。！？\n]+/g, level: 2, type: 'heading2' as const },
    { regex: /（[一二三四五六七八九十]+）[^。！？\n]+/g, level: 3, type: 'heading3' as const },
    { regex: /\d+\.[^。！？\n]+/g, level: 2, type: 'heading2' as const },
    { regex: /\d+\.\d+[^。！？\n]+/g, level: 3, type: 'heading3' as const },
    { regex: /\d+\.\d+\.\d+[^。！？\n]+/g, level: 4, type: 'heading4' as const },
  ]

  private static stylePatterns = {
    bold: [/\*\*[^*]+\*\*/g, /__[^_]+__/g, /<b>[^<]+<\/b>/gi, /<strong>[^<]+<\/strong>/gi],
    italic: [/\*[^*]+\*/g, /_[^_]+_/g, /<i>[^<]+<\/i>/gi, /<em>[^<]+<\/em>/gi],
    underline: [/<u>[^<]+<\/u>/gi, /__[^_]+__/g],
    heading: [/<h[1-6][^>]*>[^<]+<\/h[1-6]>/gi],
    paragraph: [/<p[^>]*>[^<]+<\/p>/gi],
    image: [/<img[^>]*>/gi, /!\[[^\]]*\]\([^)]+\)/g],
    table: [/<table[^>]*>[\s\S]*?<\/table>/gi],
    list: [/<[ou]l[^>]*>[\s\S]*?<\/[ou]l>/gi, /^[-*+]\s+.+$/gm, /^\d+\.\s+.+$/gm],
    quote: [/^>\s+.+$/gm, /<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi],
    code: [/```[\s\S]*?```/g, /`[^`]+`/g, /<code[^>]*>[\s\S]*?<\/code>/gi],
  }

  static analyze(content: string): DocumentAnalysisResult {
    const elements = this.extractElements(content)
    const structure = this.analyzeStructure(elements)
    const issues = this.detectIssues(elements)
    const statistics = this.calculateStatistics(elements, content)
    const suggestions = this.generateSuggestions(elements, issues)

    return {
      elements,
      statistics,
      structure,
      formatIssues: issues,
      suggestions
    }
  }

  private static extractElements(content: string): DocumentElement[] {
    const elements: DocumentElement[] = []
    let elementId = 0

    const lines = content.split('\n')
    let currentIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineStart = currentIndex
      const lineEnd = currentIndex + line.length

      if (line.trim().length === 0) {
        currentIndex = lineEnd + 1
        continue
      }

      const element = this.identifyElement(line, lineStart, lineEnd, elementId++)
      if (element) {
        elements.push(element)
      }

      currentIndex = lineEnd + 1
    }

    return this.mergeConsecutiveElements(elements)
  }

  private static identifyElement(line: string, start: number, end: number, id: number): DocumentElement | null {
    for (const { regex, level, type } of this.headingPatterns) {
      if (regex.test(line)) {
        return {
          id: `elem-${id}`,
          type,
          content: line.replace(/^#+\s*/, ''),
          startIndex: start,
          endIndex: end,
          level,
          currentFormat: this.extractFormat(line),
          issues: [],
          confidence: 0.95
        }
      }
    }

    for (const { regex, level, type } of this.chineseHeadingPatterns) {
      if (regex.test(line)) {
        return {
          id: `elem-${id}`,
          type,
          content: line,
          startIndex: start,
          endIndex: end,
          level,
          currentFormat: this.extractFormat(line),
          issues: [],
          confidence: 0.85
        }
      }
    }

    if (this.stylePatterns.image.some(p => p.test(line))) {
      return {
        id: `elem-${id}`,
        type: 'image',
        content: line,
        startIndex: start,
        endIndex: end,
        currentFormat: this.extractFormat(line),
        issues: [],
        confidence: 0.95
      }
    }

    if (this.stylePatterns.table.some(p => p.test(line))) {
      return {
        id: `elem-${id}`,
        type: 'table',
        content: line,
        startIndex: start,
        endIndex: end,
        currentFormat: this.extractFormat(line),
        issues: [],
        confidence: 0.95
      }
    }

    if (this.stylePatterns.list.some(p => p.test(line))) {
      return {
        id: `elem-${id}`,
        type: 'list',
        content: line,
        startIndex: start,
        endIndex: end,
        currentFormat: this.extractFormat(line),
        issues: [],
        confidence: 0.9
      }
    }

    if (this.stylePatterns.quote.some(p => p.test(line))) {
      return {
        id: `elem-${id}`,
        type: 'quote',
        content: line,
        startIndex: start,
        endIndex: end,
        currentFormat: this.extractFormat(line),
        issues: [],
        confidence: 0.9
      }
    }

    if (this.stylePatterns.code.some(p => p.test(line))) {
      return {
        id: `elem-${id}`,
        type: 'code',
        content: line,
        startIndex: start,
        endIndex: end,
        currentFormat: this.extractFormat(line),
        issues: [],
        confidence: 0.95
      }
    }

    if (line.length > 0) {
      const isLikelyHeading = this.isLikelyHeading(line)
      return {
        id: `elem-${id}`,
        type: isLikelyHeading ? 'heading1' : 'paragraph',
        content: line,
        startIndex: start,
        endIndex: end,
        level: isLikelyHeading ? 1 : undefined,
        currentFormat: this.extractFormat(line),
        issues: [],
        confidence: isLikelyHeading ? 0.6 : 0.8
      }
    }

    return null
  }

  private static isLikelyHeading(line: string): boolean {
    const trimmed = line.trim()
    
    if (trimmed.length < 50 && !trimmed.endsWith('。') && !trimmed.endsWith('！') && !trimmed.endsWith('？')) {
      const hasHeadingIndicators = 
        /^[一二三四五六七八九十]+[、.．]/.test(trimmed) ||
        /^第[一二三四五六七八九十\d]+[章节部分条]/.test(trimmed) ||
        /^[（(][一二三四五六七八九十\d]+[)）]/.test(trimmed) ||
        /^\d+[、.．]\s/.test(trimmed) ||
        /^[A-Z][^.!?]*$/.test(trimmed)
      
      if (hasHeadingIndicators) return true
    }
    
    return false
  }

  private static extractFormat(text: string): ElementFormat {
    const format: ElementFormat = {}

    if (this.stylePatterns.bold.some(p => p.test(text))) {
      format.bold = true
    }
    if (this.stylePatterns.italic.some(p => p.test(text))) {
      format.italic = true
    }
    if (this.stylePatterns.underline.some(p => p.test(text))) {
      format.underline = true
    }

    const fontSizeMatch = text.match(/font-size:\s*(\d+(?:\.\d+)?)(px|pt|em|rem)/i)
    if (fontSizeMatch) {
      format.fontSize = parseFloat(fontSizeMatch[1])
    }

    const fontFamilyMatch = text.match(/font-family:\s*([^;]+)/i)
    if (fontFamilyMatch) {
      format.fontFamily = fontFamilyMatch[1].trim()
    }

    const colorMatch = text.match(/(?:color|text-color):\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))/i)
    if (colorMatch) {
      format.color = colorMatch[1]
    }

    const alignMatch = text.match(/text-align:\s*(left|center|right|justify)/i)
    if (alignMatch) {
      format.alignment = alignMatch[1] as ElementFormat['alignment']
    }

    return format
  }

  private static mergeConsecutiveElements(elements: DocumentElement[]): DocumentElement[] {
    const merged: DocumentElement[] = []
    let current: DocumentElement | null = null

    for (const element of elements) {
      if (current && current.type === element.type && element.type === 'paragraph') {
        current.content += '\n' + element.content
        current.endIndex = element.endIndex
      } else {
        if (current) {
          merged.push(current)
        }
        current = { ...element }
      }
    }

    if (current) {
      merged.push(current)
    }

    return merged
  }

  private static analyzeStructure(elements: DocumentElement[]): DocumentStructure {
    const outline: OutlineItem[] = []
    const headingHierarchy = new Map<number, number>()
    let imageCount = 0
    let tableCount = 0
    let totalParagraphLength = 0
    let paragraphCount = 0

    const headingStack: OutlineItem[] = []

    for (const element of elements) {
      if (element.type.startsWith('heading')) {
        const level = element.level || parseInt(element.type.replace('heading', ''))
        headingHierarchy.set(level, (headingHierarchy.get(level) || 0) + 1)

        const item: OutlineItem = {
          level,
          text: element.content.slice(0, 50),
          index: elements.indexOf(element),
          children: []
        }

        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop()
        }

        if (headingStack.length > 0) {
          headingStack[headingStack.length - 1].children.push(item)
        } else {
          outline.push(item)
        }

        headingStack.push(item)
      } else if (element.type === 'paragraph') {
        totalParagraphLength += element.content.length
        paragraphCount++
      } else if (element.type === 'image') {
        imageCount++
      } else if (element.type === 'table') {
        tableCount++
      }
    }

    return {
      outline,
      headingHierarchy,
      averageParagraphLength: paragraphCount > 0 ? totalParagraphLength / paragraphCount : 0,
      imageCount,
      tableCount
    }
  }

  private static detectIssues(elements: DocumentElement[]): FormatIssue[] {
    const issues: FormatIssue[] = []

    for (const element of elements) {
      if (element.type.startsWith('heading')) {
        const level = element.level || parseInt(element.type.replace('heading', ''))
        
        if (element.content.length > 100) {
          element.issues.push({
            type: 'misformatted',
            severity: 'medium',
            description: `标题${level}内容过长，可能不是有效标题`,
            suggestion: '检查是否应为正文内容',
            autoFixable: false
          })
        }

        if (element.confidence < 0.7) {
          element.issues.push({
            type: 'wrong_heading_level',
            severity: 'high',
            description: '标题级别可能不正确',
            suggestion: '建议检查标题层级是否合理',
            autoFixable: true
          })
        }
      }

      if (element.type === 'paragraph') {
        if (element.content.length < 20 && element.currentFormat.bold) {
          element.issues.push({
            type: 'misformatted',
            severity: 'medium',
            description: '短文本被加粗，可能是误标的标题',
            suggestion: '检查是否应为标题格式',
            autoFixable: true
          })
        }
      }

      if (element.type === 'image') {
        if (!element.currentFormat.alignment || element.currentFormat.alignment !== 'center') {
          element.issues.push({
            type: 'inconsistent_alignment',
            severity: 'low',
            description: '图片未居中对齐',
            suggestion: '建议将图片设置为居中对齐',
            autoFixable: true
          })
        }
      }
    }

    for (const element of elements) {
      issues.push(...element.issues)
    }

    return issues
  }

  private static calculateStatistics(elements: DocumentElement[], content: string): DocumentAnalysisResult['statistics'] {
    const wordCount = TextProcessor.countWords(content)

    return {
      totalElements: elements.length,
      headings: elements.filter(e => e.type.startsWith('heading')).length,
      paragraphs: elements.filter(e => e.type === 'paragraph').length,
      images: elements.filter(e => e.type === 'image').length,
      tables: elements.filter(e => e.type === 'table').length,
      issues: elements.reduce((sum, e) => sum + e.issues.length, 0),
      estimatedReadingTime: Math.ceil(wordCount / 200)
    }
  }

  private static generateSuggestions(elements: DocumentElement[], issues: FormatIssue[]): string[] {
    const suggestions: string[] = []

    const headingCount = elements.filter(e => e.type.startsWith('heading')).length
    if (headingCount === 0) {
      suggestions.push('文档中没有检测到标题，建议添加标题结构')
    }

    const imageCount = elements.filter(e => e.type === 'image').length
    if (imageCount > 3) {
      suggestions.push(`文档包含 ${imageCount} 张图片，建议检查图片是否都已居中对齐`)
    }

    const highSeverityIssues = issues.filter(i => i.severity === 'high')
    if (highSeverityIssues.length > 0) {
      suggestions.push(`发现 ${highSeverityIssues.length} 个高优先级格式问题，建议优先处理`)
    }

    const autoFixableIssues = issues.filter(i => i.autoFixable)
    if (autoFixableIssues.length > 0) {
      suggestions.push(`${autoFixableIssues.length} 个问题可以自动修复`)
    }

    return suggestions
  }

  static applyFormatToElements(
    elements: DocumentElement[],
    targetType: string,
    format: Partial<ElementFormat>
  ): DocumentElement[] {
    return elements.map(element => {
      const shouldApply = 
        targetType === 'all' ||
        (targetType === 'heading' && element.type.startsWith('heading')) ||
        (targetType === 'paragraph' && element.type === 'paragraph') ||
        (targetType === 'image' && element.type === 'image') ||
        (targetType === 'table' && element.type === 'table') ||
        element.type === targetType

      if (shouldApply) {
        return {
          ...element,
          suggestedFormat: {
            ...element.currentFormat,
            ...format
          }
        }
      }

      return element
    })
  }

  static detectMisformattedContent(elements: DocumentElement[]): DocumentElement[] {
    const analyzed = [...elements]

    for (let i = 0; i < analyzed.length; i++) {
      const element = analyzed[i]

      if (element.type === 'paragraph') {
        const content = element.content.trim()
        
        if (content.length < 30 && !content.endsWith('。') && !content.endsWith('！') && !content.endsWith('？')) {
          const prevElement = i > 0 ? analyzed[i - 1] : null
          const nextElement = i < analyzed.length - 1 ? analyzed[i + 1] : null

          if (prevElement && !prevElement.type.startsWith('heading') && nextElement && nextElement.type.startsWith('heading')) {
            element.issues.push({
              type: 'misformatted',
              severity: 'high',
              description: '短文本位于标题前，可能是标题的一部分',
              suggestion: '建议检查是否应为标题',
              autoFixable: true
            })
          }
        }
      }

      if (element.type.startsWith('heading') && element.level && element.level > 4) {
        const content = element.content.trim()
        if (content.length > 100) {
          element.issues.push({
            type: 'misformatted',
            severity: 'medium',
            description: '标题级别过低且内容较长，可能是正文被误标为标题',
            suggestion: '建议检查是否应为正文',
            autoFixable: true
          })
        }
      }
    }

    return analyzed
  }
}

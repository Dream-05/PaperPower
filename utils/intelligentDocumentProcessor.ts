import { auditLogger } from './compliance'

export interface DocumentStructure {
  type: 'report' | 'letter' | 'article' | 'presentation' | 'spreadsheet' | 'unknown'
  sections: DocumentSection[]
  metadata: DocumentMetadata
  outline: DocumentOutline
  readability: ReadabilityScore
}

export interface DocumentSection {
  id: string
  type: 'title' | 'heading' | 'paragraph' | 'list' | 'table' | 'image' | 'code' | 'quote'
  level: number
  content: string
  position: { start: number; end: number }
  children: string[]
  importance: number
}

export interface DocumentMetadata {
  title: string | null
  author: string | null
  date: string | null
  keywords: string[]
  language: 'en' | 'zh' | 'mixed' | 'unknown'
  wordCount: number
  charCount: number
  paragraphCount: number
  estimatedReadTime: number
}

export interface DocumentOutline {
  items: OutlineItem[]
  maxDepth: number
}

export interface OutlineItem {
  id: string
  text: string
  level: number
  children: OutlineItem[]
}

export interface ReadabilityScore {
  score: number
  level: 'easy' | 'medium' | 'difficult' | 'very_difficult'
  suggestions: string[]
}

export interface SemanticBlock {
  id: string
  type: 'introduction' | 'body' | 'conclusion' | 'summary' | 'reference' | 'appendix'
  content: string
  confidence: number
}

export interface DocumentAnalysis {
  structure: DocumentStructure
  semantics: SemanticBlock[]
  entities: ExtractedEntity[]
  topics: string[]
  sentiment: {
    positive: number
    negative: number
    neutral: number
  }
  quality: DocumentQuality
  readability: ReadabilityScore
}

export interface ExtractedEntity {
  text: string
  type: 'person' | 'organization' | 'location' | 'date' | 'number' | 'email' | 'url' | 'phone'
  confidence: number
  position: { start: number; end: number }
}

export interface DocumentQuality {
  overall: number
  coherence: number
  clarity: number
  completeness: number
  formatting: number
  issues: QualityIssue[]
}

export interface QualityIssue {
  type: 'spelling' | 'grammar' | 'formatting' | 'structure' | 'clarity'
  message: string
  position: { start: number; end: number }
  severity: 'low' | 'medium' | 'high'
  suggestion: string
}

export class IntelligentDocumentProcessor {
  private static instance: IntelligentDocumentProcessor
  
  private headingPatterns = [
    /^(第[一二三四五六七八九十]+[章节部篇])\s*(.*)$/,
    /^([一二三四五六七八九十]+[、.．])\s*(.*)$/,
    /^(\d+[\.\、])\s*(.+)$/,
    /^(#{1,6})\s*(.+)$/,
    /^([A-Z][A-Z\s]+)$/
  ]
  
  private listPatterns = [
    /^[\-\*\+]\s+/,
    /^\d+[\.\、]\s+/,
    /^[a-z][\.\、]\s+/,
    /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/
  ]
  
  private chineseStopWords = new Set([
    '的', '了', '是', '在', '有', '和', '与', '或', '这', '那', '我', '你', '他',
    '她', '它', '们', '就', '也', '都', '而', '及', '着', '被', '把', '给', '让'
  ])
  
  private englishStopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
  ])

  private constructor() {}

  static getInstance(): IntelligentDocumentProcessor {
    if (!IntelligentDocumentProcessor.instance) {
      IntelligentDocumentProcessor.instance = new IntelligentDocumentProcessor()
    }
    return IntelligentDocumentProcessor.instance
  }

  analyze(content: string): DocumentAnalysis {
    const structure = this.analyzeStructure(content)
    const semantics = this.extractSemantics(content, structure)
    const entities = this.extractEntities(content)
    const topics = this.extractTopics(content, structure)
    const sentiment = this.analyzeSentiment(content)
    const quality = this.assessQuality(content, structure)

    auditLogger.createAuditLog(
      { contentLength: content.length, structureType: structure.type },
      [{
        step: 1,
        operation: 'document_analysis',
        method: 'intelligent_processing',
        input: { length: content.length },
        output: {
          sections: structure.sections.length,
          entities: entities.length,
          qualityScore: quality.overall
        },
        evidence: `document_type: ${structure.type}`
      }],
      { success: true }
    )

    return {
      structure,
      semantics,
      entities,
      topics,
      sentiment,
      quality,
      readability: structure.readability
    }
  }

  private analyzeStructure(content: string): DocumentStructure {
    const lines = content.split('\n')
    const sections: DocumentSection[] = []
    const outlineItems: OutlineItem[] = []
    
    let currentPosition = 0
    let docType: DocumentStructure['type'] = 'unknown'
    
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^(.+)\n[=]{3,}$/m)
    const detectedTitle = titleMatch ? titleMatch[1].trim() : null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineStart = currentPosition
      const lineEnd = currentPosition + line.length
      currentPosition = lineEnd + 1
      
      const trimmedLine = line.trim()
      if (!trimmedLine) continue
      
      const section = this.identifySection(trimmedLine, lineStart, lineEnd, i)
      if (section) {
        sections.push(section)
        
        if (section.type === 'heading') {
          outlineItems.push({
            id: section.id,
            text: section.content,
            level: section.level,
            children: []
          })
        }
      }
    }
    
    this.buildOutlineHierarchy(outlineItems)
    docType = this.detectDocumentType(sections, content)
    
    const metadata = this.extractMetadata(content, detectedTitle, sections)
    const outline = this.buildOutline(outlineItems)
    const readability = this.calculateReadability(content, sections)

    return {
      type: docType,
      sections,
      metadata,
      outline,
      readability
    }
  }

  private identifySection(
    line: string,
    start: number,
    end: number,
    _lineIndex: number
  ): DocumentSection | null {
    const id = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    
    for (const pattern of this.headingPatterns) {
      const match = line.match(pattern)
      if (match) {
        const level = this.determineHeadingLevel(line, match)
        return {
          id,
          type: 'heading',
          level,
          content: match[match.length - 1].trim(),
          position: { start, end },
          children: [],
          importance: 1 - (level * 0.15)
        }
      }
    }
    
    for (const pattern of this.listPatterns) {
      if (pattern.test(line)) {
        return {
          id,
          type: 'list',
          level: 0,
          content: line.replace(pattern, '').trim(),
          position: { start, end },
          children: [],
          importance: 0.5
        }
      }
    }
    
    if (line.startsWith('|') && line.endsWith('|')) {
      return {
        id,
        type: 'table',
        level: 0,
        content: line,
        position: { start, end },
        children: [],
        importance: 0.7
      }
    }
    
    if (line.startsWith('```') || line.startsWith('~~~')) {
      return {
        id,
        type: 'code',
        level: 0,
        content: line,
        position: { start, end },
        children: [],
        importance: 0.6
      }
    }
    
    if (line.startsWith('>')) {
      return {
        id,
        type: 'quote',
        level: 0,
        content: line.substring(1).trim(),
        position: { start, end },
        children: [],
        importance: 0.5
      }
    }
    
    if (line.length > 20) {
      return {
        id,
        type: 'paragraph',
        level: 0,
        content: line,
        position: { start, end },
        children: [],
        importance: 0.4
      }
    }
    
    return null
  }

  private determineHeadingLevel(line: string, match: RegExpMatchArray): number {
    if (match[1] && match[1].startsWith('#')) {
      return match[1].length
    }
    
    if (/^第[一二三四五六七八九十]+章/.test(line)) return 1
    if (/^第[一二三四五六七八九十]+节/.test(line)) return 2
    if (/^第[一二三四五六七八九十]+部/.test(line)) return 1
    if (/^[一二三四五六七八九十]+[、.．]/.test(line)) return 2
    if (/^\d+[\.\、]/.test(line)) return 3
    if (/^[a-z][\.\、]/.test(line)) return 4
    
    return 1
  }

  private detectDocumentType(sections: DocumentSection[], content: string): DocumentStructure['type'] {
    const headingTexts = sections
      .filter(s => s.type === 'heading')
      .map(s => s.content.toLowerCase())
    
    const hasReportIndicators = headingTexts.some(h => 
      h.includes('摘要') || h.includes('abstract') ||
      h.includes('结论') || h.includes('conclusion') ||
      h.includes('方法') || h.includes('methodology')
    )
    
    const hasLetterIndicators = /^(dear|尊敬的|致|to:|from:)/im.test(content)
    
    const hasArticleIndicators = headingTexts.length > 0 && 
      sections.filter(s => s.type === 'paragraph').length > 5
    
    if (hasReportIndicators) return 'report'
    if (hasLetterIndicators) return 'letter'
    if (hasArticleIndicators) return 'article'
    
    return 'unknown'
  }

  private extractMetadata(
    content: string,
    title: string | null,
    sections: DocumentSection[]
  ): DocumentMetadata {
    const words = content.split(/\s+/).filter(w => w.length > 0)
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = words.filter(w => /^[a-zA-Z]+$/.test(w)).length
    
    let language: DocumentMetadata['language'] = 'unknown'
    if (chineseChars > englishWords * 2) language = 'zh'
    else if (englishWords > chineseChars * 2) language = 'en'
    else if (chineseChars > 0 && englishWords > 0) language = 'mixed'
    
    const wordCount = chineseChars + englishWords
    const charCount = content.length
    const paragraphCount = sections.filter(s => s.type === 'paragraph').length
    const estimatedReadTime = Math.ceil(wordCount / 200)
    
    const keywords = this.extractKeywordsFromSections(sections)
    
    let author: string | null = null
    let date: string | null = null
    
    const authorMatch = content.match(/(?:作者|author|by)[:：]\s*(.+?)(?:\n|$)/i)
    if (authorMatch) author = authorMatch[1].trim()
    
    const dateMatch = content.match(/(?:日期|date)[:：]\s*(.+?)(?:\n|$)/i)
    if (dateMatch) date = dateMatch[1].trim()

    return {
      title,
      author,
      date,
      keywords,
      language,
      wordCount,
      charCount,
      paragraphCount,
      estimatedReadTime
    }
  }

  private extractKeywordsFromSections(sections: DocumentSection[]): string[] {
    const wordFreq: Map<string, number> = new Map()
    
    for (const section of sections) {
      const words = section.content.split(/\s+/)
      for (const word of words) {
        const lower = word.toLowerCase()
        if (!this.chineseStopWords.has(lower) && 
            !this.englishStopWords.has(lower) &&
            word.length > 1) {
          wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1)
        }
      }
    }
    
    return [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
  }

  private buildOutlineHierarchy(items: OutlineItem[]): void {
    for (let i = 0; i < items.length; i++) {
      const current = items[i]
      
      for (let j = i - 1; j >= 0; j--) {
        const prev = items[j]
        if (prev.level < current.level) {
          prev.children.push(current)
          break
        }
      }
    }
  }

  private buildOutline(items: OutlineItem[]): DocumentOutline {
    const rootItems = items.filter(item => {
      return !items.some(other => 
        other !== item && other.children.includes(item)
      )
    })
    
    const maxDepth = this.calculateMaxDepth(rootItems)
    
    return {
      items: rootItems,
      maxDepth
    }
  }

  private calculateMaxDepth(items: OutlineItem[], currentDepth: number = 1): number {
    if (items.length === 0) return currentDepth - 1
    
    let maxDepth = currentDepth
    for (const item of items) {
      const childDepth = this.calculateMaxDepth(item.children, currentDepth + 1)
      maxDepth = Math.max(maxDepth, childDepth)
    }
    
    return maxDepth
  }

  private calculateReadability(content: string, sections: DocumentSection[]): ReadabilityScore {
    const sentences = content.split(/[。！？.!?]+/).filter(s => s.trim())
    const words = content.split(/\s+/).filter(w => w.length > 0)
    
    const avgSentenceLength = words.length / Math.max(sentences.length, 1)
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1)
    
    const headingCount = sections.filter(s => s.type === 'heading').length
    const paragraphCount = sections.filter(s => s.type === 'paragraph').length
    
    let score = 100
    
    if (avgSentenceLength > 25) score -= 15
    else if (avgSentenceLength > 20) score -= 8
    
    if (avgWordLength > 7) score -= 10
    else if (avgWordLength > 5) score -= 5
    
    if (headingCount === 0 && paragraphCount > 5) score -= 15
    
    const suggestions: string[] = []
    if (avgSentenceLength > 25) {
      suggestions.push('Consider breaking long sentences into shorter ones')
    }
    if (headingCount === 0 && paragraphCount > 5) {
      suggestions.push('Add headings to improve document structure')
    }
    
    let level: ReadabilityScore['level']
    if (score >= 80) level = 'easy'
    else if (score >= 60) level = 'medium'
    else if (score >= 40) level = 'difficult'
    else level = 'very_difficult'

    return { score, level, suggestions }
  }

  private extractSemantics(_content: string, structure: DocumentStructure): SemanticBlock[] {
    const blocks: SemanticBlock[] = []
    const paragraphs = structure.sections.filter(s => s.type === 'paragraph')
    
    if (paragraphs.length === 0) return blocks
    
    const firstPara = paragraphs[0]
    blocks.push({
      id: `sem_${Date.now()}_intro`,
      type: 'introduction',
      content: firstPara.content,
      confidence: 0.8
    })
    
    if (paragraphs.length > 2) {
      const lastPara = paragraphs[paragraphs.length - 1]
      blocks.push({
        id: `sem_${Date.now()}_concl`,
        type: 'conclusion',
        content: lastPara.content,
        confidence: 0.7
      })
    }
    
    const bodyParagraphs = paragraphs.slice(1, -1)
    for (const para of bodyParagraphs) {
      blocks.push({
        id: `sem_${Date.now()}_body`,
        type: 'body',
        content: para.content,
        confidence: 0.9
      })
    }
    
    return blocks
  }

  private extractEntities(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = []
    
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    let match
    while ((match = emailPattern.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'email',
        confidence: 0.95,
        position: { start: match.index, end: match.index + match[0].length }
      })
    }
    
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
    while ((match = urlPattern.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'url',
        confidence: 0.95,
        position: { start: match.index, end: match.index + match[0].length }
      })
    }
    
    const phonePattern = /(?:\+?86[-\s]?)?1[3-9]\d{9}|(?:\+?1[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/g
    while ((match = phonePattern.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'phone',
        confidence: 0.85,
        position: { start: match.index, end: match.index + match[0].length }
      })
    }
    
    const datePattern = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?|\d{1,2}[-/]\d{1,2}[-/]\d{4}/g
    while ((match = datePattern.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'date',
        confidence: 0.8,
        position: { start: match.index, end: match.index + match[0].length }
      })
    }
    
    const numberPattern = /\b\d+(?:\.\d+)?(?:[万亿千百十]?)\b/g
    while ((match = numberPattern.exec(content)) !== null) {
      const num = parseFloat(match[0])
      if (num > 10) {
        entities.push({
          text: match[0],
          type: 'number',
          confidence: 0.7,
          position: { start: match.index, end: match.index + match[0].length }
        })
      }
    }
    
    return entities
  }

  private extractTopics(_content: string, structure: DocumentStructure): string[] {
    const topics: string[] = []
    const headings = structure.sections.filter(s => s.type === 'heading')
    
    for (const heading of headings.slice(0, 5)) {
      const words = heading.content.split(/\s+/)
      for (const word of words) {
        if (word.length > 2 && !topics.includes(word)) {
          topics.push(word)
        }
      }
    }
    
    topics.push(...structure.metadata.keywords.slice(0, 5))
    
    return [...new Set(topics)].slice(0, 10)
  }

  private analyzeSentiment(content: string): { positive: number; negative: number; neutral: number } {
    const positiveWords = new Set([
      '好', '优秀', '成功', '满意', '喜欢', '棒', '赞', '完美', '出色', '精彩',
      'good', 'great', 'excellent', 'wonderful', 'amazing', 'perfect', 'best'
    ])
    
    const negativeWords = new Set([
      '差', '糟糕', '失败', '问题', '错误', '不好', '讨厌', '难', '麻烦',
      'bad', 'poor', 'terrible', 'awful', 'worst', 'hate', 'problem', 'error'
    ])
    
    const words = content.toLowerCase().split(/\s+/)
    let positive = 0
    let negative = 0
    
    for (const word of words) {
      if (positiveWords.has(word)) positive++
      if (negativeWords.has(word)) negative++
    }
    
    const total = positive + negative || 1
    
    return {
      positive: positive / total,
      negative: negative / total,
      neutral: 1 - (positive + negative) / words.length
    }
  }

  private assessQuality(content: string, structure: DocumentStructure): DocumentQuality {
    const issues: QualityIssue[] = []
    
    const sentences = content.split(/[。！？.!?]+/).filter(s => s.trim())
    
    let coherence = 100
    let clarity = 100
    let completeness = 100
    let formatting = 100
    
    for (const sentence of sentences) {
      if (sentence.length > 100) {
        clarity -= 5
        issues.push({
          type: 'clarity',
          message: 'Very long sentence detected',
          position: { start: content.indexOf(sentence), end: content.indexOf(sentence) + sentence.length },
          severity: 'low',
          suggestion: 'Consider breaking this sentence into smaller ones'
        })
      }
    }
    
    if (structure.sections.filter(s => s.type === 'heading').length === 0) {
      formatting -= 20
      coherence -= 10
      issues.push({
        type: 'structure',
        message: 'No headings found in document',
        position: { start: 0, end: 0 },
        severity: 'medium',
        suggestion: 'Add headings to improve document structure'
      })
    }
    
    if (structure.metadata.wordCount < 100) {
      completeness -= 30
      issues.push({
        type: 'structure',
        message: 'Document appears to be very short',
        position: { start: 0, end: 0 },
        severity: 'low',
        suggestion: 'Consider adding more content'
      })
    }
    
    const doubleSpaces = (content.match(/  +/g) || []).length
    if (doubleSpaces > 5) {
      formatting -= 5
      issues.push({
        type: 'formatting',
        message: 'Multiple consecutive spaces found',
        position: { start: 0, end: 0 },
        severity: 'low',
        suggestion: 'Remove extra spaces for cleaner formatting'
      })
    }
    
    coherence = Math.max(0, coherence)
    clarity = Math.max(0, clarity)
    completeness = Math.max(0, completeness)
    formatting = Math.max(0, formatting)
    
    const overall = (coherence + clarity + completeness + formatting) / 4

    return {
      overall,
      coherence,
      clarity,
      completeness,
      formatting,
      issues
    }
  }

  suggestImprovements(analysis: DocumentAnalysis): string[] {
    const suggestions: string[] = []
    
    if (analysis.quality.overall < 70) {
      suggestions.push('Overall document quality needs improvement')
    }
    
    if (analysis.structure.sections.filter(s => s.type === 'heading').length < 3) {
      suggestions.push('Add more section headings to improve readability')
    }
    
    if (analysis.readability.level === 'difficult' || analysis.readability.level === 'very_difficult') {
      suggestions.push('Simplify language and sentence structure')
    }
    
    if (analysis.quality.issues.length > 0) {
      suggestions.push(`Address ${analysis.quality.issues.length} quality issues found`)
    }
    
    if (analysis.structure.metadata.keywords.length < 3) {
      suggestions.push('Add more descriptive keywords or topics')
    }
    
    return suggestions
  }

  generateSummary(analysis: DocumentAnalysis, maxLength: number = 200): string {
    const importantSections = analysis.structure.sections
      .filter(s => s.importance > 0.5)
      .sort((a, b) => b.importance - a.importance)
    
    const keyPoints = importantSections.slice(0, 3).map(s => s.content)
    
    let summary = keyPoints.join('. ')
    
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...'
    }
    
    return summary
  }
}

export const intelligentDocumentProcessor = IntelligentDocumentProcessor.getInstance()

export interface DocumentBlock {
  id: string
  type: 'title' | 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list' | 'table' | 'image' | 'footer' | 'header' | 'unknown'
  content: string
  level: number
  confidence: number
  position: {
    start: number
    end: number
  }
  metadata?: {
    fontSize?: number
    fontFamily?: string
    isBold?: boolean
    isItalic?: boolean
    alignment?: string
    indent?: number
  }
  children?: DocumentBlock[]
}

export interface LayoutAnalysis {
  width: number
  height: number
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
  columns: number
  hasHeader: boolean
  hasFooter: boolean
  readingDirection: 'ltr' | 'rtl' | 'ttb' | 'btt'
}

export interface DocumentStructure {
  blocks: DocumentBlock[]
  layout: LayoutAnalysis
  documentType: string
  language: string
  pageCount: number
  wordCount: number
  charCount: number
}

export interface TableStructure {
  rows: number
  cols: number
  cells: TableCell[][]
  hasHeader: boolean
  hasMergedCells: boolean
}

export interface TableCell {
  content: string
  rowSpan: number
  colSpan: number
  isHeader: boolean
}

export class DocumentLayoutAnalyzer {
  private static readonly TITLE_PATTERNS = [
    /^[一二三四五六七八九十]+[、.．]/,
    /^[（(][一二三四五六七八九十]+[)）]/,
    /^第[一二三四五六七八九十\d]+[章节条]/,
    /^[A-Z][A-Z\s]{2,30}$/,
    /^[\u4e00-\u9fa5]{2,20}$/,
  ]

  private static readonly HEADING_PATTERNS = [
    { pattern: /^第[一二三四五六七八九十\d]+章\s*.+/, level: 1 },
    { pattern: /^第[一二三四五六七八九十\d]+节\s*.+/, level: 2 },
    { pattern: /^[一二三四五六七八九十]+[、.．]\s*.+/, level: 1 },
    { pattern: /^[（(][一二三四五六七八九十]+[)）]\s*.+/, level: 2 },
    { pattern: /^\d+[、.．]\s*.+/, level: 2 },
    { pattern: /^[（(]\d+[)）]\s*.+/, level: 3 },
    { pattern: /^[a-zA-Z][、.．]\s*.+/, level: 3 },
    { pattern: /^#+\s*.+/, level: 1 },
  ]

  private static readonly LIST_PATTERNS = [
    /^[-•·○●◇◆□■]\s*/,
    /^\d+[)）]\s*/,
    /^[a-zA-Z][)）]\s*/,
    /^[-－—]\s*/,
  ]

  static analyzeDocument(html: string): DocumentStructure {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    const blocks = this.extractBlocks(doc.body)
    const layout = this.analyzeLayout(doc)
    const documentType = this.inferDocumentType(blocks)
    const language = this.detectLanguage(html)
    
    const textContent = doc.body.textContent || ''
    const wordCount = this.countWords(textContent)
    const charCount = textContent.length
    
    return {
      blocks,
      layout,
      documentType,
      language,
      pageCount: 1,
      wordCount,
      charCount
    }
  }

  static analyzeLayout(doc: Document): LayoutAnalysis {
    const body = doc.body
    const style = window.getComputedStyle(body)
    
    return {
      width: parseInt(style.width) || 800,
      height: parseInt(style.height) || 1000,
      margins: {
        top: parseInt(style.marginTop) || 25,
        bottom: parseInt(style.marginBottom) || 25,
        left: parseInt(style.marginLeft) || 25,
        right: parseInt(style.marginRight) || 25
      },
      columns: 1,
      hasHeader: this.detectHeader(doc),
      hasFooter: this.detectFooter(doc),
      readingDirection: 'ltr'
    }
  }

  private static detectHeader(doc: Document): boolean {
    const headerSelectors = ['header', '.header', '#header', 'thead']
    for (const selector of headerSelectors) {
      if (doc.querySelector(selector)) return true
    }
    return false
  }

  private static detectFooter(doc: Document): boolean {
    const footerSelectors = ['footer', '.footer', '#footer', 'tfoot']
    for (const selector of footerSelectors) {
      if (doc.querySelector(selector)) return true
    }
    return false
  }

  static extractBlocks(element: Element): DocumentBlock[] {
    const blocks: DocumentBlock[] = []
    let blockId = 0
    
    const processNode = (node: Node, depth: number = 0): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim()
        if (text && text.length > 0) {
          const parent = node.parentElement
          if (parent) {
            const block = this.createTextBlock(text, parent, blockId++, depth)
            blocks.push(block)
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element
        const tagName = el.tagName.toLowerCase()
        
        if (['table', 'img', 'figure'].includes(tagName)) {
          const block = this.createElementBlock(el, blockId++)
          if (block) blocks.push(block)
        } else if (!['script', 'style', 'noscript'].includes(tagName)) {
          for (const child of Array.from(el.childNodes)) {
            processNode(child, depth + 1)
          }
        }
      }
    }
    
    for (const child of Array.from(element.childNodes)) {
      processNode(child)
    }
    
    return this.mergeAndRefineBlocks(blocks)
  }

  private static createTextBlock(text: string, parent: Element, id: number, _depth: number): DocumentBlock {
    const type = this.classifyTextBlock(text, parent)
    const level = this.getHeadingLevel(text, parent)
    
    return {
      id: `block-${id}`,
      type,
      content: text,
      level,
      confidence: this.calculateConfidence(text, type, parent),
      position: { start: 0, end: text.length },
      metadata: {
        fontSize: this.getFontSize(parent),
        fontFamily: this.getFontFamily(parent),
        isBold: this.isBold(parent),
        isItalic: this.isItalic(parent),
        alignment: this.getAlignment(parent),
        indent: this.getIndent(parent)
      }
    }
  }

  private static createElementBlock(element: Element, id: number): DocumentBlock | null {
    const tagName = element.tagName.toLowerCase()
    
    if (tagName === 'table') {
      return {
        id: `block-${id}`,
        type: 'table',
        content: element.outerHTML,
        level: 0,
        confidence: 0.95,
        position: { start: 0, end: 0 },
        children: this.extractTableCells(element as HTMLTableElement)
      }
    }
    
    if (tagName === 'img') {
      const img = element as HTMLImageElement
      return {
        id: `block-${id}`,
        type: 'image',
        content: img.src || img.alt,
        level: 0,
        confidence: 0.95,
        position: { start: 0, end: 0 },
        metadata: {
          fontSize: 0,
          fontFamily: '',
          isBold: false,
          isItalic: false
        }
      }
    }
    
    return null
  }

  private static extractTableCells(table: HTMLTableElement): DocumentBlock[] {
    const cells: DocumentBlock[] = []
    const rows = table.querySelectorAll('tr')
    
    rows.forEach((row, rowIndex) => {
      const rowCells = row.querySelectorAll('td, th')
      rowCells.forEach((cell, colIndex) => {
        cells.push({
          id: `cell-${rowIndex}-${colIndex}`,
          type: cell.tagName.toLowerCase() === 'th' ? 'header' : 'paragraph',
          content: cell.textContent?.trim() || '',
          level: 0,
          confidence: 0.9,
          position: { start: 0, end: 0 }
        })
      })
    })
    
    return cells
  }

  private static classifyTextBlock(text: string, parent: Element): DocumentBlock['type'] {
    const tagName = parent.tagName.toLowerCase()
    
    // 首先检查AI标记（特殊字符标记）
    const aiMarker = parent.querySelector('.ai-marker')
    if (aiMarker) {
      const level = aiMarker.getAttribute('data-level')
      if (level) {
        return `heading${level}` as DocumentBlock['type']
      }
    }
    
    // 检查文本中的特殊字符标记
    if (text.includes('【H1】')) return 'heading1'
    if (text.includes('【H2】')) return 'heading2'
    if (text.includes('【H3】')) return 'heading3'
    if (text.includes('【H4】')) return 'heading3'
    if (text.includes('【H5】')) return 'heading3'
    if (text.includes('【H6】')) return 'heading3'
    
    // 首先检查HTML标签
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      return `heading${tagName[1]}` as DocumentBlock['type']
    }
    
    if (tagName === 'title') return 'title'
    if (tagName === 'header') return 'header'
    if (tagName === 'footer') return 'footer'
    if (['li', 'ul', 'ol'].includes(tagName)) return 'list'
    
    // 检查字体大小（基于样式）
    const fontSize = this.getFontSize(parent)
    if (fontSize >= 24) return 'heading1'
    if (fontSize >= 20) return 'heading2'
    if (fontSize >= 16) return 'heading3'
    if (fontSize >= 14) return 'heading3'
    
    // 检查是否加粗
    const isBold = this.isBold(parent)
    
    // 检查文本特征
    const trimmedText = text.trim()
    const isShort = trimmedText.length < 50 // 标题通常较短
    const isCentered = this.isCentered(parent)
    
    // 如果文本较短、加粗、居中，很可能是标题
    if (isShort && isBold && isCentered) {
      if (fontSize >= 18) return 'heading1'
      if (fontSize >= 16) return 'heading2'
      return 'heading3'
    }
    
    // 如果文本较短且加粗，可能是标题
    if (isShort && isBold && fontSize > 14) {
      return 'heading2'
    }
    
    // 检查标题模式
    for (const pattern of this.TITLE_PATTERNS) {
      if (pattern.test(text)) {
        return 'title'
      }
    }
    
    for (const pattern of this.HEADING_PATTERNS) {
      if (pattern.pattern.test(text)) {
        return `heading${pattern.level}` as DocumentBlock['type']
      }
    }
    
    for (const pattern of this.LIST_PATTERNS) {
      if (pattern.test(text)) {
        return 'list'
      }
    }
    
    return 'paragraph'
  }

  private static isCentered(element: Element): boolean {
    const style = element.getAttribute('style') || ''
    if (style.includes('text-align: center') || style.includes('text-align:center')) {
      return true
    }
    
    // 检查父元素
    const parent = element.parentElement
    if (parent) {
      const parentStyle = parent.getAttribute('style') || ''
      if (parentStyle.includes('text-align: center') || parentStyle.includes('text-align:center')) {
        return true
      }
    }
    
    return false
  }

  private static getHeadingLevel(text: string, parent: Element): number {
    const tagName = parent.tagName.toLowerCase()
    if (tagName.startsWith('h') && tagName.length === 2) {
      return parseInt(tagName[1])
    }
    
    for (const { pattern, level } of this.HEADING_PATTERNS) {
      if (pattern.test(text)) {
        return level
      }
    }
    
    return 0
  }

  private static calculateConfidence(_text: string, _type: DocumentBlock['type'], parent: Element): number {
    let confidence = 0.5
    
    const tagName = parent.tagName.toLowerCase()
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title', 'li'].includes(tagName)) {
      confidence += 0.3
    }
    
    if (this.isBold(parent)) confidence += 0.1
    if (this.getFontSize(parent) > 14) confidence += 0.1
    
    return Math.min(1, confidence)
  }

  private static mergeAndRefineBlocks(blocks: DocumentBlock[]): DocumentBlock[] {
    const merged: DocumentBlock[] = []
    let currentBlock: DocumentBlock | null = null
    
    for (const block of blocks) {
      if (currentBlock && currentBlock.type === block.type && block.type === 'paragraph') {
        currentBlock.content += '\n' + block.content
        currentBlock.position.end = block.position.end
      } else {
        if (currentBlock) merged.push(currentBlock)
        currentBlock = { ...block }
      }
    }
    
    if (currentBlock) merged.push(currentBlock)
    
    return merged
  }

  static inferDocumentType(blocks: DocumentBlock[]): string {
    const typeScores: Record<string, number> = {
      'official': 0,
      'academic': 0,
      'business': 0,
      'personal': 0,
      'education': 0
    }
    
    for (const block of blocks) {
      const content = block.content.toLowerCase()
      
      if (content.includes('通知') || content.includes('决定') || content.includes('公告')) {
        typeScores.official += 2
      }
      if (content.includes('摘要') || content.includes('关键词') || content.includes('参考文献')) {
        typeScores.academic += 2
      }
      if (content.includes('合同') || content.includes('协议') || content.includes('甲方') || content.includes('乙方')) {
        typeScores.business += 2
      }
      if (content.includes('简历') || content.includes('个人') || content.includes('求职')) {
        typeScores.personal += 2
      }
      if (content.includes('教学') || content.includes('课程') || content.includes('学生')) {
        typeScores.education += 2
      }
    }
    
    let maxType = 'unknown'
    let maxScore = 0
    
    for (const [type, score] of Object.entries(typeScores)) {
      if (score > maxScore) {
        maxScore = score
        maxType = type
      }
    }
    
    return maxType
  }

  static detectLanguage(text: string): string {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length
    const total = chineseChars + englishChars
    
    if (total === 0) return 'unknown'
    
    return chineseChars / total > 0.3 ? 'zh' : 'en'
  }

  private static countWords(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    return chineseChars + englishWords
  }

  private static getFontSize(element: Element): number {
    const style = window.getComputedStyle(element)
    const fontSize = style.fontSize
    return parseFloat(fontSize) || 12
  }

  private static getFontFamily(element: Element): string {
    const style = window.getComputedStyle(element)
    return style.fontFamily || 'SimSun'
  }

  private static isBold(element: Element): boolean {
    const style = window.getComputedStyle(element)
    return parseInt(style.fontWeight) >= 700 || style.fontWeight === 'bold'
  }

  private static isItalic(element: Element): boolean {
    const style = window.getComputedStyle(element)
    return style.fontStyle === 'italic'
  }

  private static getAlignment(element: Element): string {
    const style = window.getComputedStyle(element)
    return style.textAlign || 'left'
  }

  private static getIndent(element: Element): number {
    const style = window.getComputedStyle(element)
    const textIndent = style.textIndent
    return parseFloat(textIndent) || 0
  }
}

export class TableStructureRecognizer {
  static analyzeTable(table: HTMLTableElement): TableStructure {
    const rows = table.querySelectorAll('tr')
    const rowCount = rows.length
    let colCount = 0
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th')
      colCount = Math.max(colCount, cells.length)
    })
    
    const cells: TableCell[][] = []
    let hasHeader = false
    let hasMergedCells = false
    
    rows.forEach((row, _rowIndex) => {
      const rowCells: TableCell[] = []
      const cellElements = row.querySelectorAll('td, th')
      
      cellElements.forEach((cell) => {
        const isHeader = cell.tagName.toLowerCase() === 'th'
        if (isHeader) hasHeader = true
        
        const rowSpan = parseInt(cell.getAttribute('rowspan') || '1')
        const colSpan = parseInt(cell.getAttribute('colspan') || '1')
        
        if (rowSpan > 1 || colSpan > 1) hasMergedCells = true
        
        rowCells.push({
          content: cell.textContent?.trim() || '',
          rowSpan,
          colSpan,
          isHeader
        })
      })
      
      cells.push(rowCells)
    })
    
    return {
      rows: rowCount,
      cols: colCount,
      cells,
      hasHeader,
      hasMergedCells
    }
  }

  static extractTableData(table: HTMLTableElement): string[][] {
    const data: string[][] = []
    const rows = table.querySelectorAll('tr')
    
    rows.forEach(row => {
      const rowData: string[] = []
      const cells = row.querySelectorAll('td, th')
      
      cells.forEach(cell => {
        rowData.push(cell.textContent?.trim() || '')
      })
      
      data.push(rowData)
    })
    
    return data
  }

  static detectTableType(table: HTMLTableElement): 'data' | 'layout' | 'calendar' | 'unknown' {
    const structure = this.analyzeTable(table)
    
    if (structure.cols === 7 && structure.rows >= 4) {
      const firstRow = structure.cells[0]
      const isWeekDays = firstRow.some(cell => 
        ['一', '二', '三', '四', '五', '六', '日', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          .some(day => cell.content.includes(day))
      )
      if (isWeekDays) return 'calendar'
    }
    
    if (structure.hasHeader && structure.rows > 2) {
      return 'data'
    }
    
    return 'unknown'
  }
}

export class ContentExtractor {
  static extractTitles(blocks: DocumentBlock[]): DocumentBlock[] {
    return blocks.filter(b => 
      b.type === 'title' || 
      b.type === 'heading1' || 
      b.type === 'heading2' || 
      b.type === 'heading3'
    )
  }

  static extractParagraphs(blocks: DocumentBlock[]): DocumentBlock[] {
    return blocks.filter(b => b.type === 'paragraph')
  }

  static extractLists(blocks: DocumentBlock[]): DocumentBlock[] {
    return blocks.filter(b => b.type === 'list')
  }

  static extractTables(blocks: DocumentBlock[]): DocumentBlock[] {
    return blocks.filter(b => b.type === 'table')
  }

  static extractImages(blocks: DocumentBlock[]): DocumentBlock[] {
    return blocks.filter(b => b.type === 'image')
  }

  static extractKeywords(text: string, count: number = 10): string[] {
    const words = text.split(/[\s\n\r,，。！？、；：""''（）【】《》]+/)
      .filter(w => w.length >= 2 && w.length <= 10)
    
    const wordFreq: Record<string, number> = {}
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })
    
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ])
    
    const sorted = Object.entries(wordFreq)
      .filter(([word]) => !stopWords.has(word.toLowerCase()))
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([word]) => word)
    
    return sorted
  }

  static generateSummary(text: string, maxLength: number = 200): string {
    const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim().length > 0)
    
    if (sentences.length === 0) return text.slice(0, maxLength)
    
    const firstSentence = sentences[0].trim()
    
    if (firstSentence.length >= maxLength) {
      return firstSentence.slice(0, maxLength - 3) + '...'
    }
    
    let summary = firstSentence
    for (let i = 1; i < sentences.length && summary.length < maxLength; i++) {
      const nextSentence = sentences[i].trim()
      if (summary.length + nextSentence.length + 1 <= maxLength) {
        summary += '。' + nextSentence
      } else {
        break
      }
    }
    
    return summary + '。'
  }

  static extractDates(text: string): string[] {
    const patterns = [
      /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?/g,
      /\d{1,2}[-/]\d{1,2}[-/]\d{4}/g,
      /\d{4}年\d{1,2}月\d{1,2}日/g,
      /\d{4}\.\d{1,2}\.\d{1,2}/g
    ]
    
    const dates: string[] = []
    patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) dates.push(...matches)
    })
    
    return [...new Set(dates)]
  }

  static extractNumbers(text: string): { value: number; unit?: string; context: string }[] {
    const pattern = /(\d+(?:\.\d+)?)\s*(%|元|万|亿|美元|欧元|日元|kg|克|米|厘米|毫米|升|毫升|小时|分钟|秒|年|月|日|天|人|个|件|份)?/g
    const results: { value: number; unit?: string; context: string }[] = []
    
    let match
    while ((match = pattern.exec(text)) !== null) {
      const start = Math.max(0, match.index - 20)
      const end = Math.min(text.length, match.index + match[0].length + 20)
      
      results.push({
        value: parseFloat(match[1]),
        unit: match[2],
        context: text.slice(start, end)
      })
    }
    
    return results
  }

  static extractEntities(text: string): { type: string; value: string }[] {
    const entities: { type: string; value: string }[] = []
    
    const phonePattern = /(?:电话|手机|联系方式|Tel|Phone)[:：]?\s*([1-9]\d{6,14})/gi
    let match
    while ((match = phonePattern.exec(text)) !== null) {
      entities.push({ type: 'phone', value: match[1] })
    }
    
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g
    while ((match = emailPattern.exec(text)) !== null) {
      entities.push({ type: 'email', value: match[0] })
    }
    
    const urlPattern = /https?:\/\/[\w./-]+/g
    while ((match = urlPattern.exec(text)) !== null) {
      entities.push({ type: 'url', value: match[0] })
    }
    
    const idCardPattern = /\d{17}[\dXx]/g
    while ((match = idCardPattern.exec(text)) !== null) {
      entities.push({ type: 'idCard', value: match[0] })
    }
    
    return entities
  }
}

export class DocumentComparator {
  static compareDocuments(doc1: DocumentStructure, doc2: DocumentStructure): {
    similarity: number
    differences: string[]
    commonBlocks: number
  } {
    const differences: string[] = []
    let similarity = 0
    
    if (doc1.documentType !== doc2.documentType) {
      differences.push(`文档类型不同: ${doc1.documentType} vs ${doc2.documentType}`)
    }
    
    if (doc1.language !== doc2.language) {
      differences.push(`语言不同: ${doc1.language} vs ${doc2.language}`)
    }
    
    const titles1 = ContentExtractor.extractTitles(doc1.blocks)
    const titles2 = ContentExtractor.extractTitles(doc2.blocks)
    
    if (titles1.length !== titles2.length) {
      differences.push(`标题数量不同: ${titles1.length} vs ${titles2.length}`)
    }
    
    const commonBlocks = Math.min(doc1.blocks.length, doc2.blocks.length)
    
    const totalBlocks = Math.max(doc1.blocks.length, doc2.blocks.length)
    if (totalBlocks > 0) {
      similarity = commonBlocks / totalBlocks
    }
    
    return {
      similarity,
      differences,
      commonBlocks
    }
  }
}

export interface ConversationTurn {
  id: string
  timestamp: Date
  userInput: string
  parsedInstructions: ParsedInstructionSummary[]
  executed: boolean
  rollbackType?: 'full' | 'partial'
}

export interface ParsedInstructionSummary {
  targetType: string
  properties: Record<string, unknown>
  originalText: string
}

export interface ContextAnalysisResult {
  intent: 'rollback_and_redo' | 'rollback_only' | 'correction' | 'new_instruction' | 'clarification' | 'continue' | 'redo'
  confidence: number
  rollbackScope: 'full' | 'partial' | 'none'
  targetElements: string[]
  newInstructions: ParsedInstructionSummary[]
  reasoning: string
  relatedTurns: string[]
}

export class ContextAnalyzer {
  private static conversationHistory: ConversationTurn[] = []
  private static maxHistoryLength = 10

  private static correctionKeywords = [
    '不对', '错了', '搞错了', '弄错了', '不是', '反了', '反过来',
    '应该是', '其实', '实际上', '我的意思是', '我是说', '更正',
    '修正', '改一下', '修改一下', '换一下'
  ]

  private static pureRollbackKeywords = [
    '撤销', '撤回', '取消', '恢复', '还原', '回退'
  ]

  private static redoKeywords = [
    '恢复', '重做', '取消撤销', '撤销刚才的撤销', '恢复刚才'
  ]

  private static fullRollbackKeywords = [
    '全部撤销', '全部撤回', '全部取消', '撤销所有', '撤回所有',
    '取消所有', '恢复原样', '恢复原状', '全部重来', '从头开始'
  ]

  static addToHistory(turn: ConversationTurn): void {
    this.conversationHistory.push(turn)
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength)
    }
  }

  static getHistory(): ConversationTurn[] {
    return [...this.conversationHistory]
  }

  static getLastExecutedTurn(): ConversationTurn | null {
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      if (this.conversationHistory[i].executed) {
        return this.conversationHistory[i]
      }
    }
    return null
  }

  static clearHistory(): void {
    this.conversationHistory = []
  }

  static removeLastTurn(): boolean {
    if (this.conversationHistory.length === 0) return false
    this.conversationHistory = this.conversationHistory.slice(0, -1)
    return true
  }

  static markLastTurnAsRolledBack(): boolean {
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      if (this.conversationHistory[i].executed) {
        this.conversationHistory[i].executed = false
        this.conversationHistory[i].rollbackType = 'partial'
        return true
      }
    }
    return false
  }

  static analyze(userInput: string): ContextAnalysisResult {
    const normalizedInput = userInput.trim()
    const lastTurn = this.getLastExecutedTurn()
    
    const hasCorrectionKeyword = this.correctionKeywords.some(kw => normalizedInput.includes(kw))
    const hasPureRollbackKeyword = this.pureRollbackKeywords.some(kw => normalizedInput.includes(kw))
    const hasFullRollbackKeyword = this.fullRollbackKeywords.some(kw => normalizedInput.includes(kw))
    const hasRedoKeyword = this.redoKeywords.some(kw => normalizedInput.includes(kw))
    
    const targetElementsInInput = this.extractTargetElements(normalizedInput)
    const formatKeywordsInInput = this.extractFormatKeywords(normalizedInput)
    const hasNewInstructions = targetElementsInInput.length > 0 || formatKeywordsInInput.length > 0
    
    if (hasRedoKeyword && /^恢复$|^重做$/.test(normalizedInput)) {
      return {
        intent: 'redo',
        confidence: 0.95,
        rollbackScope: 'none',
        targetElements: [],
        newInstructions: [],
        reasoning: '检测到恢复/重做关键词',
        relatedTurns: []
      }
    }
    
    if (hasFullRollbackKeyword && !hasNewInstructions) {
      return {
        intent: 'rollback_only',
        confidence: 0.95,
        rollbackScope: 'full',
        targetElements: [],
        newInstructions: [],
        reasoning: '检测到全部撤销关键词，且无新指令',
        relatedTurns: this.getRelatedTurnIds('all')
      }
    }
    
    if (!lastTurn) {
      if (hasCorrectionKeyword && hasNewInstructions) {
        return {
          intent: 'new_instruction',
          confidence: 0.8,
          rollbackScope: 'none',
          targetElements: targetElementsInInput,
          newInstructions: this.parseNewInstructions(normalizedInput),
          reasoning: '无历史操作，将作为新指令执行',
          relatedTurns: []
        }
      }
      
      return {
        intent: 'new_instruction',
        confidence: 0.9,
        rollbackScope: 'none',
        targetElements: targetElementsInInput,
        newInstructions: this.parseNewInstructions(normalizedInput),
        reasoning: '无历史操作，作为新指令处理',
        relatedTurns: []
      }
    }
    
    if (hasCorrectionKeyword) {
      return this.analyzeCorrectionIntent(normalizedInput, lastTurn, targetElementsInInput, formatKeywordsInInput)
    }
    
    if (hasPureRollbackKeyword && !hasNewInstructions) {
      return {
        intent: 'rollback_only',
        confidence: 0.9,
        rollbackScope: 'partial',
        targetElements: [],
        newInstructions: [],
        reasoning: '检测到撤销关键词，无新指令',
        relatedTurns: [lastTurn.id]
      }
    }
    
    if (hasPureRollbackKeyword && hasNewInstructions) {
      return {
        intent: 'rollback_and_redo',
        confidence: 0.85,
        rollbackScope: 'partial',
        targetElements: targetElementsInInput,
        newInstructions: this.parseNewInstructions(normalizedInput),
        reasoning: '检测到撤销关键词和新指令，将撤销后重新执行',
        relatedTurns: [lastTurn.id]
      }
    }
    
    if (hasNewInstructions) {
      const similarity = this.calculateInstructionSimilarity(
        targetElementsInInput,
        formatKeywordsInInput,
        lastTurn
      )
      
      if (similarity > 0.7) {
        return {
          intent: 'correction',
          confidence: 0.8,
          rollbackScope: 'partial',
          targetElements: targetElementsInInput,
          newInstructions: this.parseNewInstructions(normalizedInput),
          reasoning: `新指令与上次操作高度相似(${(similarity * 100).toFixed(0)}%)，可能是修正操作`,
          relatedTurns: [lastTurn.id]
        }
      }
      
      return {
        intent: 'new_instruction',
        confidence: 0.85,
        rollbackScope: 'none',
        targetElements: targetElementsInInput,
        newInstructions: this.parseNewInstructions(normalizedInput),
        reasoning: '检测到新指令，与历史操作无直接关联',
        relatedTurns: []
      }
    }
    
    return {
      intent: 'clarification',
      confidence: 0.6,
      rollbackScope: 'none',
      targetElements: [],
      newInstructions: [],
      reasoning: '无法确定明确意图，可能需要用户澄清',
      relatedTurns: lastTurn ? [lastTurn.id] : []
    }
  }

  private static analyzeCorrectionIntent(
    input: string,
    lastTurn: ConversationTurn,
    targetElements: string[],
    formatKeywords: string[]
  ): ContextAnalysisResult {
    const lastTargets = lastTurn.parsedInstructions.map(i => i.targetType)
    const lastProperties = lastTurn.parsedInstructions.flatMap(i => Object.keys(i.properties))
    
    const isSameTarget = targetElements.some(t => 
      lastTargets.includes(t) || 
      lastTargets.includes(this.normalizeTargetType(t))
    )
    
    const isSameFormat = formatKeywords.some(f => 
      lastProperties.includes(this.normalizeProperty(f))
    )
    
    const hasNewContent = targetElements.length > 0 || formatKeywords.length > 0
    
    if (isSameTarget && !isSameFormat && hasNewContent) {
      return {
        intent: 'correction',
        confidence: 0.9,
        rollbackScope: 'partial',
        targetElements,
        newInstructions: this.parseNewInstructions(input),
        reasoning: '针对相同目标元素修改格式属性，判定为修正操作',
        relatedTurns: [lastTurn.id]
      }
    }
    
    if (isSameTarget && isSameFormat && hasNewContent) {
      return {
        intent: 'rollback_and_redo',
        confidence: 0.85,
        rollbackScope: 'partial',
        targetElements,
        newInstructions: this.parseNewInstructions(input),
        reasoning: '目标元素和格式属性相同，可能是重新执行',
        relatedTurns: [lastTurn.id]
      }
    }
    
    if (!isSameTarget && hasNewContent) {
      const overlapTargets = targetElements.filter(t => 
        lastTargets.includes(t) || lastTargets.includes(this.normalizeTargetType(t))
      )
      
      if (overlapTargets.length > 0) {
        return {
          intent: 'correction',
          confidence: 0.85,
          rollbackScope: 'partial',
          targetElements,
          newInstructions: this.parseNewInstructions(input),
          reasoning: `部分目标元素(${overlapTargets.join(', ')})与上次操作重叠，判定为修正`,
          relatedTurns: [lastTurn.id]
        }
      }
      
      return {
        intent: 'new_instruction',
        confidence: 0.75,
        rollbackScope: 'none',
        targetElements,
        newInstructions: this.parseNewInstructions(input),
        reasoning: '目标元素与上次操作完全不同，判定为新指令',
        relatedTurns: []
      }
    }
    
    if (!hasNewContent) {
      const clarificationPattern = /(?:我的意思是|我是说|其实|实际上)[，,]?\s*(.+)/
      const match = input.match(clarificationPattern)
      
      if (match) {
        const clarifiedContent = match[1]
        const clarifiedTargets = this.extractTargetElements(clarifiedContent)
        const clarifiedFormats = this.extractFormatKeywords(clarifiedContent)
        
        if (clarifiedTargets.length > 0 || clarifiedFormats.length > 0) {
          return {
            intent: 'correction',
            confidence: 0.85,
            rollbackScope: 'partial',
            targetElements: clarifiedTargets,
            newInstructions: this.parseNewInstructions(clarifiedContent),
            reasoning: '检测到澄清表达，提取实际指令内容',
            relatedTurns: [lastTurn.id]
          }
        }
      }
      
      return {
        intent: 'rollback_only',
        confidence: 0.7,
        rollbackScope: 'partial',
        targetElements: [],
        newInstructions: [],
        reasoning: '检测到修正关键词但无明确新指令，仅执行撤销',
        relatedTurns: [lastTurn.id]
      }
    }
    
    return {
      intent: 'clarification',
      confidence: 0.5,
      rollbackScope: 'none',
      targetElements: [],
      newInstructions: [],
      reasoning: '意图不明确，建议用户澄清',
      relatedTurns: [lastTurn.id]
    }
  }

  private static extractTargetElements(text: string): string[] {
    const elements: string[] = []
    const targetPatterns = [
      { pattern: /标题一|一级标题|h1/gi, type: 'heading1' },
      { pattern: /标题二|二级标题|h2/gi, type: 'heading2' },
      { pattern: /标题三|三级标题|h3/gi, type: 'heading3' },
      { pattern: /标题/g, type: 'heading' },
      { pattern: /正文|段落|普通文本/g, type: 'paragraph' },
      { pattern: /图片|图像|插图/g, type: 'image' },
      { pattern: /表格/g, type: 'table' }
    ]
    
    for (const { pattern, type } of targetPatterns) {
      if (pattern.test(text)) {
        elements.push(type)
      }
    }
    
    return [...new Set(elements)]
  }

  private static extractFormatKeywords(text: string): string[] {
    const keywords: string[] = []
    const formatPatterns = [
      { pattern: /居中|中间/g, key: 'alignment' },
      { pattern: /左对齐|靠左/g, key: 'alignment' },
      { pattern: /右对齐|靠右/g, key: 'alignment' },
      { pattern: /首行缩进|首行/g, key: 'indent' },
      { pattern: /行距/g, key: 'lineSpacing' },
      { pattern: /字号|字体大小/g, key: 'fontSize' },
      { pattern: /字体/g, key: 'fontFamily' },
      { pattern: /加粗|粗体/g, key: 'bold' },
      { pattern: /斜体|倾斜/g, key: 'italic' },
      { pattern: /下划线/g, key: 'underline' },
      { pattern: /颜色/g, key: 'color' }
    ]
    
    for (const { pattern, key } of formatPatterns) {
      if (pattern.test(text)) {
        keywords.push(key)
      }
    }
    
    return [...new Set(keywords)]
  }

  private static normalizeTargetType(type: string): string {
    const mapping: Record<string, string> = {
      'heading1': 'heading',
      'heading2': 'heading',
      'heading3': 'heading',
      'heading4': 'heading',
      'heading5': 'heading',
      'heading6': 'heading',
      'body': 'paragraph'
    }
    return mapping[type] || type
  }

  private static normalizeProperty(keyword: string): string {
    const mapping: Record<string, string> = {
      '居中': 'alignment',
      '左对齐': 'alignment',
      '右对齐': 'alignment',
      '首行缩进': 'indent',
      '行距': 'lineSpacing',
      '字号': 'fontSize',
      '字体': 'fontFamily',
      '加粗': 'bold',
      '斜体': 'italic',
      '下划线': 'underline'
    }
    return mapping[keyword] || keyword
  }

  private static calculateInstructionSimilarity(
    targets: string[],
    formats: string[],
    lastTurn: ConversationTurn
  ): number {
    const lastTargets = lastTurn.parsedInstructions.map(i => i.targetType)
    const lastFormats = lastTurn.parsedInstructions.flatMap(i => Object.keys(i.properties))
    
    const targetSimilarity = this.jaccardSimilarity(targets, lastTargets)
    const formatSimilarity = this.jaccardSimilarity(formats, lastFormats)
    
    return (targetSimilarity * 0.6 + formatSimilarity * 0.4)
  }

  private static jaccardSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 1
    if (a.length === 0 || b.length === 0) return 0
    
    const setA = new Set(a.map(x => this.normalizeTargetType(x)))
    const setB = new Set(b.map(x => this.normalizeTargetType(x)))
    
    const intersection = new Set([...setA].filter(x => setB.has(x)))
    const union = new Set([...setA, ...setB])
    
    return intersection.size / union.size
  }

  private static parseNewInstructions(text: string): ParsedInstructionSummary[] {
    const instructions: ParsedInstructionSummary[] = []
    const segments = this.segmentByText(text)
    
    for (const segment of segments) {
      const targets = this.extractTargetElements(segment)
      const properties: Record<string, unknown> = {}
      
      if (/居中|中间/.test(segment)) properties.alignment = 'center'
      if (/左对齐|靠左/.test(segment)) properties.alignment = 'left'
      if (/右对齐|靠右/.test(segment)) properties.alignment = 'right'
      if (/首行缩进|首行/.test(segment)) properties.indent = 2
      if (/加粗|粗体/.test(segment)) properties.bold = true
      if (/斜体|倾斜/.test(segment)) properties.italic = true
      if (/下划线/.test(segment)) properties.underline = true
      
      if (targets.length > 0 && Object.keys(properties).length > 0) {
        instructions.push({
          targetType: targets[0],
          properties,
          originalText: segment
        })
      }
    }
    
    return instructions
  }

  private static segmentByText(text: string): string[] {
    const delimiters = ['，', '。', '；', '、', '然后', '接着', '同时', '另外', '还有', '以及', '并且', '再']
    let segments: string[] = [text]
    
    for (const delimiter of delimiters) {
      const newSegments: string[] = []
      for (const seg of segments) {
        const parts = seg.split(delimiter).filter(s => s.trim())
        newSegments.push(...parts)
      }
      segments = newSegments
    }
    
    return segments.filter(s => s.trim().length > 0)
  }

  private static getRelatedTurnIds(scope: 'all' | 'last'): string[] {
    if (scope === 'all') {
      return this.conversationHistory.filter(t => t.executed).map(t => t.id)
    }
    const lastTurn = this.getLastExecutedTurn()
    return lastTurn ? [lastTurn.id] : []
  }
}

export const contextAnalyzer = ContextAnalyzer

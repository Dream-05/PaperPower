import { nlpProcessor } from './nlpProcessor'
import { contextManager } from './contextManager'
import { responseGenerator } from './responseGenerator'
import { intelligentDocumentProcessor } from './intelligentDocumentProcessor'
import { enhancedDataAnalyzer } from './enhancedDataAnalyzer'
import { aiModelOrchestrator } from './aiModelOrchestrator'
import { mlInferenceEngine } from './mlInferenceEngine'
import { auditLogger } from './compliance'
import { getOpenClawBridge } from './openclaw/bridge'

export interface AIRequest {
  input: string
  type: 'text' | 'document' | 'data' | 'command'
  context?: {
    activeDocument?: { type: string; name: string }
    recentActions?: string[]
    userLanguage?: 'en' | 'zh'
  }
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
    detectAnomalies?: boolean
    forecast?: boolean
  }
}

export interface AIResponse {
  success: boolean
  result: {
    text?: string
    actions?: Array<{
      type: 'primary' | 'secondary' | 'tertiary'
      label: string
      description: string
      command: string
    }>
    followUp?: string[]
    confidence: number
  }
  metadata: {
    processingTime: number
    model: string
    tokens: number
    auditId: string
  }
  insights?: string[]
  recommendations?: string[]
}

export interface DocumentAnalysisResult {
  structure: {
    type: string
    sections: number
    outline: string[]
  }
  metadata: {
    title: string | null
    wordCount: number
    language: string
    estimatedReadTime: number
  }
  quality: {
    overall: number
    coherence: number
    clarity: number
  }
  entities: Array<{ text: string; type: string }>
  topics: string[]
  sentiment: { positive: number; negative: number; neutral: number }
  summary: string
  suggestions: string[]
}

export interface DataAnalysisResult {
  statistics: {
    count: number
    mean: number
    median: number
    stdDev: number
    min: number
    max: number
  }
  trend: {
    direction: string
    confidence: number
    r2: number
  } | null
  anomalies: {
    count: number
    items: Array<{ index: number; value: number; severity: string }>
  }
  forecast: number[]
  insights: string[]
  recommendations: string[]
}

export interface KnowledgeNode {
  id: string
  type: 'concept' | 'entity' | 'relation' | 'event'
  label: string
  properties: Record<string, unknown>
  connections: string[]
}

export class AIService {
  private static instance: AIService
  private knowledgeGraph: Map<string, KnowledgeNode> = new Map()
  private openClawEnabled: boolean = true
  private openClawReady: boolean = false

  private constructor() {
    this.initializeKnowledgeGraph()
    this.initializeOpenClaw()
  }

  private async initializeOpenClaw(): Promise<void> {
    try {
      const bridge = getOpenClawBridge()
      this.openClawReady = await bridge.initialize()
      if (this.openClawReady) {
        console.log('[AIService] OpenClaw integration ready')
      }
    } catch (error) {
      console.warn('[AIService] OpenClaw initialization failed, using local fallback:', error)
      this.openClawReady = false
    }
  }

  setOpenClawEnabled(enabled: boolean): void {
    this.openClawEnabled = enabled
  }

  isOpenClawReady(): boolean {
    return this.openClawReady && this.openClawEnabled
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  async initialize(): Promise<boolean> {
    try {
      // 初始化OpenClaw
      await this.initializeOpenClaw()
      console.log('AI服务初始化成功')
      return true
    } catch (error) {
      console.error('AI服务初始化失败:', error)
      return false
    }
  }

  private initializeKnowledgeGraph(): void {
    const concepts = [
      { id: 'doc_create', label: 'Document Creation', type: 'concept' as const, properties: { category: 'document' } },
      { id: 'doc_edit', label: 'Document Editing', type: 'concept' as const, properties: { category: 'document' } },
      { id: 'doc_format', label: 'Document Formatting', type: 'concept' as const, properties: { category: 'document' } },
      { id: 'data_analyze', label: 'Data Analysis', type: 'concept' as const, properties: { category: 'data' } },
      { id: 'data_visualize', label: 'Data Visualization', type: 'concept' as const, properties: { category: 'data' } },
      { id: 'file_organize', label: 'File Organization', type: 'concept' as const, properties: { category: 'file' } },
      { id: 'file_rename', label: 'Batch Rename', type: 'concept' as const, properties: { category: 'file' } },
      { id: 'ppt_create', label: 'Presentation Creation', type: 'concept' as const, properties: { category: 'presentation' } }
    ]

    for (const concept of concepts) {
      this.knowledgeGraph.set(concept.id, {
        ...concept,
        connections: []
      })
    }

    this.addConnection('doc_create', 'doc_edit')
    this.addConnection('doc_edit', 'doc_format')
    this.addConnection('data_analyze', 'data_visualize')
    this.addConnection('file_organize', 'file_rename')
  }

  private addConnection(from: string, to: string): void {
    const fromNode = this.knowledgeGraph.get(from)
    const toNode = this.knowledgeGraph.get(to)
    if (fromNode && toNode) {
      if (!fromNode.connections.includes(to)) fromNode.connections.push(to)
      if (!toNode.connections.includes(from)) toNode.connections.push(from)
    }
  }

  async process(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    const userLanguage = request.context?.userLanguage || this.detectLanguage(request.input)

    try {
      if (this.isOpenClawReady()) {
        const openClawResult = await this.processWithOpenClaw(request, userLanguage)
        if (openClawResult) {
          return openClawResult
        }
      }

      let result: AIResponse['result']
      let model = 'local-nlp'
      let tokens = 0
      let auditId = ''

      switch (request.type) {
        case 'text':
        case 'command':
          const textResult = await this.processText(request.input, userLanguage)
          result = textResult.result
          model = textResult.model
          tokens = textResult.tokens
          auditId = textResult.auditId
          break

        case 'document':
          const docResult = await this.processDocument(request.input, request.options)
          result = docResult.result
          model = 'local-document'
          tokens = this.estimateTokens(request.input)
          auditId = docResult.auditId
          break

        case 'data':
          const dataResult = await this.processData(request.input, request.options)
          result = dataResult.result
          model = 'local-data'
          tokens = this.estimateTokens(request.input)
          auditId = dataResult.auditId
          break

        default:
          throw new Error(`Unknown request type: ${request.type}`)
      }

      const processingTime = Date.now() - startTime

      return {
        success: true,
        result,
        metadata: {
          processingTime,
          model,
          tokens,
          auditId
        }
      }
    } catch (error) {
      const auditLog = auditLogger.createAuditLog(
        { error: String(error), input: request.input.substring(0, 100) },
        [{
          step: 1,
          operation: 'error_handling',
          method: 'fallback',
          input: {},
          output: {},
          evidence: 'error_occurred'
        }],
        { success: false }
      )

      return {
        success: false,
        result: {
          text: userLanguage === 'zh' 
            ? '抱歉，处理您的请求时出现错误。请稍后重试。'
            : 'Sorry, an error occurred while processing your request. Please try again.',
          confidence: 0,
          actions: []
        },
        metadata: {
          processingTime: Date.now() - startTime,
          model: 'error',
          tokens: 0,
          auditId: auditLog.auditId
        }
      }
    }
  }

  private async processWithOpenClaw(request: AIRequest, userLanguage: 'en' | 'zh'): Promise<AIResponse | null> {
    try {
      const bridge = getOpenClawBridge()
      
      const response = await bridge.process({
        input: request.input,
        type: request.type,
        context: {
          language: userLanguage,
          activeDocument: request.context?.activeDocument ? {
            type: request.context.activeDocument.type as 'ppt' | 'word' | 'excel' | 'other',
            name: request.context.activeDocument.name
          } : undefined,
          recentActions: request.context?.recentActions
        },
        options: {
          useOpenClaw: true
        }
      })

      const auditLog = auditLogger.createAuditLog(
        { source: response.source, thinking: response.thinking?.length || 0 },
        [{
          step: 1,
          operation: 'openclaw_processing',
          method: 'agent_loop',
          input: { text: request.input.substring(0, 50) },
          output: { content: response.content.substring(0, 100) },
          evidence: `source: ${response.source}`
        }],
        { success: response.success }
      )

      const actions = response.actions?.map((a, i) => ({
        type: (i === 0 ? 'primary' : 'secondary') as 'primary' | 'secondary' | 'tertiary',
        label: a.name,
        description: JSON.stringify(a.args),
        command: a.name
      })) || []

      return {
        success: response.success,
        result: {
          text: response.content,
          actions,
          confidence: response.metadata.confidence
        },
        insights: response.thinking?.map(t => `${t.description}: ${t.result}`),
        metadata: {
          processingTime: response.metadata.processingTime,
          model: response.metadata.model,
          tokens: response.metadata.tokens,
          auditId: auditLog.auditId
        }
      }
    } catch (error) {
      console.warn('[AIService] OpenClaw processing failed, falling back to local:', error)
      return null
    }
  }

  private async processText(input: string, userLanguage: 'en' | 'zh'): Promise<{
    result: AIResponse['result']
    model: string
    tokens: number
    auditId: string
  }> {
    const nlpResult = nlpProcessor.process(input)
    const generatedResponse = responseGenerator.generate(input, userLanguage)

    contextManager.addMessage({
      role: 'user',
      content: input,
      intent: nlpResult.intent.name,
      entities: nlpResult.entities.map(e => e.text)
    })

    contextManager.addMessage({
      role: 'assistant',
      content: generatedResponse.text,
      intent: nlpResult.intent.name
    })

    contextManager.recordIntent(nlpResult.intent.name)

    this.findRelatedConcepts(nlpResult.intent.name)

    const auditLog = auditLogger.createAuditLog(
      { intent: nlpResult.intent.name, confidence: nlpResult.intent.confidence },
      [{
        step: 1,
        operation: 'text_processing',
        method: 'nlp_pipeline',
        input: { text: input.substring(0, 50) },
        output: { intent: nlpResult.intent.name },
        evidence: `confidence: ${nlpResult.intent.confidence.toFixed(2)}`
      }],
      { success: true }
    )

    return {
      result: {
        text: generatedResponse.text,
        actions: generatedResponse.actions,
        followUp: generatedResponse.followUp,
        confidence: generatedResponse.confidence
      },
      model: 'local-nlp',
      tokens: this.estimateTokens(input) + this.estimateTokens(generatedResponse.text),
      auditId: auditLog.auditId
    }
  }

  private async processDocument(content: string, _options?: AIRequest['options']): Promise<{
    result: AIResponse['result']
    auditId: string
  }> {
    const analysis = intelligentDocumentProcessor.analyze(content)
    const summary = intelligentDocumentProcessor.generateSummary(analysis)
    const suggestions = intelligentDocumentProcessor.suggestImprovements(analysis)

    const auditLog = auditLogger.createAuditLog(
      { documentType: analysis.structure.type, quality: analysis.quality.overall },
      [{
        step: 1,
        operation: 'document_analysis',
        method: 'intelligent_processing',
        input: { length: content.length },
        output: { sections: analysis.structure.sections.length },
        evidence: `type: ${analysis.structure.type}`
      }],
      { success: true }
    )

    return {
      result: {
        text: summary,
        actions: suggestions.slice(0, 3).map((s, i) => ({
          type: i === 0 ? 'primary' : 'secondary' as const,
          label: s.substring(0, 30),
          description: s,
          command: `improve_${i}`
        })),
        confidence: analysis.quality.overall / 100,
        followUp: suggestions.slice(3)
      },
      auditId: auditLog.auditId
    }
  }

  private async processData(input: string, options?: AIRequest['options']): Promise<{
    result: AIResponse['result']
    auditId: string
  }> {
    const numbers = this.extractNumbers(input)
    
    if (numbers.length === 0) {
      return {
        result: {
          text: 'No numerical data found in input. Please provide data for analysis.',
          confidence: 0,
          actions: []
        },
        auditId: ''
      }
    }

    const analysis = enhancedDataAnalyzer.analyze(numbers, {
      detectAnomalies: options?.detectAnomalies ?? true,
      forecast: options?.forecast ?? true
    })

    const auditLog = auditLogger.createAuditLog(
      { dataPoints: numbers.length, trend: analysis.trends?.direction },
      [{
        step: 1,
        operation: 'data_analysis',
        method: 'statistical_analysis',
        input: { count: numbers.length },
        output: { mean: analysis.summary.mean },
        evidence: `trend: ${analysis.trends?.direction || 'none'}`
      }],
      { success: true }
    )

    const resultText = this.formatDataAnalysisResult(analysis)

    return {
      result: {
        text: resultText,
        actions: [
          {
            type: 'primary',
            label: 'View Details',
            description: 'View detailed analysis report',
            command: 'view_analysis'
          },
          {
            type: 'secondary',
            label: 'Export Report',
            description: 'Export analysis as report',
            command: 'export_analysis'
          }
        ],
        confidence: analysis.trends?.confidence || 0.5,
        followUp: analysis.recommendations
      },
      auditId: auditLog.auditId
    }
  }

  private extractNumbers(input: string): number[] {
    const matches = input.match(/-?\d+\.?\d*/g)
    return matches ? matches.map(Number).filter(n => !isNaN(n)) : []
  }

  private formatDataAnalysisResult(analysis: ReturnType<typeof enhancedDataAnalyzer.analyze>): string {
    const lines: string[] = []
    
    lines.push(`📊 Data Analysis Report`)
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(``)
    lines.push(`📈 Statistics:`)
    lines.push(`  • Count: ${analysis.summary.count}`)
    lines.push(`  • Mean: ${analysis.summary.mean.toFixed(2)}`)
    lines.push(`  • Median: ${analysis.summary.median.toFixed(2)}`)
    lines.push(`  • Std Dev: ${analysis.summary.stdDev.toFixed(2)}`)
    lines.push(`  • Range: ${analysis.summary.min.toFixed(2)} - ${analysis.summary.max.toFixed(2)}`)
    
    if (analysis.trends) {
      lines.push(``)
      lines.push(`📉 Trend Analysis:`)
      lines.push(`  • Direction: ${analysis.trends.direction}`)
      lines.push(`  • Confidence: ${(analysis.trends.confidence * 100).toFixed(1)}%`)
      lines.push(`  • R² Score: ${analysis.trends.r2.toFixed(3)}`)
    }
    
    if (analysis.anomalies && analysis.anomalies.anomalies.length > 0) {
      lines.push(``)
      lines.push(`⚠️ Anomalies Detected: ${analysis.anomalies.anomalies.length}`)
    }
    
    if (analysis.forecast) {
      lines.push(``)
      lines.push(`🔮 Forecast (next 5 periods):`)
      lines.push(`  ${analysis.forecast.values.map(v => v.toFixed(2)).join(', ')}`)
    }
    
    return lines.join('\n')
  }

  private findRelatedConcepts(intent: string): string[] {
    const related: string[] = []
    const intentLower = intent.toLowerCase()
    
    for (const [id, node] of this.knowledgeGraph) {
      if (intentLower.includes(id.split('_')[0]) || 
          node.label.toLowerCase().includes(intentLower.split('_')[0])) {
        related.push(...node.connections)
      }
    }
    
    return [...new Set(related)].slice(0, 5)
  }

  analyzeDocument(content: string): DocumentAnalysisResult {
    const analysis = intelligentDocumentProcessor.analyze(content)
    
    return {
      structure: {
        type: analysis.structure.type,
        sections: analysis.structure.sections.length,
        outline: analysis.structure.outline.items.map(i => i.text)
      },
      metadata: {
        title: analysis.structure.metadata.title,
        wordCount: analysis.structure.metadata.wordCount,
        language: analysis.structure.metadata.language,
        estimatedReadTime: analysis.structure.metadata.estimatedReadTime
      },
      quality: {
        overall: analysis.quality.overall,
        coherence: analysis.quality.coherence,
        clarity: analysis.quality.clarity
      },
      entities: analysis.entities.map(e => ({ text: e.text, type: e.type })),
      topics: analysis.topics,
      sentiment: analysis.sentiment,
      summary: intelligentDocumentProcessor.generateSummary(analysis),
      suggestions: intelligentDocumentProcessor.suggestImprovements(analysis)
    }
  }

  analyzeData(data: number[], options?: {
    detectAnomalies?: boolean
    forecast?: boolean
    forecastPeriods?: number
  }): DataAnalysisResult {
    const analysis = enhancedDataAnalyzer.analyze(data, options)
    
    return {
      statistics: {
        count: analysis.summary.count,
        mean: analysis.summary.mean,
        median: analysis.summary.median,
        stdDev: analysis.summary.stdDev,
        min: analysis.summary.min,
        max: analysis.summary.max
      },
      trend: analysis.trends ? {
        direction: analysis.trends.direction,
        confidence: analysis.trends.confidence,
        r2: analysis.trends.r2
      } : null,
      anomalies: {
        count: analysis.anomalies?.anomalies.length || 0,
        items: (analysis.anomalies?.anomalies || []).map(a => ({
          index: a.index,
          value: a.value,
          severity: a.severity
        }))
      },
      forecast: analysis.forecast?.values || [],
      insights: analysis.insights,
      recommendations: analysis.recommendations
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const result = await aiModelOrchestrator.generateEmbedding(text)
    return result.embedding
  }

  calculateSimilarity(text1: string, text2: string): Promise<number> {
    return Promise.resolve().then(async () => {
      const emb1 = await this.generateEmbedding(text1)
      const emb2 = await this.generateEmbedding(text2)
      return aiModelOrchestrator.cosineSimilarity(emb1, emb2)
    })
  }

  predict(modelId: string, input: string | number[]) {
    return mlInferenceEngine.predict(modelId, input)
  }

  getConversationHistory(count: number = 10) {
    return contextManager.getRecentMessages(count)
  }

  clearHistory(): void {
    contextManager.clearHistory()
  }

  getStatistics() {
    return contextManager.getTaskStatistics()
  }

  suggestNextActions(): string[] {
    return contextManager.suggestNextAction()
  }

  private detectLanguage(text: string): 'en' | 'zh' {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = text.split(/\s+/).filter(w => /^[a-zA-Z]+$/.test(w)).length
    return chineseChars > englishWords ? 'zh' : 'en'
  }

  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars * 1.5 + otherChars / 4)
  }

  exportSession(): string {
    return contextManager.exportSession()
  }

  getAvailableModels() {
    return aiModelOrchestrator.getAvailableModels()
  }

  getMLModels() {
    return mlInferenceEngine.listModels()
  }
}

export const aiService = AIService.getInstance()

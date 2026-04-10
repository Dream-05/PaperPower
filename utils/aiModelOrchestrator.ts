import { auditLogger } from './compliance'
import { responseGenerator } from './responseGenerator'
import { intelligentDocumentProcessor } from './intelligentDocumentProcessor'
import { enhancedDataAnalyzer } from './enhancedDataAnalyzer'

export type ModelProvider = 'local' | 'openai' | 'anthropic' | 'google' | 'custom'
export type ModelCapability = 'text' | 'code' | 'embedding' | 'image' | 'audio'

export interface ModelConfig {
  id: string
  name: string
  provider: ModelProvider
  capabilities: ModelCapability[]
  maxTokens: number
  temperature: number
  topP: number
  enabled: boolean
  priority: number
}

export interface ModelResponse {
  id: string
  model: string
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  latency: number
  confidence: number
  finishReason: 'stop' | 'length' | 'error'
}

export interface EmbeddingResult {
  embedding: number[]
  dimensions: number
  model: string
  tokens: number
}

export interface ModelRegistry {
  models: Map<string, ModelConfig>
  defaultModel: string
  fallbackModels: string[]
}

export class AIModelOrchestrator {
  private static instance: AIModelOrchestrator
  private registry: ModelRegistry

  private constructor() {
    this.registry = this.initializeRegistry()
  }

  static getInstance(): AIModelOrchestrator {
    if (!AIModelOrchestrator.instance) {
      AIModelOrchestrator.instance = new AIModelOrchestrator()
    }
    return AIModelOrchestrator.instance
  }

  private initializeRegistry(): ModelRegistry {
    const models = new Map<string, ModelConfig>()
    
    models.set('local-nlp', {
      id: 'local-nlp',
      name: 'Local NLP Engine',
      provider: 'local',
      capabilities: ['text'],
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
      enabled: true,
      priority: 1
    })
    
    models.set('local-embedding', {
      id: 'local-embedding',
      name: 'Local Embedding Model',
      provider: 'local',
      capabilities: ['embedding'],
      maxTokens: 8192,
      temperature: 0,
      topP: 1,
      enabled: true,
      priority: 1
    })

    return {
      models,
      defaultModel: 'local-nlp',
      fallbackModels: ['local-nlp']
    }
  }

  registerModel(config: ModelConfig): void {
    this.registry.models.set(config.id, config)
  }

  unregisterModel(modelId: string): boolean {
    return this.registry.models.delete(modelId)
  }

  getAvailableModels(): ModelConfig[] {
    return Array.from(this.registry.models.values())
      .filter(m => m.enabled)
      .sort((a, b) => a.priority - b.priority)
  }

  getModel(modelId: string): ModelConfig | undefined {
    return this.registry.models.get(modelId)
  }

  async process(
    input: string,
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
      context?: string[]
    }
  ): Promise<ModelResponse> {
    const modelId = options?.model || this.registry.defaultModel
    const model = this.registry.models.get(modelId)
    
    if (!model || !model.enabled) {
      throw new Error(`Model ${modelId} is not available`)
    }

    const startTime = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    
    try {
      const response = await this.executeModel(model, input, options)
      
      auditLogger.createAuditLog(
        { model: modelId, inputLength: input.length },
        [{
          step: 1,
          operation: 'model_inference',
          method: model.provider,
          input: { tokens: this.estimateTokens(input) },
          output: { tokens: response.usage.totalTokens },
          evidence: `latency: ${response.latency}ms`
        }],
        { success: true }
      )

      return {
        ...response,
        id: requestId,
        model: modelId,
        latency: Date.now() - startTime
      }
    } catch (error) {
      const fallbackModel = this.registry.fallbackModels.find(
        id => id !== modelId && this.registry.models.get(id)?.enabled
      )
      
      if (fallbackModel) {
        return this.process(input, { ...options, model: fallbackModel })
      }
      
      throw error
    }
  }

  private async executeModel(
    model: ModelConfig,
    input: string,
    options?: {
      temperature?: number
      maxTokens?: number
      context?: string[]
    }
  ): Promise<ModelResponse> {
    switch (model.provider) {
      case 'local':
        return this.executeLocalModel(model, input, options)
      default:
        throw new Error(`Provider ${model.provider} is not implemented`)
    }
  }

  private async executeLocalModel(
    model: ModelConfig,
    input: string,
    _options?: {
      temperature?: number
      maxTokens?: number
      context?: string[]
    }
  ): Promise<ModelResponse> {
    const userLanguage = this.detectLanguage(input)
    
    const generatedResponse = responseGenerator.generate(input, userLanguage)
    
    const promptTokens = this.estimateTokens(input)
    const completionTokens = this.estimateTokens(generatedResponse.text)
    
    return {
      id: '',
      model: model.id,
      content: generatedResponse.text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      latency: 0,
      confidence: generatedResponse.confidence,
      finishReason: 'stop'
    }
  }

  async generateEmbedding(text: string, modelId?: string): Promise<EmbeddingResult> {
    const model = modelId || 'local-embedding'
    
    const tokens = text.split(/\s+/).filter(t => t.length > 0)
    const embedding = this.generateLocalEmbedding(text)
    
    return {
      embedding,
      dimensions: embedding.length,
      model,
      tokens: tokens.length
    }
  }

  private generateLocalEmbedding(text: string): number[] {
    const dimensions = 384
    const embedding: number[] = new Array(dimensions).fill(0)
    
    const tokens = text.toLowerCase().split(/\s+/)
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const hash = this.hashString(token)
      
      for (let j = 0; j < dimensions; j++) {
        const contribution = Math.sin(hash * (j + 1)) * 0.1
        embedding[j] += contribution / tokens.length
      }
    }
    
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm
      }
    }
    
    return embedding
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions')
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator > 0 ? dotProduct / denominator : 0
  }

  async analyzeDocument(content: string): Promise<{
    summary: string
    keywords: string[]
    entities: Array<{ text: string; type: string }>
    sentiment: { positive: number; negative: number; neutral: number }
    quality: number
  }> {
    const analysis = intelligentDocumentProcessor.analyze(content)
    
    return {
      summary: intelligentDocumentProcessor.generateSummary(analysis),
      keywords: analysis.topics,
      entities: analysis.entities.map(e => ({ text: e.text, type: e.type })),
      sentiment: analysis.sentiment,
      quality: analysis.quality.overall
    }
  }

  async analyzeData(data: number[]): Promise<{
    summary: string
    statistics: Record<string, number>
    trend: string
    anomalies: number
    forecast: number[]
  }> {
    const result = enhancedDataAnalyzer.analyze(data, {
      detectAnomalies: true,
      forecast: true
    })
    
    return {
      summary: `Analyzed ${result.summary.count} data points with mean ${result.summary.mean.toFixed(2)}`,
      statistics: {
        mean: result.summary.mean,
        median: result.summary.median,
        stdDev: result.summary.stdDev,
        min: result.summary.min,
        max: result.summary.max
      },
      trend: result.trends?.direction || 'stable',
      anomalies: result.anomalies?.anomalies.length || 0,
      forecast: result.forecast?.values || []
    }
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

  setDefaultModel(modelId: string): void {
    if (this.registry.models.has(modelId)) {
      this.registry.defaultModel = modelId
    }
  }

  addFallbackModel(modelId: string): void {
    if (this.registry.models.has(modelId) && !this.registry.fallbackModels.includes(modelId)) {
      this.registry.fallbackModels.push(modelId)
    }
  }

  removeFallbackModel(modelId: string): void {
    const index = this.registry.fallbackModels.indexOf(modelId)
    if (index > -1) {
      this.registry.fallbackModels.splice(index, 1)
    }
  }

  getStats(): {
    totalModels: number
    enabledModels: number
    totalRequests: number
    averageLatency: number
  } {
    const models = Array.from(this.registry.models.values())
    return {
      totalModels: models.length,
      enabledModels: models.filter(m => m.enabled).length,
      totalRequests: 0,
      averageLatency: 0
    }
  }
}

export const aiModelOrchestrator = AIModelOrchestrator.getInstance()

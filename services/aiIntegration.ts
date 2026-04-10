import { globalSemanticEngine, SemanticEngine, SemanticIntent } from '../utils/localAI/SEMANTIC_ENGINE'
import { autonomousThinker } from '../utils/localAI/AUTONOMOUS_THINKER'
import { ComplexInstructionParser, ParsedInstruction } from '../utils/documentAI/INSTRUCTION_PARSER'
import { InstructionExecutor, ExecutionResult } from '../utils/documentAI/INSTRUCTION_EXECUTOR'
import { DocumentAnalyzer, DocumentAnalysisResult } from '../utils/documentAI/DOCUMENT_ANALYZER'
import { getOpenClawBridge, OpenClawBridge, BridgeRequest, BridgeResponse } from '../utils/openclaw/bridge'
import { aiManager, AIManager } from '../utils/ai'
import { aiSearchService, SearchResult, SearchQuery } from '../utils/AISearchService'
import { modelService } from '../utils/localAI/ModelService'

export interface AIConfig {
  useOpenClaw: boolean
  openClawEndpoint?: string
  modelPath?: string
  language: 'zh' | 'en' | 'auto'
  enableLearning: boolean
}

export interface AIResponse {
  text: string
  confidence: number
  language: string
  source: 'local' | 'openclaw' | 'hybrid' | 'autonomous'
  metadata?: Record<string, unknown>
}

export interface AIState {
  isInitialized: boolean
  isLoading: boolean
  modelLoaded: boolean
  openClawAvailable: boolean
  currentModel: string | null
  error: string | null
}

class AIIntegration {
  private static instance: AIIntegration
  private config: AIConfig
  private state: AIState
  private semanticEngine: SemanticEngine
  private instructionExecutor: InstructionExecutor | null = null
  private openClawBridge: OpenClawBridge | null = null
  private aiManager: AIManager | null = null

  private constructor() {
    this.config = {
      useOpenClaw: true,
      language: 'auto',
      enableLearning: true,
    }
    
    this.state = {
      isInitialized: false,
      isLoading: false,
      modelLoaded: false,
      openClawAvailable: false,
      currentModel: null,
      error: null,
    }
    
    this.semanticEngine = globalSemanticEngine
  }

  static getInstance(): AIIntegration {
    if (!AIIntegration.instance) {
      AIIntegration.instance = new AIIntegration()
    }
    return AIIntegration.instance
  }

  async initialize(config?: Partial<AIConfig>): Promise<void> {
    if (this.state.isInitialized) {
      return
    }

    this.state.isLoading = true
    this.config = { ...this.config, ...config }

    try {
      if (this.config.useOpenClaw) {
        try {
          this.openClawBridge = getOpenClawBridge()
          const initialized = await this.openClawBridge.initialize()
          this.state.openClawAvailable = initialized
          console.log(`OpenClaw initialized: ${initialized}`)
        } catch (e) {
          console.warn('OpenClaw bridge not available:', e)
          this.state.openClawAvailable = false
        }
      }

      // 加载预训练模型
      this.aiManager = aiManager
      const modelPath = this.config.modelPath || 'output/full_training/sft/final'
      console.log(`Loading pretrained model from: ${modelPath}`)
      await this.aiManager.initialize(modelPath, (progress) => {
        console.log(`Model loading: ${progress.progress}%`)
      })
      this.state.modelLoaded = true
      this.state.currentModel = modelPath

      this.instructionExecutor = new InstructionExecutor('')
      
      this.state.isInitialized = true
      this.state.error = null
      console.log('AI Integration initialized with pretrained model')
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Initialization failed'
      console.error('AI Integration initialization error:', error)
    } finally {
      this.state.isLoading = false
    }
  }

  getState(): AIState {
    return { ...this.state }
  }

  async chat(
    message: string,
    context?: Record<string, unknown>
  ): Promise<AIResponse> {
    this.ensureInitialized()

    const language = this.detectLanguage(message)

    // 优先使用Ollama/LocalAI本地模型
    try {
      const result = await modelService.generate(message)
      if (result.success && result.data) {
        return {
          text: result.data,
          confidence: 0.9,
          language,
          source: 'autonomous',
          metadata: { provider: modelService.getCurrentProvider(), model: modelService.getCurrentModel() },
        }
      }
    } catch (error) {
      console.warn('Local AI model failed, trying OpenClaw:', error)
    }

    // 回退到OpenClaw
    if (this.state.openClawAvailable && this.openClawBridge) {
      try {
        const request: BridgeRequest = {
          input: message,
          type: 'text',
          context: context as Partial<BridgeRequest['context']>
        }
        const response: BridgeResponse = await this.openClawBridge.process(request)
        return {
          text: response.content,
          confidence: response.metadata.confidence,
          language,
          source: 'openclaw',
          metadata: { thinking: response.thinking, actions: response.actions },
        }
      } catch (error) {
        console.warn('OpenClaw chat failed, falling back to autonomous thinker:', error)
      }
    }

    // 使用自主思考机制
    try {
      const result = await autonomousThinker.processRequest(message, context as Record<string, any>)
      return {
        text: result.response,
        confidence: result.confidence,
        language,
        source: 'autonomous',
        metadata: { 
          thinking: result.thinking, 
          actionPlan: result.actionPlan,
          autonomous: true
        },
      }
    } catch (error) {
      console.warn('Autonomous thinker failed, falling back to basic response:', error)
      const intent = this.semanticEngine.analyze(message)
      const responseLanguage = language
      return {
        text: this.generateLocalResponse(intent, responseLanguage),
        confidence: intent.confidence,
        language,
        source: 'local',
        metadata: { intent },
      }
    }
  }

  async generateText(
    prompt: string,
    options?: {
      maxTokens?: number
      temperature?: number
      language?: 'zh' | 'en' | 'auto'
    }
  ): Promise<AIResponse> {
    this.ensureInitialized()

    const language = options?.language || this.detectLanguage(prompt)

    // 优先使用Ollama/LocalAI本地模型
    try {
      const result = await modelService.generate(prompt, {
        maxTokens: options?.maxTokens || 100,
        temperature: options?.temperature || 0.7,
      })
      if (result.success && result.data) {
        return {
          text: result.data,
          confidence: 0.9,
          language,
          source: 'local',
          metadata: { provider: modelService.getCurrentProvider() },
        }
      }
    } catch (error) {
      console.warn('Local model generate failed, falling back:', error)
    }

    // 回退到原有逻辑
    if (this.state.modelLoaded && this.aiManager) {
      const result = await this.aiManager.generate(prompt, {
        maxTokens: options?.maxTokens || 100,
        temperature: options?.temperature || 0.7,
      })

      return {
        text: result,
        confidence: 0.85,
        language,
        source: 'local',
      }
    }

    const intent = this.semanticEngine.analyze(prompt)
    const responseLanguage = language === 'auto' ? 'en' : language
    
    return {
      text: this.generateLocalResponse(intent, responseLanguage),
      confidence: 0.75,
      language,
      source: 'local',
    }
  }

  async analyzeDocument(
    content: string,
    _type?: string
  ): Promise<AIResponse> {
    this.ensureInitialized()

    const language = this.detectLanguage(content)
    const result: DocumentAnalysisResult = DocumentAnalyzer.analyze(content)

    return {
      text: this.formatDocumentAnalysis(result, language),
      confidence: 0.85,
      language,
      source: 'local',
      metadata: {
        elements: result.elements,
        statistics: result.statistics,
        structure: result.structure,
      },
    }
  }

  async parseInstruction(
    text: string
  ): Promise<ParsedInstruction> {
    return ComplexInstructionParser.parse(text)
  }

  async executeInstruction(
    instruction: ParsedInstruction,
    context?: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const documentContent = (context?.documentContent as string) || ''
    if (!this.instructionExecutor) {
      this.instructionExecutor = new InstructionExecutor(documentContent)
    }
    const result = this.instructionExecutor.executeComplexInstruction(instruction.instructions.map(i => i.originalText).join('; '))
    return {
      stepId: 'batch',
      success: result.results.every(r => r.success),
      action: 'execute',
      target: 'document',
      changes: result.changes,
      message: result.summary,
      timestamp: new Date()
    }
  }

  async processCommand(
    command: string,
    context?: Record<string, unknown>
  ): Promise<AIResponse> {
    this.ensureInitialized()

    const instruction = await this.parseInstruction(command)
    
    if (instruction.instructions.length > 0) {
      const result = await this.executeInstruction(instruction, context)
      
      return {
        text: result.message || 'Command executed',
        confidence: result.success ? 0.9 : 0.5,
        language: this.detectLanguage(command),
        source: 'local',
        metadata: {
          instructionCount: instruction.instructions.length,
          success: result.success,
        },
      }
    }

    return this.chat(command, context)
  }

  async searchWeb(
    query: string,
    options?: { maxResults?: number }
  ): Promise<SearchResult[]> {
    this.ensureInitialized()

    const searchQuery: SearchQuery = {
      keywords: query.split(/\s+/),
      limit: options?.maxResults || 10
    }
    const results = await aiSearchService.search(searchQuery)
    
    return results
  }

  async translate(
    text: string,
    targetLanguage: 'zh' | 'en'
  ): Promise<AIResponse> {
    this.ensureInitialized()

    if (this.state.openClawAvailable && this.openClawBridge) {
      try {
        const request: BridgeRequest = {
          input: `Translate the following text to ${targetLanguage === 'zh' ? 'Chinese' : 'English'}: ${text}`,
          type: 'text'
        }
        const response: BridgeResponse = await this.openClawBridge.process(request)
        return {
          text: response.content,
          confidence: 0.95,
          language: targetLanguage,
          source: 'openclaw',
        }
      } catch (error) {
        console.warn('OpenClaw translation failed, falling back:', error)
      }
    }

    return {
      text: `[Translation placeholder: ${text.substring(0, 50)}...]`,
      confidence: 0.5,
      language: targetLanguage,
      source: 'local',
    }
  }

  async summarize(
    text: string,
    options?: { maxLength?: number; language?: 'zh' | 'en' | 'auto' }
  ): Promise<AIResponse> {
    this.ensureInitialized()

    const language = options?.language || this.detectLanguage(text)
    const summaryLanguage = language === 'auto' ? 'en' : language
    
    const analysis: DocumentAnalysisResult = DocumentAnalyzer.analyze(text)
    const summary = this.generateSummary(analysis, options?.maxLength || 200, summaryLanguage)

    return {
      text: summary,
      confidence: 0.8,
      language,
      source: 'local',
    }
  }

  detectLanguage(text: string): 'zh' | 'en' {
    const hanCount = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length
    
    if (hanCount > latinCount) {
      return 'zh'
    }
    return 'en'
  }

  learn(pattern: {
    input: string
    output: string
    context?: Record<string, unknown>
  }): void {
    if (!this.config.enableLearning) {
      return
    }

    this.semanticEngine.updateUserPreference(pattern.input, pattern.output)
  }

  private generateLocalResponse(intent: SemanticIntent, language: 'zh' | 'en' = 'en'): string {
    const responses: Record<string, Record<'zh' | 'en', string[]>> = {
      greeting: {
        zh: [
          '你好！有什么我可以帮助你的吗？',
          '您好！我是您的智能助手。',
          '你好！请问有什么需要帮助的？',
          '嗨！很高兴为您服务。',
          '你好！我是PaperPower AI助手，随时为您提供帮助。',
        ],
        en: [
          'Hello! How can I help you?',
          'Hi! I am your intelligent assistant.',
          'Hello! What can I help you with today?',
          'Hi there! I\'m here to help you.',
          'Hello! I\'m PaperPower AI assistant, ready to assist you.',
        ],
      },
      help: {
        zh: [
          '我可以帮助您处理文档、分析数据、生成内容等任务。',
          '我支持多种功能：文档格式化、内容生成、翻译、摘要等。',
          '我可以帮您创建PPT、Word文档、Excel表格，还可以进行图片融合。',
          '您可以让我帮您写报告、分析数据、管理文件等。',
          '我提供全方位的办公助手服务，包括文档处理、内容创作、数据分析等。',
        ],
        en: [
          'I can help you with document processing, data analysis, content generation, and other tasks.',
          'I support multiple functions: document formatting, content generation, translation, summarization, etc.',
          'I can help you create PPTs, Word documents, Excel spreadsheets, and also perform image fusion.',
          'You can ask me to write reports, analyze data, manage files, etc.',
          'I provide comprehensive office assistant services, including document processing, content creation, data analysis, etc.',
        ],
      },
      chat: {
        zh: [
          '我理解您的意思了。',
          '好的，让我来处理这个请求。',
          '收到，我来帮您处理。',
          '明白，我会尽快为您完成。',
          '好的，我正在处理您的请求。',
        ],
        en: [
          'I understand what you mean.',
          'Alright, let me handle this request.',
          'Got it, I will help you with this.',
          'Understood, I\'ll get this done for you.',
          'Okay, I\'m processing your request.',
        ],
      },
      command: {
        zh: [
          '好的，我会执行这个命令。',
          '收到，正在执行您的指令。',
          '好的，我会按照您的要求执行。',
          '明白，我会立即执行这个操作。',
          '好的，正在处理您的命令。',
        ],
        en: [
          'Alright, I\'ll execute this command.',
          'Got it, executing your instruction now.',
          'Okay, I\'ll follow your request.',
          'Understood, I\'ll perform this operation immediately.',
          'Okay, processing your command now.',
        ],
      },
      document: {
        zh: [
          '我可以帮您处理文档相关的任务。',
          '好的，我会为您处理这个文档。',
          '收到，我来帮您处理文档相关的工作。',
          '明白，我会为您提供文档处理服务。',
          '好的，我会帮您完成文档相关的任务。',
        ],
        en: [
          'I can help you with document-related tasks.',
          'Okay, I\'ll handle this document for you.',
          'Got it, I\'ll help you with document-related work.',
          'Understood, I\'ll provide document processing services for you.',
          'Okay, I\'ll help you complete document-related tasks.',
        ],
      },
      question: {
        zh: [
          '好的，我来回答您的问题。',
          '收到，我会为您解答这个问题。',
          '好的，我会详细回答您的问题。',
          '明白，我会为您提供准确的答案。',
          '好的，我来帮您解答这个问题。',
        ],
        en: [
          'Okay, I\'ll answer your question.',
          'Got it, I\'ll explain this to you.',
          'Okay, I\'ll provide a detailed answer to your question.',
          'Understood, I\'ll give you an accurate answer.',
          'Okay, I\'ll help you with this question.',
        ],
      },
      unknown: {
        zh: [
          '抱歉，我不太理解您的意思。请换一种方式描述。',
          '能否更详细地说明您的需求？',
          '抱歉，我没有理解您的请求，请再详细说明一下。',
          '请您再详细描述一下您的需求，以便我更好地帮助您。',
          '抱歉，我不太明白您的意思，能否换一种方式表达？',
        ],
        en: [
          'Sorry, I don\'t quite understand what you mean. Please describe it in another way.',
          'Could you please provide more details about your request?',
          'Sorry, I didn\'t understand your request. Could you please elaborate?',
          'Please provide more details about your needs so I can better help you.',
          'Sorry, I don\'t quite get what you mean. Could you express it differently?',
        ],
      },
    }

    const type = intent.type || 'unknown'
    const typeResponses = responses[type] || responses.unknown
    const languageResponses = typeResponses[language] || typeResponses.en
    return languageResponses[Math.floor(Math.random() * languageResponses.length)]
  }

  private formatDocumentAnalysis(result: DocumentAnalysisResult, language: 'zh' | 'en' = 'en'): string {
    const lines = language === 'zh' ? [
      `文档分析结果：`,
      `- 总元素数：${result.statistics.totalElements}`,
      `- 标题数：${result.statistics.headings}`,
      `- 段落数：${result.statistics.paragraphs}`,
      `- 问题数：${result.statistics.issues}`,
    ] : [
      `Document analysis result:`,
      `- Total elements: ${result.statistics.totalElements}`,
      `- Headings: ${result.statistics.headings}`,
      `- Paragraphs: ${result.statistics.paragraphs}`,
      `- Issues: ${result.statistics.issues}`,
    ]
    
    if (result.suggestions.length > 0) {
      lines.push(language === 'zh' ? `\n建议：` : `\nSuggestions:`)
      result.suggestions.slice(0, 5).forEach((s, i) => {
        lines.push(`${i + 1}. ${s}`)
      })
    }
    
    return lines.join('\n')
  }

  private generateSummary(analysis: DocumentAnalysisResult, maxLength: number, language?: 'zh' | 'en'): string {
    const lang = language || 'en'
    const headings = analysis.elements
      .filter(e => e.type.startsWith('heading'))
      .map(e => e.content)
      .slice(0, 5)
    
    if (headings.length > 0) {
      const summary = lang === 'zh' 
        ? `文档主要包含以下内容：${headings.join('、')}`
        : `The document mainly contains the following content: ${headings.join(', ')}`
      return summary.length > maxLength ? summary.substring(0, maxLength) + '...' : summary
    }
    
    const firstParagraph = analysis.elements.find(e => e.type === 'paragraph')?.content || ''
    return firstParagraph.length > maxLength 
      ? firstParagraph.substring(0, maxLength) + '...' 
      : firstParagraph
  }

  private ensureInitialized(): void {
    if (!this.state.isInitialized && !this.state.isLoading) {
      console.warn('AI Integration not initialized. Call initialize() first.')
    }
  }
}

export const aiIntegration = AIIntegration.getInstance()

export { AIIntegration }

export function createAIIntegration(config?: Partial<AIConfig>): AIIntegration {
  const instance = AIIntegration.getInstance()
  instance.initialize(config)
  return instance
}

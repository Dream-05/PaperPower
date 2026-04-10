

export interface SemanticIntent {
  type: string
  confidence: number
  action?: string
  entities?: SemanticEntity[]
  parameters?: Record<string, unknown>
}

export interface SemanticEntity {
  type: string
  value: string
  start?: number
  end?: number
}

export interface KnowledgeBase {
  intents: Map<string, string[]>
  entities: Map<string, string[]>
  actions: Map<string, ActionDefinition>
}

export interface ActionDefinition {
  name: string
  description: string
  parameters: ParameterDefinition[]
}

export interface ParameterDefinition {
  name: string
  type: string
  required: boolean
  description: string
}

export class SemanticEngine {
  private knowledgeBase: KnowledgeBase
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; intent?: SemanticIntent; timestamp?: Date }> = []
  private learnedPatterns: Map<string, string[]> = new Map()
  private userPreferences: Map<string, unknown> = new Map()

  constructor() {
    this.knowledgeBase = this.initializeKnowledgeBase()
  }

  private initializeKnowledgeBase(): KnowledgeBase {
    return {
      intents: new Map([
        ['greeting', ['你好', '您好', 'hello', 'hi']],
        ['help', ['帮助', 'help', '怎么用']],
        ['format', ['格式化', '居中', '加粗', 'format', 'bold', 'center']],
        ['generate', ['生成', '创建', '写', 'generate', 'create', 'write']],
        ['analyze', ['分析', '统计', 'analyze', 'statistics']],
      ]),
      entities: new Map([
        ['document', ['文档', '文件', 'document', 'file']],
        ['paragraph', ['段落', 'paragraph']],
        ['heading', ['标题', 'heading']],
      ]),
      actions: new Map([
        ['format', { name: 'format', description: '格式化文本', parameters: [] }],
        ['generate', { name: 'generate', description: '生成内容', parameters: [] }],
        ['analyze', { name: 'analyze', description: '分析文档', parameters: [] }],
      ])
    }
  }

  analyze(text: string): SemanticIntent {
    const lowerText = text.toLowerCase()
    
    for (const [intent, keywords] of this.knowledgeBase.intents) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return {
            type: intent,
            confidence: 0.8,
            action: intent
          }
        }
      }
    }
    
    return {
      type: 'unknown',
      confidence: 0.3
    }
  }

  getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string; intent?: SemanticIntent; timestamp?: Date }> {
    return this.conversationHistory
  }

  clearConversationHistory(): void {
    this.conversationHistory = []
  }

  getContextFromHistory(): { recentTopics: string[]; lastAction?: string; userPreferences: Record<string, unknown> } {
    return {
      recentTopics: [],
      lastAction: undefined,
      userPreferences: Object.fromEntries(this.userPreferences)
    }
  }

  learnFromHistory(): void {
    this.saveLearnedData()
  }

  private saveLearnedData(): void {
    try {
      const data = {
        learnedPatterns: Object.fromEntries(this.learnedPatterns),
        userPreferences: Object.fromEntries(this.userPreferences)
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ai_learned_data', JSON.stringify(data))
      }
    } catch (e) {
      console.warn('Failed to save learned data:', e)
    }
  }

  updateUserPreference(key: string, value: unknown): void {
    this.userPreferences.set(key, value)
    this.saveLearnedData()
  }

  generateResponse(intent: SemanticIntent, input: string): { text: string; message: string; confidence: number; suggestions?: string[] } {
    return {
      text: `处理您的请求: ${input}`,
      message: `处理您的请求: ${input}`,
      confidence: intent.confidence,
      suggestions: ['继续', '帮助', '取消']
    }
  }
}

export const globalSemanticEngine = new SemanticEngine()

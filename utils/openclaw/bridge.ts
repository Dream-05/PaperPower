import { OpenClawClient, initializeOpenClaw } from './client'
import { skillRegistry } from './skills'
import { initializeSkillHandlers } from './handlers'
import {
  OpenClawConfig,
  ThinkingStep,
  AgentState,
  SessionContext
} from './types'
import { aiService } from '../aiService'

export interface BridgeRequest {
  input: string
  type: 'text' | 'document' | 'data' | 'command' | 'ppt' | 'excel' | 'word'
  context?: Partial<SessionContext>
  options?: {
    useOpenClaw?: boolean
    thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
    timeout?: number
  }
}

export interface BridgeResponse {
  success: boolean
  content: string
  thinking?: ThinkingStep[]
  actions?: Array<{
    name: string
    args: Record<string, unknown>
    result?: unknown
  }>
  source: 'openclaw' | 'local' | 'hybrid'
  state: AgentState
  metadata: {
    processingTime: number
    model: string
    tokens: number
    confidence: number
  }
}

export class OpenClawBridge {
  private client: OpenClawClient | null = null
  private initialized = false
  private fallbackEnabled = true

  async initialize(config: Partial<OpenClawConfig> = {}): Promise<boolean> {
    if (this.initialized) {
      return true
    }

    try {
      initializeSkillHandlers()
      this.client = initializeOpenClaw(config)
      
      const connected = await this.client.connect()
      
      if (connected) {
        this.registerLocalSkillHandlers()
        this.initialized = true
        console.log('[OpenClawBridge] Initialized successfully')
        return true
      }
      
      return false
    } catch (error) {
      console.error('[OpenClawBridge] Initialization failed:', error)
      return false
    }
  }

  private registerLocalSkillHandlers(): void {
    if (!this.client) return

    this.client.registerSkillHandler('ppt_generate', async (args) => {
      return skillRegistry.executeSkill('ppt_generate', args)
    })

    this.client.registerSkillHandler('document_format', async (args) => {
      return skillRegistry.executeSkill('document_structure', args)
    })

    this.client.registerSkillHandler('data_analyze', async (args) => {
      return skillRegistry.executeSkill('data_analyze', args)
    })

    this.client.registerSkillHandler('file_batch_rename', async (args) => {
      return skillRegistry.executeSkill('file_batch_rename', args)
    })

    this.client.registerSkillHandler('content_generator', async (args) => {
      return skillRegistry.executeSkill('content_generate', args)
    })

    this.client.registerSkillHandler('unified_search_engine', async (args) => {
      return skillRegistry.executeSkill('unified_search', args)
    })

    this.client.registerSkillHandler('formula_generate', async (args) => {
      return skillRegistry.executeSkill('formula_generate', args)
    })

    this.client.registerSkillHandler('chart_create', async (args) => {
      return skillRegistry.executeSkill('chart_create', args)
    })
  }

  async process(request: BridgeRequest): Promise<BridgeResponse> {
    const startTime = Date.now()
    const useOpenClaw = request.options?.useOpenClaw !== false

    if (useOpenClaw && this.client?.isReady()) {
      try {
        return await this.processWithOpenClaw(request, startTime)
      } catch (error) {
        console.error('[OpenClawBridge] OpenClaw processing failed:', error)
        
        if (this.fallbackEnabled) {
          return await this.processLocally(request, startTime, 'hybrid')
        }
        
        throw error
      }
    }

    return await this.processLocally(request, startTime, 'local')
  }

  private async processWithOpenClaw(request: BridgeRequest, startTime: number): Promise<BridgeResponse> {
    if (!this.client) {
      throw new Error('OpenClaw client not initialized')
    }

    const response = await this.client.executeWithThinking(
      request.input,
      request.context
    )

    const processingTime = Date.now() - startTime

    return {
      success: response.success,
      content: response.content,
      thinking: response.thinking,
      actions: response.actions?.map(a => ({
        name: a.name,
        args: a.args
      })),
      source: 'openclaw',
      state: response.metadata.state,
      metadata: {
        processingTime,
        model: response.metadata.model,
        tokens: response.metadata.tokens,
        confidence: this.calculateConfidence(response.thinking)
      }
    }
  }

  private async processLocally(request: BridgeRequest, startTime: number, source: 'local' | 'hybrid'): Promise<BridgeResponse> {
    const thinking: ThinkingStep[] = []
    
    // 分析用户输入
    thinking.push({
      type: 'analyze',
      description: '理解用户需求',
      result: `用户请求: ${request.input.substring(0, 30)}${request.input.length > 30 ? '...' : ''}`
    })

    const skill = skillRegistry.findSkillByTrigger(request.input)
    
    // 识别意图和匹配技能
    thinking.push({
      type: 'reason',
      description: '确定执行方案',
      result: skill ? `需要执行: ${skill.name}` : '需要进行综合分析',
      confidence: skill ? 0.8 : 0.5
    })

    let content = ''
    let actions: Array<{ name: string; args: Record<string, unknown>; result?: unknown }> = []

    if (skill) {
      // 制定执行计划
      thinking.push({
        type: 'plan',
        description: '制定执行计划',
        result: `准备执行: ${skill.name}`
      })

      const result = await skillRegistry.executeSkill(skill.name, {
        user_input: request.input,
        ...request.context
      })

      // 执行技能
      thinking.push({
        type: 'execute',
        description: '执行操作',
        result: result.success ? '操作完成' : `操作遇到问题: ${result.error}`
      })

      content = result.success 
        ? this.formatSkillOutput(result.output)
        : `执行失败: ${result.error}`
      
      actions = [{
        name: skill.name,
        args: { input: request.input },
        result: result.output
      }]
    } else {
      // 使用本地AI处理
      thinking.push({
        type: 'plan',
        description: '制定分析方案',
        result: '准备分析用户需求'
      })

      const localResponse = await aiService.process({
        input: request.input,
        type: this.mapRequestType(request.type),
        context: {
          userLanguage: request.context?.language
        }
      })

      // 处理完成
      thinking.push({
        type: 'execute',
        description: '完成分析',
        result: '分析完成，准备回复'
      })

      content = localResponse.result.text || ''
    }

    // 反思执行结果
    thinking.push({
      type: 'reflect',
      description: '确认结果',
      result: '处理完成，准备响应'
    })

    const processingTime = Date.now() - startTime

    return {
      success: true,
      content,
      thinking,
      actions,
      source,
      state: 'responding',
      metadata: {
        processingTime,
        model: 'local-nlp',
        tokens: this.estimateTokens(request.input + content),
        confidence: this.calculateConfidence(thinking)
      }
    }
  }

  private mapRequestType(type: BridgeRequest['type']): 'text' | 'document' | 'data' | 'command' {
    switch (type) {
      case 'ppt':
      case 'word':
      case 'excel':
        return 'document'
      case 'data':
        return 'data'
      case 'command':
        return 'command'
      default:
        return 'text'
    }
  }

  private formatSkillOutput(output: unknown): string {
    if (typeof output === 'string') {
      return output
    }
    if (output && typeof output === 'object') {
      const outObj = output as Record<string, unknown>
      if ('message' in outObj) {
        let result = String(outObj.message)
        if ('results' in outObj && Array.isArray(outObj.results)) {
          result += '\n\n找到的结果：\n'
          outObj.results.slice(0, 5).forEach((item: any, index: number) => {
            if (item.title && item.url) {
              result += `${index + 1}. ${item.title}\n   ${item.url}\n`
              if (item.snippet) {
                result += `   ${item.snippet}\n`
              }
            }
          })
        } else if ('task' in outObj) {
          result += '\n任务详情：'
          const taskObj = outObj.task as Record<string, unknown>
          Object.entries(taskObj).forEach(([key, value]) => {
            result += `\n${key}: ${value}`
          })
        } else if ('statistics' in outObj) {
          result += '\n统计结果：'
          const statsObj = outObj.statistics as Record<string, unknown>
          Object.entries(statsObj).forEach(([key, value]) => {
            result += `\n${key}: ${value}`
          })
        }
        return result
      }
    }
    return JSON.stringify(output, null, 2)
  }

  private calculateConfidence(thinking?: ThinkingStep[]): number {
    if (!thinking || thinking.length === 0) return 0.5
    
    const confidences = thinking
      .filter(t => t.confidence !== undefined)
      .map(t => t.confidence!)
    
    if (confidences.length === 0) return 0.7
    
    return confidences.reduce((a, b) => a + b, 0) / confidences.length
  }

  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const otherChars = text.length - chineseChars
    return Math.ceil(chineseChars * 1.5 + otherChars / 4)
  }

  isReady(): boolean {
    return this.client?.isReady() ?? false
  }

  getState(): AgentState {
    return this.client?.getState() ?? 'error'
  }

  getAvailableSkills() {
    return skillRegistry.getAllSkills()
  }

  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }
    this.initialized = false
  }
}

let bridgeInstance: OpenClawBridge | null = null

export function getOpenClawBridge(): OpenClawBridge {
  if (!bridgeInstance) {
    bridgeInstance = new OpenClawBridge()
  }
  return bridgeInstance
}

export async function initializeBridge(config: Partial<OpenClawConfig> = {}): Promise<OpenClawBridge> {
  const bridge = getOpenClawBridge()
  await bridge.initialize(config)
  return bridge
}

export async function processWithOpenClaw(request: BridgeRequest): Promise<BridgeResponse> {
  const bridge = getOpenClawBridge()
  
  if (!bridge.isReady()) {
    await bridge.initialize()
  }
  
  return bridge.process(request)
}

import {
  OpenClawConfig,
  OpenClawResponse,
  OpenClawSession,
  SessionContext,
  AgentAction,
  AgentState,
  DEFAULT_CONFIG,
  SkillDefinition,
  SkillExecutionResult,
  ZHIBAN_SKILLS,
  ThinkingStep
} from './types'

export class OpenClawClient {
  private config: OpenClawConfig
  private sessions: Map<string, OpenClawSession> = new Map()
  private requestId = 0
  private skills: Map<string, SkillDefinition> = new Map()
  private skillHandlers: Map<string, (args: Record<string, unknown>) => Promise<SkillExecutionResult>> = new Map()
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'

  constructor(config: Partial<OpenClawConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initializeSkills()
    this.connectionState = 'connected'
  }

  private initializeSkills(): void {
    for (const skill of ZHIBAN_SKILLS) {
      this.skills.set(skill.name, skill)
    }
  }

  registerSkillHandler(skillName: string, handler: (args: Record<string, unknown>) => Promise<SkillExecutionResult>): void {
    this.skillHandlers.set(skillName, handler)
  }

  async connect(): Promise<boolean> {
    this.connectionState = 'connected'
    console.log('[OpenClaw] Using local API mode')
    return true
  }





  async createSession(context?: Partial<SessionContext>): Promise<string> {
    const sessionId = `session_${Date.now()}_${++this.requestId}`
    
    const session: OpenClawSession = {
      id: sessionId,
      created: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      state: 'idle',
      context: {
        recentActions: [],
        userPreferences: {},
        language: 'zh',
        ...context
      }
    }

    this.sessions.set(sessionId, session)
    return sessionId
  }

  async sendMessage(sessionId: string, content: string): Promise<OpenClawResponse> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    session.lastActivity = new Date()
    session.messageCount++
    session.state = 'thinking'

    const thinking: ThinkingStep[] = []
    
    thinking.push({
      type: 'analyze',
      description: '分析用户输入',
      result: `输入长度: ${content.length}字符`
    })

    const skill = this.findSkillByTrigger(content)
    
    thinking.push({
      type: 'reason',
      description: '识别意图和匹配技能',
      result: skill ? `匹配技能: ${skill.name}` : '使用通用处理流程',
      confidence: skill ? 0.8 : 0.5
    })

    let responseContent = ''
    let actions: AgentAction[] = []

    if (skill) {
      thinking.push({
        type: 'plan',
        description: '制定执行计划',
        result: `将执行技能: ${skill.name}`
      })

      const handler = this.skillHandlers.get(skill.name)
      if (handler) {
        const result = await handler({ input: content, ...session.context })
        
        thinking.push({
          type: 'execute',
          description: '执行技能',
          result: result.success ? '执行成功' : `执行失败: ${result.error}`
        })

        responseContent = result.success 
          ? this.formatSkillOutput(result.output)
          : `执行失败: ${result.error}`
        
        actions = [{
          name: skill.name,
          args: { input: content }
        }]
      }
    } else {
      thinking.push({
        type: 'plan',
        description: '使用本地AI处理',
        result: '调用本地AI服务'
      })

      try {
          // 直接使用本地AI服务，不依赖外部API
          const { aiService } = await import("../aiService")
        
        const localResponse = await aiService.process({
          input: content,
          type: 'text',
          context: {
            userLanguage: session.context.language
          }
        })

        thinking.push({
          type: 'execute',
          description: '本地AI处理完成',
          result: `置信度: ${(localResponse.result.confidence * 100).toFixed(1)}%`
        })

        responseContent = localResponse.result.text || '处理完成'
      } catch (error) {
        thinking.push({
          type: 'execute',
          description: '本地AI处理',
          result: `处理失败: ${error}`
        })
        
        responseContent = '抱歉，处理您的请求时出现错误。'
      }
    }

    thinking.push({
      type: 'reflect',
      description: '反思执行结果',
      result: '处理完成，准备响应'
    })

    session.state = 'responding'

    return {
      success: true,
      content: responseContent,
      thinking,
      actions,
      session,
      metadata: {
        processingTime: 0,
        model: this.config.model,
        tokens: 0,
        state: 'responding'
      }
    }
  }

  private findSkillByTrigger(input: string): SkillDefinition | undefined {
    const inputLower = input.toLowerCase()
    
    for (const skill of this.skills.values()) {
      if (skill.triggers) {
        for (const trigger of skill.triggers) {
          if (inputLower.includes(trigger.toLowerCase())) {
            return skill
          }
        }
      }
    }
    
    return undefined
  }

  async executeWithThinking(
    content: string,
    context?: Partial<SessionContext>
  ): Promise<OpenClawResponse> {
    const sessionId = await this.createSession(context)
    return this.sendMessage(sessionId, content)
  }

  getSession(sessionId: string): OpenClawSession | undefined {
    return this.sessions.get(sessionId)
  }

  getAllSessions(): OpenClawSession[] {
    return Array.from(this.sessions.values())
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

  closeSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  disconnect(): void {
    this.connectionState = 'disconnected'
    this.sessions.clear()
  }

  getState(): AgentState {
    return this.connectionState === 'connected' ? 'idle' : 'error'
  }

  isReady(): boolean {
    return this.connectionState === 'connected'
  }

  getAvailableSkills(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  registerCustomSkill(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill)
  }
}

let clientInstance: OpenClawClient | null = null

export function getOpenClawClient(config?: Partial<OpenClawConfig>): OpenClawClient {
  if (!clientInstance) {
    clientInstance = new OpenClawClient(config)
  }
  return clientInstance
}

export function initializeOpenClaw(config: Partial<OpenClawConfig> = {}): OpenClawClient {
  clientInstance = new OpenClawClient(config)
  return clientInstance
}

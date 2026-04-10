/**
 * 前端多智能体服务客户端
 * Frontend Multi-Agent Service Client
 */

import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000/api'

export interface ChatRequest {
  message: string
  user_id?: string
  session_id?: string
  use_multi_agent?: boolean
  provider?: string
}

export interface ChatResponse {
  success: boolean
  response: string
  intent?: string
  agent_used?: string
  task_id?: string
  thinking?: Array<{ type: string; description: string; result: string }>
  metadata?: Record<string, any>
}

export interface AgentStatus {
  name: string
  capability: string
  task_types: string[]
  current_tasks: number
  max_tasks: number
  available: boolean
}

export interface TaskStatus {
  id: string
  description: string
  task_type: string
  status: 'pending' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed'
  assigned_agent?: string
  result?: any
  error?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

class MultiAgentService {
  private baseUrl: string
  private ws: WebSocket | null = null
  private messageHandlers: Array<(data: any) => void> = []

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/chat`, {
        message: request.message,
        user_id: request.user_id || 'default',
        session_id: request.session_id,
        use_multi_agent: request.use_multi_agent !== false,
        provider: request.provider
      })
      
      return response.data
    } catch (error: any) {
      console.error('Multi-agent chat error:', error)
      return {
        success: false,
        response: `服务连接失败: ${error.message}`,
        metadata: { error: error.message }
      }
    }
  }

  async quickProcess(input: string, options?: {
    type?: 'text' | 'document' | 'data' | 'command' | 'ppt' | 'excel' | 'word'
    language?: 'zh' | 'en'
    useMultiAgent?: boolean
  }): Promise<{
    success: boolean
    content: string
    thinking?: Array<{ type: string; description: string; result: string }>
  }> {
    const response = await this.chat({
      message: input,
      use_multi_agent: options?.useMultiAgent !== false
    })
    
    return {
      success: response.success,
      content: response.response,
      thinking: response.thinking
    }
  }

  async getAgents(): Promise<{
    agents: Record<string, AgentStatus>
    statistics: Record<string, any>
  }> {
    const response = await axios.get(`${this.baseUrl}/agents`)
    return response.data
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/tasks/${taskId}`)
      return response.data
    } catch {
      return null
    }
  }

  async getAllTasks(): Promise<TaskStatus[]> {
    const response = await axios.get(`${this.baseUrl}/tasks`)
    return response.data.tasks
  }

  async getProviders(): Promise<{
    providers: string[]
    priority: string[]
  }> {
    const response = await axios.get(`${this.baseUrl}/providers`)
    return response.data
  }

  async aiGenerate(prompt: string, provider?: string, systemPrompt?: string): Promise<{
    success: boolean
    content: string
    model: string
    provider: string
    latency_ms: number
    error?: string
  }> {
    const response = await axios.post(`${this.baseUrl}/ai/generate`, null, {
      params: {
        prompt,
        provider: provider || '',
        system_prompt: systemPrompt || ''
      }
    })
    return response.data
  }

  connectWebSocket(onMessage: (data: any) => void): void {
    if (this.ws) {
      this.ws.close()
    }

    const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://')
    this.ws = new WebSocket(`${wsUrl}/ws`)
    
    this.ws.onopen = () => {
      console.log('WebSocket connected to Multi-Agent System')
    }
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      onMessage(data)
      this.messageHandlers.forEach(handler => handler(data))
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  addMessageHandler(handler: (data: any) => void): void {
    this.messageHandlers.push(handler)
  }

  removeMessageHandler(handler: (data: any) => void): void {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler)
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.messageHandlers = []
  }

  async healthCheck(): Promise<{
    status: string
    timestamp: string
    agents_ready: boolean
  }> {
    const response = await axios.get(`${this.baseUrl}/../health`)
    return response.data
  }
}

export const multiAgentService = new MultiAgentService()
export default multiAgentService

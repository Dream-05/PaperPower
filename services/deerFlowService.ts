import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000/api/deerflow'

export interface WorkflowDefinition {
  workflow_id: string
  name: string
  description: string
  version: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables: Record<string, any>
  metadata: Record<string, any>
}

export interface WorkflowNode {
  node_id: string
  node_type: 'start' | 'end' | 'task' | 'condition' | 'parallel'
  name: string
  description?: string
  config?: Record<string, any>
  position?: { x: number; y: number }
}

export interface WorkflowEdge {
  edge_id: string
  source_node_id: string
  target_node_id: string
  condition?: string
  label?: string
}

export interface WorkflowInstance {
  instance_id: string
  workflow_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  context: Record<string, any>
  current_node_id?: string
  execution_history: Array<{
    node_id: string
    node_name: string
    timestamp: string
    success: boolean
    output?: any
    error?: string
  }>
  started_at?: string
  completed_at?: string
  error?: string
}

export interface WorkflowTemplate {
  workflow_id: string
  name: string
  description: string
  node_count: number
  edge_count: number
}

class DeerFlowService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async createWorkflow(name: string, description: string = '', template?: string): Promise<WorkflowDefinition> {
    const response = await axios.post(`${this.baseUrl}/workflows`, {
      name,
      description,
      template,
    })
    return response.data
  }

  async getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/workflows/${workflowId}`)
      return response.data
    } catch (error) {
      return null
    }
  }

  async updateWorkflow(workflowId: string, updates: Partial<WorkflowDefinition>): Promise<WorkflowDefinition | null> {
    try {
      const response = await axios.put(`${this.baseUrl}/workflows/${workflowId}`, updates)
      return response.data
    } catch (error) {
      return null
    }
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    try {
      await axios.delete(`${this.baseUrl}/workflows/${workflowId}`)
      return true
    } catch (error) {
      return false
    }
  }

  async listWorkflows(): Promise<Array<{
    workflow_id: string
    name: string
    description: string
    version: string
    node_count: number
    edge_count: number
    created_at: string
    updated_at: string
  }>> {
    const response = await axios.get(`${this.baseUrl}/workflows`)
    return response.data
  }

  async getTemplates(): Promise<Record<string, WorkflowTemplate>> {
    const response = await axios.get(`${this.baseUrl}/templates`)
    return response.data
  }

  async executeWorkflow(workflowId: string, context: Record<string, any> = {}): Promise<string> {
    const response = await axios.post(`${this.baseUrl}/workflows/${workflowId}/execute`, {
      context,
    })
    return response.data.instance_id
  }

  async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/instances/${instanceId}`)
      return response.data
    } catch (error) {
      return null
    }
  }

  async getTaskStatus(taskId: string): Promise<{
    task_id: string
    task_type: string
    status: string
    result?: any
    error?: string
    progress: number
  } | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/tasks/${taskId}`)
      return response.data
    } catch (error) {
      return null
    }
  }

  async cancelTask(taskId: string): Promise<boolean> {
    try {
      await axios.post(`${this.baseUrl}/tasks/${taskId}/cancel`)
      return true
    } catch (error) {
      return false
    }
  }

  async getStats(): Promise<{
    pending: number
    running: number
    completed: number
    max_concurrent: number
  }> {
    const response = await axios.get(`${this.baseUrl}/stats`)
    return response.data
  }

  async executeTool(toolId: string, parameters: Record<string, any>): Promise<{
    success: boolean
    tool_id: string
    result?: any
    error?: string
    timestamp: string
  }> {
    const response = await axios.post(`${this.baseUrl}/tools/${toolId}/execute`, {
      parameters,
    })
    return response.data
  }

  async listTools(): Promise<Array<{
    tool_id: string
    name: string
    description: string
    category: string
    parameters: Record<string, any>
  }>> {
    const response = await axios.get(`${this.baseUrl}/tools`)
    return response.data
  }

  async runAgent(agentName: string, task: Record<string, any>): Promise<{
    success: boolean
    output?: any
    error?: string
  }> {
    const response = await axios.post(`${this.baseUrl}/agents/${agentName}/run`, {
      task,
    })
    return response.data
  }

  async listAgents(): Promise<string[]> {
    const response = await axios.get(`${this.baseUrl}/agents`)
    return response.data
  }
}

export const deerFlowService = new DeerFlowService()
export default deerFlowService

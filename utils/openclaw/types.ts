export type AgentState = 'idle' | 'thinking' | 'acting' | 'observing' | 'responding' | 'error'

export interface OpenClawConfig {
  gatewayUrl: string
  gatewayPort: number
  model: string
  thinkingLevel: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  verboseLevel: 'off' | 'minimal' | 'full'
  timeout: number
  retryAttempts: number
}

export interface OpenClawMessage {
  type: 'message' | 'init' | 'action' | 'tool_result' | 'response' | 'error' | 'status'
  content?: string
  session_id?: string
  thinking?: ThinkingStep[]
  actions?: AgentAction[]
  tool_result?: ToolResult
  error?: string
  state?: AgentState
}

export interface ThinkingStep {
  type: 'analyze' | 'reason' | 'plan' | 'execute' | 'reflect'
  description: string
  result: string
  confidence?: number
}

export interface AgentAction {
  name: string
  args: Record<string, unknown>
  description?: string
}

export interface ToolResult {
  action: string
  success: boolean
  output: string
  error?: string
}

export interface SkillDefinition {
  name: string
  description: string
  triggers: string[]
  handler: string
  parameters: SkillParameter[]
}

export interface SkillParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description: string
  default?: unknown
}

export interface OpenClawSession {
  id: string
  created: Date
  lastActivity: Date
  messageCount: number
  state: AgentState
  context: SessionContext
}

export interface SessionContext {
  activeDocument?: {
    type: 'ppt' | 'word' | 'excel' | 'other'
    name: string
    path?: string
  }
  recentActions: string[]
  userPreferences: Record<string, unknown>
  language: 'zh' | 'en'
}

export interface OpenClawResponse {
  success: boolean
  content: string
  thinking?: ThinkingStep[]
  actions?: AgentAction[]
  toolResults?: ToolResult[]
  session: OpenClawSession
  metadata: {
    processingTime: number
    model: string
    tokens: number
    state: AgentState
  }
}

export interface SkillExecutionResult {
  success: boolean
  output: unknown
  error?: string
  artifacts?: string[]
}

export const DEFAULT_CONFIG: OpenClawConfig = {
  gatewayUrl: 'ws://127.0.0.1',
  gatewayPort: 18789,
  model: 'anthropic/claude-sonnet-4',
  thinkingLevel: 'high',
  verboseLevel: 'minimal',
  timeout: 60000,
  retryAttempts: 3
}

export const ZHIBAN_SKILLS: SkillDefinition[] = [
  {
    name: 'ppt_generate',
    description: '生成PPT演示文稿',
    triggers: ['生成PPT', '创建演示文稿', '制作幻灯片', 'generate ppt', 'create presentation'],
    handler: 'ppt_generator',
    parameters: [
      { name: 'topic', type: 'string', required: true, description: 'PPT主题' },
      { name: 'slides', type: 'number', required: false, description: '幻灯片数量', default: 10 },
      { name: 'style', type: 'string', required: false, description: '风格', default: 'professional' }
    ]
  },
  {
    name: 'document_format',
    description: '格式化文档',
    triggers: ['格式化文档', '整理文档', 'format document', 'organize document'],
    handler: 'document_formatter',
    parameters: [
      { name: 'content', type: 'string', required: true, description: '文档内容' },
      { name: 'format', type: 'string', required: false, description: '目标格式', default: 'standard' }
    ]
  },
  {
    name: 'data_analyze',
    description: '数据分析',
    triggers: ['分析数据', '数据统计', 'analyze data', 'data statistics'],
    handler: 'data_analyzer',
    parameters: [
      { name: 'data', type: 'array', required: true, description: '数据' },
      { name: 'analysis_type', type: 'string', required: false, description: '分析类型', default: 'comprehensive' }
    ]
  },
  {
    name: 'file_batch_rename',
    description: '批量重命名文件',
    triggers: ['批量重命名', '重命名文件', 'batch rename', 'rename files'],
    handler: 'batch_renamer',
    parameters: [
      { name: 'directory', type: 'string', required: true, description: '目录路径' },
      { name: 'pattern', type: 'string', required: true, description: '命名模式' }
    ]
  },
  {
    name: 'app_launcher',
    description: '启动应用程序',
    triggers: ['打开Word', '启动Excel', '打开PPT', '打开浏览器', 'open word', 'start excel', 'launch powerpoint', 'open browser'],
    handler: 'app_launcher',
    parameters: [
      { name: 'app', type: 'string', required: true, description: '应用名称' },
      { name: 'args', type: 'array', required: false, description: '应用参数' }
    ]
  },
  {
    name: 'browser_opener',
    description: '打开网页',
    triggers: ['打开网页', '访问网站', 'open url', 'visit website'],
    handler: 'browser_opener',
    parameters: [
      { name: 'url', type: 'string', required: true, description: '网页地址' }
    ]
  },
  {
    name: 'file_opener',
    description: '打开文件',
    triggers: ['打开文件', '打开文档', 'open file', 'open document'],
    handler: 'file_opener',
    parameters: [
      { name: 'file', type: 'string', required: true, description: '文件路径' }
    ]
  },
  {
    name: 'unified_search_engine',
    description: '搜索网页',
    triggers: ['搜索', '查找', 'search', 'find'],
    handler: 'unified_search_engine',
    parameters: [
      { name: 'query', type: 'string', required: true, description: '搜索关键词' },
      { name: 'search_type', type: 'string', required: false, description: '搜索类型', default: 'web' },
      { name: 'max_results', type: 'number', required: false, description: '最大结果数', default: 10 }
    ]
  },
  {
    name: 'content_generator',
    description: '生成内容',
    triggers: ['写', '生成', '创建', 'write', 'generate', 'create'],
    handler: 'content_generator',
    parameters: [
      { name: 'instruction', type: 'string', required: true, description: '生成指令' },
      { name: 'document_type', type: 'string', required: false, description: '文档类型', default: 'document' },
      { name: 'style', type: 'string', required: false, description: '风格', default: 'professional' }
    ]
  },
  {
    name: 'rural_analysis_workflow',
    description: '农村分析报告工作流',
    triggers: ['农村分析', '农村发展', '农村报告', 'rural analysis', 'rural development'],
    handler: 'rural_analysis_workflow',
    parameters: [
      { name: 'topic', type: 'string', required: false, description: '分析主题', default: '农村发展' }
    ]
  },
  {
    name: 'workflow_executor',
    description: '执行工作流',
    triggers: ['执行工作流', '运行流程', 'execute workflow', 'run process'],
    handler: 'workflow_executor',
    parameters: [
      { name: 'workflow', type: 'array', required: true, description: '工作流步骤' },
      { name: 'params', type: 'object', required: false, description: '工作流参数' }
    ]
  }
]

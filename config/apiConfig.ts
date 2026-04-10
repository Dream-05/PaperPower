export interface ModelProvider {
  id: string
  name: string
  type: 'local' | 'openai' | 'anthropic' | 'custom'
  enabled: boolean
  requiresApiKey: boolean
  endpoint?: string
  models: ModelConfig[]
  pricing?: {
    inputPer1kTokens: number
    outputPer1kTokens: number
  }
  rateLimit: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
  timeout: number
  retryAttempts: number
  retryDelay: number
}

export interface ModelConfig {
  id: string
  name: string
  maxTokens: number
  supportsStreaming: boolean
  supportsFunctions: boolean
  contextWindow: number
  description: string
}

export interface ApiKeyConfig {
  provider: string
  key: string
  endpoint?: string
  isActive: boolean
  createdAt: number
  lastUsed?: number
  usageCount: number
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp: number
  requestId?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  metadata?: {
    model: string
    provider: string
    tokensUsed?: number
    latency: number
    requestId: string
  }
}

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'local',
    name: '本地模型',
    type: 'local',
    enabled: true,
    requiresApiKey: false,
    models: [
      {
        id: 'local-transformer',
        name: 'Local Transformer',
        maxTokens: 2048,
        supportsStreaming: true,
        supportsFunctions: true,
        contextWindow: 800000,
        description: 'PaperPower 本地模型，支持800K超长上下文，完全免费'
      }
    ],
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    },
    timeout: 30000,
    retryAttempts: 2,
    retryDelay: 1000
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    enabled: true,
    requiresApiKey: true,
    endpoint: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        maxTokens: 4096,
        supportsStreaming: true,
        supportsFunctions: true,
        contextWindow: 128000,
        description: '最新多模态模型，支持文本和图像理解'
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        maxTokens: 4096,
        supportsStreaming: true,
        supportsFunctions: true,
        contextWindow: 128000,
        description: '高性能模型，适合复杂任务'
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        maxTokens: 4096,
        supportsStreaming: true,
        supportsFunctions: true,
        contextWindow: 16385,
        description: '快速响应，性价比高'
      }
    ],
    pricing: {
      inputPer1kTokens: 0.005,
      outputPer1kTokens: 0.015
    },
    rateLimit: {
      requestsPerMinute: 500,
      tokensPerMinute: 90000
    },
    timeout: 60000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    enabled: true,
    requiresApiKey: true,
    endpoint: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        maxTokens: 4096,
        supportsStreaming: true,
        supportsFunctions: true,
        contextWindow: 200000,
        description: '最强大的模型，适合复杂分析和创作'
      },
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        maxTokens: 4096,
        supportsStreaming: true,
        supportsFunctions: true,
        contextWindow: 200000,
        description: '平衡性能与速度'
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        maxTokens: 4096,
        supportsStreaming: true,
        supportsFunctions: true,
        contextWindow: 200000,
        description: '快速响应，适合简单任务'
      }
    ],
    pricing: {
      inputPer1kTokens: 0.003,
      outputPer1kTokens: 0.015
    },
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    },
    timeout: 60000,
    retryAttempts: 3,
    retryDelay: 1000
  }
]

export const API_ERROR_CODES = {
  INVALID_API_KEY: 'E001',
  RATE_LIMIT_EXCEEDED: 'E002',
  MODEL_NOT_FOUND: 'E003',
  INSUFFICIENT_TOKENS: 'E004',
  TIMEOUT: 'E005',
  NETWORK_ERROR: 'E006',
  INVALID_REQUEST: 'E007',
  CONTENT_FILTERED: 'E008',
  SERVER_ERROR: 'E009',
  UNKNOWN_ERROR: 'E010'
} as const

export const API_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  zh: {
    [API_ERROR_CODES.INVALID_API_KEY]: 'API密钥无效或已过期',
    [API_ERROR_CODES.RATE_LIMIT_EXCEEDED]: '请求频率超限，请稍后再试',
    [API_ERROR_CODES.MODEL_NOT_FOUND]: '指定的模型不存在',
    [API_ERROR_CODES.INSUFFICIENT_TOKENS]: 'Token数量不足',
    [API_ERROR_CODES.TIMEOUT]: '请求超时，请检查网络连接',
    [API_ERROR_CODES.NETWORK_ERROR]: '网络错误，请检查网络连接',
    [API_ERROR_CODES.INVALID_REQUEST]: '请求参数无效',
    [API_ERROR_CODES.CONTENT_FILTERED]: '内容被过滤，请修改输入',
    [API_ERROR_CODES.SERVER_ERROR]: '服务器错误，请稍后再试',
    [API_ERROR_CODES.UNKNOWN_ERROR]: '未知错误'
  },
  en: {
    [API_ERROR_CODES.INVALID_API_KEY]: 'Invalid or expired API key',
    [API_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded, please try again later',
    [API_ERROR_CODES.MODEL_NOT_FOUND]: 'Specified model not found',
    [API_ERROR_CODES.INSUFFICIENT_TOKENS]: 'Insufficient tokens',
    [API_ERROR_CODES.TIMEOUT]: 'Request timeout, please check network connection',
    [API_ERROR_CODES.NETWORK_ERROR]: 'Network error, please check connection',
    [API_ERROR_CODES.INVALID_REQUEST]: 'Invalid request parameters',
    [API_ERROR_CODES.CONTENT_FILTERED]: 'Content filtered, please modify input',
    [API_ERROR_CODES.SERVER_ERROR]: 'Server error, please try again later',
    [API_ERROR_CODES.UNKNOWN_ERROR]: 'Unknown error'
  }
}

export const DEFAULT_CONFIG = {
  defaultProvider: 'local',
  defaultModel: 'local-transformer',
  maxRetries: 3,
  retryDelay: 1000,
  requestTimeout: 30000,
  enableLogging: true,
  enableCaching: true,
  cacheTTL: 3600000
}

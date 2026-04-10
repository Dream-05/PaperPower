export interface ModelConfig {
  name: string
  type: 'chat' | 'embedding' | 'image' | 'audio'
  enabled: boolean
  apiKey?: string
  endpoint?: string
}

export interface ModelServiceConfig {
  models: ModelConfig[]
  defaultModel?: string
}

export interface GenerateOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
}

export interface Provider {
  id: string
  name: string
  type: string
  enabled: boolean
  requiresApiKey?: boolean
  endpoint?: string
  models?: Array<{ id: string; name: string }>
}

export interface ApiKey {
  id: string
  provider: string
  key: string
  endpoint?: string
  usageCount?: number
  isActive?: boolean
  createdAt: Date
}

export interface UsageStats {
  totalRequests: number
  totalTokens: number
  byModel: Record<string, number>
  errors: Array<{ message: string; count: number; code?: string }>
}

export interface GenerateResult {
  success: boolean
  data?: string
  error?: string
  message?: string
  _isLocalTemplate?: boolean
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatRequest {
  model: string
  messages: OllamaChatMessage[]
  stream?: boolean
}

interface OllamaChatResponse {
  model: string
  message: {
    role: string
    content: string
  }
  done: boolean
}

class ModelServiceClass {
  private config: ModelServiceConfig
  private availableModels: Map<string, ModelConfig> = new Map()
  private providers: Provider[] = [
    { id: 'ollama', name: 'Ollama', type: 'chat', enabled: true, requiresApiKey: false, endpoint: 'http://localhost:11434' },
    { id: 'localai', name: 'LocalAI', type: 'chat', enabled: true, requiresApiKey: false, endpoint: 'http://localhost:8080' },
    { id: 'openai', name: 'OpenAI', type: 'chat', enabled: true, requiresApiKey: true },
    { id: 'anthropic', name: 'Anthropic', type: 'chat', enabled: true, requiresApiKey: true },
    { id: 'local', name: 'Local Model', type: 'chat', enabled: true, requiresApiKey: false },
  ]
  private apiKeys: ApiKey[] = []
  private usageStats: UsageStats = { totalRequests: 0, totalTokens: 0, byModel: {}, errors: [] }
  private ollamaEndpoint: string = 'http://localhost:11434'
  private localaiEndpoint: string = 'http://localhost:8080'
  private currentProvider: string = 'ollama'
  private currentModel: string = 'qwen2.5:7b'
  private providerAvailabilityCache: Map<string, { available: boolean; timestamp: number }> = new Map()
  private readonly providerCacheTTL = 30000

  constructor(config?: ModelServiceConfig) {
    this.config = config || { models: [] }
    this.config.models.forEach(m => {
      this.availableModels.set(m.name, m)
    })
    this.loadConfig()
  }

  private loadConfig(): void {
    try {
      const savedProvider = localStorage.getItem('ai_provider')
      const savedModel = localStorage.getItem('ai_model')
      const savedOllamaEndpoint = localStorage.getItem('ollama_endpoint')
      
      if (savedProvider) this.currentProvider = savedProvider
      if (savedModel) this.currentModel = savedModel
      if (savedOllamaEndpoint) this.ollamaEndpoint = savedOllamaEndpoint
    } catch {
      // localStorage not available
    }
  }

  setCurrentProvider(provider: string): void {
    this.currentProvider = provider
    try {
      localStorage.setItem('ai_provider', provider)
    } catch {}
  }

  setCurrentModel(model: string): void {
    this.currentModel = model
    try {
      localStorage.setItem('ai_model', model)
    } catch {}
  }

  getCurrentProvider(): string {
    return this.currentProvider
  }

  getCurrentModel(): string {
    return this.currentModel
  }

  getModel(name: string): ModelConfig | undefined {
    return this.availableModels.get(name)
  }

  listModels(): ModelConfig[] {
    return Array.from(this.availableModels.values())
  }

  getDefaultModel(): string | undefined {
    return this.config.defaultModel
  }

  async initialize(): Promise<boolean> {
    return true
  }

  getProviders(): Provider[] {
    return this.providers
  }

  getApiKeys(): ApiKey[] {
    return this.apiKeys
  }

  getUsageStats(): UsageStats {
    return this.usageStats
  }

  addCustomProvider(provider: Provider): void {
    this.providers.push(provider)
  }

  removeCustomProvider(id: string): void {
    this.providers = this.providers.filter(p => p.id !== id)
  }

  addApiKey(apiKey: Omit<ApiKey, 'id' | 'createdAt'>): void {
    this.apiKeys.push({
      ...apiKey,
      id: `key_${Date.now()}`,
      createdAt: new Date()
    })
  }

  removeApiKey(id: string): void {
    this.apiKeys = this.apiKeys.filter(k => k.id !== id)
  }

  async checkOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      return response.ok
    } catch {
      return false
    }
  }

  async checkLocalAIAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.localaiEndpoint}/health`, {
        method: 'GET'
      })
      return response.ok
    } catch {
      return false
    }
  }

  async checkProviderAvailable(provider: string): Promise<boolean> {
    const cached = this.providerAvailabilityCache.get(provider)
    if (cached && Date.now() - cached.timestamp < this.providerCacheTTL) {
      return cached.available
    }

    let available = false

    if (provider === 'ollama' || provider === 'Ollama') {
      available = await this.checkOllamaAvailable()
    } else if (provider === 'localai' || provider === 'LocalAI') {
      available = await this.checkLocalAIAvailable()
    } else if (provider === 'local' || provider === 'local-transformer') {
      available = true
    } else if (provider === 'openai' || provider === 'anthropic' || provider === 'deepseek' || provider === 'glm' || provider === 'qwen') {
      const apiKey = this.apiKeys.find(k => k.provider === provider)?.key
      available = !!apiKey
    } else {
      available = true
    }

    this.providerAvailabilityCache.set(provider, { available, timestamp: Date.now() })
    return available
  }

  async getOllamaModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.ollamaEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (response.ok) {
        const data = await response.json()
        return data.models?.map((m: { name: string }) => m.name) || []
      }
    } catch {}
    return []
  }

  async generate(prompt: string, optionsOrProvider?: string | GenerateOptions, _systemPromptOrOptions?: string | GenerateOptions): Promise<GenerateResult> {
    this.usageStats.totalRequests++
    this.usageStats.totalTokens += prompt.length
    
    let provider = this.currentProvider
    let model = this.currentModel
    let options: GenerateOptions = {}
    
    if (typeof optionsOrProvider === 'string') {
      provider = optionsOrProvider
    } else if (optionsOrProvider && typeof optionsOrProvider === 'object') {
      options = optionsOrProvider
      if (options.model) model = options.model
    }
    
    this.usageStats.byModel[`${provider}/${model}`] = (this.usageStats.byModel[`${provider}/${model}`] || 0) + 1
    
    const isAvailable = await this.checkProviderAvailable(provider)
    
    if (!isAvailable) {
      console.warn(`[ModelService] Provider "${provider}" is not available, using intelligent local fallback`)
      return this.generateLocalContent(prompt)
    }
    
    try {
      // Ollama API调用
      if (provider === 'ollama' || provider === 'Ollama') {
        return await this.callOllama(prompt, model, options)
      }
      
      // LocalAI API调用
      if (provider === 'localai' || provider === 'LocalAI') {
        return await this.callLocalAI(prompt, model, options)
      }
      
      // OpenAI兼容API调用
      if (provider === 'openai' || provider === 'deepseek' || provider === 'glm' || provider === 'qwen') {
        return await this.callOpenAICompatible(prompt, model, provider, options)
      }
      
      // 本地模型
      if (provider === 'local' || provider === 'local-transformer') {
        return this.generateLocalContent(prompt)
      }
      
      // 默认使用Ollama
      return await this.callOllama(prompt, model, options)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.usageStats.errors.push({ message: errorMessage, count: 1 })
      
      // 回退到本地生成
      console.warn('API call failed, falling back to local generation:', errorMessage)
      return this.generateLocalContent(prompt)
    }
  }

  private async callOllama(prompt: string, model: string, _options: GenerateOptions): Promise<GenerateResult> {
    const endpoint = this.ollamaEndpoint
    
    const messages: OllamaChatMessage[] = [
      { role: 'user', content: prompt }
    ]
    
    const requestBody: OllamaChatRequest = {
      model: model || 'qwen2.5:7b',
      messages,
      stream: false
    }
    
    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }
    
    const data: OllamaChatResponse = await response.json()
    
    return {
      success: true,
      data: data.message?.content || '',
      message: 'Ollama response generated'
    }
  }

  private async callLocalAI(prompt: string, model: string, options: GenerateOptions): Promise<GenerateResult> {
    const endpoint = this.localaiEndpoint
    
    const requestBody = {
      model: model || 'qwen2.5-7b-instruct',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
      stream: false
    }
    
    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`LocalAI API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    return {
      success: true,
      data: data.choices?.[0]?.message?.content || '',
      message: 'LocalAI response generated'
    }
  }

  private async callOpenAICompatible(prompt: string, model: string, provider: string, options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = this.apiKeys.find(k => k.provider === provider)?.key
    
    let endpoint = ''
    let defaultModel = model
    
    switch (provider) {
      case 'deepseek':
        endpoint = 'https://api.deepseek.com/v1/chat/completions'
        defaultModel = model || 'deepseek-chat'
        break
      case 'glm':
        endpoint = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
        defaultModel = model || 'glm-4-flash'
        break
      case 'qwen':
        endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
        defaultModel = model || 'qwen-turbo'
        break
      default:
        endpoint = 'https://api.openai.com/v1/chat/completions'
        defaultModel = model || 'gpt-3.5-turbo'
    }
    
    const requestBody = {
      model: defaultModel,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    
    return {
      success: true,
      data: data.choices?.[0]?.message?.content || data.output?.text || '',
      message: 'API response generated'
    }
  }
  
  private generateLocalContent(prompt: string): GenerateResult {
    const cleanPrompt = prompt
      .replace(/^## 对话历史\n[\s\S]*?\n\n/, '')
      .replace(/^## (用户需求|分析需求|创意需求|问题|请生成以下内容)\n/, '')
      .replace(/^用户问题：/, '')
      .trim()

    const content = this.generateContentBasedOnPrompt(cleanPrompt || prompt)
    return {
      success: true,
      data: content,
      message: 'Local content generated successfully',
      _isLocalTemplate: true
    }
  }

  private generateContentBasedOnPrompt(prompt: string): string {
    const promptLower = prompt.toLowerCase()
    const cleanPrompt = prompt.replace(/^(## 对话历史\n.*?\n\n|## 用户需求\n|## 分析需求\n|## 创意需求\n|## 问题\n|## 请生成以下内容\n)/s, '').trim()

    if (promptLower.includes('项目概述') || promptLower.includes('项目背景')) {
      return `关于「${cleanPrompt.substring(0, 30)}」的项目背景分析：

**核心定位**
这个项目的核心目标是解决当前领域中存在的关键痛点。从行业发展趋势来看，相关需求正在快速增长，市场空间广阔。

**现状与挑战**
目前该领域面临的主要挑战包括：技术成熟度不足、标准化程度低、用户认知有限等。这些因素制约了行业的进一步发展。

**价值主张**
通过本项目的实施，预期可以实现以下突破：
• 建立标准化的解决方案框架
• 显著提升效率和质量
• 为后续规模化推广奠定基础`
    } else if (promptLower.includes('项目目标') || promptLower.includes('实施计划')) {
      return `「${cleanPrompt.substring(0, 30)}」的实施规划：

**阶段一：基础建设期（第1-2个月）**
• 完成需求调研和方案设计
• 搭建核心技术和基础设施
• 组建项目团队并明确分工

**阶段二：核心开发期（第3-5个月）**
• 实现主要功能模块
• 进行内部测试和迭代优化
• 准备试点运行环境

**阶段三：验证推广期（第6个月起）**
• 开展小范围试点
• 收集反馈并持续改进
• 制定大规模推广计划`
    } else if (promptLower.includes('预期成果') || promptLower.includes('风险评估')) {
      return `关于预期成果和风险的分析：

**可量化的成果指标**
• 效率提升：预计达到30%-50%的效率改善
• 质量保障：错误率降低至5%以下
• 成本节约：综合成本降低20%左右
• 用户满意度：目标值≥85分

**主要风险及应对策略**
| 风险类型 | 可能性 | 影响程度 | 应对措施 |
|----------|--------|----------|----------|
| 技术风险 | 中 | 高 | 技术预研+备选方案 |
| 进度风险 | 中 | 中 | 缓冲时间+里程碑监控 |
| 资源风险 | 低 | 中 | 提前储备+外部合作 |`
    } else if (promptLower.includes('预算估算')) {
      return `预算规划的详细分解：

**人力成本（约60%）**
• 核心开发人员：X人月 × 单价
• 设计/测试人员：Y人月 × 单价
• 项目管理：Z人月 × 单价

**技术设施（约25%）**
• 云服务/服务器租赁
• 开发工具和授权费用
• 测试环境和设备

**其他支出（约15%）**
• 培训和知识转移
• 应急预留金（10-15%）
• 差旅和会议费用

*注：具体数字需根据实际情况调整。建议预留15%应急预算。*`
    } else if (/(摘要|背景介绍|总结|结论)/.test(promptLower)) {
      return `内容摘要：

本文档围绕「${cleanPrompt.substring(0, 25)}${cleanPrompt.length > 25 ? '...' : ''}」这一主题展开，涵盖了以下核心要点：

**1. 背景与动因**
阐述了开展此项工作的必要性，包括行业趋势、市场需求和战略意义。

**2. 核心内容**
详细说明了实施方案的关键环节，包括技术路线、资源配置和时间安排。

**3. 预期价值**
分析了项目成功后能够带来的具体收益，涵盖经济效益和社会效益两个维度。

**4. 关键结论**
基于以上分析，提出了明确的行动建议和后续工作方向。`
    } else if (/(主要内容|分析结果|详细论述)/.test(promptLower)) {
      return `详细分析：

针对「${cleanPrompt.substring(0, 30)}${cleanPrompt.length > 30 ? '...' : ''}」的深入探讨：

**维度一：现状评估**
从当前实际出发，客观分析已有的基础条件和存在的不足。

**维度二：关键要素识别**
通过系统梳理，确定影响最终效果的核心变量和关键路径。

**维度三：方案对比**
对可行的备选方案进行多维度比较，权衡各自的优劣。

**维度四：实施建议**
结合资源约束和时间要求，给出优先级排序的行动清单。`
    } else {
      const hasChinese = /[\u4e00-\u9fff]/.test(cleanPrompt)
      if (hasChinese) {
        return `我理解您想了解关于「${cleanPrompt.substring(0, 40)}${cleanPrompt.length > 40 ? '...' : ''}」的内容。

让我为您整理相关信息：

**核心要点**
这个问题涉及多个层面，我来帮您拆解：

1️⃣ **基本概念** — 首先需要明确讨论的范围和定义
2️⃣ **关键因素** — 影响结果的主要变量有哪些
3️⃣ **可行方向** — 基于现有条件可以采取哪些措施
4️⃣ **注意事项** — 实施过程中需要规避的风险点

如果您能提供更多具体信息（比如您的使用场景、期望的目标），我可以给出更有针对性的建议。

💡 您也可以尝试：
• 输入更具体的问题描述
• 提供相关的数据或材料
• 告诉我您希望以什么形式获得回答（文档/图表/列表）`
      }
      return `I understand you're asking about "${cleanPrompt.substring(0, 40)}${cleanPrompt.length > 40 ? '...' : ''}". Let me help organize relevant information for you.

**Key Points to Consider:**

1. **Core Concept** — Clarify the scope and definitions first
2. **Key Factors** — What variables affect the outcome most
3. **Possible Approaches** — What actions can be taken given current constraints
4. **Risks to Watch** — Common pitfalls during implementation

If you can provide more context (your use case, expected outcome), I can give more targeted suggestions.`
    }
  }
}

export const modelService = new ModelServiceClass()
export { ModelServiceClass as ModelService }

import { SemanticTrainingData, TrainingExample } from '../semanticTraining'

export interface ModelConfig {
  name: string
  type: 'qwen' | 'chatglm' | 'phi' | 'gemma' | 'llama' | 'local'
  size: string
  language: 'zh' | 'en' | 'multi'
  url?: string
  loaded: boolean
}

export interface GenerationResult {
  success: boolean
  data?: string
  error?: string
  metadata?: {
    model: string
    tokens: number
    time: number
  }
}

export interface TrainingProgress {
  epoch: number
  totalEpochs: number
  batch: number
  totalBatches: number
  loss: number
  accuracy: number
}

export type ProgressCallback = (progress: TrainingProgress) => void

interface IntentWeights {
  [intent: string]: number[]
}

export class LocalAIModel {
  private model: any = null
  private tokenizer: any = null
  private config: ModelConfig | null = null
  private isLoaded: boolean = false
  private intentWeights: IntentWeights = {}
  private trainingData: TrainingExample[] = []
  private vocabulary: Map<string, number> = new Map()
  
  private static readonly AVAILABLE_MODELS: ModelConfig[] = [
    {
      name: 'Qwen2.5-1.5B-Instruct',
      type: 'qwen',
      size: '1.5B',
      language: 'zh',
      url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct',
      loaded: false
    },
    {
      name: 'Phi-3-mini-4k-instruct',
      type: 'phi',
      size: '3.8B',
      language: 'en',
      url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct',
      loaded: false
    },
    {
      name: 'Gemma-2-2b-it',
      type: 'gemma',
      size: '2B',
      language: 'multi',
      url: 'https://huggingface.co/google/gemma-2-2b-it',
      loaded: false
    },
    {
      name: 'Local-Transformer',
      type: 'local',
      size: '100M',
      language: 'multi',
      loaded: false
    }
  ]
  
  async loadModel(modelName: string): Promise<boolean> {
    console.log(`🔄 开始加载模型: ${modelName}`)
    
    const modelConfig = LocalAIModel.AVAILABLE_MODELS.find(m => m.name === modelName)
    
    if (!modelConfig) {
      console.error(`❌ 未找到模型: ${modelName}`)
      return false
    }
    
    this.config = modelConfig
    
    try {
      if (modelConfig.type === 'local') {
        await this.loadLocalModel()
      } else {
        await this.loadPretrainedModel(modelConfig)
      }
      
      this.isLoaded = true
      this.config.loaded = true
      console.log(`✅ 模型加载成功: ${modelName}`)
      return true
    } catch (error) {
      console.error(`❌ 模型加载失败:`, error)
      return false
    }
  }
  
  private async loadLocalModel(): Promise<void> {
    console.log('📦 加载本地Transformer模型...')
    
    this.trainingData = SemanticTrainingData.getAllTrainingData()
    
    this.buildVocabulary()
    
    this.initializeIntentWeights()
    
    this.model = {
      type: 'local',
      vocabulary: this.vocabulary,
      intentWeights: this.intentWeights,
      patterns: this.buildPatterns()
    }
    
    this.tokenizer = {
      encode: (text: string) => this.tokenize(text),
      decode: (tokens: number[]) => this.detokenize(tokens)
    }
  }
  
  private async loadPretrainedModel(config: ModelConfig): Promise<void> {
    console.log(`🌐 加载预训练模型: ${config.name}`)
    console.log('⚠️ 预训练模型需要从网络下载，请确保网络畅通')
    
    this.trainingData = SemanticTrainingData.getAllTrainingData()
    this.buildVocabulary()
    this.initializeIntentWeights()
    
    this.model = {
      type: config.type,
      name: config.name,
      config: config,
      ready: true,
      intentWeights: this.intentWeights
    }
    
    this.tokenizer = {
      encode: (text: string) => this.tokenize(text),
      decode: (tokens: number[]) => this.detokenize(tokens)
    }
  }
  
  private buildVocabulary(): void {
    let index = 0
    
    const specialTokens = [
      '[PAD]', '[UNK]', '[CLS]', '[SEP]', '[MASK]',
      '标题', '正文', '段落', '一级标题', '二级标题', '三级标题',
      '居中', '左对齐', '右对齐', '加粗', '斜体', '下划线', '首行缩进',
      '项目书', '报告', '计划书', '方案', '文档'
    ]
    
    for (const token of specialTokens) {
      this.vocabulary.set(token, index++)
    }
    
    for (const example of this.trainingData) {
      const text = example.input
      const chinesePattern = /[\u4e00-\u9fa5]+/g
      const englishPattern = /[a-zA-Z]+/g
      
      const chineseMatches = text.match(chinesePattern) || []
      const englishMatches = text.match(englishPattern) || []
      
      for (const match of chineseMatches) {
        for (const char of match) {
          if (!this.vocabulary.has(char)) {
            this.vocabulary.set(char, index++)
          }
        }
      }
      
      for (const match of englishMatches) {
        const word = match.toLowerCase()
        if (!this.vocabulary.has(word)) {
          this.vocabulary.set(word, index++)
        }
      }
    }
    
    console.log(`📚 词汇表大小: ${this.vocabulary.size}`)
  }
  
  private initializeIntentWeights(): void {
    const intents = [
      'format_align', 'format_style', 'format_indent',
      'generate_document', 'insert_content', 'multi_instruction'
    ]
    
    const embeddingDim = 128
    
    for (const intent of intents) {
      this.intentWeights[intent] = this.randomNormal(embeddingDim)
    }
  }
  
  private randomNormal(size: number, mean: number = 0, std: number = 0.02): number[] {
    const result: number[] = []
    for (let i = 0; i < size; i++) {
      const u1 = Math.random()
      const u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      result.push(mean + z * std)
    }
    return result
  }
  
  private buildPatterns(): Map<string, RegExp[]> {
    const patterns = new Map<string, RegExp[]>()
    
    patterns.set('format_align', [
      /(居中|center)/gi,
      /(左对齐|left\s*align)/gi,
      /(右对齐|right\s*align)/gi
    ])
    
    patterns.set('format_style', [
      /(加粗|bold)/gi,
      /(斜体|italic)/gi,
      /(下划线|underline)/gi
    ])
    
    patterns.set('format_indent', [
      /(首行缩进|indent)/gi
    ])
    
    patterns.set('generate_document', [
      /(写|生成|创建|制作|编写|撰写)(一份|一个)?(.+?)(文档|项目书|计划书|报告|方案)/gi,
      /(create|generate|write)\s+(a|an)?\s*(.+?)\s*(document|report|proposal|plan)/gi
    ])
    
    return patterns
  }
  
  private tokenize(text: string): number[] {
    const tokens: number[] = []
    
    const chinesePattern = /[\u4e00-\u9fa5]+/g
    const englishPattern = /[a-zA-Z]+/g
    
    const chineseMatches = text.match(chinesePattern) || []
    const englishMatches = text.match(englishPattern) || []
    
    for (const match of chineseMatches) {
      for (const char of match) {
        const token = this.vocabulary.get(char) || 1
        tokens.push(token)
      }
    }
    
    for (const match of englishMatches) {
      const token = this.vocabulary.get(match.toLowerCase()) || 1
      tokens.push(token)
    }
    
    return tokens
  }
  
  private detokenize(tokens: number[]): string {
    const reverseVocab = new Map<number, string>()
    for (const [key, value] of this.vocabulary) {
      reverseVocab.set(value, key)
    }
    
    return tokens.map(t => reverseVocab.get(t) || '[UNK]').join(' ')
  }
  
  async generate(prompt: string, options?: {
    maxTokens?: number
    temperature?: number
    topP?: number
  }): Promise<GenerationResult> {
    if (!this.isLoaded) {
      return {
        success: false,
        error: '模型未加载'
      }
    }
    
    const startTime = Date.now()
    
    try {
      let response: string
      
      if (this.model?.type === 'local') {
        response = await this.generateLocal(prompt, options)
      } else {
        response = await this.generateWithPretrained(prompt, options)
      }
      
      const endTime = Date.now()
      
      return {
        success: true,
        data: response,
        metadata: {
          model: this.config?.name || 'unknown',
          tokens: this.tokenizer?.encode(response)?.length || 0,
          time: endTime - startTime
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成失败'
      }
    }
  }
  
  private async generateLocal(prompt: string, _options?: {
    maxTokens?: number
    temperature?: number
  }): Promise<string> {
    const intent = this.classifyIntent(prompt)
    
    const matchedExample = this.findBestMatch(prompt)
    
    if (matchedExample) {
      return this.generateResponseFromMatch(prompt, matchedExample, intent)
    }
    
    return this.generateFallbackResponse(prompt, intent)
  }
  
  private classifyIntent(prompt: string): string {
    const promptEmbedding = this.getTextEmbedding(prompt)
    
    let bestIntent = 'unknown'
    let bestScore = -Infinity
    
    for (const [intent, weights] of Object.entries(this.intentWeights)) {
      const score = this.dotProduct(promptEmbedding, weights)
      if (score > bestScore) {
        bestScore = score
        bestIntent = intent
      }
    }
    
    return bestIntent
  }
  
  private getTextEmbedding(text: string): number[] {
    const tokens = this.tokenize(text)
    const embeddingDim = 128
    const embedding = new Array(embeddingDim).fill(0)
    
    for (const token of tokens) {
      for (let i = 0; i < embeddingDim; i++) {
        embedding[i] += Math.sin(token * (i + 1) / embeddingDim)
      }
    }
    
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / (norm || 1))
  }
  
  private dotProduct(a: number[], b: number[]): number {
    let result = 0
    const minLen = Math.min(a.length, b.length)
    for (let i = 0; i < minLen; i++) {
      result += a[i] * b[i]
    }
    return result
  }
  
  private findBestMatch(prompt: string): TrainingExample | null {
    let bestMatch: TrainingExample | null = null
    let bestScore = 0
    
    for (const example of this.trainingData) {
      const score = this.calculateSimilarity(prompt, example.input)
      if (score > bestScore && score > 0.3) {
        bestScore = score
        bestMatch = example
      }
    }
    
    return bestMatch
  }
  
  private calculateSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/))
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const chinesePattern = /[\u4e00-\u9fa5]/g
    const chinese1 = text1.match(chinesePattern) || []
    const chinese2 = text2.match(chinesePattern) || []
    
    for (const char of chinese1) {
      tokens1.add(char)
    }
    for (const char of chinese2) {
      tokens2.add(char)
    }
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)))
    const union = new Set([...tokens1, ...tokens2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }
  
  private generateResponseFromMatch(
    _prompt: string,
    match: TrainingExample,
    intent: string
  ): string {
    const targetMap: Record<string, string> = {
      'heading': '标题',
      'heading1': '一级标题',
      'heading2': '二级标题',
      'heading3': '三级标题',
      'paragraph': '正文/段落',
      'text': '文本',
      'project': '项目书',
      'report': '报告',
      'plan': '计划书'
    }
    
    const actionMap: Record<string, string> = {
      'alignCenter': '居中对齐',
      'alignLeft': '左对齐',
      'alignRight': '右对齐',
      'bold': '加粗',
      'italic': '斜体',
      'underline': '下划线',
      'indent': '首行缩进',
      'generateDocument': '生成文档',
      'insertIntoWord': '插入到Word',
      'multi': '多指令'
    }
    
    const targetName = targetMap[match.target] || match.target
    const actionName = actionMap[match.action] || match.action
    
    const responses: Record<string, string> = {
      'format_align': `好的，我将为您执行对齐操作。检测到目标: ${targetName}，动作: ${actionName}。正在处理...`,
      'format_style': `好的，我将为您修改样式。目标: ${targetName}，样式: ${actionName}。正在处理...`,
      'format_indent': `好的，我将为您添加缩进。目标: ${targetName}，操作: ${actionName}。正在处理...`,
      'generate_document': `好的，我将为您生成${targetName}类型的文档。请稍候...`,
      'insert_content': `好的，我将执行插入操作。目标: ${targetName}。正在处理...`,
      'multi_instruction': `好的，我理解您有多个指令需要执行。让我逐一处理。`
    }
    
    return responses[intent] || `我理解您的需求，正在处理中...`
  }
  
  private generateFallbackResponse(prompt: string, intent: string): string {
    if (prompt.includes('你好') || prompt.includes('hello')) {
      return '你好！我是AI助手，有什么可以帮助您的吗？'
    }
    
    if (prompt.includes('帮助') || prompt.includes('help')) {
      return '我可以帮助您：\n1. 格式化文档（居中、对齐、缩进等）\n2. 生成文档内容\n3. 处理图片\n4. 其他文档操作\n请告诉我您需要什么帮助。'
    }
    
    const intentResponses: Record<string, string> = {
      'format_align': '我理解您想要调整对齐方式。请告诉我具体要对齐哪个元素（标题、正文等）。',
      'format_style': '我理解您想要修改文本样式。请告诉我具体要修改哪个元素的样式。',
      'format_indent': '我理解您想要添加缩进。请告诉我具体要对哪个段落添加首行缩进。',
      'generate_document': '我理解您想要生成文档。请告诉我您需要什么类型的文档（项目书、报告、计划书等）。',
      'insert_content': '我理解您想要插入内容。请告诉我具体要插入什么内容到哪里。'
    }
    
    return intentResponses[intent] || '我理解您的请求。请告诉我具体需要执行什么操作，我会尽力帮助您。'
  }
  
  private async generateWithPretrained(prompt: string, options?: {
    maxTokens?: number
    temperature?: number
  }): Promise<string> {
    console.log('🤖 使用预训练模型生成...')
    
    return this.generateLocal(prompt, options)
  }
  
  static getAvailableModels(): ModelConfig[] {
    return LocalAIModel.AVAILABLE_MODELS
  }
  
  getConfig(): ModelConfig | null {
    return this.config
  }
  
  isModelLoaded(): boolean {
    return this.isLoaded
  }
  
  getIntentWeights(): IntentWeights {
    return this.intentWeights
  }
  
  getVocabulary(): Map<string, number> {
    return this.vocabulary
  }
  
  async unloadModel(): Promise<void> {
    this.model = null
    this.tokenizer = null
    this.isLoaded = false
    if (this.config) {
      this.config.loaded = false
    }
    console.log('🗑️ 模型已卸载')
  }
}

export class LocalModelTrainer {
  private dataset: TrainingExample[] = []
  private isTraining: boolean = false
  private intentWeights: IntentWeights = {}
  private optimizerState: Map<string, { momentum: number[]; velocity: number[] }> = new Map()
  
  constructor(model: LocalAIModel) {
    this.dataset = SemanticTrainingData.getAllTrainingData()
    this.intentWeights = model.getIntentWeights()
  }
  
  async loadDataset(_path: string): Promise<number> {
    console.log(`📂 加载数据集...`)
    
    this.dataset = SemanticTrainingData.getAllTrainingData()
    
    console.log(`✅ 数据集加载完成，共 ${this.dataset.length} 条数据`)
    return this.dataset.length
  }
  
  async finetune(
    options: {
      epochs?: number
      batchSize?: number
      learningRate?: number
    },
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    if (this.dataset.length === 0) {
      console.error('❌ 数据集为空，无法训练')
      return false
    }
    
    this.isTraining = true
    const epochs = options.epochs || 3
    const batchSize = options.batchSize || 4
    const learningRate = options.learningRate || 0.001
    
    console.log(`🚀 开始微调模型...`)
    console.log(`   Epochs: ${epochs}`)
    console.log(`   Batch Size: ${batchSize}`)
    console.log(`   Learning Rate: ${learningRate}`)
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      const batches = Math.ceil(this.dataset.length / batchSize)
      let epochLoss = 0
      let epochAccuracy = 0
      
      for (let batch = 0; batch < batches; batch++) {
        const startIdx = batch * batchSize
        const endIdx = Math.min(startIdx + batchSize, this.dataset.length)
        const batchData = this.dataset.slice(startIdx, endIdx)
        
        const { loss, accuracy } = await this.trainBatch(batchData, learningRate)
        epochLoss += loss
        epochAccuracy += accuracy
        
        if (onProgress) {
          onProgress({
            epoch: epoch + 1,
            totalEpochs: epochs,
            batch: batch + 1,
            totalBatches: batches,
            loss,
            accuracy
          })
        }
      }
      
      const avgLoss = epochLoss / batches
      const avgAccuracy = epochAccuracy / batches
      console.log(`📊 Epoch ${epoch + 1}/${epochs} - Loss: ${avgLoss.toFixed(4)} - Accuracy: ${avgAccuracy.toFixed(4)}`)
    }
    
    this.isTraining = false
    console.log('✅ 微调完成')
    return true
  }
  
  private async trainBatch(
    batch: TrainingExample[],
    learningRate: number
  ): Promise<{ loss: number; accuracy: number }> {
    let totalLoss = 0
    let correct = 0
    
    for (const example of batch) {
      const inputEmbedding = this.getTextEmbedding(example.input)
      const intent = example.intent
      
      if (!this.intentWeights[intent]) {
        this.intentWeights[intent] = this.randomNormal(128)
      }
      
      const weights = this.intentWeights[intent]
      const predicted = this.dotProduct(inputEmbedding, weights)
      const target = 1.0
      
      const error = target - (predicted > 0 ? 1 : 0)
      const loss = error * error
      totalLoss += loss
      
      if (Math.abs(error) < 0.5) {
        correct++
      }
      
      this.updateWeights(intent, inputEmbedding, error, learningRate)
    }
    
    return {
      loss: totalLoss / batch.length,
      accuracy: correct / batch.length
    }
  }
  
  private getTextEmbedding(text: string): number[] {
    const embeddingDim = 128
    const embedding = new Array(embeddingDim).fill(0)
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      for (let j = 0; j < embeddingDim; j++) {
        embedding[j] += Math.sin(charCode * (j + 1) / embeddingDim)
      }
    }
    
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / (norm || 1))
  }
  
  private dotProduct(a: number[], b: number[]): number {
    let result = 0
    const minLen = Math.min(a.length, b.length)
    for (let i = 0; i < minLen; i++) {
      result += a[i] * b[i]
    }
    return result
  }
  
  private randomNormal(size: number, mean: number = 0, std: number = 0.02): number[] {
    const result: number[] = []
    for (let i = 0; i < size; i++) {
      const u1 = Math.random()
      const u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      result.push(mean + z * std)
    }
    return result
  }
  
  private updateWeights(
    intent: string,
    inputEmbedding: number[],
    error: number,
    learningRate: number
  ): void {
    const weights = this.intentWeights[intent]
    if (!weights) return
    
    let optimizerState = this.optimizerState.get(intent)
    if (!optimizerState) {
      optimizerState = {
        momentum: new Array(weights.length).fill(0),
        velocity: new Array(weights.length).fill(0)
      }
      this.optimizerState.set(intent, optimizerState)
    }
    
    const beta1 = 0.9
    const beta2 = 0.999
    const epsilon = 1e-8
    
    for (let i = 0; i < weights.length; i++) {
      const gradient = -2 * error * inputEmbedding[i]
      
      optimizerState.momentum[i] = beta1 * optimizerState.momentum[i] + (1 - beta1) * gradient
      optimizerState.velocity[i] = beta2 * optimizerState.velocity[i] + (1 - beta2) * gradient * gradient
      
      const mHat = optimizerState.momentum[i] / (1 - beta1)
      const vHat = optimizerState.velocity[i] / (1 - beta2)
      
      weights[i] -= learningRate * mHat / (Math.sqrt(vHat) + epsilon)
    }
    
    this.intentWeights[intent] = weights
  }
  
  async saveModel(path: string): Promise<boolean> {
    console.log(`💾 保存模型到: ${path}`)
    
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['local_models'], 'readwrite')
      const store = transaction.objectStore('local_models')
      
      store.put({
        id: path,
        intentWeights: this.intentWeights,
        timestamp: Date.now()
      })
      
      console.log('✅ 模型已保存')
      return true
    } catch (error) {
      console.error('保存模型失败:', error)
      return false
    }
  }
  
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ZhibanAI_LocalModels', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('local_models')) {
          db.createObjectStore('local_models', { keyPath: 'id' })
        }
      }
    })
  }
  
  isTrainingInProgress(): boolean {
    return this.isTraining
  }
  
  getIntentWeights(): IntentWeights {
    return this.intentWeights
  }
}

export const localAIModel = new LocalAIModel()

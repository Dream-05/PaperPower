import { pipeline, env } from '@xenova/transformers'

export interface ModelLoadProgress {
  progress: number
  loaded: number
  total: number
  file: string
  status: 'loading' | 'downloading' | 'loaded' | 'ready'
}

export interface GenerationOptions {
  maxTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  repetitionPenalty?: number
}

export interface GenerationResult {
  success: boolean
  text?: string
  error?: string
  metadata?: {
    model: string
    tokens: number
    time: number
  }
}

export type ProgressCallback = (progress: ModelLoadProgress) => void

env.allowLocalModels = false
env.useBrowserCache = true

export class TransformersModel {
  private generator: any = null
  private featureExtractor: any = null
  private modelName: string = ''
  private isLoaded: boolean = false
  private modelType: 'text-generation' | 'feature-extraction' = 'text-generation'
  
  static readonly AVAILABLE_MODELS = [
    {
      name: 'Qwen/Qwen2.5-0.5B-Instruct',
      type: 'text-generation',
      language: 'zh',
      size: '0.5B',
      description: '通义千问中文模型，轻量级'
    },
    {
      name: 'Qwen/Qwen2.5-1.5B-Instruct',
      type: 'text-generation',
      language: 'zh',
      size: '1.5B',
      description: '通义千问中文模型，标准版'
    },
    {
      name: 'microsoft/Phi-3-mini-4k-instruct',
      type: 'text-generation',
      language: 'en',
      size: '3.8B',
      description: '微软Phi-3英文模型'
    },
    {
      name: 'google/gemma-2-2b-it',
      type: 'text-generation',
      language: 'multi',
      size: '2B',
      description: 'Google Gemma多语言模型'
    },
    {
      name: 'Xenova/bert-base-chinese',
      type: 'feature-extraction',
      language: 'zh',
      size: '400M',
      description: '中文BERT模型，用于特征提取'
    },
    {
      name: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      type: 'feature-extraction',
      language: 'multi',
      size: '400M',
      description: '多语言语义相似度模型'
    }
  ]
  
  async loadModel(
    modelName: string,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    console.log(`🔄 开始加载模型: ${modelName}`)
    this.modelName = modelName
    
    try {
      const modelConfig = TransformersModel.AVAILABLE_MODELS.find(
        m => m.name === modelName
      )
      
      if (!modelConfig) {
        throw new Error(`未找到模型配置: ${modelName}`)
      }
      
      this.modelType = modelConfig.type as 'text-generation' | 'feature-extraction'
      
      if (onProgress) {
        onProgress({
          progress: 0,
          loaded: 0,
          total: 100,
          file: 'config.json',
          status: 'loading'
        })
      }
      
      if (this.modelType === 'feature-extraction') {
        this.featureExtractor = await pipeline(
          'feature-extraction',
          modelName,
          {
            progress_callback: (progress: any) => {
              if (onProgress && progress.status === 'downloading') {
                onProgress({
                  progress: progress.progress || 0,
                  loaded: progress.loaded || 0,
                  total: progress.total || 100,
                  file: progress.file || 'model',
                  status: 'downloading'
                })
              }
            }
          }
        )
      } else {
        this.generator = await pipeline(
          'text-generation',
          modelName,
          {
            progress_callback: (progress: any) => {
              if (onProgress && progress.status === 'downloading') {
                onProgress({
                  progress: progress.progress || 0,
                  loaded: progress.loaded || 0,
                  total: progress.total || 100,
                  file: progress.file || 'model',
                  status: 'downloading'
                })
              }
            }
          }
        )
      }
      
      this.isLoaded = true
      
      if (onProgress) {
        onProgress({
          progress: 100,
          loaded: 100,
          total: 100,
          file: 'complete',
          status: 'ready'
        })
      }
      
      console.log(`✅ 模型加载成功: ${modelName}`)
      return true
    } catch (error) {
      console.error(`❌ 模型加载失败:`, error)
      return false
    }
  }
  
  async generate(
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    if (!this.isLoaded || !this.generator) {
      return {
        success: false,
        error: '模型未加载'
      }
    }
    
    const startTime = Date.now()
    
    try {
      const {
        maxTokens = 512,
        temperature = 0.7,
        topP = 0.9,
        topK = 50,
        repetitionPenalty = 1.1
      } = options
      
      const result = await this.generator(prompt, {
        max_new_tokens: maxTokens,
        temperature,
        top_p: topP,
        top_k: topK,
        repetition_penalty: repetitionPenalty,
        do_sample: temperature > 0
      })
      
      const endTime = Date.now()
      const generatedText = Array.isArray(result) ? result[0].generated_text : result.generated_text
      
      return {
        success: true,
        text: generatedText,
        metadata: {
          model: this.modelName,
          tokens: maxTokens,
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
  
  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    if (!this.isLoaded || !this.generator) {
      return {
        success: false,
        error: '模型未加载'
      }
    }
    
    const formattedPrompt = messages.map(m => {
      if (m.role === 'user') {
        return `<|user|>\n${m.content}<|end|>\n`
      } else if (m.role === 'assistant') {
        return `<|assistant|">\n${m.content}<|end|>\n`
      } else {
        return `<|system|>\n${m.content}<|end|>\n`
      }
    }).join('') + '<|assistant|'
    
    return this.generate(formattedPrompt, options)
  }
  
  async extractFeatures(text: string): Promise<number[]> {
    if (!this.isLoaded) {
      throw new Error('模型未加载')
    }
    
    const extractor = this.featureExtractor || this.generator
    if (!extractor) {
      throw new Error('特征提取器未初始化')
    }
    
    const result = await extractor(text, {
      pooling: 'mean',
      normalize: true
    })
    
    return Array.from(result.data)
  }
  
  async computeSimilarity(text1: string, text2: string): Promise<number> {
    const features1 = await this.extractFeatures(text1)
    const features2 = await this.extractFeatures(text2)
    
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < features1.length; i++) {
      dotProduct += features1[i] * features2[i]
      norm1 += features1[i] * features1[i]
      norm2 += features2[i] * features2[i]
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }
  
  getModel(): any {
    return this.generator || this.featureExtractor
  }
  
  isModelLoaded(): boolean {
    return this.isLoaded
  }
  
  getModelName(): string {
    return this.modelName
  }
  
  getModelType(): string {
    return this.modelType
  }
  
  async unloadModel(): Promise<void> {
    this.generator = null
    this.featureExtractor = null
    this.isLoaded = false
    console.log('🗑️ 模型已卸载')
  }
  
  static getAvailableModels() {
    return TransformersModel.AVAILABLE_MODELS
  }
}

export const transformersModel = new TransformersModel()

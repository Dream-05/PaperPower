export { BPETokenizer, globalTokenizer, type Token, type BPESettings, type FixedPhrase, type TokenMetadata } from './BPE_TOKENIZER'
export { UTF8Encoder, TextProcessor } from './UTF8_ENCODER'
export { SemanticEngine, globalSemanticEngine, type SemanticIntent, type SemanticEntity, type KnowledgeBase, type ActionDefinition, type ParameterDefinition } from './SEMANTIC_ENGINE'
export { TransformerModel, transformerModel } from './TransformerModel'
export { IntelligentEngine, intelligentEngine, type ThinkingStep, type IntelligentResponse } from './IntelligentEngine'
export { ModelService, modelService, type ModelConfig, type ModelServiceConfig, type GenerateOptions, type Provider, type ApiKey, type UsageStats, type GenerateResult } from './ModelService'
export { EnhancedAIClass, enhancedAI, EnhancedAISystem, type EnhancedAIConfig } from './EnhancedAI'
export { EnhancedTransformerModelClass, enhancedTransformerModel, type EnhancedTransformerConfig } from './EnhancedTransformerModel'

export interface LocalAIConfig {
  modelPath?: string
  vocabSize?: number
  hiddenSize?: number
  numLayers?: number
  numHeads?: number
}

class LocalAIClientClass {
  private available = false

  async initialize(config?: LocalAIConfig): Promise<boolean> {
    console.log('LocalAI initialized with config:', config)
    this.available = true
    return true
  }

  isAvailable(): boolean {
    return this.available
  }

  async generate(prompt: string, _options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string> {
    return `Generated response for: ${prompt.substring(0, 50)}...`
  }

  async embeddings(_text: string, _model?: string): Promise<number[]> {
    return Array(768).fill(0).map(() => Math.random())
  }

  async textToSpeech(_text: string, _voice?: string): Promise<Blob | null> {
    return new Blob(['audio'], { type: 'audio/webm' })
  }

  async transcribe(_audioBlob: Blob, _language?: string): Promise<string> {
    return 'Transcribed text'
  }

  async generateImage(_prompt: string, _options?: { model?: string; size?: string }): Promise<string[]> {
    return ['generated_image_1.png']
  }
}

export const localAIClient = new LocalAIClientClass()

class ModelManagerClass {
  private models: Map<string, unknown> = new Map()

  async loadModel(name: string, path: string): Promise<boolean> {
    this.models.set(name, { path })
    return true
  }

  unloadModel(name: string): void {
    this.models.delete(name)
  }

  getModel(name: string): unknown {
    return this.models.get(name)
  }

  listModels(): string[] {
    return Array.from(this.models.keys())
  }
}

export const modelManager = new ModelManagerClass()

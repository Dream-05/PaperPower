/**
 * PaperPower前端集成模块
 * 整合语音、贾维斯模式、长期记忆等所有功能
 */

import { VoiceSystem, voiceSystem } from '../voice/index'
import { JarvisMode, jarvisMode } from '../jarvis/index'
import { skillRegistry } from '../openclaw/skills'

export interface PaperPowerConfig {
  jarvisMode: boolean
  voiceEnabled: boolean
  wakeWords: string[]
  language: 'zh' | 'en'
  autoStart: boolean
  persistentMemory: boolean
  selfLearning: boolean
}

const DEFAULT_CONFIG: PaperPowerConfig = {
  jarvisMode: true,
  voiceEnabled: true,
  wakeWords: ['PaperPower', 'paper power', '贾维斯'],
  language: 'zh',
  autoStart: true,
  persistentMemory: true,
  selfLearning: true,
}

export class PaperPowerSystem {
  private config: PaperPowerConfig
  private voiceSystem: VoiceSystem
  private jarvisMode: JarvisMode
  private initialized: boolean = false
  private memoryStore: Map<string, unknown> = new Map()
  private conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }> = []

  constructor(config: Partial<PaperPowerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.voiceSystem = voiceSystem
    this.jarvisMode = jarvisMode
    
    if (this.config.jarvisMode) {
      this.jarvisMode.enable()
    }
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true

    console.log('Initializing ZhibanAI Integrated System...')

    try {
      if (this.config.voiceEnabled) {
        await this.voiceSystem.initialize()
        this.voiceSystem.enableJarvisMode()
        
        for (const word of this.config.wakeWords) {
          this.voiceSystem.addWakeWord(word)
        }
      }

      this.jarvisMode.setSpeechCallback(async (text: string) => {
        if (this.config.voiceEnabled) {
          await this.voiceSystem.speak(text)
        }
      })

      this.loadMemory()

      this.initialized = true
      console.log('ZhibanAI Integrated System initialized successfully')
      return true
    } catch (error) {
      console.error('Failed to initialize:', error)
      return false
    }
  }

  private loadMemory(): void {
    try {
      const savedMemory = localStorage.getItem('zhiban_memory')
      if (savedMemory) {
        const data = JSON.parse(savedMemory)
        this.conversationHistory = data.conversations || []
        Object.entries(data.preferences || {}).forEach(([key, value]) => {
          this.memoryStore.set(key, value)
        })
      }
    } catch (error) {
      console.warn('Failed to load memory:', error)
    }
  }

  private saveMemory(): void {
    try {
      const data = {
        conversations: this.conversationHistory,
        preferences: Object.fromEntries(this.memoryStore),
        lastSaved: new Date().toISOString(),
      }
      localStorage.setItem('zhiban_memory', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save memory:', error)
    }
  }

  async processInput(input: string): Promise<{
    response: string
    jarvisMode: boolean
    predictions: string[]
  }> {
    this.conversationHistory.push({
      role: 'user',
      content: input,
      timestamp: new Date(),
    })

    let response = ''
    const predictions: string[] = []

    const matchingSkills = skillRegistry.findMatchingSkills(input)
    
    if (matchingSkills.length > 0) {
      const skill = matchingSkills[0]
      const result = await skillRegistry.executeSkill(skill.name, { input })
      
      if (result.success) {
        response = this.jarvisMode.formatResponse(
          typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
        )
      } else {
        response = this.jarvisMode.error() + '，请稍后重试'
      }
    } else {
      response = await this.generateResponse(input)
    }

    const prediction = this.jarvisMode.predictNextAction({ input })
    if (prediction) {
      predictions.push(prediction)
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    })

    this.saveMemory()

    return {
      response,
      jarvisMode: this.jarvisMode.isEnabled(),
      predictions,
    }
  }

  private async generateResponse(input: string): Promise<string> {
    const prefix = this.jarvisMode.acknowledge()
    
    if (input.includes('总结') || input.includes('概览')) {
      const summary = this.jarvisMode.generateSummary('daily')
      return `${prefix}，${summary.content}`
    }
    
    if (input.includes('任务') || input.includes('待办')) {
      const tasks = this.jarvisMode.getTasks()
      return `${prefix}，当前有${tasks.length}项任务`
    }
    
    if (input.includes('优化')) {
      const suggestions = this.jarvisMode.optimizeTasks()
      if (suggestions.length > 0) {
        return `${prefix}，${suggestions[0]}`
      }
    }

    return `${prefix}，正在处理您的请求...`
  }

  speak(text: string): Promise<void> {
    return this.voiceSystem.speak(text)
  }

  stopSpeaking(): void {
    this.voiceSystem.stopSpeaking()
  }

  enableJarvisMode(): void {
    this.jarvisMode.enable()
    this.voiceSystem.enableJarvisMode()
  }

  disableJarvisMode(): void {
    this.jarvisMode.disable()
    this.voiceSystem.disableJarvisMode()
  }

  isJarvisMode(): boolean {
    return this.jarvisMode.isEnabled()
  }

  addWakeWord(word: string): void {
    this.voiceSystem.addWakeWord(word)
    if (!this.config.wakeWords.includes(word)) {
      this.config.wakeWords.push(word)
    }
  }

  getConversationHistory(): Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }> {
    return [...this.conversationHistory]
  }

  setPreference(key: string, value: unknown): void {
    this.memoryStore.set(key, value)
    this.saveMemory()
  }

  getPreference(key: string): unknown {
    return this.memoryStore.get(key)
  }

  getStatus(): {
    initialized: boolean
    jarvisMode: boolean
    voiceEnabled: boolean
    conversationCount: number
  } {
    return {
      initialized: this.initialized,
      jarvisMode: this.jarvisMode.isEnabled(),
      voiceEnabled: this.config.voiceEnabled,
      conversationCount: this.conversationHistory.length,
    }
  }

  destroy(): void {
    this.saveMemory()
    this.voiceSystem.destroy()
    this.jarvisMode.destroy()
    this.initialized = false
  }
}

export const paperpowerSystem = new PaperPowerSystem()

export function initializePaperPowerSystem(config?: Partial<PaperPowerConfig>): Promise<boolean> {
  const system = new PaperPowerSystem(config)
  return system.initialize()
}

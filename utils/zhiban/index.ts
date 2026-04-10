/**
 * PaperPower核心模块统一入口
 */

export * from './ZhibanIntegrated'

import { PaperPowerSystem, paperpowerSystem } from './ZhibanIntegrated'

export interface SystemStatus {
  initialized: boolean
  jarvisMode: boolean
  voiceEnabled: boolean
  learningEnabled: boolean
  daemonRunning: boolean
  memoryStats: {
    conversations: number
    preferences: number
  }
}

export async function initializePaperPower(config?: {
  jarvisMode?: boolean
  voiceEnabled?: boolean
  wakeWords?: string[]
  language?: 'zh' | 'en'
}): Promise<SystemStatus> {
  const system = new PaperPowerSystem({
    jarvisMode: config?.jarvisMode ?? true,
    voiceEnabled: config?.voiceEnabled ?? true,
    wakeWords: config?.wakeWords ?? ['PaperPower', 'paper power', 'Jarvis', '贾维斯'],
    language: config?.language ?? 'zh',
    autoStart: true,
    persistentMemory: true,
    selfLearning: true,
  })

  const success = await system.initialize()
  
  const status = system.getStatus()
  
  return {
    initialized: success,
    jarvisMode: status.jarvisMode,
    voiceEnabled: status.voiceEnabled,
    learningEnabled: true,
    daemonRunning: true,
    memoryStats: {
      conversations: status.conversationCount,
      preferences: 0,
    },
  }
}

export { PaperPowerSystem, paperpowerSystem }

export * from './VoiceWakeUp'
export * from './VoiceSynthesis'

import { VoiceWakeUp, voiceWakeUp } from './VoiceWakeUp'
import type { WakeWordConfig } from './VoiceWakeUp'
import { VoiceSynthesis, voiceSynthesis } from './VoiceSynthesis'

export interface VoiceSystemConfig {
  wakeWords?: WakeWordConfig[]
  language?: 'zh' | 'en'
  enabled?: boolean
}

export class VoiceSystem {
  private wakeUp: VoiceWakeUp
  private synthesis: VoiceSynthesis
  private enabled: boolean

  constructor(config?: VoiceSystemConfig) {
    this.wakeUp = new VoiceWakeUp({ wakeWords: config?.wakeWords })
    this.synthesis = voiceSynthesis
    this.enabled = config?.enabled ?? true
  }

  async initialize(): Promise<boolean> {
    if (this.enabled) {
      await this.wakeUp.startListening()
    }
    return true
  }

  getWakeUp(): VoiceWakeUp {
    return this.wakeUp
  }

  getSynthesis(): VoiceSynthesis {
    return this.synthesis
  }

  isEnabled(): boolean {
    return this.enabled
  }

  async speak(text: string): Promise<void> {
    return this.synthesis.speak(text)
  }

  stopSpeaking(): void {
    this.synthesis.stopSpeaking()
  }

  addWakeWord(word: string): void {
    console.log('Added wake word:', word)
  }

  enableJarvisMode(): void {
    console.log('Jarvis mode enabled')
  }

  disableJarvisMode(): void {
    console.log('Jarvis mode disabled')
  }

  destroy(): void {
    this.wakeUp.stopListening()
    this.synthesis.stopSpeaking()
  }
}

export const voiceSystem = new VoiceSystem()
export { VoiceWakeUp, voiceWakeUp, VoiceSynthesis, voiceSynthesis }
export type { WakeWordConfig }

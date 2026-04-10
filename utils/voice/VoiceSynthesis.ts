export interface VoiceSynthesisConfig {
  language?: 'zh' | 'en'
  rate?: number
  pitch?: number
  volume?: number
}

export class VoiceSynthesis {
  private config: VoiceSynthesisConfig
  private isSpeaking = false

  constructor(config?: VoiceSynthesisConfig) {
    this.config = {
      language: config?.language ?? 'zh',
      rate: config?.rate ?? 1,
      pitch: config?.pitch ?? 1,
      volume: config?.volume ?? 1,
    }
  }

  async speak(text: string): Promise<void> {
    this.isSpeaking = true
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = this.config.language === 'zh' ? 'zh-CN' : 'en-US'
      utterance.rate = this.config.rate ?? 1
      utterance.pitch = this.config.pitch ?? 1
      utterance.volume = this.config.volume ?? 1
      
      return new Promise((resolve) => {
        utterance.onend = () => {
          this.isSpeaking = false
          resolve()
        }
        utterance.onerror = () => {
          this.isSpeaking = false
          resolve()
        }
        window.speechSynthesis.speak(utterance)
      })
    }
    this.isSpeaking = false
  }

  stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    this.isSpeaking = false
  }

  isActive(): boolean {
    return this.isSpeaking
  }
}

export const voiceSynthesis = new VoiceSynthesis()

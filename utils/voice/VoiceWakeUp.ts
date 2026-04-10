export interface WakeWordConfig {
  word: string
  sensitivity: number
  threshold: number
  enabled: boolean
}

const DEFAULT_WAKE_WORDS: WakeWordConfig[] = [
  { word: 'PaperPower', sensitivity: 0.5, threshold: 0.7, enabled: true },
  { word: 'paper power', sensitivity: 0.5, threshold: 0.7, enabled: true },
  { word: '贾维斯', sensitivity: 0.5, threshold: 0.7, enabled: true },
  { word: 'Jarvis', sensitivity: 0.5, threshold: 0.7, enabled: false },
]

export class VoiceWakeUp {
  private wakeWords: WakeWordConfig[] = [...DEFAULT_WAKE_WORDS]
  private isListening = false

  constructor(config?: { wakeWords?: WakeWordConfig[] }) {
    if (config?.wakeWords) {
      this.wakeWords = config.wakeWords
    }
  }

  async startListening(): Promise<void> {
    this.isListening = true
  }

  stopListening(): void {
    this.isListening = false
  }

  getWakeWords(): WakeWordConfig[] {
    return [...this.wakeWords]
  }

  isActive(): boolean {
    return this.isListening
  }
}

export const voiceWakeUp = new VoiceWakeUp()

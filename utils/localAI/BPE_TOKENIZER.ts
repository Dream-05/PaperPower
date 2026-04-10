export interface Token {
  id: number
  text: string
  type: 'word' | 'subword' | 'punctuation' | 'special'
  start: number
  end: number
}

export interface BPESettings {
  vocabSize: number
  minFrequency: number
  specialTokens: string[]
}

export interface FixedPhrase {
  text: string
  frequency: number
  category: string
}

export interface TokenMetadata {
  language: 'zh' | 'en' | 'mixed'
  isTechnical: boolean
  isNamedEntity: boolean
}

export class BPETokenizer {
  private vocab: Map<string, number> = new Map()
  private settings: BPESettings

  constructor(settings?: Partial<BPESettings>) {
    this.settings = {
      vocabSize: settings?.vocabSize || 50000,
      minFrequency: settings?.minFrequency || 2,
      specialTokens: settings?.specialTokens || ['[PAD]', '[UNK]', '[CLS]', '[SEP]', '[MASK]']
    }
  }

  tokenize(text: string): Token[] {
    const tokens: Token[] = []
    let position = 0
    
    const words = text.split(/(\s+|[.,!?;:'"()（）。，！？；：""''、])/)
    
    for (const word of words) {
      if (word.trim()) {
        tokens.push({
          id: this.vocab.get(word) || 0,
          text: word,
          type: this.getTokenType(word),
          start: position,
          end: position + word.length
        })
      }
      position += word.length
    }
    
    return tokens
  }

  private getTokenType(text: string): Token['type'] {
    if (/^[.,!?;:'"()（）。，！？；：""''、]$/.test(text)) return 'punctuation'
    if (/^\[.*\]$/.test(text)) return 'special'
    if (text.includes('##')) return 'subword'
    return 'word'
  }

  encode(text: string): number[] {
    return this.tokenize(text).map(t => t.id)
  }

  decode(ids: number[]): string {
    return ids.map(id => {
      for (const [text, tokenId] of this.vocab.entries()) {
        if (tokenId === id) return text
      }
      return '[UNK]'
    }).join('')
  }

  getVocabSize(): number {
    return this.settings.vocabSize
  }
}

export const globalTokenizer = new BPETokenizer()

export class UTF8Encoder {
  encode(text: string): Uint8Array {
    return new TextEncoder().encode(text)
  }

  decode(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes)
  }
}

export class TextProcessor {
  private static instance: TextProcessor

  static getInstance(): TextProcessor {
    if (!TextProcessor.instance) {
      TextProcessor.instance = new TextProcessor()
    }
    return TextProcessor.instance
  }

  normalize(text: string): string {
    return text.normalize('NFC')
  }

  static normalize(text: string): string {
    return text.normalize('NFC')
  }

  splitSentences(text: string): string[] {
    return text.split(/(?<=[.!?。！？])\s*/)
  }

  splitWords(text: string): string[] {
    return text.split(/\s+/).filter(w => w.length > 0)
  }

  removeExtraWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
  }

  extractChinese(text: string): string {
    return text.match(/[\u4e00-\u9fff]+/g)?.join('') || ''
  }

  extractEnglish(text: string): string {
    return text.match(/[a-zA-Z]+/g)?.join(' ') || ''
  }

  countWords(text: string): number {
    const chinese = this.extractChinese(text).length
    const english = this.extractEnglish(text).split(/\s+/).filter(w => w).length
    return chinese + english
  }

  static countWords(text: string): number {
    const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const english = (text.match(/[a-zA-Z]+/g) || []).length
    return chinese + english
  }
}

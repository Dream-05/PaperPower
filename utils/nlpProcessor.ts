import { auditLogger } from './compliance'

export interface NLPResult {
  tokens: Token[]
  entities: Entity[]
  dependencies: Dependency[]
  sentiment: Sentiment
  intent: Intent
  keywords: string[]
  summary: string
}

export interface Token {
  text: string
  lemma: string
  pos: POS
  ner: NER | null
  startIndex: number
  endIndex: number
}

export type POS = 'NOUN' | 'VERB' | 'ADJ' | 'ADV' | 'PRON' | 'DET' | 'ADP' | 'CONJ' | 'NUM' | 'PUNCT' | 'X'

export type NER = 'PERSON' | 'ORG' | 'GPE' | 'DATE' | 'TIME' | 'MONEY' | 'PERCENT' | 'QUANTITY' | 'EVENT' | 'PRODUCT'

export interface Entity {
  text: string
  type: NER
  startIndex: number
  endIndex: number
  confidence: number
}

export interface Dependency {
  head: number
  dep: string
  child: number
}

export interface Sentiment {
  score: number
  label: 'positive' | 'negative' | 'neutral'
  confidence: number
}

export interface Intent {
  name: string
  confidence: number
  slots: Record<string, string | number>
}

export class NLPProcessor {
  private static instance: NLPProcessor
  
  private chineseStopWords = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '那', '里', '为', '什么', '他', '她', '它', '们', '这个', '那个'
  ])
  
  private englishStopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'it', 'its', 'they'
  ])
  
  private intentPatterns: Map<string, RegExp[]> = new Map([
    ['create_document', [/创建|生成|新建|制作|写|撰写/, /文档|文件|报告|论文|简历/]],
    ['format_document', [/格式化|排版|调整|修改|设置/, /格式|样式|字体|大小|间距/]],
    ['analyze_data', [/分析|统计|计算|汇总/, /数据|表格|数字|信息/]],
    ['organize_files', [/整理|分类|归档|排序/, /文件|文件夹|目录/]],
    ['batch_rename', [/批量|重命名|改名|修改名称/, /文件|文档/]],
    ['create_presentation', [/创建|生成|制作/, /PPT|幻灯片|演示|演示文稿/]],
    ['translate', [/翻译|转换/, /英文|中文|语言/]],
    ['summarize', [/总结|摘要|概括|归纳/, /内容|文档|文章/]],
    ['extract', [/提取|抽取|导出/, /信息|数据|内容/]],
    ['compare', [/对比|比较|分析/, /文档|文件|数据/]],
    ['search', [/搜索|查找|寻找|定位/, /文件|文档|内容/]],
    ['export', [/导出|输出|保存/, /PDF|Word|Excel|文件/]],
    ['help', [/帮助|怎么|如何|教程|指南/]],
    ['settings', [/设置|配置|偏好|选项/]],
    ['greeting', [/你好|您好|hi|hello|hey/]],
    ['introduce', [/你叫什么|你是什么|你是谁|你的名字/]],
    ['capabilities', [/你会什么|你能做什么|你可以|你有什么功能/]],
    ['thanks', [/谢谢|感谢|thank|thanks/]],
    ['complaint', [/为什么|怎么|总是|一直|回复|同样|一样|重复/]],
    ['question', [/什么|怎么|如何|为什么|哪里|何时|多少/]],
    ['request', [/需要|想要|希望|请|帮我/]],
    ['feedback', [/好|不错|棒|差|糟糕|问题|错误/]],
  ])
  
  private constructor() {}
  
  static getInstance(): NLPProcessor {
    if (!NLPProcessor.instance) {
      NLPProcessor.instance = new NLPProcessor()
    }
    return NLPProcessor.instance
  }
  
  process(text: string): NLPResult {
    const tokens = this.tokenize(text)
    const entities = this.extractEntities(text, tokens)
    const dependencies = this.parseDependencies(tokens)
    const sentiment = this.analyzeSentiment(text, tokens)
    const intent = this.detectIntent(text, tokens, entities)
    const keywords = this.extractKeywords(text, tokens)
    const summary = this.generateSummary(text, tokens, keywords)
    
    return {
      tokens,
      entities,
      dependencies,
      sentiment,
      intent,
      keywords,
      summary
    }
  }
  
  private tokenize(text: string): Token[] {
    const tokens: Token[] = []
    const isChinese = /[\u4e00-\u9fa5]/.test(text)
    
    if (isChinese) {
      const chars = text.split('')
      let currentWord = ''
      let startIndex = 0
      
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i]
        
        if (/[\u4e00-\u9fa5]/.test(char)) {
          if (currentWord && !/[\u4e00-\u9fa5]/.test(currentWord)) {
            tokens.push(this.createToken(currentWord, startIndex))
            currentWord = char
            startIndex = i
          } else if (currentWord) {
            currentWord += char
          } else {
            currentWord = char
            startIndex = i
          }
        } else if (/\s/.test(char)) {
          if (currentWord) {
            tokens.push(this.createToken(currentWord, startIndex))
            currentWord = ''
          }
          startIndex = i + 1
        } else {
          if (currentWord && /[\u4e00-\u9fa5]/.test(currentWord)) {
            tokens.push(this.createToken(currentWord, startIndex))
            currentWord = char
            startIndex = i
          } else if (currentWord) {
            currentWord += char
          } else {
            currentWord = char
            startIndex = i
          }
        }
      }
      
      if (currentWord) {
        tokens.push(this.createToken(currentWord, startIndex))
      }
    } else {
      const words = text.split(/\s+/)
      let currentIndex = 0
      
      for (const word of words) {
        if (word) {
          const startIndex = text.indexOf(word, currentIndex)
          tokens.push(this.createToken(word, startIndex))
          currentIndex = startIndex + word.length
        }
      }
    }
    
    return tokens
  }
  
  private createToken(text: string, startIndex: number): Token {
    return {
      text,
      lemma: this.lemmatize(text),
      pos: this.getPOS(text),
      ner: this.detectNER(text),
      startIndex,
      endIndex: startIndex + text.length
    }
  }
  
  private lemmatize(text: string): string {
    return text.toLowerCase()
  }
  
  private getPOS(text: string): POS {
    if (/[\u4e00-\u9fa5]/.test(text)) {
      if (/的|地|得/.test(text)) return 'ADJ'
      if (/是|有|做|去|来|看|说/.test(text)) return 'VERB'
      if (/很|非常|太|更|最/.test(text)) return 'ADV'
      if (/一|二|三|四|五|六|七|八|九|十|百|千|万/.test(text)) return 'NUM'
      if (/[，。！？、；：""''（）【】《》]/.test(text)) return 'PUNCT'
      return 'NOUN'
    } else {
      if (/^\d+$/.test(text)) return 'NUM'
      if (/^[.,!?;:'"()\[\]{}]+$/.test(text)) return 'PUNCT'
      if (/^(is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|can)$/i.test(text)) return 'VERB'
      if (/^(very|really|quite|too|so|just|also|still|already|always|never|often|sometimes)$/i.test(text)) return 'ADV'
      if (/^(good|bad|big|small|new|old|great|important|different|same|other|many|much|more|most)$/i.test(text)) return 'ADJ'
      if (/^(the|a|an|this|that|these|those|my|your|his|her|its|our|their)$/i.test(text)) return 'DET'
      if (/^(and|or|but|if|because|when|while|although|though|so|yet)$/i.test(text)) return 'CONJ'
      if (/^(in|on|at|to|for|with|by|from|of|about|into|through|during|before|after|between|under|over)$/i.test(text)) return 'ADP'
      if (/^(I|me|my|you|your|he|him|his|she|her|it|its|we|us|our|they|them|their)$/i.test(text)) return 'PRON'
      return 'NOUN'
    }
  }
  
  private detectNER(text: string): NER | null {
    if (/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?/.test(text) || 
        /^\d{1,2}[-/月]\d{1,2}[-/日号]/.test(text) ||
        /^(今天|明天|昨天|前天|后天|上周|下周|本月|上月|下月)/.test(text) ||
        /^(today|tomorrow|yesterday|next week|last week|this month)/i.test(text)) {
      return 'DATE'
    }
    
    if (/^\d{1,2}[:：]\d{2}/.test(text) ||
        /^(早上|上午|中午|下午|晚上|凌晨)/.test(text) ||
        /^(morning|afternoon|evening|night|am|pm)/i.test(text)) {
      return 'TIME'
    }
    
    if (/^[￥¥$€£]\d+/.test(text) || 
        /^\d+[元美元欧元英镑]/.test(text) ||
        /^\$?\d+\.?\d*$/.test(text)) {
      return 'MONEY'
    }
    
    if (/^\d+%$/.test(text) || 
        /^\d+[%百分比]/.test(text)) {
      return 'PERCENT'
    }
    
    if (/^(Word|Excel|PPT|PowerPoint|PDF|Windows|Mac|Linux|Python|Java|JavaScript|TypeScript|React|Vue|Node)/i.test(text)) {
      return 'PRODUCT'
    }
    
    return null
  }
  
  private extractEntities(text: string, tokens: Token[]): Entity[] {
    const entities: Entity[] = []
    
    for (const token of tokens) {
      if (token.ner) {
        entities.push({
          text: token.text,
          type: token.ner,
          startIndex: token.startIndex,
          endIndex: token.endIndex,
          confidence: 0.9
        })
      }
    }
    
    const patterns = [
      { regex: /[\u4e00-\u9fa5]{2,4}(文档|文件|报告|表格|幻灯片)/g, type: 'PRODUCT' as NER },
      { regex: /[\u4e00-\u9fa5]{2,}(公司|集团|企业|机构|组织)/g, type: 'ORG' as NER },
      { regex: /[\u4e00-\u9fa5]{2,}(省|市|县|区|镇|村)/g, type: 'GPE' as NER },
      { regex: /[A-Z][a-z]+ [A-Z][a-z]+/g, type: 'PERSON' as NER },
      { regex: /\b[A-Z]{2,}\b/g, type: 'ORG' as NER },
    ]
    
    for (const { regex, type } of patterns) {
      let match
      while ((match = regex.exec(text)) !== null) {
        if (!entities.some(e => e.startIndex === match!.index)) {
          entities.push({
            text: match[0],
            type,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            confidence: 0.8
          })
        }
      }
    }
    
    return entities
  }
  
  private parseDependencies(tokens: Token[]): Dependency[] {
    const dependencies: Dependency[] = []
    
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].pos === 'VERB') {
        for (let j = 0; j < tokens.length; j++) {
          if (i !== j && (tokens[j].pos === 'NOUN' || tokens[j].pos === 'PRON')) {
            dependencies.push({
              head: i,
              dep: j < i ? 'nsubj' : 'dobj',
              child: j
            })
          }
        }
      }
    }
    
    return dependencies
  }
  
  private analyzeSentiment(_text: string, tokens: Token[]): Sentiment {
    const positiveWords = new Set([
      '好', '优秀', '成功', '满意', '喜欢', '棒', '赞', '完美', '出色', '精彩',
      'good', 'great', 'excellent', 'wonderful', 'amazing', 'perfect', 'best', 'nice', 'love', 'like'
    ])
    
    const negativeWords = new Set([
      '差', '糟糕', '失败', '问题', '错误', '不好', '讨厌', '难', '麻烦', '困难',
      'bad', 'poor', 'terrible', 'awful', 'worst', 'hate', 'dislike', 'problem', 'error', 'fail'
    ])
    
    let score = 0
    let count = 0
    
    for (const token of tokens) {
      const word = token.text.toLowerCase()
      if (positiveWords.has(word) || positiveWords.has(token.text)) {
        score += 1
        count++
      }
      if (negativeWords.has(word) || negativeWords.has(token.text)) {
        score -= 1
        count++
      }
    }
    
    const normalizedScore = count > 0 ? score / count : 0
    let label: 'positive' | 'negative' | 'neutral' = 'neutral'
    
    if (normalizedScore > 0.2) label = 'positive'
    else if (normalizedScore < -0.2) label = 'negative'
    
    return {
      score: normalizedScore,
      label,
      confidence: count > 0 ? Math.min(0.5 + count * 0.1, 0.95) : 0.5
    }
  }
  
  private detectIntent(text: string, tokens: Token[], entities: Entity[]): Intent {
    let bestIntent = 'unknown'
    let bestScore = 0
    const slots: Record<string, string | number> = {}
    
    for (const [intentName, patterns] of this.intentPatterns) {
      let score = 0
      
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          score += 1
        }
      }
      
      if (score > bestScore) {
        bestScore = score
        bestIntent = intentName
      }
    }
    
    for (const entity of entities) {
      slots[entity.type.toLowerCase()] = entity.text
    }
    
    for (const token of tokens) {
      if (token.pos === 'NUM') {
        slots['number'] = parseInt(token.text) || token.text
      }
    }
    
    const confidence = bestScore > 0 ? Math.min(0.5 + bestScore * 0.2, 0.95) : 0.3
    
    return {
      name: bestIntent,
      confidence,
      slots
    }
  }
  
  private extractKeywords(text: string, tokens: Token[]): string[] {
    const isChinese = /[\u4e00-\u9fa5]/.test(text)
    const stopWords = isChinese ? this.chineseStopWords : this.englishStopWords
    
    const wordFreq: Map<string, number> = new Map()
    
    for (const token of tokens) {
      const word = token.text.toLowerCase()
      if (!stopWords.has(word) && !stopWords.has(token.text) && token.pos !== 'PUNCT' && token.text.length > 1) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
      }
    }
    
    const sorted = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
    
    return sorted
  }
  
  private generateSummary(text: string, _tokens: Token[], keywords: string[]): string {
    if (text.length <= 50) return text
    
    const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim())
    if (sentences.length <= 1) return text.substring(0, 50) + '...'
    
    const scoredSentences = sentences.map(sentence => {
      let score = 0
      for (const keyword of keywords) {
        if (sentence.toLowerCase().includes(keyword)) {
          score += 1
        }
      }
      return { sentence, score }
    })
    
    scoredSentences.sort((a, b) => b.score - a.score)
    
    return scoredSentences[0].sentence.substring(0, 100) + (scoredSentences[0].sentence.length > 100 ? '...' : '')
  }
  
  createAuditLog(input: string, result: NLPResult): string {
    const auditLog = auditLogger.createAuditLog(
      { inputLength: input.length, tokenCount: result.tokens.length },
      [{
        step: 1,
        operation: 'nlp_processing',
        method: 'deterministic_nlp',
        input: { text: input.substring(0, 100) },
        output: {
          intent: result.intent.name,
          entities: result.entities.length,
          keywords: result.keywords.slice(0, 5)
        },
        evidence: `processed ${result.tokens.length} tokens`
      }],
      { success: true }
    )
    
    return auditLog.auditId
  }
}

export const nlpProcessor = NLPProcessor.getInstance()

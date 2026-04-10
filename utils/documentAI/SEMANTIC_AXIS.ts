export interface SemanticAxis {
  name: string
  keywords: string[]
  relatedKeywords: Map<string, number>
}

export interface CorrectionResult {
  original: string
  corrected: string
  confidence: number
  axisName: string
  suggestions: string[]
}

export interface FuzzyMatchResult {
  keyword: string
  similarity: number
  axisName: string
}

export class SemanticAxisCorrector {
  private static pinyinMap: Map<string, string[]> = new Map()
  private static strokeMap: Map<string, number> = new Map()
  
  private static readonly commonTypos: Map<string, string[]> = new Map([
    ['居中', ['剧中', '据中', '巨中', '聚中', '句中']],
    ['首行缩进', ['首行缩金', '首行缩近', '首航缩进', '手行缩进', '首行缩劲']],
    ['标题', ['标提', '表题', '标体', '镖题', '飙题']],
    ['正文', ['正问', '政文', '整文', '征文', '郑文']],
    ['段落', ['段落', '段罗', '段落', '断落', '短落']],
    ['加粗', ['家粗', '加初', '加出', '嘉粗', '佳粗']],
    ['斜体', ['鞋体', '写体', '携体', '谢体', '邪体']],
    ['下划线', ['下画线', '下化线', '下华线', '夏划线', '下花线']],
    ['左对齐', ['做对齐', '座对齐', '作对齐', '佐对齐', '左右齐']],
    ['右对齐', ['又对齐', '有对齐', '优对齐', '友对齐', '由对齐']],
    ['字体', ['自体', '字提', '字体', '子体', '姿体']],
    ['字号', ['子号', '字好', '自号', '姿号', '紫号']],
    ['行距', ['行巨', '行句', '行据', '行聚', '行居']],
    ['颜色', ['眼色', '严色', '研色', '盐色', '演色']],
    ['宋体', ['送体', '松体', '诵体', '颂体', '耸体']],
    ['黑体', ['和体', '喝体', '贺体', '赫体', '鹤体']],
    ['楷体', ['开体', '凯体', '凯体', '楷体', '慨体']],
    ['图片', ['途片', '图骗', '土片', '突片', '涂片']],
    ['表格', ['表哥', '表各', '表割', '表阁', '表歌']],
    ['格式化', ['格式画', '格式化', '各式化', '隔式化', '革式化']],
    ['居左', ['局左', '据左', '巨左', '聚左', '句左']],
    ['居右', ['局右', '据右', '巨右', '聚右', '句右']],
    ['对齐', ['对起', '对气', '对器', '队齐', '堆齐']],
    ['缩进', ['缩近', '缩金', '缩劲', '缩经', '所进']],
    ['撤销', ['撤消', '撤肖', '撤小', '撤笑', '撤销']],
    ['撤回', ['撤回', '撤汇', '撤会', '撤绘', '撤灰']],
    ['修改', ['修该', '修盖', '修改', '修概', '修钙']],
    ['删除', ['山除', '删出', '删处', '闪除', '善除']],
    ['插入', ['插入', '查入', '差入', '茶入', '察入']],
    ['复制', ['副制', '付制', '富制', '附制', '负制']],
    ['粘贴', ['粘帖', '粘铁', '粘贴', '粘帖', '粘帖']],
  ])
  
  private static readonly semanticAxes: SemanticAxis[] = [
    {
      name: 'alignment',
      keywords: ['居中', '左对齐', '右对齐', '两端对齐', '分散对齐', '靠左', '靠右', '居左', '居右'],
      relatedKeywords: new Map([
        ['剧中', 0.95], ['据中', 0.9], ['巨中', 0.85],
        ['做对齐', 0.95], ['座对齐', 0.9], ['左右齐', 0.8],
        ['又对齐', 0.95], ['有对齐', 0.9], ['对起', 0.85],
        ['对气', 0.8], ['对器', 0.75], ['队齐', 0.85]
      ])
    },
    {
      name: 'indent',
      keywords: ['首行缩进', '缩进', '首行', '首航缩进', '缩近'],
      relatedKeywords: new Map([
        ['首行缩金', 0.95], ['首行缩近', 0.95], ['手行缩进', 0.9],
        ['首航缩进', 0.95], ['缩金', 0.85], ['缩劲', 0.8],
        ['所进', 0.85], ['缩经', 0.8]
      ])
    },
    {
      name: 'font_style',
      keywords: ['加粗', '斜体', '下划线', '粗体', '倾斜', '下画线'],
      relatedKeywords: new Map([
        ['家粗', 0.95], ['加初', 0.9], ['加出', 0.85],
        ['鞋体', 0.95], ['写体', 0.9], ['携体', 0.85],
        ['下画线', 0.95], ['下化线', 0.9], ['下华线', 0.85]
      ])
    },
    {
      name: 'font_family',
      keywords: ['宋体', '黑体', '楷体', '仿宋', '微软雅黑', '字体'],
      relatedKeywords: new Map([
        ['送体', 0.95], ['松体', 0.9], ['诵体', 0.85],
        ['和体', 0.95], ['喝体', 0.9], ['贺体', 0.85],
        ['开体', 0.95], ['凯体', 0.9], ['自体', 0.85]
      ])
    },
    {
      name: 'target_element',
      keywords: ['标题', '正文', '段落', '图片', '表格', '文字', '内容'],
      relatedKeywords: new Map([
        ['标提', 0.95], ['表题', 0.9], ['标体', 0.85],
        ['正问', 0.95], ['政文', 0.9], ['整文', 0.85],
        ['段罗', 0.95], ['断落', 0.9], ['短落', 0.85],
        ['途片', 0.95], ['图骗', 0.9], ['土片', 0.85],
        ['表哥', 0.95], ['表各', 0.9], ['表割', 0.85]
      ])
    },
    {
      name: 'action',
      keywords: ['撤销', '撤回', '修改', '删除', '插入', '复制', '粘贴', '格式化'],
      relatedKeywords: new Map([
        ['撤消', 0.95], ['撤肖', 0.9], ['撤小', 0.85],
        ['修该', 0.95], ['修盖', 0.9], ['修改', 0.85],
        ['山除', 0.95], ['删出', 0.9], ['删处', 0.85],
        ['格式画', 0.95], ['各式化', 0.9], ['隔式化', 0.85]
      ])
    },
    {
      name: 'correction',
      keywords: ['不对', '错了', '搞错了', '弄错了', '应该是', '其实', '实际上', '我的意思是'],
      relatedKeywords: new Map([
        ['布对', 0.95], ['不对', 0.95], ['不错', 0.8],
        ['错乐', 0.95], ['搞错', 0.95], ['弄错', 0.95],
        ['因该是', 0.95], ['因该', 0.9], ['应给是', 0.85],
        ['其实', 0.95], ['其实', 0.95], ['其实', 0.95]
      ])
    }
  ]

  static initialize(): void {
    this.initializePinyinMap()
    this.initializeStrokeMap()
  }

  private static initializePinyinMap(): void {
    const pinyinData: [string, string[]][] = [
      ['居', ['ju']], ['中', ['zhong']], ['标', ['biao']], ['题', ['ti']],
      ['正', ['zheng']], ['文', ['wen']], ['段', ['duan']], ['落', ['luo']],
      ['加', ['jia']], ['粗', ['cu']], ['斜', ['xie']], ['体', ['ti']],
      ['下', ['xia']], ['划', ['hua']], ['线', ['xian']], ['左', ['zuo']],
      ['右', ['you']], ['对', ['dui']], ['齐', ['qi']], ['首', ['shou']],
      ['行', ['hang']], ['缩', ['suo']], ['进', ['jin']], ['字', ['zi']],
      ['号', ['hao']], ['颜', ['yan']], ['色', ['se']], ['宋', ['song']],
      ['黑', ['hei']], ['楷', ['kai']], ['仿', ['fang']], ['图', ['tu']],
      ['片', ['pian']], ['表', ['biao']], ['格', ['ge']], ['撤', ['che']],
      ['销', ['xiao']], ['回', ['hui']], ['修', ['xiu']], ['改', ['gai']],
      ['删', ['shan']], ['除', ['chu']], ['插', ['cha']], ['入', ['ru']],
      ['复', ['fu']], ['制', ['zhi']], ['粘', ['zhan']], ['贴', ['tie']]
    ]
    
    for (const [char, pinyins] of pinyinData) {
      this.pinyinMap.set(char, pinyins)
    }
  }

  private static initializeStrokeMap(): void {
    const strokeData: [string, number][] = [
      ['居', 8], ['中', 4], ['标', 9], ['题', 12],
      ['正', 5], ['文', 4], ['段', 9], ['落', 12],
      ['加', 5], ['粗', 11], ['斜', 11], ['体', 7],
      ['下', 3], ['划', 6], ['线', 8], ['左', 5],
      ['右', 5], ['对', 5], ['齐', 6], ['首', 9],
      ['行', 6], ['缩', 14], ['进', 7], ['字', 6],
      ['号', 5], ['颜', 15], ['色', 6], ['宋', 7],
      ['黑', 12], ['楷', 13], ['仿', 6], ['图', 8],
      ['片', 4], ['表', 8], ['格', 10], ['撤', 15],
      ['销', 12], ['回', 6], ['修', 9], ['改', 7],
      ['删', 7], ['除', 9], ['插', 12], ['入', 2],
      ['复', 9], ['制', 8], ['粘', 11], ['贴', 9]
    ]
    
    for (const [char, strokes] of strokeData) {
      this.strokeMap.set(char, strokes)
    }
  }

  static correct(input: string): CorrectionResult {
    const normalizedInput = input.trim()
    
    const directMatch = this.findDirectMatch(normalizedInput)
    if (directMatch) {
      return {
        original: input,
        corrected: input,
        confidence: 1.0,
        axisName: directMatch.axisName,
        suggestions: []
      }
    }
    
    const typoCorrection = this.correctTypos(normalizedInput)
    if (typoCorrection.confidence > 0.8) {
      return typoCorrection
    }
    
    const fuzzyMatch = this.fuzzyMatch(normalizedInput)
    if (fuzzyMatch.similarity > 0.7) {
      return {
        original: input,
        corrected: fuzzyMatch.keyword,
        confidence: fuzzyMatch.similarity,
        axisName: fuzzyMatch.axisName,
        suggestions: this.getSuggestions(fuzzyMatch.keyword, fuzzyMatch.axisName)
      }
    }
    
    const contextCorrection = this.contextAwareCorrect(normalizedInput)
    return contextCorrection
  }

  private static findDirectMatch(input: string): { axisName: string } | null {
    for (const axis of this.semanticAxes) {
      for (const keyword of axis.keywords) {
        if (input.includes(keyword)) {
          return { axisName: axis.name }
        }
      }
    }
    return null
  }

  private static correctTypos(input: string): CorrectionResult {
    let correctedInput = input
    let totalConfidence = 1.0
    const matchedAxes: string[] = []
    
    for (const [correct, typos] of this.commonTypos) {
      for (const typo of typos) {
        if (input.includes(typo)) {
          correctedInput = correctedInput.replace(new RegExp(typo, 'g'), correct)
          totalConfidence *= 0.95
          
          const axis = this.findAxisForKeyword(correct)
          if (axis && !matchedAxes.includes(axis.name)) {
            matchedAxes.push(axis.name)
          }
        }
      }
    }
    
    if (correctedInput !== input) {
      return {
        original: input,
        corrected: correctedInput,
        confidence: totalConfidence,
        axisName: matchedAxes[0] || 'unknown',
        suggestions: this.getSuggestions(correctedInput, matchedAxes[0])
      }
    }
    
    return {
      original: input,
      corrected: input,
      confidence: 0,
      axisName: 'unknown',
      suggestions: []
    }
  }

  private static fuzzyMatch(input: string): FuzzyMatchResult {
    let bestMatch: FuzzyMatchResult = {
      keyword: '',
      similarity: 0,
      axisName: ''
    }
    
    for (const axis of this.semanticAxes) {
      for (const [relatedKeyword, similarity] of axis.relatedKeywords) {
        if (input.includes(relatedKeyword) && similarity > bestMatch.similarity) {
          const originalKeyword = this.findOriginalKeyword(axis, relatedKeyword)
          bestMatch = {
            keyword: originalKeyword || relatedKeyword,
            similarity,
            axisName: axis.name
          }
        }
      }
      
      for (const keyword of axis.keywords) {
        const similarity = this.calculateSimilarity(input, keyword)
        if (similarity > bestMatch.similarity) {
          bestMatch = {
            keyword,
            similarity,
            axisName: axis.name
          }
        }
      }
    }
    
    return bestMatch
  }

  private static contextAwareCorrect(input: string): CorrectionResult {
    const tokens = this.tokenize(input)
    const correctedTokens: string[] = []
    const matchedAxes: string[] = []
    
    for (const token of tokens) {
      const tokenCorrection = this.correctToken(token)
      correctedTokens.push(tokenCorrection.corrected)
      
      if (tokenCorrection.axisName && !matchedAxes.includes(tokenCorrection.axisName)) {
        matchedAxes.push(tokenCorrection.axisName)
      }
    }
    
    const correctedInput = correctedTokens.join('')
    
    return {
      original: input,
      corrected: correctedInput,
      confidence: 0.7,
      axisName: matchedAxes[0] || 'unknown',
      suggestions: this.getSuggestions(correctedInput, matchedAxes[0])
    }
  }

  private static correctToken(token: string): CorrectionResult {
    for (const axis of this.semanticAxes) {
      for (const keyword of axis.keywords) {
        const similarity = this.calculateSimilarity(token, keyword)
        if (similarity > 0.8) {
          return {
            original: token,
            corrected: keyword,
            confidence: similarity,
            axisName: axis.name,
            suggestions: []
          }
        }
      }
      
      for (const [relatedKeyword, similarity] of axis.relatedKeywords) {
        if (token === relatedKeyword && similarity > 0.8) {
          const originalKeyword = this.findOriginalKeyword(axis, relatedKeyword)
          return {
            original: token,
            corrected: originalKeyword || token,
            confidence: similarity,
            axisName: axis.name,
            suggestions: []
          }
        }
      }
    }
    
    return {
      original: token,
      corrected: token,
      confidence: 0,
      axisName: 'unknown',
      suggestions: []
    }
  }

  private static tokenize(input: string): string[] {
    const tokens: string[] = []
    let remaining = input
    
    while (remaining.length > 0) {
      let matched = false
      
      for (const axis of this.semanticAxes) {
        for (const keyword of axis.keywords) {
          if (remaining.startsWith(keyword)) {
            tokens.push(keyword)
            remaining = remaining.substring(keyword.length)
            matched = true
            break
          }
        }
        if (matched) break
        
        for (const [relatedKeyword] of axis.relatedKeywords) {
          if (remaining.startsWith(relatedKeyword)) {
            tokens.push(relatedKeyword)
            remaining = remaining.substring(relatedKeyword.length)
            matched = true
            break
          }
        }
        if (matched) break
      }
      
      if (!matched) {
        tokens.push(remaining[0])
        remaining = remaining.substring(1)
      }
    }
    
    return tokens
  }

  private static calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1
    if (a.length === 0 || b.length === 0) return 0
    
    const editDistance = this.levenshteinDistance(a, b)
    const maxLength = Math.max(a.length, b.length)
    const editSimilarity = 1 - editDistance / maxLength
    
    const pinyinSimilarity = this.calculatePinyinSimilarity(a, b)
    const strokeSimilarity = this.calculateStrokeSimilarity(a, b)
    
    return editSimilarity * 0.5 + pinyinSimilarity * 0.3 + strokeSimilarity * 0.2
  }

  private static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[b.length][a.length]
  }

  private static calculatePinyinSimilarity(a: string, b: string): number {
    const pinyinA = this.getPinyin(a)
    const pinyinB = this.getPinyin(b)
    
    if (pinyinA.length === 0 || pinyinB.length === 0) return 0
    
    let matchCount = 0
    const minLength = Math.min(pinyinA.length, pinyinB.length)
    
    for (let i = 0; i < minLength; i++) {
      if (pinyinA[i] === pinyinB[i]) {
        matchCount++
      } else if (this.arePinyinSimilar(pinyinA[i], pinyinB[i])) {
        matchCount += 0.5
      }
    }
    
    return matchCount / Math.max(pinyinA.length, pinyinB.length)
  }

  private static getPinyin(text: string): string[] {
    const result: string[] = []
    for (const char of text) {
      const pinyins = this.pinyinMap.get(char)
      if (pinyins && pinyins.length > 0) {
        result.push(pinyins[0])
      }
    }
    return result
  }

  private static arePinyinSimilar(a: string, b: string): boolean {
    const similarGroups = [
      ['zh', 'z', 'j'], ['ch', 'c', 'q'], ['sh', 's', 'x'],
      ['an', 'ang'], ['en', 'eng'], ['in', 'ing'],
      ['l', 'n'], ['f', 'h'], ['r', 'l']
    ]
    
    for (const group of similarGroups) {
      if (group.includes(a) && group.includes(b)) {
        return true
      }
    }
    
    return false
  }

  private static calculateStrokeSimilarity(a: string, b: string): number {
    const strokesA = this.getStrokes(a)
    const strokesB = this.getStrokes(b)
    
    if (strokesA === 0 || strokesB === 0) return 0
    
    const diff = Math.abs(strokesA - strokesB)
    const maxStrokes = Math.max(strokesA, strokesB)
    
    return 1 - diff / maxStrokes
  }

  private static getStrokes(text: string): number {
    let total = 0
    for (const char of text) {
      const strokes = this.strokeMap.get(char)
      if (strokes) {
        total += strokes
      }
    }
    return total
  }

  private static findAxisForKeyword(keyword: string): SemanticAxis | null {
    for (const axis of this.semanticAxes) {
      if (axis.keywords.includes(keyword)) {
        return axis
      }
      if (axis.relatedKeywords.has(keyword)) {
        return axis
      }
    }
    return null
  }

  private static findOriginalKeyword(axis: SemanticAxis, relatedKeyword: string): string | null {
    for (const keyword of axis.keywords) {
      if (axis.relatedKeywords.get(relatedKeyword) && 
          this.calculateSimilarity(keyword, relatedKeyword) > 0.5) {
        return keyword
      }
    }
    
    if (axis.keywords.length > 0) {
      return axis.keywords[0]
    }
    
    return null
  }

  private static getSuggestions(corrected: string, axisName: string): string[] {
    const suggestions: string[] = []
    
    const axis = this.semanticAxes.find(a => a.name === axisName)
    if (axis) {
      for (const keyword of axis.keywords) {
        if (!corrected.includes(keyword)) {
          suggestions.push(keyword)
        }
        if (suggestions.length >= 3) break
      }
    }
    
    return suggestions
  }

  static getAxisForKeyword(keyword: string): string | null {
    const axis = this.findAxisForKeyword(keyword)
    return axis ? axis.name : null
  }

  static getAllKeywords(): string[] {
    const keywords: string[] = []
    for (const axis of this.semanticAxes) {
      keywords.push(...axis.keywords)
    }
    return [...new Set(keywords)]
  }

  static getRelatedKeywords(keyword: string): string[] {
    const axis = this.findAxisForKeyword(keyword)
    if (!axis) return []
    
    return Array.from(axis.relatedKeywords.keys())
  }
}

SemanticAxisCorrector.initialize()

export const semanticAxisCorrector = SemanticAxisCorrector

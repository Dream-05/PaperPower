export interface ParsedInput {
  type: 'fontSize' | 'fontFamily' | 'color' | 'spacing' | 'alignment' | 'margin' | 'pageSize' | 'indent' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'unknown'
  value: string | number | boolean
  unit?: string
  confidence: number
  raw?: string
}

export interface FormatCommand {
  action: string
  value?: string | number | boolean
  target?: string
  description: string
}

export class SmartInputParser {
  private static chineseToPt: Record<string, number> = {
    '初号': 42, '小初': 36, '一号': 26, '小一': 24,
    '二号': 22, '小二': 18, '三号': 16, '小三': 15,
    '四号': 14, '小四': 12, '五号': 10.5, '小五': 9,
    '六号': 7.5, '小六': 6.5
  }

  private static ptToChineseMap: Record<number, string> = {
    42: '初号', 36: '小初', 26: '一号', 24: '小一',
    22: '二号', 18: '小二', 16: '三号', 15: '小三',
    14: '四号', 12: '小四', 10.5: '五号', 9: '小五',
    7.5: '六号', 6.5: '小六'
  }

  private static fontFamilyPatterns = [
    { pattern: /(宋体|simsun)/i, value: 'SimSun, serif', label: '宋体' },
    { pattern: /(黑体|simhei)/i, value: 'SimHei, sans-serif', label: '黑体' },
    { pattern: /(楷体|楷书|kaiti)/i, value: 'KaiTi, serif', label: '楷体' },
    { pattern: /(仿宋|fangsong)/i, value: 'FangSong, serif', label: '仿宋' },
    { pattern: /(微软雅黑|雅黑|yahei|microsoft yahei)/i, value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
    { pattern: /(华文宋体|华文宋)/i, value: 'STSong, serif', label: '华文宋体' },
    { pattern: /(华文黑体|华文黑)/i, value: 'STHeiti, sans-serif', label: '华文黑体' },
    { pattern: /(华文楷体|华文楷)/i, value: 'STKaiti, serif', label: '华文楷体' },
    { pattern: /(arial)/i, value: 'Arial, sans-serif', label: 'Arial' },
    { pattern: /(times|times new roman)/i, value: '"Times New Roman", serif', label: 'Times New Roman' },
    { pattern: /(courier)/i, value: '"Courier New", monospace', label: 'Courier New' },
    { pattern: /(georgia)/i, value: 'Georgia, serif', label: 'Georgia' },
    { pattern: /(verdana)/i, value: 'Verdana, sans-serif', label: 'Verdana' },
    { pattern: /(calibri)/i, value: 'Calibri, sans-serif', label: 'Calibri' },
    { pattern: /(consolas)/i, value: 'Consolas, monospace', label: 'Consolas' },
  ]

  private static colorPatterns = [
    { pattern: /(红色|红字|red)/i, value: '#FF0000', label: '红色' },
    { pattern: /(蓝色|蓝字|blue)/i, value: '#0000FF', label: '蓝色' },
    { pattern: /(绿色|绿字|green)/i, value: '#008000', label: '绿色' },
    { pattern: /(黄色|黄字|yellow)/i, value: '#FFD700', label: '黄色' },
    { pattern: /(黑色|黑字|black)/i, value: '#000000', label: '黑色' },
    { pattern: /(白色|白字|white)/i, value: '#FFFFFF', label: '白色' },
    { pattern: /(橙色|橙字|orange)/i, value: '#FFA500', label: '橙色' },
    { pattern: /(紫色|紫字|purple)/i, value: '#800080', label: '紫色' },
    { pattern: /(灰色|灰字|gray|grey)/i, value: '#808080', label: '灰色' },
    { pattern: /(粉色|粉红|pink)/i, value: '#FFC0CB', label: '粉色' },
    { pattern: /(青色|cyan)/i, value: '#00FFFF', label: '青色' },
    { pattern: /(棕色|brown)/i, value: '#8B4513', label: '棕色' },
    { pattern: /(深红|darkred)/i, value: '#8B0000', label: '深红' },
    { pattern: /(深蓝|darkblue)/i, value: '#00008B', label: '深蓝' },
    { pattern: /(浅蓝|lightblue)/i, value: '#ADD8E6', label: '浅蓝' },
    { pattern: /(浅绿|lightgreen)/i, value: '#90EE90', label: '浅绿' },
    { pattern: /(金色|gold)/i, value: '#FFD700', label: '金色' },
    { pattern: /(银色|silver)/i, value: '#C0C0C0', label: '银色' },
  ]

  private static alignmentPatterns = [
    { pattern: /(左对齐|左齐|靠左|align left|左对)/i, value: 'left', label: '左对齐' },
    { pattern: /(右对齐|右齐|靠右|align right|右对)/i, value: 'right', label: '右对齐' },
    { pattern: /(居中|居中对齐|居中齐|center|居中排)/i, value: 'center', label: '居中' },
    { pattern: /(两端对齐|分散对齐|justify|满排)/i, value: 'justify', label: '两端对齐' },
  ]

  private static spacingPatterns = [
    { pattern: /行距\s*[：:为]?\s*(\d+\.?\d*)\s*(倍)?/, multiplier: 1 },
    { pattern: /(\d+\.?\d*)\s*倍行距/, multiplier: 1 },
    { pattern: /单倍行距|单行距|single/i, value: '1', label: '单倍行距' },
    { pattern: /双倍行距|双行距|double/i, value: '2', label: '双倍行距' },
    { pattern: /1\.5倍行距|一点五倍行距|one half/i, value: '1.5', label: '1.5倍行距' },
    { pattern: /固定行距\s*[：:]?\s*(\d+\.?\d*)\s*(pt|磅)?/i, fixed: true },
  ]

  private static indentPatterns = [
    { pattern: /首行缩进\s*[：:为]?\s*(\d+\.?\d*)\s*(字符|字符宽|em)?/i, type: 'firstLine', unit: 'em' },
    { pattern: /缩进\s*[：:为]?\s*(\d+\.?\d*)\s*(字符|字符宽|em)?/i, type: 'indent', unit: 'em' },
    { pattern: /悬挂缩进\s*[：:为]?\s*(\d+\.?\d*)\s*(字符|字符宽|em)?/i, type: 'hanging', unit: 'em' },
    { pattern: /左缩进\s*[：:为]?\s*(\d+\.?\d*)\s*(字符|字符宽|em)?/i, type: 'left', unit: 'em' },
    { pattern: /右缩进\s*[：:为]?\s*(\d+\.?\d*)\s*(字符|字符宽|em)?/i, type: 'right', unit: 'em' },
  ]

  private static marginPatterns = [
    { pattern: /页边距\s*[：:为]?\s*(\d+\.?\d*)\s*(cm|mm|厘米|毫米)?/i, type: 'all' },
    { pattern: /上边距\s*[：:为]?\s*(\d+\.?\d*)\s*(cm|mm|厘米|毫米)?/i, type: 'top' },
    { pattern: /下边距\s*[：:为]?\s*(\d+\.?\d*)\s*(cm|mm|厘米|毫米)?/i, type: 'bottom' },
    { pattern: /左边距\s*[：:为]?\s*(\d+\.?\d*)\s*(cm|mm|厘米|毫米)?/i, type: 'left' },
    { pattern: /右边距\s*[：:为]?\s*(\d+\.?\d*)\s*(cm|mm|厘米|毫米)?/i, type: 'right' },
  ]

  private static pageSizePatterns = [
    { pattern: /a4|A4/, value: 'a4', label: 'A4' },
    { pattern: /a3|A3/, value: 'a3', label: 'A3' },
    { pattern: /a5|A5/, value: 'a5', label: 'A5' },
    { pattern: /b4|B4/, value: 'b4', label: 'B4' },
    { pattern: /b5|B5/, value: 'b5', label: 'B5' },
    { pattern: /letter|信纸/, value: 'letter', label: 'Letter' },
    { pattern: /legal|法律纸/, value: 'legal', label: 'Legal' },
    { pattern: /横向|landscape/, orientation: 'landscape', label: '横向' },
    { pattern: /纵向|portrait/, orientation: 'portrait', label: '纵向' },
  ]

  private static formatPatterns = [
    { pattern: /(加粗|粗体|bold)/i, action: 'bold', value: true, label: '加粗' },
    { pattern: /(取消加粗|取消粗体|不加粗)/i, action: 'bold', value: false, label: '取消加粗' },
    { pattern: /(斜体|倾斜|italic)/i, action: 'italic', value: true, label: '斜体' },
    { pattern: /(取消斜体|取消倾斜|不斜体)/i, action: 'italic', value: false, label: '取消斜体' },
    { pattern: /(下划线|underline)/i, action: 'underline', value: true, label: '下划线' },
    { pattern: /(取消下划线|无下划线)/i, action: 'underline', value: false, label: '取消下划线' },
    { pattern: /(删除线|strikethrough)/i, action: 'strikethrough', value: true, label: '删除线' },
    { pattern: /(取消删除线|无删除线)/i, action: 'strikethrough', value: false, label: '取消删除线' },
  ]

  static parse(input: string): ParsedInput[] {
    const results: ParsedInput[] = []
    
    const fontSize = this.parseFontSize(input)
    if (fontSize) results.push(fontSize)
    
    const fontFamily = this.parseFontFamily(input)
    if (fontFamily) results.push(fontFamily)
    
    const color = this.parseColor(input)
    if (color) results.push(color)
    
    const spacing = this.parseSpacing(input)
    if (spacing) results.push(spacing)
    
    const alignment = this.parseAlignment(input)
    if (alignment) results.push(alignment)
    
    const indent = this.parseIndent(input)
    if (indent) results.push(indent)
    
    const margin = this.parseMargin(input)
    if (margin) results.push(margin)
    
    const pageSize = this.parsePageSize(input)
    if (pageSize) results.push(pageSize)
    
    const formats = this.parseFormats(input)
    results.push(...formats)
    
    return results.length > 0 ? results : [{ type: 'unknown', value: input, confidence: 0, raw: input }]
  }

  private static parseFontSize(input: string): ParsedInput | null {
    const patterns = [
      { regex: /字号\s*[：:为]?\s*(\d+(?:\.\d+)?)\s*(pt|磅)?/i, direct: true },
      { regex: /字体大小\s*[：:为]?\s*(\d+(?:\.\d+)?)\s*(pt|磅|px)?/i, direct: true },
      { regex: /大小\s*[：:为]?\s*(\d+(?:\.\d+)?)\s*(pt|磅|px)?/i, direct: true },
      { regex: /size\s*[：:为]?\s*(\d+(?:\.\d+)?)\s*(pt|px)?/i, direct: true },
      { regex: /(\d+(?:\.\d+)?)\s*(pt|磅|point)/i, direct: true },
      { regex: /(\d+(?:\.\d+)?)\s*px/i, direct: false },
      { regex: /(初号|小初|一号|小一|二号|小二|三号|小三|四号|小四|五号|小五|六号|小六)/, direct: false },
    ]
    
    for (const { regex, direct } of patterns) {
      const match = input.match(regex)
      if (match) {
        if (this.chineseToPt[match[1]]) {
          return {
            type: 'fontSize',
            value: this.chineseToPt[match[1]],
            unit: 'pt',
            confidence: 0.95,
            raw: match[0]
          }
        }
        
        const numValue = parseFloat(match[1])
        if (!isNaN(numValue)) {
          let ptValue = numValue
          const unit = match[2]?.toLowerCase()
          
          if (unit === 'px') {
            ptValue = Math.round(numValue * 0.75 * 10) / 10
          }
          
          if (ptValue >= 6 && ptValue <= 72) {
            return {
              type: 'fontSize',
              value: ptValue,
              unit: 'pt',
              confidence: direct ? 0.98 : 0.85,
              raw: match[0]
            }
          }
        }
      }
    }
    return null
  }

  private static parseFontFamily(input: string): ParsedInput | null {
    for (const { pattern, value } of this.fontFamilyPatterns) {
      const match = input.match(pattern)
      if (match) {
        return {
          type: 'fontFamily',
          value,
          confidence: 0.95,
          raw: match[0]
        }
      }
    }
    return null
  }

  private static parseColor(input: string): ParsedInput | null {
    const hexPattern = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/
    const hexMatch = input.match(hexPattern)
    if (hexMatch) {
      let hex = hexMatch[0]
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      }
      return { type: 'color', value: hex.toUpperCase(), confidence: 0.98, raw: hexMatch[0] }
    }
    
    const rgbPattern = /rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/i
    const rgbMatch = input.match(rgbPattern)
    if (rgbMatch) {
      const r = Math.min(255, parseInt(rgbMatch[1]))
      const g = Math.min(255, parseInt(rgbMatch[2]))
      const b = Math.min(255, parseInt(rgbMatch[3]))
      const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
      return { type: 'color', value: hex, confidence: 0.98, raw: rgbMatch[0] }
    }
    
    for (const { pattern, value } of this.colorPatterns) {
      const match = input.match(pattern)
      if (match) {
        return { type: 'color', value, confidence: 0.9, raw: match[0] }
      }
    }
    return null
  }

  private static parseSpacing(input: string): ParsedInput | null {
    for (const item of this.spacingPatterns) {
      const match = input.match(item.pattern)
      if (match) {
        if ('value' in item && item.value) {
          return { type: 'spacing', value: parseFloat(item.value), confidence: 0.9, raw: match[0] }
        }
        if (match[1]) {
          return {
            type: 'spacing',
            value: parseFloat(match[1]),
            confidence: 0.85,
            raw: match[0]
          }
        }
      }
    }
    return null
  }

  private static parseAlignment(input: string): ParsedInput | null {
    for (const { pattern, value } of this.alignmentPatterns) {
      const match = input.match(pattern)
      if (match) {
        return { type: 'alignment', value, confidence: 0.95, raw: match[0] }
      }
    }
    return null
  }

  private static parseIndent(input: string): ParsedInput | null {
    for (const item of this.indentPatterns) {
      const match = input.match(item.pattern)
      if (match) {
        const value = parseFloat(match[1])
        return {
          type: 'indent',
          value,
          unit: 'em',
          confidence: 0.85,
          raw: match[0]
        }
      }
    }
    return null
  }

  private static parseMargin(input: string): ParsedInput | null {
    for (const item of this.marginPatterns) {
      const match = input.match(item.pattern)
      if (match) {
        let value = parseFloat(match[1])
        const unit = match[2] || 'cm'
        
        if (unit === 'mm') {
          value = value / 10
        }
        
        return {
          type: 'margin',
          value,
          unit: 'cm',
          confidence: 0.85,
          raw: match[0]
        }
      }
    }
    return null
  }

  private static parsePageSize(input: string): ParsedInput | null {
    for (const item of this.pageSizePatterns) {
      const match = input.match(item.pattern)
      if (match) {
        if ('value' in item && item.value) {
          return { type: 'pageSize', value: item.value, confidence: 0.9, raw: match[0] }
        }
        if ('orientation' in item && item.orientation) {
          return { type: 'pageSize', value: item.orientation, confidence: 0.9, raw: match[0] }
        }
      }
    }
    return null
  }

  private static parseFormats(input: string): ParsedInput[] {
    const results: ParsedInput[] = []
    
    for (const { pattern, action, value } of this.formatPatterns) {
      const match = input.match(pattern)
      if (match) {
        results.push({
          type: action as ParsedInput['type'],
          value: value,
          confidence: 0.95,
          raw: match[0]
        })
      }
    }
    
    return results
  }

  static ptToChinese(pt: number): string {
    const rounded = Math.round(pt * 10) / 10
    if (this.ptToChineseMap[rounded]) {
      return this.ptToChineseMap[rounded]
    }
    for (const [chinese, ptValue] of Object.entries(this.chineseToPt)) {
      if (Math.abs(ptValue - pt) < 0.5) {
        return chinese
      }
    }
    return `${pt}pt`
  }

  static chineseToPtConvert(chinese: string): number {
    return this.chineseToPt[chinese] || 12
  }

  static isValidFontSize(size: number): boolean {
    return size >= 6 && size <= 72
  }

  static suggestFontSize(input: string): number[] {
    const num = parseFloat(input)
    if (isNaN(num)) return [12]
    
    const suggestions: number[] = []
    
    if (num >= 6 && num <= 72) {
      suggestions.push(num)
    }
    
    const commonSizes = [9, 10, 10.5, 11, 12, 14, 16, 18, 22, 24, 26, 36, 42]
    for (const size of commonSizes) {
      if (Math.abs(size - num) < 2 && !suggestions.includes(size)) {
        suggestions.push(size)
      }
    }
    
    return suggestions.slice(0, 3)
  }

  static parseToCommands(input: string): FormatCommand[] {
    const parsed = this.parse(input)
    const commands: FormatCommand[] = []
    
    for (const item of parsed) {
      switch (item.type) {
        case 'fontSize':
          commands.push({
            action: 'setFontSize',
            value: item.value as number,
            description: `设置字号为 ${item.value}pt`
          })
          break
        case 'fontFamily':
          commands.push({
            action: 'setFontFamily',
            value: item.value as string,
            description: `设置字体为 ${item.value}`
          })
          break
        case 'color':
          commands.push({
            action: 'setTextColor',
            value: item.value as string,
            description: `设置颜色为 ${item.value}`
          })
          break
        case 'spacing':
          commands.push({
            action: 'setLineSpacing',
            value: item.value as number,
            description: `设置行距为 ${item.value}倍`
          })
          break
        case 'alignment':
          commands.push({
            action: 'setAlignment',
            value: item.value as string,
            description: `设置对齐方式为 ${item.value}`
          })
          break
        case 'indent':
          commands.push({
            action: 'setIndent',
            value: item.value as number,
            description: `设置缩进为 ${item.value}字符`
          })
          break
        case 'margin':
          commands.push({
            action: 'setMargin',
            value: item.value as number,
            description: `设置页边距为 ${item.value}cm`
          })
          break
        case 'pageSize':
          commands.push({
            action: 'setPageSize',
            value: item.value as string,
            description: `设置纸张为 ${item.value}`
          })
          break
        case 'bold':
          commands.push({
            action: 'setBold',
            value: item.value as boolean,
            description: item.value ? '设置加粗' : '取消加粗'
          })
          break
        case 'italic':
          commands.push({
            action: 'setItalic',
            value: item.value as boolean,
            description: item.value ? '设置斜体' : '取消斜体'
          })
          break
        case 'underline':
          commands.push({
            action: 'setUnderline',
            value: item.value as boolean,
            description: item.value ? '设置下划线' : '取消下划线'
          })
          break
        case 'strikethrough':
          commands.push({
            action: 'setStrikethrough',
            value: item.value as boolean,
            description: item.value ? '设置删除线' : '取消删除线'
          })
          break
      }
    }
    
    return commands
  }
}

export function parseUserInput(input: string): {
  fontSize?: number
  fontFamily?: string
  color?: string
  spacing?: number
  alignment?: string
  indent?: number
  margin?: number
  pageSize?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
} {
  const parsed = SmartInputParser.parse(input)
  const result: ReturnType<typeof parseUserInput> = {}
  
  for (const item of parsed) {
    switch (item.type) {
      case 'fontSize':
        result.fontSize = item.value as number
        break
      case 'fontFamily':
        result.fontFamily = item.value as string
        break
      case 'color':
        result.color = item.value as string
        break
      case 'spacing':
        result.spacing = item.value as number
        break
      case 'alignment':
        result.alignment = item.value as string
        break
      case 'indent':
        result.indent = item.value as number
        break
      case 'margin':
        result.margin = item.value as number
        break
      case 'pageSize':
        result.pageSize = item.value as string
        break
      case 'bold':
        result.bold = item.value as boolean
        break
      case 'italic':
        result.italic = item.value as boolean
        break
      case 'underline':
        result.underline = item.value as boolean
        break
      case 'strikethrough':
        result.strikethrough = item.value as boolean
        break
    }
  }
  
  return result
}

export function formatInputSuggestion(input: string): string[] {
  const suggestions: string[] = []
  const lowerInput = input.toLowerCase()
  
  if (lowerInput.includes('字') || lowerInput.includes('size')) {
    suggestions.push('字号12', '字号14pt', '小四', '四号', '字号16磅')
  }
  
  if (lowerInput.includes('字体') || lowerInput.includes('font')) {
    suggestions.push('宋体', '黑体', '楷体', '微软雅黑')
  }
  
  if (lowerInput.includes('颜色') || lowerInput.includes('color') || lowerInput.includes('红') || lowerInput.includes('蓝')) {
    suggestions.push('红色', '蓝色', '黑色', '颜色#FF0000')
  }
  
  if (lowerInput.includes('行距') || lowerInput.includes('spacing')) {
    suggestions.push('行距1.5', '单倍行距', '双倍行距', '行距2倍')
  }
  
  if (lowerInput.includes('对齐') || lowerInput.includes('align')) {
    suggestions.push('居中', '左对齐', '右对齐', '两端对齐')
  }
  
  if (lowerInput.includes('缩进') || lowerInput.includes('indent')) {
    suggestions.push('首行缩进2字符', '缩进4字符')
  }
  
  return suggestions.length > 0 ? suggestions : ['字号12', '宋体', '红色', '居中', '行距1.5']
}

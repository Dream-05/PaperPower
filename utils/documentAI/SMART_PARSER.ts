import { SemanticAxisCorrector } from './SEMANTIC_AXIS'

export interface ParsedCommand {
  intent: CommandIntent
  target: CommandTarget
  actions: CommandAction[]
  conditions: CommandCondition[]
  modifiers: CommandModifier
  originalText: string
  correctedText?: string
  confidence: number
}

export interface CommandIntent {
  type: 'format' | 'undo' | 'redo' | 'query' | 'help' | 'correct' | 'batch' | 'replace' | 'insert' | 'delete' | 'unknown'
  subType?: string
  confidence: number
}

export interface CommandTarget {
  type: string
  subType?: string
  position?: number | [number, number]
  selector?: string
  confidence: number
}

export interface CommandAction {
  type: string
  value?: string | number | boolean
  operator?: 'set' | 'add' | 'remove' | 'toggle'
  confidence: number
}

export interface CommandCondition {
  type: string
  operator: string
  value: string | number
}

export interface CommandModifier {
  scope: 'all' | 'partial' | 'selected' | 'conditional'
  quantity?: number
  range?: [number, number]
  exclude?: string[]
}

export class SmartParser {
  private static readonly intentPatterns = {
    format: [
      /把|将|让|使|给|帮|请|麻烦|希望|想要|需要/,
      /设置|改成|改为|调整|修改|格式化|排版/,
      /居中|对齐|缩进|加粗|斜体|下划线|字体|字号|颜色|行距/
    ],
    replace: [
      /替换成|换成|改成|改为|变成/,
      /把.*替换|把.*换成|把.*改成/,
      /标题.*替换|正文.*替换|段落.*替换/
    ],
    insert: [
      /插入|添加|增加|加入/,
      /插入.*标题|插入.*段落|插入.*图片|插入.*表格/,
      /添加.*标题|添加.*段落|添加.*图片|添加.*表格/
    ],
    delete: [
      /删除|去掉|移除|删掉/,
      /删除.*标题|删除.*段落|删除.*图片|删除.*表格/,
      /去掉.*标题|去掉.*段落|去掉.*图片|去掉.*表格/
    ],
    undo: [
      /^撤销$|^撤回$|^取消$|^返回$|^回退$|^退回$/,
      /撤销上|撤回上|取消上|撤销刚才|撤回刚才|取消刚才/,
      /不要这个|这个不要|去掉刚才|不要刚才/,
      /全部撤销|全部撤回|撤销所有|撤回所有|恢复原样|恢复原状|全部取消/,
      /从头开始|重新开始|全部重来/
    ],
    redo: [
      /^恢复$|^重做$/,
      /取消撤销|撤销刚才的撤销|恢复刚才/
    ],
    correct: [
      /不对|错了|搞错|弄错|不是|反了|颠倒/,
      /应该是|其实|实际上|我的意思是|我是说/,
      /更正|修正|改一下|修改一下/
    ],
    query: [
      /有多少|什么问题|检查|分析|看看|查询/,
      /标题数量|段落数量|图片数量|表格数量/
    ],
    help: [
      /^帮助$|^帮我$|^help$/i,
      /怎么用|怎么操作|怎么弄|如何使用/,
      /你能做什么|你有什么功能|有什么命令/
    ]
  }

  private static readonly targetPatterns = {
    heading: ['标题', 'heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    heading1: ['一级标题', '标题一', '大标题', 'h1'],
    heading2: ['二级标题', '标题二', '中标题', 'h2'],
    heading3: ['三级标题', '标题三', '小标题', 'h3'],
    paragraph: ['正文', '段落', '普通文字', '普通文本', '内容', '文字', '文本'],
    image: ['图片', '图像', '插图', '照片', '图形'],
    table: ['表格', '表', '数据表'],
    list: ['列表', '清单', '项目列表'],
    link: ['链接', '超链接', '网址'],
    all: ['全文', '整个文档', '所有内容', '全部内容', '文档']
  }

  private static readonly actionPatterns = {
    alignment: {
      center: ['居中', '居中对齐', '中间对齐', '放中间', '剧中', '据中'],
      left: ['左对齐', '靠左', '左边对齐', '放左边', '做对齐', '座对齐'],
      right: ['右对齐', '靠右', '右边对齐', '放右边', '又对齐', '有对齐'],
      justify: ['两端对齐', '分散对齐', '两边对齐']
    },
    indent: {
      firstLine: ['首行缩进', '首行缩两格', '开头空两格', '缩进', '缩两格', '空两格', '首行缩金', '首行缩近'],
      hanging: ['悬挂缩进', '悬挂']
    },
    fontStyle: {
      bold: ['加粗', '粗体', '变粗', '黑体字', '家粗', '加初'],
      italic: ['斜体', '倾斜', '斜着', '斜字', '鞋体', '写体'],
      underline: ['下划线', '加下划线', '划线', '下画线', '下化线'],
      strikethrough: ['删除线', '划掉', '划去']
    },
    fontFamily: {
      simsun: ['宋体', '送体', '松体'],
      simhei: ['黑体', '和体', '喝体'],
      kaiti: ['楷体', '开体', '凯体'],
      fangsong: ['仿宋'],
      yahei: ['微软雅黑', '雅黑']
    },
    fontSize: {
      small4: ['小四'],
      size4: ['四号'],
      small3: ['小三'],
      size3: ['三号'],
      small2: ['小二'],
      size2: ['二号'],
      small1: ['小一'],
      size1: ['一号'],
      initial: ['初号'],
      smallInitial: ['小初']
    },
    color: {
      red: ['红色'],
      blue: ['蓝色'],
      green: ['绿色'],
      black: ['黑色'],
      yellow: ['黄色'],
      orange: ['橙色'],
      purple: ['紫色'],
      gray: ['灰色', '灰色']
    },
    lineSpacing: {
      single: ['单倍行距', '一倍行距'],
      onePointFive: ['1.5倍行距', '一点五倍行距', '1.5行距'],
      double: ['双倍行距', '两倍行距', '2倍行距']
    }
  }

  private static readonly combinationOperators = ['+', '加', '和', '与', '以及', '同时', '并且', '并', '且', '还有', '再', '然后', '接着', '顺便', '一起', '都']

  static parse(input: string): ParsedCommand {
    const correctionResult = SemanticAxisCorrector.correct(input)
    const text = correctionResult.corrected
    const correctedText = text !== input ? text : undefined

    const intent = this.detectIntent(text)
    const target = this.detectTarget(text)
    const actions = this.detectActions(text)
    const conditions = this.detectConditions(text)
    const modifiers = this.detectModifiers(text)

    const confidence = this.calculateConfidence(intent, target, actions)

    return {
      intent,
      target,
      actions,
      conditions,
      modifiers,
      originalText: input,
      correctedText,
      confidence
    }
  }

  private static detectIntent(text: string): CommandIntent {
    for (const [type, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern instanceof RegExp) {
          if (pattern.test(text)) {
            let subType: string | undefined
            if (type === 'undo') {
              if (/全部|所有|原样|原状/.test(text)) {
                subType = 'all'
              } else {
                subType = 'last'
              }
            }
            return { type: type as CommandIntent['type'], subType, confidence: 0.9 }
          }
        } else if (text.includes(pattern)) {
          return { type: type as CommandIntent['type'], confidence: 0.85 }
        }
      }
    }

    if (this.hasFormatKeywords(text)) {
      return { type: 'format', confidence: 0.7 }
    }

    return { type: 'unknown', confidence: 0.3 }
  }

  private static hasFormatKeywords(text: string): boolean {
    const formatKeywords = [
      '居中', '对齐', '缩进', '加粗', '斜体', '下划线',
      '字体', '字号', '颜色', '行距', '宋体', '黑体', '楷体'
    ]
    return formatKeywords.some(kw => text.includes(kw))
  }

  private static detectTarget(text: string): CommandTarget {
    for (const [type, keywords] of Object.entries(this.targetPatterns)) {
      for (const keyword of keywords) {
        const index = text.indexOf(keyword)
        if (index !== -1) {
          let subType: string | undefined
          let position: number | [number, number] | undefined

          if (type === 'heading') {
            const levelMatch = text.match(/([一二三四五六]|第[一二三四五六]|[1-6])\s*(级?标题?)/)
            if (levelMatch) {
              const levelMap: Record<string, string> = {
                '一': 'heading1', '二': 'heading2', '三': 'heading3',
                '四': 'heading4', '五': 'heading5', '六': 'heading6',
                '1': 'heading1', '2': 'heading2', '3': 'heading3',
                '4': 'heading4', '5': 'heading5', '6': 'heading6'
              }
              subType = levelMap[levelMatch[1]]
            }
          }

          const positionMatch = text.match(/第?([一二三四五六七八九十\d]+)\s*(个|段|个标题|个段落)/)
          if (positionMatch) {
            const posMap: Record<string, number> = {
              '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
              '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
            }
            position = posMap[positionMatch[1]] || parseInt(positionMatch[1])
          }

          const rangeMatch = text.match(/前([一二三四五六七八九十\d]+)\s*(个|段|个标题|个段落)/)
          if (rangeMatch) {
            const posMap: Record<string, number> = {
              '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
              '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
            }
            const end = posMap[rangeMatch[1]] || parseInt(rangeMatch[1])
            position = [1, end]
          }

          return {
            type,
            subType,
            position,
            confidence: 0.9
          }
        }
      }
    }

    return { type: 'unknown', confidence: 0.3 }
  }

  private static detectActions(text: string): CommandAction[] {
    const actions: CommandAction[] = []
    const segments = this.splitByCombinationOperators(text)

    const replaceMatch = text.match(/替换成|换成|改成|改为|变成/)
    if (replaceMatch) {
      const replaceValueMatch = text.match(/替换成\s*(.+?)(?:$|[，。、])/)
      if (replaceValueMatch) {
        actions.push({
          type: 'replace',
          value: replaceValueMatch[1].trim(),
          operator: 'set',
          confidence: 0.95
        })
        return actions
      }
      
      const replaceValueMatch2 = text.match(/把.*?替换成\s*(.+?)(?:$|[，。、])/)
      if (replaceValueMatch2) {
        actions.push({
          type: 'replace',
          value: replaceValueMatch2[1].trim(),
          operator: 'set',
          confidence: 0.95
        })
        return actions
      }
    }

    const insertMatch = text.match(/插入|添加|增加/)
    if (insertMatch) {
      const insertValueMatch = text.match(/插入\s*(.+?)(?:$|[，。、])/)
      if (insertValueMatch) {
        actions.push({
          type: 'insert',
          value: insertValueMatch[1].trim(),
          operator: 'add',
          confidence: 0.9
        })
        return actions
      }
    }

    const deleteMatch = text.match(/删除|去掉|移除/)
    if (deleteMatch) {
      actions.push({
        type: 'delete',
        value: true,
        operator: 'remove',
        confidence: 0.9
      })
      return actions
    }

    for (const segment of segments) {
      for (const [actionType, actionValues] of Object.entries(this.actionPatterns)) {
        for (const [value, keywords] of Object.entries(actionValues)) {
          for (const keyword of keywords) {
            if (segment.includes(keyword)) {
              const existingAction = actions.find(a => a.type === actionType)
              if (existingAction) {
                existingAction.value = value
              } else {
                actions.push({
                  type: actionType,
                  value,
                  operator: 'set',
                  confidence: 0.9
                })
              }
              break
            }
          }
        }
      }
    }

    const fontSizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(号|pt|磅)/)
    if (fontSizeMatch) {
      const existingAction = actions.find(a => a.type === 'fontSize')
      if (!existingAction) {
        actions.push({
          type: 'fontSize',
          value: parseFloat(fontSizeMatch[1]),
          operator: 'set',
          confidence: 0.9
        })
      }
    }

    const lineSpacingMatch = text.match(/(\d+(?:\.\d+)?)\s*倍行距/)
    if (lineSpacingMatch) {
      const existingAction = actions.find(a => a.type === 'lineSpacing')
      if (!existingAction) {
        actions.push({
          type: 'lineSpacing',
          value: parseFloat(lineSpacingMatch[1]),
          operator: 'set',
          confidence: 0.9
        })
      }
    }

    const increaseMatch = text.match(/大一点|放大|增大|加?大/)
    if (increaseMatch) {
      actions.push({
        type: 'fontSize',
        operator: 'add',
        value: 2,
        confidence: 0.8
      })
    }

    const decreaseMatch = text.match(/小一点|缩小|减小|加?小/)
    if (decreaseMatch) {
      actions.push({
        type: 'fontSize',
        operator: 'remove',
        value: 2,
        confidence: 0.8
      })
    }

    return actions
  }

  private static splitByCombinationOperators(text: string): string[] {
    const segments: string[] = [text]
    
    for (const op of this.combinationOperators) {
      const newSegments: string[] = []
      for (const seg of segments) {
        const parts = seg.split(op)
        newSegments.push(...parts.filter(s => s.trim()))
      }
      if (newSegments.length > segments.length) {
        segments.length = 0
        segments.push(...newSegments)
      }
    }
    
    return segments.filter(s => s.trim().length > 0)
  }

  private static detectConditions(text: string): CommandCondition[] {
    const conditions: CommandCondition[] = []

    const lengthCondition = text.match(/(标题|段落|正文).*(太长|超过|大于|多于)\s*(\d+)\s*(个字|字|行)/)
    if (lengthCondition) {
      conditions.push({
        type: 'length',
        operator: '>',
        value: parseInt(lengthCondition[3])
      })
    }

    const countCondition = text.match(/超过\s*(\d+)\s*(个|段|个标题|个段落)/)
    if (countCondition) {
      conditions.push({
        type: 'count',
        operator: '>',
        value: parseInt(countCondition[1])
      })
    }

    return conditions
  }

  private static detectModifiers(text: string): CommandModifier {
    const modifier: CommandModifier = { scope: 'all' }

    if (/全部|所有|整个文档|全文/.test(text)) {
      modifier.scope = 'all'
    } else if (/前\s*[一二三四五六七八九十\d]+\s*(个|段)/.test(text)) {
      modifier.scope = 'partial'
      const match = text.match(/前\s*([一二三四五六七八九十\d]+)\s*(个|段)/)
      if (match) {
        const posMap: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        }
        modifier.quantity = posMap[match[1]] || parseInt(match[1])
      }
    } else if (/后\s*[一二三四五六七八九十\d]+\s*(个|段)/.test(text)) {
      modifier.scope = 'partial'
      const match = text.match(/后\s*([一二三四五六七八九十\d]+)\s*(个|段)/)
      if (match) {
        const posMap: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        }
        modifier.quantity = posMap[match[1]] || parseInt(match[1])
      }
    } else if (/第\s*[一二三四五六七八九十\d]+\s*(个|段)/.test(text)) {
      modifier.scope = 'partial'
      modifier.quantity = 1
    } else if (/每隔/.test(text)) {
      modifier.scope = 'partial'
    }

    const excludeMatch = text.match(/除了?([^，。、]+)[，。]?/)
    if (excludeMatch) {
      modifier.exclude = [excludeMatch[1].trim()]
    }

    return modifier
  }

  private static calculateConfidence(
    intent: CommandIntent,
    target: CommandTarget,
    actions: CommandAction[]
  ): number {
    let confidence = 0.5

    if (intent.confidence > 0.8) confidence += 0.2
    else if (intent.confidence > 0.6) confidence += 0.1

    if (target.confidence > 0.8) confidence += 0.15
    else if (target.confidence > 0.6) confidence += 0.1

    if (actions.length > 0) {
      confidence += Math.min(actions.length * 0.05, 0.15)
    }

    return Math.min(confidence, 1)
  }

  static isCombinationCommand(text: string): boolean {
    return this.combinationOperators.some(op => text.includes(op))
  }

  static getCombinationActions(text: string): string[] {
    const actions: string[] = []
    let remaining = text

    for (const op of this.combinationOperators) {
      const parts = remaining.split(op)
      if (parts.length > 1) {
        actions.push(...parts.filter(s => s.trim()))
        remaining = parts[parts.length - 1]
      }
    }

    if (actions.length === 0 && text.trim()) {
      actions.push(text.trim())
    }

    return actions
  }
}

export const smartParser = SmartParser

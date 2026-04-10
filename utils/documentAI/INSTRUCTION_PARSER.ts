import { TextProcessor } from '../localAI/UTF8_ENCODER'
import { SemanticAxisCorrector } from './SEMANTIC_AXIS'
import { SmartParser } from './SMART_PARSER'

export interface FormatInstruction {
  id: string
  targetType: string
  action: 'format' | 'align' | 'style' | 'correct' | 'replace' | 'insert' | 'delete'
  properties: Record<string, unknown>
  position?: number | [number, number]
  confidence: number
  originalText: string
  trigger?: string
  correctedFrom?: string
  correctionConfidence?: number
}

export interface ParsedInstruction {
  id: string
  instructions: FormatInstruction[]
  globalActions: string[]
  detectedErrors: DetectedError[]
  executionPlan: ExecutionStep[]
  summary: string
  multiInstructionCount: number
  needsRollback: boolean
  rollbackType: 'full' | 'partial' | 'none'
  rollbackHint?: string
  correctedInput?: string
  correctionApplied: boolean
  smartCommand?: any
}

export interface DetectedError {
  type: string
  location: string
  description: string
  severity: 'high' | 'medium' | 'low'
}

export interface ExecutionStep {
  id: string
  type: 'format' | 'analyze' | 'correct' | 'batch'
  action: string
  target: string
  params: Record<string, unknown>
  dependencies: string[]
  estimatedTime: number
}

export class ComplexInstructionParser {
  private static specialTokens = [
    '把', '将', '让', '使', '给', 'this',
    '请', '帮我把', '请把', '让我', '请让我', '帮我',
    '麻烦把', '麻烦', '麻烦你把', '请将', '请使', '请给',
    '希望把', '希望将', '想要把', '想要将', '需要把', '需要将'
  ]

  private static rollbackKeywords = [
    '不对', '错了', '搞错了', '弄错了', '撤销', '撤回', '取消',
    '重新', '重做', '改一下', '修改一下', '更正', '修正一下',
    '不是', '别', '不要', '算了', '取消刚才', '刚才不对',
    '那个不对', '那个错了', '反过来', '反了', '换一下',
    '应该是', '其实', '实际上', '我的意思是'
  ]

  private static fullRollbackKeywords = [
    '全部撤销', '全部撤回', '全部取消', '撤销所有', '撤回所有',
    '取消所有', '恢复原样', '恢复原状', '全部重来', '从头开始'
  ]

  private static formatPatterns = [
    { pattern: /宋体/i, property: 'fontFamily', value: 'SimSun, serif' },
    { pattern: /黑体/i, property: 'fontFamily', value: 'SimHei, sans-serif' },
    { pattern: /楷体/i, property: 'fontFamily', value: 'KaiTi, serif' },
    { pattern: /仿宋/i, property: 'fontFamily', value: 'FangSong, serif' },
    { pattern: /微软雅黑/i, property: 'fontFamily', value: '"Microsoft YaHei", sans-serif' },
    { pattern: /(\d+(?:\.\d+)?)\s*(号|pt|磅)/i, property: 'fontSize', valueExtractor: (m: RegExpMatchArray) => parseFloat(m[1]) },
    { pattern: /小四/i, property: 'fontSize', value: 12 },
    { pattern: /四号/i, property: 'fontSize', value: 14 },
    { pattern: /小三/i, property: 'fontSize', value: 15 },
    { pattern: /三号/i, property: 'fontSize', value: 16 },
    { pattern: /二号/i, property: 'fontSize', value: 22 },
    { pattern: /小二/i, property: 'fontSize', value: 18 },
    { pattern: /一号/i, property: 'fontSize', value: 26 },
    { pattern: /小一/i, property: 'fontSize', value: 24 },
    { pattern: /初号/i, property: 'fontSize', value: 42 },
    { pattern: /小初/i, property: 'fontSize', value: 36 },
    { pattern: /加粗|粗体/i, property: 'bold', value: true },
    { pattern: /斜体|倾斜/i, property: 'italic', value: true },
    { pattern: /下划线/i, property: 'underline', value: true },
    { pattern: /删除线|删除/i, property: 'strikethrough', value: true },
    { pattern: /下标/i, property: 'subscript', value: true },
    { pattern: /上标/i, property: 'superscript', value: true },
    { pattern: /居中|中间/i, property: 'alignment', value: 'center' },
    { pattern: /左对齐|靠左/i, property: 'alignment', value: 'left' },
    { pattern: /右对齐|靠右/i, property: 'alignment', value: 'right' },
    { pattern: /两端对齐|分散对齐/i, property: 'alignment', value: 'justify' },
    { pattern: /红色/i, property: 'color', value: '#FF0000' },
    { pattern: /蓝色/i, property: 'color', value: '#0000FF' },
    { pattern: /绿色/i, property: 'color', value: '#008000' },
    { pattern: /黑色/i, property: 'color', value: '#000000' },
    { pattern: /(\d+(?:\.\d+)?)\s*倍行距/i, property: 'lineSpacing', valueExtractor: (m: RegExpMatchArray) => parseFloat(m[1]) },
    { pattern: /单倍行距|一倍行距/i, property: 'lineSpacing', value: 1 },
    { pattern: /双倍行距|两倍行距/i, property: 'lineSpacing', value: 2 },
    { pattern: /1\.5倍行距|一点五倍行距/i, property: 'lineSpacing', value: 1.5 },
    { pattern: /首行缩进|首航缩进|首行|首航/i, property: 'indent', value: 2 },
  ]

  private static actionPatterns = [
    { pattern: /格式化|设置|改成|改为|调整|修改/i, action: 'format' },
    { pattern: /对齐/i, action: 'align' },
    { pattern: /纠正|修正|修复/i, action: 'correct' },
    { pattern: /样式/i, action: 'style' },
    { pattern: /替换成|换成|改成|改为|变成/i, action: 'replace' },
    { pattern: /插入|添加|增加|插入一个|添加一个|增加一个/i, action: 'insert' },
    { pattern: /删除|去掉|移除/i, action: 'delete' },
    { pattern: /续写|继续写|补充|扩展|续一段|再写/i, action: 'insert' },
    { pattern: /生成|创建|新建|制作/i, action: 'insert' },
  ]

  private static contentKeywords = [
    { pattern: /图片|图像|插图|照片|截图/i, type: 'image' },
    { pattern: /表格/i, type: 'table' },
    { pattern: /标题/i, type: 'heading' },
    { pattern: /正文|段落|内容|文字|文本/i, type: 'paragraph' },
    { pattern: /列表|项目符号|编号/i, type: 'list' },
    { pattern: /链接|超链接|网址/i, type: 'link' },
    { pattern: /页眉/i, type: 'header' },
    { pattern: /页脚/i, type: 'footer' },
    { pattern: /页码/i, type: 'pageNumber' },
    { pattern: /批注|注释|备注/i, type: 'comment' },
    { pattern: /书签/i, type: 'bookmark' },
    { pattern: /目录/i, type: 'toc' },
  ]

  static parse(instruction: string): ParsedInstruction {
    const normalizedText = TextProcessor.normalize(instruction)
    
    const smartCommand = SmartParser.parse(normalizedText)
    
    const correctionResult = SemanticAxisCorrector.correct(normalizedText)
    const correctedText = correctionResult.corrected
    const correctionApplied = correctedText !== normalizedText
    
    const rollbackInfo = this.detectRollback(correctedText)
    
    const instructions = this.extractInstructions(correctedText)
    
    if (smartCommand.actions.length > 0) {
      for (const smartAction of smartCommand.actions) {
        const existingInst = instructions.find(i => i.targetType === smartCommand.target.type)
        if (existingInst) {
          existingInst.properties[smartAction.type] = smartAction.value
        } else {
          instructions.push({
            id: `fmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            targetType: smartCommand.target.type,
            action: 'format',
            properties: { [smartAction.type]: smartAction.value },
            confidence: smartCommand.confidence,
            originalText: normalizedText
          })
        }
      }
    }
    
    if (correctionApplied && correctionResult.confidence > 0.8) {
      for (const inst of instructions) {
        inst.correctedFrom = normalizedText
        inst.correctionConfidence = correctionResult.confidence
      }
    }
    
    const detectedErrors = this.detectPotentialErrors(correctedText, instructions)
    const executionPlan = this.generateExecutionPlan(instructions, detectedErrors)
    const summary = this.generateSummary(instructions, detectedErrors, correctionApplied, normalizedText)
    const multiInstructionCount = this.countMultiInstructions(correctedText)

    return {
      id: `inst-${Date.now()}`,
      instructions,
      globalActions: this.extractGlobalActions(correctedText),
      detectedErrors,
      executionPlan,
      summary,
      multiInstructionCount,
      needsRollback: rollbackInfo.needsRollback,
      rollbackType: rollbackInfo.rollbackType,
      rollbackHint: rollbackInfo.rollbackHint,
      correctedInput: correctionApplied ? correctedText : undefined,
      correctionApplied,
      smartCommand
    }
  }

  private static detectRollback(text: string): { needsRollback: boolean; rollbackType: 'full' | 'partial' | 'none'; rollbackHint?: string } {
    for (const keyword of this.fullRollbackKeywords) {
      if (text.includes(keyword)) {
        return {
          needsRollback: true,
          rollbackType: 'full',
          rollbackHint: `检测到"${keyword}"，将撤销所有之前的操作`
        }
      }
    }
    
    for (const keyword of this.rollbackKeywords) {
      if (text.includes(keyword)) {
        const newInstructionMatch = text.match(/(?:应该是|其实|实际上|我的意思是|重新|改一下|修改一下|更正|修正一下)?[，,]?\s*(.+)/)
        const newInstruction = newInstructionMatch ? newInstructionMatch[1] : undefined
        
        return {
          needsRollback: true,
          rollbackType: 'partial',
          rollbackHint: newInstruction 
            ? `检测到"${keyword}"，将撤销上次操作并执行新指令`
            : `检测到"${keyword}"，将撤销上次操作`
        }
      }
    }
    
    return {
      needsRollback: false,
      rollbackType: 'none'
    }
  }

  private static countMultiInstructions(text: string): number {
    let count = 0
    const sortedSpecialTokens = [...this.specialTokens].sort((a, b) => b.length - a.length)
    let searchText = text
    
    for (const token of sortedSpecialTokens) {
      const regex = new RegExp(this.escapeRegex(token), 'g')
      const matches = searchText.match(regex)
      if (matches) {
        count += matches.length
        searchText = searchText.replace(regex, ' '.repeat(token.length))
      }
    }
    
    if (count === 0) {
      for (const keyword of this.targetTypeKeywords) {
        const regex = new RegExp(this.escapeRegex(keyword), 'g')
        const matches = text.match(regex)
        if (matches) {
          count += matches.length
        }
      }
    }
    
    return Math.max(count, 1)
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private static extractInstructions(text: string): FormatInstruction[] {
    const instructions: FormatInstruction[] = []
    const segments = this.segmentInstruction(text)

    for (const segment of segments) {
      const instruction = this.parseSegment(segment)
      if (instruction) {
        instructions.push(instruction)
      }
    }

    return instructions
  }

  private static targetTypeKeywords = [
    '标题一', '一级标题', '标题二', '二级标题', '标题三', '三级标题',
    '标题四', '四级标题', '标题五', '五级标题', '标题六', '六级标题',
    '标题', '正文', '段落', '图片', '图像', '插图', '表格'
  ]

  private static segmentInstruction(text: string): string[] {
    const segments: string[] = []
    
    // 首先按分隔符分割
    const delimitedSegments = this.segmentByDelimiters(text)
    
    // 对每个分隔后的段进行处理
    for (const segment of delimitedSegments) {
      const trimmedSegment = segment.trim()
      if (!trimmedSegment) continue
      
      // 检查是否包含目标关键词
      let hasTarget = false
      for (const keyword of this.targetTypeKeywords) {
        if (trimmedSegment.includes(keyword)) {
          hasTarget = true
          break
        }
      }
      
      if (hasTarget) {
        segments.push(trimmedSegment)
      } else {
        // 如果没有目标关键词，作为独立段处理
        segments.push(trimmedSegment)
      }
    }
    
    if (segments.length === 0) {
      return [text.trim()]
    }
    
    return segments.filter(s => s.trim().length > 0)
  }

  private static segmentByDelimiters(text: string): string[] {
    const delimiters = ['，', '。', '；', '、', '然后', '接着', '同时', '另外', '还有', '以及', '并且', '再']
    let segments: string[] = [text]

    for (const delimiter of delimiters) {
      const newSegments: string[] = []
      for (const seg of segments) {
        const parts = seg.split(delimiter).filter(s => s.trim())
        newSegments.push(...parts)
      }
      segments = newSegments
    }

    return segments.filter(s => s.trim().length > 0)
  }

  private static parseSegment(segment: string): FormatInstruction | null {
    let targetType = 'all'
    let action: FormatInstruction['action'] = 'format'

    if (/标题一|一级标题|h1/i.test(segment)) {
      targetType = 'heading1'
    } else if (/标题二|二级标题|h2/i.test(segment)) {
      targetType = 'heading2'
    } else if (/标题三|三级标题|h3/i.test(segment)) {
      targetType = 'heading3'
    } else if (/标题四|四级标题|h4/i.test(segment)) {
      targetType = 'heading4'
    } else if (/标题五|五级标题|h5/i.test(segment)) {
      targetType = 'heading5'
    } else if (/标题六|六级标题|h6/i.test(segment)) {
      targetType = 'heading6'
    } else if (/标题/i.test(segment)) {
      targetType = 'heading'
    } else if (/正文|段落|普通文本|普通文字/i.test(segment)) {
      targetType = 'paragraph'
    } else if (/图片|图像|插图/i.test(segment)) {
      targetType = 'image'
    } else if (/表格/i.test(segment)) {
      targetType = 'table'
    } else {
      for (const { pattern, type } of this.contentKeywords) {
        if (pattern.test(segment)) {
          targetType = type
          break
        }
      }
    }

    for (const { pattern, action: actionType } of this.actionPatterns) {
      if (pattern.test(segment)) {
        action = actionType as FormatInstruction['action']
        break
      }
    }

    const properties: Record<string, unknown> = {}

    const replaceMatch = segment.match(/替换成\s*(.+?)(?:$|[，。、])/)
    if (replaceMatch) {
      properties.replace = replaceMatch[1].trim()
      action = 'replace'
    }

    const insertMatch = segment.match(/插入\s*(.+?)(?:$|[，。、])/)
    if (insertMatch) {
      properties.insert = insertMatch[1].trim()
      action = 'insert'
    }

    const continueMatch = segment.match(/续写\s*(\d+)?\s*(个?字|句|段|行)?|继续写\s*(\d+)?\s*(个?字|句|段|行)?|补充\s*(\d+)?\s*(个?字|句|段|行)?/)
    if (continueMatch) {
      const count = continueMatch[1] || continueMatch[3] || continueMatch[5] || '1'
      const unit = continueMatch[2] || continueMatch[4] || continueMatch[6] || '段'
      properties.continueCount = parseInt(count)
      properties.continueUnit = unit.replace(/个?/, '')
      targetType = 'content'
      action = 'insert'
    }

    if (/增加.*图片|添加.*图片|插入.*图片|加.*图片/.test(segment)) {
      targetType = 'image'
      action = 'insert'
      properties.imageAction = 'insert'
    }

    if (/增加.*表格|添加.*表格|插入.*表格|加.*表格/.test(segment)) {
      targetType = 'table'
      action = 'insert'
      const rowMatch = segment.match(/(\d+)\s*行/)
      const colMatch = segment.match(/(\d+)\s*列/)
      properties.rows = rowMatch ? parseInt(rowMatch[1]) : 3
      properties.cols = colMatch ? parseInt(colMatch[1]) : 3
    }

    if (/删除|去掉|移除/.test(segment)) {
      properties.delete = true
      action = 'delete'
    }

    for (const { pattern, property, value, valueExtractor } of this.formatPatterns) {
      const match = segment.match(pattern)
      if (match) {
        if (valueExtractor && match) {
          properties[property] = valueExtractor(match)
        } else if (value !== undefined) {
          properties[property] = value
        }
      }
    }

    if (Object.keys(properties).length === 0 && targetType === 'all' && action === 'format') {
      return null
    }

    let position: number | [number, number] | undefined
    const positionMatch = segment.match(/第\s*([一二三四五六七八九十\d]+)\s*(个|段|个标题|个段落)?/)
    if (positionMatch) {
      const posMap: Record<string, number> = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
      }
      position = posMap[positionMatch[1]] || parseInt(positionMatch[1])
    }
    
    const rangeMatch = segment.match(/前\s*([一二三四五六七八九十\d]+)\s*(个|段|个标题|个段落)?/)
    if (rangeMatch) {
      const posMap: Record<string, number> = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
      }
      const end = posMap[rangeMatch[1]] || parseInt(rangeMatch[1])
      position = [1, end]
    }
    
    const lastMatch = segment.match(/最后\s*([一二三四五六七八九十\d]+)?\s*(个|段|个标题|个段落)?/)
    if (lastMatch) {
      properties.isLast = true
      if (lastMatch[1]) {
        const posMap: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        }
        properties.lastCount = posMap[lastMatch[1]] || parseInt(lastMatch[1])
      }
    }

    return {
      id: `fmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      targetType,
      action,
      properties,
      position,
      confidence: this.calculateConfidence(segment, properties),
      originalText: segment
    }
  }

  private static calculateConfidence(_segment: string, properties: Record<string, unknown>): number {
    let confidence = 0.5
    
    if (Object.keys(properties).length > 0) confidence += 0.2
    if (properties.fontFamily) confidence += 0.1
    if (properties.fontSize) confidence += 0.1
    if (properties.alignment) confidence += 0.1
    
    return Math.min(1, confidence)
  }

  private static extractGlobalActions(text: string): string[] {
    const actions: string[] = []
    
    if (/全文|整个文档|所有内容/i.test(text)) {
      actions.push('apply_to_all')
    }
    if (/批量/i.test(text)) {
      actions.push('batch_operation')
    }
    if (/自动/i.test(text)) {
      actions.push('auto_detect')
    }
    if (/检查|检测/i.test(text)) {
      actions.push('check_format')
    }
    
    return actions
  }

  private static detectPotentialErrors(text: string, _instructions: FormatInstruction[]): DetectedError[] {
    const errors: DetectedError[] = []
    
    if (/正文.*标题|标题.*正文|错误|不对|问题/i.test(text)) {
      errors.push({
        type: 'misformatted_heading',
        location: '文档中',
        description: '文档中可能存在正文被误标为标题的情况',
        severity: 'high'
      })
    }

    if (/不一致|不统一|混用/i.test(text)) {
      errors.push({
        type: 'inconsistent_style',
        location: '文档中',
        description: '文档格式可能不一致',
        severity: 'medium'
      })
    }

    return errors
  }

  private static generateExecutionPlan(instructions: FormatInstruction[], errors: DetectedError[]): ExecutionStep[] {
    const steps: ExecutionStep[] = []
    let stepId = 1

    if (errors.length > 0) {
      steps.push({
        id: `step-${stepId++}`,
        type: 'analyze',
        action: 'analyze_document',
        target: 'all',
        params: {},
        dependencies: [],
        estimatedTime: 500
      })
    }

    const groupedInstructions = this.groupInstructionsByTarget(instructions)

    for (const [target, insts] of groupedInstructions) {
      const mergedProperties = this.mergeProperties(insts)
      
      steps.push({
        id: `step-${stepId++}`,
        type: 'format',
        action: insts[0].action,
        target,
        params: mergedProperties,
        dependencies: stepId > 2 ? [`step-${stepId - 2}`] : [],
        estimatedTime: 200 * insts.length
      })
    }

    if (errors.some(e => e.type === 'misformatted_heading')) {
      steps.push({
        id: `step-${stepId++}`,
        type: 'correct',
        action: 'correct_format',
        target: 'all',
        params: {},
        dependencies: [`step-${stepId - 2}`],
        estimatedTime: 1000
      })
    }

    return steps
  }

  private static groupInstructionsByTarget(instructions: FormatInstruction[]): Map<string, FormatInstruction[]> {
    const grouped = new Map<string, FormatInstruction[]>()
    
    for (const inst of instructions) {
      const key = inst.targetType
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(inst)
    }
    
    return grouped
  }

  private static mergeProperties(instructions: FormatInstruction[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {}
    
    for (const inst of instructions) {
      Object.assign(merged, inst.properties)
    }
    
    return merged
  }

  private static generateSummary(
    instructions: FormatInstruction[], 
    errors: DetectedError[],
    correctionApplied: boolean = false,
    originalText?: string
  ): string {
    if (instructions.length === 0 && errors.length === 0) {
      return '未能识别有效的格式化指令，请尝试更明确的表达，如"标题一用黑体16号居中"'
    }

    const parts: string[] = []

    if (correctionApplied && originalText) {
      parts.push(`已自动纠正输入中的拼写错误`)
    }

    if (instructions.length > 0) {
      const targetTypes = [...new Set(instructions.map(i => i.targetType))]
      parts.push(`识别到 ${instructions.length} 条格式化指令，涉及 ${targetTypes.length} 种元素类型`)
    }

    if (errors.length > 0) {
      parts.push(`检测到 ${errors.length} 个潜在格式问题`)
    }

    return parts.join('，')
  }
}

export const instructionParser = ComplexInstructionParser

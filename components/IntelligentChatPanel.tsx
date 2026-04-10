import { useState, useRef, useEffect, useCallback } from 'react'
import { globalSemanticEngine, SemanticIntent, intelligentEngine } from '@/utils/localAI'
import { ComplexInstructionParser, createInstructionExecutor, DocumentAnalyzer, DocumentAnalysisResult, ContextAnalyzer, ContextAnalysisResult as ContextResult } from '@/utils/documentAI/INDEX'
import { AIThinkingProcess } from './AIThinkingProcess'


interface IntelligentChatPanelProps {
  isOpen: boolean
  onClose: () => void
  documentContent: string
  onFormatAction: (action: string, value?: unknown) => void
  onInsertTable: (rows: number, cols: number) => void
  onInsertImage: () => void
  onOpenPageSetup: () => void
  onOpenPrintPreview: () => void
  onAutoFormat: () => void
  onApplyProfile: (profileId: string) => void
  currentFormat: {
    fontSize: number
    fontFamily: string
    textColor: string
    lineSpacing: string
    isBold: boolean
    isItalic: boolean
    isUnderline: boolean
  }
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestions?: string[]
  action?: { type: string; params: Record<string, unknown> }
  documentAnalysis?: DocumentAnalysisResult
  originalInstruction?: string
}

interface FormatHistoryRecord {
  id: string
  timestamp: Date
  instruction: string
  changes: ElementChangeRecord[]
}

interface ElementChangeRecord {
  element: HTMLElement
  selector: string
  beforeStyles: Record<string, string>
  afterStyles: Record<string, string>
}

export function IntelligentChatPanel({
  isOpen,
  onClose,
  documentContent: _documentContent,
  onFormatAction,
  onInsertTable,
  onInsertImage,
  onOpenPageSetup,
  onOpenPrintPreview,
  onAutoFormat,
  onApplyProfile,
  currentFormat: _currentFormat
}: IntelligentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showThinkingProcess, setShowThinkingProcess] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const documentAnalysisRef = useRef<DocumentAnalysisResult | null>(null)
  const formatHistoryRef = useRef<FormatHistoryRecord[]>([])
  const redoHistoryRef = useRef<FormatHistoryRecord[]>([])
  const lastExecutedActionRef = useRef<{ type: string; params: Record<string, unknown> } | null>(null)

  // 思考过程步骤
  const [thinkingProcess, setThinkingProcess] = useState([
    { step: '理解用户意图', description: '分析用户输入，确定核心需求和操作目标', duration: 800 },
    { step: '分析文档结构', description: '扫描文档内容，识别标题、段落、图片等元素', duration: 1200 },
    { step: '生成执行方案', description: '根据意图和文档结构，制定具体的操作步骤', duration: 1000 },
    { step: '执行指令分析', description: '解析指令细节，准备执行相应的文档操作', duration: 900 },
    { step: '生成响应内容', description: '整合分析结果，生成清晰的操作建议和反馈', duration: 1100 }
  ])

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetingIntent: SemanticIntent = {
        type: 'greeting',
        confidence: 1,
        entities: [],
        parameters: {}
      }
      const response = globalSemanticEngine.generateResponse(greetingIntent, '你好')
      setMessages([{
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions
      }])
    }
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen, messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const analyzeDocument = useCallback((content: string) => {
    const analysis = DocumentAnalyzer.analyze(content)
    documentAnalysisRef.current = analysis
    return analysis
  }, [])

  const getElementSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`
    const tagName = element.tagName.toLowerCase()
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c).join('.')
      return classes ? `${tagName}.${classes}` : tagName
    }
    return tagName
  }

  const applyFormatToElements = useCallback((elements: NodeListOf<Element> | Element[], properties: Record<string, unknown>, recordHistory: boolean = true): ElementChangeRecord[] => {
    const changes: ElementChangeRecord[] = []
    
    elements.forEach(element => {
      const el = element as HTMLElement
      const beforeStyles: Record<string, string> = {}
      const afterStyles: Record<string, string> = {}
      
      if (properties.replace) {
        beforeStyles.textContent = el.textContent || ''
        el.textContent = properties.replace as string
        afterStyles.textContent = el.textContent
      }
      if (properties.alignment) {
        const alignment = properties.alignment as string
        beforeStyles.textAlign = el.style.textAlign
        if (alignment === 'center') el.style.textAlign = 'center'
        else if (alignment === 'left') el.style.textAlign = 'left'
        else if (alignment === 'right') el.style.textAlign = 'right'
        else if (alignment === 'justify') el.style.textAlign = 'justify'
        afterStyles.textAlign = el.style.textAlign
      }
      if (properties.indent) {
        beforeStyles.textIndent = el.style.textIndent
        el.style.textIndent = '2em'
        afterStyles.textIndent = el.style.textIndent
      }
      if (properties.fontFamily) {
        beforeStyles.fontFamily = el.style.fontFamily
        el.style.fontFamily = properties.fontFamily as string
        afterStyles.fontFamily = el.style.fontFamily
      }
      if (properties.fontSize) {
        beforeStyles.fontSize = el.style.fontSize
        el.style.fontSize = `${properties.fontSize}pt`
        afterStyles.fontSize = el.style.fontSize
      }
      if (properties.color) {
        beforeStyles.color = el.style.color
        el.style.color = properties.color as string
        afterStyles.color = el.style.color
      }
      if (properties.bold) {
        beforeStyles.fontWeight = el.style.fontWeight
        el.style.fontWeight = 'bold'
        afterStyles.fontWeight = el.style.fontWeight
      }
      if (properties.italic) {
        beforeStyles.fontStyle = el.style.fontStyle
        el.style.fontStyle = 'italic'
        afterStyles.fontStyle = el.style.fontStyle
      }
      if (properties.underline) {
        beforeStyles.textDecoration = el.style.textDecoration
        el.style.textDecoration = el.style.textDecoration ? `${el.style.textDecoration} underline` : 'underline'
        afterStyles.textDecoration = el.style.textDecoration
      }
      if (properties.lineSpacing) {
        beforeStyles.lineHeight = el.style.lineHeight
        el.style.lineHeight = properties.lineSpacing as string
        afterStyles.lineHeight = el.style.lineHeight
      }
      
      if (recordHistory && Object.keys(beforeStyles).length > 0) {
        changes.push({
          element: el,
          selector: getElementSelector(el),
          beforeStyles,
          afterStyles
        })
      }
    })
    
    return changes
  }, [])

  const rollbackLastOperation = useCallback((): boolean => {
    const history = formatHistoryRef.current
    if (history.length === 0) return false
    
    const lastRecord = history[history.length - 1]
    let restored = 0
    
    lastRecord.changes.forEach(change => {
      const elements = document.querySelectorAll(change.selector)
      elements.forEach(el => {
        const htmlEl = el as HTMLElement
        Object.entries(change.beforeStyles).forEach(([prop, value]) => {
          if (prop === 'textAlign') htmlEl.style.textAlign = value
          else if (prop === 'textIndent') htmlEl.style.textIndent = value
          else if (prop === 'fontFamily') htmlEl.style.fontFamily = value
          else if (prop === 'fontSize') htmlEl.style.fontSize = value
          else if (prop === 'color') htmlEl.style.color = value
          else if (prop === 'fontWeight') htmlEl.style.fontWeight = value
          else if (prop === 'fontStyle') htmlEl.style.fontStyle = value
          else if (prop === 'textDecoration') htmlEl.style.textDecoration = value
          else if (prop === 'lineHeight') htmlEl.style.lineHeight = value
        })
        restored++
      })
    })
    
    redoHistoryRef.current.push(lastRecord)
    formatHistoryRef.current = history.slice(0, -1)
    ContextAnalyzer.markLastTurnAsRolledBack()
    return restored > 0
  }, [])

  const redoLastOperation = useCallback((): boolean => {
    const redoHistory = redoHistoryRef.current
    if (redoHistory.length === 0) return false
    
    const lastRedoRecord = redoHistory[redoHistory.length - 1]
    let restored = 0
    
    lastRedoRecord.changes.forEach(change => {
      const elements = document.querySelectorAll(change.selector)
      elements.forEach(el => {
        const htmlEl = el as HTMLElement
        Object.entries(change.afterStyles).forEach(([prop, value]) => {
          if (prop === 'textAlign') htmlEl.style.textAlign = value
          else if (prop === 'textIndent') htmlEl.style.textIndent = value
          else if (prop === 'fontFamily') htmlEl.style.fontFamily = value
          else if (prop === 'fontSize') htmlEl.style.fontSize = value
          else if (prop === 'color') htmlEl.style.color = value
          else if (prop === 'fontWeight') htmlEl.style.fontWeight = value
          else if (prop === 'fontStyle') htmlEl.style.fontStyle = value
          else if (prop === 'textDecoration') htmlEl.style.textDecoration = value
          else if (prop === 'lineHeight') htmlEl.style.lineHeight = value
        })
        restored++
      })
    })
    
    formatHistoryRef.current.push(lastRedoRecord)
    redoHistoryRef.current = redoHistory.slice(0, -1)
    return restored > 0
  }, [])

  const rollbackAllOperations = useCallback((): number => {
    let count = 0
    const maxIterations = 100
    let iterations = 0
    
    while (formatHistoryRef.current.length > 0 && iterations < maxIterations) {
      if (rollbackLastOperation()) {
        count++
      }
      iterations++
    }
    
    formatHistoryRef.current = []
    ContextAnalyzer.clearHistory()
    return count
  }, [rollbackLastOperation])

  const executeAction = useCallback((action: { type: string; params: Record<string, unknown> }, instruction?: string) => {
    const { type, params } = action
    
    // 检查是否存在编辑器元素
    const getEditor = () => {
      const editor = document.querySelector('[contenteditable="true"]')
      if (!editor) {
        // 显示错误消息
        setMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            content: '❌ 无法执行操作：未找到编辑器元素。请先创建或打开一个文档。',
            timestamp: new Date()
          }
        ])
        return null
      }
      return editor
    }
    
    // 生成内容的函数
    const generateContent = () => {
      // 生成AI项目介绍书的内容
      let content = `# AI项目介绍书\n\n`
      content += `## 1. 项目概述\n\n`
      content += `本项目旨在开发一个基于人工智能技术的智能助手系统，能够帮助用户完成各种文档处理任务。\n\n`
      content += `## 2. 技术架构\n\n`
      content += `项目采用现代前端技术栈，结合AI模型，实现了智能文档分析和处理功能。\n\n`
      content += `## 3. 核心功能\n\n`
      content += `系统具有智能文档分析、自动格式化、内容生成等核心功能。\n\n`
      content += `## 4. 应用场景\n\n`
      content += `本系统适用于各类文档处理场景，包括报告生成、内容创作、格式优化等。\n\n`
      content += `## 5. 未来规划\n\n`
      content += `未来将继续增强AI能力，拓展应用场景，提升用户体验。`
      return content
    }
    
    if (type === 'correction_operation') {
      rollbackLastOperation()
      
      if (params.instructions) {
        const instructions = params.instructions as any[]
        
        const editor = getEditor()
        if (!editor) return
        
        const allChanges: any[] = []
        
        instructions.forEach(instructionItem => {
          const targetType = instructionItem.targetType
          const properties = instructionItem.properties || {}
          const position = instructionItem.position
          const isLast = properties.isLast
          const lastCount = properties.lastCount
          
          let targetElements: Element[] = []
          
          if (targetType === 'heading') {
            targetElements = Array.from(editor.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          } else if (targetType === 'heading1') {
            targetElements = Array.from(editor.querySelectorAll('h1'))
          } else if (targetType === 'heading2') {
            targetElements = Array.from(editor.querySelectorAll('h2'))
          } else if (targetType === 'heading3') {
            targetElements = Array.from(editor.querySelectorAll('h3'))
          } else if (targetType === 'heading4') {
            targetElements = Array.from(editor.querySelectorAll('h4'))
          } else if (targetType === 'heading5') {
            targetElements = Array.from(editor.querySelectorAll('h5'))
          } else if (targetType === 'heading6') {
            targetElements = Array.from(editor.querySelectorAll('h6'))
          } else if (targetType === 'paragraph' || targetType === 'body') {
            targetElements = Array.from(editor.querySelectorAll('p'))
          } else if (targetType === 'image') {
            if (properties.imageAction === 'insert' || instructionItem.action === 'insert') {
              onInsertImage()
              return
            } else {
              targetElements = Array.from(editor.querySelectorAll('img'))
            }
          } else if (targetType === 'table') {
            if (properties.rows || properties.cols || instructionItem.action === 'insert') {
              onInsertTable(properties.rows as number || 3, properties.cols as number || 3)
              return
            } else {
              targetElements = Array.from(editor.querySelectorAll('table'))
            }
          } else if (targetType === 'content') {
            if (properties.continueCount || properties.continueUnit) {
              const count = (properties.continueCount as number) || 1
              const unit = (properties.continueUnit as string) || '段'
              const selection = window.getSelection()
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                const placeholder = document.createElement('span')
                placeholder.className = 'ai-continue-placeholder'
                placeholder.contentEditable = 'false'
                placeholder.textContent = `[AI将在此续写${count}${unit}内容]`
                placeholder.style.cssText = 'background: #e3f2fd; padding: 4px 8px; border-radius: 4px; color: #1976d2; font-style: italic;'
                range.insertNode(placeholder)
              }
              return
            }
          } else if (targetType === 'list') {
            document.execCommand('insertUnorderedList', false)
            return
          } else if (targetType === 'link') {
            const url = prompt('请输入链接地址:', 'https://')
            if (url) {
              document.execCommand('createLink', false, url)
            }
            return
          }
          
          if (typeof position === 'number') {
            targetElements = targetElements.slice(position - 1, position)
          } else if (Array.isArray(position)) {
            const [start, end] = position
            targetElements = targetElements.slice(start - 1, end)
          } else if (isLast) {
            const count = (lastCount as number) || 1
            targetElements = targetElements.slice(-count)
          }
          
          if (targetElements.length > 0) {
            const changes = applyFormatToElements(targetElements, properties, true)
            allChanges.push(...changes)
          }
        })
        
        if (allChanges.length > 0 && instruction) {
          const historyRecord = {
            id: `history-${Date.now()}`,
            timestamp: new Date(),
            instruction,
            changes: allChanges
          }
          formatHistoryRef.current.push(historyRecord)
        }
      }
      return
    }
    
    if (type === 'rollback_and_redo_operation') {
      if (params.rollbackScope === 'full') {
        rollbackAllOperations()
      } else {
        rollbackLastOperation()
      }
      
      if (params.instructions) {
        const instructions = params.instructions as any[]
        
        const editor = getEditor()
        if (!editor) return
        
        const allChanges: any[] = []
        
        instructions.forEach(instructionItem => {
          const targetType = instructionItem.targetType
          const properties = instructionItem.properties || {}
          const position = instructionItem.position
          const isLast = properties.isLast
          const lastCount = properties.lastCount as number | undefined
          
          let targetElements: Element[] = []
          
          if (targetType === 'heading') {
            targetElements = Array.from(editor.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          } else if (targetType === 'heading1') {
            targetElements = Array.from(editor.querySelectorAll('h1'))
          } else if (targetType === 'heading2') {
            targetElements = Array.from(editor.querySelectorAll('h2'))
          } else if (targetType === 'heading3') {
            targetElements = Array.from(editor.querySelectorAll('h3'))
          } else if (targetType === 'heading4') {
            targetElements = Array.from(editor.querySelectorAll('h4'))
          } else if (targetType === 'heading5') {
            targetElements = Array.from(editor.querySelectorAll('h5'))
          } else if (targetType === 'heading6') {
            targetElements = Array.from(editor.querySelectorAll('h6'))
          } else if (targetType === 'paragraph' || targetType === 'body') {
            targetElements = Array.from(editor.querySelectorAll('p'))
          } else if (targetType === 'image') {
            targetElements = Array.from(editor.querySelectorAll('img'))
          } else if (targetType === 'table') {
            targetElements = Array.from(editor.querySelectorAll('table'))
          }
          
          if (isLast && targetElements.length > 0) {
            const count = lastCount || 1
            targetElements = targetElements.slice(-count)
          } else if (typeof position === 'number') {
            targetElements = targetElements.slice(position - 1, position)
          } else if (position && Array.isArray(position)) {
            const [start, end] = position
            targetElements = targetElements.slice(start - 1, end)
          }
          
          if (targetElements.length > 0) {
            const changes = applyFormatToElements(targetElements, properties, true)
            allChanges.push(...changes)
          }
        })
        
        if (allChanges.length > 0 && instruction) {
          const historyRecord = {
            id: `history-${Date.now()}`,
            timestamp: new Date(),
            instruction,
            changes: allChanges
          }
          formatHistoryRef.current.push(historyRecord)
        }
      }
      return
    }
    
    if (type === 'batch_operation' && params.instructions) {
      const instructions = params.instructions as any[]
      
      const editor = getEditor()
      if (!editor) return
      
      const allChanges: ElementChangeRecord[] = []
      
      // 检查是否是生成内容的请求
    const isGenerateRequest = instruction && (instruction.includes('写') || instruction.includes('生成') || instruction.includes('创作') || instruction.includes('创建'))
    
    if (isGenerateRequest) {
      // 获取编辑器元素
      const editor = getEditor()
      if (!editor) return
      
      // 生成内容
      const generatedContent = generateContent()
      // 清空编辑器并插入生成的内容
      editor.innerHTML = generatedContent
      // 显示成功消息
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-success`,
          role: 'assistant',
          content: '✅ 已成功生成项目书内容',
          timestamp: new Date()
        }
      ])
      return
    }
      
      instructions.forEach(instructionItem => {
        const targetType = instructionItem.targetType
        const properties = instructionItem.properties || {}
        const position = instructionItem.position
        const isLast = properties.isLast
        const lastCount = properties.lastCount as number | undefined
        
        let targetElements: Element[] = []
        
        if (targetType === 'heading') {
          targetElements = Array.from(editor.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        } else if (targetType === 'heading1') {
          targetElements = Array.from(editor.querySelectorAll('h1'))
        } else if (targetType === 'heading2') {
          targetElements = Array.from(editor.querySelectorAll('h2'))
        } else if (targetType === 'heading3') {
          targetElements = Array.from(editor.querySelectorAll('h3'))
        } else if (targetType === 'heading4') {
          targetElements = Array.from(editor.querySelectorAll('h4'))
        } else if (targetType === 'heading5') {
          targetElements = Array.from(editor.querySelectorAll('h5'))
        } else if (targetType === 'heading6') {
          targetElements = Array.from(editor.querySelectorAll('h6'))
        } else if (targetType === 'paragraph' || targetType === 'body') {
          targetElements = Array.from(editor.querySelectorAll('p'))
        } else if (targetType === 'image') {
          targetElements = Array.from(editor.querySelectorAll('img'))
        } else if (targetType === 'table') {
          targetElements = Array.from(editor.querySelectorAll('table'))
        }
        
        if (isLast && targetElements.length > 0) {
          const count = lastCount || 1
          targetElements = targetElements.slice(-count)
        } else if (typeof position === 'number') {
          targetElements = targetElements.slice(position - 1, position)
        } else if (position && Array.isArray(position)) {
          const [start, end] = position
          targetElements = targetElements.slice(start - 1, end)
        }
        
        if (targetType === 'image' && (properties.imageAction === 'insert' || instructionItem.action === 'insert')) {
          onInsertImage()
        } else if (targetType === 'table' && (properties.rows || properties.cols || instructionItem.action === 'insert')) {
          onInsertTable(properties.rows as number || 3, properties.cols as number || 3)
        } else if (targetType === 'content' && (properties.continueCount || properties.continueUnit)) {
          const count = (properties.continueCount as number) || 1
          const unit = (properties.continueUnit as string) || '段'
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const placeholder = document.createElement('span')
            placeholder.className = 'ai-continue-placeholder'
            placeholder.contentEditable = 'false'
            placeholder.textContent = `[AI将在此续写${count}${unit}内容]`
            placeholder.style.cssText = 'background: #e3f2fd; padding: 4px 8px; border-radius: 4px; color: #1976d2; font-style: italic;'
            range.insertNode(placeholder)
          }
        } else if (targetType === 'list') {
          document.execCommand('insertUnorderedList', false)
        } else if (targetType === 'link') {
          const url = prompt('请输入链接地址:', 'https://')
          if (url) {
            document.execCommand('createLink', false, url)
          }
        } else if (targetElements.length > 0) {
          const changes = applyFormatToElements(targetElements, properties, true)
          allChanges.push(...changes)
        } else {
          if (properties.fontFamily) {
            onFormatAction('fontFamily', properties.fontFamily)
          }
          if (properties.fontSize) {
            onFormatAction('fontSize', properties.fontSize)
          }
          if (properties.color) {
            onFormatAction('textColor', properties.color)
          }
          if (properties.bold) {
            onFormatAction('bold')
          }
          if (properties.italic) {
            onFormatAction('italic')
          }
          if (properties.underline) {
            onFormatAction('underline')
          }
          if (properties.strikethrough) {
            onFormatAction('strikethrough')
          }
          if (properties.subscript) {
            onFormatAction('subscript')
          }
          if (properties.superscript) {
            onFormatAction('superscript')
          }
          if (properties.alignment) {
            const alignment = properties.alignment as string
            if (alignment === 'center') onFormatAction('alignCenter')
            else if (alignment === 'left') onFormatAction('alignLeft')
            else if (alignment === 'right') onFormatAction('alignRight')
            else if (alignment === 'justify') onFormatAction('alignJustify')
          }
          if (properties.lineSpacing) {
            onFormatAction('lineSpacing', properties.lineSpacing)
          }
          if (properties.indent) {
            onFormatAction('indent')
          }
        }
      })
      
      if (allChanges.length > 0 && instruction) {
        const historyRecord = {
          id: `history-${Date.now()}`,
          timestamp: new Date(),
          instruction,
          changes: allChanges
        }
        formatHistoryRef.current.push(historyRecord)
        
        const instructions = (params.instructions as any[]) || []
        ContextAnalyzer.addToHistory({
          id: historyRecord.id,
          timestamp: historyRecord.timestamp,
          userInput: instruction,
          parsedInstructions: instructions.map(inst => ({
            targetType: inst.targetType,
            properties: inst.properties || {},
            originalText: inst.originalText || ''
          })),
          executed: true
        })
      }
      
      lastExecutedActionRef.current = action
    } else if (type === 'format_fontSize' && params.size) {
      onFormatAction('fontSize', params.size)
    } else if (type === 'format_fontFamily' && params.font) {
      onFormatAction('fontFamily', params.font)
    } else if (type === 'format_color' && params.color) {
      onFormatAction('textColor', params.color)
    } else if (type === 'format_alignment' && params.alignment) {
      if (params.alignment === 'center') onFormatAction('alignCenter')
      else if (params.alignment === 'left') onFormatAction('alignLeft')
      else if (params.alignment === 'right') onFormatAction('alignRight')
      else if (params.alignment === 'justify') onFormatAction('alignJustify')
    } else if (type === 'format_bold') {
      onFormatAction('bold')
    } else if (type === 'format_italic') {
      onFormatAction('italic')
    } else if (type === 'format_underline') {
      onFormatAction('underline')
    } else if (type === 'format_strikethrough') {
      onFormatAction('strikethrough')
    } else if (type === 'format_subscript') {
      onFormatAction('subscript')
    } else if (type === 'format_superscript') {
      onFormatAction('superscript')
    } else if (type === 'format_lineSpacing' && params.spacing) {
      onFormatAction('lineSpacing', params.spacing)
    } else if (type === 'format_indent') {
      onFormatAction('indent')
    } else if (type === 'insert_table') {
      onInsertTable(params.rows as number || 3, params.cols as number || 3)
    } else if (type === 'insert_image') {
      onInsertImage()
    } else if (type === 'format_document') {
      onAutoFormat()
    } else if (type === 'page_setup') {
      onOpenPageSetup()
    } else if (type === 'print_preview') {
      onOpenPrintPreview()
    } else if (type === 'apply_template' && params.profile) {
      onApplyProfile(params.profile as string)
    }
  }, [onFormatAction, onInsertTable, onInsertImage, onOpenPageSetup, onOpenPrintPreview, onAutoFormat, onApplyProfile, setMessages])

  const handleSend = useCallback(() => {
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setIsTyping(true)
    setShowThinkingProcess(true)

    // 使用intelligentEngine生成思考过程
    const aiResponse = intelligentEngine.think(currentInput)
    
    // 转换思考过程为AIThinkingProcess组件需要的格式
    const newThinkingProcess = aiResponse.thinking?.map((step) => ({
      step: {
        'analyze': '理解用户需求',
        'reason': '确定用户意图',
        'plan': '制定执行计划',
        'execute': '执行操作',
        'reflect': '确认结果'
      }[step.type] || step.type,
      description: step.description,
      result: step.result,
      duration: 1000 // 每个步骤显示1秒
    }))
    
    // 更新思考过程状态
    setThinkingProcess(newThinkingProcess || [])

    // 延迟显示思考过程，然后处理实际逻辑
    setTimeout(() => {
      const analysis = analyzeDocument(_documentContent)
      const contextResult = ContextAnalyzer.analyze(currentInput)
      const parsedInstruction = ComplexInstructionParser.parse(currentInput)
      
      let content = ''
      let action: { type: string; params: Record<string, unknown> } | undefined
      let suggestions = ['继续操作', '查看帮助', '格式化文档']
      
      content = `🧠 上下文分析结果：\n`
      content += `• 意图类型: ${getIntentLabel(contextResult.intent)}\n`
      content += `• 置信度: ${(contextResult.confidence * 100).toFixed(0)}%\n`
      content += `• 分析推理: ${contextResult.reasoning}\n\n`
      
      switch (contextResult.intent) {
        case 'rollback_only':
          if (contextResult.rollbackScope === 'full') {
            const count = rollbackAllOperations()
            content += `✅ 已撤销所有操作（共 ${count} 项）\n`
          } else {
            const success = rollbackLastOperation()
            content += success ? `✅ 已撤销上一次操作\n` : `⚠️ 没有可撤销的操作\n`
          }
          suggestions = ['继续操作', '重新格式化', '查看帮助']
          break
          
        case 'redo':
          const redoSuccess = redoLastOperation()
          content += redoSuccess ? `✅ 已恢复上一次撤销的操作\n` : `⚠️ 没有可恢复的操作\n`
          suggestions = ['继续操作', '撤销', '查看帮助']
          break
          
        case 'rollback_and_redo':
          content += `🔄 检测到撤销并重新执行意图，准备执行以下操作：\n\n`
          content += `1. 撤销${contextResult.rollbackScope === 'full' ? '所有' : '上次'}操作\n`
          content += `2. 执行新指令：${currentInput}\n\n`
          content += `点击下方"确认执行"按钮开始执行。`
          
          action = {
            type: 'rollback_and_redo_operation',
            params: {
              instructions: parsedInstruction.instructions,
              documentAnalysis: analysis,
              rollbackScope: contextResult.rollbackScope,
              originalInstruction: currentInput
            }
          }
          suggestions = ['确认执行', '取消', '查看帮助']
          break
          
        case 'correction':
          content += `🔄 检测到修正意图，准备执行以下操作：\n\n`
          content += `1. 撤销上次操作\n`
          content += `2. 执行新指令：${currentInput}\n\n`
          content += `点击下方"确认执行"按钮开始执行。`
          
          action = {
            type: 'correction_operation',
            params: {
              instructions: parsedInstruction.instructions,
              documentAnalysis: analysis,
              originalInstruction: currentInput
            }
          }
          suggestions = ['确认执行', '取消', '查看帮助']
          break
          
        case 'new_instruction':
          const newExecutor = createInstructionExecutor(_documentContent)
          const newResult = newExecutor.executeComplexInstruction(currentInput)
          
          content += `📋 检测到新指令，准备执行：\n\n`
          content += `• 标题数量: ${analysis.statistics.headings}\n`
          content += `• 段落数量: ${analysis.statistics.paragraphs}\n`
          content += `• 图片数量: ${analysis.statistics.images}\n`
          content += `• 表格数量: ${analysis.statistics.tables}\n\n`
          content += `根据您的指令，准备执行以下操作：\n\n`
          content += newResult.results.map(r => `• ${r.message}`).join('\n')
          content += `\n\n点击下方"执行操作"按钮开始执行。`
          
          action = {
            type: 'batch_operation',
            params: {
              instructions: parsedInstruction.instructions,
              documentAnalysis: analysis
            }
          }
          suggestions = ['确认执行', '查看帮助', '格式化文档']
          break
          
        case 'clarification':
          content += `❓ 您的意图不够明确，请澄清：\n\n`
          content += `• 如果要撤销操作，请说"撤销"或"撤回"\n`
          content += `• 如果要修改格式，请明确指定目标和属性\n`
          content += `• 例如："把标题居中"或"正文首行缩进"`
          suggestions = ['撤销上次', '继续操作', '查看帮助']
          break
          
        default:
          const defaultExecutor = createInstructionExecutor(_documentContent)
          const defaultResult = defaultExecutor.executeComplexInstruction(currentInput)
          
          content += `📋 准备执行操作：\n\n`
          content += defaultResult.results.map(r => `• ${r.message}`).join('\n')
          
          action = {
            type: 'batch_operation',
            params: {
              instructions: parsedInstruction.instructions,
              documentAnalysis: analysis
            }
          }
      }
      
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-response`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        suggestions,
        action,
        documentAnalysis: analysis,
        originalInstruction: currentInput
      }
      
      setMessages(prev => [...prev, assistantMessage])
      setIsTyping(false)
      setShowThinkingProcess(false)
    }, (newThinkingProcess || []).reduce((total, step) => total + (step.duration || 1000), 0) + 300)
  }, [input, executeAction, analyzeDocument, _documentContent, rollbackLastOperation, rollbackAllOperations])

  const getIntentLabel = (intent: ContextResult['intent']): string => {
    const labels: Record<string, string> = {
      'rollback_only': '仅撤销',
      'rollback_and_redo': '撤销后重新执行',
      'correction': '修正操作',
      'new_instruction': '新指令',
      'clarification': '需要澄清',
      'continue': '继续操作',
      'redo': '恢复操作'
    }
    return labels[intent] || intent
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  const handleActionClick = (message: ChatMessage) => {
    if (message.action) {
      executeAction(message.action, message.originalInstruction)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-[300] flex flex-col border-l border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-white">智能助手</h3>
              <p className="text-xs text-blue-100">随时为您服务</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-md'
                    : 'bg-white shadow-sm border border-gray-100 rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="block w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                      >
                        💡 {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                
                {message.action && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleActionClick(message)}
                      className="w-full text-center text-sm px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      执行操作
                    </button>
                  </div>
                )}

                {message.documentAnalysis && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <div className="font-medium mb-1">文档统计:</div>
                    <div>标题: {message.documentAnalysis.statistics.headings} | 段落: {message.documentAnalysis.statistics.paragraphs}</div>
                    <div>图片: {message.documentAnalysis.statistics.images} | 表格: {message.documentAnalysis.statistics.tables}</div>
                    <div>问题: {message.documentAnalysis.statistics.issues}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入指令或问题..."
              className="flex-1 h-10 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['你会什么', '字号14', '插入表格', '格式化文档', '分析文档'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleSuggestionClick(cmd)}
                className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AIThinkingProcess
        isVisible={showThinkingProcess}
        process={thinkingProcess}
        onComplete={() => setShowThinkingProcess(false)}
      />
    </>
  )
}

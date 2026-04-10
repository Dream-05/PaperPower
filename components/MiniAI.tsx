import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { auditLogger } from '@/utils/compliance'
import { useAppStore } from '@/store/appStore'
import { useLanguageStore } from '@/store/languageStore'
import { t } from '@/i18n'
import { modelService } from '@/utils/localAI/ModelService'
import { DocumentMarker, InstructionParser, InstructionExecutor, ParsedInstruction, MarkedElement } from '@/utils/documentMarker'
import { ContentGenerator } from '@/utils/contentGenerator'
import { dialogueEngine, type ProcessedResponse } from '@/utils/intelligentDialogue'
import { renderMarkdown } from '@/utils/sanitize'

import ApiKeyManager from './ApiKeyManager'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  intent?: {
    intent: string
    parameters: Record<string, unknown>
    emotion: string
    urgency: string
  }
  commands?: Array<{
    id: string
    text: string
    executed: boolean
    action?: string
    targetType?: string
    targetIds?: string[]
  }>
  executionPlan?: {
    instructions: ParsedInstruction[]
    summary: string
  }
  documentElements?: MarkedElement[]
  thinking?: Array<{ type: string; description: string; result: string }>
  showThinking?: boolean
  source?: string
  metadata?: {
    intent: string
    confidence: number
    personality?: string
    actionType?: string
  }
}

type AIMood = 'idle' | 'thinking' | 'happy' | 'working' | 'error'
type FaceExpression = 'neutral' | 'happy' | 'disappointed' | 'surprised'

interface ExpressionValues {
  mouthCurve: number
  eyeScale: number
  browOffset: number
}

const EXPRESSION_CONFIG: Record<FaceExpression, ExpressionValues> = {
  neutral: { mouthCurve: 0.05, eyeScale: 1, browOffset: 0 },
  happy: { mouthCurve: 0.2, eyeScale: 1, browOffset: -0.3 },
  disappointed: { mouthCurve: -0.12, eyeScale: 0.85, browOffset: 0.3 },
  surprised: { mouthCurve: 0.12, eyeScale: 1.15, browOffset: 0 }
}

type ModelType = 'local' | 'openai' | 'anthropic' | 'custom'

export default function MiniAI() {
  const [localIsOpen, setLocalIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [mood, setMood] = useState<AIMood>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [dragDistance, setDragDistance] = useState(0)
  const [showHands, setShowHands] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [targetExpression, setTargetExpression] = useState<FaceExpression>('neutral')
  const [currentValues, setCurrentValues] = useState<ExpressionValues>(EXPRESSION_CONFIG.neutral)
  const [selectedModel, setSelectedModel] = useState<ModelType>('local')
  const [selectedModelId, setSelectedModelId] = useState<string>('local-transformer')
  const [selectedCustomProvider, setSelectedCustomProvider] = useState<string>('')
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [showApiKeyManager, setShowApiKeyManager] = useState(false)
  const [customProviders, setCustomProviders] = useState<{id: string; name: string}[]>([])
  const [providersUpdate, setProvidersUpdate] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { setLoading, aiPanel, closeAIPanel } = useAppStore()
  const { language } = useLanguageStore()
  const navigate = useNavigate()

  const isOpen = aiPanel.isOpen || localIsOpen

  useEffect(() => {
    const providers = modelService.getProviders().filter(p => p.type === 'custom')
    setCustomProviders(providers.map(p => ({ id: p.id, name: p.name })))
  }, [showModelSelector, providersUpdate])

  const handleOpenApiManager = () => {
    setShowApiKeyManager(true)
  }

  const handleApiManagerClose = () => {
    setShowApiKeyManager(false)
    setProvidersUpdate(prev => prev + 1)
  }

  const setIsOpen = useCallback((value: boolean) => {
    setLocalIsOpen(value)
    if (!value) {
      closeAIPanel()
    }
  }, [closeAIPanel])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleGlobalMouseMove)
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove)
  }, [])

  useEffect(() => {
    if (isHovering || mood === 'happy') {
      setTargetExpression('happy')
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
    } else if (mood === 'thinking') {
      setTargetExpression('surprised')
    } else {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      hoverTimeoutRef.current = setTimeout(() => {
        setTargetExpression('disappointed')
        setTimeout(() => {
          setTargetExpression('neutral')
        }, 1200)
      }, 150)
    }
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [isHovering, mood])

  useEffect(() => {
    const target = EXPRESSION_CONFIG[targetExpression]
    const animate = () => {
      setCurrentValues(prev => {
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t
        const speed = 0.08
        return {
          mouthCurve: lerp(prev.mouthCurve, target.mouthCurve, speed),
          eyeScale: lerp(prev.eyeScale, target.eyeScale, speed),
          browOffset: lerp(prev.browOffset, target.browOffset, speed)
        }
      })
      animationRef.current = requestAnimationFrame(animate)
    }
    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [targetExpression])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    dragRef.current = {
      startX,
      startY,
      startPosX: position.x,
      startPosY: position.y
    }
    setIsMouseDown(true)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current || !isMouseDown) return

    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    setDragDistance(Math.min(distance / 200, 1))

    if (distance > 5) {
      setIsDragging(true)
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.startPosX - deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startPosY - deltaY))
      })
    }
  }, [isMouseDown])

  const handleMouseUp = useCallback(() => {
    const distance = dragDistance * 200

    if (distance < 5 && !isDragging) {
      setIsOpen(true)
    }

    setIsDragging(false)
    setShowHands(false)
    setDragDistance(0)
    setIsMouseDown(false)
    dragRef.current = null
  }, [dragDistance, isDragging])

  useEffect(() => {
    if (isMouseDown) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isMouseDown, handleMouseMove, handleMouseUp])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) return
    if (isProcessing) return

    setIsProcessing(true)

    const input = inputValue.trim()

    if (input.length > 1000) {
      const errorMessage = '输入内容过长，请精简后重试。'
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, assistantMessage])
      setInputValue('')
      setMood('error')
      setTimeout(() => setMood('idle'), 2000)
      return
    }

    let activeEditor: HTMLElement | null = null
    try {
      activeEditor = document.querySelector('[contenteditable="true"]') as HTMLElement
    } catch (error) {
      console.error('获取编辑器失败:', error)
    }

    let documentElements: MarkedElement[] = []
    let executionPlan = InstructionParser.parseInstruction('')
    let detectedCommands: Array<{
      id: string
      text: string
      executed: boolean
      action?: string
      targetType?: string
      targetIds?: string[]
    }> = []

    if (activeEditor) {
      try {
        documentElements = DocumentMarker.markDocument(activeEditor)
        const sessionId = `session_${Date.now()}`
        executionPlan = InstructionParser.parseInstruction(input, sessionId)

        if (executionPlan.instructions.length > 0) {
          executionPlan.instructions.forEach(inst => {
            detectedCommands.push({
              id: inst.id,
              text: inst.description,
              executed: false,
              action: inst.action,
              targetType: inst.targetType,
              targetIds: inst.targetIds
            })
          })
        }
      } catch (error) {
        console.error('处理文档元素失败:', error)
      }
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
      commands: detectedCommands.length > 0 ? detectedCommands : undefined,
      executionPlan: executionPlan.requiresConfirmation ? {
        instructions: executionPlan.instructions,
        summary: executionPlan.summary
      } : undefined,
      documentElements: documentElements.length > 0 ? documentElements : undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setMood('thinking')
    setLoading(true)

    try {
      let processedResult: ProcessedResponse
      let shouldNavigate = false
      let navigateTo = ''

      if (activeEditor && executionPlan.requiresConfirmation && executionPlan.instructions.length > 0) {
        const elementStats = {
          titles: documentElements.filter(e => e.type === 'title').length,
          heading1s: documentElements.filter(e => e.type === 'heading1').length,
          heading2s: documentElements.filter(e => e.type === 'heading2').length,
          heading3s: documentElements.filter(e => e.type === 'heading3').length,
          paragraphs: documentElements.filter(e => e.type === 'paragraph').length,
          lists: documentElements.filter(e => e.type === 'list').length,
          tables: documentElements.filter(e => e.type === 'table').length,
          images: documentElements.filter(e => e.type === 'image').length,
        }

        let statsText = `我已经分析了您的文档结构，\n\n`
        statsText += `📋 文档结构：\n`
        if (elementStats.titles > 0) statsText += `📌 一级标题：${elementStats.titles} 个\n`
        if (elementStats.heading1s > 0) statsText += `📌 标题(H1)：${elementStats.heading1s} 个\n`
        if (elementStats.heading2s > 0) statsText += `📌 副标题(H2)：${elementStats.heading2s} 个\n`
        if (elementStats.heading3s > 0) statsText += `📌 小标题(H3)：${elementStats.heading3s} 个\n`
        if (elementStats.paragraphs > 0) statsText += `📌 正文段落：${elementStats.paragraphs} 个\n`
        if (elementStats.lists > 0) statsText += `📌 列表：${elementStats.lists} 个\n`
        if (elementStats.tables > 0) statsText += `📌 表格：${elementStats.tables} 个\n`
        if (elementStats.images > 0) statsText += `📌 图片：${elementStats.images} 个\n`

        statsText += `\n📝 执行计划：\n${executionPlan.summary}\n\n`
        statsText += `请点击"执行"按钮确认执行，或"执行全部并总结"一次性执行所有操作`

        processedResult = {
          content: statsText,
          confidence: 0.95,
          source: 'rule'
        }
      } else {
        processedResult = await dialogueEngine.process(input, {
          language: language === 'en' ? 'en' : 'zh',
          useHistory: true
        })

        shouldNavigate = !!processedResult.shouldNavigate
        navigateTo = processedResult.navigateTo || ''
      }

      let aiContent = processedResult.content

      // Only apply intent-based navigation rules if dialogueEngine hasn't already set navigation
      if (!processedResult?.shouldNavigate && !processedResult?.navigateTo) {
        const inputLower = input.toLowerCase()

        const intentNavRules = [
          { pattern: /(ppt|演示|幻灯片)/i, nav: (s: string) => `/ppt?topic=${encodeURIComponent(s)}` },
          { pattern: /打开.*(word|文档)/i, nav: (_: string) => '/word' },
          { pattern: /(excel|表格|数据)/i, nav: (s: string) => `/excel?data=${encodeURIComponent(s)}` },
          { pattern: /(图片|image|融合|fusion)/i, nav: (s: string) => `/image-fusion?query=${encodeURIComponent(s)}` },
          { pattern: /(?:帮我|请|可以|能否|能不能|想要|需要|协助|麻烦).*(?:写|生成|创建|起草|撰写|编[写作]|做|制作|完成|准备|处理|整理|构建|制定|设计).*(?:一个|一份|一篇)?(?:的?)?(文档|报告|论文|方案|计划|总结|策划书|项目书|规划)/i, nav: (s: string) => `/word?content=${encodeURIComponent(s)}` },
          { pattern: /(?:写|生成|创建|起草|撰写|做|制作|完成|构建|制定).*(?:一个|一份|一篇)?(?:的?)?(文档|报告|论文|方案|计划|总结|策划书|项目书|规划)/i, nav: (s: string) => `/word?content=${encodeURIComponent(s)}` },
        ]

        for (const rule of intentNavRules) {
          if (rule.pattern.test(inputLower)) {
            shouldNavigate = true
            navigateTo = rule.nav(input)
            break
          }
        }
      }

      if (!aiContent) {
        aiContent = t('ai.noResponse', language)
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: aiContent,
        timestamp: Date.now(),
        source: processedResult?.source || 'model',
        metadata: {
          intent: dialogueEngine.detectIntent(input),
          confidence: processedResult?.confidence || 0.5,
          personality: (processedResult?.metadata as any)?.personality,
          actionType: (processedResult?.metadata as any)?.actionType
        }
      }

      setMessages(prev => [...prev, assistantMessage])
      setMood('happy')
      setLoading(false)

      if (shouldNavigate && navigateTo) {
        try {
          setTimeout(() => {
            navigate(navigateTo)
            setIsOpen(false)
          }, 500)
        } catch (navError) {
          console.error('导航失败:', navError)
        }
      }

      const auditLog = auditLogger.createAuditLog(
        { input: input, intent: dialogueEngine.detectIntent(input) },
        [],
        { response: aiContent, source: processedResult?.source }
      )
      console.log('Audit Log:', auditLog)
    } catch (error) {
      console.error('处理消息失败:', error)
      const errorMessage = error instanceof Error ? error.message : t('ai.unknownError', language)
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: `${t('ai.errorProcessingRequest', language)}: ${errorMessage}`,
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])
      setMood('error')
      setLoading(false)
      setIsProcessing(false)
    }

    setTimeout(() => setMood('idle'), 2000)
  }, [inputValue, setLoading, selectedModel, selectedModelId, selectedCustomProvider, language, navigate, isProcessing])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleUndoCommand = useCallback((messageId: string, commandId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.commands) {
        return {
          ...msg,
          commands: msg.commands.map(cmd =>
            cmd.id === commandId ? { ...cmd, executed: false } : cmd
          )
        }
      }
      return msg
    }))

    document.execCommand('undo')

    setMood('happy')
    setTimeout(() => setMood('idle'), 1000)
  }, [])

  const handleExecuteCommand = useCallback(async (messageId: string, commandId: string) => {
    const message = messages.find(m => m.id === messageId)
    const command = message?.commands?.find(c => c.id === commandId)

    if (!command || !command.action) return

    if (['generateDocument', 'generateContent', 'insertIntoWord', 'enrichImage'].includes(command.action)) {
      await handleContentGeneration(command as {
        id: string
        text: string
        action: string
        targetType?: string
        targetIds?: string[]
      })
      return
    }

    if (!command.targetIds) return

    const activeEditor = document.querySelector('[contenteditable="true"]') as HTMLElement
    if (!activeEditor) return

    DocumentMarker.markDocument(activeEditor)

    const instruction: ParsedInstruction = {
      id: command.id,
      action: command.action,
      targetType: command.targetType as ParsedInstruction['targetType'],
      targetIds: command.targetIds,
      description: command.text,
      executed: false
    }

    const result = InstructionExecutor.execute(instruction)

    if (result.success) {
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId && msg.commands) {
          return {
            ...msg,
            commands: msg.commands.map(cmd =>
              cmd.id === commandId ? { ...cmd, executed: true } : cmd
            )
          }
        }
        return msg
      }))

      setMood('happy')
      setTimeout(() => setMood('idle'), 1000)
    }
  }, [messages])

  const handleContentGeneration = useCallback(async (command: {
    id: string
    text: string
    action: string
    targetType?: string
    targetIds?: string[]
  }) => {
    setMood('thinking')

    try {
      let generatedContent = ''

      if (command.action === 'generateDocument' || command.action === 'generateContent') {
        const topic = command.text.replace(/^(请帮写|请帮生成|写一个|生成一个)/, '').replace(/(文档|项目书|策划书|报告|内容)$/, '').trim()
        const docType = command.text.includes('项目书') ? 'project' :
                       command.text.includes('报告') ? 'report' :
                       command.text.includes('策划书') ? 'plan' : 'document'

        const contentResult = await ContentGenerator.generateDocument(topic, docType)

        if (contentResult) {
          generatedContent = contentResult.sections.map((s: { content: string }) => s.content).join('\n\n')
        }
      }

      const activeEditor = document.querySelector('[contenteditable="true"]') as HTMLElement
      if (activeEditor && generatedContent) {
        DocumentMarker.markDocument(activeEditor)
        const elements = DocumentMarker.getMarkedElements()

        if (elements.length > 0 && command.targetIds && command.targetIds.length > 0) {
          const targetEl = elements.find((el: MarkedElement) => command.targetIds!.includes(el.id))
          if (targetEl?.element) {
            targetEl.element.innerHTML = generatedContent
          }
        } else {
          activeEditor.innerHTML += `<p>${generatedContent}</p>`
        }
      }

      setMessages(prev => prev.map(msg => {
        if (msg.id === undefined && msg.commands) {
          return {
            ...msg,
            commands: msg.commands.map(cmd =>
              cmd.id === command.id ? { ...cmd, executed: true, result: generatedContent } : cmd
            )
          }
        }
        return msg
      }))

      setMood('happy')
      setTimeout(() => setMood('idle'), 1000)
    } catch (error) {
      console.error('内容生成失败:', error)
      setMood('error')
      setTimeout(() => setMood('idle'), 2000)
    }
  }, [language])

  const handleExecuteAllCommands = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (!message?.commands) return

    for (const cmd of message.commands) {
      if (!cmd.executed) {
        await handleExecuteCommand(message.id, cmd.id)
      }
    }

    setMood('happy')
    setTimeout(() => setMood('idle'), 1000)
  }, [messages, handleExecuteCommand])

  const getMoodAnimation = (): string => {
    switch (mood) {
      case 'thinking': return 'animate-pulse'
      case 'happy': return 'animate-bounce'
      case 'working': return 'animate-ping'
      default: return ''
    }
  }

  const AIIcon = ({ size = 28 }: { size?: number }) => {
    const eyeSize = size * 0.32
    const eyeY = size * 0.32
    const mouthY = size * 0.72
    const leftEyeX = size * 0.22
    const rightEyeX = size * 0.78

    const getEyeOffset = () => {
      if (!containerRef.current) return { x: 0, y: 0 }
      const rect = containerRef.current.getBoundingClientRect()
      const iconCenterX = rect.left + rect.width / 2
      const iconCenterY = rect.top + rect.height / 2

      const dx = mousePosition.x - iconCenterX
      const dy = mousePosition.y - iconCenterY
      const distance = Math.sqrt(dx * dx + dy * dy)

      const maxOffset = eyeSize * 0.2
      const normalizedDistance = Math.min(distance / 80, 1)

      const offsetX = (dx / (distance || 1)) * maxOffset * normalizedDistance
      const offsetY = (dy / (distance || 1)) * maxOffset * normalizedDistance

      return { x: offsetX, y: offsetY }
    }

    const eyeOffset = getEyeOffset()
    const { mouthCurve, eyeScale, browOffset } = currentValues

    const getMouthPath = () => {
      if (isDragging) {
        return `M ${size * 0.28} ${mouthY} L ${size * 0.72} ${mouthY}`
      }
      const curve = mouthCurve * size
      if (mouthCurve >= 0) {
        return `M ${size * 0.25} ${mouthY} Q ${size * 0.5} ${mouthY + curve} ${size * 0.75} ${mouthY}`
      } else {
        return `M ${size * 0.25} ${mouthY} Q ${size * 0.5} ${mouthY + curve} ${size * 0.75} ${mouthY}`
      }
    }

    const browY = eyeY - eyeSize * (0.5 + browOffset * 0.3)

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#glow)">
          <circle cx={leftEyeX} cy={eyeY} r={eyeSize * 0.65 * eyeScale} fill="white" />
          <circle cx={rightEyeX} cy={eyeY} r={eyeSize * 0.65 * eyeScale} fill="white" />

          <circle cx={leftEyeX + eyeOffset.x} cy={eyeY + eyeOffset.y} r={eyeSize * 0.38 * eyeScale} fill="#1a1a2e" />
          <circle cx={rightEyeX + eyeOffset.x} cy={eyeY + eyeOffset.y} r={eyeSize * 0.38 * eyeScale} fill="#1a1a2e" />

          <circle cx={leftEyeX + eyeOffset.x - eyeSize * 0.1} cy={eyeY + eyeOffset.y - eyeSize * 0.15} r={eyeSize * 0.15} fill="white" opacity={0.9} />
          <circle cx={rightEyeX + eyeOffset.x - eyeSize * 0.1} cy={eyeY + eyeOffset.y - eyeSize * 0.15} r={eyeSize * 0.15} fill="white" opacity={0.9} />
        </g>

        <path d={getMouthPath()} stroke="white" strokeWidth={size * 0.09} fill="none" strokeLinecap="round" />

        {mouthCurve > 0.08 && (
          <circle cx={size * 0.5} cy={mouthY + size * 0.08} r={size * 0.025} fill="white" opacity={0.5} className="animate-pulse" />
        )}

        <path d={`M ${leftEyeX - eyeSize * 0.4} ${browY} Q ${leftEyeX} ${browY - eyeSize * 0.25} ${leftEyeX + eyeSize * 0.4} ${browY}`} stroke="white" strokeWidth={size * 0.025} fill="none" strokeLinecap="round" opacity={0.35} />
        <path d={`M ${rightEyeX - eyeSize * 0.4} ${browY} Q ${rightEyeX} ${browY - eyeSize * 0.25} ${rightEyeX + eyeSize * 0.4} ${browY}`} stroke="white" strokeWidth={size * 0.025} fill="none" strokeLinecap="round" opacity={0.35} />
      </svg>
    )
  }

  const quickCommands = [
    t('ai.organizeFiles', language),
    t('ai.formatDocument', language),
    t('ai.analyzeData', language),
    t('ai.createPPT', language),
  ]

  if (isMinimized) {
    return (
      <div ref={containerRef} className="fixed z-50 cursor-move" style={{ right: `${position.x}px`, bottom: `${position.y}px` }} onMouseDown={handleMouseDown} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
        <button onClick={() => setIsMinimized(false)} className={`relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95 ${getMoodAnimation()}`}>
          <AIIcon size={24} />
          {showHands && (
            <>
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out" style={{ transform: `translateY(-50%) translateX(${-15 - dragDistance * 30}px) rotate(${-45 + dragDistance * 20}deg)`, opacity: Math.min(dragDistance * 1.5, 1), animation: dragDistance > 0.5 ? 'hand-wave 1s infinite' : 'none' }}>
                <svg className="w-10 h-10 text-white drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 11.75c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zm6 0c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37C11.07 8.33 14.05 10 17.42 10c.78 0 1.53-.09 2.25-.26.21.71.33 1.47.33 2.26 0 4.41-3.59 8-8 8z"/>
                </svg>
              </div>
              <div className="absolute -right-8 top-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out" style={{ transform: `translateY(-50%) translateX(${15 + dragDistance * 30}px) rotate(${45 - dragDistance * 20}deg) scaleX(-1)`, opacity: Math.min(dragDistance * 1.5, 1), animation: dragDistance > 0.5 ? 'hand-wave 1s infinite' : 'none' }}>
                <svg className="w-10 h-10 text-white drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 11.75c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37C11.07 8.33 14.05 10 17.42 10c.78 0 1.53-.09 2.25-.26.21.71.33 1.47.33 2.26 0 4.41-3.59 8-8 8z"/>
                </svg>
              </div>
            </>
          )}
        </button>
        {messages.length > 0 && (<span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center animate-pulse">{messages.filter(m => m.role === 'user').length}</span>)}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="fixed z-50" style={{ right: `${position.x}px`, bottom: `${position.y}px` }}>
      {!isOpen ? (
        <button
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className={`w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-2xl active:scale-95 ${getMoodAnimation()}`}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <AIIcon size={28} />
        </button>
      ) : (
        <div className="w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-slideUp">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 flex items-center justify-between cursor-move" onMouseDown={handleMouseDown}>
            <div className="flex items-center space-x-2">
              <span className={`w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white ${getMoodAnimation()}`}><AIIcon size={16} /></span>
              <h3 className="text-white font-semibold text-lg">{t('app.name', language)} AI</h3>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModelSelector(!showModelSelector);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded-md flex items-center justify-center text-white transition-colors text-xs font-medium"
                title={t('ai.selectModel', language)}
              >
                <span className="mr-1">{t('ai.model', language)}</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(true);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors text-sm"
              >?</button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors text-sm"
              >×</button>
            </div>
          </div>

          {showModelSelector && (
            <div className="bg-gray-100 p-3 border-b">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-700">{t('ai.selectModel', language)}</h4>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <div className="flex items-center p-2 bg-green-50 rounded-lg border border-green-200">
                  <input
                    type="radio"
                    id="provider-local"
                    name="provider"
                    checked={selectedModel === 'local'}
                    onChange={() => {
                      setSelectedModel('local')
                      setSelectedModelId('local-transformer')
                      setSelectedCustomProvider('')
                    }}
                    className="mr-2"
                  />
                  <label htmlFor="provider-local" className="text-sm flex-1">
                    <span className="font-medium">{t('ai.localModel', language)}</span>
                    <span className="text-green-600 ml-2 text-xs bg-green-100 px-2 py-0.5 rounded">{t('ai.free', language)}</span>
                  </label>
                </div>

                {customProviders.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 px-1">{t('ai.myApis', language)}</p>
                    {customProviders.map(provider => (
                      <div key={provider.id} className="flex items-center p-2 bg-white rounded-lg border border-gray-200">
                        <input
                          type="radio"
                          id={`provider-${provider.id}`}
                          name="provider"
                          checked={selectedCustomProvider === provider.id}
                          onChange={() => {
                            setSelectedModel('custom')
                            setSelectedCustomProvider(provider.id)
                          }}
                          className="mr-2"
                        />
                        <label htmlFor={`provider-${provider.id}`} className="text-sm flex-1">
                          <span className="font-medium">{provider.name}</span>
                          <span className="text-orange-600 ml-2 text-xs">{t('ai.thirdPartyApi', language)}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 mt-2 border-t border-gray-200">
                <button
                    onClick={handleOpenApiManager}
                    className="w-full py-2 bg-[#2b5797] text-white rounded-lg text-sm font-medium hover:bg-[#1e3f6f] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('ai.addApiKey', language)}
                  </button>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  {t('ai.supportedApis', language)}
                </p>
                <div className="mt-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-xs text-yellow-700">
                    <strong>{t('ai.note', language)}：</strong>{t('ai.apiNote', language)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white min-h-[200px] max-h-[400px]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-center">
                  {t('ai.greeting', language)}<br />
                  {t('ai.howHelp', language)}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickCommands.map(cmd => (<button key={cmd} onClick={() => { setInputValue(cmd); setTimeout(() => handleSend(), 100) }} className="px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-full text-sm hover:bg-blue-500/20 transition-colors">{cmd}</button>))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-sm' : 'bg-white shadow-md text-gray-700 rounded-bl-sm border border-gray-100'}`}>
                    <div className="text-sm prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    {msg.thinking && msg.thinking.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => {
                            setMessages(prev => prev.map(m =>
                              m.id === msg.id ? { ...m, showThinking: !m.showThinking } : m
                            ))
                          }}
                          className={`text-xs ${msg.role === 'user' ? 'text-white/70 hover:text-white' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                        >
                          {msg.showThinking ? '隐藏思考过程' : '查看思考过程'}
                        </button>
                        {msg.showThinking && (
                          <div className={`mt-2 p-2 rounded ${msg.role === 'user' ? 'bg-white/10' : 'bg-gray-50 border border-gray-100'}`}>
                            {msg.thinking.map((step, index) => (
                              <div key={index} className="text-xs mb-1">
                                <span className="font-medium">{step.type === 'analyze' ? '分析' : step.type === 'reason' ? '推理' : step.type === 'plan' ? '计划' : step.type === 'execute' ? '执行' : '反思'}:</span>
                                <span className={`ml-1 ${msg.role === 'user' ? 'text-white/80' : 'text-gray-600'}`}>{step.description} - {step.result}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {msg.commands && msg.commands.length > 0 && (
                      <div className={`mt-2 pt-2 border-t ${msg.role === 'user' ? 'border-white/20' : 'border-gray-100'} space-y-1`}>
                        {msg.commands.map(cmd => (
                          <div key={cmd.id} className="flex items-center justify-between gap-2">
                            <span className={`text-xs ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                              {cmd.text}
                            </span>
                            <div className="flex gap-1">
                              {!cmd.executed && cmd.action && (
                                <button
                                  onClick={() => handleExecuteCommand(msg.id, cmd.id)}
                                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                    msg.role === 'user'
                                      ? 'bg-green-500/30 hover:bg-green-500/50 text-white'
                                      : 'bg-green-100 hover:bg-green-200 text-green-700'
                                  }`}
                                >
                                  {t('ai.execute', language)}
                                </button>
                              )}
                              {cmd.executed && (
                                <button
                                  onClick={() => handleUndoCommand(msg.id, cmd.id)}
                                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                    msg.role === 'user'
                                      ? 'bg-white/20 hover:bg-white/30 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {t('ai.undo', language)}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {msg.commands.some(cmd => !cmd.executed && cmd.action) && (
                          <button
                            onClick={() => handleExecuteAllCommands(msg.id)}
                            className={`w-full mt-2 text-xs px-3 py-1.5 rounded transition-colors ${
                              msg.role === 'user'
                                ? 'bg-white/30 hover:bg-white/40 text-white font-medium'
                                : 'bg-blue-500 hover:bg-blue-600 text-white font-medium'
                            }`}
                          >
                            {t('ai.executeAll', language)}
                          </button>
                        )}
                      </div>
                    )}
                    {msg.intent && !msg.commands && (<div className={`mt-2 pt-2 border-t ${msg.role === 'user' ? 'border-white/20' : 'border-gray-100'}`}><span className={`text-xs ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>{t('ai.intent', language)}: {msg.intent.intent}</span></div>)}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t bg-white">
            <div className="flex items-center space-x-2">
              <input ref={inputRef} type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={t('ai.enterCommand', language)} className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" />
              <button onClick={handleSend} disabled={!inputValue.trim()} className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center transition-all hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {showApiKeyManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={handleApiManagerClose}>
          <div onClick={e => e.stopPropagation()}>
            <ApiKeyManager onClose={handleApiManagerClose} />
          </div>
        </div>
      )}
    </div>
  )
}

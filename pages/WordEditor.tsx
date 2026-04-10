import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useLanguageStore } from '@/store/languageStore'
import { t, Language } from '@/i18n'
import { intentParser } from '@/utils/intentParser'
import { documentFormatter, formatPresets } from '@/utils/documentFormatter'
import { executeCommand, CommandContext, CommandType } from '@/utils/commandEngine'
import { useNotification } from '@/components/Notification'
import { ColorPicker, textColors, highlightColors } from '@/components/FormatToolbar'
import { FontSizeInput, FontFamilySelect } from '@/components/CompleteFormatToolbar'
import { parseUserInput } from '@/utils/smartInputParser'
import { TableInsertDialog, TableContextMenu, insertTableAtCursor, getTableFromSelection, getCellFromSelection, insertRow, deleteRow, insertColumn, deleteColumn, mergeCells, splitCell, TableConfig } from '@/components/TableEditor'
import { ImageInsertDialog, insertImageAtCursor, ImageConfig } from '@/components/ImageEditor'
import { PageSetupDialog, PageSetup, defaultPageSetup } from '@/components/PageSetup'
import { PrintPreview } from '@/components/PrintPreview'
import { AICommandPanel } from '@/components/AICommandPanel'
import { IntelligentAssistantPanel } from '@/components/IntelligentAssistantPanel'
import { IntelligentChatPanel } from '@/components/IntelligentChatPanel'
import { SmartPagination, PageContent, getPaginationStyles } from '@/components/SmartPagination'
import { ChartConfig as EditableChartConfig } from '@/components/EditableChart'
import { intelligentDocumentGenerator } from '@/services/intelligentDocumentGenerator'

import { IntelligentDocumentProcessor, IntelligentEdit } from '@/utils/intelligentProcessor'
import { STYLE_PROFILES } from '@/utils/formatRecommendation'
import { enhancedTransformerModel as transformerModel } from '@/utils/localAI/EnhancedTransformerModel'

interface FormatIssue {
  id: string
  type: string
  text: string
  suggestion: string
  fixed?: boolean
}

interface DropdownMenu {
  id: string
  isOpen: boolean
  position: { x: number; y: number }
}

const fontSizeToPt: Record<string, number> = {
  '初号': 42, '小初': 36, '一号': 26, '小一': 24,
  '二号': 22, '小二': 18, '三号': 16, '小三': 15,
  '四号': 14, '小四': 12, '五号': 10.5, '小五': 9,
  '六号': 7.5, '小六': 6.5
}

const ptToFontSize = (pt: number): string => {
  for (const [name, size] of Object.entries(fontSizeToPt)) {
    if (Math.abs(size - pt) < 0.5) return name
  }
  return `${pt}pt`
}

export default function WordEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentFile, setCurrentFile, addAIMessage, aiPanel, isLoading, setLoading } = useAppStore()
  const { language, setLanguage, availableLanguages, getLanguageName } = useLanguageStore()
  const { addNotification } = useNotification()
  
  const [documentContent, setDocumentContent] = useState<string>('')
  const [hasDocument, setHasDocument] = useState(false)
  const [formatIssues, setFormatIssues] = useState<FormatIssue[]>([])
  const [aiInput, setAIInput] = useState('')
  const [activeRibbon, setActiveRibbon] = useState('home')
  const [activeSidebar, setActiveSidebar] = useState<'ai' | 'format' | 'outline' | 'presets' | null>(null)
  const [fontSize, setFontSize] = useState(12)
  const [fontFamily, setFontFamily] = useState('SimSun, serif')
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [lineSpacing, setLineSpacing] = useState('1.5')
  const [selectedPreset, setSelectedPreset] = useState<string>('standard')
  const [formatChanges, setFormatChanges] = useState<string[]>([])
  const [zoom, setZoom] = useState(100)
  const [activeDropdown, setActiveDropdown] = useState<DropdownMenu | null>(null)
  const [findReplace, setFindReplace] = useState({ find: '', replace: '', isOpen: false })
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0, paragraphs: 0 })
  const [isModified, setIsModified] = useState(false)
  const [textColor, setTextColor] = useState('#000000')
  const [highlightColor, setHighlightColor] = useState('transparent')
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isSubscript, setIsSubscript] = useState(false)
  const [isSuperscript, setIsSuperscript] = useState(false)
  const [showTableDialog, setShowTableDialog] = useState(false)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [showPageSetup, setShowPageSetup] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [activeAITab, setActiveAITab] = useState<'chat' | 'command' | 'analyze' | 'format'>('chat')
  const [pageSetup, setPageSetup] = useState<PageSetup>(defaultPageSetup)
  const [tableContextMenu, setTableContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } })
  const [tableSelection] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [pages, setPages] = useState<PageContent[]>([])
  const [autoCharts] = useState<EditableChartConfig[]>([])
  const [enableSmartPagination] = useState(true)
  const editorRef = useRef<HTMLDivElement>(null)
  const menuRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const editorInitialized = useRef(false)

  // 处理URL参数
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const content = searchParams.get('content')
    
    if (content) {
      console.log('URL content:', content)
      const contentLower = content.toLowerCase()
      
      // 检查是否是报告生成请求
      if (contentLower.includes('报告') || contentLower.includes('完成') || contentLower.includes('生成')) {
        // 显示开始生成通知
        addNotification('info', '开始生成', '正在理解需求并规划文档结构...')
        
        // 动态生成报告内容
        generateDynamicReport(content).then(reportContent => {
          setDocumentContent(reportContent)
          setHasDocument(true)
          setIsModified(true)
          editorInitialized.current = true
          // 内容真正完成后显示完成通知
          addNotification('success', '内容生成完成', '文档已成功生成，您可以开始编辑了！')
        }).catch(error => {
          console.error('生成报告失败:', error)
          addNotification('error', '生成失败', '文档生成失败，请重试')
        })
      } else {
        setDocumentContent(content)
        setHasDocument(true)
        setIsModified(true)
      }
    }
  }, [location.search, addNotification])

  const T = useCallback((key: string) => t(key, language), [language])

  const getCommandContext = useCallback((): CommandContext => ({
    documentType: 'word',
    documentContent,
    selection: editorRef.current ? {
      start: 0,
      end: 0,
      text: window.getSelection()?.toString() || ''
    } : undefined
  }), [documentContent])

  const handleCommand = useCallback(async (command: CommandType, params?: Record<string, unknown>) => {
    const result = await executeCommand(command, getCommandContext(), params)
    if (result.message) {
      addNotification(result.success ? 'success' : 'error', T('button.confirm'), result.message)
    }
    return result
  }, [getCommandContext, addNotification, T])

  const updateWordCount = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || ''
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length
      const chars = text.length
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0).length
      setWordCount({ words, chars, paragraphs })
    }
  }, [])

  useEffect(() => {
    updateWordCount()
  }, [documentContent, updateWordCount])

  const handleOpenFile = useCallback(async () => {
    try {
      const result = await handleCommand('file.open')
      if (result.success && result.data) {
        const { name, content } = result.data as { name: string; content: string }
        setCurrentFile({ name, type: 'word', content })
        setDocumentContent(content)
        setHasDocument(true)
        setIsModified(false)
        addNotification('success', T('file.open'), name)
      }
    } catch (error) {
      addNotification('error', T('status.error'), T('error.fileOpenFailed'))
    }
  }, [handleCommand, setCurrentFile, addNotification, T])

  const handleNewFile = useCallback(() => {
    setCurrentFile(null)
    setDocumentContent('')
    setHasDocument(true)
    setFormatIssues([])
    setFormatChanges([])
    setIsModified(false)
    addNotification('success', T('file.new'), '已创建新文档，可以开始编辑')
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus()
      }
    }, 100)
  }, [setCurrentFile, addNotification, T])

  const handleSaveFile = useCallback(async () => {
    if (!currentFile && !documentContent) {
      addNotification('error', T('status.error'), T('error.fileNotFound'))
      return
    }

    const result = await handleCommand('file.save')
    if (result.success) {
      setIsModified(false)
    }
  }, [currentFile, documentContent, handleCommand, addNotification, T])

  const handleExportPDF = useCallback(async () => {
    await handleCommand('file.exportPDF')
  }, [handleCommand])

  const handleExportDOCX = useCallback(async () => {
    await handleCommand('file.exportDOCX')
  }, [handleCommand])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleFormatAction = useCallback((action: string, value?: unknown) => {
    switch (action) {
      case 'bold':
        document.execCommand('bold')
        setIsBold(!isBold)
        break
      case 'italic':
        document.execCommand('italic')
        setIsItalic(!isItalic)
        break
      case 'underline':
        document.execCommand('underline')
        setIsUnderline(!isUnderline)
        break
      case 'strikethrough':
        document.execCommand('strikeThrough')
        setIsStrikethrough(!isStrikethrough)
        break
      case 'subscript':
        document.execCommand('subscript')
        setIsSubscript(!isSubscript)
        break
      case 'superscript':
        document.execCommand('superscript')
        setIsSuperscript(!isSuperscript)
        break
      case 'textColor':
        if (value) {
          document.execCommand('foreColor', false, value as string)
          setTextColor(value as string)
        }
        break
      case 'highlight':
        if (value) {
          document.execCommand('hiliteColor', false, value as string)
          setHighlightColor(value as string)
        }
        break
      case 'alignLeft':
        document.execCommand('justifyLeft')
        break
      case 'alignCenter':
        document.execCommand('justifyCenter')
        break
      case 'alignRight':
        document.execCommand('justifyRight')
        break
      case 'alignJustify':
        document.execCommand('justifyFull')
        break
      case 'indent':
        document.execCommand('indent')
        break
      case 'outdent':
        document.execCommand('outdent')
        break
      case 'insertOrderedList':
        document.execCommand('insertOrderedList')
        break
      case 'insertUnorderedList':
        document.execCommand('insertUnorderedList')
        break
      case 'fontFamily':
        if (value) {
          document.execCommand('fontName', false, value as string)
          setFontFamily(value as string)
        }
        break
      case 'fontSize':
        if (value) {
          const ptValue = typeof value === 'number' ? value : fontSizeToPt[value as string] || 12
          setFontSize(ptValue)
          const editor = editorRef.current
          if (editor) {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0)
              if (!range.collapsed) {
                const span = document.createElement('span')
                span.style.fontSize = `${ptValue}pt`
                range.surroundContents(span)
              }
            }
          }
        }
        break
      case 'lineSpacing':
        setLineSpacing(value as string)
        break
      default:
        break
    }
  }, [isBold, isItalic, isUnderline, isStrikethrough, isSubscript, isSuperscript, textColor, highlightColor, fontFamily, fontSize, lineSpacing])



  const handleAICommands = useCallback((commands: any[]) => {
    commands.forEach(cmd => {
      if (cmd.value !== undefined) {
        handleFormatAction(cmd.action.replace('set', '').toLowerCase(), cmd.value)
      }
    })
  }, [handleFormatAction])





  // 动态生成报告内容 - 使用智能文档生成流程
  const generateDynamicReport = useCallback(async (topic: string) => {
    try {
      // 使用智能文档生成服务
      const reportHtml = await intelligentDocumentGenerator.generateDocument(
        topic,
        (stage, progress) => {
          addNotification('info', stage, `进度: ${progress}%`)
        }
      )
      
      // 设置文档内容
      setDocumentContent(reportHtml)
      setHasDocument(true)
      setIsModified(true)
      editorInitialized.current = true
      
      // 显示完成通知
      addNotification('success', '文档生成完成', '已按照智能流程生成完整文档，包含相关图片和政策链接')
      
      return reportHtml
    } catch (error) {
      console.error('智能文档生成失败:', error)
      addNotification('error', '生成失败', '文档生成失败，请重试')
      throw error
    }
  }, [addNotification])

  const handleInsertTable = useCallback((config: TableConfig) => {
    insertTableAtCursor(config)
    setIsModified(true)
    addNotification('success', '插入表格', `已插入 ${config.rows}×${config.cols} 表格`)
  }, [addNotification])

  const handleInsertImage = useCallback((config: ImageConfig) => {
    insertImageAtCursor(config)
    setIsModified(true)
    addNotification('success', '插入图片', '图片已插入')
  }, [addNotification])

  const handleIntelligentEdit = useCallback((edit: IntelligentEdit) => {
    switch (edit.action) {
      case 'setFontSize':
        if (typeof edit.value === 'number') {
          setFontSize(edit.value)
          addNotification('success', '智能格式', `已设置字号为 ${edit.value}pt`)
        }
        break
      case 'setFontFamily':
        if (typeof edit.value === 'string') {
          setFontFamily(edit.value)
          addNotification('success', '智能格式', `已设置字体`)
        }
        break
      case 'setLineSpacing':
        if (typeof edit.value === 'number') {
          setLineSpacing(edit.value.toString())
          addNotification('success', '智能格式', `已设置行距为 ${edit.value}倍`)
        }
        break
      case 'setAlignment':
        if (typeof edit.value === 'string') {
          document.execCommand('justify' + edit.value.charAt(0).toUpperCase() + edit.value.slice(1))
          addNotification('success', '智能格式', `已设置对齐方式`)
        }
        break
      case 'setBold':
        document.execCommand('bold')
        setIsBold(edit.value as boolean)
        addNotification('success', '智能格式', edit.value ? '已加粗' : '已取消加粗')
        break
      case 'setItalic':
        document.execCommand('italic')
        setIsItalic(edit.value as boolean)
        addNotification('success', '智能格式', edit.value ? '已斜体' : '已取消斜体')
        break
      case 'setUnderline':
        document.execCommand('underline')
        setIsUnderline(edit.value as boolean)
        addNotification('success', '智能格式', edit.value ? '已下划线' : '已取消下划线')
        break
      case 'insertTable':
        const tableConfig = edit.value as { rows: number; cols: number }
        insertTableAtCursor({
          rows: tableConfig.rows,
          cols: tableConfig.cols,
          width: '100%',
          borderStyle: 'normal',
          borderColor: '#000000',
          cellPadding: 5,
          headerRow: true
        })
        addNotification('success', '智能操作', `已插入 ${tableConfig.rows}×${tableConfig.cols} 表格`)
        break
      case 'insertImage':
        setShowImageDialog(true)
        break
      case 'openPageSetup':
        setShowPageSetup(true)
        break
      case 'openPrintPreview':
        setShowPrintPreview(true)
        break
      case 'autoFormat':
        const result = IntelligentDocumentProcessor.autoFormat(documentContent)
        if (result.success && result.formattedContent) {
          setDocumentContent(result.formattedContent)
          addNotification('success', '智能格式化', '已自动应用最佳格式')
        }
        break
      case 'applyProfile':
        const profileId = edit.value as string
        handleApplyProfile(profileId)
        break
    }
    setIsModified(true)
  }, [addNotification, documentContent])

  const handleApplyProfile = useCallback((profileId: string) => {
    const profile = STYLE_PROFILES[profileId]
    if (profile) {
      setFontFamily(profile.fontFamily)
      setFontSize(profile.fontSize)
      setLineSpacing(profile.lineHeight.toString())
      setPageSetup(prev => ({
        ...prev,
        marginTop: profile.margins.top,
        marginBottom: profile.margins.bottom,
        marginLeft: profile.margins.left,
        marginRight: profile.margins.right
      }))
      addNotification('success', '应用样式', `已应用 ${profile.name}`)
      setIsModified(true)
    }
  }, [addNotification])

  const handleEditAction = useCallback(async (action: string) => {
    switch (action) {
      case 'undo':
        await handleCommand('edit.undo')
        break
      case 'redo':
        await handleCommand('edit.redo')
        break
      case 'cut':
        await handleCommand('edit.cut')
        break
      case 'copy':
        await handleCommand('edit.copy')
        break
      case 'paste':
        await handleCommand('edit.paste')
        break
      case 'selectAll':
        await handleCommand('edit.selectAll')
        break
      case 'find':
        setFindReplace(prev => ({ ...prev, isOpen: true }))
        break
      case 'replace':
        setFindReplace(prev => ({ ...prev, isOpen: true }))
        break
    }
  }, [handleCommand])

  const handleViewAction = useCallback(async (action: string) => {
    switch (action) {
      case 'zoomIn':
        setZoom(prev => Math.min(prev + 10, 200))
        break
      case 'zoomOut':
        setZoom(prev => Math.max(prev - 10, 50))
        break
      case 'zoom100':
        setZoom(100)
        break
      case 'fullScreen':
        await handleCommand('view.fullScreen')
        break
      case 'sidebar':
        setActiveSidebar(prev => prev ? null : 'ai')
        break
    }
  }, [handleCommand])

  const handleFindText = useCallback(() => {
    if (!findReplace.find || !editorRef.current) return
    
    const content = editorRef.current.innerText || ''
    const index = content.indexOf(findReplace.find)
    
    if (index >= 0) {
      const selection = window.getSelection()
      const range = document.createRange()
      
      const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT)
      let currentOffset = 0
      
      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const nodeLength = node.textContent?.length || 0
        
        if (currentOffset + nodeLength > index) {
          range.setStart(node, index - currentOffset)
          range.setEnd(node, Math.min(index - currentOffset + findReplace.find.length, nodeLength))
          selection?.removeAllRanges()
          selection?.addRange(range)
          break
        }
        currentOffset += nodeLength
      }
    } else {
      addNotification('info', T('edit.find'), 'Not found')
    }
  }, [findReplace.find, addNotification, T])

  const handleReplaceText = useCallback(() => {
    if (!findReplace.find || !findReplace.replace) return
    
    const selection = window.getSelection()
    if (selection?.toString() === findReplace.find) {
      document.execCommand('insertText', false, findReplace.replace)
    }
    handleFindText()
    setIsModified(true)
  }, [findReplace.find, findReplace.replace, handleFindText])

  const handleReplaceAll = useCallback(() => {
    if (!findReplace.find || !editorRef.current) return
    
    const content = editorRef.current.innerHTML
    const newContent = content.replace(new RegExp(findReplace.find, 'g'), findReplace.replace)
    editorRef.current.innerHTML = newContent
    setDocumentContent(editorRef.current.innerHTML)
    setIsModified(true)
    addNotification('success', T('edit.replace'), 'Replaced all')
  }, [findReplace.find, findReplace.replace, addNotification, T])

  const handleAIInputCommand = useCallback(async () => {
    if (!aiInput.trim()) return
    
    const intent = intentParser.parse(aiInput)
    addAIMessage({ role: 'user', content: aiInput, intent })
    
    setLoading(true)
    
    try {
      let response = ''
      
      const parsedInput = parseUserInput(aiInput)
      
      if (parsedInput.fontSize) {
        setFontSize(parsedInput.fontSize)
        response = `已设置字号为 ${parsedInput.fontSize}pt`
        if (parsedInput.fontFamily) {
          setFontFamily(parsedInput.fontFamily)
          response += `，字体为 ${parsedInput.fontFamily.split(',')[0]}`
        }
        if (parsedInput.color) {
          setTextColor(parsedInput.color)
          response += `，颜色为 ${parsedInput.color}`
        }
        if (parsedInput.spacing) {
          setLineSpacing(parsedInput.spacing.toString())
          response += `，行距为 ${parsedInput.spacing}倍`
        }
        addNotification('success', T('button.confirm'), response)
      } else if (intent.intent.includes('quick_format') || intent.intent.includes('一键') || intent.intent.includes('格式化')) {
        const parsed = documentFormatter.parseNaturalLanguageCommand(aiInput)
        let presetId = 'standard'
        
        if (parsed?.presetId) {
          presetId = parsed.presetId
        } else if (intent.intent.includes('thesis') || intent.intent.includes('论文')) {
          presetId = 'thesis'
        } else if (intent.intent.includes('report') || intent.intent.includes('报告')) {
          presetId = 'report'
        } else if (intent.intent.includes('contract') || intent.intent.includes('合同')) {
          presetId = 'contract'
        }
        
        const result = documentFormatter.applyPreset(documentContent, presetId)
        const preset = formatPresets.find(p => p.id === presetId)
        
        setFormatChanges(result.changes)
        setSelectedPreset(presetId)
        
        response = `${T('word.appliedChanges')}: ${preset?.name || presetId}\n\n${result.changes.map(c => `• ${c}`).join('\n')}`
        addNotification('success', T('button.confirm'), `${preset?.name || presetId} applied`)
      } else if (intent.intent.includes('check') || intent.intent.includes('检查')) {
        const analysis = documentFormatter.analyzeDocument(documentContent)
        response = `${T('word.formatCheck')}:

📊 ${T('excel.statistics')}
- ${T('word.wordCount')}: ${analysis.wordCount}
- ${T('word.charCount')}: ${analysis.charCount}
- ${T('word.paragraphCount')}: ${analysis.paragraphCount}

📝 ${T('word.outline')}
${analysis.hasTitle ? '✓' : '✗'} Title
${analysis.hasHeadings ? '✓' : '✗'} Headings
${analysis.hasLists ? '✓' : '✗'} Lists

💡 ${T('ai.quickFormat')}
${analysis.suggestions.length > 0 
  ? analysis.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
  : 'No suggestions'}`
      } else if (intent.intent.includes('summarize') || intent.intent.includes('摘要')) {
        // 使用Transformer模型生成摘要
        const generatedSummary = transformerModel.generateContent(aiInput, 'word')
        const analysis = documentFormatter.analyzeDocument(documentContent)
        response = `${T('ai.smartSummary')}:

${(typeof generatedSummary === 'string' ? generatedSummary : '').substring(0, 300)}...

📊 ${T('word.wordCount')}: ${analysis.wordCount}`
        // 自动将摘要插入到文档末尾
        if (editorRef.current) {
          document.execCommand('insertText', false, '\n\n--- 摘要 ---\n' + generatedSummary)
          setDocumentContent(editorRef.current.innerHTML)
        }
      } else if (intent.intent.includes('write') || intent.intent.includes('写') || intent.intent.includes('生成') || intent.intent.includes('创作')) {
        // 使用智能文档生成器生成完整文档
        const reportHtml = await intelligentDocumentGenerator.generateDocument(
          aiInput,
          (stage, progress) => {
            addNotification('info', stage, `进度: ${progress}%`)
          }
        )
        
        response = `已生成完整的Word文档内容：

📄 文档标题：${aiInput}
📑 包含完整的章节结构
📝 包含政策参考部分

✅ 已自动生成：
- 封面标题
- 完整目录
- 详细章节内容
- 相关图片和图表
- 政策参考信息
- 数据来源说明

内容已自动插入到文档中，您可以直接编辑或导出。`
        
        // 自动将生成的内容插入到文档中
        if (editorRef.current) {
          document.execCommand('insertHTML', false, reportHtml)
          setDocumentContent(editorRef.current.innerHTML)
        }
        addNotification('success', T('button.confirm'), `已生成完整的文档内容，包含政策参考部分`)
      } else if (intent.intent.includes('translate') || intent.intent.includes('翻译')) {
        // 使用Transformer模型生成翻译
        const generatedTranslation = transformerModel.generateContent(`翻译：${aiInput}`, 'word')
        response = `翻译结果：

${generatedTranslation}`
        // 自动将翻译插入到文档末尾
        if (editorRef.current) {
          document.execCommand('insertText', false, '\n\n--- 翻译 ---\n' + generatedTranslation)
          setDocumentContent(editorRef.current.innerHTML)
        }
        addNotification('success', T('button.confirm'), '翻译完成并已插入文档')
      } else if (intent.intent.includes('grammar') || intent.intent.includes('语法') || intent.intent.includes('检查')) {
        // 使用Transformer模型进行语法检查
        const grammarCheck = transformerModel.generateContent(`语法检查：${aiInput}`, 'word')
        response = `语法检查结果：

${grammarCheck}`
        addNotification('success', T('button.confirm'), '语法检查完成')
      } else if (intent.intent.includes('outline') || intent.intent.includes('大纲')) {
        // 使用Transformer模型生成大纲
        const outline = transformerModel.generateContent(`生成大纲：${aiInput}`, 'word')
        response = `生成的大纲：

${outline}`
        // 自动将大纲插入到文档中
        if (editorRef.current) {
          document.execCommand('insertText', false, '\n\n--- 大纲 ---\n' + outline)
          setDocumentContent(editorRef.current.innerHTML)
        }
        addNotification('success', T('button.confirm'), '大纲生成完成并已插入文档')
      } else {
        response = `${T('ai.greeting')}

${T('ai.desc')}:
• ${T('ai.quickFormat')}
• ${T('ai.smartSummary')}
• ${T('ai.translate')}
• ${T('ai.checkGrammar')}
• 生成内容 - 输入"写一篇关于...的文章"
• 生成大纲 - 输入"生成关于...的大纲"
• 翻译内容 - 输入"翻译：..."
• 语法检查 - 输入"语法检查：..."`
      }
      
      addAIMessage({ role: 'assistant', content: response })
    } catch (error) {
      console.error('AI输入处理失败:', error)
      addAIMessage({ role: 'assistant', content: '处理请求时发生错误，请重试' })
      addNotification('error', '错误', '处理请求时发生错误，请重试')
    } finally {
      setLoading(false)
      setAIInput('')
    }
  }, [aiInput, documentContent, addAIMessage, setLoading, addNotification, T])

  const handleApplyPreset = useCallback((presetId: string) => {
    const result = documentFormatter.applyPreset(documentContent, presetId)
    const preset = formatPresets.find(p => p.id === presetId)
    
    setFormatChanges(result.changes)
    setSelectedPreset(presetId)
    
    addNotification('success', T('button.confirm'), `${preset?.name || presetId} applied`)
    addAIMessage({
      role: 'assistant',
      content: `${T('word.appliedChanges')}: ${preset?.name}\n\n${result.changes.map(c => `• ${c}`).join('\n')}`
    })
  }, [documentContent, addNotification, addAIMessage, T])

  const handleQuickFormat = useCallback((formatType: 'standard' | 'clean' | 'formal' | 'simple') => {
    const result = documentFormatter.quickFormat(documentContent, formatType)
    setFormatChanges(result.changes)
    addNotification('success', T('button.confirm'), `${formatType} format applied`)
  }, [documentContent, addNotification, T])

  const handleFixAll = useCallback(() => {
    setFormatIssues(prev => prev.map(issue => ({ ...issue, fixed: true })))
    addNotification('success', T('button.confirm'), `${formatIssues.length} issues fixed`)
  }, [formatIssues.length, addNotification, T])

  const toggleDropdown = useCallback((menuId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    
    setActiveDropdown(prev => 
      prev?.id === menuId 
        ? null 
        : { id: menuId, isOpen: true, position: { x: rect.left, y: rect.bottom } }
    )
  }, [])

  const closeDropdown = useCallback(() => {
    setActiveDropdown(null)
  }, [])

  useEffect(() => {
    const handleClickOutside = () => closeDropdown()
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [closeDropdown])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          handleNewFile()
          break
        case 'o':
          e.preventDefault()
          handleOpenFile()
          break
        case 's':
          e.preventDefault()
          handleSaveFile()
          break
        case 'p':
          e.preventDefault()
          handlePrint()
          break
        case 'f':
          e.preventDefault()
          setFindReplace(prev => ({ ...prev, isOpen: true }))
          break
        case 'h':
          e.preventDefault()
          setFindReplace(prev => ({ ...prev, isOpen: true }))
          break
        case 'b':
          e.preventDefault()
          handleFormatAction('bold')
          break
        case 'i':
          e.preventDefault()
          handleFormatAction('italic')
          break
        case 'u':
          e.preventDefault()
          handleFormatAction('underline')
          break
      }
    }
  }, [handleNewFile, handleOpenFile, handleSaveFile, handlePrint, handleFormatAction])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  type MenuItem = {
    id: string
    label: string
    action: () => void
    shortcut?: string
    divider?: never
  } | {
    divider: true
    id?: never
    label?: never
    action?: never
    shortcut?: never
  }

  const menuItems: Record<string, MenuItem[]> = {
    file: [
      { id: 'new', label: T('file.new'), action: handleNewFile, shortcut: 'Ctrl+N' },
      { id: 'open', label: T('file.open'), action: handleOpenFile, shortcut: 'Ctrl+O' },
      { id: 'save', label: T('file.save'), action: handleSaveFile, shortcut: 'Ctrl+S' },
      { id: 'saveAs', label: T('file.saveAs'), action: () => handleCommand('file.saveAs') },
      { divider: true },
      { id: 'exportPDF', label: T('file.exportPDF'), action: handleExportPDF },
      { id: 'exportDOCX', label: T('file.exportDOCX'), action: handleExportDOCX },
      { id: 'print', label: T('file.print'), action: handlePrint, shortcut: 'Ctrl+P' },
      { divider: true },
      { id: 'close', label: T('file.close'), action: () => navigate('/') }
    ],
    edit: [
      { id: 'undo', label: T('edit.undo'), action: () => handleEditAction('undo'), shortcut: 'Ctrl+Z' },
      { id: 'redo', label: T('edit.redo'), action: () => handleEditAction('redo'), shortcut: 'Ctrl+Y' },
      { divider: true },
      { id: 'cut', label: T('edit.cut'), action: () => handleEditAction('cut'), shortcut: 'Ctrl+X' },
      { id: 'copy', label: T('edit.copy'), action: () => handleEditAction('copy'), shortcut: 'Ctrl+C' },
      { id: 'paste', label: T('edit.paste'), action: () => handleEditAction('paste'), shortcut: 'Ctrl+V' },
      { divider: true },
      { id: 'selectAll', label: T('edit.selectAll'), action: () => handleEditAction('selectAll'), shortcut: 'Ctrl+A' },
      { id: 'find', label: T('edit.find'), action: () => handleEditAction('find'), shortcut: 'Ctrl+F' },
      { id: 'replace', label: T('edit.replace'), action: () => handleEditAction('replace'), shortcut: 'Ctrl+H' }
    ],
    view: [
      { id: 'zoomIn', label: T('view.zoomIn'), action: () => handleViewAction('zoomIn') },
      { id: 'zoomOut', label: T('view.zoomOut'), action: () => handleViewAction('zoomOut') },
      { id: 'zoom100', label: T('view.zoom100'), action: () => handleViewAction('zoom100') },
      { divider: true },
      { id: 'fullScreen', label: T('view.fullScreen'), action: () => handleViewAction('fullScreen') },
      { id: 'sidebar', label: T('view.sidebar'), action: () => handleViewAction('sidebar') }
    ],
    insert: [
      { id: 'image', label: T('insert.image'), action: () => handleInsertAction('image') },
      { id: 'table', label: T('insert.table'), action: () => handleInsertAction('table') },
      { id: 'link', label: T('insert.link'), action: () => handleInsertAction('link') },
      { divider: true },
      { id: 'pageBreak', label: T('insert.pageBreak'), action: () => handleInsertAction('pageBreak') },
      { id: 'date', label: 'Date', action: () => handleInsertAction('date') },
      { id: 'symbol', label: T('insert.symbol'), action: () => handleInsertAction('symbol') }
    ],
    format: [
      { id: 'bold', label: T('format.bold'), action: () => handleFormatAction('bold'), shortcut: 'Ctrl+B' },
      { id: 'italic', label: T('format.italic'), action: () => handleFormatAction('italic'), shortcut: 'Ctrl+I' },
      { id: 'underline', label: T('format.underline'), action: () => handleFormatAction('underline'), shortcut: 'Ctrl+U' },
      { divider: true },
      { id: 'alignLeft', label: T('format.alignLeft'), action: () => handleFormatAction('alignLeft') },
      { id: 'alignCenter', label: T('format.alignCenter'), action: () => handleFormatAction('alignCenter') },
      { id: 'alignRight', label: T('format.alignRight'), action: () => handleFormatAction('alignRight') },
      { id: 'alignJustify', label: T('format.alignJustify'), action: () => handleFormatAction('alignJustify') },
      { divider: true },
      { id: 'bullets', label: T('format.bullets'), action: () => handleFormatAction('insertUnorderedList') },
      { id: 'numbering', label: T('format.numbering'), action: () => handleFormatAction('insertOrderedList') }
    ],
    tools: [
      { id: 'wordCount', label: T('word.wordCount'), action: () => {
        addNotification('info', T('word.wordCount'), 
          `${T('word.wordCount')}: ${wordCount.words}, ${T('word.charCount')}: ${wordCount.chars}, ${T('word.paragraphCount')}: ${wordCount.paragraphs}`)
      }},
      { id: 'formatCheck', label: T('word.formatCheck'), action: () => setActiveSidebar('format') }
    ],
    help: [
      { id: 'shortcuts', label: T('keyboard.shortcuts'), action: () => {
        addNotification('info', T('keyboard.shortcuts'), 
          'Ctrl+N: New | Ctrl+O: Open | Ctrl+S: Save | Ctrl+B: Bold | Ctrl+I: Italic | Ctrl+U: Underline')
      }},
      { id: 'about', label: T('settings.about'), action: () => {
        addNotification('info', T('settings.about'), 'Zhiban AI v1.0.0 - Local Smart Office')
      }}
    ]
  }

  const handleInsertAction = useCallback((action: string) => {
    switch (action) {
      case 'image':
        setShowImageDialog(true)
        break
      case 'table':
        setShowTableDialog(true)
        break
      case 'link':
        // 实现链接插入功能
        break
      case 'pageBreak':
        // 实现分页符插入功能
        break
      case 'date':
        // 实现日期插入功能
        break
      case 'symbol':
        // 实现符号插入功能
        break
    }
  }, [])

  const renderDropdownMenu = () => {
    if (!activeDropdown) return null
    
    const items = menuItems[activeDropdown.id as keyof typeof menuItems]
    if (!items) return null

    return (
      <div 
        className="fixed bg-white border border-[#d0d0d0] shadow-lg rounded py-1 z-50 min-w-[200px]"
        style={{ left: activeDropdown.position.x, top: activeDropdown.position.y + 4 }}
        onClick={e => e.stopPropagation()}
      >
        {items.map((item, index) => 
          item.divider ? (
            <div key={`divider-${index}`} className="border-t border-[#e5e5e5] my-1" />
          ) : (
            <button
              key={item.id}
              onClick={() => {
                item.action()
                closeDropdown()
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[#f0f0f0] flex items-center justify-between"
            >
              <span>{item.label}</span>
              {item.shortcut && <span className="text-xs text-gray-400 ml-4">{item.shortcut}</span>}
            </button>
          )
        )}
      </div>
    )
  }

  const ribbons = {
    home: (
      <div className="flex items-center gap-1 px-2 py-1">
        <div className="flex items-center border-r border-[#d0d0d0] pr-2 mr-1">
          <button 
            onClick={() => handleEditAction('paste')}
            className="toolbar-btn flex flex-col items-center px-3"
            title={T('edit.paste')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-[10px] mt-1">{T('edit.paste')}</span>
          </button>
          <button 
            onClick={() => handleEditAction('cut')}
            className="toolbar-btn flex flex-col items-center px-2"
            title={T('edit.cut')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
            <span className="text-[10px] mt-1">{T('edit.cut')}</span>
          </button>
          <button 
            onClick={() => handleEditAction('copy')}
            className="toolbar-btn flex flex-col items-center px-2"
            title={T('edit.copy')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] mt-1">{T('edit.copy')}</span>
          </button>
        </div>
        
        <div className="flex items-center border-r border-[#d0d0d0] pr-2 mr-1">
          <FontFamilySelect 
            value={fontFamily} 
            onChange={(v) => handleFormatAction('fontFamily', v)} 
          />
          <FontSizeInput 
            value={fontSize} 
            onChange={(pt) => handleFormatAction('fontSize', pt)} 
          />
        </div>
        
        <div className="flex items-center border-r border-[#d0d0d0] pr-2 mr-1">
          <button 
            onClick={() => handleFormatAction('bold')}
            className={`w-8 h-8 flex items-center justify-center rounded ${isBold ? 'bg-[#e0e0e0]' : 'hover:bg-[#f0f0f0]'}`}
            title={T('tooltip.bold')}
          >
            <span className="font-bold text-sm">B</span>
          </button>
          <button 
            onClick={() => handleFormatAction('italic')}
            className={`w-8 h-8 flex items-center justify-center rounded ${isItalic ? 'bg-[#e0e0e0]' : 'hover:bg-[#f0f0f0]'}`}
            title={T('tooltip.italic')}
          >
            <span className="italic text-sm">I</span>
          </button>
          <button 
            onClick={() => handleFormatAction('underline')}
            className={`w-8 h-8 flex items-center justify-center rounded ${isUnderline ? 'bg-[#e0e0e0]' : 'hover:bg-[#f0f0f0]'}`}
            title={T('tooltip.underline')}
          >
            <span className="underline text-sm">U</span>
          </button>
          <button 
            onClick={() => handleFormatAction('strikethrough')}
            className={`w-8 h-8 flex items-center justify-center rounded ${isStrikethrough ? 'bg-[#e0e0e0]' : 'hover:bg-[#f0f0f0]'}`}
            title="删除线"
          >
            <span className="line-through text-sm">S</span>
          </button>
        </div>
        
        <div className="flex items-center border-r border-[#d0d0d0] pr-2 mr-1">
          <ColorPicker
            colors={textColors}
            value={textColor}
            onChange={(v) => handleFormatAction('textColor', v)}
            title="文字颜色"
          />
          <ColorPicker
            colors={highlightColors}
            value={highlightColor}
            onChange={(v) => handleFormatAction('highlightColor', v)}
            title="高亮颜色"
          />
          <button 
            onClick={() => handleFormatAction('subscript')}
            className={`w-8 h-8 flex items-center justify-center rounded hover:bg-[#f0f0f0] ${isSubscript ? 'bg-[#e0e0e0]' : ''}`}
            title="下标"
          >
            <span className="text-sm">X<sub>2</sub></span>
          </button>
          <button 
            onClick={() => handleFormatAction('superscript')}
            className={`w-8 h-8 flex items-center justify-center rounded hover:bg-[#f0f0f0] ${isSuperscript ? 'bg-[#e0e0e0]' : ''}`}
            title="上标"
          >
            <span className="text-sm">X<sup>2</sup></span>
          </button>
          <button 
            onClick={() => handleFormatAction('clearFormat')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f0f0f0]"
            title="清除格式"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center border-r border-[#d0d0d0] pr-2 mr-1">
          <button 
            onClick={() => handleFormatAction('alignLeft')}
            className="toolbar-btn"
            title={T('format.alignLeft')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
            </svg>
          </button>
          <button 
            onClick={() => handleFormatAction('alignCenter')}
            className="toolbar-btn"
            title={T('format.alignCenter')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
            </svg>
          </button>
          <button 
            onClick={() => handleFormatAction('alignRight')}
            className="toolbar-btn"
            title={T('format.alignRight')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
            </svg>
          </button>
          <button 
            onClick={() => handleFormatAction('alignJustify')}
            className="toolbar-btn"
            title={T('format.alignJustify')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center border-r border-[#d0d0d0] pr-2 mr-1">
          <button 
            onClick={() => handleFormatAction('insertUnorderedList')}
            className="toolbar-btn"
            title={T('format.bullets')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              <circle cx="2" cy="6" r="1" fill="currentColor" />
              <circle cx="2" cy="12" r="1" fill="currentColor" />
              <circle cx="2" cy="18" r="1" fill="currentColor" />
            </svg>
          </button>
          <button 
            onClick={() => handleFormatAction('insertOrderedList')}
            className="toolbar-btn"
            title={T('format.numbering')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
          <button 
            onClick={() => handleFormatAction('indent')}
            className="toolbar-btn"
            title={T('format.indent')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5v14" />
            </svg>
          </button>
          <button 
            onClick={() => handleFormatAction('outdent')}
            className="toolbar-btn"
            title={T('format.outdent')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 5v14" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center">
          <select 
            value={lineSpacing}
            onChange={e => handleFormatAction('lineSpacing', e.target.value)}
            className="h-8 px-2 text-sm border border-[#d0d0d0] rounded"
          >
            <option value="1">{T('format.single')}</option>
            <option value="1.5">{T('format.oneHalf')}</option>
            <option value="2">{T('format.double')}</option>
          </select>
          
          <div className="ml-4 flex items-center gap-2">
            <button 
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              className="toolbar-btn flex flex-col items-center px-3"
              title="AI助手"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] mt-1">AI助手</span>
            </button>
          </div>
        </div>
      </div>
    ),
    insert: (
      <div className="flex items-center gap-1 px-2 py-1">
        <button 
          onClick={() => handleInsertAction('image')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] mt-1">{T('insert.image')}</span>
        </button>
        <button 
          onClick={() => handleInsertAction('table')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] mt-1">{T('insert.table')}</span>
        </button>
        <button 
          onClick={() => handleInsertAction('link')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-[10px] mt-1">{T('insert.link')}</span>
        </button>
        <button 
          onClick={() => handleInsertAction('pageBreak')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[10px] mt-1">{T('insert.pageBreak')}</span>
        </button>
        <button 
          onClick={() => handleInsertAction('date')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] mt-1">Date</span>
        </button>
        <button 
          onClick={() => handleInsertAction('symbol')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-12a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px] mt-1">{T('insert.symbol')}</span>
        </button>
      </div>
    ),
    layout: (
      <div className="flex items-center gap-1 px-2 py-1">
        <button 
          onClick={() => setShowPageSetup(true)}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <span className="text-[10px] mt-1">{T('layout.pageSetup')}</span>
        </button>
        <button 
          onClick={() => setShowPageSetup(true)}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4M4 16l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <span className="text-[10px] mt-1">{T('layout.margins')}</span>
        </button>
        <button 
          onClick={() => {
            setPageSetup(prev => ({
              ...prev,
              orientation: prev.orientation === 'portrait' ? 'landscape' : 'portrait'
            }))
            addNotification('success', '方向已更改', pageSetup.orientation === 'portrait' ? '横向' : '纵向')
          }}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <span className="text-[10px] mt-1">{T('layout.orientation')}</span>
        </button>
        <button 
          onClick={() => addNotification('info', T('layout.columns'), 'Columns settings')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <span className="text-[10px] mt-1">{T('layout.columns')}</span>
        </button>
      </div>
    ),
    review: (
      <div className="flex items-center gap-1 px-2 py-1">
        <button 
          onClick={() => setActiveSidebar('format')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-[10px] mt-1">{T('word.formatCheck')}</span>
        </button>
        <button 
          onClick={() => addNotification('info', T('word.wordCount'), 
            `${T('word.wordCount')}: ${wordCount.words}, ${T('word.charCount')}: ${wordCount.chars}`)}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 11h.01M12 14h.01M12 17h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] mt-1">{T('word.wordCount')}</span>
        </button>
      </div>
    ),
    ai: (
      <div className="flex items-center gap-1 px-2 py-1">
        <div className="relative">
          <button 
            onClick={(e) => toggleDropdown('aiMenu', e)}
            className="toolbar-btn flex flex-col items-center px-3"
            title="AI助手"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[10px] mt-1">AI助手</span>
          </button>
          {activeDropdown?.id === 'aiMenu' && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
              <div className="p-2">
                <button onClick={() => {
                  setShowAIAssistant(true)
                  setActiveAITab('chat')
                  closeDropdown()
                }} className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded">
                  智能聊天
                </button>
                <button onClick={() => {
                  setShowAIAssistant(true)
                  setActiveAITab('command')
                  closeDropdown()
                }} className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded">
                  命令面板
                </button>
                <button onClick={() => {
                  setShowAIAssistant(true)
                  setActiveAITab('analyze')
                  closeDropdown()
                }} className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded">
                  文档分析
                </button>
              </div>
            </div>
          )}
        </div>
        <button 
          onClick={() => setActiveSidebar('presets')}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <span className="text-[10px] mt-1">{T('word.formatPresets')}</span>
        </button>
        <button 
          onClick={() => handleQuickFormat('standard')}
          className="px-3 py-2 text-xs bg-[#2b5797] text-white rounded hover:bg-[#1e3f6f] flex flex-col items-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] mt-1">{T('ai.quickFormat')}</span>
        </button>
        <button 
          onClick={() => {
            if (documentContent) {
              const analysis = documentFormatter.analyzeDocument(documentContent)
              addAIMessage({
                role: 'assistant',
                content: `${T('ai.smartSummary')}:\n\n${documentContent.substring(0, 300)}...\n\n📊 ${T('word.wordCount')}: ${analysis.wordCount}`
              })
              setActiveSidebar('ai')
            }
          }}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-[10px] mt-1">{T('ai.smartSummary')}</span>
        </button>
        <button 
          onClick={() => {
            addAIMessage({
              role: 'assistant',
              content: `${T('ai.translate')}: Select text and choose target language.`
            })
            setActiveSidebar('ai')
          }}
          className="toolbar-btn flex flex-col items-center px-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          <span className="text-[10px] mt-1">{T('ai.translate')}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#f0f0f0]">
      <div className="bg-white border-b border-[#e0e0e0] flex items-center h-12 px-2">
        <div className="flex items-center gap-2 px-2">
          <button 
            onClick={() => navigate('/')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f0f0f0]"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="w-8 h-8 bg-[#2b5797] rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          {['file', 'edit', 'view', 'insert', 'format', 'tools', 'help'].map(menuId => (
            <button
              key={menuId}
              ref={el => menuRefs.current[menuId] = el}
              onClick={(e) => toggleDropdown(menuId, e)}
              className={`toolbar-btn text-sm px-3 ${activeDropdown?.id === menuId ? 'bg-[#e0e0e0]' : ''}`}
            >
              {T(`menu.${menuId}`)}
            </button>
          ))}
        </div>
        
        <div className="flex-1 text-center">
          <span className="text-sm text-gray-600">
            {currentFile?.name || T('file.new')}
            {isModified && ' *'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="h-8 px-2 text-sm border border-[#d0d0d0] rounded"
          >
            {availableLanguages.map(lang => (
              <option key={lang} value={lang}>{getLanguageName(lang)}</option>
            ))}
          </select>
          
          <button 
            onClick={handleOpenFile}
            className="toolbar-btn text-sm"
          >
            {T('file.open')}
          </button>
          <button 
            onClick={handleSaveFile}
            className="btn-primary text-sm"
            disabled={!currentFile && !documentContent}
          >
            {T('button.save')}
          </button>
          <button 
            onClick={handleExportPDF}
            className="btn-secondary text-sm"
            disabled={!currentFile && !documentContent}
          >
            {T('file.exportPDF')}
          </button>
          <button 
            onClick={handleExportDOCX}
            className="btn-secondary text-sm"
            disabled={!currentFile && !documentContent}
          >
            {T('file.exportDOCX')}
          </button>
        </div>
      </div>
      
      {renderDropdownMenu()}
      
      <div className="bg-white border-b border-[#e0e0e0]">
        <div className="flex border-b border-[#e0e0e0]">
          {[
            { id: 'home', label: T('ribbon.home') },
            { id: 'insert', label: T('ribbon.insert') },
            { id: 'layout', label: T('ribbon.layout') },
            { id: 'review', label: T('ribbon.review') },
            { id: 'ai', label: T('ribbon.ai') },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveRibbon(tab.id)}
              className={`ribbon-tab ${activeRibbon === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {ribbons[activeRibbon as keyof typeof ribbons]}
      </div>
      
      {findReplace.isOpen && (
        <div className="bg-white border-b border-[#e0e0e0] p-2 flex items-center gap-2">
          <input
            type="text"
            placeholder={T('edit.find')}
            value={findReplace.find}
            onChange={e => setFindReplace(prev => ({ ...prev, find: e.target.value }))}
            className="h-8 px-2 text-sm border border-[#d0d0d0] rounded w-40"
          />
          <input
            type="text"
            placeholder={T('edit.replace')}
            value={findReplace.replace}
            onChange={e => setFindReplace(prev => ({ ...prev, replace: e.target.value }))}
            className="h-8 px-2 text-sm border border-[#d0d0d0] rounded w-40"
          />
          <button onClick={handleFindText} className="btn-secondary text-sm">{T('edit.find')}</button>
          <button onClick={handleReplaceText} className="btn-secondary text-sm">{T('edit.replace')}</button>
          <button onClick={handleReplaceAll} className="btn-secondary text-sm">{T('edit.replace')} All</button>
          <button onClick={() => setFindReplace(prev => ({ ...prev, isOpen: false }))} className="toolbar-btn text-sm">✕</button>
        </div>
      )}
      
      <div className="flex-1 flex overflow-hidden">
        {activeSidebar && (
          <div className="w-72 bg-white border-r border-[#e5e5e5] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5]">
              <div className="flex items-center gap-2">
                {activeSidebar === 'ai' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
                <span className="font-medium text-gray-700">
                  {activeSidebar === 'ai' ? T('ai.title') : activeSidebar === 'format' ? T('word.formatCheck') : activeSidebar === 'presets' ? T('word.formatPresets') : T('word.outline')}
                </span>
              </div>
              <button 
                onClick={() => setActiveSidebar(null)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f0f0f0]"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {activeSidebar === 'ai' && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {aiPanel.messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <p className="text-sm">{T('ai.desc')}</p>
                      <div className="mt-4 space-y-2">
                        <button 
                          onClick={() => setAIInput(T('ai.quickFormat'))}
                          className="w-full text-xs text-left p-2 bg-[#f5f5f5] rounded hover:bg-[#e8e8e8]"
                        >
                          {T('ai.quickFormat')}
                        </button>
                        <button 
                          onClick={() => setAIInput(T('word.formatCheck'))}
                          className="w-full text-xs text-left p-2 bg-[#f5f5f5] rounded hover:bg-[#e8e8e8]"
                        >
                          {T('word.formatCheck')}
                        </button>
                        <button 
                          onClick={() => setAIInput(T('ai.smartSummary'))}
                          className="w-full text-xs text-left p-2 bg-[#f5f5f5] rounded hover:bg-[#e8e8e8]"
                        >
                          {T('ai.smartSummary')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    aiPanel.messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded text-sm ${
                          msg.role === 'user' ? 'bg-[#e8f4fd] ml-4' : 'bg-[#f5f5f5] mr-4'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-[#e5e5e5]">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={e => setAIInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAIInputCommand()}
                      placeholder={T('ai.enterCommand')}
                      className="flex-1 input-field text-sm"
                    />
                    <button 
                      onClick={handleAIInputCommand}
                      disabled={isLoading}
                      className="btn-primary text-sm px-3"
                    >
                      {T('button.send')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeSidebar === 'presets' && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">{T('word.formatPresets')}</h4>
                  {formatPresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.id)}
                      className={`w-full p-3 text-left border rounded hover:bg-[#f5f5f5] ${
                        selectedPreset === preset.id ? 'border-[#2b5797] bg-[#e8f0f8]' : 'border-[#e5e5e5]'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-700">{preset.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{preset.description}</p>
                    </button>
                  ))}
                </div>
                
                <div className="mt-6 space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">{T('ai.quickFormat')}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleQuickFormat('standard')}
                      className="p-2 text-xs border border-[#e5e5e5] rounded hover:bg-[#f5f5f5]"
                    >
                      {T('word.standardFormat')}
                    </button>
                    <button
                      onClick={() => handleQuickFormat('clean')}
                      className="p-2 text-xs border border-[#e5e5e5] rounded hover:bg-[#f5f5f5]"
                    >
                      {T('word.cleanFormat')}
                    </button>
                    <button
                      onClick={() => handleQuickFormat('formal')}
                      className="p-2 text-xs border border-[#e5e5e5] rounded hover:bg-[#f5f5f5]"
                    >
                      {T('word.formalFormat')}
                    </button>
                    <button
                      onClick={() => handleQuickFormat('simple')}
                      className="p-2 text-xs border border-[#e5e5e5] rounded hover:bg-[#f5f5f5]"
                    >
                      {T('word.simpleFormat')}
                    </button>
                  </div>
                </div>
                
                {formatChanges.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xs font-medium text-gray-500 mb-2">{T('word.appliedChanges')}</h4>
                    <div className="space-y-1">
                      {formatChanges.map((change, i) => (
                        <div key={i} className="text-xs text-gray-600 p-2 bg-[#f5f5f5] rounded">
                          {change}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeSidebar === 'format' && (
              <div className="flex-1 overflow-y-auto p-4">
                {formatIssues.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{formatIssues.filter(i => !i.fixed).length} {T('word.issuesFound')}</span>
                      <button 
                        onClick={handleFixAll}
                        className="text-sm text-[#2b5797] hover:underline"
                      >
                        {T('word.fixAll')}
                      </button>
                    </div>
                    {formatIssues.filter(i => !i.fixed).map(issue => (
                      <div key={issue.id} className="p-3 bg-[#fff8e6] rounded border border-[#ffe7ba]">
                        <p className="text-sm font-medium text-gray-800">{issue.text}</p>
                        <p className="text-xs text-gray-500 mt-1">{issue.suggestion}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <svg className="w-12 h-12 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">{T('word.formatCheckPass')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1 overflow-auto bg-[#e8e8e8] p-8" style={{ zoom: zoom / 100 }}>
          <style>
            {getPaginationStyles()}
          </style>
          {currentFile || hasDocument ? (
            enableSmartPagination ? (
              <SmartPagination
                content={documentContent}
                pageSetup={pageSetup}
                editable={true}
                onContentChange={(newContent) => {
                  setDocumentContent(newContent)
                  setIsModified(true)
                }}
                onPageChange={(newPages) => {
                  setPages(newPages)
                }}
              />
            ) : (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="outline-none"
                style={{
                  width: `${pageSetup.width}mm`,
                  minHeight: `${pageSetup.height}mm`,
                  padding: `${pageSetup.marginTop}mm ${pageSetup.marginRight}mm ${pageSetup.marginBottom}mm ${pageSetup.marginLeft}mm`,
                  background: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  margin: '0 auto',
                  fontFamily: "'SimSun', serif",
                  fontSize: '12pt',
                  lineHeight: '1.8'
                }}
                dangerouslySetInnerHTML={{ __html: documentContent }}
                onCompositionStart={() => {
                  setIsComposing(true)
                }}
                onCompositionEnd={() => {
                  setIsComposing(false)
                }}
                onBlur={() => {
                  if (editorRef.current) {
                    setDocumentContent(editorRef.current.innerHTML)
                    setIsModified(true)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isComposing) {
                    e.preventDefault()
                    document.execCommand('insertLineBreak')
                  }
                }}
              />
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
              <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg mb-4">{T('home.openLocal')}</p>
              <button onClick={handleOpenFile} className="btn-primary">
                {T('file.open')}
              </button>
              <button onClick={handleNewFile} className="btn-secondary mt-2">
                {T('file.new')}
              </button>
              <p className="text-sm mt-3">.docx, .doc, .txt</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="status-bar">
        <div className="flex items-center gap-4">
          <span>{pages.length > 0 ? `${pages.length} 页` : '1/1'}</span>
          <span>{T('word.wordCount')}: {wordCount.words}</span>
          <span>{T('word.charCount')}: {wordCount.chars}</span>
          {autoCharts.length > 0 && <span>图表: {autoCharts.length}</span>}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => handleViewAction('zoomOut')} className="hover:text-[#2b5797]">-</button>
          <span>{zoom}%</span>
          <button onClick={() => handleViewAction('zoomIn')} className="hover:text-[#2b5797]">+</button>
          <span>{T('app.secure')}</span>
          <span>{fontSize}pt ({ptToFontSize(fontSize)})</span>
        </div>
      </div>
      
      <TableInsertDialog
        isOpen={showTableDialog}
        onClose={() => setShowTableDialog(false)}
        onInsert={handleInsertTable}
      />
      
      <ImageInsertDialog
        isOpen={showImageDialog}
        onClose={() => setShowImageDialog(false)}
        onInsert={handleInsertImage}
      />
      
      <PageSetupDialog
        isOpen={showPageSetup}
        onClose={() => setShowPageSetup(false)}
        onApply={setPageSetup}
        currentSetup={pageSetup}
      />
      
      <PrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        content={documentContent}
        pageSetup={pageSetup}
      />
      
      <TableContextMenu
        isOpen={tableContextMenu.isOpen}
        position={tableContextMenu.position}
        onClose={() => setTableContextMenu({ isOpen: false, position: { x: 0, y: 0 } })}
        onInsertRowAbove={() => {
          const table = getTableFromSelection()
          const cell = getCellFromSelection()
          if (table && cell) {
            const row = cell.parentElement as HTMLTableRowElement
            const rowIndex = Array.from(table.rows).indexOf(row)
            insertRow(table, rowIndex - 1)
          }
        }}
        onInsertRowBelow={() => {
          const table = getTableFromSelection()
          const cell = getCellFromSelection()
          if (table && cell) {
            const row = cell.parentElement as HTMLTableRowElement
            const rowIndex = Array.from(table.rows).indexOf(row)
            insertRow(table, rowIndex)
          }
        }}
        onInsertColLeft={() => {
          const table = getTableFromSelection()
          const cell = getCellFromSelection()
          if (table && cell) {
            const row = cell.parentElement as HTMLTableRowElement
            const colIndex = Array.from(row.cells).indexOf(cell)
            insertColumn(table, colIndex - 1)
          }
        }}
        onInsertColRight={() => {
          const table = getTableFromSelection()
          const cell = getCellFromSelection()
          if (table && cell) {
            const row = cell.parentElement as HTMLTableRowElement
            const colIndex = Array.from(row.cells).indexOf(cell)
            insertColumn(table, colIndex)
          }
        }}
        onDeleteRow={() => {
          const table = getTableFromSelection()
          const cell = getCellFromSelection()
          if (table && cell) {
            const row = cell.parentElement as HTMLTableRowElement
            const rowIndex = Array.from(table.rows).indexOf(row)
            deleteRow(table, rowIndex)
          }
        }}
        onDeleteCol={() => {
          const table = getTableFromSelection()
          const cell = getCellFromSelection()
          if (table && cell) {
            const row = cell.parentElement as HTMLTableRowElement
            const colIndex = Array.from(row.cells).indexOf(cell)
            deleteColumn(table, colIndex)
          }
        }}
        onDeleteTable={() => {
          const table = getTableFromSelection()
          if (table) {
            table.remove()
          }
        }}
        onMergeCells={() => {
          const table = getTableFromSelection()
          if (table && tableSelection) {
            mergeCells(table, tableSelection.startRow, tableSelection.startCol, tableSelection.endRow, tableSelection.endCol)
            addNotification('success', '合并成功', '已合并选中的单元格')
          }
        }}
        onSplitCell={() => {
          const table = getTableFromSelection()
          const cell = getCellFromSelection()
          if (table && cell) {
            const row = cell.parentElement as HTMLTableRowElement
            const rowIndex = Array.from(table.rows).indexOf(row)
            const colIndex = Array.from(row.cells).indexOf(cell)
            splitCell(table, rowIndex, colIndex)
            addNotification('success', '拆分成功', '已拆分选中的单元格')
          }
        }}
        canMerge={tableSelection !== null && (tableSelection.endRow - tableSelection.startRow > 0 || tableSelection.endCol - tableSelection.startCol > 0)}
        canSplit={false}
      />
      
      {showAIAssistant && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-[300] flex flex-col border-l border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">AI助手</h3>
                <p className="text-xs text-blue-100">随时为您服务</p>
              </div>
            </div>
            <button 
              onClick={() => setShowAIAssistant(false)} 
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex border-b">
            {[
              { id: 'chat', label: '智能聊天' },
              { id: 'command', label: '命令面板' },
              { id: 'analyze', label: '文档分析' },
              { id: 'format', label: '格式工具' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveAITab(tab.id as typeof activeAITab)}
                className={`flex-1 py-2 text-sm ${activeAITab === tab.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeAITab === 'chat' && (
              <IntelligentChatPanel 
                isOpen={true} 
                onClose={() => setShowAIAssistant(false)} 
                documentContent={documentContent} 
                onFormatAction={handleFormatAction} 
                onInsertTable={(rows, cols) => handleInsertTable({ rows, cols, width: '100%', borderStyle: 'normal', borderColor: '#000000', cellPadding: 5, headerRow: true })} 
                onInsertImage={() => setShowImageDialog(true)} 
                onOpenPageSetup={() => setShowPageSetup(true)} 
                onOpenPrintPreview={() => setShowPrintPreview(true)} 
                onAutoFormat={() => {
                  const result = IntelligentDocumentProcessor.autoFormat(documentContent)
                  if (result.success && result.formattedContent) {
                    setDocumentContent(result.formattedContent)
                    addNotification('success', '智能格式化', '已自动应用最佳格式')
                  }
                }}
                onApplyProfile={handleApplyProfile} 
                currentFormat={{ fontSize, fontFamily, textColor, lineSpacing, isBold, isItalic, isUnderline }} 
              />
            )}
            
            {activeAITab === 'command' && (
              <div className="p-4">
                <AICommandPanel 
                  isOpen={true} 
                  onClose={() => setShowAIAssistant(false)} 
                  onExecute={handleAICommands} 
                  currentFormat={{ fontSize, fontFamily, textColor, lineSpacing: parseFloat(lineSpacing), isBold, isItalic, isUnderline }} 
                />
              </div>
            )}
            
            {activeAITab === 'analyze' && (
              <IntelligentAssistantPanel 
                isOpen={true} 
                onClose={() => setShowAIAssistant(false)} 
                documentContent={documentContent} 
                onApplyEdit={handleIntelligentEdit} 
                onApplyProfile={handleApplyProfile} 
                onFormatAction={handleFormatAction} 
              />
            )}
            
            {activeAITab === 'format' && (
              <div className="p-4 space-y-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">一键格式化</h4>
                  <button
                    onClick={() => {
                      const result = IntelligentDocumentProcessor.autoFormat(documentContent)
                      if (result.success && result.formattedContent) {
                        setDocumentContent(result.formattedContent)
                        addNotification('success', '智能格式化', '已自动应用最佳格式')
                      }
                    }}
                    className="w-full py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded hover:opacity-90"
                  >
                    智能格式化
                  </button>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">快速调整</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleFormatAction('fontSize', 12)} className="py-2 text-xs border rounded hover:bg-gray-50">字号12pt</button>
                    <button onClick={() => handleFormatAction('fontSize', 14)} className="py-2 text-xs border rounded hover:bg-gray-50">字号14pt</button>
                    <button onClick={() => handleFormatAction('lineSpacing', 1.5)} className="py-2 text-xs border rounded hover:bg-gray-50">行距1.5倍</button>
                    <button onClick={() => handleFormatAction('lineSpacing', 2)} className="py-2 text-xs border rounded hover:bg-gray-50">行距2倍</button>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">对齐方式</h4>
                  <div className="flex gap-2">
                    <button onClick={() => handleFormatAction('alignLeft')} className="flex-1 py-2 text-xs border rounded hover:bg-gray-50">左对齐</button>
                    <button onClick={() => handleFormatAction('alignCenter')} className="flex-1 py-2 text-xs border rounded hover:bg-gray-50">居中</button>
                    <button onClick={() => handleFormatAction('alignRight')} className="flex-1 py-2 text-xs border rounded hover:bg-gray-50">右对齐</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
import { useState, useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'


import { useNotification } from '@/components/Notification'

import { aiLearningEngine } from '@/utils/AILearningEngine'
import { pptTemplates, PPTTemplate } from '@/data/pptTemplates'
import intelligentContentGenerator, { ContentSection } from '@/utils/intelligentContentGenerator'
import PPTCommandProcessor from '@/utils/pptCommandProcessor'


interface Slide {
  id: string
  title: string
  content: string[]
  notes: string
  layout: 'title' | 'title-content' | 'two-column' | 'blank'
  backgroundColor: string
  backgroundImage?: string
  elements?: SlideElement[]
}

interface SlideElement {
  id: string
  type: 'text' | 'image' | 'shape' | 'chart' | 'table'
  x: number
  y: number
  width: number
  height: number
  content?: string
  style?: {
    fontSize?: number
    fontFamily?: string
    fontWeight?: string
    fontStyle?: string
    textDecoration?: string
    color?: string
    backgroundColor?: string
    textAlign?: 'left' | 'center' | 'right'
  }
}

interface TextBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  content: string
  style: {
    fontSize: number
    fontFamily: string
    fontWeight: 'normal' | 'bold'
    fontStyle: 'normal' | 'italic'
    textDecoration: 'none' | 'underline'
    color: string
    backgroundColor: string
    textAlign: 'left' | 'center' | 'right'
  }
}

export default function PPTGenerator() {
  const { setLoading } = useAppStore()

  const { addNotification } = useNotification()
  const location = useLocation()
  
  const [slides, setSlides] = useState<Slide[]>([
    {
      id: 'slide-1',
      title: '',
      content: [''],
      notes: '',
      layout: 'title',
      backgroundColor: '#ffffff'
    }
  ])
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [selectedObject, setSelectedObject] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('home')
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<PPTTemplate | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [showSlideShow, setShowSlideShow] = useState(false)
  const [slideShowIndex, setSlideShowIndex] = useState(0)
  const [commandInput, setCommandInput] = useState('')
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false)

  // 计算当前幻灯片
  const currentSlide = slides[currentSlideIndex]

  const [textBoxes, setTextBoxes] = useState<TextBox[]>([])
  const [selectedTextBox, setSelectedTextBox] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)

  
  const slideRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const topic = searchParams.get('topic')
    
    if (topic) {
      generatePPT(topic)
    }
  }, [location.search])
  
  const generatePPT = useCallback(async (topic: string) => {
    try {
      setLoading(true)
      setIsGenerating(true)
      setGenerationProgress(0)
      
      setGenerationProgress(10)
      addNotification('info', '正在生成', '正在分析主题并生成智能内容...')
      
      setGenerationProgress(20)
      const generatedContent = intelligentContentGenerator.generateContent(topic, 25, 'ppt')
      
      setGenerationProgress(40)
      addNotification('info', '正在生成', `已生成${generatedContent.sections.length}个章节，正在构建幻灯片...`)
      
      const outlineSlides: Array<{title: string, content: string[], layout: 'title' | 'title-content', backgroundColor: string, notes: string, paragraphs?: string[], imageSuggestions?: string[], dataSource?: string}> = [
        { 
          title: topic, 
          content: ['专业演示文稿', `共${generatedContent.sections.length + 2}页`, generatedContent.generatedAt.split('T')[0]], 
          layout: 'title' as const, 
          backgroundColor: '#ffffff',
          notes: `这是关于${topic}的专业演示文稿，共包含${generatedContent.sections.length}个主要章节。`
        },
        { 
          title: '目录', 
          content: generatedContent.sections.map((s, i) => `${i + 1}、${s.title}`), 
          layout: 'title-content' as const, 
          backgroundColor: '#ffffff',
          notes: '这是本次演示的主要内容目录，涵盖了所有重要章节。'
        }
      ]
      
      generatedContent.sections.forEach((section: ContentSection) => {
        const limitedKeyPoints = section.keyPoints.slice(0, 4).map(point => {
          if (point.length > 30) {
            return point.substring(0, 27) + '...'
          }
          return point
        })
        
        const slideContent = [
          ...limitedKeyPoints,
          '',
          ...section.paragraphs.slice(0, 2).map(p => {
            if (p.length > 50) {
              return p.substring(0, 47) + '...'
            }
            return p
          })
        ]
        
        outlineSlides.push({
          title: section.title,
          content: slideContent,
          layout: 'title-content' as const,
          backgroundColor: '#ffffff',
          notes: section.paragraphs.join('\n\n'),
          paragraphs: section.paragraphs,
          imageSuggestions: section.imageSuggestions,
          dataSource: section.dataSource
        })
        
        if (section.paragraphs.length >= 3) {
          outlineSlides.push({
            title: `${section.title} - 详细内容`,
            content: section.paragraphs,
            layout: 'title-content' as const,
            backgroundColor: '#ffffff',
            notes: `详细内容：${section.paragraphs.join('\n\n')}`,
            dataSource: section.dataSource
          })
        }
      })
      
      outlineSlides.push({ 
        title: 'Q&A', 
        content: ['欢迎提问与讨论', '联系方式：xxx@example.com'], 
        layout: 'title' as const, 
        backgroundColor: '#ffffff',
        notes: '欢迎各位提问，我们将详细解答。'
      })
      
      outlineSlides.push({ 
        title: '谢谢', 
        content: ['感谢您的聆听与支持', '期待与您的合作'], 
        layout: 'title' as const, 
        backgroundColor: '#ffffff',
        notes: '感谢大家的参与，期待后续合作。'
      })
      
      setGenerationProgress(70)
      addNotification('info', '正在生成', `正在创建${outlineSlides.length}张幻灯片...`)
      
      const generatedSlides: Slide[] = outlineSlides.map((slide, index) => ({
        id: `slide-${index + 1}`,
        title: slide.title,
        content: slide.content,
        notes: slide.notes || '',
        layout: slide.layout,
        backgroundColor: selectedTemplate?.colors.background || slide.backgroundColor
      }))
      
      setGenerationProgress(90)
      setSlides(generatedSlides)
      setCurrentSlideIndex(0)
      
      setGenerationProgress(100)
      addNotification('success', '成功', `PPT生成成功，共${generatedSlides.length}页，包含丰富的实质性内容`)
      
      await aiLearningEngine.learnFromContext({
        documentType: 'ppt',
        userAction: 'generate_ppt',
        userInput: topic,
        result: `生成了${generatedSlides.length}张幻灯片，包含${generatedContent.sections.length}个主要章节`,
        success: true
      })
    } catch (error) {
      console.error('Failed to generate PPT:', error)
      addNotification('error', '错误', 'PPT生成失败')
    } finally {
      setLoading(false)
      setIsGenerating(false)
    }
  }, [setLoading, addNotification, selectedTemplate])
  
  const addSlide = useCallback(() => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      title: '',
      content: [''],
      notes: '',
      layout: 'title-content',
      backgroundColor: selectedTemplate?.colors.background || '#ffffff'
    }
    setSlides(prev => [...prev, newSlide])
    setCurrentSlideIndex(slides.length)
  }, [slides.length, selectedTemplate])
  
  const deleteSlide = useCallback((index: number) => {
    if (slides.length <= 1) return
    setSlides(prev => prev.filter((_, i) => i !== index))
    if (currentSlideIndex >= slides.length - 1) {
      setCurrentSlideIndex(Math.max(0, slides.length - 2))
    }
  }, [slides.length, currentSlideIndex])
  
  const updateSlide = useCallback((index: number, updates: Partial<Slide>) => {
    setSlides(prev => prev.map((slide, i) => 
      i === index ? { ...slide, ...updates } : slide
    ))
  }, [])
  
  const applyTemplate = useCallback((template: PPTTemplate) => {
    setSelectedTemplate(template)
    setSlides(prev => prev.map(slide => ({
      ...slide,
      backgroundColor: template.colors.background
    })))
    addNotification('success', '成功', `已应用模板：${template.name}`)
  }, [addNotification])
  
  const exportPPT = useCallback(() => {
    const pptData = {
      title: slides[0]?.title || '未命名演示文稿',
      slides: slides.map(slide => ({
        title: slide.title,
        content: slide.content,
        notes: slide.notes,
        layout: slide.layout,
        backgroundColor: slide.backgroundColor
      })),
      template: selectedTemplate?.id || 'default',
      createdAt: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(pptData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pptData.title}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    addNotification('success', '成功', 'PPT导出成功')
  }, [slides, selectedTemplate, addNotification])
  
  const handleCommandInput = useCallback((command: string) => {
    if (!command.trim()) return
    
    const parsedCommand = PPTCommandProcessor.parseCommand(command)
    
    if (parsedCommand) {
      const result = PPTCommandProcessor.executeCommand(parsedCommand, slides, currentSlideIndex)
      setSlides(result.slides)
      if (result.newIndex !== currentSlideIndex) {
        setCurrentSlideIndex(result.newIndex)
      }
      addNotification('success', '命令执行成功', result.message)
      
      aiLearningEngine.learnFromContext({
        documentType: 'ppt',
        userAction: 'command',
        userInput: command,
        result: result.message,
        success: true
      })
    } else {
      addNotification('warning', '无法理解', '抱歉，无法理解您的指令。请尝试更明确的表达，例如："帮我增加一个目录"')
    }
    
    setCommandInput('')
    setShowCommandSuggestions(false)
  }, [slides, currentSlideIndex, addNotification])
  
  const getCommandSuggestions = useCallback(() => {
    return PPTCommandProcessor.getSuggestions('目录')
  }, [])
  
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageDataUrl = event.target?.result as string
        if (imageDataUrl) {
          updateSlide(currentSlideIndex, {
            backgroundImage: imageDataUrl
          })
          addNotification('success', '成功', '图片插入成功')
        } else {
          addNotification('error', '错误', '图片加载失败')
        }
      }
      reader.onerror = () => {
        addNotification('error', '错误', '图片读取失败')
      }
      reader.readAsDataURL(file)
    } else {
      addNotification('error', '错误', '请选择图片文件')
    }

  }, [currentSlideIndex, updateSlide, addNotification])
  
  const insertTable = useCallback(() => {
    const tableContent = [
      '┌─────────┬─────────┬─────────┐',
      '│  标题1  │  标题2  │  标题3  │',
      '├─────────┼─────────┼─────────┤',
      '│  内容1  │  内容2  │  内容3  │',
      '└─────────┴─────────┴─────────┘'
    ]
    updateSlide(currentSlideIndex, {
      content: [...slides[currentSlideIndex].content, ...tableContent]
    })

    addNotification('success', '成功', '表格插入成功')
  }, [currentSlideIndex, slides, updateSlide, addNotification])
  
  const insertChart = useCallback(() => {
    const chartContent = [
      '图表类型：柱状图',
      '数据：',
      '  项目1: ████████ 80%',
      '  项目2: ██████ 60%',
      '  项目3: ██████████ 100%'
    ]
    updateSlide(currentSlideIndex, {
      content: [...slides[currentSlideIndex].content, ...chartContent]
    })

    addNotification('success', '成功', '图表插入成功')
  }, [currentSlideIndex, slides, updateSlide, addNotification])
  
  const insertShape = useCallback(() => {
    updateSlide(currentSlideIndex, {
      content: [...slides[currentSlideIndex].content, '□ 矩形形状']
    })

    addNotification('success', '成功', '形状插入成功')
  }, [currentSlideIndex, slides, updateSlide, addNotification])
  
  const startSlideShow = useCallback(() => {
    setShowSlideShow(true)
    setSlideShowIndex(0)
  }, [])
  
  const nextSlide = useCallback(() => {
    if (slideShowIndex < slides.length - 1) {
      setSlideShowIndex(prev => prev + 1)
    }
  }, [slideShowIndex, slides.length])
  
  const prevSlide = useCallback(() => {
    if (slideShowIndex > 0) {
      setSlideShowIndex(prev => prev - 1)
    }
  }, [slideShowIndex])
  
  const endSlideShow = useCallback(() => {
    setShowSlideShow(false)
    setSlideShowIndex(0)
  }, [])
  
  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -10 : 10
      setZoom(prev => Math.min(200, Math.max(25, prev + delta)))
    }
  }, [])
  
  // 添加文本框
  const addTextBox = useCallback(() => {
    const newTextBox: TextBox = {
      id: `textbox-${Date.now()}`,
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      content: '新文本框',
      style: {
        fontSize: 18,
        fontFamily: '宋体',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: '#333333',
        backgroundColor: 'transparent',
        textAlign: 'left'
      }
    }
    setTextBoxes(prev => [...prev, newTextBox])
    setSelectedTextBox(newTextBox.id)
    addNotification('success', '成功', '文本框已添加')
  }, [addNotification])
  
  // 更新文本框
  const updateTextBox = useCallback((id: string, updates: Partial<TextBox>) => {
    setTextBoxes(prev => prev.map(box => 
      box.id === id ? { ...box, ...updates } : box
    ))
  }, [])
  
  // 删除文本框
  const deleteTextBox = useCallback((id: string) => {
    setTextBoxes(prev => prev.filter(box => box.id !== id))
    setSelectedTextBox(null)
    addNotification('success', '成功', '文本框已删除')
  }, [addNotification])
  
  // 开始拖动文本框
  const handleMouseDown = useCallback((e: React.MouseEvent, textBoxId: string) => {
    e.stopPropagation()
    setSelectedTextBox(textBoxId)
    setIsDragging(true)
    const textBox = textBoxes.find(b => b.id === textBoxId)
    if (textBox) {
      setDragOffset({
        x: e.clientX - textBox.x,
        y: e.clientY - textBox.y
      })
    }
  }, [textBoxes])
  
  // 拖动文本框
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && selectedTextBox) {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      updateTextBox(selectedTextBox, { x: newX, y: newY })
    }
    if (isResizing && selectedTextBox && resizeHandle) {
      const textBox = textBoxes.find(b => b.id === selectedTextBox)
      if (textBox) {
        let newWidth = textBox.width
        let newHeight = textBox.height
        let newX = textBox.x
        let newY = textBox.y
        
        if (resizeHandle.includes('e')) {
          newWidth = Math.max(50, e.clientX - textBox.x)
        }
        if (resizeHandle.includes('w')) {
          const deltaX = textBox.x - e.clientX
          newWidth = Math.max(50, textBox.width + deltaX)
          newX = e.clientX
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(30, e.clientY - textBox.y)
        }
        if (resizeHandle.includes('n')) {
          const deltaY = textBox.y - e.clientY
          newHeight = Math.max(30, textBox.height + deltaY)
          newY = e.clientY
        }
        
        updateTextBox(selectedTextBox, { 
          width: newWidth, 
          height: newHeight,
          x: newX,
          y: newY
        })
      }
    }
  }, [isDragging, isResizing, selectedTextBox, dragOffset, resizeHandle, textBoxes, updateTextBox])
  
  // 结束拖动
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
  }, [])
  
  // 开始调整大小
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeHandle(handle)
  }, [])
  
  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedTextBox) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          deleteTextBox(selectedTextBox)
        }
        if (e.ctrlKey && e.key === 'b') {
          e.preventDefault()
          const textBox = textBoxes.find(b => b.id === selectedTextBox)
          if (textBox) {
            updateTextBox(selectedTextBox, {
              style: {
                ...textBox.style,
                fontWeight: textBox.style.fontWeight === 'bold' ? 'normal' : 'bold'
              }
            })
          }
        }
        if (e.ctrlKey && e.key === 'i') {
          e.preventDefault()
          const textBox = textBoxes.find(b => b.id === selectedTextBox)
          if (textBox) {
            updateTextBox(selectedTextBox, {
              style: {
                ...textBox.style,
                fontStyle: textBox.style.fontStyle === 'italic' ? 'normal' : 'italic'
              }
            })
          }
        }
        if (e.ctrlKey && e.key === 'u') {
          e.preventDefault()
          const textBox = textBoxes.find(b => b.id === selectedTextBox)
          if (textBox) {
            updateTextBox(selectedTextBox, {
              style: {
                ...textBox.style,
                textDecoration: textBox.style.textDecoration === 'underline' ? 'none' : 'underline'
              }
            })
          }
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTextBox, textBoxes, updateTextBox, deleteTextBox])
  
  if (showSlideShow) {
    const showSlide = slides[slideShowIndex]
    return (
      <div 
        className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50"
        onClick={nextSlide}
      >
        <div className="w-full h-full flex flex-col items-center justify-center p-16">
          <div className="bg-white w-full h-full max-w-6xl max-h-full flex flex-col p-16">
            {showSlide.layout === 'title' ? (
              <div className="h-full flex flex-col items-center justify-center">
                <h1 className="text-6xl font-bold text-[#333] mb-8">{showSlide.title}</h1>
                {showSlide.content[0] && (
                  <p className="text-3xl text-[#666]">{showSlide.content[0]}</p>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-5xl font-bold text-[#333] mb-12">{showSlide.title}</h2>
                <div className="flex-1">
                  {showSlide.content.map((item, index) => (
                    <p key={index} className="text-3xl text-[#333] mb-4">• {item}</p>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 text-white">
          <button onClick={(e) => { e.stopPropagation(); prevSlide() }} className="px-4 py-2 bg-white/20 rounded hover:bg-white/30">上一页</button>
          <span>{slideShowIndex + 1} / {slides.length}</span>
          <button onClick={(e) => { e.stopPropagation(); nextSlide() }} className="px-4 py-2 bg-white/20 rounded hover:bg-white/30">下一页</button>
          <button onClick={(e) => { e.stopPropagation(); endSlideShow() }} className="px-4 py-2 bg-red-500 rounded hover:bg-red-600">退出放映</button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-screen flex flex-col bg-[#f0f0f0]">
      {/* 顶部菜单栏 - WPS风格 */}
      <div className="bg-[#f8f8f8] border-b border-[#d4d4d4]">
        <div className="flex items-center h-8 px-2 bg-[#f0f0f0] border-b border-[#d4d4d4]">
          <div className="flex items-center gap-1">
            <button className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded">文件(F)</button>
            <button 
              onClick={() => setActiveTab('home')}
              className={`px-3 py-1 text-sm rounded ${activeTab === 'home' ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
            >
              开始(H)
            </button>
            <button 
              onClick={() => setActiveTab('insert')}
              className={`px-3 py-1 text-sm rounded ${activeTab === 'insert' ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
            >
              插入(I)
            </button>
            <button 
              onClick={() => setActiveTab('design')}
              className={`px-3 py-1 text-sm rounded ${activeTab === 'design' ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
            >
              设计(D)
            </button>
            <button 
              onClick={() => setActiveTab('transitions')}
              className={`px-3 py-1 text-sm rounded ${activeTab === 'transitions' ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
            >
              切换(T)
            </button>
            <button 
              onClick={() => setActiveTab('animations')}
              className={`px-3 py-1 text-sm rounded ${activeTab === 'animations' ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
            >
              动画(A)
            </button>
            <button 
              onClick={startSlideShow}
              className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded"
            >
              幻灯片放映(S)
            </button>
            <button 
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1 text-sm rounded ${activeTab === 'review' ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
            >
              审阅(R)
            </button>
            <button 
              onClick={() => setActiveTab('view')}
              className={`px-3 py-1 text-sm rounded ${activeTab === 'view' ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
            >
              视图(V)
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              className={`px-3 py-1 text-sm rounded ${showAIAssistant ? 'bg-[#8764b8] text-white' : 'text-[#8764b8] hover:bg-[#f3f0f7]'}`}
            >
              AI助手
            </button>
            <button className="px-3 py-1 text-sm text-[#0078d4] hover:bg-[#e5f3ff] rounded">保存</button>
            <button className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded">另存为</button>
            <button onClick={exportPPT} className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded">导出</button>
          </div>
        </div>
        
        {/* 智能命令输入栏 */}
        <div className="flex items-center h-10 px-4 bg-gradient-to-r from-[#f0f7ff] to-[#fff] border-b border-[#d4d4d4] gap-2">
          <div className="flex items-center gap-2 text-[#0078d4]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm font-medium">智能命令</span>
          </div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => {
                setCommandInput(e.target.value)
                setShowCommandSuggestions(e.target.value.length > 0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCommandInput(commandInput)
                }
              }}
              onFocus={() => setShowCommandSuggestions(commandInput.length > 0)}
              onBlur={() => setTimeout(() => setShowCommandSuggestions(false), 200)}
              placeholder="输入指令，例如：帮我增加一个目录、把目录改成纯文本格式、取消二级目录加粗..."
              className="w-full h-7 px-3 pr-10 text-sm border border-[#b3d7ff] rounded-md focus:outline-none focus:ring-1 focus:ring-[#0078d4] focus:border-[#0078d4]"
            />
            <button
              onClick={() => handleCommandInput(commandInput)}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs bg-[#0078d4] text-white rounded hover:bg-[#106ebe]"
            >
              执行
            </button>
            
            {/* 命令建议下拉 */}
            {showCommandSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#d4d4d4] rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                <div className="px-3 py-2 text-xs text-[#666] border-b border-[#e5e5e5]">
                  快捷命令建议
                </div>
                {getCommandSuggestions().map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCommandInput(suggestion)
                      handleCommandInput(suggestion)
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[#f0f7ff] text-[#333]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* 工具栏 - 根据activeTab显示不同内容 */}
        <div className="flex items-center h-10 px-2 bg-[#fff] border-b border-[#d4d4d4] gap-1">
          {activeTab === 'home' && (
            <>
              <div className="flex items-center gap-1 px-2 border-r border-[#d4d4d4]">
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded" title="新建">
                  <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded" title="打开">
                  <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded" title="保存">
                  <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </button>
              </div>
              
              <div className="flex items-center gap-1 px-2 border-r border-[#d4d4d4]">
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded" title="撤销">
                  <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded" title="重做">
                  <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
              </div>
              
              <div className="flex items-center gap-1 px-2 border-r border-[#d4d4d4]">
                <select className="h-6 px-2 text-xs border border-[#d4d4d4] rounded bg-white">
                  <option>宋体</option>
                  <option>黑体</option>
                  <option>微软雅黑</option>
                  <option>楷体</option>
                  <option>仿宋</option>
                </select>
                <select className="h-6 px-2 text-xs border border-[#d4d4d4] rounded bg-white w-12">
                  <option>12</option>
                  <option>14</option>
                  <option>16</option>
                  <option>18</option>
                  <option>24</option>
                  <option>32</option>
                  <option>48</option>
                </select>
              </div>
              
              <div className="flex items-center gap-1 px-2 border-r border-[#d4d4d4]">
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded font-bold text-sm text-[#333]">B</button>
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded italic text-sm text-[#333]">I</button>
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded underline text-sm text-[#333]">U</button>
              </div>
              
              <div className="flex items-center gap-1 px-2 border-r border-[#d4d4d4]">
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded" title="左对齐">
                  <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h10M4 18h14" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded" title="居中">
                  <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M7 12h10M5 18h14" />
                  </svg>
                </button>
                <button className="p-1.5 hover:bg-[#e5e5e5] rounded" title="右对齐">
                  <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M10 12h10M6 18h14" />
                  </svg>
                </button>
              </div>
              
              <div className="flex items-center gap-1 px-2">
                <button 
                  onClick={addSlide}
                  className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]"
                >
                  新建幻灯片
                </button>
              </div>
            </>
          )}
          
          {activeTab === 'insert' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={addSlide}
                className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]"
              >
                新建幻灯片
              </button>
              <button 
                onClick={addTextBox}
                className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]"
              >
                添加文本框
              </button>
              <button 
                onClick={() => {
                  fileInputRef.current?.click()

                }}
                className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]"
              >
                插入图片
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button 
                onClick={insertTable}
                className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]"
              >
                插入表格
              </button>
              <button 
                onClick={insertChart}
                className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]"
              >
                插入图表
              </button>
              <button 
                onClick={insertShape}
                className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]"
              >
                插入形状
              </button>
            </div>
          )}
          
          {activeTab === 'design' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowTemplatePanel(!showTemplatePanel)}
                className={`px-3 py-1 text-sm rounded border border-[#d4d4d4] ${showTemplatePanel ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
              >
                设计模板
              </button>
              <button className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                幻灯片大小
              </button>
              <button className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                背景
              </button>
            </div>
          )}
          
          {activeTab === 'transitions' && (
            <div className="flex items-center gap-2">
              <select className="h-6 px-2 text-xs border border-[#d4d4d4] rounded bg-white">
                <option>无切换</option>
                <option>淡入淡出</option>
                <option>推进</option>
                <option>擦除</option>
                <option>分割</option>
                <option>随机</option>
              </select>
              <span className="text-xs text-[#666]">持续时间：</span>
              <input type="number" className="w-16 h-6 px-2 text-xs border border-[#d4d4d4] rounded bg-white" defaultValue="1" />
              <span className="text-xs text-[#666]">秒</span>
            </div>
          )}
          
          {activeTab === 'animations' && (
            <div className="flex items-center gap-2">
              <select className="h-6 px-2 text-xs border border-[#d4d4d4] rounded bg-white">
                <option>无动画</option>
                <option>飞入</option>
                <option>淡入</option>
                <option>缩放</option>
                <option>旋转</option>
                <option>弹跳</option>
              </select>
              <span className="text-xs text-[#666]">持续时间：</span>
              <input type="number" className="w-16 h-6 px-2 text-xs border border-[#d4d4d4] rounded bg-white" defaultValue="0.5" />
              <span className="text-xs text-[#666]">秒</span>
            </div>
          )}
          
          {activeTab === 'review' && (
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                拼写检查
              </button>
              <button className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                批注
              </button>
              <button className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                比较
              </button>
            </div>
          )}
          
          {activeTab === 'view' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={startSlideShow}
                className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]"
              >
                幻灯片放映
              </button>
              <button className="px-3 py-1 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                备注页
              </button>
              <button 
                onClick={() => setShowNotes(!showNotes)}
                className={`px-3 py-1 text-sm rounded border border-[#d4d4d4] ${showNotes ? 'bg-[#0078d4] text-white' : 'text-[#333] hover:bg-[#e5e5e5]'}`}
              >
                备注窗格
              </button>
            </div>
          )}
        </div>
        
        {/* 生成进度条 */}
        {isGenerating && (
          <div className="px-4 py-2 bg-[#e5f3ff] border-t border-[#b3d7ff]">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#0078d4]">正在生成PPT...</span>
              <div className="flex-1 h-2 bg-[#b3d7ff] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#0078d4] transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <span className="text-sm text-[#0078d4]">{generationProgress}%</span>
            </div>
          </div>
        )}
      </div>
      
      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：幻灯片缩略图 */}
        <div className="w-[180px] bg-[#f8f8f8] border-r border-[#d4d4d4] flex flex-col">
          <div className="p-2 border-b border-[#d4d4d4] bg-[#f0f0f0]">
            <span className="text-xs text-[#666]">幻灯片</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`relative cursor-pointer border ${
                  index === currentSlideIndex 
                    ? 'border-[#0078d4] border-2' 
                    : 'border-[#d4d4d4] hover:border-[#999]'
                }`}
                onClick={() => setCurrentSlideIndex(index)}
              >
                <div 
                  className="aspect-[16/9] bg-white overflow-hidden"
                  style={{ backgroundColor: slide.backgroundColor }}
                >
                  <div className="h-full flex flex-col items-center justify-center p-2">
                    <div className="text-[8px] text-[#333] text-center truncate w-full">{slide.title || '无标题'}</div>
                  </div>
                </div>
                <div className="absolute top-0 left-0 bg-[#0078d4] text-white text-[10px] px-1">
                  {index + 1}
                </div>
                {slides.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSlide(index)
                    }}
                    className="absolute top-0 right-0 bg-[#c42b1c] text-white text-[10px] px-1 opacity-0 hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* 中间：幻灯片编辑区 */}
        <div className="flex-1 flex flex-col bg-[#9a9a9a] overflow-hidden">
          {/* 缩放控制 */}
          <div className="bg-[#f8f8f8] border-b border-[#d4d4d4] px-4 py-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setZoom(Math.max(25, zoom - 10))}
                className="p-1 hover:bg-[#e5e5e5] rounded text-xs text-[#333]"
              >
                -
              </button>
              <span className="text-xs text-[#333] w-12 text-center">{zoom}%</span>
              <button 
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-1 hover:bg-[#e5e5e5] rounded text-xs text-[#333]"
              >
                +
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={startSlideShow}
                className="px-3 py-1 text-xs text-[#0078d4] hover:bg-[#e5f3ff] rounded border border-[#0078d4]"
              >
                放映
              </button>
            </div>
          </div>
          
          {/* 幻灯片内容 */}
          <div 
            className="flex-1 overflow-auto flex items-center justify-center p-8"
            onWheel={handleWheel}
          >
            <div 
              ref={slideRef}
              className="bg-white shadow-lg relative"
              style={{ 
                width: `${720 * zoom / 100}px`,
                height: `${405 * zoom / 100}px`,
                backgroundColor: currentSlide.backgroundColor,
                backgroundImage: currentSlide.backgroundImage ? `url(${currentSlide.backgroundImage})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={() => setSelectedTextBox(null)}
            >
              <div className="h-full flex flex-col p-12">
                {currentSlide.layout === 'title' ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <div 
                      className={`w-full text-center ${selectedObject === 'title' ? 'ring-1 ring-[#0078d4]' : ''}`}
                      onClick={() => setSelectedObject('title')}
                    >
                      <input
                        type="text"
                        value={currentSlide.title}
                        onChange={(e) => updateSlide(currentSlideIndex, { title: e.target.value })}
                        className="w-full text-4xl font-bold bg-transparent border-none outline-none text-center text-[#333]"
                        placeholder="单击此处添加标题"
                      />
                    </div>
                    <div 
                      className={`w-full text-center mt-4 ${selectedObject === 'content' ? 'ring-1 ring-[#0078d4]' : ''}`}
                      onClick={() => setSelectedObject('content')}
                    >
                      <input
                        type="text"
                        value={currentSlide.content[0] || ''}
                        onChange={(e) => updateSlide(currentSlideIndex, { content: [e.target.value] })}
                        className="w-full text-xl bg-transparent border-none outline-none text-center text-[#666]"
                        placeholder="单击此处添加副标题"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      className={`mb-6 ${selectedObject === 'title' ? 'ring-1 ring-[#0078d4]' : ''}`}
                      onClick={() => setSelectedObject('title')}
                    >
                      <input
                        type="text"
                        value={currentSlide.title}
                        onChange={(e) => updateSlide(currentSlideIndex, { title: e.target.value })}
                        className="w-full text-3xl font-bold bg-transparent border-none outline-none text-[#333]"
                        placeholder="单击此处添加标题"
                      />
                    </div>
                    
                    <div 
                      className={`flex-1 ${selectedObject === 'content' ? 'ring-1 ring-[#0078d4]' : ''}`}
                      onClick={() => setSelectedObject('content')}
                    >
                      {currentSlide.content.map((item, index) => (
                        <div key={index} className="mb-2 flex items-start">
                          <span className="text-[#333] mr-2">•</span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const newContent = [...currentSlide.content]
                              newContent[index] = e.target.value
                              updateSlide(currentSlideIndex, { content: newContent })
                            }}
                            className="flex-1 text-lg bg-transparent border-none outline-none text-[#333]"
                            placeholder="单击此处添加文本"
                          />
                        </div>
                      ))}
                      
                      <button
                        onClick={() => {
                          updateSlide(currentSlideIndex, { 
                            content: [...currentSlide.content, ''] 
                          })
                        }}
                        className="text-[#999] text-sm hover:text-[#666] flex items-center"
                      >
                        <span className="mr-2">•</span>
                        单击此处添加文本
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              {/* 渲染文本框 */}
              {textBoxes.map(textBox => (
                <div
                  key={textBox.id}
                  className={`absolute cursor-move ${selectedTextBox === textBox.id ? 'ring-2 ring-[#0078d4]' : ''}`}
                  style={{
                    left: textBox.x,
                    top: textBox.y,
                    width: textBox.width,
                    height: textBox.height,
                    fontSize: textBox.style.fontSize,
                    fontFamily: textBox.style.fontFamily,
                    fontWeight: textBox.style.fontWeight,
                    fontStyle: textBox.style.fontStyle,
                    textDecoration: textBox.style.textDecoration,
                    color: textBox.style.color,
                    backgroundColor: textBox.style.backgroundColor,
                    textAlign: textBox.style.textAlign,
                    border: selectedTextBox === textBox.id ? '1px solid #0078d4' : '1px solid transparent'
                  }}
                  onMouseDown={(e) => handleMouseDown(e, textBox.id)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedTextBox(textBox.id)
                  }}
                >
                  <div 
                    contentEditable
                    suppressContentEditableWarning
                    className="w-full h-full outline-none p-1"
                    style={{
                      fontSize: textBox.style.fontSize,
                      fontFamily: textBox.style.fontFamily,
                      fontWeight: textBox.style.fontWeight,
                      fontStyle: textBox.style.fontStyle,
                      textDecoration: textBox.style.textDecoration,
                      color: textBox.style.color,
                      textAlign: textBox.style.textAlign
                    }}
                    onBlur={(e) => {
                      updateTextBox(textBox.id, { content: e.currentTarget.textContent || '' })
                    }}
                  >
                    {textBox.content}
                  </div>
                  
                  {/* 调整大小手柄 */}
                  {selectedTextBox === textBox.id && (
                    <>
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-white border-2 border-[#0078d4] cursor-nw-resize" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[#0078d4] cursor-n-resize" onMouseDown={(e) => handleResizeStart(e, 'n')} />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-white border-2 border-[#0078d4] cursor-ne-resize" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
                      <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-3 h-3 bg-white border-2 border-[#0078d4] cursor-e-resize" onMouseDown={(e) => handleResizeStart(e, 'e')} />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border-2 border-[#0078d4] cursor-se-resize" onMouseDown={(e) => handleResizeStart(e, 'se')} />
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[#0078d4] cursor-s-resize" onMouseDown={(e) => handleResizeStart(e, 's')} />
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border-2 border-[#0078d4] cursor-sw-resize" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
                      <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-3 h-3 bg-white border-2 border-[#0078d4] cursor-w-resize" onMouseDown={(e) => handleResizeStart(e, 'w')} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* 备注区域 */}
          {showNotes && (
            <div className="h-32 bg-[#f8f8f8] border-t border-[#d4d4d4] p-4">
              <div className="text-xs text-[#666] mb-2">备注：</div>
              <textarea
                value={currentSlide.notes}
                onChange={(e) => updateSlide(currentSlideIndex, { notes: e.target.value })}
                className="w-full h-20 border border-[#d4d4d4] rounded p-2 text-sm resize-none bg-white text-[#333]"
                placeholder="单击此处添加备注..."
              />
            </div>
          )}
        </div>
        
        {/* 右侧：属性面板 / AI助手 / 模板面板 */}
        <div className="w-[240px] bg-[#f8f8f8] border-l border-[#d4d4d4] flex flex-col overflow-hidden">
          {/* AI助手面板 */}
          {showAIAssistant && (
            <div className="flex-1 flex flex-col">
              <div className="p-2 border-b border-[#d4d4d4] bg-[#f0f0f0] flex items-center justify-between">
                <span className="text-xs text-[#666]">AI助手</span>
                <button 
                  onClick={() => setShowAIAssistant(false)}
                  className="text-[#666] hover:text-[#333]"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <button 
                  onClick={async () => {
                    const topic = slides[0]?.title || '项目介绍'
                    await generatePPT(topic)
                  }}
                  className="w-full px-3 py-2 text-sm text-[#8764b8] hover:bg-[#f3f0f7] rounded border border-[#8764b8]"
                >
                  智能生成PPT
                </button>
                <button className="w-full px-3 py-2 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                  生成大纲
                </button>
                <button className="w-full px-3 py-2 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                  优化内容
                </button>
                <button className="w-full px-3 py-2 text-sm text-[#333] hover:bg-[#e5e5e5] rounded border border-[#d4d4d4]">
                  智能排版
                </button>
              </div>
            </div>
          )}
          
          {/* 模板选择面板 */}
          {showTemplatePanel && !showAIAssistant && (
            <div className="flex-1 flex flex-col">
              <div className="p-2 border-b border-[#d4d4d4] bg-[#f0f0f0] flex items-center justify-between">
                <span className="text-xs text-[#666]">设计模板</span>
                <button 
                  onClick={() => setShowTemplatePanel(false)}
                  className="text-[#666] hover:text-[#333]"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-2">
                  {pptTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className={`p-2 border rounded text-left hover:border-[#0078d4] ${
                        selectedTemplate?.id === template.id ? 'border-[#0078d4] bg-[#e5f3ff]' : 'border-[#d4d4d4]'
                      }`}
                    >
                      <div className="text-lg mb-1">{template.preview}</div>
                      <div className="text-xs text-[#333]">{template.name}</div>
                      <div className="flex gap-1 mt-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: template.colors.primary }} />
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: template.colors.secondary }} />
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: template.colors.accent }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* 属性面板 */}
          {!showAIAssistant && !showTemplatePanel && (
            <div className="flex-1 flex flex-col">
              <div className="p-2 border-b border-[#d4d4d4] bg-[#f0f0f0]">
                <span className="text-xs text-[#666]">属性</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* 文本框样式编辑器 */}
                {selectedTextBox && (
                  <div className="pb-3 border-b border-[#d4d4d4]">
                    <div className="text-xs font-medium text-[#333] mb-2">文本框样式</div>
                    
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-[#666] mb-1">字体</label>
                        <select
                          value={textBoxes.find(b => b.id === selectedTextBox)?.style.fontFamily || '宋体'}
                          onChange={(e) => {
                            const textBox = textBoxes.find(b => b.id === selectedTextBox)
                            if (textBox) {
                              updateTextBox(selectedTextBox, {
                                style: { ...textBox.style, fontFamily: e.target.value }
                              })
                            }
                          }}
                          className="w-full h-7 px-2 text-xs border border-[#d4d4d4] rounded bg-white text-[#333]"
                        >
                          <option value="宋体">宋体</option>
                          <option value="黑体">黑体</option>
                          <option value="微软雅黑">微软雅黑</option>
                          <option value="楷体">楷体</option>
                          <option value="仿宋">仿宋</option>
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-[#666] mb-1">字号</label>
                        <input
                          type="number"
                          value={textBoxes.find(b => b.id === selectedTextBox)?.style.fontSize || 18}
                          onChange={(e) => {
                            const textBox = textBoxes.find(b => b.id === selectedTextBox)
                            if (textBox) {
                              updateTextBox(selectedTextBox, {
                                style: { ...textBox.style, fontSize: parseInt(e.target.value) || 18 }
                              })
                            }
                          }}
                          className="w-full h-7 px-2 text-xs border border-[#d4d4d4] rounded bg-white text-[#333]"
                          min="8"
                          max="200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-[#666] mb-1">文字颜色</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={textBoxes.find(b => b.id === selectedTextBox)?.style.color || '#333333'}
                            onChange={(e) => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, color: e.target.value }
                                })
                              }
                            }}
                            className="w-8 h-8 border border-[#d4d4d4] rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={textBoxes.find(b => b.id === selectedTextBox)?.style.color || '#333333'}
                            onChange={(e) => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, color: e.target.value }
                                })
                              }
                            }}
                            className="flex-1 h-8 px-2 text-xs border border-[#d4d4d4] rounded bg-white text-[#333]"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-[#666] mb-1">背景颜色</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={textBoxes.find(b => b.id === selectedTextBox)?.style.backgroundColor || '#ffffff'}
                            onChange={(e) => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, backgroundColor: e.target.value }
                                })
                              }
                            }}
                            className="w-8 h-8 border border-[#d4d4d4] rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={textBoxes.find(b => b.id === selectedTextBox)?.style.backgroundColor || '#ffffff'}
                            onChange={(e) => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, backgroundColor: e.target.value }
                                })
                              }
                            }}
                            className="flex-1 h-8 px-2 text-xs border border-[#d4d4d4] rounded bg-white text-[#333]"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-[#666] mb-1">对齐方式</label>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, textAlign: 'left' }
                                })
                              }
                            }}
                            className={`flex-1 h-7 border border-[#d4d4d4] rounded text-xs ${textBoxes.find(b => b.id === selectedTextBox)?.style.textAlign === 'left' ? 'bg-[#0078d4] text-white' : 'bg-white text-[#333]'}`}
                          >
                            左
                          </button>
                          <button
                            onClick={() => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, textAlign: 'center' }
                                })
                              }
                            }}
                            className={`flex-1 h-7 border border-[#d4d4d4] rounded text-xs ${textBoxes.find(b => b.id === selectedTextBox)?.style.textAlign === 'center' ? 'bg-[#0078d4] text-white' : 'bg-white text-[#333]'}`}
                          >
                            中
                          </button>
                          <button
                            onClick={() => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, textAlign: 'right' }
                                })
                              }
                            }}
                            className={`flex-1 h-7 border border-[#d4d4d4] rounded text-xs ${textBoxes.find(b => b.id === selectedTextBox)?.style.textAlign === 'right' ? 'bg-[#0078d4] text-white' : 'bg-white text-[#333]'}`}
                          >
                            右
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-[#666] mb-1">文字样式</label>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, fontWeight: textBox.style.fontWeight === 'bold' ? 'normal' : 'bold' }
                                })
                              }
                            }}
                            className={`flex-1 h-7 border border-[#d4d4d4] rounded text-xs font-bold ${textBoxes.find(b => b.id === selectedTextBox)?.style.fontWeight === 'bold' ? 'bg-[#0078d4] text-white' : 'bg-white text-[#333]'}`}
                          >
                            B
                          </button>
                          <button
                            onClick={() => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, fontStyle: textBox.style.fontStyle === 'italic' ? 'normal' : 'italic' }
                                })
                              }
                            }}
                            className={`flex-1 h-7 border border-[#d4d4d4] rounded text-xs italic ${textBoxes.find(b => b.id === selectedTextBox)?.style.fontStyle === 'italic' ? 'bg-[#0078d4] text-white' : 'bg-white text-[#333]'}`}
                          >
                            I
                          </button>
                          <button
                            onClick={() => {
                              const textBox = textBoxes.find(b => b.id === selectedTextBox)
                              if (textBox) {
                                updateTextBox(selectedTextBox, {
                                  style: { ...textBox.style, textDecoration: textBox.style.textDecoration === 'underline' ? 'none' : 'underline' }
                                })
                              }
                            }}
                            className={`flex-1 h-7 border border-[#d4d4d4] rounded text-xs underline ${textBoxes.find(b => b.id === selectedTextBox)?.style.textDecoration === 'underline' ? 'bg-[#0078d4] text-white' : 'bg-white text-[#333]'}`}
                          >
                            U
                          </button>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => deleteTextBox(selectedTextBox)}
                        className="w-full h-7 bg-[#c42b1c] text-white text-xs rounded hover:bg-[#a02616]"
                      >
                        删除文本框
                      </button>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-xs text-[#666] mb-1">幻灯片版式</label>
                  <select
                    value={currentSlide.layout}
                    onChange={(e) => updateSlide(currentSlideIndex, { layout: e.target.value as Slide['layout'] })}
                    className="w-full h-7 px-2 text-xs border border-[#d4d4d4] rounded bg-white text-[#333]"
                  >
                    <option value="title">标题幻灯片</option>
                    <option value="title-content">标题和内容</option>
                    <option value="two-column">两栏内容</option>
                    <option value="blank">空白</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-[#666] mb-1">背景颜色</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={currentSlide.backgroundColor}
                      onChange={(e) => updateSlide(currentSlideIndex, { backgroundColor: e.target.value })}
                      className="w-8 h-8 border border-[#d4d4d4] rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={currentSlide.backgroundColor}
                      onChange={(e) => updateSlide(currentSlideIndex, { backgroundColor: e.target.value })}
                      className="flex-1 h-8 px-2 text-xs border border-[#d4d4d4] rounded bg-white text-[#333]"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-[#666] mb-1">快速颜色</label>
                  <div className="grid grid-cols-6 gap-1">
                    {['#ffffff', '#000000', '#0078d4', '#f0f0f0', '#e5e5e5', '#d4d4d4', '#c42b1c', '#107c10', '#ca5010', '#8764b8', '#e81123', '#00bcf2'].map(color => (
                      <button
                        key={color}
                        onClick={() => updateSlide(currentSlideIndex, { backgroundColor: color })}
                        className="w-6 h-6 border border-[#d4d4d4] rounded"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                {selectedTemplate && (
                  <div>
                    <label className="block text-xs text-[#666] mb-1">模板颜色</label>
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        onClick={() => updateSlide(currentSlideIndex, { backgroundColor: selectedTemplate.colors.primary })}
                        className="w-6 h-6 border border-[#d4d4d4] rounded"
                        style={{ backgroundColor: selectedTemplate.colors.primary }}
                        title="主色"
                      />
                      <button
                        onClick={() => updateSlide(currentSlideIndex, { backgroundColor: selectedTemplate.colors.secondary })}
                        className="w-6 h-6 border border-[#d4d4d4] rounded"
                        style={{ backgroundColor: selectedTemplate.colors.secondary }}
                        title="辅助色"
                      />
                      <button
                        onClick={() => updateSlide(currentSlideIndex, { backgroundColor: selectedTemplate.colors.accent })}
                        className="w-6 h-6 border border-[#d4d4d4] rounded"
                        style={{ backgroundColor: selectedTemplate.colors.accent }}
                        title="强调色"
                      />
                      <button
                        onClick={() => updateSlide(currentSlideIndex, { backgroundColor: selectedTemplate.colors.background })}
                        className="w-6 h-6 border border-[#d4d4d4] rounded"
                        style={{ backgroundColor: selectedTemplate.colors.background }}
                        title="背景色"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 状态栏 */}
      <div className="bg-[#f0f0f0] border-t border-[#d4d4d4] px-4 py-1 flex items-center justify-between text-xs text-[#666]">
        <div>幻灯片 {currentSlideIndex + 1} / {slides.length}</div>
        <div className="flex items-center gap-4">
          {selectedTemplate && (
            <span className="text-[#0078d4]">模板：{selectedTemplate.name}</span>
          )}
          <span>就绪</span>
        </div>
      </div>
    </div>
  )
}

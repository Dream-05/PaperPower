import { useState, useCallback, useRef } from 'react'
// Icons will be rendered as SVG directly
import { intelligentEngine } from '@/utils/localAI/IntelligentEngine'
import { aiLearningEngine } from '@/utils/AILearningEngine'
import { aiImageManager } from '@/utils/AIImageManager'

export interface PPTAIAction {
  type: 'generate_content' | 'search_template' | 'add_image' | 'auto_layout' | 'generate_outline'
  params: Record<string, any>
}

interface PPTAIAssistantProps {
  onAction: (action: PPTAIAction) => void
  isOpen: boolean
  onClose: () => void
}

interface TemplateResult {
  id: string
  title: string
  thumbnail: string
  style: string
  slides: number
}

interface ImageElement {
  id: string
  url: string
  caption: string
  selected: boolean
}

export function PPTAIAssistant({ onAction, isOpen, onClose }: PPTAIAssistantProps) {
  const [userInput, setUserInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [searchResults, setSearchResults] = useState<TemplateResult[]>([])
  const [imageElements, setImageElements] = useState<ImageElement[]>([])
  const [activeTab, setActiveTab] = useState<'content' | 'template' | 'images'>('content')
  const [outline, setOutline] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGenerateOutline = useCallback(async () => {
    if (!userInput.trim()) return

    setIsThinking(true)
    const response = intelligentEngine.think(`为 PPT 生成大纲：${userInput}`)
    
    const outlineSlides = [
      `封面：${userInput}`,
      '目录',
      '项目背景与目标',
      '技术方案与实现',
      '创新亮点与优势',
      '实施计划与时间表',
      '预期成果与价值',
      '总结与展望'
    ]
    
    setOutline(outlineSlides)
    if (response.message) setGeneratedContent(response.message)
    
    await aiLearningEngine.learnFromContext({
      documentType: 'ppt',
      userAction: 'generate_outline',
      userInput,
      result: outlineSlides.join('\n'),
      success: true
    })

    onAction({ 
      type: 'generate_outline', 
      params: { outline: outlineSlides, prompt: userInput } 
    })
    
    setIsThinking(false)
  }, [userInput, onAction])

  const handleGenerateContent = useCallback(async () => {
    if (!userInput.trim()) return

    setIsThinking(true)
    const response = intelligentEngine.think(`生成 PPT 内容：${userInput}`)
    
    const content = response.message || `关于"${userInput}"的详细内容...\n\n核心要点：\n1. 市场分析与需求\n2. 技术实现方案\n3. 商业模式创新\n4. 团队建设与管理\n5. 财务预测与融资\n\n建议配合图表、数据和案例进行展示。`
    
    setGeneratedContent(content)
    
    await aiLearningEngine.learnFromContext({
      documentType: 'ppt',
      userAction: 'generate_content',
      userInput,
      result: content,
      success: true
    })

    onAction({ 
      type: 'generate_content', 
      params: { content, prompt: userInput } 
    })
    
    setIsThinking(false)
  }, [userInput, onAction])

  const handleSearchTemplate = useCallback(async () => {
    if (!userInput.trim()) return

    setIsThinking(true)
    intelligentEngine.think(`搜索 PPT 模板：${userInput}`)
    
    const styles = ['科技风', '商务风', '简约风', '创意风', '学术风', '中国风']
    const matchedStyle = styles.find(s => userInput.includes(s)) || '商务风'
    
    const templates: TemplateResult[] = [
      {
        id: 'tpl_1',
        title: `${matchedStyle}项目介绍模板`,
        thumbnail: 'https://via.placeholder.com/300x200/6366f1/ffffff?text=Template+1',
        style: matchedStyle,
        slides: 12
      },
      {
        id: 'tpl_2',
        title: `${matchedStyle}商业计划书`,
        thumbnail: 'https://via.placeholder.com/300x200/8b5cf6/ffffff?text=Template+2',
        style: matchedStyle,
        slides: 15
      },
      {
        id: 'tpl_3',
        title: `${matchedStyle}产品展示模板`,
        thumbnail: 'https://via.placeholder.com/300x200/a855f7/ffffff?text=Template+3',
        style: matchedStyle,
        slides: 10
      }
    ]
    
    setSearchResults(templates)
    
    await aiLearningEngine.learnFromContext({
      documentType: 'ppt',
      userAction: 'search_template',
      userInput,
      result: `搜索到${templates.length}个${matchedStyle}模板`,
      success: true
    })

    onAction({ 
      type: 'search_template', 
      params: { templates, prompt: userInput } 
    })
    
    setIsThinking(false)
  }, [userInput, onAction])

  const handleAddImage = useCallback(async (imageUrl: string, caption: string = '') => {
    const newImage: ImageElement = {
      id: `img_${Date.now()}`,
      url: imageUrl,
      caption: caption || '图片说明',
      selected: true
    }
    
    setImageElements(prev => [...prev, newImage])
    
    await aiImageManager.saveImage({
      id: newImage.id,
      url: imageUrl,
      tags: ['ppt', 'element'],
      category: 'upload',
      width: 800,
      height: 600,
      usageCount: 1,
      createdAt: Date.now()
    })

    onAction({ 
      type: 'add_image', 
      params: { image: newImage } 
    })
  }, [onAction])

  const handleRemoveImage = useCallback((imageId: string) => {
    setImageElements(prev => prev.filter(img => img.id !== imageId))
  }, [])

  const handleUploadImage = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      handleAddImage(result, file.name)
    }
    reader.readAsDataURL(file)
  }, [handleAddImage])

  const handleAutoLayout = useCallback(async () => {
    setIsThinking(true)
    intelligentEngine.think('自动排版 PPT')
    
    const layoutSuggestions = {
      titleSlide: '封面页：标题居中，副标题下方，背景使用渐变',
      contentSlide: '内容页：左图右文，标题顶部，正文使用项目符号',
      chartSlide: '图表页：图表居中，标题顶部，说明文字底部',
      endingSlide: '结束页：感谢语居中，联系方式底部'
    }
    
    await aiLearningEngine.learnFromContext({
      documentType: 'ppt',
      userAction: 'auto_layout',
      userInput: '自动排版',
      result: JSON.stringify(layoutSuggestions),
      success: true
    })

    onAction({ 
      type: 'auto_layout', 
      params: { suggestions: layoutSuggestions } 
    })
    
    setIsThinking(false)
  }, [onAction])

  const quickPrompts = [
    '科技风项目介绍 PPT',
    '商业计划书模板',
    '学术答辩 PPT',
    '产品发布会演示',
    '年度总结报告'
  ]

  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">PPT AI 助手</h3>
        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 p-4 border-b bg-gray-50">
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'content'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          文案生成
        </button>
        <button
          onClick={() => setActiveTab('template')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'template'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
          模板搜索
        </button>
        <button
          onClick={() => setActiveTab('images')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'images'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          图片元素
        </button>
      </div>

      <div className="p-4 max-h-[500px] overflow-y-auto">
        {activeTab === 'content' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PPT 主题描述
              </label>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="描述您的 PPT 主题，例如：科技风项目介绍、商业计划书、学术答辩..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleGenerateOutline}
                disabled={isThinking || !userInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {isThinking ? '思考中...' : '生成大纲'}
              </button>
              <button
                onClick={handleGenerateContent}
                disabled={isThinking || !userInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                {isThinking ? '思考中...' : '生成内容'}
              </button>
            </div>

            {outline.length > 0 && (
              <div className="border rounded-lg p-3 bg-purple-50">
                <h4 className="font-medium text-purple-900 mb-2">PPT 大纲</h4>
                <ul className="space-y-1">
                  {outline.map((slide, index) => (
                    <li key={index} className="text-sm text-purple-800 flex items-start gap-2">
                      <span className="text-purple-500 font-medium">{index + 1}.</span>
                      <span>{slide}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {generatedContent && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-2">生成的内容</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{generatedContent}</p>
              </div>
            )}

            <div className="border-t pt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">常用提示词</h4>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setUserInput(prompt)}
                    className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'template' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                搜索模板风格
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="输入模板风格，例如：科技风、商务风、简约风..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleSearchTemplate}
                  disabled={isThinking || !userInput.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  搜索
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      onAction({ 
                        type: 'search_template', 
                        params: { selectedTemplate: template } 
                      })
                    }}
                  >
                    <img
                      src={template.thumbnail}
                      alt={template.title}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-2">
                      <h4 className="text-sm font-medium text-gray-900">{template.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {template.style} · {template.slides}页
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">推荐风格</h4>
              <div className="flex flex-wrap gap-2">
                {['科技风', '商务风', '简约风', '创意风', '学术风', '中国风'].map((style) => (
                  <button
                    key={style}
                    onClick={() => setUserInput(style)}
                    className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                上传图片
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadImage}
                className="hidden"
              />
              <button
                onClick={handleAutoLayout}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                自动排版
              </button>
            </div>

            {imageElements.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {imageElements.map((img) => (
                  <div key={img.id} className="relative group border rounded-lg overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.caption}
                      className="w-full h-24 object-cover"
                    />
                    <button
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <p className="text-xs text-gray-600 p-1 truncate">{img.caption}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">图片元素库</h4>
              <p className="text-xs text-gray-500">
                从网络搜索、模板下载、用户上传等渠道收集的图片将自动保存到这里，越用越智能
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PPTAIAssistant

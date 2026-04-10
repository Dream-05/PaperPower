import { useState, useCallback } from 'react'
// import { useLanguageStore } from '@/store/languageStore'
import { intelligentEngine } from '@/utils/localAI/IntelligentEngine'
import { aiLearningEngine } from '@/utils/AILearningEngine'

export interface WordAIAction {
  type: 'generate_text' | 'format_document' | 'insert_section'
  params: Record<string, any>
}

interface WordAIAssistantProps {
  onAction: (action: WordAIAction) => void
}

export function WordAIAssistant({ onAction }: WordAIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')

  const handleGenerateText = useCallback(async () => {
    if (!userInput.trim()) return
    setIsProcessing(true)
    try {
      const response = intelligentEngine.think(userInput)
      const generatedText = response.message
      if (generatedText) setGeneratedContent(generatedText)
      await aiLearningEngine.learnFromContext({
        documentType: 'word',
        userAction: 'generate_text',
        userInput,
        result: generatedText,
        success: true
      })
      onAction({ type: 'generate_text', params: { content: generatedText, prompt: userInput } })
    } catch (error) {
      console.error('生成失败:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [userInput, onAction])

  const handleFormatDocument = useCallback(async () => {
    setIsProcessing(true)
    try {
      intelligentEngine.think('格式化文档')
      onAction({ type: 'format_document', params: { formatType: 'standard', applyStyles: true } })
      await aiLearningEngine.learnFromContext({ documentType: 'word', userAction: 'format_document', userInput: '格式化文档', success: true })
    } finally {
      setIsProcessing(false)
    }
  }, [onAction])

  const handleInsertSection = useCallback(async (sectionType: string) => {
    setIsProcessing(true)
    try {
      const templates: Record<string, string> = {
        'introduction': '第一章 引言\n\n本章主要介绍...',
        'summary': '总结\n\n综上所述...',
        'conclusion': '结论\n\n基于以上分析...'
      }
      const content = templates[sectionType] || ''
      onAction({ type: 'insert_section', params: { sectionType, content } })
      await aiLearningEngine.learnFromContext({ documentType: 'word', userAction: 'insert_section', userInput: `插入${sectionType}`, success: true })
    } finally {
      setIsProcessing(false)
    }
  }, [onAction])

  const commonPrompts = ['帮我写一份项目计划书', '生成产品介绍文案', '写一份会议纪要', '创建合同模板', '写一封商务邮件']

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isExpanded ? (
        <button onClick={() => setIsExpanded(true)} className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      ) : (
        <div className="w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 flex items-center justify-between">
            <h3 className="text-white font-semibold">Word AI 助手</h3>
            <button onClick={() => setIsExpanded(false)} className="text-white/80 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">快速操作</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleFormatDocument} disabled={isProcessing} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition-colors disabled:opacity-50">📝 格式化文档</button>
                <button onClick={() => handleInsertSection('introduction')} disabled={isProcessing} className="px-3 py-2 bg-green-50 text-green-600 rounded-lg text-sm hover:bg-green-100 transition-colors disabled:opacity-50">📄 插入引言</button>
                <button onClick={() => handleInsertSection('summary')} disabled={isProcessing} className="px-3 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm hover:bg-purple-100 transition-colors disabled:opacity-50">📊 插入总结</button>
                <button onClick={() => handleInsertSection('conclusion')} disabled={isProcessing} className="px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm hover:bg-orange-100 transition-colors disabled:opacity-50">✅ 插入结论</button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">AI 文案生成</h4>
              <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="描述您想要生成的内容..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" rows={3} />
              <button onClick={handleGenerateText} disabled={isProcessing || !userInput.trim()} className="mt-2 w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {isProcessing ? '生成中...' : '✨ 生成内容'}
              </button>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">常用提示词</h4>
              <div className="space-y-1">
                {commonPrompts.map((prompt, index) => (
                  <button key={index} onClick={() => setUserInput(prompt)} className="block w-full text-left px-3 py-1.5 bg-gray-50 text-gray-700 rounded text-sm hover:bg-gray-100 transition-colors">{prompt}</button>
                ))}
              </div>
            </div>

            {generatedContent && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">生成的内容</h4>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{generatedContent}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

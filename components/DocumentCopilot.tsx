import { useState, useCallback, useEffect } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { t } from '@/i18n'
import { intelligentEngine } from '@/utils/localAI/IntelligentEngine'

export interface CopilotSuggestion {
  type: 'format' | 'insert' | 'analyze' | 'improve' | 'question'
  title: string
  description: string
  action: () => void
  confidence: number
}

export interface DocumentContext {
  type: 'word' | 'excel' | 'ppt'
  content: string
  selection?: string
  cursorPosition?: number
  metadata?: Record<string, any>
}

interface DocumentCopilotProps {
  context: DocumentContext
  isVisible: boolean
  onClose: () => void
}

export function DocumentCopilot({ context, isVisible, onClose }: DocumentCopilotProps) {
  const { language } = useLanguageStore()
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyzeContext = useCallback(async () => {
    if (!context.content) return

    setIsAnalyzing(true)

    const response = intelligentEngine.think(context.content)
    
    const newSuggestions: CopilotSuggestion[] = []

    if (context.type === 'word') {
      if (response.thinking?.some(step => step.type === 'analyze' && step.result?.includes('document'))) {
        newSuggestions.push({
          type: 'format',
          title: t('copilot.formatTitle', language),
          description: t('copilot.formatTitleDesc', language),
          action: () => console.log('Format title'),
          confidence: 0.9
        })
      }

      if (context.selection && context.selection.length > 50) {
        newSuggestions.push({
          type: 'improve',
          title: t('copilot.improveWriting', language),
          description: t('copilot.improveWritingDesc', language),
          action: () => console.log('Improve writing'),
          confidence: 0.85
        })
      }

      newSuggestions.push({
        type: 'insert',
        title: t('copilot.insertTOC', language),
        description: t('copilot.insertTOCDesc', language),
        action: () => console.log('Insert TOC'),
        confidence: 0.8
      })
    }

    if (context.type === 'excel') {
      newSuggestions.push({
        type: 'analyze',
        title: t('copilot.analyzeData', language),
        description: t('copilot.analyzeDataDesc', language),
        action: () => console.log('Analyze data'),
        confidence: 0.85
      })

      newSuggestions.push({
        type: 'insert',
        title: t('copilot.createChart', language),
        description: t('copilot.createChartDesc', language),
        action: () => console.log('Create chart'),
        confidence: 0.8
      })
    }

    if (context.type === 'ppt') {
      newSuggestions.push({
        type: 'improve',
        title: t('copilot.designSlide', language),
        description: t('copilot.designSlideDesc', language),
        action: () => console.log('Design slide'),
        confidence: 0.85
      })

      newSuggestions.push({
        type: 'insert',
        title: t('copilot.addAnimation', language),
        description: t('copilot.addAnimationDesc', language),
        action: () => console.log('Add animation'),
        confidence: 0.75
      })
    }

    setSuggestions(newSuggestions.sort((a, b) => b.confidence - a.confidence))
    setIsAnalyzing(false)
  }, [context, language])

  useEffect(() => {
    if (isVisible && context.content) {
      analyzeContext()
    }
  }, [isVisible, context.content, analyzeContext])

  if (!isVisible) return null

  const getIconByType = (type: CopilotSuggestion['type']) => {
    switch (type) {
      case 'format': return '📝'
      case 'insert': return '➕'
      case 'analyze': return '📊'
      case 'improve': return '✨'
      case 'question': return '❓'
    }
  }

  const getColorByType = (type: CopilotSuggestion['type']) => {
    switch (type) {
      case 'format': return 'bg-blue-100 text-blue-700'
      case 'insert': return 'bg-green-100 text-green-700'
      case 'analyze': return 'bg-purple-100 text-purple-700'
      case 'improve': return 'bg-yellow-100 text-yellow-700'
      case 'question': return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="fixed bottom-20 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-40 animate-slideUp">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="text-white font-semibold">{t('copilot.title', language)}</h3>
            <p className="text-white/70 text-xs">{t('copilot.subtitle', language)}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-3 space-y-2">
        {isAnalyzing ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">{t('copilot.analyzing', language)}</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>{t('copilot.noSuggestions', language)}</p>
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              onClick={suggestion.action}
            >
              <div className="flex items-start space-x-3">
                <span className="text-xl">{getIconByType(suggestion.type)}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {suggestion.title}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${getColorByType(suggestion.type)}`}>
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function createCopilotAction(type: string, params: Record<string, any>): () => void {
  return () => {
    console.log('Copilot action:', type, params)
  }
}

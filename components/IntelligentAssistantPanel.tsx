import { useState, useEffect, useCallback } from 'react'
import { IntelligentDocumentProcessor, IntelligentEdit, ProcessingResult } from '@/utils/intelligentProcessor'
import { STYLE_PROFILES } from '@/utils/formatRecommendation'

interface IntelligentAssistantPanelProps {
  documentContent: string
  onApplyEdit: (edit: IntelligentEdit) => void
  onApplyProfile: (profileId: string) => void
  onFormatAction: (action: string, value: unknown) => void
  isOpen: boolean
  onClose: () => void
}

export function IntelligentAssistantPanel({
  documentContent,
  onApplyEdit,
  onApplyProfile,
  onFormatAction,
  isOpen,
  onClose
}: IntelligentAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<'analyze' | 'format' | 'extract' | 'profiles'>('analyze')
  const [analysisResult, setAnalysisResult] = useState<ProcessingResult | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [quickActions, setQuickActions] = useState<{ label: string; action: string }[]>([])
  const [extractedInfo, setExtractedInfo] = useState<ReturnType<typeof IntelligentDocumentProcessor.extractDocumentInfo> | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [commandInput, setCommandInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  
  useEffect(() => {
    if (isOpen && documentContent) {
      runAnalysis()
    }
  }, [isOpen, documentContent])
  
  const runAnalysis = useCallback(() => {
    setIsAnalyzing(true)
    
    setTimeout(() => {
      const result = IntelligentDocumentProcessor.processDocument(documentContent)
      setAnalysisResult(result)
      
      if (result.success && result.structure) {
        const { suggestions: suggs, quickActions: actions } = 
          IntelligentDocumentProcessor.analyzeAndSuggest(documentContent)
        setSuggestions(suggs)
        setQuickActions(actions)
        
        const info = IntelligentDocumentProcessor.extractDocumentInfo(documentContent)
        setExtractedInfo(info)
      }
      
      setIsAnalyzing(false)
    }, 100)
  }, [documentContent])
  
  const handleQuickAction = (action: string) => {
    const edits = IntelligentDocumentProcessor.interpretUserCommand(action)
    edits.forEach(edit => onApplyEdit(edit))
  }
  
  const handleCommandSubmit = () => {
    if (!commandInput.trim()) return
    
    setCommandHistory(prev => [commandInput, ...prev.slice(0, 9)])
    
    const edits = IntelligentDocumentProcessor.interpretUserCommand(commandInput)
    if (edits.length > 0) {
      edits.forEach(edit => onApplyEdit(edit))
      setCommandInput('')
    }
  }
  
  const handleApplyProfile = (profileId: string) => {
    onApplyProfile(profileId)
  }
  
  if (!isOpen) return null
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b items-center">
        {[
          { id: 'analyze', label: '分析' },
          { id: 'format', label: '格式' },
          { id: 'extract', label: '提取' },
          { id: 'profiles', label: '模板' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 py-2 text-sm ${
              activeTab === tab.id 
                ? 'border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600"
          title="关闭"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'analyze' && (
          <div className="space-y-4">
            {isAnalyzing ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : (
              <>
                {analysisResult?.success && analysisResult.structure && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">文档概览</h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>类型: {getDocumentTypeName(analysisResult.structure.documentType)}</p>
                      <p>语言: {analysisResult.structure.language === 'zh' ? '中文' : '英文'}</p>
                      <p>字数: {analysisResult.structure.wordCount}</p>
                      <p>字符数: {analysisResult.structure.charCount}</p>
                      <p>段落数: {analysisResult.structure.blocks.filter(b => b.type === 'paragraph').length}</p>
                    </div>
                  </div>
                )}
                
                {suggestions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">智能建议</h4>
                    <div className="space-y-2">
                      {suggestions.map((suggestion, index) => (
                        <div key={index} className="text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                          💡 {suggestion}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {quickActions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">快捷操作</h4>
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuickAction(action.action)}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">自然语言命令</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commandInput}
                      onChange={e => setCommandInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCommandSubmit()}
                      placeholder="输入命令，如：设置字号14..."
                      className="flex-1 h-8 px-2 text-sm border rounded"
                    />
                    <button
                      onClick={handleCommandSubmit}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      执行
                    </button>
                  </div>
                  
                  {commandHistory.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">历史命令:</p>
                      <div className="flex flex-wrap gap-1">
                        {commandHistory.slice(0, 5).map((cmd, index) => (
                          <button
                            key={index}
                            onClick={() => setCommandInput(cmd)}
                            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          >
                            {cmd.length > 15 ? cmd.slice(0, 15) + '...' : cmd}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        
        {activeTab === 'format' && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">一键格式化</h4>
              <p className="text-xs text-gray-500 mb-3">
                自动分析文档类型并应用最佳格式配置
              </p>
              <button
                onClick={() => handleQuickAction('autoFormat')}
                className="w-full py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded hover:opacity-90"
              >
                智能格式化
              </button>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">格式检查</h4>
              <button
                onClick={() => {
                  const result = IntelligentDocumentProcessor.processDocument(documentContent)
                  if (result.report) {
                    onFormatAction('showReport', result.report)
                  }
                }}
                className="w-full py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                生成格式报告
              </button>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">快速调整</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onFormatAction('fontSize', 12)}
                  className="py-2 text-xs border rounded hover:bg-gray-50"
                >
                  字号12pt
                </button>
                <button
                  onClick={() => onFormatAction('fontSize', 14)}
                  className="py-2 text-xs border rounded hover:bg-gray-50"
                >
                  字号14pt
                </button>
                <button
                  onClick={() => onFormatAction('lineSpacing', 1.5)}
                  className="py-2 text-xs border rounded hover:bg-gray-50"
                >
                  行距1.5倍
                </button>
                <button
                  onClick={() => onFormatAction('lineSpacing', 2)}
                  className="py-2 text-xs border rounded hover:bg-gray-50"
                >
                  行距2倍
                </button>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">对齐方式</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => onFormatAction('alignment', 'left')}
                  className="flex-1 py-2 text-xs border rounded hover:bg-gray-50"
                >
                  左对齐
                </button>
                <button
                  onClick={() => onFormatAction('alignment', 'center')}
                  className="flex-1 py-2 text-xs border rounded hover:bg-gray-50"
                >
                  居中
                </button>
                <button
                  onClick={() => onFormatAction('alignment', 'right')}
                  className="flex-1 py-2 text-xs border rounded hover:bg-gray-50"
                >
                  右对齐
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'extract' && extractedInfo && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">文档摘要</h4>
              <p className="text-xs text-gray-600">{extractedInfo.summary}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">关键词</h4>
              <div className="flex flex-wrap gap-1">
                {extractedInfo.keywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            
            {extractedInfo.titles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">标题结构</h4>
                <div className="space-y-1">
                  {extractedInfo.titles.map((title, index) => (
                    <div key={index} className="text-xs text-gray-600 pl-2 border-l-2 border-blue-300">
                      {title}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {extractedInfo.dates.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">日期信息</h4>
                <div className="flex flex-wrap gap-1">
                  {extractedInfo.dates.map((date, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded"
                    >
                      {date}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {extractedInfo.entities.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">实体信息</h4>
                <div className="space-y-1">
                  {extractedInfo.entities.slice(0, 10).map((entity, index) => (
                    <div key={index} className="text-xs text-gray-600">
                      <span className="font-medium">{entity.type}:</span> {entity.value}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {extractedInfo.tables.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">表格信息</h4>
                <div className="space-y-2">
                  {extractedInfo.tables.map((table, index) => (
                    <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      表格 {index + 1}: {table.rows}行 × {table.cols}列
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'profiles' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              选择预设样式模板，快速应用标准格式
            </p>
            
            {Object.entries(STYLE_PROFILES).map(([id, profile]) => (
              <button
                key={id}
                onClick={() => handleApplyProfile(id)}
                className="w-full text-left p-3 border rounded hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-800">{profile.name}</div>
                <div className="text-xs text-gray-500 mt-1">{profile.description}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {profile.fontFamily.split(',')[0]} · {profile.fontSize}pt · {profile.lineHeight}倍行距
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 border-t bg-gray-50">
        <button
          onClick={runAnalysis}
          className="w-full py-2 text-sm border border-gray-300 rounded hover:bg-gray-100"
        >
          重新分析文档
        </button>
      </div>
    </div>
  )
}

function getDocumentTypeName(type: string): string {
  const names: Record<string, string> = {
    official: '公文',
    academic: '学术论文',
    business: '商务文档',
    personal: '个人文档',
    education: '教育文档',
    unknown: '未知'
  }
  return names[type] || type
}

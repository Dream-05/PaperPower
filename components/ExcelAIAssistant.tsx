import { useState, useCallback } from 'react'
import { intelligentEngine } from '@/utils/localAI/IntelligentEngine'
import { aiLearningEngine } from '@/utils/AILearningEngine'

export interface ExcelAIAction {
  type: 'merge_tables' | 'generate_formula' | 'create_budget' | 'analyze_data'
  params: Record<string, any>
}

interface ExcelAIAssistantProps {
  onAction: (action: ExcelAIAction) => void
}

export function ExcelAIAssistant({ onAction }: ExcelAIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [generatedFormula, setGeneratedFormula] = useState('')
  const [mergeResults, setMergeResults] = useState('')

  const handleMergeTables = useCallback(async (tableCount: number) => {
    setIsProcessing(true)
    try {
      intelligentEngine.think(`合并${tableCount}个表格`)
      onAction({ type: 'merge_tables', params: { action: 'merge', tableCount, method: 'append' } })
      await aiLearningEngine.learnFromContext({ documentType: 'excel', userAction: 'merge_tables', userInput: `合并${tableCount}个表格`, success: true })
      setMergeResults(`已合并 ${tableCount} 个表格`)
    } finally {
      setIsProcessing(false)
    }
  }, [onAction])

  const handleGenerateFormula = useCallback(async () => {
    if (!userInput.trim()) return
    setIsProcessing(true)
    try {
      const response = intelligentEngine.think(`生成 Excel 公式：${userInput}`)
      const formulaPatterns: Record<string, string> = {
        '求和': '=SUM(A1:A10)',
        '平均': '=AVERAGE(A1:A10)',
        '计数': '=COUNT(A1:A10)',
        '如果': '=IF(A1>10,"是","否")',
        '查找': '=VLOOKUP(value,table,col,FALSE)',
        '预算': '=SUMIF(range,criteria,sum_range)'
      }
      let generated = ''
      for (const [key, formula] of Object.entries(formulaPatterns)) {
        if (userInput.includes(key)) { generated = formula; break }
      }
      if (!generated && response.message) generated = response.message
      setGeneratedFormula(generated)
      onAction({ type: 'generate_formula', params: { formula: generated, description: userInput } })
      await aiLearningEngine.learnFromContext({ documentType: 'excel', userAction: 'generate_formula', userInput, result: generated, success: true })
    } finally {
      setIsProcessing(false)
    }
  }, [userInput, onAction])

  const handleCreateBudget = useCallback(async () => {
    setIsProcessing(true)
    try {
      intelligentEngine.think('创建财务报表预算')
      onAction({ type: 'create_budget', params: { template: { revenues: ['销售收入', '服务收入'], costs: ['成本', '人工成本'], expenses: ['销售费用', '管理费用'] }, type: 'financial' } })
      await aiLearningEngine.learnFromContext({ documentType: 'excel', userAction: 'create_budget', userInput: '创建预算报表', success: true })
    } finally {
      setIsProcessing(false)
    }
  }, [onAction])

  const handleAnalyzeData = useCallback(async () => {
    setIsProcessing(true)
    try {
      intelligentEngine.think('分析 Excel 数据')
      onAction({ type: 'analyze_data', params: { analysisType: 'summary', includeCharts: true, includePivot: true } })
      await aiLearningEngine.learnFromContext({ documentType: 'excel', userAction: 'analyze_data', userInput: '分析数据', success: true })
    } finally {
      setIsProcessing(false)
    }
  }, [onAction])

  const commonFormulas = [
    { name: 'SUM', desc: '求和', example: '=SUM(A1:A10)' },
    { name: 'AVERAGE', desc: '平均值', example: '=AVERAGE(A1:A10)' },
    { name: 'VLOOKUP', desc: '垂直查找', example: '=VLOOKUP(A1,B:C,2,FALSE)' },
    { name: 'IF', desc: '条件判断', example: '=IF(A1>10,"是","否")' },
    { name: 'SUMIF', desc: '条件求和', example: '=SUMIF(A1:A10,">5",B1:B10)' },
    { name: 'COUNTIF', desc: '条件计数', example: '=COUNTIF(A1:A10,">5")' }
  ]

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isExpanded ? (
        <button onClick={() => setIsExpanded(true)} className="w-14 h-14 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
      ) : (
        <div className="w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 flex items-center justify-between">
            <h3 className="text-white font-semibold">Excel AI 助手</h3>
            <button onClick={() => setIsExpanded(false)} className="text-white/80 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">多表格汇总</h4>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleMergeTables(2)} disabled={isProcessing} className="px-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100 transition-colors disabled:opacity-50">合并 2 个</button>
                <button onClick={() => handleMergeTables(3)} disabled={isProcessing} className="px-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100 transition-colors disabled:opacity-50">合并 3 个</button>
                <button onClick={() => handleMergeTables(5)} disabled={isProcessing} className="px-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100 transition-colors disabled:opacity-50">合并 5 个</button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">公式帮写</h4>
              <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="描述您需要的公式..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" rows={2} />
              <button onClick={handleGenerateFormula} disabled={isProcessing || !userInput.trim()} className="mt-2 w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {isProcessing ? '生成中...' : '✨ 生成公式'}
              </button>
            </div>

            {generatedFormula && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">生成的公式</h4>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <code className="text-sm text-green-700 font-mono">{generatedFormula}</code>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">常用公式</h4>
              <div className="space-y-1">
                {commonFormulas.map((item, index) => (
                  <button key={index} onClick={() => setUserInput(item.desc)} className="block w-full text-left px-3 py-1.5 bg-gray-50 text-gray-700 rounded text-sm hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between"><span className="font-semibold">{item.name}</span><span className="text-gray-500">{item.desc}</span></div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">财务报表</h4>
              <button onClick={handleCreateBudget} disabled={isProcessing} className="w-full px-4 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm hover:bg-purple-100 transition-colors disabled:opacity-50">📊 创建预算报表</button>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">数据分析</h4>
              <button onClick={handleAnalyzeData} disabled={isProcessing} className="w-full px-4 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm hover:bg-orange-100 transition-colors disabled:opacity-50">📈 智能分析数据</button>
            </div>

            {mergeResults && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">{mergeResults}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

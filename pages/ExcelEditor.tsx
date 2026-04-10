import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useLanguageStore } from '@/store/languageStore'
import { t } from '@/i18n'
import { fileSystem } from '@/services/fileSystem'
import { intentParser } from '@/utils/intentParser'

import { useNotification } from '@/components/Notification'
import { enhancedTransformerModel as transformerModel } from '@/utils/localAI/EnhancedTransformerModel'

import * as XLSX from 'xlsx'

interface CellData {
  value: string | number | null
  formula?: string
}

interface SheetData {
  name: string
  data: CellData[][]
  selectedRange?: { startRow: number; startCol: number; endRow: number; endCol: number }
}

const columnLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default function ExcelEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentFile, setCurrentFile, addAIMessage, aiPanel, isLoading, setLoading } = useAppStore()
  const { language } = useLanguageStore()
  const { addNotification } = useNotification()
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [aiInput, setAIInput] = useState('')
  const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'pageLayout' | 'formula' | 'data' | 'review' | 'view'>('home')
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [zoom, setZoom] = useState(100)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState(false)

  const [originalData, setOriginalData] = useState<CellData[][] | null>(null)
  
  // 处理URL查询参数，自动加载数据
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const data = searchParams.get('data')
    
    if (data) {
      // 简单处理：将文本数据转换为表格数据
      const rows = data.split('\n').filter(row => row.trim())
      const sheetData: CellData[][] = rows.map(row => {
        return row.split(',').map(cell => ({ value: cell.trim() }))
      })
      
      setSheets([{
        name: 'Sheet1',
        data: sheetData
      }])
    }
  }, [location.search])
  
  const currentSheet = sheets[activeSheet]
  const rowCount = useMemo(() => Math.max(100, currentSheet?.data.length || 100), [currentSheet])
  const colCount = useMemo(() => Math.max(26, currentSheet?.data[0]?.length || 26), [currentSheet])
  
  const getCellValue = (row: number, col: number): string => {
    if (!currentSheet?.data[row]?.[col]) return ''
    const cell = currentSheet.data[row][col]
    if (cell.formula) {
      return calculateFormula(cell.formula, row, col)
    }
    return String(cell.value ?? '')
  }
  
  const calculateFormula = (formula: string, _row: number, _col: number): string => {
    try {
      if (formula.startsWith('=SUM(')) {
        const range = formula.match(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/i)
        if (range) {
          const startCol = range[1].charCodeAt(0) - 65
          const startRow = parseInt(range[1].slice(1)) - 1
          const endCol = range[2].charCodeAt(0) - 65
          const endRow = parseInt(range[2].slice(1)) - 1
          
          let sum = 0
          for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
              const val = currentSheet?.data[r]?.[c]?.value
              if (typeof val === 'number') sum += val
            }
          }
          return String(sum)
        }
      }
      if (formula.startsWith('=AVERAGE(')) {
        const range = formula.match(/AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)/i)
        if (range) {
          const startCol = range[1].charCodeAt(0) - 65
          const startRow = parseInt(range[1].slice(1)) - 1
          const endCol = range[2].charCodeAt(0) - 65
          const endRow = parseInt(range[2].slice(1)) - 1
          
          let sum = 0, count = 0
          for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
              const val = currentSheet?.data[r]?.[c]?.value
              if (typeof val === 'number') { sum += val; count++ }
            }
          }
          return count > 0 ? String((sum / count).toFixed(2)) : '0'
        }
      }
      if (formula.startsWith('=COUNT(')) {
        const range = formula.match(/COUNT\(([A-Z]+\d+):([A-Z]+\d+)\)/i)
        if (range) {
          const startCol = range[1].charCodeAt(0) - 65
          const startRow = parseInt(range[1].slice(1)) - 1
          const endCol = range[2].charCodeAt(0) - 65
          const endRow = parseInt(range[2].slice(1)) - 1
          
          let count = 0
          for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
              const val = currentSheet?.data[r]?.[c]?.value
              if (val !== null && val !== undefined && val !== '') count++
            }
          }
          return String(count)
        }
      }
    } catch {
      return '#ERROR'
    }
    return formula
  }
  
  const handleOpenFile = useCallback(async () => {
    try {
      const handles = await fileSystem.openFile({
        extensions: ['xlsx', 'xls', 'csv']
      })
      
      if (handles && handles.length > 0) {
        const handle = handles[0]
        const content = await fileSystem.readFile(handle)
        
        setCurrentFile({
          name: handle.name,
          type: 'excel',
          content
        })
        
        const workbook = XLSX.read(content, { type: 'array' })
        const sheetList: SheetData[] = workbook.SheetNames.map(name => {
          const worksheet = workbook.Sheets[name]
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
          const data: CellData[][] = rawData.map(row => 
            (row as unknown[]).map(cell => ({ value: cell as string | number | null }))
          )
          return { name, data }
        })
        
        setSheets(sheetList)
        setActiveSheet(0)
        
        addNotification('success', t('status.success', language), handle.name)
      }
    } catch (error) {
      addNotification('error', t('status.error', language), t('error.fileOpenFailed', language))
    }
  }, [setCurrentFile, addNotification])
  
  const handleNewWorkbook = useCallback(() => {
    const newSheet: SheetData = {
      name: 'Sheet1',
      data: Array(100).fill(null).map(() => Array(26).fill(null).map(() => ({ value: null })))
    }
    setSheets([newSheet])
    setActiveSheet(0)
    setCurrentFile({
        name: `${t('file.new', language)}.xlsx`,
        type: 'excel',
        content: null
      })
      addNotification('success', t('status.success', language), t('status.success', language))
  }, [setCurrentFile, addNotification])
  
  const handleSaveFile = useCallback(async () => {
    if (sheets.length === 0) return
    
    try {
      const workbook = XLSX.utils.book_new()
      
      for (const sheet of sheets) {
        const rawData = sheet.data.map(row => row.map(cell => cell.value))
        const worksheet = XLSX.utils.aoa_to_sheet(rawData)
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
      }
      
      const content = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      
      await fileSystem.saveFile(
        content,
        currentFile?.name || `${t('excel.workbook', language)}.xlsx`,
        'xlsx'
      )
      
      addNotification('success', t('status.success', language), currentFile?.name || `${t('file.new', language)}.xlsx`)
    } catch (error) {
      addNotification('error', t('status.error', language), t('error.unknown', language))
    }
  }, [sheets, currentFile, addNotification])
  
  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col })
    setEditingCell(null)
  }
  
  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col })
    setEditValue(getCellValue(row, col))
  }
  
  const handleCellEdit = (row: number, col: number, value: string) => {
    setSheets(prev => {
      const newSheets = [...prev]
      const newData = newSheets[activeSheet].data.map(r => [...r])
      
      while (newData.length <= row) {
        newData.push(Array(26).fill(null).map(() => ({ value: null })))
      }
      while (newData[row].length <= col) {
        newData[row].push({ value: null })
      }
      
      const isFormula = value.startsWith('=')
      newData[row][col] = {
        value: isFormula ? null : (isNaN(Number(value)) ? value : Number(value)),
        formula: isFormula ? value : undefined
      }
      
      newSheets[activeSheet] = { ...newSheets[activeSheet], data: newData }
      return newSheets
    })
    setEditingCell(null)
  }
  
  const handleAICommand = useCallback(() => {
    if (!aiInput.trim()) return
    
    const intent = intentParser.parse(aiInput)
    addAIMessage({ role: 'user', content: aiInput, intent })
    setLoading(true)
    
    setTimeout(() => {
      let response = ''
      
      const analyzeKeywords = language === 'zh' ? ['分析', '统计'] : ['analyze', 'statistics']
      const sumKeywords = language === 'zh' ? ['求和'] : ['sum']
      const chartKeywords = language === 'zh' ? ['图表'] : ['chart']
      const sortKeywords = language === 'zh' ? ['排序'] : ['sort']
      const summaryKeywords = language === 'zh' ? ['摘要'] : ['summary']
      const cleanKeywords = language === 'zh' ? ['清理'] : ['clean']
      const suggestKeywords = language === 'zh' ? ['建议'] : ['suggest']
      const predictKeywords = language === 'zh' ? ['预测', '趋势'] : ['predict', 'trend']
      const fillKeywords = language === 'zh' ? ['填充', '自动填充'] : ['fill', 'auto fill']
      
      const hasAnalyzeIntent = intent.intent.includes('analyze') || analyzeKeywords.some(k => intent.intent.includes(k))
      const hasSumIntent = intent.intent.includes('sum') || sumKeywords.some(k => intent.intent.includes(k))
      const hasChartIntent = intent.intent.includes('chart') || chartKeywords.some(k => intent.intent.includes(k))
      const hasSortIntent = intent.intent.includes('sort') || sortKeywords.some(k => intent.intent.includes(k))
      const hasSummaryIntent = intent.intent.includes('summary') || summaryKeywords.some(k => intent.intent.includes(k))
      const hasCleanIntent = intent.intent.includes('clean') || cleanKeywords.some(k => intent.intent.includes(k))
      const hasSuggestIntent = intent.intent.includes('suggest') || suggestKeywords.some(k => intent.intent.includes(k))
      const hasPredictIntent = intent.intent.includes('predict') || predictKeywords.some(k => intent.intent.includes(k))
      const hasFillIntent = intent.intent.includes('fill') || fillKeywords.some(k => intent.intent.includes(k))
      
      if (hasAnalyzeIntent) {
        const data = currentSheet?.data || []
        const nonEmptyCells = data.flat().filter(c => c.value !== null && c.value !== undefined).length
        const numericCells = data.flat().filter(c => typeof c.value === 'number').length
        
        const tableData: Record<string, unknown>[] = []
        const headers: string[] = []
        
        if (data[0]) {
          data[0].forEach((cell, i) => {
            headers.push(cell.value ? String(cell.value) : `${t('excel.column', language)}${i + 1}`)
          })
        }
        
        for (let i = 1; i < Math.min(data.length, 50); i++) {
          const row: Record<string, unknown> = {}
          data[i]?.forEach((cell, j) => {
            row[headers[j] || `${t('excel.column', language)}${j + 1}`] = cell.value
          })
          if (Object.values(row).some(v => v !== null && v !== undefined)) {
            tableData.push(row)
          }
        }
        
        const analysisResult = transformerModel.generateContent(aiInput, 'excel')
        
        let sum = 0, count = 0, max = -Infinity, min = Infinity
        data.flat().forEach(c => {
          if (typeof c.value === 'number') { 
            sum += c.value
            count++
            if (c.value > max) max = c.value
            if (c.value < min) min = c.value
          }
        })
        const avg = count > 0 ? (sum / count).toFixed(2) : 0
        
        response = `📊 ${t('excel.dataAnalysisReport', language)}

📋 ${t('excel.dataOverview', language)}
- ${t('excel.totalCells', language)}：${nonEmptyCells}
- ${t('excel.numericCells', language)}：${numericCells}
- ${t('excel.textCells', language)}：${nonEmptyCells - numericCells}
- ${t('excel.dataRows', language)}：${tableData.length}

📈 ${t('excel.statisticsInfo', language)}
- ${t('excel.sumValue', language)}：${sum.toFixed(2)}
- ${t('excel.avgValue', language)}：${avg}
- ${t('excel.maxValue', language)}：${max !== -Infinity ? max.toFixed(2) : 'N/A'}
- ${t('excel.minValue', language)}：${min !== Infinity ? min.toFixed(2) : 'N/A'}
- ${t('excel.countValue', language)}：${count}

💡 ${t('excel.analysisInsights', language)}
${(typeof analysisResult === 'string' ? analysisResult : '').substring(0, 500)}

📝 ${t('excel.smartAnalysisComplete', language)}`
      } else if (hasSumIntent) {
        if (selectedCell) {
          const data = currentSheet?.data || []
          const col = selectedCell.col
          let columnSum = 0
          let count = 0
          
          for (let row = 0; row < data.length; row++) {
            const cell = data[row]?.[col]
            if (typeof cell?.value === 'number') {
              columnSum += cell.value
              count++
            }
          }
          
          response = `${t('excel.selectedCell', language)} ${columnLabels[col]}${selectedCell.row + 1}

📊 ${t('excel.selectedColStats', language)}：
- ${t('excel.sumValue', language)}：${columnSum.toFixed(2)}
- ${t('excel.dataPoints', language)}：${count}${language === 'zh' ? '个' : ''}

${t('excel.formulaHint', language)}

${t('excel.quickOperations', language)}：
- =SUM(A:A) ${t('excel.sumColumn', language)}
- =SUM(1:1) ${t('excel.sumRow', language)}
- =SUM(A1:C3) ${t('excel.sumRange', language)}`
          
          if (selectedCell) {
            handleCellEdit(selectedCell.row, selectedCell.col, String(columnSum))
            addNotification('success', t('excel.autoCalc', language), `${language === 'zh' ? '已计算' : 'Calculated'}${columnLabels[col]}${language === 'zh' ? '列的总和' : ' column sum'}`)
          }
        } else {
          response = t('excel.selectCellFirst', language)
        }
      } else if (hasChartIntent) {
        response = `📊 ${t('excel.chartFeature', language)}

1. ${t('excel.selectDataArea', language)}
2. ${t('excel.clickInsertTab', language)}
3. ${t('excel.selectChartType', language)}：
   - ${t('excel.barChartCompare', language)}
   - ${t('excel.lineChartTrend', language)}
   - ${t('excel.pieChartRatio', language)}
   - ${t('excel.scatterChartCorrelation', language)}

💡 ${t('excel.chartTip', language)}`
      } else if (hasSortIntent) {
        response = `📤 ${t('excel.sortFeature', language)}

1. ${t('excel.selectSortColumn', language)}
2. ${t('excel.clickDataTab', language)}
3. ${t('excel.selectOrder', language)}

${t('excel.sortShortcuts', language)}：
- ${t('excel.ascendingShortcut', language)}
- ${t('excel.descendingShortcut', language)}

${t('excel.sortTip', language)}`
      } else if (hasSummaryIntent) {
        const generatedSummary = transformerModel.generateContent(aiInput, 'excel')
        response = `📝 ${t('excel.dataSummary', language)}

${generatedSummary}

📊 ${t('excel.smartSummaryComplete', language)}`
      } else if (hasCleanIntent) {
        const data = currentSheet?.data || []
        let blankCells = 0
        let duplicateRows = 0
        const seenRows = new Set<string>()
        
        for (let row = 0; row < data.length; row++) {
          const rowKey = data[row]?.map(cell => String(cell?.value ?? '')).join('|') || ''
          if (seenRows.has(rowKey) && rowKey.trim()) {
            duplicateRows++
          } else {
            seenRows.add(rowKey)
          }
          
          for (let col = 0; col < (data[row]?.length || 0); col++) {
            if (data[row]?.[col]?.value === null || data[row]?.[col]?.value === undefined || data[row]?.[col]?.value === '') {
              blankCells++
            }
          }
        }
        
        response = `🧹 ${t('excel.dataCleanCheck', language)}

${t('excel.detectedIssues', language)}：
1. ${t('excel.blankCells', language)}：${blankCells}${language === 'zh' ? '个' : ''}
2. ${t('excel.duplicateRows', language)}：${duplicateRows}${language === 'zh' ? '行' : ' rows'}
3. ${t('excel.formatInconsistent', language)}
4. ${t('excel.outliers', language)}

💡 ${t('excel.suggestedActions', language)}：
- ${t('excel.clickDataRemoveDup', language)}
- ${t('excel.useFillForBlank', language)}
- ${t('excel.unifyFormats', language)}

${t('excel.dataCleanStarted', language)}`
        addNotification('info', t('excel.dataCheckComplete', language), t('excel.detectedBlankAndDup', language).replace('{blankCells}', String(blankCells)).replace('{duplicateRows}', String(duplicateRows)))
      } else if (hasSuggestIntent) {
        const suggestions = transformerModel.generateContent(aiInput, 'excel')
        response = `💡 ${t('excel.suggestActions', language)}

${suggestions}`
      } else if (hasPredictIntent) {
        const prediction = transformerModel.generateContent(aiInput, 'excel')
        response = `📈 ${t('excel.trendPrediction', language)}

${prediction}

📊 ${t('excel.predictionComplete', language)}`
      } else if (hasFillIntent) {
        response = `📝 ${t('excel.autoFillFeature', language)}

${language === 'zh' ? `支持的自动填充类型：
1. 序列填充（1, 2, 3... 或 一月, 二月...）
2. 日期填充（2024/1/1, 2024/1/2...）
3. 公式填充（向下复制公式）
4. 格式填充（复制单元格格式）

使用方法：
1. 输入起始值
2. 选中起始单元格和目标区域
3. 拖动填充柄或使用「编辑」→「填充」` : `Supported auto fill types:
1. Series fill (1, 2, 3... or Jan, Feb...)
2. Date fill (2024/1/1, 2024/1/2...)
3. Formula fill (copy formula down)
4. Format fill (copy cell format)

How to use:
1. Enter starting value
2. Select starting cell and target area
3. Drag fill handle or use Edit → Fill`}`
      } else if (intent.intent.includes('format') || intent.intent.includes('格式') || intent.intent.includes('格式化')) {
        response = `🎨 ${language === 'zh' ? '格式化功能' : 'Format Feature'}

${language === 'zh' ? `常用格式化选项：
• 数字格式：常规、数值、货币、百分比、日期、时间
• 对齐方式：左对齐、居中、右对齐、两端对齐
• 字体设置：字体、字号、颜色、加粗、斜体、下划线
• 边框样式：上、下、左、右边框，内外边框
• 填充颜色：背景色和图案填充

💡 快捷操作：
- Ctrl+1 打开单元格格式对话框
- Ctrl+B 加粗
- Ctrl+I 斜体
- Ctrl+U 下划线` : `Common formatting options:
• Number format: General, Number, Currency, Percentage, Date, Time
• Alignment: Left, Center, Right, Justify
• Font settings: Font, Size, Color, Bold, Italic, Underline
• Border style: Top, Bottom, Left, Right borders
• Fill color: Background color and pattern fill

💡 Shortcuts:
- Ctrl+1 Open cell format dialog
- Ctrl+B Bold
- Ctrl+I Italic
- Ctrl+U Underline`}`
      } else {
        response = `${language === 'zh' ? '已理解您的需求' : 'Understood your request'}：${intent.intent}

${language === 'zh' ? `可用的AI功能：
• 数据分析 - 分析表格数据统计信息
• 求和计算 - 自动计算数据总和
• 图表生成 - 创建数据可视化` : `Available AI features:
• Data Analysis - Analyze table data statistics
• Sum Calculation - Auto calculate data sum
• Chart Generation - Create data visualization`}
• 数据排序 - 按条件排序数据
• 数据摘要 - 提取关键信息
• 数据清理 - 检查并建议清理无效数据
• 智能建议 - 获取操作建议
• 趋势预测 - 预测数据趋势
• 自动填充 - 智能填充数据
• 格式化 - 单元格格式化建议`
      }
      
      addAIMessage({ role: 'assistant', content: response })
      setLoading(false)
    }, 500)
    
    setAIInput('')
  }, [aiInput, currentSheet, selectedCell, addAIMessage, setLoading, handleCellEdit, addNotification])

  const addSheet = () => {
    const newName = `Sheet${sheets.length + 1}`
    setSheets(prev => [...prev, {
      name: newName,
      data: Array(100).fill(null).map(() => Array(26).fill(null).map(() => ({ value: null })))
    }])
    setActiveSheet(sheets.length)
  }
  
  const copyCell = useCallback(() => {
    if (selectedCell) {
      const cell = currentSheet?.data[selectedCell.row]?.[selectedCell.col]
      if (cell) {
        navigator.clipboard.writeText(String(cell.value ?? ''))
        addNotification('success', t('status.success', language), `${t('status.success', language)} ${columnLabels[selectedCell.col]}${selectedCell.row + 1}`)
      }
    } else {
      addNotification('info', t('status.ready', language), t('error.fileNotFound', language))
    }
  }, [selectedCell, currentSheet, addNotification])
  
  const pasteCell = useCallback(async () => {
    if (selectedCell) {
      try {
        const text = await navigator.clipboard.readText()
        handleCellEdit(selectedCell.row, selectedCell.col, text)
        addNotification('success', t('status.success', language), t('status.success', language))
      } catch {
        addNotification('error', t('status.error', language), t('error.unknown', language))
      }
    } else {
      addNotification('info', t('status.ready', language), t('error.fileNotFound', language))
    }
  }, [selectedCell, handleCellEdit, addNotification])
  
  const [cellFont, setCellFont] = useState('宋体')
  const [cellFontSize, setCellFontSize] = useState(11)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  
  const insertChart = useCallback(() => {
    addNotification('info', '插入图表', '图表功能开发中，请使用AI助手生成图表')
  }, [addNotification])
  
  const insertPivotTable = useCallback(() => {
    addNotification('info', '数据透视表', '数据透视表功能开发中')
  }, [addNotification])
  
  const insertImage = useCallback(() => {
    addNotification('info', '插入图片', '请使用文件管理器上传图片')
  }, [addNotification])
  
  const insertShape = useCallback(() => {
    addNotification('info', '插入形状', '形状插入功能开发中')
  }, [addNotification])
  
  const insertLink = useCallback(() => {
    if (selectedCell) {
      handleCellEdit(selectedCell.row, selectedCell.col, 'https://')
      addNotification('info', t('status.ready', language), t('status.ready', language))
    } else {
      addNotification('info', t('status.ready', language), t('error.fileNotFound', language))
    }
  }, [selectedCell, handleCellEdit, addNotification])
  
  const insertComment = useCallback(() => {
    addNotification('info', '插入批注', '批注功能开发中')
  }, [addNotification])
  
  const sortAscending = useCallback(() => {
    if (!selectedCell || !currentSheet) {
      addNotification('info', t('status.ready', language), t('error.fileNotFound', language))
      return
    }
    
    const colIndex = selectedCell.col
    const data = currentSheet.data
    
    if (data.length <= 1) {
      addNotification('info', t('status.ready', language), t('error.fileNotFound', language))
      return
    }
    
    const headerRow = data[0]
    const dataRows = data.slice(1)
    
    dataRows.sort((a, b) => {
      const aVal = a[colIndex]?.value
      const bVal = b[colIndex]?.value
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal
      }
      if (typeof aVal === 'number') return -1
      if (typeof bVal === 'number') return 1
      return String(aVal ?? '').localeCompare(String(bVal ?? ''), language === 'zh' ? 'zh-CN' : 'en-US')
    })
    
    setSheets(prev => {
      const newSheets = [...prev]
      newSheets[activeSheet] = {
        ...newSheets[activeSheet],
        data: [headerRow, ...dataRows]
      }
      return newSheets
    })
    
    addNotification('success', t('status.success', language), `${t('status.success', language)} ${colIndex + 1}`)
  }, [selectedCell, currentSheet, activeSheet, addNotification])
  
  const sortDescending = useCallback(() => {
    if (!selectedCell || !currentSheet) {
      addNotification('info', '提示', '请先选中要排序的列')
      return
    }
    
    const colIndex = selectedCell.col
    const data = currentSheet.data
    
    if (data.length <= 1) {
      addNotification('info', '提示', '数据不足，无法排序')
      return
    }
    
    const headerRow = data[0]
    const dataRows = data.slice(1)
    
    dataRows.sort((a, b) => {
      const aVal = a[colIndex]?.value
      const bVal = b[colIndex]?.value
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal
      }
      if (typeof aVal === 'number') return 1
      if (typeof bVal === 'number') return -1
      return String(bVal ?? '').localeCompare(String(aVal ?? ''), 'zh-CN')
    })
    
    setSheets(prev => {
      const newSheets = [...prev]
      newSheets[activeSheet] = {
        ...newSheets[activeSheet],
        data: [headerRow, ...dataRows]
      }
      return newSheets
    })
    
    addNotification('success', '降序排列', `已对第 ${colIndex + 1} 列进行降序排列`)
  }, [selectedCell, currentSheet, activeSheet, addNotification])
  
  const filterData = useCallback(() => {
    if (!currentSheet || !selectedCell) {
      addNotification('info', '提示', '请先选中要筛选的列')
      return
    }
    
    if (!filterMode) {
      setOriginalData(currentSheet.data)
      setFilterMode(true)
      addNotification('success', '筛选已启用', `请输入筛选条件，按 Enter 确认`)
    } else {
      setFilterMode(false)
      if (originalData) {
        setSheets(prev => {
          const newSheets = [...prev]
          newSheets[activeSheet] = {
            ...newSheets[activeSheet],
            data: originalData
          }
          return newSheets
        })
        setOriginalData(null)
      }
      addNotification('success', '筛选已关闭', '已显示全部数据')
    }
  }, [currentSheet, selectedCell, filterMode, originalData, activeSheet, addNotification])
  

  
  const removeDuplicates = useCallback(() => {
    if (!currentSheet || currentSheet.data.length <= 1) {
      addNotification('info', '提示', '数据不足，无法删除重复项')
      return
    }
    
    const headerRow = currentSheet.data[0]
    const dataRows = currentSheet.data.slice(1)
    const seen = new Set<string>()
    const uniqueRows: CellData[][] = []
    let duplicatesRemoved = 0
    
    for (const row of dataRows) {
      const rowKey = row.map(cell => String(cell?.value ?? '')).join('|')
      if (!seen.has(rowKey)) {
        seen.add(rowKey)
        uniqueRows.push(row)
      } else {
        duplicatesRemoved++
      }
    }
    
    setSheets(prev => {
      const newSheets = [...prev]
      newSheets[activeSheet] = {
        ...newSheets[activeSheet],
        data: [headerRow, ...uniqueRows]
      }
      return newSheets
    })
    
    addNotification('success', '删除重复项', `已删除 ${duplicatesRemoved} 条重复数据`)
  }, [currentSheet, activeSheet, addNotification])
  
  const dataValidation = useCallback(() => {
    addNotification('info', '数据验证', '数据验证功能开发中')
  }, [addNotification])
  
  const spellCheck = useCallback(() => {
    addNotification('info', '拼写检查', '拼写检查功能开发中')
  }, [addNotification])
  
  const addComment = useCallback(() => {
    addNotification('info', '新建批注', '批注功能开发中')
  }, [addNotification])
  
  const protectSheet = useCallback(() => {
    addNotification('info', '保护工作表', '工作表保护功能开发中')
  }, [addNotification])
  
  const renderToolbar = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#f8f8f8] border-b border-[#e0e0e0]">
            <div className="flex items-center gap-0.5 border-r border-[#d0d0d0] pr-2 mr-2">
              <button onClick={copyCell} className="px-2 py-1 text-xs hover:bg-[#e8e8e8] rounded flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {t('excel.copyBtn', language)}
              </button>
              <button onClick={pasteCell} className="px-2 py-1 text-xs hover:bg-[#e8e8e8] rounded flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {t('excel.pasteBtn', language)}
              </button>
            </div>
            
            <div className="flex items-center gap-0.5 border-r border-[#d0d0d0] pr-2 mr-2">
              <select 
                value={cellFont}
                onChange={e => setCellFont(e.target.value)}
                className="h-7 px-1.5 text-xs border border-[#d0d0d0] rounded bg-white"
              >
                <option>宋体</option>
                <option>微软雅黑</option>
                <option>Arial</option>
              </select>
              <select 
                value={cellFontSize}
                onChange={e => setCellFontSize(Number(e.target.value))}
                className="h-7 px-1.5 text-xs border border-[#d0d0d0] rounded bg-white w-12"
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-0.5 border-r border-[#d0d0d0] pr-2 mr-2">
              <button 
                onClick={() => setIsBold(!isBold)}
                className={`w-7 h-7 flex items-center justify-center rounded font-bold text-xs ${isBold ? 'bg-[#e8e8e8]' : 'hover:bg-[#e8e8e8]'}`}
              >B</button>
              <button 
                onClick={() => setIsItalic(!isItalic)}
                className={`w-7 h-7 flex items-center justify-center rounded italic text-xs ${isItalic ? 'bg-[#e8e8e8]' : 'hover:bg-[#e8e8e8]'}`}
              >I</button>
              <button 
                onClick={() => setIsUnderline(!isUnderline)}
                className={`w-7 h-7 flex items-center justify-center rounded underline text-xs ${isUnderline ? 'bg-[#e8e8e8]' : 'hover:bg-[#e8e8e8]'}`}
              >U</button>
            </div>
            
            <div className="flex items-center gap-0.5 border-r border-[#d0d0d0] pr-2 mr-2">
              <button onClick={() => addNotification('info', t('excel.alignLeft', language), t('excel.alignLeft', language))} className="px-2 py-1 text-xs hover:bg-[#e8e8e8] rounded">{t('excel.alignLeft', language)}</button>
              <button onClick={() => addNotification('info', t('excel.alignCenter', language), t('excel.alignCenter', language))} className="px-2 py-1 text-xs hover:bg-[#e8e8e8] rounded">{t('excel.alignCenter', language)}</button>
              <button onClick={() => addNotification('info', t('excel.alignRight', language), t('excel.alignRight', language))} className="px-2 py-1 text-xs hover:bg-[#e8e8e8] rounded">{t('excel.alignRight', language)}</button>
            </div>
            
            <div className="flex items-center gap-0.5">
              <button onClick={() => addNotification('info', t('excel.border', language), t('excel.border', language))} className="px-2 py-1 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.border', language)}</button>
              <button onClick={() => addNotification('info', t('excel.fillColor', language), t('excel.fillColor', language))} className="px-2 py-1 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.fillColor', language)}</button>
            </div>
          </div>
        )
      case 'insert':
        return (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#f8f8f8] border-b border-[#e0e0e0]">
            <button onClick={insertChart} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded flex items-center gap-1 border border-[#d0d0d0]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {t('excel.chartBtn', language)}
            </button>
            <button onClick={insertPivotTable} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.pivotTableBtn', language)}</button>
            <button onClick={insertImage} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.imageBtn', language)}</button>
            <button onClick={insertShape} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.shapeBtn', language)}</button>
            <button onClick={insertLink} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.linkBtn', language)}</button>
            <button onClick={insertComment} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.commentBtn', language)}</button>
          </div>
        )
      case 'pageLayout':
        return (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#f8f8f8] border-b border-[#e0e0e0]">
            <div className="flex items-center gap-0.5 border-r border-[#d0d0d0] pr-2 mr-2">
              <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.pageSetup', language)}</button>
              <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.printArea', language)}</button>
              <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.printTitles', language)}</button>
            </div>
            <div className="flex items-center gap-0.5 border-r border-[#d0d0d0] pr-2 mr-2">
              <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.pageBreakPreview', language)}</button>
              <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.pageLayoutView', language)}</button>
            </div>
            <div className="flex items-center gap-0.5">
              <select className="h-7 px-1.5 text-xs border border-[#d0d0d0] rounded bg-white">
                <option>A4</option>
                <option>A3</option>
                <option>Letter</option>
                <option>Legal</option>
              </select>
              <select className="h-7 px-1.5 text-xs border border-[#d0d0d0] rounded bg-white">
                <option>{t('excel.portrait', language)}</option>
                <option>{t('excel.landscape', language)}</option>
              </select>
            </div>
          </div>
        )
      case 'formula':
        return (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#f8f8f8] border-b border-[#e0e0e0]">
            <button 
              onClick={() => {
                if (selectedCell) {
                  handleCellEdit(selectedCell.row, selectedCell.col, '=SUM()')
                }
              }}
              className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]"
            >
              Σ {t('excel.sumBtn', language)}
            </button>
            <button 
              onClick={() => {
                if (selectedCell) {
                  handleCellEdit(selectedCell.row, selectedCell.col, '=AVERAGE()')
                }
              }}
              className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]"
            >
              {t('excel.averageBtn', language)}
            </button>
            <button 
              onClick={() => {
                if (selectedCell) {
                  handleCellEdit(selectedCell.row, selectedCell.col, '=COUNT()')
                }
              }}
              className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]"
            >
              {t('excel.countBtn', language)}
            </button>
            <button 
              onClick={() => {
                if (selectedCell) {
                  handleCellEdit(selectedCell.row, selectedCell.col, '=MAX()')
                }
              }}
              className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]"
            >
              {t('excel.maxBtn', language)}
            </button>
            <button 
              onClick={() => {
                if (selectedCell) {
                  handleCellEdit(selectedCell.row, selectedCell.col, '=MIN()')
                }
              }}
              className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]"
            >
              {t('excel.minBtn', language)}
            </button>
            <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.insertFunction', language)}</button>
            <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.formulaAudit', language)}</button>
          </div>
        )
      case 'data':
        return (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#f8f8f8] border-b border-[#e0e0e0]">
            <button onClick={sortAscending} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0] flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              {t('excel.ascending', language)}
            </button>
            <button onClick={sortDescending} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0] flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              {t('excel.descending', language)}
            </button>
            <button onClick={filterData} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.filterBtn', language)}</button>
            <button onClick={() => addNotification('info', t('excel.subtotalBtn', language), t('excel.subtotalBtn', language))} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.subtotalBtn', language)}</button>
            <button onClick={dataValidation} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.textToColumnsBtn', language)}</button>
            <button onClick={removeDuplicates} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.removeDuplicates', language)}</button>
            <button onClick={() => addNotification('info', t('excel.textToColumnsBtn', language), t('excel.textToColumnsBtn', language))} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.textToColumnsBtn', language)}</button>
          </div>
        )
      case 'review':
        return (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#f8f8f8] border-b border-[#e0e0e0]">
            <div className="flex items-center gap-0.5 border-r border-[#d0d0d0] pr-2 mr-2">
              <button onClick={spellCheck} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.spellCheckBtn', language)}</button>
              <button onClick={() => addNotification('info', t('excel.thesaurusBtn', language), t('excel.thesaurusBtn', language))} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.thesaurusBtn', language)}</button>
            </div>
            <div className="flex items-center gap-0.5 border-r border-[#d0d0d0] pr-2 mr-2">
              <button onClick={addComment} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.newCommentBtn', language)}</button>
              <button onClick={() => addNotification('info', t('excel.deleteCommentBtn', language), t('excel.deleteCommentBtn', language))} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.deleteCommentBtn', language)}</button>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={protectSheet} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.protectSheetBtn', language)}</button>
              <button onClick={() => addNotification('info', t('excel.protectWorkbookBtn', language), t('excel.protectWorkbookBtn', language))} className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.protectWorkbookBtn', language)}</button>
            </div>
          </div>
        )
      case 'view':
        return (
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#f8f8f8] border-b border-[#e0e0e0]">
            <div className="flex items-center gap-1 border border-[#d0d0d0] rounded px-1">
              <button 
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="w-6 h-6 flex items-center justify-center hover:bg-[#e8e8e8] text-xs"
              >-</button>
              <span className="text-xs w-12 text-center">{zoom}%</span>
              <button 
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="w-6 h-6 flex items-center justify-center hover:bg-[#e8e8e8] text-xs"
              >+</button>
            </div>
            <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.freezePanes', language)}</button>
            <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.showGridlines', language)}</button>
            <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.showHeaders', language)}</button>
            <button className="px-3 py-1.5 text-xs hover:bg-[#e8e8e8] rounded border border-[#d0d0d0]">{t('excel.fullScreen', language)}</button>
          </div>
        )
    }
  }
  
  return (
    <div className="h-screen flex flex-col bg-[#f0f0f0]">
      <div className="bg-white border-b border-[#e0e0e0] flex items-center h-11 px-2">
        <div className="flex items-center gap-2 px-2">
          <button 
            onClick={() => navigate('/')}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f0f0f0]"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="w-7 h-7 bg-[#107c10] rounded flex items-center justify-center">
            <span className="text-white font-bold text-xs">X</span>
          </div>
        </div>
        
        <div className="flex items-center text-xs ml-3 text-gray-600 relative">
          <div className="relative">
            <button 
              onClick={() => setActiveDropdown(activeDropdown === 'file' ? null : 'file')}
              className="px-2 py-1 hover:bg-[#f0f0f0] rounded"
            >
              {t('menu.file', language)}
            </button>
            {activeDropdown === 'file' && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e0e0e0] rounded shadow-lg z-50 min-w-[150px]">
                <button onClick={() => { handleNewWorkbook(); setActiveDropdown(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[#f5f5f5]">{t('menu.new', language)}</button>
                <button onClick={() => { handleOpenFile(); setActiveDropdown(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[#f5f5f5]">{t('menu.open', language)}</button>
                <button onClick={() => { handleSaveFile(); setActiveDropdown(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[#f5f5f5]">{t('menu.save', language)}</button>
                <div className="border-t border-[#e0e0e0] my-1"></div>
                <button onClick={() => { addNotification('info', t('menu.export', language), t('menu.export', language)); setActiveDropdown(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[#f5f5f5]">{t('menu.export', language)}</button>
                <button onClick={() => { addNotification('info', t('menu.print', language), t('menu.print', language)); setActiveDropdown(null); }} className="w-full px-3 py-1.5 text-left hover:bg-[#f5f5f5]">{t('menu.print', language)}</button>
              </div>
            )}
          </div>
          <button 
            onClick={() => setActiveTab('home')}
            className={`px-2 py-1 rounded ${activeTab === 'home' ? 'bg-[#e8e8e8] text-[#107c10]' : 'hover:bg-[#f0f0f0]'}`}
          >
            {t('ribbon.home', language)}
          </button>
          <button 
            onClick={() => setActiveTab('insert')}
            className={`px-2 py-1 rounded ${activeTab === 'insert' ? 'bg-[#e8e8e8] text-[#107c10]' : 'hover:bg-[#f0f0f0]'}`}
          >
            {t('ribbon.insert', language)}
          </button>
          <button 
            onClick={() => setActiveTab('pageLayout')}
            className={`px-2 py-1 rounded ${activeTab === 'pageLayout' ? 'bg-[#e8e8e8] text-[#107c10]' : 'hover:bg-[#f0f0f0]'}`}
          >
            {t('ribbon.pageLayout', language)}
          </button>
          <button 
            onClick={() => setActiveTab('formula')}
            className={`px-2 py-1 rounded ${activeTab === 'formula' ? 'bg-[#e8e8e8] text-[#107c10]' : 'hover:bg-[#f0f0f0]'}`}
          >
            {t('ribbon.formula', language)}
          </button>
          <button 
            onClick={() => setActiveTab('data')}
            className={`px-2 py-1 rounded ${activeTab === 'data' ? 'bg-[#e8e8e8] text-[#107c10]' : 'hover:bg-[#f0f0f0]'}`}
          >
            {t('ribbon.data', language)}
          </button>
          <button 
            onClick={() => setActiveTab('review')}
            className={`px-2 py-1 rounded ${activeTab === 'review' ? 'bg-[#e8e8e8] text-[#107c10]' : 'hover:bg-[#f0f0f0]'}`}
          >
            {t('ribbon.review', language)}
          </button>
          <button 
            onClick={() => setActiveTab('view')}
            className={`px-2 py-1 rounded ${activeTab === 'view' ? 'bg-[#e8e8e8] text-[#107c10]' : 'hover:bg-[#f0f0f0]'}`}
          >
            {t('ribbon.view', language)}
          </button>
        </div>
        
        <div className="flex-1 text-center">
          <span className="text-sm text-gray-600">{currentFile?.name || t('excel.newWorkbook', language)}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={handleNewWorkbook} className="px-2 py-1 text-xs hover:bg-[#f0f0f0] rounded">{t('menu.new', language)}</button>
          <button onClick={handleOpenFile} className="px-2 py-1 text-xs hover:bg-[#f0f0f0] rounded">{t('menu.open', language)}</button>
          <button 
            onClick={handleSaveFile}
            className="px-3 py-1 text-xs bg-[#107c10] text-white rounded hover:bg-[#0d660d]"
            disabled={sheets.length === 0}
          >
            {t('menu.save', language)}
          </button>
          <button 
            onClick={() => setShowAIPanel(!showAIPanel)}
            className={`px-2 py-1 text-xs rounded ${showAIPanel ? 'bg-[#107c10] text-white' : 'hover:bg-[#f0f0f0]'}`}
          >
            AI
          </button>
        </div>
      </div>
      
      <div className="bg-[#f8f8f8] border-b border-[#e0e0e0]">
        {renderToolbar()}
      </div>
      
      <div className="bg-white border-b border-[#e0e0e0] h-7 flex items-center px-2">
        <div className="flex items-center border border-[#d0d0d0] rounded text-xs bg-white">
          <span className="px-2 py-0.5 bg-[#f5f5f5] border-r border-[#d0d0d0] min-w-[50px] text-center font-medium">
            {selectedCell ? `${columnLabels[selectedCell.col]}${selectedCell.row + 1}` : 'A1'}
          </span>
          <input 
            type="text"
            value={editingCell ? editValue : ''}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && editingCell) {
                handleCellEdit(editingCell.row, editingCell.col, editValue)
              }
            }}
            className="px-2 py-0.5 min-w-[300px] outline-none text-xs"
            placeholder={editingCell ? t('excel.enterCommand', language) : ''}
            readOnly={!editingCell}
          />
        </div>
        
        <div className="flex items-center gap-1 ml-4">
          <button className="px-2 py-0.5 text-xs hover:bg-[#f0f0f0] rounded">fx</button>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500">
            {editingCell ? t('excel.editing', language) : t('excel.ready', language)}
          </span>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {showAIPanel && (
          <div className="w-64 bg-white border-r border-[#e5e5e5] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e5e5] bg-[#f8f8f8]">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-sm font-medium text-gray-700">{t('excel.aiAssistant', language)}</span>
              </div>
              <button 
                onClick={() => setShowAIPanel(false)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#e8e8e8]"
              >
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {aiPanel.messages.length === 0 ? (
                <div className="text-center text-gray-400 py-6">
                  <p className="text-xs">输入指令分析数据</p>
                  <div className="mt-3 space-y-1">
                    {['分析数据', '求和计算', '生成图表', '数据排序'].map(cmd => (
                      <button
                        key={cmd}
                        onClick={() => { setAIInput(cmd); setTimeout(handleAICommand, 100) }}
                        className="w-full px-2 py-1 text-xs bg-[#f0f0f0] hover:bg-[#e8e8e8] rounded"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                aiPanel.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded text-xs whitespace-pre-wrap ${
                      msg.role === 'user' ? 'bg-[#e8f4e8] ml-2' : 'bg-[#f5f5f5] mr-2'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-2 border-t border-[#e5e5e5]">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={aiInput}
                  onChange={e => setAIInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAICommand()}
                  placeholder="输入指令..."
                  className="flex-1 px-2 py-1 text-xs border border-[#d0d0d0] rounded focus:outline-none focus:border-[#107c10]"
                />
                <button 
                  onClick={handleAICommand}
                  disabled={isLoading}
                  className="px-2 py-1 text-xs bg-[#107c10] text-white rounded hover:bg-[#0d660d] disabled:opacity-50"
                >
                  发送
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div 
            className="flex-1 overflow-auto bg-white"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
          >
            {sheets.length > 0 ? (
              <table className="border-collapse table-fixed">
                <thead className="sticky top-0 bg-[#f5f5f5] z-10">
                  <tr>
                    <th className="w-10 h-5 border border-[#d0d0d0] bg-[#f0f0f0] text-xs font-normal"></th>
                    {Array.from({ length: colCount }, (_, i) => (
                      <th
                        key={i}
                        className="w-20 min-w-[60px] h-5 border border-[#d0d0d0] bg-[#f0f0f0] text-xs font-normal text-gray-600"
                      >
                        {columnLabels[i]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }, (_, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="w-10 h-5 border border-[#d0d0d0] bg-[#f0f0f0] text-xs text-center text-gray-500">
                        {rowIndex + 1}
                      </td>
                      {Array.from({ length: colCount }, (_, colIndex) => {
                        const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex
                        
                        return (
                          <td
                            key={colIndex}
                            onClick={() => handleCellClick(rowIndex, colIndex)}
                            onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                            className={`h-5 border border-[#d0d0d0] px-1 text-xs ${
                              isSelected ? 'ring-2 ring-[#107c10] ring-inset bg-[#e8f4e8]' : ''
                            }`}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleCellEdit(rowIndex, colIndex, editValue)
                                  if (e.key === 'Escape') setEditingCell(null)
                                }}
                                onBlur={() => handleCellEdit(rowIndex, colIndex, editValue)}
                                autoFocus
                                className="w-full h-full outline-none bg-white text-xs"
                              />
                            ) : (
                              getCellValue(rowIndex, colIndex)
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-base mb-4">创建或打开工作簿</p>
                <div className="flex gap-2">
                  <button onClick={handleNewWorkbook} className="px-4 py-2 bg-[#107c10] text-white text-sm rounded hover:bg-[#0d660d]">
                    新建
                  </button>
                  <button onClick={handleOpenFile} className="px-4 py-2 bg-white border border-[#d0d0d0] text-sm rounded hover:bg-[#f5f5f5]">
                    打开
                  </button>
                </div>
                <p className="text-xs mt-3">支持 .xlsx, .xls, .csv 格式</p>
              </div>
            )}
          </div>
          
          {sheets.length > 0 && (
            <div className="h-6 bg-[#f5f5f5] border-t border-[#e0e0e0] flex items-center px-1">
              {sheets.map((sheet, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSheet(i)}
                  className={`px-3 py-0.5 text-xs border border-[#d0d0d0] mr-0.5 ${
                    i === activeSheet 
                      ? 'bg-white border-b-white text-[#107c10]' 
                      : 'bg-[#e8e8e8] hover:bg-[#f0f0f0]'
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
              <button 
                onClick={addSheet}
                className="w-5 h-5 flex items-center justify-center text-gray-500 hover:bg-[#e0e0e0] rounded text-xs ml-1"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="h-5 bg-[#f5f5f5] border-t border-[#e0e0e0] flex items-center px-3 text-xs text-gray-500 justify-between">
        <div className="flex items-center gap-3">
          <span>就绪</span>
          {selectedCell && (
            <span>单元格: {columnLabels[selectedCell.col]}{selectedCell.row + 1}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>100% 本地处理</span>
          <span>缩放: {zoom}%</span>
        </div>
      </div>
    </div>
  )
}

export interface DataAnalysisResult {
  summary: {
    totalRows: number
    totalColumns: number
    numericColumns: number
    textColumns: number
    dateColumns: number
  }
  statistics: {
    column: string
    type: 'numeric' | 'text' | 'date'
    stats?: {
      min?: number
      max?: number
      mean?: number
      median?: number
      std?: number
      sum?: number
    }
    uniqueCount?: number
    topValues?: Array<{ value: string; count: number }>
  }[]
  correlations: Array<{
    column1: string
    column2: string
    correlation: number
  }>
  trends: Array<{
    column: string
    trend: 'increasing' | 'decreasing' | 'stable'
    slope: number
  }>
  outliers: Array<{
    column: string
    rowIndex: number
    value: number
    reason: string
  }>
}

export function analyzeData(data: any[][]): DataAnalysisResult {
  if (!data || data.length === 0) {
    return {
      summary: { totalRows: 0, totalColumns: 0, numericColumns: 0, textColumns: 0, dateColumns: 0 },
      statistics: [],
      correlations: [],
      trends: [],
      outliers: []
    }
  }

  const headers = data[0]
  const rows = data.slice(1)
  const totalRows = rows.length
  const totalColumns = headers.length

  const columnTypes: Array<'numeric' | 'text' | 'date'> = []
  const numericColumns: number[] = []
  const textColumns: number[] = []
  const dateColumns: number[] = []

  headers.forEach((_, colIndex) => {
    const values = rows.map(row => row[colIndex]).filter(v => v !== null && v !== undefined && v !== '')
    const numericCount = values.filter(v => !isNaN(parseFloat(v))).length
    const dateCount = values.filter(v => !isNaN(Date.parse(v))).length
    
    if (numericCount > values.length * 0.7) {
      columnTypes.push('numeric')
      numericColumns.push(colIndex)
    } else if (dateCount > values.length * 0.7) {
      columnTypes.push('date')
      dateColumns.push(colIndex)
    } else {
      columnTypes.push('text')
      textColumns.push(colIndex)
    }
  })

  const statistics = headers.map((header, colIndex) => {
    const type = columnTypes[colIndex]
    const values = rows.map(row => row[colIndex]).filter(v => v !== null && v !== undefined && v !== '')
    
    if (type === 'numeric') {
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v))
      const sorted = [...numericValues].sort((a, b) => a - b)
      const sum = numericValues.reduce((a, b) => a + b, 0)
      const mean = sum / numericValues.length
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length
      const std = Math.sqrt(variance)
      
      return {
        column: header,
        type: 'numeric' as const,
        stats: {
          min: sorted[0],
          max: sorted[sorted.length - 1],
          mean,
          median,
          std,
          sum
        }
      }
    } else {
      const valueCounts = new Map<string, number>()
      values.forEach(v => {
        const str = String(v)
        valueCounts.set(str, (valueCounts.get(str) || 0) + 1)
      })
      
      const topValues = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }))
      
      return {
        column: header,
        type: type as 'text' | 'date',
        uniqueCount: valueCounts.size,
        topValues
      }
    }
  })

  const correlations: DataAnalysisResult['correlations'] = []
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col1 = numericColumns[i]
      const col2 = numericColumns[j]
      const values1 = rows.map(row => parseFloat(row[col1])).filter(v => !isNaN(v))
      const values2 = rows.map(row => parseFloat(row[col2])).filter(v => !isNaN(v))
      
      if (values1.length > 10 && values2.length > 10) {
        const correlation = calculateCorrelation(values1.slice(0, Math.min(values1.length, values2.length)), 
                                                  values2.slice(0, Math.min(values1.length, values2.length)))
        if (Math.abs(correlation) > 0.3) {
          correlations.push({
            column1: headers[col1],
            column2: headers[col2],
            correlation
          })
        }
      }
    }
  }

  const trends: DataAnalysisResult['trends'] = numericColumns.map(colIndex => {
    const values = rows.map(row => parseFloat(row[colIndex])).filter(v => !isNaN(v))
    const slope = calculateTrendSlope(values)
    return {
      column: headers[colIndex],
      trend: slope > 0.01 ? 'increasing' as const : slope < -0.01 ? 'decreasing' as const : 'stable' as const,
      slope
    }
  })

  const outliers: DataAnalysisResult['outliers'] = []
  numericColumns.forEach(colIndex => {
    const values = rows.map((row, rowIndex) => ({ value: parseFloat(row[colIndex]), rowIndex }))
      .filter(v => !isNaN(v.value))
    
    if (values.length > 10) {
      const numericValues = values.map(v => v.value)
      const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
      const std = Math.sqrt(numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length)
      
      values.forEach(v => {
        const zScore = Math.abs((v.value - mean) / std)
        if (zScore > 3) {
          outliers.push({
            column: headers[colIndex],
            rowIndex: v.rowIndex + 2,
            value: v.value,
            reason: `Z-score: ${zScore.toFixed(2)}`
          })
        }
      })
    }
  })

  return {
    summary: {
      totalRows,
      totalColumns,
      numericColumns: numericColumns.length,
      textColumns: textColumns.length,
      dateColumns: dateColumns.length
    },
    statistics,
    correlations,
    trends,
    outliers
  }
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n === 0) return 0
  
  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n
  
  let numerator = 0
  let denomX = 0
  let denomY = 0
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }
  
  const denominator = Math.sqrt(denomX * denomY)
  return denominator === 0 ? 0 : numerator / denominator
}

function calculateTrendSlope(values: number[]): number {
  if (values.length < 2) return 0
  
  const n = values.length
  const sumX = (n * (n - 1)) / 2
  const sumY = values.reduce((a, b) => a + b, 0)
  const sumXY = values.reduce((acc, val, i) => acc + i * val, 0)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  return slope
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area'
  title: string
  xAxis: string
  yAxis: string
  data: any
  options?: {
    colors?: string[]
    showLegend?: boolean
    showGrid?: boolean
    animate?: boolean
  }
}

export function suggestCharts(data: any[][]): ChartConfig[] {
  const analysis = analyzeData(data)
  const charts: ChartConfig[] = []
  
  if (analysis.summary.numericColumns >= 2) {
    const numericHeaders = analysis.statistics
      .filter(s => s.type === 'numeric')
      .map(s => s.column)
    
    if (numericHeaders.length >= 2) {
      charts.push({
        type: 'scatter',
        title: '相关性分析',
        xAxis: numericHeaders[0],
        yAxis: numericHeaders[1],
        data: data.slice(1).map(row => ({
          x: parseFloat(row[data[0].indexOf(numericHeaders[0])]),
          y: parseFloat(row[data[0].indexOf(numericHeaders[1])])
        })),
        options: {
          showGrid: true,
          animate: true
        }
      })
    }
  }
  
  if (analysis.summary.numericColumns >= 1 && analysis.summary.textColumns >= 1) {
    const textHeader = analysis.statistics.find(s => s.type === 'text')?.column
    const numericHeader = analysis.statistics.find(s => s.type === 'numeric')?.column
    
    if (textHeader && numericHeader) {
      charts.push({
        type: 'bar',
        title: '分类统计',
        xAxis: textHeader,
        yAxis: numericHeader,
        data: analysis.statistics.find(s => s.column === textHeader)?.topValues || [],
        options: {
          showLegend: false,
          showGrid: true,
          animate: true
        }
      })
    }
  }
  
  if (analysis.summary.numericColumns >= 1) {
    const numericHeader = analysis.statistics.find(s => s.type === 'numeric')?.column
    
    if (numericHeader) {
      charts.push({
        type: 'line',
        title: '趋势分析',
        xAxis: '序号',
        yAxis: numericHeader,
        data: data.slice(1).map((row, i) => ({
          x: i + 1,
          y: parseFloat(row[data[0].indexOf(numericHeader)])
        })),
        options: {
          showGrid: true,
          animate: true
        }
      })
    }
  }
  
  return charts
}

export interface AnimationConfig {
  type: 'fadeIn' | 'slideIn' | 'zoomIn' | 'bounce' | 'rotate' | 'pulse'
  duration: number
  delay: number
  easing: 'linear' | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut'
}

export const PPTAnimations = {
  fadeIn: {
    keyframes: [
      { opacity: 0 },
      { opacity: 1 }
    ],
    options: { duration: 500, easing: 'ease-out' }
  },
  slideIn: {
    keyframes: [
      { transform: 'translateX(-100%)', opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-out' }
  },
  zoomIn: {
    keyframes: [
      { transform: 'scale(0.5)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1 }
    ],
    options: { duration: 400, easing: 'ease-out' }
  },
  bounce: {
    keyframes: [
      { transform: 'translateY(-20px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1, offset: 0.6 },
      { transform: 'translateY(-10px)', offset: 0.8 },
      { transform: 'translateY(0)' }
    ],
    options: { duration: 800, easing: 'ease-out' }
  },
  rotate: {
    keyframes: [
      { transform: 'rotate(-180deg)', opacity: 0 },
      { transform: 'rotate(0)', opacity: 1 }
    ],
    options: { duration: 600, easing: 'ease-out' }
  },
  pulse: {
    keyframes: [
      { transform: 'scale(1)' },
      { transform: 'scale(1.1)' },
      { transform: 'scale(1)' }
    ],
    options: { duration: 600, iterations: 1 }
  }
}

export function applyAnimation(element: HTMLElement, animationType: keyof typeof PPTAnimations): Promise<void> {
  return new Promise((resolve) => {
    const animation = PPTAnimations[animationType]
    const animationInstance = element.animate(animation.keyframes, animation.options)
    
    animationInstance.onfinish = () => resolve()
  })
}

export interface WordFormatting {
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through'
  color: string
  backgroundColor: string
  lineHeight: number
  letterSpacing: number
  textAlign: 'left' | 'center' | 'right' | 'justify'
  textIndent: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
}

export const WordStyles = {
  title: {
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    fontSize: 24,
    fontWeight: 'bold' as const,
    fontStyle: 'normal' as const,
    textDecoration: 'none' as const,
    color: '#1a1a1a',
    backgroundColor: 'transparent',
    lineHeight: 1.5,
    letterSpacing: 0,
    textAlign: 'center' as const,
    textIndent: 0,
    marginTop: 12,
    marginBottom: 12,
    marginLeft: 0,
    marginRight: 0
  },
  heading1: {
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    fontSize: 18,
    fontWeight: 'bold' as const,
    fontStyle: 'normal' as const,
    textDecoration: 'none' as const,
    color: '#2b5797',
    backgroundColor: 'transparent',
    lineHeight: 1.5,
    letterSpacing: 0,
    textAlign: 'left' as const,
    textIndent: 0,
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 0,
    marginRight: 0
  },
  heading2: {
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    fontSize: 16,
    fontWeight: 'bold' as const,
    fontStyle: 'normal' as const,
    textDecoration: 'none' as const,
    color: '#333333',
    backgroundColor: 'transparent',
    lineHeight: 1.5,
    letterSpacing: 0,
    textAlign: 'left' as const,
    textIndent: 0,
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 0,
    marginRight: 0
  },
  body: {
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    fontSize: 12,
    fontWeight: 'normal' as const,
    fontStyle: 'normal' as const,
    textDecoration: 'none' as const,
    color: '#333333',
    backgroundColor: 'transparent',
    lineHeight: 1.8,
    letterSpacing: 0.5,
    textAlign: 'justify' as const,
    textIndent: 24,
    marginTop: 0,
    marginBottom: 6,
    marginLeft: 0,
    marginRight: 0
  },
  quote: {
    fontFamily: 'Microsoft YaHei, Arial, sans-serif',
    fontSize: 11,
    fontWeight: 'normal' as const,
    fontStyle: 'italic' as const,
    textDecoration: 'none' as const,
    color: '#666666',
    backgroundColor: '#f5f5f5',
    lineHeight: 1.6,
    letterSpacing: 0,
    textAlign: 'left' as const,
    textIndent: 0,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 20,
    marginRight: 20
  },
  code: {
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 11,
    fontWeight: 'normal' as const,
    fontStyle: 'normal' as const,
    textDecoration: 'none' as const,
    color: '#d63384',
    backgroundColor: '#f8f9fa',
    lineHeight: 1.5,
    letterSpacing: 0,
    textAlign: 'left' as const,
    textIndent: 0,
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 0,
    marginRight: 0
  }
}

export function applyFormatting(element: HTMLElement, formatting: Partial<WordFormatting>): void {
  if (formatting.fontFamily) element.style.fontFamily = formatting.fontFamily
  if (formatting.fontSize) element.style.fontSize = `${formatting.fontSize}px`
  if (formatting.fontWeight) element.style.fontWeight = formatting.fontWeight
  if (formatting.fontStyle) element.style.fontStyle = formatting.fontStyle
  if (formatting.textDecoration) element.style.textDecoration = formatting.textDecoration
  if (formatting.color) element.style.color = formatting.color
  if (formatting.backgroundColor) element.style.backgroundColor = formatting.backgroundColor
  if (formatting.lineHeight) element.style.lineHeight = formatting.lineHeight.toString()
  if (formatting.letterSpacing) element.style.letterSpacing = `${formatting.letterSpacing}px`
  if (formatting.textAlign) element.style.textAlign = formatting.textAlign
  if (formatting.textIndent) element.style.textIndent = `${formatting.textIndent}px`
  if (formatting.marginTop !== undefined) element.style.marginTop = `${formatting.marginTop}px`
  if (formatting.marginBottom !== undefined) element.style.marginBottom = `${formatting.marginBottom}px`
  if (formatting.marginLeft !== undefined) element.style.marginLeft = `${formatting.marginLeft}px`
  if (formatting.marginRight !== undefined) element.style.marginRight = `${formatting.marginRight}px`
}

export function detectFormatting(text: string): Partial<WordFormatting> {
  if (text.startsWith('# ')) {
    return WordStyles.title
  }
  
  if (text.startsWith('## ')) {
    return WordStyles.heading1
  }
  
  if (text.startsWith('### ')) {
    return WordStyles.heading2
  }
  
  if (text.startsWith('>') || text.startsWith('"')) {
    return WordStyles.quote
  }
  
  if (text.startsWith('```') || text.includes('function') || text.includes('const ') || text.includes('let ')) {
    return WordStyles.code
  }
  
  return WordStyles.body
}

export function formatDocument(content: string): Array<{ text: string; formatting: Partial<WordFormatting> }> {
  const lines = content.split('\n')
  
  return lines.map(line => {
    const trimmedLine = line.trim()
    const formatting = detectFormatting(trimmedLine)
    
    let text = trimmedLine
    if (text.startsWith('# ')) text = text.substring(2)
    if (text.startsWith('## ')) text = text.substring(3)
    if (text.startsWith('### ')) text = text.substring(4)
    if (text.startsWith('> ')) text = text.substring(2)
    
    return { text, formatting }
  })
}

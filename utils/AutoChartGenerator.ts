export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    borderWidth?: number
  }[]
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter'
  title: string
  data: ChartData
  options?: Record<string, unknown>
  width?: number
  height?: number
}

export interface DataExtraction {
  hasData: boolean
  dataType: 'table' | 'list' | 'text' | 'mixed'
  numbers: number[]
  labels: string[]
  rawText: string
}

const COLORS = [
  '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
  '#27ae60', '#8e44ad', '#2980b9', '#d35400', '#7f8c8d'
]

const CHART_COLORS = {
  primary: '#3498db',
  secondary: '#2ecc71',
  tertiary: '#e74c3c',
  quaternary: '#f39c12',
  quinary: '#9b59b6'
}

export function extractDataFromText(text: string): DataExtraction {
  const numberPattern = /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g
  const numbers = (text.match(numberPattern) || []).map(parseFloat)
  
  const tablePattern = /<table[^>]*>[\s\S]*?<\/table>/gi
  const tables = text.match(tablePattern) || []
  
  const listPattern = /<li[^>]*>(.*?)<\/li>/gi
  const lists = text.match(listPattern) || []
  
  const headingPattern = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi
  const headings = (text.match(headingPattern) || []).map(h => 
    h.replace(/<[^>]*>/g, '').trim()
  ).filter(h => h.length > 0)
  
  let labels: string[] = []
  
  if (headings.length > 0) {
    labels = headings
  } else if (tables.length > 0) {
    const tableText = (tables[0] || '').replace(/<[^>]*>/g, ' ')
    const tableWords = tableText.split(/\s+/).filter(w => w.length > 0 && !/^\d+$/.test(w))
    labels = tableWords.slice(0, 10)
  } else if (lists.length > 0) {
    labels = lists.map(l => l.replace(/<[^>]*>/g, '').trim()).filter(l => l.length > 0)
  } else {
    const words = text.replace(/<[^>]*>/g, ' ').split(/\s+/)
    labels = words.filter(w => w.length > 1 && !/^\d+$/.test(w)).slice(0, 10)
  }
  
  return {
    hasData: numbers.length > 0,
    dataType: tables.length > 0 ? 'table' : lists.length > 0 ? 'list' : 'text',
    numbers,
    labels: labels.slice(0, numbers.length || 10),
    rawText: text
  }
}

export function analyzeDataPattern(numbers: number[]): {
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  suitableCharts: ('bar' | 'line' | 'pie' | 'doughnut')[]
  hasNegative: boolean
  hasOutliers: boolean
} {
  if (numbers.length < 2) {
    return {
      trend: 'stable',
      suitableCharts: ['bar', 'pie'],
      hasNegative: numbers[0] < 0,
      hasOutliers: false
    }
  }
  
  const hasNegative = numbers.some(n => n < 0)
  
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length
  const stdDev = Math.sqrt(
    numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length
  )
  const hasOutliers = numbers.some(n => Math.abs(n - mean) > 2 * stdDev)
  
  let increasing = 0
  let decreasing = 0
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] > numbers[i - 1]) increasing++
    else if (numbers[i] < numbers[i - 1]) decreasing++
  }
  
  const total = increasing + decreasing
  let trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  if (total === 0) {
    trend = 'stable'
  } else if (increasing / total > 0.7) {
    trend = 'increasing'
  } else if (decreasing / total > 0.7) {
    trend = 'decreasing'
  } else {
    trend = 'volatile'
  }
  
  const suitableCharts: ('bar' | 'line' | 'pie' | 'doughnut')[] = []
  
  suitableCharts.push('bar')
  
  if (numbers.length >= 3) {
    suitableCharts.push('line')
  }
  
  if (!hasNegative && numbers.length <= 8) {
    suitableCharts.push('pie')
    suitableCharts.push('doughnut')
  }
  
  return { trend, suitableCharts, hasNegative, hasOutliers }
}

export function generateChartConfig(
  extraction: DataExtraction,
  chartType?: 'bar' | 'line' | 'pie' | 'doughnut',
  title?: string
): ChartConfig | null {
  if (!extraction.hasData || extraction.numbers.length === 0) {
    return null
  }
  
  const analysis = analyzeDataPattern(extraction.numbers)
  
  const type = chartType || analysis.suitableCharts[0] || 'bar'
  
  const labels = extraction.labels.length > 0 
    ? extraction.labels.slice(0, extraction.numbers.length)
    : extraction.numbers.map((_, i) => `数据 ${i + 1}`)
  
  const data: ChartData = {
    labels,
    datasets: [{
      label: title || '数据',
      data: extraction.numbers.slice(0, labels.length),
      backgroundColor: type === 'pie' || type === 'doughnut' 
        ? COLORS.slice(0, labels.length)
        : COLORS[0],
      borderColor: type === 'line' ? COLORS[0] : undefined,
      borderWidth: type === 'line' ? 2 : 1
    }]
  }
  
  const options: Record<string, unknown> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: title || '数据分析图表'
      },
      legend: {
        display: type === 'pie' || type === 'doughnut',
        position: 'right'
      }
    },
    scales: type !== 'pie' && type !== 'doughnut' ? {
      y: {
        beginAtZero: !analysis.hasNegative,
        title: {
          display: true,
          text: '数值'
        }
      },
      x: {
        title: {
          display: true,
          text: '类别'
        }
      }
    } : undefined
  }
  
  return {
    type,
    title: title || '数据分析图表',
    data,
    options,
    width: 600,
    height: 400
  }
}

export function generateChartHTML(config: ChartConfig): string {
  const canvasId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  const chartData = {
    type: config.type,
    data: config.data,
    options: {
      ...config.options,
      responsive: true,
      maintainAspectRatio: false
    }
  }
  
  return `
<div class="chart-container" style="width: ${config.width || 600}px; height: ${config.height || 400}px; margin: 20px auto; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <canvas id="${canvasId}" style="max-width: 100%;"></canvas>
</div>
<script>
(function() {
  var ctx = document.getElementById('${canvasId}');
  if (!ctx) return;
  
  if (typeof Chart === 'undefined') {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = function() {
      createChart();
    };
    document.head.appendChild(script);
  } else {
    createChart();
  }
  
  function createChart() {
    new Chart(ctx, ${JSON.stringify(chartData)});
  }
})();
</script>
`
}

export function generateSVGChart(config: ChartConfig): string {
  const { type, data, title, width = 600, height = 400 } = config
  
  if (type === 'pie' || type === 'doughnut') {
    return generateSVGPieChart(data, title, width, height, type === 'doughnut')
  }
  
  return generateSVGBarChart(data, title, width, height, type === 'line')
}

function generateSVGBarChart(
  data: ChartData, 
  title: string, 
  width: number, 
  height: number,
  isLine: boolean
): string {
  const padding = { top: 60, right: 40, bottom: 60, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  
  const values = data.datasets[0].data
  const labels = data.labels
  const maxValue = Math.max(...values) * 1.1
  const minValue = Math.min(0, ...values)
  const range = maxValue - minValue
  
  const barWidth = chartWidth / labels.length * 0.7
  const barGap = chartWidth / labels.length * 0.3
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="max-width: 100%; height: auto;">`
  
  svg += `
    <style>
      .chart-title { font-family: 'SimHei', sans-serif; font-size: 16px; font-weight: bold; }
      .axis-label { font-family: 'SimSun', serif; font-size: 12px; }
      .bar { transition: opacity 0.2s; }
      .bar:hover { opacity: 0.8; }
      .grid-line { stroke: #e0e0e0; stroke-width: 1; }
      .axis { stroke: #333; stroke-width: 1; }
    </style>
    
    <text x="${width / 2}" y="30" text-anchor="middle" class="chart-title">${title}</text>
    
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="axis"/>
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="axis"/>
  `
  
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i
    const value = Math.round(maxValue - (range / 5) * i)
    svg += `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"/>
      <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="axis-label">${value}</text>
    `
  }
  
  if (isLine) {
    let pathD = ''
    values.forEach((value, i) => {
      const x = padding.left + (chartWidth / labels.length) * (i + 0.5)
      const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight
      if (i === 0) {
        pathD += `M ${x} ${y}`
      } else {
        pathD += ` L ${x} ${y}`
      }
      
      svg += `
        <circle cx="${x}" cy="${y}" r="5" fill="${COLORS[0]}" class="bar"/>
        <text x="${x}" y="${height - padding.bottom + 20}" text-anchor="middle" class="axis-label">${labels[i]}</text>
      `
    })
    svg += `<path d="${pathD}" fill="none" stroke="${COLORS[0]}" stroke-width="2"/>`
  } else {
    values.forEach((value, i) => {
      const x = padding.left + (chartWidth / labels.length) * i + barGap / 2
      const barHeight = ((value - minValue) / range) * chartHeight
      const y = height - padding.bottom - barHeight
      
      svg += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${COLORS[i % COLORS.length]}" class="bar"/>
        <text x="${x + barWidth / 2}" y="${height - padding.bottom + 20}" text-anchor="middle" class="axis-label">${labels[i]}</text>
      `
    })
  }
  
  svg += '</svg>'
  return svg
}

function generateSVGPieChart(
  data: ChartData,
  title: string,
  width: number,
  height: number,
  isDoughnut: boolean
): string {
  const values = data.datasets[0].data
  const labels = data.labels
  const total = values.reduce((a, b) => a + b, 0)
  
  const centerX = width / 2 - 80
  const centerY = height / 2
  const radius = Math.min(width, height) / 2 - 80
  const innerRadius = isDoughnut ? radius * 0.5 : 0
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="max-width: 100%; height: auto;">`
  
  svg += `
    <style>
      .chart-title { font-family: 'SimHei', sans-serif; font-size: 16px; font-weight: bold; }
      .legend-text { font-family: 'SimSun', serif; font-size: 11px; }
      .pie-slice { transition: opacity 0.2s; }
      .pie-slice:hover { opacity: 0.8; }
    </style>
    
    <text x="${width / 2}" y="30" text-anchor="middle" class="chart-title">${title}</text>
  `
  
  let currentAngle = -Math.PI / 2
  
  values.forEach((value, i) => {
    const sliceAngle = (value / total) * 2 * Math.PI
    const endAngle = currentAngle + sliceAngle
    
    const x1 = centerX + radius * Math.cos(currentAngle)
    const y1 = centerY + radius * Math.sin(currentAngle)
    const x2 = centerX + radius * Math.cos(endAngle)
    const y2 = centerY + radius * Math.sin(endAngle)
    
    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0
    
    let pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`
    
    if (isDoughnut) {
      const ix1 = centerX + innerRadius * Math.cos(currentAngle)
      const iy1 = centerY + innerRadius * Math.sin(currentAngle)
      const ix2 = centerX + innerRadius * Math.cos(endAngle)
      const iy2 = centerY + innerRadius * Math.sin(endAngle)
      
      pathData = `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1} Z`
    }
    
    svg += `<path d="${pathData}" fill="${COLORS[i % COLORS.length]}" class="pie-slice"/>`
    
    const legendX = width - 150
    const legendY = 60 + i * 20
    svg += `
      <rect x="${legendX}" y="${legendY - 10}" width="12" height="12" fill="${COLORS[i % COLORS.length]}"/>
      <text x="${legendX + 18}" y="${legendY}" class="legend-text">${labels[i]}: ${((value / total) * 100).toFixed(1)}%</text>
    `
    
    currentAngle = endAngle
  })
  
  svg += '</svg>'
  return svg
}

export function autoGenerateChartsFromContent(html: string): string {
  const extraction = extractDataFromText(html)
  
  if (!extraction.hasData) {
    return html
  }
  
  const analysis = analyzeDataPattern(extraction.numbers)
  
  const chartConfig = generateChartConfig(
    extraction,
    analysis.suitableCharts[0],
    '数据分析图表'
  )
  
  if (!chartConfig) {
    return html
  }
  
  const chartSVG = generateSVGChart(chartConfig)
  
  const chartSection = `
<div class="auto-generated-chart" style="margin: 30px 0; text-align: center;">
  <h3 style="text-align: center; margin-bottom: 15px; font-size: 14pt; color: #34495e;">📊 数据可视化</h3>
  ${chartSVG}
  <p style="text-align: center; font-size: 12px; color: #666; margin-top: 10px;">图表说明：${analysis.trend === 'increasing' ? '数据呈上升趋势' : analysis.trend === 'decreasing' ? '数据呈下降趋势' : analysis.trend === 'volatile' ? '数据波动较大' : '数据相对稳定'}</p>
</div>
`
  
  const insertPosition = html.lastIndexOf('</div>')
  if (insertPosition > 0) {
    return html.slice(0, insertPosition) + chartSection + html.slice(insertPosition)
  }
  
  return html + chartSection
}

export function detectAndGenerateCharts(html: string): {
  hasChartData: boolean
  charts: ChartConfig[]
  enhancedHtml: string
} {
  const extraction = extractDataFromText(html)
  
  if (!extraction.hasData || extraction.numbers.length < 3) {
    return {
      hasChartData: false,
      charts: [],
      enhancedHtml: html
    }
  }
  
  const analysis = analyzeDataPattern(extraction.numbers)
  const charts: ChartConfig[] = []
  
  analysis.suitableCharts.slice(0, 2).forEach(chartType => {
    const config = generateChartConfig(extraction, chartType)
    if (config) {
      charts.push(config)
    }
  })
  
  const enhancedHtml = autoGenerateChartsFromContent(html)
  
  return {
    hasChartData: charts.length > 0,
    charts,
    enhancedHtml
  }
}

export const chartGenerator = {
  extractDataFromText,
  analyzeDataPattern,
  generateChartConfig,
  generateChartHTML,
  generateSVGChart,
  autoGenerateChartsFromContent,
  detectAndGenerateCharts,
  COLORS,
  CHART_COLORS
}

export default chartGenerator

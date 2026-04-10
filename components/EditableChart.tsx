import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

export interface ChartDataItem {
  label: string
  value: number
  color?: string
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut'
  title: string
  data: ChartDataItem[]
  showLegend?: boolean
  showValues?: boolean
  animate?: boolean
}

interface EditableChartProps {
  config: ChartConfig
  onChange?: (config: ChartConfig) => void
  editable?: boolean
  width?: number
  height?: number
}

const DEFAULT_COLORS = [
  '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
]

export function EditableChart({
  config,
  onChange,
  editable = false,
  width = 600,
  height = 400
}: EditableChartProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<ChartDataItem[]>(config.data)
  const [editTitle, setEditTitle] = useState(config.title)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    setEditData(config.data)
    setEditTitle(config.title)
  }, [config.data, config.title])

  const colors = useMemo(() => {
    return config.data.map((item, index) => 
      item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
    )
  }, [config.data])

  const handleSave = useCallback(() => {
    onChange?.({
      ...config,
      title: editTitle,
      data: editData
    })
    setIsEditing(false)
  }, [config, editTitle, editData, onChange])

  const handleDataChange = useCallback((index: number, field: 'label' | 'value', value: string | number) => {
    setEditData(prev => {
      const newData = [...prev]
      newData[index] = { ...newData[index], [field]: value }
      return newData
    })
  }, [])

  const handleAddData = useCallback(() => {
    setEditData(prev => [...prev, { label: `数据 ${prev.length + 1}`, value: 0 }])
  }, [])

  const handleRemoveData = useCallback((index: number) => {
    setEditData(prev => prev.filter((_, i) => i !== index))
  }, [])

  const maxValue = useMemo(() => {
    return Math.max(...config.data.map(d => d.value)) * 1.1
  }, [config.data])

  const total = useMemo(() => {
    return config.data.reduce((sum, d) => sum + d.value, 0)
  }, [config.data])

  const renderBarChart = () => {
    const padding = { top: 60, right: 40, bottom: 80, left: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom
    const barWidth = chartWidth / config.data.length * 0.7
    const barGap = chartWidth / config.data.length * 0.3

    return (
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <style>
          {`
            .chart-title { font-family: 'Microsoft YaHei', sans-serif; font-size: 16px; font-weight: bold; fill: #2c3e50; }
            .axis-label { font-family: 'Microsoft YaHei', sans-serif; font-size: 12px; fill: #666; }
            .bar-value { font-family: 'Microsoft YaHei', sans-serif; font-size: 11px; fill: #333; font-weight: 500; }
            .grid-line { stroke: #e8e8e8; stroke-width: 1; }
            .axis { stroke: #ccc; stroke-width: 1; }
            .bar { transition: all 0.3s ease; cursor: pointer; }
            .bar:hover { filter: brightness(1.1); }
          `}
        </style>
        
        <text x={width / 2} y={30} textAnchor="middle" className="chart-title">
          {config.title}
        </text>
        
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="axis" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="axis" />
        
        {Array.from({ length: 5 }).map((_, i) => {
          const y = padding.top + (chartHeight / 5) * i
          const value = Math.round(maxValue - (maxValue / 5) * i)
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="grid-line" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="axis-label">{value}</text>
            </g>
          )
        })}
        
        {config.data.map((item, index) => {
          const x = padding.left + (chartWidth / config.data.length) * index + barGap / 2
          const barHeight = (item.value / maxValue) * chartHeight
          const y = height - padding.bottom - barHeight
          
          return (
            <g key={index}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={colors[index]}
                className="bar"
                rx={4}
                ry={4}
              />
              {config.showValues && (
                <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="bar-value">
                  {item.value}
                </text>
              )}
              <text 
                x={x + barWidth / 2} 
                y={height - padding.bottom + 20} 
                textAnchor="middle" 
                className="axis-label"
                transform={`rotate(-30, ${x + barWidth / 2}, ${height - padding.bottom + 20})`}
              >
                {item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const renderLineChart = () => {
    const padding = { top: 60, right: 40, bottom: 80, left: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const points = config.data.map((item, index) => {
      const x = padding.left + (chartWidth / (config.data.length - 1 || 1)) * index
      const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight
      return { x, y, value: item.value, label: item.label }
    })

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <style>
          {`
            .chart-title { font-family: 'Microsoft YaHei', sans-serif; font-size: 16px; font-weight: bold; fill: #2c3e50; }
            .axis-label { font-family: 'Microsoft YaHei', sans-serif; font-size: 12px; fill: #666; }
            .line-point { transition: all 0.3s ease; cursor: pointer; }
            .line-point:hover { r: 8; }
            .grid-line { stroke: #e8e8e8; stroke-width: 1; }
            .axis { stroke: #ccc; stroke-width: 1; }
            .line-path { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
            .area-fill { opacity: 0.1; }
          `}
        </style>
        
        <text x={width / 2} y={30} textAnchor="middle" className="chart-title">
          {config.title}
        </text>
        
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="axis" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="axis" />
        
        {Array.from({ length: 5 }).map((_, i) => {
          const y = padding.top + (chartHeight / 5) * i
          const value = Math.round(maxValue - (maxValue / 5) * i)
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="grid-line" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="axis-label">{value}</text>
            </g>
          )
        })}
        
        <path 
          d={`${pathD} L ${points[points.length - 1]?.x || 0} ${height - padding.bottom} L ${points[0]?.x || 0} ${height - padding.bottom} Z`}
          fill={colors[0]}
          className="area-fill"
        />
        
        <path d={pathD} stroke={colors[0]} className="line-path" />
        
        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r={6} fill={colors[0]} className="line-point" stroke="white" strokeWidth={2} />
            {config.showValues && (
              <text x={point.x} y={point.y - 12} textAnchor="middle" className="axis-label" style={{ fontSize: '11px', fontWeight: '500' }}>
                {point.value}
              </text>
            )}
            <text x={point.x} y={height - padding.bottom + 20} textAnchor="middle" className="axis-label">
              {point.label.length > 6 ? point.label.substring(0, 6) + '...' : point.label}
            </text>
          </g>
        ))}
      </svg>
    )
  }

  const renderPieChart = (isDoughnut: boolean = false) => {
    const centerX = width / 2 - 80
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 80
    const innerRadius = isDoughnut ? radius * 0.6 : 0

    let currentAngle = -Math.PI / 2
    const slices = config.data.map((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI
      const endAngle = currentAngle + sliceAngle
      const midAngle = currentAngle + sliceAngle / 2
      
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
      
      const labelX = centerX + (radius + 30) * Math.cos(midAngle)
      const labelY = centerY + (radius + 30) * Math.sin(midAngle)
      
      const slice = {
        pathData,
        color: colors[index],
        label: item.label,
        value: item.value,
        percentage: ((item.value / total) * 100).toFixed(1),
        labelX,
        labelY,
        midAngle
      }
      
      currentAngle = endAngle
      return slice
    })

    return (
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <style>
          {`
            .chart-title { font-family: 'Microsoft YaHei', sans-serif; font-size: 16px; font-weight: bold; fill: #2c3e50; }
            .pie-slice { transition: all 0.3s ease; cursor: pointer; }
            .pie-slice:hover { filter: brightness(1.1); transform-origin: center; }
            .legend-text { font-family: 'Microsoft YaHei', sans-serif; font-size: 11px; fill: #333; }
            .percentage-text { font-family: 'Microsoft YaHei', sans-serif; font-size: 12px; fill: #333; font-weight: 500; }
          `}
        </style>
        
        <text x={width / 2} y={30} textAnchor="middle" className="chart-title">
          {config.title}
        </text>
        
        {slices.map((slice, index) => (
          <g key={index}>
            <path d={slice.pathData} fill={slice.color} className="pie-slice" />
          </g>
        ))}
        
        {config.showLegend && (
          <g transform={`translate(${width - 150}, 60)`}>
            {slices.map((slice, index) => (
              <g key={index} transform={`translate(0, ${index * 22})`}>
                <rect x={0} y={-10} width={14} height={14} fill={slice.color} rx={2} />
                <text x={20} y={2} className="legend-text">
                  {slice.label.length > 10 ? slice.label.substring(0, 10) + '...' : slice.label}: {slice.percentage}%
                </text>
              </g>
            ))}
          </g>
        )}
        
        {isDoughnut && (
          <g>
            <text x={centerX} y={centerY - 10} textAnchor="middle" className="percentage-text" style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {total}
            </text>
            <text x={centerX} y={centerY + 15} textAnchor="middle" className="legend-text">
              总计
            </text>
          </g>
        )}
      </svg>
    )
  }

  const renderChart = () => {
    switch (config.type) {
      case 'bar':
        return renderBarChart()
      case 'line':
        return renderLineChart()
      case 'pie':
        return renderPieChart(false)
      case 'doughnut':
        return renderPieChart(true)
      default:
        return renderBarChart()
    }
  }

  return (
    <div className="editable-chart" style={{ position: 'relative' }}>
      <div className="chart-container" style={{ background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        {renderChart()}
      </div>
      
      {editable && (
        <div className="chart-toolbar" style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: '8px 16px',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              ✏️ 编辑图表
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                style={{
                  padding: '8px 16px',
                  background: '#2ecc71',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ✓ 保存
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditData(config.data)
                  setEditTitle(config.title)
                }}
                style={{
                  padding: '8px 16px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ✕ 取消
              </button>
            </>
          )}
        </div>
      )}
      
      {isEditing && (
        <div className="chart-editor" style={{
          marginTop: '15px',
          padding: '15px',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>图表标题</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500' }}>数据项</label>
            {editData.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => handleDataChange(index, 'label', e.target.value)}
                  placeholder="标签"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                />
                <input
                  type="number"
                  value={item.value}
                  onChange={(e) => handleDataChange(index, 'value', parseFloat(e.target.value) || 0)}
                  placeholder="数值"
                  style={{
                    width: '100px',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                />
                <button
                  onClick={() => handleRemoveData(index)}
                  style={{
                    padding: '8px 12px',
                    background: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  删除
                </button>
              </div>
            ))}
            <button
              onClick={handleAddData}
              style={{
                width: '100%',
                padding: '10px',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              + 添加数据项
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function generateChartFromData(
  data: { labels: string[]; values: number[] },
  title: string = '数据分析图表',
  type: 'bar' | 'line' | 'pie' | 'doughnut' = 'bar'
): ChartConfig {
  const chartData: ChartDataItem[] = data.labels.map((label, index) => ({
    label,
    value: data.values[index] || 0
  }))

  return {
    type,
    title,
    data: chartData,
    showLegend: true,
    showValues: true,
    animate: true
  }
}

export function extractChartDataFromText(text: string): { labels: string[]; values: number[] } | null {
  const numberPattern = /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g
  const numbers = (text.match(numberPattern) || []).map(parseFloat)
  
  if (numbers.length < 2) {
    return null
  }
  
  const words = text.replace(/<[^>]*>/g, ' ').split(/\s+/)
  const labels = words.filter(w => w.length > 1 && !/^\d+$/.test(w)).slice(0, numbers.length)
  
  if (labels.length < numbers.length) {
    while (labels.length < numbers.length) {
      labels.push(`数据${labels.length + 1}`)
    }
  }
  
  return {
    labels: labels.slice(0, numbers.length),
    values: numbers.slice(0, numbers.length)
  }
}

export default EditableChart

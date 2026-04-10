import { useState, useCallback } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { t } from '@/i18n'

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'doughnut'

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    borderWidth?: number
    fill?: boolean
  }[]
}

export interface ChartConfig {
  type: ChartType
  title: string
  data: ChartData
  width: number
  height: number
  showLegend: boolean
  showGrid: boolean
}

interface ChartGeneratorDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (config: ChartConfig) => void
}

const defaultColors = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
]

export function ChartGeneratorDialog({ isOpen, onClose, onInsert }: ChartGeneratorDialogProps) {
  const { language } = useLanguageStore()
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [chartTitle, setChartTitle] = useState('图表标题')
  const [dataLabels, setDataLabels] = useState('一月，二月，三月，四月，五月')
  const [dataValues, setDataValues] = useState('100, 150, 200, 180, 220')
  const [datasetName, setDatasetName] = useState('销售额')
  const [width, setWidth] = useState(600)
  const [height, setHeight] = useState(400)
  const [showLegend, setShowLegend] = useState(true)
  const [showGrid, setShowGrid] = useState(true)


  const handleInsert = useCallback(() => {
    const labels = dataLabels.split(/[,,]/).map(s => s.trim()).filter(Boolean)
    const values = dataValues.split(/[,,]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n))

    const chartData: ChartData = {
      labels,
      datasets: [{
        label: datasetName,
        data: values,
        backgroundColor: chartType === 'pie' || chartType === 'doughnut' 
          ? defaultColors.slice(0, labels.length)
          : defaultColors[0],
        borderColor: defaultColors[0],
        borderWidth: 2,
        fill: chartType === 'area'
      }]
    }

    const config: ChartConfig = {
      type: chartType,
      title: chartTitle,
      data: chartData,
      width,
      height,
      showLegend,
      showGrid
    }

    onInsert(config)
    onClose()
  }, [chartType, chartTitle, dataLabels, dataValues, datasetName, width, height, showLegend, showGrid, onInsert, onClose])

  if (!isOpen) return null

  const renderChartPreview = () => {
    const labels = dataLabels.split(/[,,]/).map(s => s.trim()).filter(Boolean)
    const values = dataValues.split(/[,,]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
    const maxValue = Math.max(...values, 1)

    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h4 className="text-center font-semibold mb-4">{chartTitle}</h4>
        <div className="relative" style={{ height: '200px' }}>
          {chartType === 'bar' && (
            <div className="flex items-end justify-around h-full gap-2">
              {values.map((value, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div 
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: `${(value / maxValue) * 100}%` }}
                  />
                  <span className="text-xs text-gray-600 mt-1">{labels[i] || ''}</span>
                </div>
              ))}
            </div>
          )}

          {chartType === 'pie' && (
            <div className="flex items-center justify-center h-full">
              <svg viewBox="0 0 100 100" className="w-48 h-48">
                {values.map((value, i) => {
                  const startAngle = values.slice(0, i).reduce((sum, v) => sum + (v / maxValue) * 360, 0)
                  const angle = (value / maxValue) * 360
                  const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180)
                  const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180)
                  const x2 = 50 + 40 * Math.cos((startAngle + angle - 90) * Math.PI / 180)
                  const y2 = 50 + 40 * Math.sin((startAngle + angle - 90) * Math.PI / 180)
                  return (
                    <path
                      key={i}
                      d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
                      fill={defaultColors[i % defaultColors.length]}
                    />
                  )
                })}
              </svg>
            </div>
          )}

          {chartType === 'line' && (
            <div className="relative h-full">
              <svg viewBox="0 0 400 200" className="w-full h-full">
                {showGrid && (
                  <>
                    {[0, 1, 2, 3, 4].map(i => (
                      <line key={i} x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="#e5e5e5" strokeWidth="1" />
                    ))}
                  </>
                )}
                <polyline
                  fill="none"
                  stroke={defaultColors[0]}
                  strokeWidth="2"
                  points={values.map((v, i) => `${(i / (values.length - 1)) * 400},${200 - (v / maxValue) * 180}`).join(' ')}
                />
                {values.map((v, i) => (
                  <circle
                    key={i}
                    cx={(i / (values.length - 1)) * 400}
                    cy={200 - (v / maxValue) * 180}
                    r="4"
                    fill="white"
                    stroke={defaultColors[0]}
                    strokeWidth="2"
                  />
                ))}
              </svg>
              <div className="flex justify-around mt-2">
                {labels.map((label, i) => (
                  <span key={i} className="text-xs text-gray-600">{label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
          <h3 className="text-xl font-bold text-white">{t('excel.chart.title', language)}</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700">{t('excel.chart.config', language)}</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('excel.chart.type', language)}
                </label>
                <select
                  value={chartType}
                  onChange={e => setChartType(e.target.value as ChartType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bar">{t('excel.chart.bar', language)}</option>
                  <option value="line">{t('excel.chart.line', language)}</option>
                  <option value="pie">{t('excel.chart.pie', language)}</option>
                  <option value="area">{t('excel.chart.area', language)}</option>
                  <option value="scatter">{t('excel.chart.scatter', language)}</option>
                  <option value="doughnut">{t('excel.chart.doughnut', language)}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('excel.chart.title', language)}
                </label>
                <input
                  type="text"
                  value={chartTitle}
                  onChange={e => setChartTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('excel.chart.datasetName', language)}
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={e => setDatasetName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('excel.chart.labels', language)}
                </label>
                <input
                  type="text"
                  value={dataLabels}
                  onChange={e => setDataLabels(e.target.value)}
                  placeholder="一月，二月，三月，..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('excel.chart.values', language)}
                </label>
                <input
                  type="text"
                  value={dataValues}
                  onChange={e => setDataValues(e.target.value)}
                  placeholder="100, 150, 200, ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('excel.chart.width', language)}
                  </label>
                  <input
                    type="number"
                    value={width}
                    onChange={e => setWidth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('excel.chart.height', language)}
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={e => setHeight(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showLegend}
                    onChange={e => setShowLegend(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{t('excel.chart.showLegend', language)}</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={e => setShowGrid(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{t('excel.chart.showGrid', language)}</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700">{t('excel.chart.preview', language)}</h4>
              {renderChartPreview()}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {t('common.cancel', language)}
          </button>
          <button
            onClick={handleInsert}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            {t('excel.chart.insert', language)}
          </button>
        </div>
      </div>
    </div>
  )
}

export function generateChartHTML(config: ChartConfig): string {
  const { type, title, data, width, height, showLegend, showGrid } = config
  
  const chartConfig = {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: title },
        legend: { display: showLegend },
        grid: { display: showGrid }
      }
    }
  }

  return `
    <div style="width: ${width}px; height: ${height}px; padding: 20px; font-family: 'SimSun', serif;">
      <h2 style="text-align: center; margin-bottom: 20px; color: #1a1a2e;">${title}</h2>
      <div style="position: relative; width: 100%; height: calc(100% - 60px);">
        <canvas id="chart"></canvas>
      </div>
      <script>
        const ctx = document.getElementById('chart').getContext('2d');
        new Chart(ctx, ${JSON.stringify(chartConfig)});
      </script>
    </div>
  `
}

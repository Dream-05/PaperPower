import { useState, useCallback, useMemo } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { t } from '@/i18n'

export interface PivotField {
  name: string
  type: 'string' | 'number' | 'date'
}

export interface PivotConfig {
  rows: string[]
  columns: string[]
  values: string[]
  valueAggregation: 'sum' | 'count' | 'avg' | 'min' | 'max'
  filter?: { field: string; value: string }
}

export interface PivotTableData {
  headers: string[]
  rows: string[][]
  totals: { rowTotals: number[]; colTotals: number[]; grandTotal: number }
}

interface PivotTableDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (config: PivotConfig) => void
  fields: PivotField[]
  data: Record<string, any>[]
}

const defaultConfig: PivotConfig = {
  rows: [],
  columns: [],
  values: [],
  valueAggregation: 'sum'
}

export function PivotTableDialog({ isOpen, onClose, onInsert, fields, data }: PivotTableDialogProps) {
  const { language } = useLanguageStore()
  const [config, setConfig] = useState<PivotConfig>(defaultConfig)

  const handleInsert = useCallback(() => {
    onInsert(config)
    onClose()
  }, [config, onInsert, onClose])

  const toggleField = (field: string, type: 'rows' | 'columns' | 'values') => {
    setConfig(prev => {
      const current = prev[type]
      if (current.includes(field)) {
        return { ...prev, [type]: current.filter(f => f !== field) }
      } else {
        return { ...prev, [type]: [...current, field] }
      }
    })
  }

  const renderPreview = useMemo(() => {
    if (config.rows.length === 0 || config.values.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-400">
          {t('excel.pivot.noPreview', language)}
        </div>
      )
    }

    const previewData = generatePivotTable(data, config)
    
    return (
      <div className="overflow-auto max-h-64">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-blue-50">
              {previewData.headers.map((header, i) => (
                <th key={i} className="border border-gray-300 px-3 py-2 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell, j) => (
                  <td key={j} className="border border-gray-300 px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }, [config, data, language])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
          <h3 className="text-xl font-bold text-white">{t('excel.pivot.title', language)}</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700">{t('excel.pivot.fields', language)}</h4>
              <div className="space-y-2">
                {fields.map(field => (
                  <div
                    key={field.name}
                    className="p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{field.name}</div>
                        <div className="text-xs text-gray-500">{field.type}</div>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => toggleField(field.name, 'rows')}
                          className={`px-2 py-1 text-xs rounded ${config.rows.includes(field.name) ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          {t('excel.pivot.row', language)}
                        </button>
                        <button
                          onClick={() => toggleField(field.name, 'columns')}
                          className={`px-2 py-1 text-xs rounded ${config.columns.includes(field.name) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          {t('excel.pivot.col', language)}
                        </button>
                        <button
                          onClick={() => toggleField(field.name, 'values')}
                          className={`px-2 py-1 text-xs rounded ${config.values.includes(field.name) ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          {t('excel.pivot.value', language)}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 space-y-4">
              <h4 className="font-semibold text-gray-700">{t('excel.pivot.config', language)}</h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('excel.pivot.rows', language)} ({config.rows.length})
                  </label>
                  <div className="border border-gray-200 rounded-lg p-2 min-h-[80px] bg-gray-50">
                    {config.rows.length === 0 ? (
                      <p className="text-gray-400 text-xs text-center">{t('excel.pivot.empty', language)}</p>
                    ) : (
                      config.rows.map(field => (
                        <div key={field} className="flex items-center justify-between py-1">
                          <span className="text-sm">{field}</span>
                          <button onClick={() => toggleField(field, 'rows')} className="text-red-500 hover:text-red-700">×</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('excel.pivot.columns', language)} ({config.columns.length})
                  </label>
                  <div className="border border-gray-200 rounded-lg p-2 min-h-[80px] bg-gray-50">
                    {config.columns.length === 0 ? (
                      <p className="text-gray-400 text-xs text-center">{t('excel.pivot.empty', language)}</p>
                    ) : (
                      config.columns.map(field => (
                        <div key={field} className="flex items-center justify-between py-1">
                          <span className="text-sm">{field}</span>
                          <button onClick={() => toggleField(field, 'columns')} className="text-red-500 hover:text-red-700">×</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('excel.pivot.values', language)} ({config.values.length})
                  </label>
                  <div className="border border-gray-200 rounded-lg p-2 min-h-[80px] bg-gray-50">
                    {config.values.length === 0 ? (
                      <p className="text-gray-400 text-xs text-center">{t('excel.pivot.empty', language)}</p>
                    ) : (
                      config.values.map(field => (
                        <div key={field} className="flex items-center justify-between py-1">
                          <span className="text-sm">{field}</span>
                          <button onClick={() => toggleField(field, 'values')} className="text-red-500 hover:text-red-700">×</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('excel.pivot.aggregation', language)}
                </label>
                <select
                  value={config.valueAggregation}
                  onChange={e => setConfig({ ...config, valueAggregation: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sum">{t('excel.pivot.sum', language)}</option>
                  <option value="count">{t('excel.pivot.count', language)}</option>
                  <option value="avg">{t('excel.pivot.avg', language)}</option>
                  <option value="min">{t('excel.pivot.min', language)}</option>
                  <option value="max">{t('excel.pivot.max', language)}</option>
                </select>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-3">{t('excel.pivot.preview', language)}</h4>
                {renderPreview}
              </div>
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
            disabled={config.rows.length === 0 || config.values.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('excel.pivot.insert', language)}
          </button>
        </div>
      </div>
    </div>
  )
}

export function generatePivotTable(data: Record<string, any>[], config: PivotConfig): PivotTableData {
  const headers = [...config.rows, ...config.columns, ...config.values]
  const rows: string[][] = []
  
  const grouped = groupBy(data, config.rows)
  
  for (const [key, items] of Object.entries(grouped)) {
    const row: string[] = []
    
    config.rows.forEach(field => {
      const keyValue = key.split('|')[config.rows.indexOf(field)]
      row.push(keyValue || '')
    })
    
    config.columns.forEach(field => {
      const subGroup = groupBy(items, [field])
      for (const [, subItems] of Object.entries(subGroup)) {
        const value = aggregate(subItems.map(item => item[config.values[0]]), config.valueAggregation)
        row.push(value.toString())
      }
    })
    
    rows.push(row)
  }
  
  return {
    headers,
    rows,
    totals: { rowTotals: [], colTotals: [], grandTotal: 0 }
  }
}

function groupBy(data: Record<string, any>[], fields: string[]): Record<string, Record<string, any>[]> {
  return data.reduce((acc, item) => {
    const key = fields.map(f => item[f]).join('|')
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(item)
    return acc
  }, {} as Record<string, Record<string, any>[]>)
}

function aggregate(values: number[], method: string): number {
  if (values.length === 0) return 0
  
  switch (method) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'count':
      return values.length
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return 0
  }
}

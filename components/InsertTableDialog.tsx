import { useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'

interface InsertTableDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (rows: number, cols: number, options: TableOptions) => void
}

export interface TableOptions {
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none'
  borderWidth: number
  borderColor: string
  cellPadding: number
  cellSpacing: number
  headerRow: boolean
  headerColumn: boolean
  tableWidth: 'auto' | 'full' | 'custom'
  customWidth?: number
  widthUnit: 'px' | '%'
}

export const defaultTableOptions: TableOptions = {
  borderStyle: 'solid',
  borderWidth: 1,
  borderColor: '#000000',
  cellPadding: 8,
  cellSpacing: 0,
  headerRow: false,
  headerColumn: false,
  tableWidth: 'auto',
  widthUnit: '%'
}

export function InsertTableDialog({ isOpen, onClose, onInsert }: InsertTableDialogProps) {
  const { language } = useLanguageStore()
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [options, setOptions] = useState<TableOptions>(defaultTableOptions)
  
  if (!isOpen) return null
  
  const handleInsert = () => {
    onInsert(rows, cols, options)
    onClose()
  }
  
  const updateOption = <K extends keyof TableOptions>(key: K, value: TableOptions[K]) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '插入表格' : 'Insert Table'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {language === 'zh' ? '行数' : 'Rows'}
              </label>
              <input
                type="number"
                value={rows}
                onChange={e => setRows(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 border border-[#d0d0d0] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {language === 'zh' ? '列数' : 'Columns'}
              </label>
              <input
                type="number"
                value={cols}
                onChange={e => setCols(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 border border-[#d0d0d0] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
                max={26}
              />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              {language === 'zh' ? '表格样式' : 'Table Style'}
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {language === 'zh' ? '边框样式' : 'Border Style'}
                </label>
                <select
                  value={options.borderStyle}
                  onChange={e => updateOption('borderStyle', e.target.value as TableOptions['borderStyle'])}
                  className="w-full h-8 px-2 text-xs border border-[#d0d0d0] rounded"
                >
                  <option value="solid">{language === 'zh' ? '实线' : 'Solid'}</option>
                  <option value="dashed">{language === 'zh' ? '虚线' : 'Dashed'}</option>
                  <option value="dotted">{language === 'zh' ? '点线' : 'Dotted'}</option>
                  <option value="none">{language === 'zh' ? '无边框' : 'None'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {language === 'zh' ? '边框宽度' : 'Border Width'}
                </label>
                <input
                  type="number"
                  value={options.borderWidth}
                  onChange={e => updateOption('borderWidth', Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs border border-[#d0d0d0] rounded"
                  min={0}
                  max={10}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {language === 'zh' ? '边框颜色' : 'Border Color'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={options.borderColor}
                    onChange={e => updateOption('borderColor', e.target.value)}
                    className="w-8 h-8 border border-[#d0d0d0] rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={options.borderColor}
                    onChange={e => updateOption('borderColor', e.target.value)}
                    className="flex-1 h-8 px-2 text-xs border border-[#d0d0d0] rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {language === 'zh' ? '单元格边距' : 'Cell Padding'}
                </label>
                <input
                  type="number"
                  value={options.cellPadding}
                  onChange={e => updateOption('cellPadding', Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs border border-[#d0d0d0] rounded"
                  min={0}
                  max={50}
                />
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              {language === 'zh' ? '表格选项' : 'Table Options'}
            </h4>
            
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.headerRow}
                  onChange={e => updateOption('headerRow', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">
                  {language === 'zh' ? '首行作为标题行' : 'First row as header'}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.headerColumn}
                  onChange={e => updateOption('headerColumn', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">
                  {language === 'zh' ? '首列作为标题列' : 'First column as header'}
                </span>
              </label>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              {language === 'zh' ? '表格宽度' : 'Table Width'}
            </h4>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tableWidth"
                  checked={options.tableWidth === 'auto'}
                  onChange={() => updateOption('tableWidth', 'auto')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">
                  {language === 'zh' ? '自动' : 'Auto'}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tableWidth"
                  checked={options.tableWidth === 'full'}
                  onChange={() => updateOption('tableWidth', 'full')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">
                  {language === 'zh' ? '100%' : '100%'}
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tableWidth"
                  checked={options.tableWidth === 'custom'}
                  onChange={() => updateOption('tableWidth', 'custom')}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">
                  {language === 'zh' ? '自定义' : 'Custom'}
                </span>
              </label>
            </div>
            
            {options.tableWidth === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  value={options.customWidth || 500}
                  onChange={e => updateOption('customWidth', Number(e.target.value))}
                  className="w-24 h-8 px-2 text-xs border border-[#d0d0d0] rounded"
                  min={1}
                />
                <select
                  value={options.widthUnit}
                  onChange={e => updateOption('widthUnit', e.target.value as 'px' | '%')}
                  className="h-8 px-2 text-xs border border-[#d0d0d0] rounded"
                >
                  <option value="px">px</option>
                  <option value="%">%</option>
                </select>
              </div>
            )}
          </div>
          
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              {language === 'zh' ? '预览' : 'Preview'}
            </h4>
            <div className="border border-[#e0e0e0] rounded p-2 bg-gray-50">
              <table 
                className="w-full"
                style={{
                  borderCollapse: 'collapse',
                  borderStyle: options.borderStyle,
                  borderWidth: options.borderStyle === 'none' ? 0 : options.borderWidth,
                  borderColor: options.borderColor,
                }}
              >
                <tbody>
                  {Array.from({ length: Math.min(rows, 5) }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {Array.from({ length: Math.min(cols, 5) }).map((_, colIndex) => (
                        <td
                          key={colIndex}
                          style={{
                            borderStyle: options.borderStyle,
                            borderWidth: options.borderStyle === 'none' ? 0 : options.borderWidth,
                            borderColor: options.borderColor,
                            padding: options.cellPadding,
                            backgroundColor: (options.headerRow && rowIndex === 0) || 
                              (options.headerColumn && colIndex === 0) ? '#f0f0f0' : 'transparent',
                            fontWeight: (options.headerRow && rowIndex === 0) || 
                              (options.headerColumn && colIndex === 0) ? 'bold' : 'normal',
                          }}
                          className="text-xs text-center"
                        >
                          {rowIndex === 0 && colIndex === 0 ? language === 'zh' ? '标题' : 'Header' : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(rows > 5 || cols > 5) && (
                <div className="text-xs text-gray-400 text-center mt-1">
                  {language === 'zh' ? `显示前5行5列，共${rows}行${cols}列` : `Showing first 5x5, total ${rows}x${cols}`}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            {language === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button
            onClick={handleInsert}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
          >
            {language === 'zh' ? '插入' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function generateTableHTML(rows: number, cols: number, options: TableOptions): string {
  let html = '<table style="'
  html += `border-collapse: collapse; `
  html += `border-style: ${options.borderStyle}; `
  html += `border-width: ${options.borderStyle === 'none' ? 0 : options.borderWidth}px; `
  html += `border-color: ${options.borderColor}; `
  
  if (options.tableWidth === 'full') {
    html += 'width: 100%; '
  } else if (options.tableWidth === 'custom' && options.customWidth) {
    html += `width: ${options.customWidth}${options.widthUnit}; `
  }
  
  html += '">\n'
  
  for (let i = 0; i < rows; i++) {
    html += '<tr>\n'
    for (let j = 0; j < cols; j++) {
      const isHeader = (options.headerRow && i === 0) || (options.headerColumn && j === 0)
      const tag = isHeader ? 'th' : 'td'
      html += `<${tag} style="`
      html += `border-style: ${options.borderStyle}; `
      html += `border-width: ${options.borderStyle === 'none' ? 0 : options.borderWidth}px; `
      html += `border-color: ${options.borderColor}; `
      html += `padding: ${options.cellPadding}px; `
      if (isHeader) {
        html += 'background-color: #f0f0f0; font-weight: bold; '
      }
      html += `">&nbsp;</${tag}>\n`
    }
    html += '</tr>\n'
  }
  
  html += '</table>'
  return html
}

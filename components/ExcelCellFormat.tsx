import { useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'

export interface CellFormat {
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through'
  color: string
  backgroundColor: string
  horizontalAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
  wrapText: boolean
  numberFormat: string
  borderStyle: string
  borderColor: string
  borderTop: boolean
  borderBottom: boolean
  borderLeft: boolean
  borderRight: boolean
  mergeCells: boolean
  protection: 'locked' | 'unlocked' | 'hidden'
}

export const defaultCellFormat: CellFormat = {
  fontFamily: 'SimSun',
  fontSize: 11,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#000000',
  backgroundColor: 'transparent',
  horizontalAlign: 'left',
  verticalAlign: 'middle',
  wrapText: false,
  numberFormat: 'General',
  borderStyle: 'thin',
  borderColor: '#000000',
  borderTop: false,
  borderBottom: false,
  borderLeft: false,
  borderRight: false,
  mergeCells: false,
  protection: 'locked'
}

export const numberFormats = [
  { id: 'General', name: '常规', nameEn: 'General', example: '1234.5' },
  { id: 'Number', name: '数值', nameEn: 'Number', example: '1,234.50' },
  { id: 'Currency', name: '货币', nameEn: 'Currency', example: '¥1,234.50' },
  { id: 'Accounting', name: '会计', nameEn: 'Accounting', example: '¥ 1,234.50' },
  { id: 'ShortDate', name: '短日期', nameEn: 'Short Date', example: '2024/1/15' },
  { id: 'LongDate', name: '长日期', nameEn: 'Long Date', example: '2024年1月15日' },
  { id: 'Time', name: '时间', nameEn: 'Time', example: '14:30:00' },
  { id: 'Percentage', name: '百分比', nameEn: 'Percentage', example: '12.34%' },
  { id: 'Fraction', name: '分数', nameEn: 'Fraction', example: '1/2' },
  { id: 'Scientific', name: '科学计数', nameEn: 'Scientific', example: '1.23E+03' },
  { id: 'Text', name: '文本', nameEn: 'Text', example: '1234.5' },
  { id: 'Custom', name: '自定义', nameEn: 'Custom', example: '' },
]

export const borderStyles = [
  { id: 'none', name: '无', nameEn: 'None' },
  { id: 'thin', name: '细线', nameEn: 'Thin' },
  { id: 'medium', name: '中等', nameEn: 'Medium' },
  { id: 'dashed', name: '虚线', nameEn: 'Dashed' },
  { id: 'dotted', name: '点线', nameEn: 'Dotted' },
  { id: 'thick', name: '粗线', nameEn: 'Thick' },
  { id: 'double', name: '双线', nameEn: 'Double' },
]

export const fontFamilies = [
  { id: 'SimSun', name: '宋体' },
  { id: 'SimHei', name: '黑体' },
  { id: 'Microsoft YaHei', name: '微软雅黑' },
  { id: 'KaiTi', name: '楷体' },
  { id: 'FangSong', name: '仿宋' },
  { id: 'Arial', name: 'Arial' },
  { id: 'Times New Roman', name: 'Times New Roman' },
  { id: 'Courier New', name: 'Courier New' },
  { id: 'Verdana', name: 'Verdana' },
  { id: 'Georgia', name: 'Georgia' },
]

export const fontSizes = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]

interface CellFormatDialogProps {
  isOpen: boolean
  onClose: () => void
  format: CellFormat
  onChange: (format: CellFormat) => void
}

export function CellFormatDialog({ isOpen, onClose, format, onChange }: CellFormatDialogProps) {
  const { language } = useLanguageStore()
  const [activeTab, setActiveTab] = useState<'number' | 'alignment' | 'font' | 'border' | 'fill' | 'protection'>('number')
  
  if (!isOpen) return null
  
  const updateFormat = <K extends keyof CellFormat>(key: K, value: CellFormat[K]) => {
    onChange({ ...format, [key]: value })
  }
  
  const tabs = [
    { id: 'number', name: language === 'zh' ? '数字' : 'Number' },
    { id: 'alignment', name: language === 'zh' ? '对齐' : 'Alignment' },
    { id: 'font', name: language === 'zh' ? '字体' : 'Font' },
    { id: 'border', name: language === 'zh' ? '边框' : 'Border' },
    { id: 'fill', name: language === 'zh' ? '填充' : 'Fill' },
    { id: 'protection', name: language === 'zh' ? '保护' : 'Protection' },
  ]
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '设置单元格格式' : 'Format Cells'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 text-sm ${activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
              {tab.name}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'number' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '分类' : 'Category'}
                </label>
                <div className="border border-[#d0d0d0] rounded h-48 overflow-y-auto">
                  {numberFormats.map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => updateFormat('numberFormat', fmt.id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${format.numberFormat === fmt.id ? 'bg-blue-50 text-blue-600' : ''}`}
                    >
                      {language === 'zh' ? fmt.name : fmt.nameEn}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '示例' : 'Example'}
                </label>
                <div className="px-3 py-2 bg-gray-50 rounded text-sm">
                  {numberFormats.find(f => f.id === format.numberFormat)?.example || '-'}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'alignment' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '水平对齐' : 'Horizontal Alignment'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateFormat('horizontalAlign', 'left')}
                    className={`px-4 py-2 text-sm rounded border ${format.horizontalAlign === 'left' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    {language === 'zh' ? '左对齐' : 'Left'}
                  </button>
                  <button
                    onClick={() => updateFormat('horizontalAlign', 'center')}
                    className={`px-4 py-2 text-sm rounded border ${format.horizontalAlign === 'center' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    {language === 'zh' ? '居中' : 'Center'}
                  </button>
                  <button
                    onClick={() => updateFormat('horizontalAlign', 'right')}
                    className={`px-4 py-2 text-sm rounded border ${format.horizontalAlign === 'right' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    {language === 'zh' ? '右对齐' : 'Right'}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '垂直对齐' : 'Vertical Alignment'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateFormat('verticalAlign', 'top')}
                    className={`px-4 py-2 text-sm rounded border ${format.verticalAlign === 'top' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    {language === 'zh' ? '顶端' : 'Top'}
                  </button>
                  <button
                    onClick={() => updateFormat('verticalAlign', 'middle')}
                    className={`px-4 py-2 text-sm rounded border ${format.verticalAlign === 'middle' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    {language === 'zh' ? '居中' : 'Middle'}
                  </button>
                  <button
                    onClick={() => updateFormat('verticalAlign', 'bottom')}
                    className={`px-4 py-2 text-sm rounded border ${format.verticalAlign === 'bottom' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    {language === 'zh' ? '底端' : 'Bottom'}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={format.wrapText}
                    onChange={e => updateFormat('wrapText', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-600">
                    {language === 'zh' ? '自动换行' : 'Wrap Text'}
                  </span>
                </label>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={format.mergeCells}
                    onChange={e => updateFormat('mergeCells', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-600">
                    {language === 'zh' ? '合并单元格' : 'Merge Cells'}
                  </span>
                </label>
              </div>
            </div>
          )}
          
          {activeTab === 'font' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    {language === 'zh' ? '字体' : 'Font'}
                  </label>
                  <select
                    value={format.fontFamily}
                    onChange={e => updateFormat('fontFamily', e.target.value)}
                    className="w-full h-10 px-2 border border-[#d0d0d0] rounded"
                  >
                    {fontFamilies.map(font => (
                      <option key={font.id} value={font.id}>{font.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    {language === 'zh' ? '字号' : 'Size'}
                  </label>
                  <select
                    value={format.fontSize}
                    onChange={e => updateFormat('fontSize', Number(e.target.value))}
                    className="w-full h-10 px-2 border border-[#d0d0d0] rounded"
                  >
                    {fontSizes.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '字形' : 'Style'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateFormat('fontWeight', format.fontWeight === 'bold' ? 'normal' : 'bold')}
                    className={`px-4 py-2 text-sm rounded border font-bold ${format.fontWeight === 'bold' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    B
                  </button>
                  <button
                    onClick={() => updateFormat('fontStyle', format.fontStyle === 'italic' ? 'normal' : 'italic')}
                    className={`px-4 py-2 text-sm rounded border italic ${format.fontStyle === 'italic' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    I
                  </button>
                  <button
                    onClick={() => updateFormat('textDecoration', format.textDecoration === 'underline' ? 'none' : 'underline')}
                    className={`px-4 py-2 text-sm rounded border underline ${format.textDecoration === 'underline' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    U
                  </button>
                  <button
                    onClick={() => updateFormat('textDecoration', format.textDecoration === 'line-through' ? 'none' : 'line-through')}
                    className={`px-4 py-2 text-sm rounded border line-through ${format.textDecoration === 'line-through' ? 'bg-blue-50 border-blue-500' : 'border-[#d0d0d0]'}`}
                  >
                    S
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '颜色' : 'Color'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={format.color}
                    onChange={e => updateFormat('color', e.target.value)}
                    className="w-10 h-10 border border-[#d0d0d0] rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={format.color}
                    onChange={e => updateFormat('color', e.target.value)}
                    className="flex-1 h-10 px-2 border border-[#d0d0d0] rounded"
                  />
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'border' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '边框样式' : 'Border Style'}
                </label>
                <select
                  value={format.borderStyle}
                  onChange={e => updateFormat('borderStyle', e.target.value)}
                  className="w-full h-10 px-2 border border-[#d0d0d0] rounded"
                >
                  {borderStyles.map(style => (
                    <option key={style.id} value={style.id}>
                      {language === 'zh' ? style.name : style.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '边框颜色' : 'Border Color'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={format.borderColor}
                    onChange={e => updateFormat('borderColor', e.target.value)}
                    className="w-10 h-10 border border-[#d0d0d0] rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={format.borderColor}
                    onChange={e => updateFormat('borderColor', e.target.value)}
                    className="flex-1 h-10 px-2 border border-[#d0d0d0] rounded"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '边框位置' : 'Border Position'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={format.borderTop}
                      onChange={e => updateFormat('borderTop', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{language === 'zh' ? '上边框' : 'Top'}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={format.borderBottom}
                      onChange={e => updateFormat('borderBottom', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{language === 'zh' ? '下边框' : 'Bottom'}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={format.borderLeft}
                      onChange={e => updateFormat('borderLeft', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{language === 'zh' ? '左边框' : 'Left'}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={format.borderRight}
                      onChange={e => updateFormat('borderRight', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{language === 'zh' ? '右边框' : 'Right'}</span>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => onChange({ ...format, borderTop: true, borderBottom: true, borderLeft: true, borderRight: true })}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {language === 'zh' ? '所有边框' : 'All Borders'}
                </button>
                <button
                  onClick={() => onChange({ ...format, borderTop: false, borderBottom: false, borderLeft: false, borderRight: false })}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {language === 'zh' ? '无边框' : 'No Border'}
                </button>
              </div>
            </div>
          )}
          
          {activeTab === 'fill' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '背景颜色' : 'Background Color'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={format.backgroundColor === 'transparent' ? '#ffffff' : format.backgroundColor}
                    onChange={e => updateFormat('backgroundColor', e.target.value)}
                    className="w-10 h-10 border border-[#d0d0d0] rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={format.backgroundColor}
                    onChange={e => updateFormat('backgroundColor', e.target.value)}
                    className="flex-1 h-10 px-2 border border-[#d0d0d0] rounded"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '预设颜色' : 'Preset Colors'}
                </label>
                <div className="grid grid-cols-10 gap-1">
                  {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#800080',
                    '#c0c0c0', '#808080', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#ff9999', '#99ff99'].map(color => (
                    <button
                      key={color}
                      onClick={() => updateFormat('backgroundColor', color)}
                      className="w-6 h-6 rounded border border-[#d0d0d0]"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'protection' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  {language === 'zh' ? '单元格保护' : 'Cell Protection'}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="protection"
                      checked={format.protection === 'locked'}
                      onChange={() => updateFormat('protection', 'locked')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{language === 'zh' ? '锁定' : 'Locked'}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="protection"
                      checked={format.protection === 'unlocked'}
                      onChange={() => updateFormat('protection', 'unlocked')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{language === 'zh' ? '未锁定' : 'Unlocked'}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="protection"
                      checked={format.protection === 'hidden'}
                      onChange={() => updateFormat('protection', 'hidden')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{language === 'zh' ? '隐藏公式' : 'Hidden Formula'}</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            {language === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
          >
            {language === 'zh' ? '确定' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function applyCellFormatToElement(element: HTMLElement, format: CellFormat) {
  element.style.fontFamily = format.fontFamily
  element.style.fontSize = `${format.fontSize}pt`
  element.style.fontWeight = format.fontWeight
  element.style.fontStyle = format.fontStyle
  element.style.textDecoration = format.textDecoration
  element.style.color = format.color
  element.style.backgroundColor = format.backgroundColor
  element.style.textAlign = format.horizontalAlign
  element.style.verticalAlign = format.verticalAlign
  element.style.whiteSpace = format.wrapText ? 'pre-wrap' : 'nowrap'
  
  if (format.borderTop) {
    element.style.borderTop = `${format.borderStyle} ${format.borderColor}`
  }
  if (format.borderBottom) {
    element.style.borderBottom = `${format.borderStyle} ${format.borderColor}`
  }
  if (format.borderLeft) {
    element.style.borderLeft = `${format.borderStyle} ${format.borderColor}`
  }
  if (format.borderRight) {
    element.style.borderRight = `${format.borderStyle} ${format.borderColor}`
  }
}

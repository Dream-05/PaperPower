import { useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'

export interface ParagraphFormat {
  firstLineIndent: number
  leftIndent: number
  rightIndent: number
  spaceBefore: number
  spaceAfter: number
  lineSpacing: number
  alignment: 'left' | 'center' | 'right' | 'justify'
}

export interface HeadingStyle {
  id: string
  name: string
  nameEn: string
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  color: string
  marginTop: number
  marginBottom: number
}

export const headingStyles: HeadingStyle[] = [
  { id: 'title', name: '标题', nameEn: 'Title', fontSize: 22, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#000000', marginTop: 24, marginBottom: 6 },
  { id: 'heading1', name: '标题 1', nameEn: 'Heading 1', fontSize: 18, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#000000', marginTop: 18, marginBottom: 6 },
  { id: 'heading2', name: '标题 2', nameEn: 'Heading 2', fontSize: 16, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#000000', marginTop: 14, marginBottom: 6 },
  { id: 'heading3', name: '标题 3', nameEn: 'Heading 3', fontSize: 14, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#000000', marginTop: 12, marginBottom: 6 },
  { id: 'heading4', name: '标题 4', nameEn: 'Heading 4', fontSize: 12, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#000000', marginTop: 10, marginBottom: 4 },
  { id: 'heading5', name: '标题 5', nameEn: 'Heading 5', fontSize: 10.5, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#000000', marginTop: 8, marginBottom: 4 },
  { id: 'heading6', name: '标题 6', nameEn: 'Heading 6', fontSize: 9, fontFamily: 'SimHei, sans-serif', fontWeight: 'bold', color: '#000000', marginTop: 6, marginBottom: 4 },
  { id: 'body', name: '正文', nameEn: 'Body', fontSize: 12, fontFamily: 'SimSun, serif', fontWeight: 'normal', color: '#000000', marginTop: 0, marginBottom: 0 },
  { id: 'body-indent', name: '正文缩进', nameEn: 'Body Indent', fontSize: 12, fontFamily: 'SimSun, serif', fontWeight: 'normal', color: '#000000', marginTop: 0, marginBottom: 0 },
]

export const defaultParagraphFormat: ParagraphFormat = {
  firstLineIndent: 0,
  leftIndent: 0,
  rightIndent: 0,
  spaceBefore: 0,
  spaceAfter: 0,
  lineSpacing: 1.5,
  alignment: 'left'
}

export function applyParagraphFormat(format: ParagraphFormat) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  
  const range = selection.getRangeAt(0)
  let container: HTMLElement
  
  if (range.collapsed) {
    container = range.startContainer.parentElement as HTMLElement
    while (container && container.tagName !== 'P' && container.tagName !== 'DIV' && container.tagName !== 'BODY') {
      container = container.parentElement as HTMLElement
    }
    if (!container || container.tagName === 'BODY') {
      container = document.createElement('p')
      range.insertNode(container)
    }
  } else {
    const fragment = range.extractContents()
    container = document.createElement('p')
    container.appendChild(fragment)
    range.insertNode(container)
  }
  
  container.style.textIndent = `${format.firstLineIndent * 2}em`
  container.style.paddingLeft = `${format.leftIndent}em`
  container.style.paddingRight = `${format.rightIndent}em`
  container.style.marginTop = `${format.spaceBefore}pt`
  container.style.marginBottom = `${format.spaceAfter}pt`
  container.style.lineHeight = format.lineSpacing.toString()
  container.style.textAlign = format.alignment
}

export function applyHeadingStyle(styleId: string) {
  const style = headingStyles.find(s => s.id === styleId)
  if (!style) return
  
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  
  const range = selection.getRangeAt(0)
  
  let tagName = 'p'
  if (styleId === 'title') tagName = 'h1'
  else if (styleId === 'heading1') tagName = 'h1'
  else if (styleId === 'heading2') tagName = 'h2'
  else if (styleId === 'heading3') tagName = 'h3'
  else if (styleId === 'heading4') tagName = 'h4'
  else if (styleId === 'heading5') tagName = 'h5'
  else if (styleId === 'heading6') tagName = 'h6'
  
  if (range.collapsed) {
    const container = range.startContainer.parentElement as HTMLElement
    if (container && container.tagName.toUpperCase() === tagName.toUpperCase()) {
      container.style.fontSize = `${style.fontSize}pt`
      container.style.fontFamily = style.fontFamily
      container.style.fontWeight = style.fontWeight
      container.style.color = style.color
      container.style.marginTop = `${style.marginTop}pt`
      container.style.marginBottom = `${style.marginBottom}pt`
      return
    }
  }
  
  const fragment = range.extractContents()
  const element = document.createElement(tagName)
  element.appendChild(fragment)
  element.style.fontSize = `${style.fontSize}pt`
  element.style.fontFamily = style.fontFamily
  element.style.fontWeight = style.fontWeight
  element.style.color = style.color
  element.style.marginTop = `${style.marginTop}pt`
  element.style.marginBottom = `${style.marginBottom}pt`
  range.insertNode(element)
}

interface ParagraphFormatToolbarProps {
  format: ParagraphFormat
  onChange: (format: ParagraphFormat) => void
}

export function ParagraphFormatToolbar({ format, onChange }: ParagraphFormatToolbarProps) {
  const { language } = useLanguageStore()
  
  const presets = [
    { id: 'normal', name: language === 'zh' ? '正文' : 'Normal', firstLineIndent: 0, lineSpacing: 1.5, spaceAfter: 0 },
    { id: 'indent', name: language === 'zh' ? '首行缩进' : 'First Indent', firstLineIndent: 2, lineSpacing: 1.5, spaceAfter: 6 },
    { id: 'compact', name: language === 'zh' ? '紧凑' : 'Compact', firstLineIndent: 0, lineSpacing: 1.15, spaceAfter: 0 },
    { id: 'loose', name: language === 'zh' ? '宽松' : 'Loose', firstLineIndent: 0, lineSpacing: 2, spaceAfter: 12 },
  ]
  
  return (
    <div className="bg-white border border-[#e0e0e0] rounded-lg p-3 shadow-lg">
      <div className="text-sm font-medium mb-3 text-gray-700">
        {language === 'zh' ? '段落格式' : 'Paragraph Format'}
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {language === 'zh' ? '首行缩进' : 'First Line Indent'}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={format.firstLineIndent}
              onChange={e => onChange({ ...format, firstLineIndent: Number(e.target.value) })}
              className="w-16 h-7 px-2 text-xs border border-[#d0d0d0] rounded"
              min={0}
              max={10}
              step={0.5}
            />
            <span className="text-xs text-gray-400">字符</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {language === 'zh' ? '行距' : 'Line Spacing'}
          </label>
          <select
            value={format.lineSpacing}
            onChange={e => onChange({ ...format, lineSpacing: Number(e.target.value) })}
            className="w-full h-7 px-2 text-xs border border-[#d0d0d0] rounded"
          >
            <option value={1}>1.0</option>
            <option value={1.15}>1.15</option>
            <option value={1.5}>1.5</option>
            <option value={1.75}>1.75</option>
            <option value={2}>2.0</option>
            <option value={2.5}>2.5</option>
            <option value={3}>3.0</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {language === 'zh' ? '段前间距' : 'Space Before'}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={format.spaceBefore}
              onChange={e => onChange({ ...format, spaceBefore: Number(e.target.value) })}
              className="w-16 h-7 px-2 text-xs border border-[#d0d0d0] rounded"
              min={0}
              max={100}
            />
            <span className="text-xs text-gray-400">pt</span>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {language === 'zh' ? '段后间距' : 'Space After'}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={format.spaceAfter}
              onChange={e => onChange({ ...format, spaceAfter: Number(e.target.value) })}
              className="w-16 h-7 px-2 text-xs border border-[#d0d0d0] rounded"
              min={0}
              max={100}
            />
            <span className="text-xs text-gray-400">pt</span>
          </div>
        </div>
      </div>
      
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          {language === 'zh' ? '对齐方式' : 'Alignment'}
        </label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ ...format, alignment: 'left' })}
            className={`w-8 h-8 flex items-center justify-center rounded ${format.alignment === 'left' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={language === 'zh' ? '左对齐' : 'Left'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
            </svg>
          </button>
          <button
            onClick={() => onChange({ ...format, alignment: 'center' })}
            className={`w-8 h-8 flex items-center justify-center rounded ${format.alignment === 'center' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={language === 'zh' ? '居中' : 'Center'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
            </svg>
          </button>
          <button
            onClick={() => onChange({ ...format, alignment: 'right' })}
            className={`w-8 h-8 flex items-center justify-center rounded ${format.alignment === 'right' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={language === 'zh' ? '右对齐' : 'Right'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
            </svg>
          </button>
          <button
            onClick={() => onChange({ ...format, alignment: 'justify' })}
            className={`w-8 h-8 flex items-center justify-center rounded ${format.alignment === 'justify' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={language === 'zh' ? '两端对齐' : 'Justify'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <div>
        <label className="text-xs text-gray-500 block mb-1">
          {language === 'zh' ? '快速预设' : 'Quick Presets'}
        </label>
        <div className="flex flex-wrap gap-1">
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => onChange({ ...format, firstLineIndent: preset.firstLineIndent, lineSpacing: preset.lineSpacing, spaceAfter: preset.spaceAfter })}
              className="px-2 py-1 text-xs border border-[#d0d0d0] rounded hover:bg-gray-50"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface HeadingStyleSelectorProps {
  currentStyle: string
  onChange: (styleId: string) => void
}

export function HeadingStyleSelector({ currentStyle, onChange }: HeadingStyleSelectorProps) {
  const { language } = useLanguageStore()
  
  return (
    <div className="bg-white border border-[#e0e0e0] rounded-lg p-2 shadow-lg">
      <div className="text-sm font-medium mb-2 text-gray-700">
        {language === 'zh' ? '样式' : 'Styles'}
      </div>
      <div className="space-y-1">
        {headingStyles.map(style => (
          <button
            key={style.id}
            onClick={() => onChange(style.id)}
            className={`w-full px-3 py-2 text-left rounded transition-colors ${
              currentStyle === style.id 
                ? 'bg-blue-50 border border-blue-200' 
                : 'hover:bg-gray-50 border border-transparent'
            }`}
            style={{
              fontSize: `${Math.min(style.fontSize, 14)}pt`,
              fontWeight: style.fontWeight,
            }}
          >
            <div className="flex items-center justify-between">
              <span>{language === 'zh' ? style.name : style.nameEn}</span>
              <span className="text-xs text-gray-400">{style.fontSize}pt</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

interface FindReplaceDialogProps {
  isOpen: boolean
  onClose: () => void
  onFind: (text: string) => void
  onReplace: (find: string, replace: string) => void
  onReplaceAll: (find: string, replace: string) => void
}

export function FindReplaceDialog({ isOpen, onClose, onFind, onReplace, onReplaceAll }: FindReplaceDialogProps) {
  const { language } = useLanguageStore()
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '查找和替换' : 'Find and Replace'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {language === 'zh' ? '查找内容' : 'Find'}
            </label>
            <input
              type="text"
              value={findText}
              onChange={e => setFindText(e.target.value)}
              className="w-full px-3 py-2 border border-[#d0d0d0] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={language === 'zh' ? '输入要查找的内容' : 'Enter text to find'}
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {language === 'zh' ? '替换为' : 'Replace with'}
            </label>
            <input
              type="text"
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              className="w-full px-3 py-2 border border-[#d0d0d0] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={language === 'zh' ? '输入替换内容' : 'Enter replacement text'}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => onFind(findText)}
            disabled={!findText}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            {language === 'zh' ? '查找下一个' : 'Find Next'}
          </button>
          <button
            onClick={() => onReplace(findText, replaceText)}
            disabled={!findText}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            {language === 'zh' ? '替换' : 'Replace'}
          </button>
          <button
            onClick={() => onReplaceAll(findText, replaceText)}
            disabled={!findText}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {language === 'zh' ? '全部替换' : 'Replace All'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface HeaderFooterDialogProps {
  isOpen: boolean
  onClose: () => void
  header: string
  footer: string
  onHeaderChange: (header: string) => void
  onFooterChange: (footer: string) => void
}

export function HeaderFooterDialog({ isOpen, onClose, header, footer, onHeaderChange, onFooterChange }: HeaderFooterDialogProps) {
  const { language } = useLanguageStore()
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '页眉页脚设置' : 'Header & Footer'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {language === 'zh' ? '页眉内容' : 'Header Content'}
            </label>
            <input
              type="text"
              value={header}
              onChange={e => onHeaderChange(e.target.value)}
              className="w-full px-3 py-2 border border-[#d0d0d0] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={language === 'zh' ? '输入页眉内容' : 'Enter header content'}
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {language === 'zh' ? '页脚内容' : 'Footer Content'}
            </label>
            <input
              type="text"
              value={footer}
              onChange={e => onFooterChange(e.target.value)}
              className="w-full px-3 py-2 border border-[#d0d0d0] rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={language === 'zh' ? '输入页脚内容' : 'Enter footer content'}
            />
          </div>
          
          <div className="text-xs text-gray-500">
            {language === 'zh' 
              ? '提示: 使用 {page} 插入页码， 使用 {date} 插入日期'
              : 'Tip: Use {page} for page number, {date} for date'}
          </div>
        </div>
        
        <div className="flex justify-end mt-4">
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

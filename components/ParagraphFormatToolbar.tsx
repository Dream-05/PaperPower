import { useLanguageStore } from '@/store/languageStore'

interface ParagraphFormat {
  firstLineIndent: number
  leftIndent: number
  rightIndent: number
  spaceBefore: number
  spaceAfter: number
  lineSpacing: number
  alignment: 'left' | 'center' | 'right' | 'justify'
}

interface ParagraphFormatToolbarProps {
  format: ParagraphFormat
  onChange: (format: ParagraphFormat) => void
}

export function ParagraphFormatToolbar({ format, onChange }: ParagraphFormatToolbarProps) {
  const { language } = useLanguageStore()
  
  const updateFormat = (key: keyof ParagraphFormat, value: number | string) => {
    onChange({ ...format, [key]: value })
  }
  
  const presets = [
    { id: 'normal', name: language === 'zh' ? '正文' : 'Normal', firstLineIndent: 0, lineSpacing: 1.5, spaceAfter: 0 },
    { id: 'indent', name: language === 'zh' ? '首行缩进' : 'First Indent', firstLineIndent: 2, lineSpacing: 1.5, spaceAfter: 0 },
    { id: 'compact', name: language === 'zh' ? '紧凑' : 'Compact', firstLineIndent: 0, lineSpacing: 1.15, spaceAfter: 6 },
    { id: 'loose', name: language === 'zh' ? '宽松' : 'Loose', firstLineIndent: 2, lineSpacing: 2, spaceAfter: 12 },
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
              onChange={e => updateFormat('firstLineIndent', Number(e.target.value))}
              className="w-16 h-7 px-2 text-xs border border-[#d0d0d0] rounded"
              min={0}
              max={10}
              step={0.5}
            />
            <span className="text-xs text-gray-400">{language === 'zh' ? '字符' : 'chars'}</span>
          </div>
        </div>
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {language === 'zh' ? '行距' : 'Line Spacing'}
          </label>
          <select
            value={format.lineSpacing}
            onChange={e => updateFormat('lineSpacing', Number(e.target.value))}
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
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {language === 'zh' ? '段前间距' : 'Space Before'}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={format.spaceBefore}
              onChange={e => updateFormat('spaceBefore', Number(e.target.value))}
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
              onChange={e => updateFormat('spaceAfter', Number(e.target.value))}
              className="w-16 h-7 px-2 text-xs border border-[#d0d0d0] rounded"
              min={0}
              max={100}
            />
            <span className="text-xs text-gray-400">pt</span>
          </div>
        </div>
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {language === 'zh' ? '左缩进' : 'Left Indent'}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={format.leftIndent}
              onChange={e => updateFormat('leftIndent', Number(e.target.value))}
              className="w-16 h-7 px-2 text-xs border border-[#d0d0d0] rounded"
              min={0}
              max={20}
              step={0.5}
            />
            <span className="text-xs text-gray-400">{language === 'zh' ? '字符' : 'chars'}</span>
          </div>
        </div>
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            {language === 'zh' ? '右缩进' : 'Right Indent'}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={format.rightIndent}
              onChange={e => updateFormat('rightIndent', Number(e.target.value))}
              className="w-16 h-7 px-2 text-xs border border-[#d0d0d0] rounded"
              min={0}
              max={20}
              step={0.5}
            />
            <span className="text-xs text-gray-400">{language === 'zh' ? '字符' : 'chars'}</span>
          </div>
        </div>
      </div>
      
      <div className="mb-3">
        <label className="text-xs text-gray-500 block mb-1">
          {language === 'zh' ? '对齐方式' : 'Alignment'}
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => updateFormat('alignment', 'left')}
            className={`w-8 h-8 flex items-center justify-center rounded ${format.alignment === 'left' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={language === 'zh' ? '左对齐' : 'Align Left'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
            </svg>
          </button>
          <button
            onClick={() => updateFormat('alignment', 'center')}
            className={`w-8 h-8 flex items-center justify-center rounded ${format.alignment === 'center' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={language === 'zh' ? '居中' : 'Center'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
            </svg>
          </button>
          <button
            onClick={() => updateFormat('alignment', 'right')}
            className={`w-8 h-8 flex items-center justify-center rounded ${format.alignment === 'right' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={language === 'zh' ? '右对齐' : 'Align Right'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
            </svg>
          </button>
          <button
            onClick={() => updateFormat('alignment', 'justify')}
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
              onClick={() => onChange({ ...format, ...preset, alignment: format.alignment })}
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
  container.style.marginLeft = `${format.leftIndent * 2}em`
  container.style.marginRight = `${format.rightIndent * 2}em`
  container.style.marginTop = `${format.spaceBefore}pt`
  container.style.marginBottom = `${format.spaceAfter}pt`
  container.style.lineHeight = format.lineSpacing.toString()
  container.style.textAlign = format.alignment
}

export type { ParagraphFormat }

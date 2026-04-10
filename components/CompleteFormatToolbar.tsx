import { useState, useRef, useEffect } from 'react'
import { SmartInputParser } from '@/utils/smartInputParser'

export interface FontOption {
  label: string
  value: string
  pt?: number
}

export const chineseFontSizes: FontOption[] = [
  { label: '初号', value: '42pt', pt: 42 },
  { label: '小初', value: '36pt', pt: 36 },
  { label: '一号', value: '26pt', pt: 26 },
  { label: '小一', value: '24pt', pt: 24 },
  { label: '二号', value: '22pt', pt: 22 },
  { label: '小二', value: '18pt', pt: 18 },
  { label: '三号', value: '16pt', pt: 16 },
  { label: '小三', value: '15pt', pt: 15 },
  { label: '四号', value: '14pt', pt: 14 },
  { label: '小四', value: '12pt', pt: 12 },
  { label: '五号', value: '10.5pt', pt: 10.5 },
  { label: '小五', value: '9pt', pt: 9 },
  { label: '六号', value: '7.5pt', pt: 7.5 },
  { label: '小六', value: '6.5pt', pt: 6.5 },
]

export const fontFamilies = [
  { label: '宋体', value: 'SimSun, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: '楷体', value: 'KaiTi, serif' },
  { label: '仿宋', value: 'FangSong, serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
]

export const colors = [
  { label: '黑色', value: '#000000' },
  { label: '红色', value: '#FF0000' },
  { label: '橙色', value: '#FFA500' },
  { label: '黄色', value: '#FFFF00' },
  { label: '绿色', value: '#00FF00' },
  { label: '青色', value: '#00FFFF' },
  { label: '蓝色', value: '#0000FF' },
  { label: '紫色', value: '#800080' },
  { label: '灰色', value: '#808080' },
  { label: '粉色', value: '#FFC0CB' },
]

export const highlightColors = [
  { label: '无', value: 'transparent' },
  { label: '黄色', value: '#FFFF00' },
  { label: '绿色', value: '#90EE90' },
  { label: '青色', value: '#00FFFF' },
  { label: '粉色', value: '#FFB6C1' },
  { label: '橙色', value: '#FFD700' },
]

export const lineSpacings = [
  { label: '单倍行距', value: '1' },
  { label: '1.15倍行距', value: '1.15' },
  { label: '1.5倍行距', value: '1.5' },
  { label: '双倍行距', value: '2' },
  { label: '2.5倍行距', value: '2.5' },
  { label: '3倍行距', value: '3' },
]

export const headingStyles = [
  { label: '标题', value: 'h1', style: 'font-size: 24pt; font-weight: bold;' },
  { label: '标题 1', value: 'h1', style: 'font-size: 24pt; font-weight: bold;' },
  { label: '标题 2', value: 'h2', style: 'font-size: 18pt; font-weight: bold;' },
  { label: '标题 3', value: 'h3', style: 'font-size: 14pt; font-weight: bold;' },
  { label: '正文', value: 'p', style: '' },
]

interface FontSizeInputProps {
  value: number
  onChange: (pt: number) => void
  min?: number
  max?: number
}

export function FontSizeInput({ value, onChange, min = 6, max = 72 }: FontSizeInputProps) {
  const [inputValue, setInputValue] = useState(value.toString())
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    setInputValue(value.toString())
  }, [value])
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }
  
  const handleInputBlur = () => {
    const parsed = SmartInputParser.parse(inputValue)
    const fontSizeItem = parsed.find(p => p.type === 'fontSize')
    
    if (fontSizeItem) {
      const pt = fontSizeItem.value as number
      if (pt >= min && pt <= max) {
        onChange(pt)
        return
      }
    }
    
    const num = parseFloat(inputValue)
    if (!isNaN(num) && num >= min && num <= max) {
      onChange(num)
    } else {
      setInputValue(value.toString())
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur()
      inputRef.current?.blur()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(value + 1, max))
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(value - 1, min))
    }
  }
  
  const handleSelectChineseSize = (pt: number) => {
    onChange(pt)
    setIsDropdownOpen(false)
  }
  
  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className="w-12 px-1 py-1 text-sm text-center outline-none"
          title={`字号 (${min}-${max}pt)`}
        />
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="px-1 py-1 border-l border-gray-300 hover:bg-gray-100"
        >
          <svg className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      
      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[150] w-32 max-h-48 overflow-y-auto">
          <div className="p-2 border-b border-gray-100 text-xs text-gray-500 font-medium sticky top-0 bg-white">
            中文标准字号
          </div>
          {chineseFontSizes.map(size => (
            <button
              key={size.label}
              onClick={() => handleSelectChineseSize(size.pt!)}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 transition-colors flex justify-between ${
                value === size.pt ? 'bg-blue-50 text-blue-700' : ''
              }`}
            >
              <span>{size.label}</span>
              <span className="text-gray-400 text-xs">{size.pt}pt</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface FontFamilySelectProps {
  value: string
  onChange: (font: string) => void
}

export function FontFamilySelect({ value, onChange }: FontFamilySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const currentFont = fontFamilies.find(f => f.value === value) || fontFamilies[0]
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white hover:border-gray-400 min-w-[100px]"
      >
        <span className="text-sm truncate" style={{ fontFamily: value }}>{currentFont.label}</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[150] w-40 max-h-48 overflow-y-auto">
          {fontFamilies.map(font => (
            <button
              key={font.label}
              onClick={() => {
                onChange(font.value)
                setIsOpen(false)
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                value === font.value ? 'bg-blue-50 text-blue-700' : ''
              }`}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ColorSelectProps {
  colors: { label: string; value: string }[]
  value: string
  onChange: (color: string) => void
  title: string
}

export function ColorSelect({ colors, value, onChange, title }: ColorSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 border border-gray-300 rounded hover:border-gray-400 flex items-center justify-center"
        title={title}
      >
        <div
          className="w-5 h-5 rounded border border-gray-200"
          style={{ backgroundColor: value === 'transparent' ? 'white' : value }}
        />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-xl z-[200] min-w-[140px]">
          <div className="text-xs text-gray-500 mb-2 text-center font-medium">{title}</div>
          <div className="grid grid-cols-5 gap-1.5">
            {colors.map(color => (
              <button
                key={color.label}
                onClick={() => {
                  onChange(color.value)
                  setIsOpen(false)
                }}
                className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                  value === color.value ? 'ring-2 ring-blue-500 border-blue-400' : 'border-gray-200'
                }`}
                style={{ backgroundColor: color.value === 'transparent' ? 'white' : color.value }}
                title={color.label}
              />
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-1">自定义颜色</div>
            <input
              type="color"
              value={value === 'transparent' ? '#000000' : value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-8 cursor-pointer rounded border border-gray-200"
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface LineSpacingSelectProps {
  value: string
  onChange: (spacing: string) => void
}

export function LineSpacingSelect({ value, onChange }: LineSpacingSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const current = lineSpacings.find(s => s.value === value) || lineSpacings[2]
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white hover:border-gray-400 text-sm"
      >
        <span>{current.label}</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[150] w-32">
          {lineSpacings.map(spacing => (
            <button
              key={spacing.label}
              onClick={() => {
                onChange(spacing.value)
                setIsOpen(false)
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                value === spacing.value ? 'bg-blue-50 text-blue-700' : ''
              }`}
            >
              {spacing.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}

export function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded border border-gray-300 ${
        active ? 'bg-blue-100 border-blue-300' : 'bg-white hover:bg-gray-100'
      }`}
      title={title}
    >
      {children}
    </button>
  )
}

interface CompleteFormatToolbarProps {
  fontSize: number
  fontFamily: string
  textColor: string
  highlightColor: string
  lineSpacing: string
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrikethrough: boolean
  isSubscript: boolean
  isSuperscript: boolean
  onFontSizeChange: (pt: number) => void
  onFontFamilyChange: (font: string) => void
  onTextColorChange: (color: string) => void
  onHighlightColorChange: (color: string) => void
  onLineSpacingChange: (spacing: string) => void
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onStrikethrough: () => void
  onSubscript: () => void
  onSuperscript: () => void
  onAlignLeft: () => void
  onAlignCenter: () => void
  onAlignRight: () => void
  onAlignJustify: () => void
  onBulletList: () => void
  onNumberedList: () => void
  onIndent: () => void
  onOutdent: () => void
  onClearFormat: () => void
}

export function CompleteFormatToolbar({
  fontSize,
  fontFamily,
  textColor,
  highlightColor,
  lineSpacing,
  isBold,
  isItalic,
  isUnderline,
  isStrikethrough,
  isSubscript,
  isSuperscript,
  onFontSizeChange,
  onFontFamilyChange,
  onTextColorChange,
  onHighlightColorChange,
  onLineSpacingChange,
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onSubscript,
  onSuperscript,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignJustify,
  onBulletList,
  onNumberedList,
  onIndent,
  onOutdent,
  onClearFormat,
}: CompleteFormatToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-2 bg-white border-b border-gray-200 flex-wrap">
      <FontFamilySelect value={fontFamily} onChange={onFontFamilyChange} />
      <FontSizeInput value={fontSize} onChange={onFontSizeChange} />
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <ToolbarButton onClick={onBold} active={isBold} title="加粗 (Ctrl+B)">
        <span className="font-bold text-sm">B</span>
      </ToolbarButton>
      <ToolbarButton onClick={onItalic} active={isItalic} title="斜体 (Ctrl+I)">
        <span className="italic text-sm">I</span>
      </ToolbarButton>
      <ToolbarButton onClick={onUnderline} active={isUnderline} title="下划线 (Ctrl+U)">
        <span className="underline text-sm">U</span>
      </ToolbarButton>
      <ToolbarButton onClick={onStrikethrough} active={isStrikethrough} title="删除线">
        <span className="line-through text-sm">S</span>
      </ToolbarButton>
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <ColorSelect
        colors={colors}
        value={textColor}
        onChange={onTextColorChange}
        title="文字颜色"
      />
      <ColorSelect
        colors={highlightColors}
        value={highlightColor}
        onChange={onHighlightColorChange}
        title="高亮颜色"
      />
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <ToolbarButton onClick={onSubscript} active={isSubscript} title="下标">
        <span className="text-xs">X<sub>2</sub></span>
      </ToolbarButton>
      <ToolbarButton onClick={onSuperscript} active={isSuperscript} title="上标">
        <span className="text-xs">X<sup>2</sup></span>
      </ToolbarButton>
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <ToolbarButton onClick={onAlignLeft} title="左对齐">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onAlignCenter} title="居中">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onAlignRight} title="右对齐">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onAlignJustify} title="两端对齐">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </ToolbarButton>
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <ToolbarButton onClick={onBulletList} title="项目符号">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="2" cy="6" r="1" fill="currentColor" />
          <circle cx="2" cy="12" r="1" fill="currentColor" />
          <circle cx="2" cy="18" r="1" fill="currentColor" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onNumberedList} title="编号">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onIndent} title="增加缩进">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5v14" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onOutdent} title="减少缩进">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 5v14" />
        </svg>
      </ToolbarButton>
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <LineSpacingSelect value={lineSpacing} onChange={onLineSpacingChange} />
      
      <div className="w-px h-6 bg-gray-300 mx-1" />
      
      <ToolbarButton onClick={onClearFormat} title="清除格式">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </ToolbarButton>
    </div>
  )
}

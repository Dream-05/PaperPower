import { useState, useRef, useEffect } from 'react'
import { AdvancedColorPicker } from './AdvancedColorPicker'

export interface FormatOption {
  id: string
  label: string
  value: string
  icon?: React.ReactNode
}

export const fontFamilies: FormatOption[] = [
  { id: 'simsun', label: '宋体', value: 'SimSun, serif' },
  { id: 'simhei', label: '黑体', value: 'SimHei, sans-serif' },
  { id: 'kaiti', label: '楷体', value: 'KaiTi, serif' },
  { id: 'fangsong', label: '仿宋', value: 'FangSong, serif' },
  { id: 'yahei', label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { id: 'arial', label: 'Arial', value: 'Arial, sans-serif' },
  { id: 'times', label: 'Times New Roman', value: '"Times New Roman", serif' },
  { id: 'courier', label: 'Courier New', value: '"Courier New", monospace' },
  { id: 'georgia', label: 'Georgia', value: 'Georgia, serif' },
  { id: 'verdana', label: 'Verdana', value: 'Verdana, sans-serif' }
]

export const fontSizes: FormatOption[] = [
  { id: 'chuhao', label: '初号', value: '42pt' },
  { id: 'xiaochu', label: '小初', value: '36pt' },
  { id: 'yihao', label: '一号', value: '26pt' },
  { id: 'xiaoyi', label: '小一', value: '24pt' },
  { id: 'erhao', label: '二号', value: '22pt' },
  { id: 'xiaoer', label: '小二', value: '18pt' },
  { id: 'sanhao', label: '三号', value: '16pt' },
  { id: 'xiaosan', label: '小三', value: '15pt' },
  { id: 'sihao', label: '四号', value: '14pt' },
  { id: 'xiaosi', label: '小四', value: '12pt' },
  { id: 'wuhao', label: '五号', value: '10.5pt' },
  { id: 'xiaowu', label: '小五', value: '9pt' },
  { id: 'liuhao', label: '六号', value: '7.5pt' },
  { id: 'xiaoliu', label: '小六', value: '6.5pt' }
]

export const lineSpacings: FormatOption[] = [
  { id: 'single', label: '单倍行距', value: '1' },
  { id: '1.15', label: '1.15倍行距', value: '1.15' },
  { id: '1.5', label: '1.5倍行距', value: '1.5' },
  { id: 'double', label: '双倍行距', value: '2' },
  { id: '2.5', label: '2.5倍行距', value: '2.5' },
  { id: '3', label: '三倍行距', value: '3' }
]

export const paragraphSpacings: FormatOption[] = [
  { id: 'none', label: '无间距', value: '0' },
  { id: 'small', label: '小间距', value: '6pt' },
  { id: 'medium', label: '中间距', value: '12pt' },
  { id: 'large', label: '大间距', value: '18pt' }
]

export const headingStyles: FormatOption[] = [
  { id: 'title', label: '标题', value: 'title' },
  { id: 'heading1', label: '标题 1', value: 'h1' },
  { id: 'heading2', label: '标题 2', value: 'h2' },
  { id: 'heading3', label: '标题 3', value: 'h3' },
  { id: 'heading4', label: '标题 4', value: 'h4' },
  { id: 'normal', label: '正文', value: 'p' }
]

export const textColors: { id: string; label: string; value: string }[] = [
  { id: 'black', label: '黑色', value: '#000000' },
  { id: 'red', label: '红色', value: '#FF0000' },
  { id: 'orange', label: '橙色', value: '#FFA500' },
  { id: 'yellow', label: '黄色', value: '#FFFF00' },
  { id: 'green', label: '绿色', value: '#00FF00' },
  { id: 'cyan', label: '青色', value: '#00FFFF' },
  { id: 'blue', label: '蓝色', value: '#0000FF' },
  { id: 'purple', label: '紫色', value: '#800080' },
  { id: 'gray', label: '灰色', value: '#808080' }
]

export const highlightColors: { id: string; label: string; value: string }[] = [
  { id: 'none', label: '无', value: 'transparent' },
  { id: 'yellow', label: '黄色', value: '#FFFF00' },
  { id: 'green', label: '绿色', value: '#90EE90' },
  { id: 'cyan', label: '青色', value: '#00FFFF' },
  { id: 'pink', label: '粉色', value: '#FFB6C1' },
  { id: 'orange', label: '橙色', value: '#FFD700' }
]

interface FormatDropdownProps {
  options: FormatOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  width?: string
}

export function FormatDropdown({ options, value, onChange, placeholder, className = '', width = 'w-28' }: FormatDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const selectedOption = options.find(o => o.value === value)
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  return (
    <div className={`relative ${width} ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 px-2 text-sm border border-gray-300 rounded bg-white hover:border-gray-400 flex items-center justify-between"
      >
        <span className="truncate">{selectedOption?.label || placeholder || '选择'}</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-[150] max-h-48 overflow-y-auto">
          {options.map(option => (
            <button
              key={option.id}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 transition-colors ${
                value === option.value ? 'bg-blue-50 text-blue-700' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ColorPickerProps {
  colors: { id: string; label: string; value: string }[]
  value: string
  onChange: (value: string) => void
  title: string
}

export function ColorPicker({ value, onChange, title }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <AdvancedColorPicker
      value={value}
      onChange={onChange}
      title={title}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    />
  )
}

export function FormatToolbar({ 
  onFormat,
  currentFormat = {}
}: { 
  onFormat: (type: string, value: string) => void
  currentFormat?: {
    fontFamily?: string
    fontSize?: string
    lineSpacing?: string
    textColor?: string
    highlightColor?: string
    heading?: string
    paragraphSpacing?: string
  }
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-white border-b border-gray-200">
      <FormatDropdown
        options={fontFamilies}
        value={currentFormat.fontFamily || 'SimSun, serif'}
        onChange={(v) => onFormat('fontFamily', v)}
        width="w-32"
      />
      
      <FormatDropdown
        options={fontSizes}
        value={currentFormat.fontSize || '12pt'}
        onChange={(v) => onFormat('fontSize', v)}
        width="w-20"
      />
      
      <div className="w-px h-6 bg-gray-300" />
      
      <FormatDropdown
        options={headingStyles}
        value={currentFormat.heading || 'p'}
        onChange={(v) => onFormat('heading', v)}
        width="w-24"
        placeholder="样式"
      />
      
      <div className="w-px h-6 bg-gray-300" />
      
      <button
        onClick={() => onFormat('bold', '')}
        className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center font-bold"
        title="加粗 (Ctrl+B)"
      >
        B
      </button>
      <button
        onClick={() => onFormat('italic', '')}
        className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center italic"
        title="斜体 (Ctrl+I)"
      >
        I
      </button>
      <button
        onClick={() => onFormat('underline', '')}
        className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center underline"
        title="下划线 (Ctrl+U)"
      >
        U
      </button>
      <button
        onClick={() => onFormat('strikethrough', '')}
        className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center line-through"
        title="删除线"
      >
        S
      </button>
      
      <div className="w-px h-6 bg-gray-300" />
      
      <ColorPicker
        colors={textColors}
        value={currentFormat.textColor || '#000000'}
        onChange={(v) => onFormat('textColor', v)}
        title="文字颜色"
      />
      <ColorPicker
        colors={highlightColors}
        value={currentFormat.highlightColor || 'transparent'}
        onChange={(v) => onFormat('highlightColor', v)}
        title="高亮颜色"
      />
      
      <div className="w-px h-6 bg-gray-300" />
      
      <button
        onClick={() => onFormat('subscript', '')}
        className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center text-xs"
        title="下标"
      >
        X₂
      </button>
      <button
        onClick={() => onFormat('superscript', '')}
        className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 flex items-center justify-center text-xs"
        title="上标"
      >
        X²
      </button>
      
      <div className="w-px h-6 bg-gray-300" />
      
      <FormatDropdown
        options={lineSpacings}
        value={currentFormat.lineSpacing || '1.5'}
        onChange={(v) => onFormat('lineSpacing', v)}
        width="w-28"
        placeholder="行距"
      />
      
      <FormatDropdown
        options={paragraphSpacings}
        value={currentFormat.paragraphSpacing || '0'}
        onChange={(v) => onFormat('paragraphSpacing', v)}
        width="w-24"
        placeholder="段落"
      />
    </div>
  )
}

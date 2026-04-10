import { useState, useRef, useEffect, useCallback } from 'react'
import { SmartInputParser, formatInputSuggestion, FormatCommand } from '@/utils/smartInputParser'
import { AIIcon } from '@/components/AIIcon'

interface AICommandPanelProps {
  isOpen: boolean
  onClose: () => void
  onExecute: (commands: FormatCommand[]) => void
  currentFormat?: {
    fontSize?: number
    fontFamily?: string
    color?: string
    lineSpacing?: number
    alignment?: string
    isBold?: boolean
    isItalic?: boolean
    isUnderline?: boolean
    textColor?: string
  }
}

interface CommandHistory {
  input: string
  commands: FormatCommand[]
  timestamp: Date
}

export function AICommandPanel({ isOpen, onClose, onExecute, currentFormat }: AICommandPanelProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [history, setHistory] = useState<CommandHistory[]>([])
  const [preview, setPreview] = useState<FormatCommand[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])
  
  useEffect(() => {
    if (input.length > 0) {
      const newSuggestions = formatInputSuggestion(input)
      setSuggestions(newSuggestions)
      setShowSuggestions(true)
      
      const commands = SmartInputParser.parseToCommands(input)
      setPreview(commands)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
      setPreview([])
    }
    setSelectedIndex(-1)
  }, [input])
  
  const handleExecute = useCallback(() => {
    if (input.trim()) {
      const commands = SmartInputParser.parseToCommands(input)
      if (commands.length > 0) {
        onExecute(commands)
        setHistory(prev => [{
          input: input.trim(),
          commands,
          timestamp: new Date()
        }, ...prev.slice(0, 9)])
        setInput('')
        setPreview([])
      }
    }
  }, [input, onExecute])
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        setInput(suggestions[selectedIndex])
        setShowSuggestions(false)
      } else {
        handleExecute()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Escape') {
      if (showSuggestions) {
        setShowSuggestions(false)
      } else {
        onClose()
      }
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      setInput(suggestions[0])
      setShowSuggestions(false)
    }
  }
  
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }
  
  const handleHistoryClick = (item: CommandHistory) => {
    setInput(item.input)
    const commands = SmartInputParser.parseToCommands(item.input)
    setPreview(commands)
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-start justify-center pt-20">
      <div className="bg-white rounded-lg shadow-2xl w-[600px] max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <AIIcon size={24} className="text-blue-500" />
            <span className="font-medium text-gray-800">智能命令面板</span>
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => input.length > 0 && setShowSuggestions(true)}
              placeholder="输入命令，如：字号12、宋体、红色、居中、行距1.5..."
              className="w-full h-12 px-4 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-[160]">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${
                      index === selectedIndex ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {preview.length > 0 && (
          <div className="p-4 bg-gray-50 border-b">
            <div className="text-xs text-gray-500 mb-2">预览操作：</div>
            <div className="flex flex-wrap gap-2">
              {preview.map((cmd, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                >
                  {cmd.description}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-4 border-b">
          <div className="text-xs text-gray-500 mb-2">快捷命令：</div>
          <div className="flex flex-wrap gap-2">
            {[
              { cmd: '字号12', label: '12pt' },
              { cmd: '字号14', label: '14pt' },
              { cmd: '宋体', label: '宋体' },
              { cmd: '黑体', label: '黑体' },
              { cmd: '红色', label: '红色' },
              { cmd: '居中', label: '居中' },
              { cmd: '行距1.5', label: '1.5倍' },
              { cmd: '加粗', label: '加粗' },
            ].map(item => (
              <button
                key={item.cmd}
                onClick={() => {
                  setInput(item.cmd)
                  inputRef.current?.focus()
                }}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        
        {currentFormat && (
          <div className="p-4 bg-gray-50 border-b">
            <div className="text-xs text-gray-500 mb-2">当前格式：</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {currentFormat.fontSize && (
                <span className="px-2 py-1 bg-white border rounded">
                  字号: {currentFormat.fontSize}pt
                </span>
              )}
              {currentFormat.fontFamily && (
                <span className="px-2 py-1 bg-white border rounded">
                  字体: {currentFormat.fontFamily.split(',')[0]}
                </span>
              )}
              {currentFormat.color && (
                <span className="px-2 py-1 bg-white border rounded flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: currentFormat.color }} />
                  颜色
                </span>
              )}
              {currentFormat.lineSpacing && (
                <span className="px-2 py-1 bg-white border rounded">
                  行距: {currentFormat.lineSpacing}倍
                </span>
              )}
              {currentFormat.alignment && (
                <span className="px-2 py-1 bg-white border rounded">
                  对齐: {currentFormat.alignment}
                </span>
              )}
            </div>
          </div>
        )}
        
        {history.length > 0 && (
          <div className="p-4 max-h-40 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-2">历史记录：</div>
            <div className="space-y-1">
              {history.slice(0, 5).map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleHistoryClick(item)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 rounded flex items-center justify-between"
                >
                  <span className="truncate">{item.input}</span>
                  <span className="text-xs text-gray-400">
                    {item.commands.length}个操作
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            按 Enter 执行 | Tab 自动补全 | Esc 关闭
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100"
            >
              取消
            </button>
            <button
              onClick={handleExecute}
              disabled={preview.length === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
            >
              执行
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface QuickFormatBarProps {
  onFormat: (type: string, value: string | number | boolean) => void
  currentFormat?: {
    fontSize?: number
    fontFamily?: string
    color?: string
    isBold?: boolean
    isItalic?: boolean
    isUnderline?: boolean
  }
}

export function QuickFormatBar({ onFormat, currentFormat }: QuickFormatBarProps) {
  const [showAI, setShowAI] = useState(false)
  
  return (
    <>
      <div className="flex items-center gap-1 p-2 bg-white border rounded-lg shadow-sm">
        <button
          onClick={() => setShowAI(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm rounded hover:opacity-90"
        >
          <AIIcon size={16} className="text-white" />
          智能命令
        </button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <select
          value={currentFormat?.fontSize || 12}
          onChange={e => onFormat('fontSize', parseInt(e.target.value))}
          className="h-8 px-2 text-sm border border-gray-300 rounded"
        >
          {[6, 8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 42, 48, 56, 64, 72].map(size => (
            <option key={size} value={size}>{size}pt</option>
          ))}
        </select>
        
        <select
          value={currentFormat?.fontFamily || 'SimSun, serif'}
          onChange={e => onFormat('fontFamily', e.target.value)}
          className="h-8 px-2 text-sm border border-gray-300 rounded"
        >
          <option value="SimSun, serif">宋体</option>
          <option value="SimHei, sans-serif">黑体</option>
          <option value="KaiTi, serif">楷体</option>
          <option value="FangSong, serif">仿宋</option>
          <option value='"Microsoft YaHei", sans-serif'>微软雅黑</option>
          <option value="Arial, sans-serif">Arial</option>
        </select>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <button
          onClick={() => onFormat('bold', !currentFormat?.isBold)}
          className={`w-8 h-8 flex items-center justify-center rounded ${
            currentFormat?.isBold ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
        >
          <span className="font-bold text-sm">B</span>
        </button>
        
        <button
          onClick={() => onFormat('italic', !currentFormat?.isItalic)}
          className={`w-8 h-8 flex items-center justify-center rounded ${
            currentFormat?.isItalic ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
        >
          <span className="italic text-sm">I</span>
        </button>
        
        <button
          onClick={() => onFormat('underline', !currentFormat?.isUnderline)}
          className={`w-8 h-8 flex items-center justify-center rounded ${
            currentFormat?.isUnderline ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
        >
          <span className="underline text-sm">U</span>
        </button>
      </div>
      
      <AICommandPanel
        isOpen={showAI}
        onClose={() => setShowAI(false)}
        onExecute={(commands) => {
          commands.forEach(cmd => {
            if (cmd.value !== undefined) {
              onFormat(cmd.action.replace('set', '').toLowerCase(), cmd.value)
            }
          })
          setShowAI(false)
        }}
        currentFormat={currentFormat}
      />
    </>
  )
}

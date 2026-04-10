import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog } from './Dialog'

interface AdvancedColorPickerProps {
  value: string
  onChange: (color: string) => void
  title: string
  isOpen: boolean
  onToggle: () => void
}

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF',
  '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF',
  '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC',
  '#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD',
  '#CC4125', '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6D9EEB', '#6FA8DC', '#8E7CC3', '#C27BA0',
  '#A61C00', '#CC0000', '#E69138', '#F1C232', '#6AA84F', '#45818E', '#3C78D8', '#3D85C6', '#674EA7', '#A64D79',
  '#85200C', '#990000', '#B45F06', '#BF9000', '#38761D', '#134F5C', '#1155CC', '#0B5394', '#351C75', '#741B47',
  '#5B0F00', '#660000', '#783F04', '#7F6000', '#274E13', '#0C343D', '#1C4587', '#073763', '#20124D', '#4C1130',
]

const RECENT_COLORS_KEY = 'zhiban-ai-recent-colors'

export function AdvancedColorPicker({ value, onChange, title, isOpen, onToggle }: AdvancedColorPickerProps) {
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_COLORS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [customColor, setCustomColor] = useState(value === 'transparent' ? '#000000' : value)
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(100)
  const [lightness, setLightness] = useState(50)
  const [activeTab, setActiveTab] = useState<'presets' | 'picker' | 'recent'>('presets')
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (isOpen) onToggle()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  useEffect(() => {
    if (value && value !== 'transparent') {
      const rgb = hexToRgb(value)
      if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
        setHue(hsl.h)
        setSaturation(hsl.s)
        setLightness(hsl.l)
        setCustomColor(value)
      }
    }
  }, [value])

  const handleColorSelect = useCallback((color: string) => {
    onChange(color)
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color)
      const updated = [color, ...filtered].slice(0, 16)
      localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated))
      return updated
    })
    onToggle()
  }, [onChange, onToggle])

  const handleEyedropper = useCallback(async () => {
    if (!('EyeDropper' in window)) {
      Dialog.warning('您的浏览器不支持取色器功能，请使用Chrome 95+或Edge 95+浏览器', '浏览器不支持')
      return
    }
    try {
      setEyedropperActive(true)
      const eyeDropper = new (window as any).EyeDropper()
      const result = await eyeDropper.open()
      handleColorSelect(result.sRGBHex)
    } catch {
    } finally {
      setEyedropperActive(false)
    }
  }, [handleColorSelect])

  const handleHslChange = useCallback((h: number, s: number, l: number) => {
    setHue(h)
    setSaturation(s)
    setLightness(l)
    const hex = hslToHex(h, s, l)
    setCustomColor(hex)
  }, [])

  const handleCustomColorConfirm = useCallback(() => {
    handleColorSelect(customColor)
  }, [customColor, handleColorSelect])

  const drawColorPicker = useCallback(() => {
    const canvas = pickerRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const s = (x / width) * 100
        const l = 100 - (y / height) * 100
        ctx.fillStyle = `hsl(${hue}, ${s}%, ${l}%)`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }, [hue])

  useEffect(() => {
    if (activeTab === 'picker' && pickerRef.current) {
      drawColorPicker()
    }
  }, [activeTab, drawColorPicker])

  const handlePickerClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = pickerRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const s = Math.round((x / canvas.width) * 100)
    const l = Math.round(100 - (y / canvas.height) * 100)
    handleHslChange(hue, s, l)
  }, [hue, handleHslChange])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="w-8 h-8 border border-gray-300 rounded hover:border-gray-400 flex items-center justify-center transition-colors"
        title={title}
      >
        <div
          className="w-5 h-5 rounded border border-gray-200"
          style={{ backgroundColor: value === 'transparent' ? 'white' : value }}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-[300] w-72">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{title}</span>
              <button
                onClick={handleEyedropper}
                className={`p-1.5 rounded-lg transition-colors ${
                  eyedropperActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'
                }`}
                title="取色器"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex border-b border-gray-100">
            {[
              { id: 'presets', label: '预设' },
              { id: 'picker', label: '调色盘' },
              { id: 'recent', label: '最近' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-3">
            {activeTab === 'presets' && (
              <div className="grid grid-cols-10 gap-1">
                {PRESET_COLORS.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => handleColorSelect(color)}
                    className={`w-5 h-5 rounded border-2 transition-all hover:scale-110 ${
                      value === color ? 'ring-2 ring-blue-500 border-blue-400' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}

            {activeTab === 'picker' && (
              <div className="space-y-3">
                <canvas
                  ref={pickerRef}
                  width={200}
                  height={150}
                  onClick={handlePickerClick}
                  className="w-full h-36 rounded-lg cursor-crosshair border border-gray-200"
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-8">色相</span>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={hue}
                      onChange={e => handleHslChange(parseInt(e.target.value), saturation, lightness)}
                      className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, 
                          hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), 
                          hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%))`
                      }}
                    />
                    <span className="text-xs text-gray-600 w-8">{hue}°</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-8">饱和</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={saturation}
                      onChange={e => handleHslChange(hue, parseInt(e.target.value), lightness)}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-600 w-8">{saturation}%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-8">亮度</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={lightness}
                      onChange={e => handleHslChange(hue, saturation, parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-600 w-8">{lightness}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-200"
                    style={{ backgroundColor: customColor }}
                  />
                  <input
                    type="text"
                    value={customColor.toUpperCase()}
                    onChange={e => setCustomColor(e.target.value)}
                    className="flex-1 h-8 px-2 text-sm border border-gray-200 rounded-lg font-mono"
                    placeholder="#000000"
                  />
                  <button
                    onClick={handleCustomColorConfirm}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    确定
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'recent' && (
              <div>
                {recentColors.length > 0 ? (
                  <div className="grid grid-cols-8 gap-1">
                    {recentColors.map((color, index) => (
                      <button
                        key={index}
                        onClick={() => handleColorSelect(color)}
                        className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                          value === color ? 'ring-2 ring-blue-500 border-blue-400' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 text-sm py-8">
                    暂无最近使用的颜色
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">当前颜色:</span>
              <div
                className="w-6 h-6 rounded border border-gray-200"
                style={{ backgroundColor: value === 'transparent' ? 'white' : value }}
              />
              <span className="text-xs font-mono text-gray-600">{value}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

import { useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'

export interface SlideTemplate {
  id: string
  name: string
  nameEn: string
  category: 'business' | 'education' | 'creative' | 'minimal' | 'technology'
  thumbnail: string
  layout: SlideLayout
  style: SlideStyle
}

export interface SlideLayout {
  type: 'title' | 'title-content' | 'two-column' | 'image-left' | 'image-right' | 'image-full' | 'comparison' | 'timeline' | 'chart' | 'blank'
  elements: LayoutElement[]
}

export interface LayoutElement {
  id: string
  type: 'text' | 'image' | 'shape' | 'chart' | 'table'
  x: number
  y: number
  width: number
  height: number
  style?: Record<string, string>
  content?: string
  placeholder?: string
}

export interface SlideStyle {
  backgroundColor: string
  backgroundImage?: string
  fontFamily: string
  titleColor: string
  bodyColor: string
  accentColor: string
  borderRadius: number
  shadow: boolean
}

export const slideTemplates: SlideTemplate[] = [
  {
    id: 'title-simple',
    name: '简约标题',
    nameEn: 'Simple Title',
    category: 'minimal',
    thumbnail: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    layout: {
      type: 'title',
      elements: [
        { id: 'title', type: 'text', x: 10, y: 40, width: 80, height: 15, placeholder: '标题', style: { fontSize: '48px', fontWeight: 'bold', textAlign: 'center' } },
        { id: 'subtitle', type: 'text', x: 20, y: 58, width: 60, height: 8, placeholder: '副标题', style: { fontSize: '24px', textAlign: 'center' } },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#667eea',
      borderRadius: 0,
      shadow: false
    }
  },
  {
    id: 'title-gradient',
    name: '渐变标题',
    nameEn: 'Gradient Title',
    category: 'creative',
    thumbnail: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    layout: {
      type: 'title',
      elements: [
        { id: 'title', type: 'text', x: 10, y: 35, width: 80, height: 20, placeholder: '标题', style: { fontSize: '56px', fontWeight: 'bold', textAlign: 'center', color: '#ffffff' } },
        { id: 'subtitle', type: 'text', x: 15, y: 58, width: 70, height: 10, placeholder: '副标题', style: { fontSize: '28px', textAlign: 'center', color: '#ffffff' } },
        { id: 'author', type: 'text', x: 35, y: 85, width: 30, height: 5, placeholder: '作者', style: { fontSize: '16px', textAlign: 'center', color: '#ffffff' } },
      ]
    },
    style: {
      backgroundColor: '#f093fb',
      backgroundImage: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      accentColor: '#ffffff',
      borderRadius: 0,
      shadow: false
    }
  },
  {
    id: 'content-left',
    name: '左文右图',
    nameEn: 'Text Left Image Right',
    category: 'business',
    thumbnail: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    layout: {
      type: 'image-right',
      elements: [
        { id: 'title', type: 'text', x: 5, y: 8, width: 50, height: 10, placeholder: '标题', style: { fontSize: '32px', fontWeight: 'bold' } },
        { id: 'content', type: 'text', x: 5, y: 22, width: 45, height: 65, placeholder: '内容', style: { fontSize: '18px', lineHeight: '1.6' } },
        { id: 'image', type: 'image', x: 55, y: 15, width: 40, height: 70, placeholder: '图片', style: {} },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#4facfe',
      borderRadius: 8,
      shadow: true
    }
  },
  {
    id: 'content-right',
    name: '左图右文',
    nameEn: 'Image Left Text Right',
    category: 'business',
    thumbnail: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    layout: {
      type: 'image-left',
      elements: [
        { id: 'image', type: 'image', x: 5, y: 15, width: 40, height: 70, placeholder: '图片', style: {} },
        { id: 'title', type: 'text', x: 50, y: 8, width: 45, height: 10, placeholder: '标题', style: { fontSize: '32px', fontWeight: 'bold' } },
        { id: 'content', type: 'text', x: 50, y: 22, width: 45, height: 65, placeholder: '内容', style: { fontSize: '18px', lineHeight: '1.6' } },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#43e97b',
      borderRadius: 8,
      shadow: true
    }
  },
  {
    id: 'two-column',
    name: '双栏布局',
    nameEn: 'Two Column',
    category: 'business',
    thumbnail: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    layout: {
      type: 'two-column',
      elements: [
        { id: 'title', type: 'text', x: 5, y: 5, width: 90, height: 10, placeholder: '标题', style: { fontSize: '36px', fontWeight: 'bold', textAlign: 'center' } },
        { id: 'left-title', type: 'text', x: 5, y: 20, width: 40, height: 8, placeholder: '左标题', style: { fontSize: '24px', fontWeight: 'bold' } },
        { id: 'left-content', type: 'text', x: 5, y: 30, width: 40, height: 60, placeholder: '左内容', style: { fontSize: '16px', lineHeight: '1.6' } },
        { id: 'right-title', type: 'text', x: 55, y: 20, width: 40, height: 8, placeholder: '右标题', style: { fontSize: '24px', fontWeight: 'bold' } },
        { id: 'right-content', type: 'text', x: 55, y: 30, width: 40, height: 60, placeholder: '右内容', style: { fontSize: '16px', lineHeight: '1.6' } },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#fa709a',
      borderRadius: 0,
      shadow: false
    }
  },
  {
    id: 'comparison',
    name: '对比布局',
    nameEn: 'Comparison',
    category: 'business',
    thumbnail: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    layout: {
      type: 'comparison',
      elements: [
        { id: 'title', type: 'text', x: 5, y: 5, width: 90, height: 10, placeholder: '对比标题', style: { fontSize: '36px', fontWeight: 'bold', textAlign: 'center' } },
        { id: 'left-header', type: 'text', x: 5, y: 20, width: 42, height: 8, placeholder: '选项A', style: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#e8f4f8' } },
        { id: 'left-content', type: 'text', x: 5, y: 30, width: 42, height: 60, placeholder: '选项A内容', style: { fontSize: '16px' } },
        { id: 'right-header', type: 'text', x: 53, y: 20, width: 42, height: 8, placeholder: '选项B', style: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#f8e8e8' } },
        { id: 'right-content', type: 'text', x: 53, y: 30, width: 42, height: 60, placeholder: '选项B内容', style: { fontSize: '16px' } },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#a8edea',
      borderRadius: 8,
      shadow: true
    }
  },
  {
    id: 'timeline',
    name: '时间线',
    nameEn: 'Timeline',
    category: 'business',
    thumbnail: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
    layout: {
      type: 'timeline',
      elements: [
        { id: 'title', type: 'text', x: 5, y: 5, width: 90, height: 10, placeholder: '时间线标题', style: { fontSize: '36px', fontWeight: 'bold', textAlign: 'center' } },
        { id: 'point1', type: 'shape', x: 15, y: 25, width: 20, height: 25, placeholder: '节点1', style: {} },
        { id: 'point2', type: 'shape', x: 40, y: 25, width: 20, height: 25, placeholder: '节点2', style: {} },
        { id: 'point3', type: 'shape', x: 65, y: 25, width: 20, height: 25, placeholder: '节点3', style: {} },
        { id: 'point4', type: 'shape', x: 15, y: 55, width: 20, height: 25, placeholder: '节点4', style: {} },
        { id: 'point5', type: 'shape', x: 40, y: 55, width: 20, height: 25, placeholder: '节点5', style: {} },
        { id: 'point6', type: 'shape', x: 65, y: 55, width: 20, height: 25, placeholder: '节点6', style: {} },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#5ee7df',
      borderRadius: 8,
      shadow: false
    }
  },
  {
    id: 'chart-bar',
    name: '柱状图',
    nameEn: 'Bar Chart',
    category: 'business',
    thumbnail: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    layout: {
      type: 'chart',
      elements: [
        { id: 'title', type: 'text', x: 5, y: 5, width: 90, height: 10, placeholder: '图表标题', style: { fontSize: '32px', fontWeight: 'bold' } },
        { id: 'chart', type: 'chart', x: 10, y: 20, width: 80, height: 70, placeholder: '柱状图', style: { chartType: 'bar' } },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#f6d365',
      borderRadius: 0,
      shadow: false
    }
  },
  {
    id: 'chart-pie',
    name: '饼图',
    nameEn: 'Pie Chart',
    category: 'business',
    thumbnail: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    layout: {
      type: 'chart',
      elements: [
        { id: 'title', type: 'text', x: 5, y: 5, width: 90, height: 10, placeholder: '图表标题', style: { fontSize: '32px', fontWeight: 'bold' } },
        { id: 'chart', type: 'chart', x: 25, y: 20, width: 50, height: 70, placeholder: '饼图', style: { chartType: 'pie' } },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#ffecd2',
      borderRadius: 0,
      shadow: false
    }
  },
  {
    id: 'tech-dark',
    name: '科技暗黑',
    nameEn: 'Tech Dark',
    category: 'technology',
    thumbnail: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%)',
    layout: {
      type: 'title',
      elements: [
        { id: 'title', type: 'text', x: 10, y: 35, width: 80, height: 20, placeholder: '标题', style: { fontSize: '56px', fontWeight: 'bold', textAlign: 'center', color: '#00d4ff' } },
        { id: 'subtitle', type: 'text', x: 15, y: 58, width: 70, height: 10, placeholder: '副标题', style: { fontSize: '28px', textAlign: 'center', color: '#ffffff' } },
      ]
    },
    style: {
      backgroundColor: '#0c0c0c',
      backgroundImage: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%)',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#00d4ff',
      bodyColor: '#ffffff',
      accentColor: '#00d4ff',
      borderRadius: 0,
      shadow: true
    }
  },
  {
    id: 'education-colorful',
    name: '教育彩色',
    nameEn: 'Education Colorful',
    category: 'education',
    thumbnail: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
    layout: {
      type: 'title-content',
      elements: [
        { id: 'title', type: 'text', x: 5, y: 5, width: 90, height: 12, placeholder: '课程标题', style: { fontSize: '40px', fontWeight: 'bold', textAlign: 'center' } },
        { id: 'content', type: 'text', x: 10, y: 22, width: 80, height: 70, placeholder: '课程内容', style: { fontSize: '20px', lineHeight: '1.8' } },
      ]
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#ff6b6b',
      bodyColor: '#333333',
      accentColor: '#ff9a9e',
      borderRadius: 12,
      shadow: true
    }
  },
  {
    id: 'blank',
    name: '空白幻灯片',
    nameEn: 'Blank Slide',
    category: 'minimal',
    thumbnail: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    layout: {
      type: 'blank',
      elements: []
    },
    style: {
      backgroundColor: '#ffffff',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#333333',
      bodyColor: '#666666',
      accentColor: '#667eea',
      borderRadius: 0,
      shadow: false
    }
  },
]

export const colorThemes = [
  { id: 'blue', name: '蓝色商务', nameEn: 'Blue Business', primary: '#2563eb', secondary: '#3b82f6', accent: '#60a5fa', background: '#ffffff', text: '#1e3a5f' },
  { id: 'green', name: '绿色自然', nameEn: 'Green Nature', primary: '#059669', secondary: '#10b981', accent: '#34d399', background: '#ffffff', text: '#064e3b' },
  { id: 'purple', name: '紫色创意', nameEn: 'Purple Creative', primary: '#7c3aed', secondary: '#8b5cf6', accent: '#a78bfa', background: '#ffffff', text: '#4c1d95' },
  { id: 'red', name: '红色热情', nameEn: 'Red Passion', primary: '#dc2626', secondary: '#ef4444', accent: '#f87171', background: '#ffffff', text: '#7f1d1d' },
  { id: 'orange', name: '橙色活力', nameEn: 'Orange Energy', primary: '#ea580c', secondary: '#f97316', accent: '#fb923c', background: '#ffffff', text: '#7c2d12' },
  { id: 'dark', name: '暗黑科技', nameEn: 'Dark Tech', primary: '#00d4ff', secondary: '#00a8cc', accent: '#66e0ff', background: '#0c0c0c', text: '#ffffff' },
  { id: 'pink', name: '粉色浪漫', nameEn: 'Pink Romance', primary: '#ec4899', secondary: '#f472b6', accent: '#f9a8d4', background: '#ffffff', text: '#831843' },
  { id: 'teal', name: '青色清新', nameEn: 'Teal Fresh', primary: '#0d9488', secondary: '#14b8a6', accent: '#2dd4bf', background: '#ffffff', text: '#134e4a' },
]

interface TemplatePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (template: SlideTemplate) => void
}

export function TemplatePicker({ isOpen, onClose, onSelect }: TemplatePickerProps) {
  const { language } = useLanguageStore()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  if (!isOpen) return null
  
  const categories = [
    { id: 'all', name: language === 'zh' ? '全部' : 'All' },
    { id: 'business', name: language === 'zh' ? '商务' : 'Business' },
    { id: 'education', name: language === 'zh' ? '教育' : 'Education' },
    { id: 'creative', name: language === 'zh' ? '创意' : 'Creative' },
    { id: 'minimal', name: language === 'zh' ? '简约' : 'Minimal' },
    { id: 'technology', name: language === 'zh' ? '科技' : 'Technology' },
  ]
  
  const filteredTemplates = selectedCategory === 'all' 
    ? slideTemplates 
    : slideTemplates.filter(t => t.category === selectedCategory)
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[800px] h-[600px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '选择模板' : 'Select Template'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex border-b">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 text-sm ${selectedCategory === cat.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => { onSelect(template); onClose() }}
                className="group relative rounded-lg overflow-hidden border border-[#d0d0d0] hover:border-blue-500 hover:shadow-lg transition-all"
              >
                <div 
                  className="aspect-[16/9] w-full"
                  style={{ background: template.thumbnail }}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                    <span className="text-white text-sm font-medium px-3 py-1 bg-blue-500 rounded">
                      {language === 'zh' ? '应用' : 'Apply'}
                    </span>
                  </div>
                </div>
                <div className="p-2 text-left">
                  <div className="text-sm font-medium">
                    {language === 'zh' ? template.name : template.nameEn}
                  </div>
                  <div className="text-xs text-gray-400">
                    {template.layout.type}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ColorThemePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (theme: typeof colorThemes[0]) => void
  currentTheme?: string
}

export function ColorThemePicker({ isOpen, onClose, onSelect, currentTheme }: ColorThemePickerProps) {
  const { language } = useLanguageStore()
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '选择配色方案' : 'Select Color Theme'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {colorThemes.map(theme => (
              <button
                key={theme.id}
                onClick={() => { onSelect(theme); onClose() }}
                className={`p-3 rounded-lg border transition-all ${
                  currentTheme === theme.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-[#d0d0d0] hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.primary }} />
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.secondary }} />
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.accent }} />
                </div>
                <div className="text-sm font-medium">
                  {language === 'zh' ? theme.name : theme.nameEn}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function applyTemplateToSlide(template: SlideTemplate): {
  elements: LayoutElement[]
  style: SlideStyle
} {
  return {
    elements: template.layout.elements.map(el => ({
      ...el,
      id: `${el.id}_${Date.now()}`,
      content: el.placeholder || ''
    })),
    style: template.style
  }
}

export function generateSlideHTML(template: SlideTemplate): string {
  const { style, layout } = template
  
  let html = `<div style="
    width: 100%;
    height: 100%;
    background: ${style.backgroundImage || style.backgroundColor};
    font-family: ${style.fontFamily};
    position: relative;
    border-radius: ${style.borderRadius}px;
    ${style.shadow ? 'box-shadow: 0 4px 20px rgba(0,0,0,0.1);' : ''}
  ">`
  
  for (const element of layout.elements) {
    const left = `${element.x}%`
    const top = `${element.y}%`
    const width = `${element.width}%`
    const height = `${element.height}%`
    
    let elementStyle = `
      position: absolute;
      left: ${left};
      top: ${top};
      width: ${width};
      height: ${height};
    `
    
    if (element.style) {
      for (const [key, value] of Object.entries(element.style)) {
        elementStyle += `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`
      }
    }
    
    if (element.type === 'text') {
      html += `<div style="${elementStyle}">${element.placeholder || ''}</div>`
    } else if (element.type === 'image') {
      html += `<div style="${elementStyle}background: #f0f0f0;display: flex;align-items: center;justify-content: center;border-radius: 8px;">
        <span style="color: #999;">${element.placeholder || '图片'}</span>
      </div>`
    } else if (element.type === 'shape') {
      html += `<div style="${elementStyle}background: ${style.accentColor};border-radius: 8px;padding: 10px;">
        <span style="color: #fff;">${element.placeholder || ''}</span>
      </div>`
    }
  }
  
  html += '</div>'
  return html
}

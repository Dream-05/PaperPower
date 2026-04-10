export interface PPTTemplate {
  id: string
  name: string
  category: 'business' | 'education' | 'creative' | 'minimal' | 'technology'
  description: string
  preview: string
  slides: TemplateSlide[]
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
  fonts: {
    title: string
    body: string
  }
}

export interface TemplateSlide {
  layout: 'title' | 'titleContent' | 'twoColumn' | 'imageLeft' | 'imageRight' | 'blank' | 'section' | 'quote'
  elements: TemplateElement[]
}

export interface TemplateElement {
  type: 'text' | 'shape' | 'placeholder'
  x: number
  y: number
  width: number
  height: number
  content?: string
  style?: {
    fontSize?: number
    fontWeight?: 'normal' | 'bold'
    color?: string
    textAlign?: 'left' | 'center' | 'right'
    backgroundColor?: string
  }
  placeholder?: 'title' | 'subtitle' | 'content' | 'image' | 'date'
}

export const pptTemplates: PPTTemplate[] = [
  {
    id: 'business-blue',
    name: '商务蓝',
    category: 'business',
    description: '专业商务风格，适合企业汇报、项目提案',
    preview: '🏢',
    colors: {
      primary: '#1e3a5f',
      secondary: '#4a90d9',
      accent: '#f39c12',
      background: '#ffffff',
      text: '#333333'
    },
    fonts: { title: 'Microsoft YaHei', body: 'Microsoft YaHei' },
    slides: [
      {
        layout: 'title',
        elements: [
          { type: 'placeholder', placeholder: 'title', x: 50, y: 180, width: 620, height: 80, style: { fontSize: 44, fontWeight: 'bold', color: '#1e3a5f', textAlign: 'center' } },
          { type: 'placeholder', placeholder: 'subtitle', x: 100, y: 280, width: 520, height: 40, style: { fontSize: 20, color: '#666666', textAlign: 'center' } },
          { type: 'shape', x: 0, y: 360, width: 720, height: 45, style: { backgroundColor: '#1e3a5f' } }
        ]
      },
      {
        layout: 'titleContent',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 60, style: { backgroundColor: '#1e3a5f' } },
          { type: 'placeholder', placeholder: 'title', x: 30, y: 15, width: 660, height: 40, style: { fontSize: 28, fontWeight: 'bold', color: '#ffffff' } },
          { type: 'placeholder', placeholder: 'content', x: 30, y: 80, width: 660, height: 300, style: { fontSize: 18, color: '#333333' } }
        ]
      },
      {
        layout: 'twoColumn',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 60, style: { backgroundColor: '#1e3a5f' } },
          { type: 'placeholder', placeholder: 'title', x: 30, y: 15, width: 660, height: 40, style: { fontSize: 28, fontWeight: 'bold', color: '#ffffff' } },
          { type: 'placeholder', placeholder: 'content', x: 30, y: 80, width: 310, height: 300, style: { fontSize: 16, color: '#333333' } },
          { type: 'placeholder', placeholder: 'content', x: 380, y: 80, width: 310, height: 300, style: { fontSize: 16, color: '#333333' } }
        ]
      }
    ]
  },
  {
    id: 'education-green',
    name: '教育绿',
    category: 'education',
    description: '清新教育风格，适合课件、培训材料',
    preview: '📚',
    colors: {
      primary: '#2d5a27',
      secondary: '#5cb85c',
      accent: '#f0ad4e',
      background: '#f9fff5',
      text: '#333333'
    },
    fonts: { title: 'SimHei', body: 'SimSun' },
    slides: [
      {
        layout: 'title',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 405, style: { backgroundColor: '#f9fff5' } },
          { type: 'shape', x: 0, y: 0, width: 20, height: 405, style: { backgroundColor: '#2d5a27' } },
          { type: 'placeholder', placeholder: 'title', x: 50, y: 150, width: 620, height: 80, style: { fontSize: 40, fontWeight: 'bold', color: '#2d5a27', textAlign: 'center' } },
          { type: 'placeholder', placeholder: 'subtitle', x: 100, y: 250, width: 520, height: 40, style: { fontSize: 18, color: '#666666', textAlign: 'center' } }
        ]
      },
      {
        layout: 'titleContent',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 50, style: { backgroundColor: '#2d5a27' } },
          { type: 'placeholder', placeholder: 'title', x: 30, y: 10, width: 660, height: 35, style: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' } },
          { type: 'placeholder', placeholder: 'content', x: 30, y: 70, width: 660, height: 310, style: { fontSize: 18, color: '#333333' } }
        ]
      }
    ]
  },
  {
    id: 'creative-orange',
    name: '创意橙',
    category: 'creative',
    description: '活力创意风格，适合产品展示、创意提案',
    preview: '🎨',
    colors: {
      primary: '#e74c3c',
      secondary: '#f39c12',
      accent: '#3498db',
      background: '#ffffff',
      text: '#2c3e50'
    },
    fonts: { title: 'Arial', body: 'Arial' },
    slides: [
      {
        layout: 'title',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 405, style: { backgroundColor: '#ffffff' } },
          { type: 'shape', x: 0, y: 300, width: 720, height: 105, style: { backgroundColor: '#e74c3c' } },
          { type: 'placeholder', placeholder: 'title', x: 50, y: 120, width: 620, height: 80, style: { fontSize: 48, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' } },
          { type: 'placeholder', placeholder: 'subtitle', x: 50, y: 320, width: 620, height: 40, style: { fontSize: 20, color: '#ffffff', textAlign: 'center' } }
        ]
      },
      {
        layout: 'titleContent',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 10, height: 405, style: { backgroundColor: '#e74c3c' } },
          { type: 'placeholder', placeholder: 'title', x: 30, y: 20, width: 660, height: 50, style: { fontSize: 32, fontWeight: 'bold', color: '#e74c3c' } },
          { type: 'placeholder', placeholder: 'content', x: 30, y: 80, width: 660, height: 300, style: { fontSize: 18, color: '#2c3e50' } }
        ]
      }
    ]
  },
  {
    id: 'minimal-white',
    name: '极简白',
    category: 'minimal',
    description: '简约现代风格，适合各类正式场合',
    preview: '⬜',
    colors: {
      primary: '#2c3e50',
      secondary: '#7f8c8d',
      accent: '#3498db',
      background: '#ffffff',
      text: '#333333'
    },
    fonts: { title: 'Helvetica', body: 'Helvetica' },
    slides: [
      {
        layout: 'title',
        elements: [
          { type: 'placeholder', placeholder: 'title', x: 50, y: 160, width: 620, height: 80, style: { fontSize: 44, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' } },
          { type: 'shape', x: 280, y: 260, width: 160, height: 3, style: { backgroundColor: '#3498db' } },
          { type: 'placeholder', placeholder: 'subtitle', x: 100, y: 290, width: 520, height: 40, style: { fontSize: 18, color: '#7f8c8d', textAlign: 'center' } }
        ]
      },
      {
        layout: 'titleContent',
        elements: [
          { type: 'placeholder', placeholder: 'title', x: 30, y: 20, width: 660, height: 50, style: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50' } },
          { type: 'shape', x: 30, y: 75, width: 100, height: 2, style: { backgroundColor: '#3498db' } },
          { type: 'placeholder', placeholder: 'content', x: 30, y: 100, width: 660, height: 280, style: { fontSize: 16, color: '#333333' } }
        ]
      }
    ]
  },
  {
    id: 'technology-dark',
    name: '科技黑',
    category: 'technology',
    description: '科技感风格，适合技术汇报、产品发布',
    preview: '💻',
    colors: {
      primary: '#00d4ff',
      secondary: '#7c3aed',
      accent: '#10b981',
      background: '#0f172a',
      text: '#e2e8f0'
    },
    fonts: { title: 'Roboto', body: 'Roboto' },
    slides: [
      {
        layout: 'title',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 405, style: { backgroundColor: '#0f172a' } },
          { type: 'shape', x: 0, y: 380, width: 720, height: 25, style: { backgroundColor: '#00d4ff' } },
          { type: 'placeholder', placeholder: 'title', x: 50, y: 140, width: 620, height: 80, style: { fontSize: 48, fontWeight: 'bold', color: '#00d4ff', textAlign: 'center' } },
          { type: 'placeholder', placeholder: 'subtitle', x: 100, y: 240, width: 520, height: 40, style: { fontSize: 20, color: '#e2e8f0', textAlign: 'center' } }
        ]
      },
      {
        layout: 'titleContent',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 405, style: { backgroundColor: '#0f172a' } },
          { type: 'shape', x: 0, y: 0, width: 5, height: 405, style: { backgroundColor: '#00d4ff' } },
          { type: 'placeholder', placeholder: 'title', x: 30, y: 20, width: 660, height: 50, style: { fontSize: 28, fontWeight: 'bold', color: '#00d4ff' } },
          { type: 'placeholder', placeholder: 'content', x: 30, y: 80, width: 660, height: 300, style: { fontSize: 16, color: '#e2e8f0' } }
        ]
      }
    ]
  },
  {
    id: 'academic-blue',
    name: '学术蓝',
    category: 'education',
    description: '学术研究风格，适合论文答辩、学术报告',
    preview: '🎓',
    colors: {
      primary: '#1a365d',
      secondary: '#2b6cb0',
      accent: '#ed8936',
      background: '#ffffff',
      text: '#2d3748'
    },
    fonts: { title: 'Times New Roman', body: 'Times New Roman' },
    slides: [
      {
        layout: 'title',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 80, style: { backgroundColor: '#1a365d' } },
          { type: 'placeholder', placeholder: 'title', x: 50, y: 160, width: 620, height: 80, style: { fontSize: 36, fontWeight: 'bold', color: '#1a365d', textAlign: 'center' } },
          { type: 'placeholder', placeholder: 'subtitle', x: 100, y: 260, width: 520, height: 60, style: { fontSize: 18, color: '#4a5568', textAlign: 'center' } },
          { type: 'placeholder', placeholder: 'date', x: 250, y: 340, width: 220, height: 30, style: { fontSize: 14, color: '#718096', textAlign: 'center' } }
        ]
      },
      {
        layout: 'section',
        elements: [
          { type: 'shape', x: 0, y: 0, width: 720, height: 405, style: { backgroundColor: '#1a365d' } },
          { type: 'placeholder', placeholder: 'title', x: 50, y: 160, width: 620, height: 80, style: { fontSize: 40, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' } }
        ]
      }
    ]
  }
]

export const templateCategories = [
  { id: 'all', name: '全部模板', icon: '📋' },
  { id: 'business', name: '商务', icon: '🏢' },
  { id: 'education', name: '教育', icon: '📚' },
  { id: 'creative', name: '创意', icon: '🎨' },
  { id: 'minimal', name: '极简', icon: '⬜' },
  { id: 'technology', name: '科技', icon: '💻' }
]

export function getTemplatesByCategory(category: string): PPTTemplate[] {
  if (category === 'all') return pptTemplates
  return pptTemplates.filter(t => t.category === category)
}

export function getTemplateById(id: string): PPTTemplate | undefined {
  return pptTemplates.find(t => t.id === id)
}

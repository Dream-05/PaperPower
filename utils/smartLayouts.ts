export interface SmartLayoutType {
  id: string
  name: string
  description: string
  elements: {
    type: 'text' | 'image' | 'chart'
    x: number
    y: number
    width: number
    height: number
    placeholder?: string
  }[]
}

export const slideLayouts: SmartLayoutType[] = [
  {
    id: 'title',
    name: '标题页',
    description: '适合演示文稿的首页',
    elements: [
      {
        type: 'text',
        x: 50,
        y: 100,
        width: 620,
        height: 80,
        placeholder: '主标题'
      },
      {
        type: 'text',
        x: 50,
        y: 200,
        width: 620,
        height: 60,
        placeholder: '副标题'
      },
      {
        type: 'text',
        x: 50,
        y: 350,
        width: 620,
        height: 30,
        placeholder: '演讲者姓名'
      }
    ]
  },
  {
    id: 'content',
    name: '内容页',
    description: '适合展示详细内容',
    elements: [
      {
        type: 'text',
        x: 50,
        y: 50,
        width: 620,
        height: 50,
        placeholder: '标题'
      },
      {
        type: 'text',
        x: 50,
        y: 120,
        width: 620,
        height: 200,
        placeholder: '内容'
      }
    ]
  },
  {
    id: 'image',
    name: '图片页',
    description: '适合展示图片内容',
    elements: [
      {
        type: 'text',
        x: 50,
        y: 50,
        width: 620,
        height: 50,
        placeholder: '标题'
      },
      {
        type: 'image',
        x: 100,
        y: 120,
        width: 520,
        height: 200,
        placeholder: '图片'
      }
    ]
  },
  {
    id: 'two-column',
    name: '两栏布局',
    description: '适合对比或并列内容',
    elements: [
      {
        type: 'text',
        x: 50,
        y: 50,
        width: 620,
        height: 50,
        placeholder: '标题'
      },
      {
        type: 'text',
        x: 50,
        y: 120,
        width: 300,
        height: 200,
        placeholder: '左侧内容'
      },
      {
        type: 'text',
        x: 370,
        y: 120,
        width: 300,
        height: 200,
        placeholder: '右侧内容'
      }
    ]
  },
  {
    id: 'chart',
    name: '图表页',
    description: '适合展示数据图表',
    elements: [
      {
        type: 'text',
        x: 50,
        y: 50,
        width: 620,
        height: 50,
        placeholder: '标题'
      },
      {
        type: 'chart',
        x: 50,
        y: 120,
        width: 620,
        height: 200,
        placeholder: '图表'
      }
    ]
  },
  {
    id: 'summary',
    name: '总结页',
    description: '适合展示总结内容',
    elements: [
      {
        type: 'text',
        x: 50,
        y: 80,
        width: 620,
        height: 60,
        placeholder: '总结'
      },
      {
        type: 'text',
        x: 100,
        y: 160,
        width: 520,
        height: 150,
        placeholder: '总结内容'
      }
    ]
  }
]

export const getLayoutById = (id: string): SmartLayoutType | undefined => {
  return slideLayouts.find(layout => layout.id === id)
}

export const getRecommendedLayout = (content: string): SmartLayoutType => {
  // 基于内容分析推荐布局
  if (content.includes('图表') || content.includes('数据') || content.includes('统计')) {
    return slideLayouts.find(layout => layout.id === 'chart') || slideLayouts[0]
  }
  if (content.includes('图片') || content.includes('照片')) {
    return slideLayouts.find(layout => layout.id === 'image') || slideLayouts[0]
  }
  if (content.includes('对比') || content.includes('并列')) {
    return slideLayouts.find(layout => layout.id === 'two-column') || slideLayouts[0]
  }
  if (content.includes('总结') || content.includes('结论')) {
    return slideLayouts.find(layout => layout.id === 'summary') || slideLayouts[0]
  }
  if (content.includes('标题') || content.includes('介绍')) {
    return slideLayouts.find(layout => layout.id === 'title') || slideLayouts[0]
  }
  return slideLayouts.find(layout => layout.id === 'content') || slideLayouts[0]
}
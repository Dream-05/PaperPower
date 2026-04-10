import { useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'

export interface Animation {
  id: string
  name: string
  nameEn: string
  category: 'entrance' | 'emphasis' | 'exit' | 'motion'
  duration: number
  delay: number
  easing: string
  preview: string
}

export const animations: Animation[] = [
  {
    id: 'none',
    name: '无动画',
    nameEn: 'None',
    category: 'entrance',
    duration: 0,
    delay: 0,
    easing: 'ease',
    preview: ''
  },
  {
    id: 'fade-in',
    name: '淡入',
    nameEn: 'Fade In',
    category: 'entrance',
    duration: 500,
    delay: 0,
    easing: 'ease-out',
    preview: 'opacity: 0 → 1'
  },
  {
    id: 'fade-in-up',
    name: '淡入上移',
    nameEn: 'Fade In Up',
    category: 'entrance',
    duration: 600,
    delay: 0,
    easing: 'ease-out',
    preview: 'opacity + translateY'
  },
  {
    id: 'fade-in-down',
    name: '淡入下移',
    nameEn: 'Fade In Down',
    category: 'entrance',
    duration: 600,
    delay: 0,
    easing: 'ease-out',
    preview: 'opacity + translateY'
  },
  {
    id: 'fade-in-left',
    name: '淡入左移',
    nameEn: 'Fade In Left',
    category: 'entrance',
    duration: 600,
    delay: 0,
    easing: 'ease-out',
    preview: 'opacity + translateX'
  },
  {
    id: 'fade-in-right',
    name: '淡入右移',
    nameEn: 'Fade In Right',
    category: 'entrance',
    duration: 600,
    delay: 0,
    easing: 'ease-out',
    preview: 'opacity + translateX'
  },
  {
    id: 'zoom-in',
    name: '缩放进入',
    nameEn: 'Zoom In',
    category: 'entrance',
    duration: 500,
    delay: 0,
    easing: 'ease-out',
    preview: 'scale: 0 → 1'
  },
  {
    id: 'zoom-in-up',
    name: '缩放上移',
    nameEn: 'Zoom In Up',
    category: 'entrance',
    duration: 600,
    delay: 0,
    easing: 'ease-out',
    preview: 'scale + translateY'
  },
  {
    id: 'zoom-in-down',
    name: '缩放下移',
    nameEn: 'Zoom In Down',
    category: 'entrance',
    duration: 600,
    delay: 0,
    easing: 'ease-out',
    preview: 'scale + translateY'
  },
  {
    id: 'slide-in-left',
    name: '从左滑入',
    nameEn: 'Slide In Left',
    category: 'entrance',
    duration: 500,
    delay: 0,
    easing: 'ease-out',
    preview: 'translateX: -100% → 0'
  },
  {
    id: 'slide-in-right',
    name: '从右滑入',
    nameEn: 'Slide In Right',
    category: 'entrance',
    duration: 500,
    delay: 0,
    easing: 'ease-out',
    preview: 'translateX: 100% → 0'
  },
  {
    id: 'slide-in-up',
    name: '从下滑入',
    nameEn: 'Slide In Up',
    category: 'entrance',
    duration: 500,
    delay: 0,
    easing: 'ease-out',
    preview: 'translateY: 100% → 0'
  },
  {
    id: 'slide-in-down',
    name: '从上滑入',
    nameEn: 'Slide In Down',
    category: 'entrance',
    duration: 500,
    delay: 0,
    easing: 'ease-out',
    preview: 'translateY: -100% → 0'
  },
  {
    id: 'bounce-in',
    name: '弹跳进入',
    nameEn: 'Bounce In',
    category: 'entrance',
    duration: 750,
    delay: 0,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    preview: 'scale with bounce'
  },
  {
    id: 'rotate-in',
    name: '旋转进入',
    nameEn: 'Rotate In',
    category: 'entrance',
    duration: 500,
    delay: 0,
    easing: 'ease-out',
    preview: 'rotate: -180deg → 0'
  },
  {
    id: 'flip-in-x',
    name: 'X轴翻转',
    nameEn: 'Flip In X',
    category: 'entrance',
    duration: 600,
    delay: 0,
    easing: 'ease-out',
    preview: 'rotateX: 90deg → 0'
  },
  {
    id: 'flip-in-y',
    name: 'Y轴翻转',
    nameEn: 'Flip In Y',
    category: 'entrance',
    duration: 600,
    delay: 0,
    easing: 'ease-out',
    preview: 'rotateY: 90deg → 0'
  },
  {
    id: 'pulse',
    name: '脉冲',
    nameEn: 'Pulse',
    category: 'emphasis',
    duration: 500,
    delay: 0,
    easing: 'ease-in-out',
    preview: 'scale: 1 → 1.1 → 1'
  },
  {
    id: 'shake',
    name: '抖动',
    nameEn: 'Shake',
    category: 'emphasis',
    duration: 500,
    delay: 0,
    easing: 'ease-in-out',
    preview: 'translateX shake'
  },
  {
    id: 'bounce',
    name: '弹跳',
    nameEn: 'Bounce',
    category: 'emphasis',
    duration: 1000,
    delay: 0,
    easing: 'ease',
    preview: 'translateY bounce'
  },
  {
    id: 'flash',
    name: '闪烁',
    nameEn: 'Flash',
    category: 'emphasis',
    duration: 500,
    delay: 0,
    easing: 'ease',
    preview: 'opacity: 1 → 0 → 1'
  },
  {
    id: 'tada',
    name: '摇摆',
    nameEn: 'Tada',
    category: 'emphasis',
    duration: 1000,
    delay: 0,
    easing: 'ease',
    preview: 'scale + rotate'
  },
  {
    id: 'heartbeat',
    name: '心跳',
    nameEn: 'Heartbeat',
    category: 'emphasis',
    duration: 1000,
    delay: 0,
    easing: 'ease-in-out',
    preview: 'scale heartbeat'
  },
  {
    id: 'fade-out',
    name: '淡出',
    nameEn: 'Fade Out',
    category: 'exit',
    duration: 500,
    delay: 0,
    easing: 'ease-in',
    preview: 'opacity: 1 → 0'
  },
  {
    id: 'fade-out-up',
    name: '淡出上移',
    nameEn: 'Fade Out Up',
    category: 'exit',
    duration: 600,
    delay: 0,
    easing: 'ease-in',
    preview: 'opacity + translateY'
  },
  {
    id: 'fade-out-down',
    name: '淡出下移',
    nameEn: 'Fade Out Down',
    category: 'exit',
    duration: 600,
    delay: 0,
    easing: 'ease-in',
    preview: 'opacity + translateY'
  },
  {
    id: 'zoom-out',
    name: '缩放退出',
    nameEn: 'Zoom Out',
    category: 'exit',
    duration: 500,
    delay: 0,
    easing: 'ease-in',
    preview: 'scale: 1 → 0'
  },
  {
    id: 'slide-out-left',
    name: '向左滑出',
    nameEn: 'Slide Out Left',
    category: 'exit',
    duration: 500,
    delay: 0,
    easing: 'ease-in',
    preview: 'translateX: 0 → -100%'
  },
  {
    id: 'slide-out-right',
    name: '向右滑出',
    nameEn: 'Slide Out Right',
    category: 'exit',
    duration: 500,
    delay: 0,
    easing: 'ease-in',
    preview: 'translateX: 0 → 100%'
  },
  {
    id: 'rotate-out',
    name: '旋转退出',
    nameEn: 'Rotate Out',
    category: 'exit',
    duration: 500,
    delay: 0,
    easing: 'ease-in',
    preview: 'rotate: 0 → 180deg'
  },
]

export const slideTransitions = [
  { id: 'none', name: '无切换', nameEn: 'None' },
  { id: 'fade', name: '淡入淡出', nameEn: 'Fade' },
  { id: 'slide-left', name: '向左滑动', nameEn: 'Slide Left' },
  { id: 'slide-right', name: '向右滑动', nameEn: 'Slide Right' },
  { id: 'slide-up', name: '向上滑动', nameEn: 'Slide Up' },
  { id: 'slide-down', name: '向下滑动', nameEn: 'Slide Down' },
  { id: 'zoom', name: '缩放', nameEn: 'Zoom' },
  { id: 'flip', name: '翻转', nameEn: 'Flip' },
  { id: 'cube', name: '立方体', nameEn: 'Cube' },
  { id: 'cover', name: '覆盖', nameEn: 'Cover' },
  { id: 'uncover', name: '揭开', nameEn: 'Uncover' },
  { id: 'random', name: '随机', nameEn: 'Random' },
]

export function getAnimationCSS(animation: Animation): string {
  const keyframes: Record<string, string> = {
    'fade-in': `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `,
    'fade-in-up': `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `,
    'fade-in-down': `
      @keyframes fadeInDown {
        from { opacity: 0; transform: translateY(-30px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `,
    'fade-in-left': `
      @keyframes fadeInLeft {
        from { opacity: 0; transform: translateX(-30px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `,
    'fade-in-right': `
      @keyframes fadeInRight {
        from { opacity: 0; transform: translateX(30px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `,
    'zoom-in': `
      @keyframes zoomIn {
        from { opacity: 0; transform: scale(0.3); }
        to { opacity: 1; transform: scale(1); }
      }
    `,
    'zoom-in-up': `
      @keyframes zoomInUp {
        from { opacity: 0; transform: scale(0.3) translateY(30px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
    `,
    'zoom-in-down': `
      @keyframes zoomInDown {
        from { opacity: 0; transform: scale(0.3) translateY(-30px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
    `,
    'slide-in-left': `
      @keyframes slideInLeft {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }
    `,
    'slide-in-right': `
      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
    `,
    'slide-in-up': `
      @keyframes slideInUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
    `,
    'slide-in-down': `
      @keyframes slideInDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
    `,
    'bounce-in': `
      @keyframes bounceIn {
        0% { opacity: 0; transform: scale(0.3); }
        50% { transform: scale(1.05); }
        70% { transform: scale(0.9); }
        100% { opacity: 1; transform: scale(1); }
      }
    `,
    'rotate-in': `
      @keyframes rotateIn {
        from { opacity: 0; transform: rotate(-180deg); }
        to { opacity: 1; transform: rotate(0); }
      }
    `,
    'flip-in-x': `
      @keyframes flipInX {
        from { opacity: 0; transform: perspective(400px) rotateX(90deg); }
        to { opacity: 1; transform: perspective(400px) rotateX(0); }
      }
    `,
    'flip-in-y': `
      @keyframes flipInY {
        from { opacity: 0; transform: perspective(400px) rotateY(90deg); }
        to { opacity: 1; transform: perspective(400px) rotateY(0); }
      }
    `,
    'pulse': `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
    `,
    'shake': `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
      }
    `,
    'bounce': `
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-30px); }
        60% { transform: translateY(-15px); }
      }
    `,
    'flash': `
      @keyframes flash {
        0%, 50%, 100% { opacity: 1; }
        25%, 75% { opacity: 0; }
      }
    `,
    'tada': `
      @keyframes tada {
        0% { transform: scale(1); }
        10%, 20% { transform: scale(0.9) rotate(-3deg); }
        30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); }
        40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); }
        100% { transform: scale(1) rotate(0); }
      }
    `,
    'heartbeat': `
      @keyframes heartbeat {
        0% { transform: scale(1); }
        14% { transform: scale(1.3); }
        28% { transform: scale(1); }
        42% { transform: scale(1.3); }
        70% { transform: scale(1); }
      }
    `,
    'fade-out': `
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `,
    'fade-out-up': `
      @keyframes fadeOutUp {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-30px); }
      }
    `,
    'fade-out-down': `
      @keyframes fadeOutDown {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(30px); }
      }
    `,
    'zoom-out': `
      @keyframes zoomOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.3); }
      }
    `,
    'slide-out-left': `
      @keyframes slideOutLeft {
        from { transform: translateX(0); }
        to { transform: translateX(-100%); }
      }
    `,
    'slide-out-right': `
      @keyframes slideOutRight {
        from { transform: translateX(0); }
        to { transform: translateX(100%); }
      }
    `,
    'rotate-out': `
      @keyframes rotateOut {
        from { opacity: 1; transform: rotate(0); }
        to { opacity: 0; transform: rotate(180deg); }
      }
    `,
  }
  
  return keyframes[animation.id] || ''
}

export function getAnimationStyle(animation: Animation): React.CSSProperties {
  if (animation.id === 'none') return {}
  
  return {
    animationName: animation.id.replace(/-/g, ''),
    animationDuration: `${animation.duration}ms`,
    animationDelay: `${animation.delay}ms`,
    animationTimingFunction: animation.easing,
    animationFillMode: 'both',
  }
}

interface AnimationPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (animation: Animation) => void
  currentAnimation?: string
}

export function AnimationPicker({ isOpen, onClose, onSelect, currentAnimation }: AnimationPickerProps) {
  const { language } = useLanguageStore()
  const [selectedCategory, setSelectedCategory] = useState<'entrance' | 'emphasis' | 'exit'>('entrance')
  
  if (!isOpen) return null
  
  const categories = [
    { id: 'entrance', name: language === 'zh' ? '进入' : 'Entrance' },
    { id: 'emphasis', name: language === 'zh' ? '强调' : 'Emphasis' },
    { id: 'exit', name: language === 'zh' ? '退出' : 'Exit' },
  ]
  
  const filteredAnimations = animations.filter(a => a.category === selectedCategory)
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '选择动画' : 'Select Animation'}
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
              onClick={() => setSelectedCategory(cat.id as typeof selectedCategory)}
              className={`px-4 py-2 text-sm ${selectedCategory === cat.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2">
            {filteredAnimations.map(anim => (
              <button
                key={anim.id}
                onClick={() => { onSelect(anim); onClose() }}
                className={`p-3 text-left rounded border transition-colors ${
                  currentAnimation === anim.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-[#d0d0d0] hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-sm">
                  {language === 'zh' ? anim.name : anim.nameEn}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {anim.duration}ms
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TransitionPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (transition: string) => void
  currentTransition?: string
}

export function TransitionPicker({ isOpen, onClose, onSelect, currentTransition }: TransitionPickerProps) {
  const { language } = useLanguageStore()
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[400px]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">
            {language === 'zh' ? '选择切换效果' : 'Select Transition'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2">
            {slideTransitions.map(trans => (
              <button
                key={trans.id}
                onClick={() => { onSelect(trans.id); onClose() }}
                className={`p-3 text-sm rounded border transition-colors ${
                  currentTransition === trans.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-[#d0d0d0] hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                {language === 'zh' ? trans.name : trans.nameEn}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

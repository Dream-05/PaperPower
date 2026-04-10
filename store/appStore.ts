import { create } from 'zustand'
import type { RecentFile, AIQuickCommand, IntentParseResult } from '@/types'

interface AppState {
  recentFiles: RecentFile[]
  quickCommands: AIQuickCommand[]
  currentFile: {
    name: string
    type: 'word' | 'excel' | 'ppt' | 'pdf' | null
    content: string | ArrayBuffer | null
  } | null
  aiPanel: {
    isOpen: boolean
    messages: Array<{
      role: 'user' | 'assistant'
      content: string
      intent?: IntentParseResult
    }>
  }
  isLoading: boolean
  
  addRecentFile: (file: RecentFile) => void
  clearRecentFiles: () => void
  setCurrentFile: (file: AppState['currentFile']) => void
  clearCurrentFile: () => void
  openAIPanel: () => void
  closeAIPanel: () => void
  addAIMessage: (message: { role: 'user' | 'assistant'; content: string; intent?: IntentParseResult }) => void
  clearAIMessages: () => void
  setLoading: (loading: boolean) => void
}

const defaultQuickCommands: AIQuickCommand[] = [
  { id: '1', label: '一键排版论文', description: '自动按照学术论文格式排版', icon: 'file-text', action: 'format_thesis' },
  { id: '2', label: '批量重命名文件', description: '按规则批量重命名文件', icon: 'files', action: 'batch_rename' },
  { id: '3', label: '生成教案模板', description: '创建标准教案模板', icon: 'book', action: 'create_lesson_plan' },
  { id: '4', label: '整理下载文件夹', description: '按类型分类整理文件', icon: 'folder', action: 'organize_downloads' },
  { id: '5', label: '分析Excel数据', description: '智能分析表格数据', icon: 'table', action: 'analyze_excel' },
  { id: '6', label: '生成PPT大纲', description: '根据内容生成演示文稿', icon: 'presentation', action: 'create_ppt' }
]

export const useAppStore = create<AppState>((set) => ({
  recentFiles: [],
  quickCommands: defaultQuickCommands,
  currentFile: null,
  aiPanel: {
    isOpen: false,
    messages: []
  },
  isLoading: false,
  
  addRecentFile: (file) => set((state) => {
    const filtered = state.recentFiles.filter(f => f.path !== file.path)
    const updated = [file, ...filtered].slice(0, 10)
    return { recentFiles: updated }
  }),
  
  clearRecentFiles: () => set({ recentFiles: [] }),
  
  setCurrentFile: (file) => set({ currentFile: file }),
  
  clearCurrentFile: () => set({ currentFile: null }),
  
  openAIPanel: () => set((state) => ({
    aiPanel: { ...state.aiPanel, isOpen: true }
  })),
  
  closeAIPanel: () => set((state) => ({
    aiPanel: { ...state.aiPanel, isOpen: false }
  })),
  
  addAIMessage: (message) => set((state) => ({
    aiPanel: {
      ...state.aiPanel,
      messages: [...state.aiPanel.messages, message]
    }
  })),
  
  clearAIMessages: () => set((state) => ({
    aiPanel: { ...state.aiPanel, messages: [] }
  })),
  
  setLoading: (loading) => set({ isLoading: loading })
}))

/**
 * useAI Hook
 * React Hook for AI functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  aiIntegration, 
  AIConfig, 
  AIResponse, 
  AIState 
} from '../services/aiIntegration'
import { SearchResult } from '../utils/AISearchService'

export interface UseAIOptions {
  autoInitialize?: boolean
  config?: Partial<AIConfig>
}

export interface UseAIReturn {
  isReady: boolean
  isLoading: boolean
  error: string | null
  state: AIState
  
  chat: (message: string, context?: Record<string, unknown>) => Promise<AIResponse>
  generate: (prompt: string, options?: {
    maxTokens?: number
    temperature?: number
    language?: 'zh' | 'en' | 'auto'
  }) => Promise<AIResponse>
  analyze: (content: string, type?: string) => Promise<AIResponse>
  processCommand: (command: string, context?: Record<string, unknown>) => Promise<AIResponse>
  translate: (text: string, targetLanguage: 'zh' | 'en') => Promise<AIResponse>
  summarize: (text: string, options?: { maxLength?: number }) => Promise<AIResponse>
  searchWeb: (query: string, options?: { maxResults?: number }) => Promise<SearchResult[]>
  
  initialize: () => Promise<void>
  learn: (pattern: { input: string; output: string; context?: Record<string, unknown> }) => void
  detectLanguage: (text: string) => 'zh' | 'en'
}

export function useAI(options: UseAIOptions = {}): UseAIReturn {
  const { autoInitialize = true, config } = options
  
  const [state, setState] = useState<AIState>(aiIntegration.getState())
  const isInitializing = useRef(false)

  useEffect(() => {
    if (autoInitialize && !state.isInitialized && !isInitializing.current) {
      isInitializing.current = true
      aiIntegration.initialize(config).then(() => {
        setState(aiIntegration.getState())
        isInitializing.current = false
      })
    }
  }, [autoInitialize, config, state.isInitialized])

  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = aiIntegration.getState()
      if (JSON.stringify(currentState) !== JSON.stringify(state)) {
        setState(currentState)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  const chat = useCallback(async (
    message: string,
    context?: Record<string, unknown>
  ): Promise<AIResponse> => {
    return aiIntegration.chat(message, context)
  }, [])

  const generate = useCallback(async (
    prompt: string,
    options?: {
      maxTokens?: number
      temperature?: number
      language?: 'zh' | 'en' | 'auto'
    }
  ): Promise<AIResponse> => {
    return aiIntegration.generateText(prompt, options)
  }, [])

  const analyze = useCallback(async (
    content: string,
    type?: string
  ): Promise<AIResponse> => {
    return aiIntegration.analyzeDocument(content, type)
  }, [])

  const processCommand = useCallback(async (
    command: string,
    context?: Record<string, unknown>
  ): Promise<AIResponse> => {
    return aiIntegration.processCommand(command, context)
  }, [])

  const translate = useCallback(async (
    text: string,
    targetLanguage: 'zh' | 'en'
  ): Promise<AIResponse> => {
    return aiIntegration.translate(text, targetLanguage)
  }, [])

  const summarize = useCallback(async (
    text: string,
    options?: { maxLength?: number }
  ): Promise<AIResponse> => {
    return aiIntegration.summarize(text, options)
  }, [])

  const searchWeb = useCallback(async (
    query: string,
    options?: { maxResults?: number }
  ): Promise<SearchResult[]> => {
    return aiIntegration.searchWeb(query, options)
  }, [])

  const initialize = useCallback(async (): Promise<void> => {
    if (!state.isInitialized && !isInitializing.current) {
      isInitializing.current = true
      await aiIntegration.initialize(config)
      setState(aiIntegration.getState())
      isInitializing.current = false
    }
  }, [config, state.isInitialized])

  const learn = useCallback((pattern: {
    input: string
    output: string
    context?: Record<string, unknown>
  }): void => {
    aiIntegration.learn(pattern)
  }, [])

  const detectLanguage = useCallback((text: string): 'zh' | 'en' => {
    return aiIntegration.detectLanguage(text)
  }, [])

  return {
    isReady: state.isInitialized,
    isLoading: state.isLoading,
    error: state.error,
    state,
    chat,
    generate,
    analyze,
    processCommand,
    translate,
    summarize,
    searchWeb,
    initialize,
    learn,
    detectLanguage,
  }
}

export interface UseChatOptions {
  systemPrompt?: string
  maxHistory?: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export interface UseChatReturn {
  messages: ChatMessage[]
  isGenerating: boolean
  error: string | null
  
  sendMessage: (content: string) => Promise<void>
  clearHistory: () => void
  regenerate: () => Promise<void>
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { systemPrompt, maxHistory = 50 } = options
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const ai = useAI()

  useEffect(() => {
    if (systemPrompt) {
      setMessages([{
        role: 'system',
        content: systemPrompt,
        timestamp: new Date(),
      }])
    }
  }, [systemPrompt])

  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (isGenerating) return

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage].slice(-maxHistory))
    setIsGenerating(true)
    setError(null)

    try {
      const context = {
        history: messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content,
        })),
      }

      const response = await ai.chat(content, context)

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage].slice(-maxHistory))

      ai.learn({
        input: content,
        output: response.text,
        context: { source: 'chat' },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }, [ai, isGenerating, maxHistory, messages])

  const clearHistory = useCallback(() => {
    setMessages(systemPrompt ? [{
      role: 'system',
      content: systemPrompt,
      timestamp: new Date(),
    }] : [])
  }, [systemPrompt])

  const regenerate = useCallback(async (): Promise<void> => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUserMessage) return

    setMessages(prev => prev.slice(0, -1))
    await sendMessage(lastUserMessage.content)
  }, [messages, sendMessage])

  return {
    messages,
    isGenerating,
    error,
    sendMessage,
    clearHistory,
    regenerate,
  }
}

export default useAI

/**
 * 本地模型服务集成
 * 连接训练好的模型到前端应用
 */

import { useState, useCallback, useRef, useEffect } from 'react'

interface ModelConfig {
  serverUrl: string
  timeout: number
  maxRetries: number
}

interface GenerateOptions {
  maxNewTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  repetitionPenalty?: number
}

interface GenerateResult {
  text: string
  prompt: string
  tokensGenerated: number
  timeTaken: number
  tokensPerSecond: number
}

interface Text2SQLResult {
  sql: string
  question: string
  confidence: number
}

interface ModelStatus {
  loaded: boolean
  modelPath: string
  device: string
  vocabSize: number
  parameters: number
}

const DEFAULT_CONFIG: ModelConfig = {
  serverUrl: 'http://localhost:8001',
  timeout: 60000,
  maxRetries: 3,
}

export class LocalModelService {
  private config: ModelConfig

  constructor(config: Partial<ModelConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
      })
      const data = await response.json()
      return data.status === 'healthy' && data.model_loaded
    } catch {
      return false
    }
  }

  async getStatus(): Promise<ModelStatus | null> {
    try {
      const response = await fetch(`${this.config.serverUrl}/status`)
      const data = await response.json()
      return data
    } catch {
      return null
    }
  }

  async generate(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<GenerateResult> {
    const response = await fetch(`${this.config.serverUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        max_new_tokens: options.maxNewTokens ?? 100,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 0.9,
        top_k: options.topK ?? 50,
        repetition_penalty: options.repetitionPenalty ?? 1.1,
      }),
    })

    if (!response.ok) {
      throw new Error(`生成失败: ${response.statusText}`)
    }

    return response.json()
  }

  async text2sql(
    question: string,
    schema?: string,
    context?: string
  ): Promise<Text2SQLResult> {
    const response = await fetch(`${this.config.serverUrl}/text2sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        schema: schema ?? '',
        context: context ?? '',
      }),
    })

    if (!response.ok) {
      throw new Error(`Text2SQL失败: ${response.statusText}`)
    }

    return response.json()
  }

  async *generateStream(
    prompt: string,
    options: GenerateOptions = {}
  ): AsyncGenerator<string> {
    const response = await fetch(`${this.config.serverUrl}/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        max_new_tokens: options.maxNewTokens ?? 100,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 0.9,
        top_k: options.topK ?? 50,
        repetition_penalty: options.repetitionPenalty ?? 1.1,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`流式生成失败: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          if (data.token) {
            yield data.token
          }
        }
      }
    }
  }
}

export const localModelService = new LocalModelService()

export function useLocalModel() {
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ModelStatus | null>(null)

  const serviceRef = useRef<LocalModelService>(localModelService)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = useCallback(async () => {
    try {
      const health = await serviceRef.current.checkHealth()
      setIsReady(health)

      if (health) {
        const statusData = await serviceRef.current.getStatus()
        setStatus(statusData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '检查状态失败')
    }
  }, [])

  const generate = useCallback(
    async (prompt: string, options: GenerateOptions = {}): Promise<string> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await serviceRef.current.generate(prompt, options)
        return result.text
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '生成失败'
        setError(errorMsg)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const text2sql = useCallback(
    async (
      question: string,
      schema?: string,
      context?: string
    ): Promise<Text2SQLResult> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await serviceRef.current.text2sql(question, schema, context)
        return result
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Text2SQL失败'
        setError(errorMsg)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const generateStream = useCallback(
    async function* (
      prompt: string,
      options: GenerateOptions = {}
    ): AsyncGenerator<string> {
      setIsLoading(true)
      setError(null)

      try {
        for await (const token of serviceRef.current.generateStream(prompt, options)) {
          yield token
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '流式生成失败'
        setError(errorMsg)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return {
    isReady,
    isLoading,
    error,
    status,
    generate,
    text2sql,
    generateStream,
    checkStatus,
  }
}

export function useText2SQL() {
  const { text2sql, isLoading, error, isReady } = useLocalModel()
  const [result, setResult] = useState<Text2SQLResult | null>(null)

  const convert = useCallback(
    async (question: string, schema?: string, context?: string) => {
      if (!isReady) {
        throw new Error('模型服务未就绪')
      }

      const sqlResult = await text2sql(question, schema, context)
      setResult(sqlResult)
      return sqlResult
    },
    [text2sql, isReady]
  )

  return {
    convert,
    result,
    isLoading,
    error,
    isReady,
  }
}

export default LocalModelService

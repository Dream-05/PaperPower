/**
 * 增强版AI服务客户端
 * 支持流式输出、错误重试、请求取消
 */

const API_BASE_URL = 'http://localhost:8000/api';

export interface GenerateRequest {
  prompt: string;
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface ChatRequest {
  message: string;
  history?: Array<{ user: string; assistant: string }>;
}

export interface AIResponse {
  success: boolean;
  output?: string;
  response?: string;
  content?: string;
  analysis?: string;
  document?: string;
  error?: string;
}

export interface StreamOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

class EnhancedAIClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;
  private retryCount: number = 3;
  private retryDelay: number = 1000;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    retries: number = this.retryCount
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (retries > 0 && error instanceof Error && error.name !== 'AbortError') {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.fetchWithRetry<T>(url, options, retries - 1);
      }
      throw error;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  async generate(request: GenerateRequest): Promise<AIResponse> {
    this.abortController = new AbortController();
    
    return this.fetchWithRetry<AIResponse>(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async chat(request: ChatRequest): Promise<AIResponse> {
    this.abortController = new AbortController();
    
    return this.fetchWithRetry<AIResponse>(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async generateStream(
    request: GenerateRequest,
    options: StreamOptions = {}
  ): Promise<void> {
    const { onToken, onComplete, onError } = options;
    
    try {
      const response = await fetch(`${this.baseUrl}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.token && onToken) {
                  fullText += parsed.token;
                  onToken(parsed.token);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      if (onComplete) {
        onComplete(fullText);
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }

  async generatePPT(topic: string, slides?: number): Promise<AIResponse> {
    return this.fetchWithRetry<AIResponse>(`${this.baseUrl}/ppt/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, slides }),
    });
  }

  async analyzeExcel(description: string): Promise<AIResponse> {
    return this.fetchWithRetry<AIResponse>(`${this.baseUrl}/excel/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
  }

  async generateWord(type: string, content: string): Promise<AIResponse> {
    return this.fetchWithRetry<AIResponse>(`${this.baseUrl}/word/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    });
  }
}

export const aiClient = new EnhancedAIClient();

export function useEnhancedAI() {
  const generate = async (prompt: string, options?: Partial<GenerateRequest>) => {
    return aiClient.generate({ prompt, ...options });
  };

  const chat = async (message: string, history?: ChatRequest['history']) => {
    return aiClient.chat({ message, history });
  };

  const generateStream = async (
    prompt: string,
    callbacks: StreamOptions,
    options?: Partial<GenerateRequest>
  ) => {
    return aiClient.generateStream({ prompt, ...options }, callbacks);
  };

  const generatePPT = async (topic: string, slides?: number) => {
    return aiClient.generatePPT(topic, slides);
  };

  const analyzeExcel = async (description: string) => {
    return aiClient.analyzeExcel(description);
  };

  const generateWord = async (type: string, content: string) => {
    return aiClient.generateWord(type, content);
  };

  const cancel = () => {
    aiClient.cancel();
  };

  return {
    generate,
    chat,
    generateStream,
    generatePPT,
    analyzeExcel,
    generateWord,
    cancel,
    healthCheck: () => aiClient.healthCheck(),
  };
}

/**
 * AI服务客户端
 * 与后端AI模型交互
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

export interface PPTRequest {
  topic: string;
  slides?: number;
}

export interface ExcelRequest {
  description: string;
}

export interface WordRequest {
  type: string;
  content: string;
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

class AIServiceClient {
  private baseUrl: string;
  private timeout: number = 30000;
  private maxRetries: number = 2;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs?: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || this.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit, retries?: number): Promise<Response> {
    const maxRetries = retries ?? this.maxRetries;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options);
        if (response.ok) return response;
        if (response.status >= 500 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastError || new Error('Request failed after retries');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl.replace('/api', '')}/health`, {}, 5000);
      const data = await response.json();
      return data.status === 'ok' || data.status === 'healthy';
    } catch {
      return false;
    }
  }

  async generate(request: GenerateRequest): Promise<AIResponse> {
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async chat(request: ChatRequest): Promise<AIResponse> {
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async generatePPT(request: PPTRequest): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/ppt/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async analyzeExcel(request: ExcelRequest): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/excel/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async generateWord(request: WordRequest): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/word/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

export const aiClient = new AIServiceClient();

export function useAI() {
  const generate = async (prompt: string, options?: Partial<GenerateRequest>) => {
    return aiClient.generate({ prompt, ...options });
  };

  const chat = async (message: string, history?: ChatRequest['history']) => {
    return aiClient.chat({ message, history });
  };

  const generatePPT = async (topic: string, slides?: number) => {
    return aiClient.generatePPT({ topic, slides });
  };

  const analyzeExcel = async (description: string) => {
    return aiClient.analyzeExcel({ description });
  };

  const generateWord = async (type: string, content: string) => {
    return aiClient.generateWord({ type, content });
  };

  return {
    generate,
    chat,
    generatePPT,
    analyzeExcel,
    generateWord,
    healthCheck: () => aiClient.healthCheck(),
  };
}

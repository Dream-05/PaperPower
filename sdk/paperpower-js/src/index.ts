export type Language = 'zh' | 'en' | 'auto';

export interface ChatResponse {
  id: string;
  language: string;
  content: string;
  created: number;
  thought_process?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  messages: Message[];
  language?: Language;
  tools?: Tool[];
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ClientOptions {
  baseUrl?: string;
  apiKey?: string;
  language?: Language;
  timeout?: number;
}

export class PaperPowerClient {
  private baseUrl: string;
  private apiKey?: string;
  private language: Language;
  private timeout: number;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://localhost:8000').replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.language = options.language || 'auto';
    this.timeout = options.timeout || 30000;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const language = options.language || this.language;

    const payload = {
      messages: options.messages,
      language,
      tools: options.tools,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature || 0.7,
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      language: data.language,
      content: data.content,
      created: data.created,
      thought_process: data.thought_process,
      tool_calls: data.tool_calls,
    };
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<string> {
    const language = options.language || this.language;

    const payload = {
      messages: options.messages,
      language,
      tools: options.tools,
      stream: true,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature || 0.7,
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            const parsed = JSON.parse(data);
            yield parsed.content || '';
          } catch {
            continue;
          }
        }
      }
    }
  }

  async chatWithImage(
    message: string,
    image: string,
    options: Omit<ChatOptions, 'messages'> = {}
  ): Promise<ChatResponse> {
    return this.chat({
      ...options,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: message },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
    });
  }

  async detectLanguage(text: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/detect-language`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.language;
  }

  async listTools(language?: Language): Promise<Tool[]> {
    const lang = language || this.language;
    const headers = { ...this.getHeaders(), 'Accept-Language': lang };

    const response = await fetch(`${this.baseUrl}/v1/tools`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.tools;
  }
}

export function createClient(options: ClientOptions = {}): PaperPowerClient {
  return new PaperPowerClient(options);
}

export default PaperPowerClient;

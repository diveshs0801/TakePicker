import { LLMClient, LLMMessage, ToolDef, LLMResponse, LLMToolCall } from './llm-client.interface';
import { Logger } from '@nestjs/common';

export interface OpenAICompatibleConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  debug?: boolean;
}

/**
 * Universal OpenAI-compatible LLM client.
 * Connects natively to DeepSeek, Groq, Google Gemini (OpenAI compat), Together AI,
 * Mistral, OpenRouter, Ollama, and OpenAI with zero external client library dependencies.
 */
export class OpenAICompatibleLLMClient implements LLMClient {
  private readonly logger = new Logger(OpenAICompatibleLLMClient.name);
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;
  private readonly debug: boolean;

  constructor(config: OpenAICompatibleConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs || 60000;
    this.headers = config.headers || {};
    this.debug = config.debug ?? false;
  }

  getEndpointUrl(): string {
    let cleanUrl = this.baseUrl.trim().replace(/\/+$/, '');
    if (cleanUrl.endsWith('/chat/completions')) {
      return cleanUrl;
    }
    return `${cleanUrl}/chat/completions`;
  }

  async chat(args: {
    messages: LLMMessage[];
    tools?: ToolDef[];
    temperature?: number;
    max_tokens?: number;
    model?: string;
  }): Promise<LLMResponse> {
    const endpoint = this.getEndpointUrl();
    const activeModel = args.model || this.model;

    // 1. Format messages into OpenAI Chat Completions payload
    const formattedMessages = args.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.tool_call_id,
          name: m.name,
          content: m.content || '',
        };
      }

      if (m.role === 'assistant') {
        const payload: Record<string, any> = {
          role: 'assistant',
          content: m.content ?? null,
        };
        if (m.tool_calls && m.tool_calls.length > 0) {
          payload.tool_calls = m.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }));
        }
        return payload;
      }

      return {
        role: m.role,
        content: m.content || '',
      };
    });

    // 2. Format tool definitions if provided
    let formattedTools: any[] | undefined = undefined;
    if (args.tools && args.tools.length > 0) {
      formattedTools = args.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters || { type: 'object', properties: {} },
        },
      }));
    }

    const requestBody: Record<string, any> = {
      model: activeModel,
      messages: formattedMessages,
      temperature: args.temperature ?? 0,
    };

    if (args.max_tokens) {
      requestBody.max_tokens = args.max_tokens;
    }

    if (formattedTools && formattedTools.length > 0) {
      requestBody.tools = formattedTools;
      requestBody.tool_choice = 'auto';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (this.debug) {
      this.logger.debug(
        `POST ${endpoint} model=${activeModel} msgs=${formattedMessages.length} tools=${formattedTools?.length ?? 0}`
      );
    }

    // 3. Make HTTP request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(
          `LLM request to ${endpoint} timed out after ${this.timeoutMs}ms.`
        );
      }
      throw new Error(`LLM network error connecting to ${endpoint}: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    // 4. Handle HTTP response errors
    if (!res.ok) {
      let errorBody = '';
      try {
        errorBody = await res.text();
      } catch {
        errorBody = res.statusText;
      }

      let errorMsg = `LLM API Error (${res.status} ${res.statusText}) from ${endpoint}: ${errorBody}`;
      if (res.status === 401) {
        errorMsg += `\nHint: Invalid API key. Please check your DEEPSEEK_API_KEY or configured provider credentials.`;
      } else if (res.status === 402) {
        errorMsg += `\nHint: Insufficient balance or credits with this provider.`;
      } else if (res.status === 429) {
        errorMsg += `\nHint: Rate limit reached with this provider. Please retry in a moment.`;
      }

      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // 5. Parse JSON response
    const json: any = await res.json();
    const choice = json.choices?.[0];
    if (!choice || !choice.message) {
      throw new Error(
        `Unexpected LLM response structure (missing choices[0].message): ${JSON.stringify(json)}`
      );
    }

    const msg = choice.message;
    const toolCalls: LLMToolCall[] | undefined = msg.tool_calls?.map(
      (tc: any, idx: number) => ({
        id: tc.id || `call_${Date.now()}_${idx}`,
        type: 'function' as const,
        function: {
          name: tc.function?.name || '',
          arguments:
            typeof tc.function?.arguments === 'string'
              ? tc.function.arguments
              : JSON.stringify(tc.function?.arguments || {}),
        },
      })
    );

    return {
      message: {
        role: 'assistant',
        content: msg.content ?? null,
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      usage: json.usage
        ? {
            prompt_tokens: json.usage.prompt_tokens ?? 0,
            completion_tokens: json.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: LLMToolCall[];
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface LLMResponse {
  message: {
    role: 'assistant';
    content?: string | null;
    tool_calls?: LLMToolCall[];
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface LLMClient {
  chat(args: {
    messages: LLMMessage[];
    tools?: ToolDef[];
    temperature?: number;
    max_tokens?: number;
  }): Promise<LLMResponse>;
}

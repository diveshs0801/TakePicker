import { LLMClient } from './llm-client.interface';
import { DeterministicMockLLMClient } from './llm-client.mock';
import { OpenAICompatibleLLMClient } from './llm-client.openai';

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  envApiKeyName: string;
  description: string;
  freeTier: boolean;
  docUrl: string;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    envApiKeyName: 'DEEPSEEK_API_KEY',
    description: 'Ultra-low cost ($0.27/1M input) with state-of-the-art tool calling and reasoning.',
    freeTier: false, // grants $5 initial trial on signup
    docUrl: 'https://platform.deepseek.com',
  },
  groq: {
    id: 'groq',
    name: 'Groq Llama 3.3',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    envApiKeyName: 'GROQ_API_KEY',
    description: 'Blazing fast inference (~500 tokens/sec) running open Llama 3.3 70B.',
    freeTier: true,
    docUrl: 'https://console.groq.com',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-2.0-flash',
    envApiKeyName: 'GEMINI_API_KEY',
    description: 'Google AI Studio with high rate limits and strong JSON/tool execution.',
    freeTier: true,
    docUrl: 'https://aistudio.google.com',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    envApiKeyName: 'OPENROUTER_API_KEY',
    description: 'Universal gateway routing to 100+ open-source models with free options.',
    freeTier: true,
    docUrl: 'https://openrouter.ai',
  },
  together: {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    envApiKeyName: 'TOGETHER_API_KEY',
    description: 'High-throughput cloud hosting for leading open weights models.',
    freeTier: false,
    docUrl: 'https://api.together.ai',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    envApiKeyName: 'MISTRAL_API_KEY',
    description: 'Frontier European models with precise structured outputs.',
    freeTier: false,
    docUrl: 'https://console.mistral.ai',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    envApiKeyName: 'OLLAMA_API_KEY',
    description: 'Runs directly on your computer. 100% private with no API fees.',
    freeTier: true,
    docUrl: 'https://ollama.com',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    envApiKeyName: 'OPENAI_API_KEY',
    description: 'OpenAI GPT-4o and GPT-4o-mini models.',
    freeTier: false,
    docUrl: 'https://platform.openai.com',
  },
};

export interface ResolvedClientInfo {
  client: LLMClient;
  provider: string;
  model: string;
  baseUrl: string;
  isReal: boolean;
  description: string;
}

export function createLLMClientFromEnv(overrides?: {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}): ResolvedClientInfo {
  const env = process.env;

  // 1. Identify requested provider (from parameter or LLM_PROVIDER env var)
  let providerId = (overrides?.provider || env.LLM_PROVIDER || '').toLowerCase().trim();

  // 2. If provider is not explicitly set, auto-detect from active API keys
  if (!providerId) {
    if (overrides?.apiKey || env.DEEPSEEK_API_KEY) {
      providerId = 'deepseek';
    } else if (env.GROQ_API_KEY) {
      providerId = 'groq';
    } else if (env.GEMINI_API_KEY) {
      providerId = 'gemini';
    } else if (env.OPENROUTER_API_KEY) {
      providerId = 'openrouter';
    } else if (env.OPENAI_API_KEY) {
      providerId = 'openai';
    } else if (env.TOGETHER_API_KEY) {
      providerId = 'together';
    } else if (env.MISTRAL_API_KEY) {
      providerId = 'mistral';
    } else if (env.LLM_API_KEY) {
      providerId = 'deepseek';
    } else if (env.OLLAMA_BASE_URL || env.OLLAMA_MODEL) {
      providerId = 'ollama';
    }
  }

  const preset = PROVIDER_PRESETS[providerId];

  // 3. Resolve API Key
  let apiKey: string | undefined = overrides?.apiKey || env.LLM_API_KEY;
  if (!apiKey && preset) {
    apiKey = env[preset.envApiKeyName];
  }
  // Check specific provider env var conventions
  if (!apiKey) {
    if (providerId === 'deepseek') apiKey = env.DEEPSEEK_API_KEY;
    else if (providerId === 'groq') apiKey = env.GROQ_API_KEY;
    else if (providerId === 'gemini') apiKey = env.GEMINI_API_KEY;
    else if (providerId === 'openrouter') apiKey = env.OPENROUTER_API_KEY;
    else if (providerId === 'openai') apiKey = env.OPENAI_API_KEY;
    else if (providerId === 'together') apiKey = env.TOGETHER_API_KEY;
    else if (providerId === 'mistral') apiKey = env.MISTRAL_API_KEY;
  }

  // 4. Resolve Base URL
  let baseUrl =
    overrides?.baseUrl ||
    env.LLM_BASE_URL ||
    (providerId === 'deepseek' ? env.DEEPSEEK_BASE_URL : undefined) ||
    preset?.baseUrl ||
    'https://api.deepseek.com';

  // 5. Resolve Model
  let model =
    overrides?.model ||
    env.LLM_MODEL ||
    (providerId === 'deepseek' ? env.DEEPSEEK_MODEL : undefined) ||
    (providerId === 'groq' ? env.GROQ_MODEL : undefined) ||
    (providerId === 'gemini' ? env.GEMINI_MODEL : undefined) ||
    preset?.defaultModel ||
    'deepseek-chat';

  // 6. If we have an API key or provider is ollama, instantiate real OpenAICompatible client
  if (apiKey || providerId === 'ollama') {
    const extraHeaders: Record<string, string> = {};
    if (providerId === 'openrouter') {
      extraHeaders['HTTP-Referer'] = 'https://takepicker.app';
      extraHeaders['X-Title'] = 'TakePicker AI Editor';
    }

    const client = new OpenAICompatibleLLMClient({
      apiKey,
      baseUrl,
      model,
      headers: extraHeaders,
    });

    return {
      client,
      provider: preset?.name || providerId || 'OpenAI-Compatible',
      model,
      baseUrl,
      isReal: true,
      description: preset?.description || 'Custom OpenAI-compatible provider',
    };
  }

  // 7. Otherwise, fallback safely to deterministic mock client
  return {
    client: new DeterministicMockLLMClient(),
    provider: 'Deterministic Mock (Offline)',
    model: 'takepicker-mock-v1',
    baseUrl: 'local://mock',
    isReal: false,
    description: 'Deterministic rule-based agent for offline tests and evals.',
  };
}

export function listAvailableProviders(): Array<
  ProviderPreset & { isConfigured: boolean; activeModel: string }
> {
  const env = process.env;

  return Object.values(PROVIDER_PRESETS).map((p) => {
    let isConfigured = false;
    if (p.id === 'ollama') {
      isConfigured = true;
    } else {
      isConfigured = Boolean(env[p.envApiKeyName] || env.LLM_API_KEY);
    }

    let activeModel = p.defaultModel;
    if (p.id === 'deepseek' && env.DEEPSEEK_MODEL) activeModel = env.DEEPSEEK_MODEL;
    if (p.id === 'groq' && env.GROQ_MODEL) activeModel = env.GROQ_MODEL;
    if (p.id === 'gemini' && env.GEMINI_MODEL) activeModel = env.GEMINI_MODEL;
    if (env.LLM_MODEL && (env.LLM_PROVIDER === p.id || !env.LLM_PROVIDER)) {
      activeModel = env.LLM_MODEL;
    }

    return {
      ...p,
      isConfigured,
      activeModel,
    };
  });
}

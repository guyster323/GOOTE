// LLM Factory - Creates appropriate provider based on config

import type { LLMConfig } from '../types/index.js';
import type { LLMProvider } from './base.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { MockProvider } from './mock.js';

export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'mock':
      return new MockProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

export { AnthropicProvider } from './anthropic.js';
export { OpenAIProvider } from './openai.js';
export { OllamaProvider } from './ollama.js';
export { MockProvider } from './mock.js';
export type { LLMProvider } from './base.js';

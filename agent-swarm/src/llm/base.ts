// LLM Provider Interface and Implementations

import type { LLMConfig, Message } from '../types/index.js';

export interface LLMProvider {
  chat(messages: Message[]): Promise<string>;
  stream?(messages: Message[]): AsyncGenerator<string>;
}

export abstract class BaseLLMProvider implements LLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract chat(messages: Message[]): Promise<string>;
}

// Ollama Provider for Local Models

import { Ollama } from 'ollama';
import { BaseLLMProvider } from './base.js';
import type { LLMConfig, Message } from '../types/index.js';

export class OllamaProvider extends BaseLLMProvider {
  private client: Ollama;

  constructor(config: LLMConfig) {
    super(config);
    this.client = new Ollama({
      host: config.baseUrl || 'http://localhost:11434',
    });
  }

  async chat(messages: Message[]): Promise<string> {
    const response = await this.client.chat({
      model: this.config.model || 'llama3.2',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    return response.message.content;
  }

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const stream = await this.client.chat({
      model: this.config.model || 'llama3.2',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk.message.content;
    }
  }
}

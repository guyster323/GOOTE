// OpenAI Provider

import OpenAI from 'openai';
import { BaseLLMProvider } from './base.js';
import type { LLMConfig, Message } from '../types/index.js';

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;

  constructor(config: LLMConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: Message[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model || 'gpt-4-turbo',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        name: m.name,
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  }

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model || 'gpt-4-turbo',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        name: m.name,
      })),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}

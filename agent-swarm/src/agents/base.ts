// Base Agent Class

import EventEmitter from 'eventemitter3';
import type { AgentConfig, AgentResponse, Message, TaskContext, Tool, ToolCall, ToolResult } from '../types/index.js';
import { createLLMProvider, type LLMProvider } from '../llm/index.js';

export abstract class BaseAgent extends EventEmitter {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  protected llm: LLMProvider;
  protected systemPrompt: string;
  protected tools: Tool[];
  protected conversationHistory: Message[] = [];

  constructor(config: AgentConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.llm = createLLMProvider(config.llm);
    this.systemPrompt = config.systemPrompt;
    this.tools = config.tools || [];
  }

  async process(context: TaskContext): Promise<AgentResponse> {
    this.emit('agent_start', { agentId: this.id, context });

    const messages = this.buildMessages(context);
    const response = await this.llm.chat(messages);

    // Parse response for tool calls
    const toolCalls = this.parseToolCalls(response);

    // Execute any tool calls
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const tool = this.tools.find(t => t.name === toolCall.toolName);
        if (tool) {
          toolCall.result = await this.executeTool(tool, toolCall.parameters);
          this.emit('tool_call', { agentId: this.id, toolCall });
        }
      }
    }

    // Check for handoff directive
    const handoff = this.parseHandoff(response);

    const agentResponse: AgentResponse = {
      agentId: this.id,
      content: response,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      nextAgent: handoff,
      status: handoff ? 'handoff' : this.isComplete(response) ? 'complete' : 'continue',
    };

    this.emit('agent_response', agentResponse);
    return agentResponse;
  }

  protected buildMessages(context: TaskContext): Message[] {
    const messages: Message[] = [
      { role: 'system', content: this.buildSystemPrompt(context) },
      ...context.messages,
    ];
    return messages;
  }

  protected buildSystemPrompt(context: TaskContext): string {
    let prompt = this.systemPrompt;

    // Add file context if available
    if (context.files.length > 0) {
      prompt += '\n\n## Available Files:\n';
      for (const file of context.files) {
        prompt += `\n### ${file.path}\n\`\`\`${file.language || ''}\n${file.content}\n\`\`\`\n`;
      }
    }

    // Add tool descriptions
    if (this.tools.length > 0) {
      prompt += '\n\n## Available Tools:\n';
      for (const tool of this.tools) {
        prompt += `\n- **${tool.name}**: ${tool.description}\n`;
      }
    }

    return prompt;
  }

  protected parseToolCalls(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const toolPattern = /<tool_call>\s*{\s*"name":\s*"([^"]+)",\s*"parameters":\s*({[^}]+})\s*}\s*<\/tool_call>/g;

    let match;
    while ((match = toolPattern.exec(response)) !== null) {
      try {
        toolCalls.push({
          toolName: match[1],
          parameters: JSON.parse(match[2]),
        });
      } catch {
        // Invalid JSON, skip
      }
    }

    return toolCalls;
  }

  protected parseHandoff(response: string): string | undefined {
    const handoffPattern = /<handoff agent="([^"]+)"\/>/;
    const match = handoffPattern.exec(response);
    return match?.[1];
  }

  protected isComplete(response: string): boolean {
    return response.includes('<task_complete/>') || response.includes('TASK_COMPLETE');
  }

  protected async executeTool(tool: Tool, parameters: Record<string, unknown>): Promise<ToolResult> {
    try {
      return await tool.execute(parameters);
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  reset(): void {
    this.conversationHistory = [];
  }
}

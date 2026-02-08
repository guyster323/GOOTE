// Core Types for Agent Swarm

export type LLMProvider = 'anthropic' | 'openai' | 'ollama' | 'mock' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
  timestamp?: Date;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  llm: LLMConfig;
  systemPrompt: string;
  tools?: Tool[];
}

export type AgentRole =
  | 'planner'      // 태스크 분석 및 계획
  | 'coder'        // 코드 작성
  | 'reviewer'     // 코드 리뷰
  | 'tester'       // 테스트 작성/실행
  | 'debugger'     // 버그 분석 및 수정
  | 'researcher'   // 정보 수집
  | 'custom';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface TaskContext {
  taskId: string;
  description: string;
  files: FileContext[];
  messages: Message[];
  metadata: Record<string, unknown>;
}

export interface FileContext {
  path: string;
  content: string;
  language?: string;
}

export interface AgentResponse {
  agentId: string;
  content: string;
  toolCalls?: ToolCall[];
  nextAgent?: string;
  status: 'continue' | 'complete' | 'handoff' | 'error';
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, unknown>;
  result?: ToolResult;
}

export interface SwarmConfig {
  agents: AgentConfig[];
  defaultLLM: LLMConfig;
  maxIterations?: number;
  debug?: boolean;
}

export interface SwarmEvent {
  type: 'agent_start' | 'agent_response' | 'tool_call' | 'handoff' | 'complete' | 'error';
  agentId?: string;
  data: unknown;
  timestamp: Date;
}

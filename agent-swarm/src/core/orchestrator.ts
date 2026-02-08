// Swarm Orchestrator - Coordinates agents and manages task execution

import EventEmitter from 'eventemitter3';
import type {
  SwarmConfig,
  SwarmEvent,
  TaskContext,
  AgentResponse,
  Message,
  AgentConfig,
  LLMConfig
} from '../types/index.js';
import { BaseAgent } from '../agents/base.js';
import { PlannerAgent } from '../agents/planner.js';
import { CoderAgent } from '../agents/coder.js';
import { ReviewerAgent } from '../agents/reviewer.js';
import { TesterAgent } from '../agents/tester.js';
import { DebuggerAgent } from '../agents/debugger.js';

export class SwarmOrchestrator extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private config: SwarmConfig;
  private currentContext: TaskContext | null = null;

  constructor(config: SwarmConfig) {
    super();
    this.config = config;
    this.initializeAgents();
  }

  private initializeAgents(): void {
    // Initialize agents from config or create default set
    if (this.config.agents.length === 0) {
      this.createDefaultAgents();
    } else {
      for (const agentConfig of this.config.agents) {
        this.addAgentFromConfig(agentConfig);
      }
    }
  }

  private createDefaultAgents(): void {
    const llm = this.config.defaultLLM;

    this.addAgent(new PlannerAgent(llm));
    this.addAgent(new CoderAgent(llm));
    this.addAgent(new ReviewerAgent(llm));
    this.addAgent(new TesterAgent(llm));
    this.addAgent(new DebuggerAgent(llm));
  }

  private addAgentFromConfig(config: AgentConfig): void {
    let agent: BaseAgent;

    switch (config.role) {
      case 'planner':
        agent = new PlannerAgent(config.llm, config.id);
        break;
      case 'coder':
        agent = new CoderAgent(config.llm, config.tools, config.id);
        break;
      case 'reviewer':
        agent = new ReviewerAgent(config.llm, config.id);
        break;
      case 'tester':
        agent = new TesterAgent(config.llm, config.tools, config.id);
        break;
      case 'debugger':
        agent = new DebuggerAgent(config.llm, config.tools, config.id);
        break;
      default:
        throw new Error(`Unknown agent role: ${config.role}`);
    }

    this.addAgent(agent);
  }

  addAgent(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);

    // Forward agent events
    agent.on('agent_start', (data) => this.emitEvent('agent_start', agent.id, data));
    agent.on('agent_response', (data) => this.emitEvent('agent_response', agent.id, data));
    agent.on('tool_call', (data) => this.emitEvent('tool_call', agent.id, data));
  }

  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  private emitEvent(type: SwarmEvent['type'], agentId: string, data: unknown): void {
    const event: SwarmEvent = {
      type,
      agentId,
      data,
      timestamp: new Date(),
    };
    this.emit(type, event);

    if (this.config.debug) {
      console.log(`[${type}] Agent: ${agentId}`, data);
    }
  }

  async run(task: string, options?: { startAgent?: string; files?: Array<{ path: string; content: string }> }): Promise<AgentResponse[]> {
    const context: TaskContext = {
      taskId: crypto.randomUUID(),
      description: task,
      files: options?.files || [],
      messages: [{ role: 'user', content: task }],
      metadata: {},
    };

    this.currentContext = context;
    const responses: AgentResponse[] = [];

    let currentAgentId = options?.startAgent || 'planner-1';
    let iterations = 0;
    const maxIterations = this.config.maxIterations || 10;

    while (iterations < maxIterations) {
      const agent = this.agents.get(currentAgentId);
      if (!agent) {
        this.emitEvent('error', currentAgentId, { error: `Agent not found: ${currentAgentId}` });
        break;
      }

      const response = await agent.process(context);
      responses.push(response);

      // Add response to context for next agent
      context.messages.push({
        role: 'assistant',
        content: response.content,
        name: agent.name,
        timestamp: new Date(),
      });

      if (response.status === 'complete') {
        this.emitEvent('complete', currentAgentId, { responses });
        break;
      }

      if (response.status === 'handoff' && response.nextAgent) {
        this.emitEvent('handoff', currentAgentId, { nextAgent: response.nextAgent });
        currentAgentId = this.resolveAgentId(response.nextAgent);
      } else if (response.status === 'error') {
        this.emitEvent('error', currentAgentId, { response });
        break;
      }

      iterations++;
    }

    if (iterations >= maxIterations) {
      this.emitEvent('error', currentAgentId, { error: 'Max iterations reached' });
    }

    return responses;
  }

  private resolveAgentId(agentName: string): string {
    // Map agent role names to actual agent IDs
    const roleToId: Record<string, string> = {
      planner: 'planner-1',
      coder: 'coder-1',
      reviewer: 'reviewer-1',
      tester: 'tester-1',
      debugger: 'debugger-1',
    };

    return roleToId[agentName] || agentName;
  }

  async chat(message: string): Promise<AgentResponse> {
    if (!this.currentContext) {
      // Start new conversation
      const responses = await this.run(message);
      return responses[responses.length - 1];
    }

    // Continue existing conversation
    this.currentContext.messages.push({ role: 'user', content: message });

    const lastResponse = this.currentContext.messages
      .filter(m => m.role === 'assistant')
      .pop();

    const currentAgentId = lastResponse?.name
      ? this.resolveAgentId(lastResponse.name.toLowerCase())
      : 'planner-1';

    const agent = this.agents.get(currentAgentId);
    if (!agent) {
      throw new Error(`Agent not found: ${currentAgentId}`);
    }

    const response = await agent.process(this.currentContext);
    this.currentContext.messages.push({
      role: 'assistant',
      content: response.content,
      name: agent.name,
      timestamp: new Date(),
    });

    return response;
  }

  reset(): void {
    this.currentContext = null;
    for (const agent of this.agents.values()) {
      agent.reset();
    }
  }
}

// Factory function for easy creation
export function createSwarm(llmConfig: LLMConfig, options?: Partial<SwarmConfig>): SwarmOrchestrator {
  const config: SwarmConfig = {
    agents: [],
    defaultLLM: llmConfig,
    maxIterations: options?.maxIterations || 10,
    debug: options?.debug || false,
    ...options,
  };

  return new SwarmOrchestrator(config);
}

// Unit Tests for Agent Swarm

import { describe, it, expect, jest } from '@jest/globals';
import {
  createSwarm,
  PlannerAgent,
  CoderAgent,
  ReviewerAgent,
  createLLMProvider,
} from '../index';
import type { LLMConfig, SwarmConfig, Message } from '../types';

describe('Agent Swarm', () => {
  const mockLLMConfig: LLMConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: 'test-key',
  };

  describe('LLM Provider Factory', () => {
    it('should create Anthropic provider', () => {
      const provider = createLLMProvider({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'test-key',
      });
      expect(provider).toBeDefined();
      expect(provider.chat).toBeDefined();
    });

    it('should create OpenAI provider', () => {
      const provider = createLLMProvider({
        provider: 'openai',
        model: 'gpt-4-turbo',
        apiKey: 'test-key',
      });
      expect(provider).toBeDefined();
    });

    it('should create Ollama provider', () => {
      const provider = createLLMProvider({
        provider: 'ollama',
        model: 'llama3.2',
      });
      expect(provider).toBeDefined();
    });

    it('should throw for unknown provider', () => {
      expect(() => createLLMProvider({
        provider: 'unknown' as any,
        model: 'test',
      })).toThrow('Unknown LLM provider');
    });
  });

  describe('Agent Creation', () => {
    it('should create PlannerAgent', () => {
      const agent = new PlannerAgent(mockLLMConfig);
      expect(agent.id).toBe('planner-1');
      expect(agent.name).toBe('Planner');
      expect(agent.role).toBe('planner');
    });

    it('should create CoderAgent', () => {
      const agent = new CoderAgent(mockLLMConfig);
      expect(agent.id).toBe('coder-1');
      expect(agent.name).toBe('Coder');
      expect(agent.role).toBe('coder');
    });

    it('should create ReviewerAgent', () => {
      const agent = new ReviewerAgent(mockLLMConfig);
      expect(agent.id).toBe('reviewer-1');
      expect(agent.name).toBe('Reviewer');
      expect(agent.role).toBe('reviewer');
    });

    it('should create agent with custom id', () => {
      const agent = new PlannerAgent(mockLLMConfig, 'custom-planner');
      expect(agent.id).toBe('custom-planner');
    });
  });

  describe('Swarm Orchestrator', () => {
    it('should create swarm with default agents', () => {
      const swarm = createSwarm(mockLLMConfig);
      expect(swarm).toBeDefined();
      expect(swarm.getAgent('planner-1')).toBeDefined();
      expect(swarm.getAgent('coder-1')).toBeDefined();
      expect(swarm.getAgent('reviewer-1')).toBeDefined();
      expect(swarm.getAgent('tester-1')).toBeDefined();
      expect(swarm.getAgent('debugger-1')).toBeDefined();
    });

    it('should create swarm with custom config', () => {
      const swarm = createSwarm(mockLLMConfig, {
        maxIterations: 20,
        debug: true,
      });
      expect(swarm).toBeDefined();
    });

    it('should emit events', () => {
      const swarm = createSwarm(mockLLMConfig);
      const events: string[] = [];

      swarm.on('agent_start', () => events.push('agent_start'));
      swarm.on('complete', () => events.push('complete'));

      // Events are emitted when run() is called (requires actual LLM)
      expect(swarm.listenerCount('agent_start')).toBe(1);
      expect(swarm.listenerCount('complete')).toBe(1);
    });

    it('should reset conversation', () => {
      const swarm = createSwarm(mockLLMConfig);
      swarm.reset();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Tool Parsing', () => {
    it('should parse handoff directive', () => {
      const agent = new PlannerAgent(mockLLMConfig);
      // Access protected method via any
      const parseHandoff = (agent as any).parseHandoff.bind(agent);

      const result = parseHandoff('<handoff agent="coder"/>');
      expect(result).toBe('coder');
    });

    it('should detect task complete', () => {
      const agent = new PlannerAgent(mockLLMConfig);
      const isComplete = (agent as any).isComplete.bind(agent);

      expect(isComplete('<task_complete/>')).toBe(true);
      expect(isComplete('TASK_COMPLETE')).toBe(true);
      expect(isComplete('still working...')).toBe(false);
    });

    it('should parse tool calls', () => {
      const agent = new CoderAgent(mockLLMConfig);
      const parseToolCalls = (agent as any).parseToolCalls.bind(agent);

      const response = `
        Let me read the file:
        <tool_call>{"name": "read_file", "parameters": {"path": "/test.ts"}}</tool_call>
      `;

      const toolCalls = parseToolCalls(response);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].toolName).toBe('read_file');
      expect(toolCalls[0].parameters.path).toBe('/test.ts');
    });
  });
});

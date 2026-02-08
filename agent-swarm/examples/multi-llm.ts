// Example: Multi-LLM Configuration

import { createSwarm, PlannerAgent, CoderAgent, ReviewerAgent } from '../src/index.js';
import type { LLMConfig, SwarmConfig } from '../src/types/index.js';

async function main() {
  // Different LLM configs for different agents
  const claudeConfig: LLMConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,
  };

  const gptConfig: LLMConfig = {
    provider: 'openai',
    model: 'gpt-4-turbo',
    temperature: 0.2,
  };

  const localConfig: LLMConfig = {
    provider: 'ollama',
    model: 'codellama:13b',
    baseUrl: 'http://localhost:11434',
  };

  // Create swarm with custom configuration
  const config: SwarmConfig = {
    agents: [
      {
        id: 'planner-1',
        name: 'Strategic Planner',
        role: 'planner',
        llm: claudeConfig, // Claude for planning (best reasoning)
        systemPrompt: 'You are an expert planning agent...',
      },
      {
        id: 'coder-1',
        name: 'Code Writer',
        role: 'coder',
        llm: localConfig, // Local model for coding (fast, private)
        systemPrompt: 'You are an expert coding agent...',
      },
      {
        id: 'reviewer-1',
        name: 'Code Reviewer',
        role: 'reviewer',
        llm: gptConfig, // GPT-4 for review (different perspective)
        systemPrompt: 'You are an expert code review agent...',
      },
    ],
    defaultLLM: claudeConfig,
    maxIterations: 20,
    debug: true,
  };

  const swarm = createSwarm(claudeConfig, config);

  // Example: Complex refactoring task
  const task = `
    Refactor the following legacy JavaScript code to modern TypeScript:

    function processData(data) {
      var result = [];
      for (var i = 0; i < data.length; i++) {
        if (data[i].active == true) {
          result.push({
            id: data[i].id,
            name: data[i].name.toUpperCase(),
            timestamp: new Date().getTime()
          });
        }
      }
      return result;
    }

    Requirements:
    - Add proper TypeScript types
    - Use modern ES6+ syntax
    - Add error handling
    - Make it more functional
  `;

  const responses = await swarm.run(task);

  console.log('\n📊 Final Output:');
  const lastResponse = responses[responses.length - 1];
  console.log(lastResponse.content);
}

main().catch(console.error);

// Example: Basic Usage of Agent Swarm

import { createSwarm } from '../src/index.js';
import type { LLMConfig } from '../src/types/index.js';

async function main() {
  // Configure LLM (Anthropic Claude)
  const llmConfig: LLMConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    // apiKey: process.env.ANTHROPIC_API_KEY (uses env by default)
  };

  // Create swarm with default agents
  const swarm = createSwarm(llmConfig, {
    debug: true,
    maxIterations: 15,
  });

  // Subscribe to events
  swarm.on('agent_start', (event) => {
    console.log(`\n🚀 Agent Started: ${event.agentId}`);
  });

  swarm.on('handoff', (event) => {
    console.log(`\n🔄 Handoff to: ${(event.data as { nextAgent: string }).nextAgent}`);
  });

  swarm.on('complete', () => {
    console.log('\n✅ Task Complete!');
  });

  swarm.on('error', (event) => {
    console.error('\n❌ Error:', event.data);
  });

  // Run a coding task
  const task = `
    Create a TypeScript function that:
    1. Takes an array of numbers
    2. Returns the sum of all even numbers
    3. Handles edge cases (empty array, no even numbers)
    4. Include proper types and JSDoc comments
  `;

  console.log('📝 Starting task:', task);

  const responses = await swarm.run(task);

  console.log('\n📊 Results:');
  for (const response of responses) {
    console.log(`\n--- ${response.agentId} ---`);
    console.log(response.content.substring(0, 500) + '...');
  }
}

main().catch(console.error);

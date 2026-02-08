// Example: Using Ollama (Local LLM - No API Key Required)

import { createSwarm } from '../src/index.js';
import type { LLMConfig } from '../src/types/index.js';

async function main() {
  // Ollama configuration - runs locally, no API key needed
  const ollamaConfig: LLMConfig = {
    provider: 'ollama',
    model: 'codellama:7b',  // or 'llama3.2', 'deepseek-coder:6.7b', 'qwen2.5-coder:7b'
    baseUrl: 'http://localhost:11434',  // default Ollama address
  };

  // Create swarm with Ollama
  const swarm = createSwarm(ollamaConfig, {
    debug: true,
    maxIterations: 10,
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

  // Run a simple coding task
  const task = `
    Create a TypeScript function called "reverseString" that:
    1. Takes a string as input
    2. Returns the reversed string
    3. Add proper types
  `;

  console.log('📝 Starting task with Ollama...');
  console.log('Using model:', ollamaConfig.model);

  try {
    const responses = await swarm.run(task);

    console.log('\n📊 Results:');
    for (const response of responses) {
      console.log(`\n--- ${response.agentId} ---`);
      console.log(response.content);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('\n❌ Ollama is not running!');
      console.log('\n📋 To start Ollama:');
      console.log('   1. Install: https://ollama.ai');
      console.log('   2. Run: ollama serve');
      console.log('   3. Pull model: ollama pull codellama:7b');
    } else {
      throw error;
    }
  }
}

main().catch(console.error);

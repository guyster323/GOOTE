// Example: Interactive Chat Mode

import * as readline from 'readline';
import { createSwarm } from '../src/index.js';
import type { LLMConfig } from '../src/types/index.js';

async function main() {
  const llmConfig: LLMConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  };

  const swarm = createSwarm(llmConfig, { debug: false });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('🤖 Agent Swarm Interactive Mode');
  console.log('Commands: /reset - Reset conversation, /exit - Exit');
  console.log('');

  const prompt = (): void => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (trimmed === '/exit') {
        console.log('Goodbye!');
        rl.close();
        return;
      }

      if (trimmed === '/reset') {
        swarm.reset();
        console.log('🔄 Conversation reset.\n');
        prompt();
        return;
      }

      if (!trimmed) {
        prompt();
        return;
      }

      try {
        const response = await swarm.chat(trimmed);
        console.log(`\n🤖 [${response.agentId}]:`);
        console.log(response.content);
        console.log('');
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);

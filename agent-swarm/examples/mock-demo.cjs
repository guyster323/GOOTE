// Example: Mock LLM - No API Key Required, Works Offline

const { createSwarm } = require('../dist/index.js');

async function main() {
  // Mock LLM configuration - no external dependencies
  const mockConfig = {
    provider: 'mock',
    model: 'mock-v1',
  };

  // Create swarm with Mock LLM
  const swarm = createSwarm(mockConfig, {
    debug: true,
    maxIterations: 10,
  });

  // Subscribe to events
  swarm.on('agent_start', (event) => {
    console.log(`\n🚀 Agent Started: ${event.agentId}`);
  });

  swarm.on('agent_response', (event) => {
    const data = event.data;
    console.log(`   Status: ${data.status}`);
  });

  swarm.on('handoff', (event) => {
    const data = event.data;
    console.log(`\n🔄 Handoff: → ${data.nextAgent}`);
  });

  swarm.on('complete', () => {
    console.log('\n✅ Task Complete!');
  });

  // Test different tasks
  console.log('='.repeat(60));
  console.log('🧪 Agent Swarm Demo with Mock LLM');
  console.log('='.repeat(60));

  const task = `
    Create a TypeScript function that reverses a string.
    Add proper types and documentation.
  `;

  console.log('\n📝 Task:', task.trim());
  console.log('-'.repeat(60));

  const responses = await swarm.run(task);

  console.log('\n' + '='.repeat(60));
  console.log('📊 Agent Responses:');
  console.log('='.repeat(60));

  for (const response of responses) {
    console.log(`\n[${'─'.repeat(20)} ${response.agentId} ${'─'.repeat(20)}]`);
    console.log(response.content);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total agents involved: ${responses.length}`);
  console.log('='.repeat(60));
}

main().catch(console.error);

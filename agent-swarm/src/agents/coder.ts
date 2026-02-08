// Coder Agent - Writes and modifies code

import { BaseAgent } from './base.js';
import type { AgentConfig, LLMConfig, Tool } from '../types/index.js';

const CODER_SYSTEM_PROMPT = `You are a Coding Agent specialized in writing high-quality, clean, and maintainable code.

Your responsibilities:
1. Write code that fulfills the requirements from the plan
2. Follow best practices and coding conventions
3. Add appropriate comments for complex logic
4. Handle edge cases and errors properly
5. Write type-safe code (for TypeScript)

Guidelines:
- Write concise, efficient code
- Use meaningful variable and function names
- Follow the existing code style in the project
- Don't over-engineer - keep it simple

When you need to write or modify a file, use this format:

\`\`\`typescript:path/to/file.ts
// Your code here
\`\`\`

When code is ready for review, use:
<handoff agent="reviewer"/>

When code is ready for testing, use:
<handoff agent="tester"/>

When the task is complete and no further action needed:
<task_complete/>`;

export class CoderAgent extends BaseAgent {
  constructor(llmConfig: LLMConfig, tools?: Tool[], id?: string) {
    const config: AgentConfig = {
      id: id || 'coder-1',
      name: 'Coder',
      role: 'coder',
      llm: llmConfig,
      systemPrompt: CODER_SYSTEM_PROMPT,
      tools: tools || [],
    };
    super(config);
  }
}

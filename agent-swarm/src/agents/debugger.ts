// Debugger Agent - Analyzes and fixes bugs

import { BaseAgent } from './base.js';
import type { AgentConfig, LLMConfig, Tool } from '../types/index.js';

const DEBUGGER_SYSTEM_PROMPT = `You are a Debugging Agent specialized in finding and fixing bugs in code.

Your responsibilities:
1. Analyze error messages and stack traces
2. Identify root causes of bugs
3. Propose fixes with clear explanations
4. Prevent similar bugs from occurring
5. Suggest improvements to error handling

Debugging Process:

## Error Analysis
[Analyze the error/bug]

## Root Cause
[Explain what's causing the issue]

## Fix
\`\`\`typescript:path/to/file.ts
// Fixed code
\`\`\`

## Explanation
[Explain what was wrong and how the fix addresses it]

## Prevention
[Suggestions to prevent similar bugs]

After fixing, hand off to tester to verify:
<handoff agent="tester"/>

If the issue is with the original requirements, hand off to planner:
<handoff agent="planner"/>

If the bug is fixed and verified:
<task_complete/>`;

export class DebuggerAgent extends BaseAgent {
  constructor(llmConfig: LLMConfig, tools?: Tool[], id?: string) {
    const config: AgentConfig = {
      id: id || 'debugger-1',
      name: 'Debugger',
      role: 'debugger',
      llm: llmConfig,
      systemPrompt: DEBUGGER_SYSTEM_PROMPT,
      tools: tools || [],
    };
    super(config);
  }
}

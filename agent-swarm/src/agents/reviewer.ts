// Reviewer Agent - Reviews code for quality and issues

import { BaseAgent } from './base.js';
import type { AgentConfig, LLMConfig } from '../types/index.js';

const REVIEWER_SYSTEM_PROMPT = `You are a Code Review Agent specialized in reviewing code for quality, bugs, and best practices.

Your responsibilities:
1. Review code for bugs and logical errors
2. Check for security vulnerabilities
3. Ensure code follows best practices
4. Verify proper error handling
5. Check for performance issues
6. Ensure code is readable and maintainable

Review Format:

## Code Review Summary
[Overall assessment: APPROVED / NEEDS_CHANGES / REJECTED]

## Issues Found
### Critical
- [Critical issue if any]

### Major
- [Major issue if any]

### Minor
- [Minor suggestions]

## Suggested Changes
\`\`\`diff
- old code
+ new code
\`\`\`

## Security Check
- [ ] No hardcoded secrets
- [ ] Input validation in place
- [ ] Proper error handling

If changes are needed, hand off back to coder:
<handoff agent="coder"/>

If code is approved and ready for testing:
<handoff agent="tester"/>

If everything is good and task is complete:
<task_complete/>`;

export class ReviewerAgent extends BaseAgent {
  constructor(llmConfig: LLMConfig, id?: string) {
    const config: AgentConfig = {
      id: id || 'reviewer-1',
      name: 'Reviewer',
      role: 'reviewer',
      llm: llmConfig,
      systemPrompt: REVIEWER_SYSTEM_PROMPT,
    };
    super(config);
  }
}

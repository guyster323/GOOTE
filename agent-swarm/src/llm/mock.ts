// Mock LLM Provider - No external API required

import { BaseLLMProvider } from './base.js';
import type { LLMConfig, Message } from '../types/index.js';

interface MockResponse {
  pattern: RegExp;
  response: string;
}

const MOCK_RESPONSES: Record<string, MockResponse[]> = {
  planner: [
    {
      pattern: /function|함수/i,
      response: `## Task Analysis
사용자가 함수 구현을 요청했습니다.

## Execution Plan
1. 요구사항 분석 → Agent: planner ✓
2. 코드 작성 → Agent: coder
3. 코드 리뷰 → Agent: reviewer
4. 테스트 작성 → Agent: tester

## Files Involved
- src/index.ts: 새 함수 추가

<handoff agent="coder"/>`,
    },
    {
      pattern: /refactor|리팩토링/i,
      response: `## Task Analysis
코드 리팩토링 요청입니다.

## Execution Plan
1. 현재 코드 분석 → Agent: planner ✓
2. 리팩토링 수행 → Agent: coder
3. 리뷰 및 검증 → Agent: reviewer

<handoff agent="coder"/>`,
    },
    {
      pattern: /.*/,
      response: `## Task Analysis
요청을 분석했습니다.

## Execution Plan
1. 계획 수립 완료
2. 구현 진행 → Agent: coder

<handoff agent="coder"/>`,
    },
  ],
  coder: [
    {
      pattern: /reverse|뒤집/i,
      response: `요청하신 함수를 구현했습니다.

\`\`\`typescript:src/utils.ts
/**
 * Reverses a string
 * @param str - Input string to reverse
 * @returns Reversed string
 */
export function reverseString(str: string): string {
  return str.split('').reverse().join('');
}
\`\`\`

코드 작성이 완료되었습니다.
<handoff agent="reviewer"/>`,
    },
    {
      pattern: /sum|합계|더하/i,
      response: `요청하신 함수를 구현했습니다.

\`\`\`typescript:src/utils.ts
/**
 * Calculates sum of even numbers in array
 * @param numbers - Array of numbers
 * @returns Sum of even numbers
 */
export function sumEvenNumbers(numbers: number[]): number {
  if (!numbers || numbers.length === 0) return 0;
  return numbers
    .filter(n => n % 2 === 0)
    .reduce((sum, n) => sum + n, 0);
}
\`\`\`

<handoff agent="reviewer"/>`,
    },
    {
      pattern: /.*/,
      response: `코드를 구현했습니다.

\`\`\`typescript:src/index.ts
// Implementation based on requirements
export function execute(): void {
  console.log('Task executed successfully');
}
\`\`\`

<handoff agent="reviewer"/>`,
    },
  ],
  reviewer: [
    {
      pattern: /.*/,
      response: `## Code Review Summary
**APPROVED** ✓

## Review Results
- 코드 품질: 양호
- 타입 안전성: 확인됨
- 에러 처리: 적절함

## Security Check
- [x] 하드코딩된 시크릿 없음
- [x] 입력 검증 확인
- [x] 에러 처리 확인

코드 리뷰 완료. 테스트로 진행합니다.
<handoff agent="tester"/>`,
    },
  ],
  tester: [
    {
      pattern: /.*/,
      response: `## Test Plan
구현된 함수에 대한 테스트 작성

## Test Code
\`\`\`typescript:src/__tests__/utils.test.ts
import { describe, it, expect } from '@jest/globals';

describe('Utils', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });

  it('should handle edge cases', () => {
    expect([]).toHaveLength(0);
  });
});
\`\`\`

## Test Results
- Total: 2 tests
- Passed: 2
- Failed: 0

모든 테스트 통과!
<task_complete/>`,
    },
  ],
  debugger: [
    {
      pattern: /.*/,
      response: `## Error Analysis
문제를 분석했습니다.

## Root Cause
입력 검증 누락

## Fix
\`\`\`typescript
if (!input) throw new Error('Input required');
\`\`\`

## Prevention
- 입력 검증 추가
- 타입 가드 사용

<handoff agent="tester"/>`,
    },
  ],
};

export class MockProvider extends BaseLLMProvider {
  private agentRole: string = 'planner';
  private responseDelay: number;

  constructor(config: LLMConfig) {
    super(config);
    // Extract delay from config (default 100ms for realistic feel)
    this.responseDelay = (config as any).delay ?? 100;
  }

  setAgentRole(role: string): void {
    this.agentRole = role;
  }

  async chat(messages: Message[]): Promise<string> {
    // Simulate network delay
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }

    // Get the last user message
    const userMessage = [...messages].reverse().find(m => m.role === 'user');
    const content = userMessage?.content || '';

    // Detect agent role from system prompt
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      if (systemMessage.content.includes('Planning Agent')) this.agentRole = 'planner';
      else if (systemMessage.content.includes('Coding Agent')) this.agentRole = 'coder';
      else if (systemMessage.content.includes('Code Review Agent')) this.agentRole = 'reviewer';
      else if (systemMessage.content.includes('Testing Agent')) this.agentRole = 'tester';
      else if (systemMessage.content.includes('Debugging Agent')) this.agentRole = 'debugger';
    }

    // Find matching response
    const responses = MOCK_RESPONSES[this.agentRole] || MOCK_RESPONSES.planner;

    for (const { pattern, response } of responses) {
      if (pattern.test(content)) {
        return response;
      }
    }

    return responses[responses.length - 1].response;
  }

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const response = await this.chat(messages);

    // Simulate streaming by yielding chunks
    const chunkSize = 20;
    for (let i = 0; i < response.length; i += chunkSize) {
      yield response.slice(i, i + chunkSize);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

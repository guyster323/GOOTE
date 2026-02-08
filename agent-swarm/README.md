# Agent Swarm

멀티 LLM을 지원하는 TypeScript 기반 코딩 어시스턴트 Agent Swarm 시스템입니다.

## 구조

```
agent-swarm/
├── src/
│   ├── agents/        # 에이전트 구현
│   │   ├── base.ts       # 기본 에이전트 클래스
│   │   ├── planner.ts    # 계획 에이전트
│   │   ├── coder.ts      # 코딩 에이전트
│   │   ├── reviewer.ts   # 리뷰 에이전트
│   │   ├── tester.ts     # 테스트 에이전트
│   │   └── debugger.ts   # 디버깅 에이전트
│   ├── core/          # 핵심 오케스트레이션
│   │   └── orchestrator.ts
│   ├── llm/           # LLM 프로바이더
│   │   ├── anthropic.ts  # Claude
│   │   ├── openai.ts     # GPT
│   │   └── ollama.ts     # 로컬 모델
│   ├── tools/         # 에이전트 도구
│   └── types/         # TypeScript 타입
├── examples/          # 사용 예제
└── package.json
```

## 설치

```bash
cd agent-swarm
npm install
```

## 환경 변수

```bash
# .env
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
```

## 사용법

### 기본 사용

```typescript
import { createSwarm } from 'agent-swarm';

const swarm = createSwarm({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
});

const responses = await swarm.run('Create a function that...');
```

### 멀티 LLM

```typescript
const swarm = createSwarm(defaultConfig, {
  agents: [
    { id: 'planner-1', role: 'planner', llm: claudeConfig },
    { id: 'coder-1', role: 'coder', llm: ollamaConfig },
    { id: 'reviewer-1', role: 'reviewer', llm: gptConfig },
  ],
});
```

## 에이전트 역할

| 에이전트 | 역할 |
|---------|------|
| Planner | 태스크 분석 및 실행 계획 수립 |
| Coder | 코드 작성 및 수정 |
| Reviewer | 코드 리뷰 및 품질 검증 |
| Tester | 테스트 작성 및 실행 |
| Debugger | 버그 분석 및 수정 |

## 이벤트

```typescript
swarm.on('agent_start', (event) => { /* ... */ });
swarm.on('handoff', (event) => { /* ... */ });
swarm.on('tool_call', (event) => { /* ... */ });
swarm.on('complete', (event) => { /* ... */ });
swarm.on('error', (event) => { /* ... */ });
```

## 예제 실행

```bash
npx ts-node examples/basic-usage.ts
npx ts-node examples/interactive-chat.ts
```

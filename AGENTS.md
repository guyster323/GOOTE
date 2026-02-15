# Repository Guidelines

## Project Structure & Module Organization
- Frontend app code is in `src/` (Next.js App Router).
- Route segments live in `src/app/` (for example `src/app/(dashboard)/...`, `src/app/apps/[id]`).
- Shared UI and providers are in `src/components/` (`ui/`, `layout/`, `providers/`).
- Client utilities and state are in `src/lib/`, `src/hooks/`, and `src/store/`.
- End-to-end tests are in `tests/*.spec.ts` (Playwright).
- Firebase Cloud Functions are a separate package under `functions/` with source in `functions/src/` and build output in `functions/lib/`.
- Static assets are in `public/`; Firebase config/rules are at repo root (`firebase.json`, `firestore.rules`, `storage.rules`).

## Build, Test, and Development Commands
- `npm run dev`: start Next.js dev server at `http://localhost:3000`.
- `npm run build`: production build for the web app.
- `npm run start`: run built app.
- `npm run lint`: run root ESLint config (`eslint.config.mjs`).
- `npx playwright test`: run E2E tests in `tests/`.
- `cd functions && npm run build`: compile Functions TypeScript.
- `cd functions && npm run serve`: run Functions emulator.
- `cd functions && npm run deploy`: deploy only Functions.

## AIOS-Style Delivery Workflow (Codex)
- Plan by story, not by file: define scope, acceptance criteria, and risks before editing.
- Execute with role separation:
  - Builder: implement smallest safe change set.
  - Reviewer: check regressions, auth/security, and edge cases.
  - QA: verify with lint/tests and manual route checks.
- Enforce quality gates before merge: `npm run lint`, relevant Playwright specs, and clear rollback notes for risky changes.
- Keep PRs traceable: each PR should map to one story or one bugfix objective.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict: true` in `tsconfig.json`).
- Use the `@/*` import alias for `src/*` paths.
- Follow existing naming patterns: components/files in kebab-case (e.g., `app-sidebar.tsx`), hooks prefixed with `use` (e.g., `use-auth.ts`), store modules in camelCase/PascalCase where established.
- Keep route-specific logic near the route segment; move shared logic into `src/lib/` or `src/components/`.

## Testing Guidelines
- Framework: Playwright (`@playwright/test`).
- Name specs as `*.spec.ts` and place under `tests/`.
- Cover critical user flows (auth, navigation, dashboard actions) and add regression tests for bug fixes.
- Run `npx playwright test` locally before opening a PR.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`.
- Keep commits focused; avoid mixing frontend and Functions refactors unless required.
- PRs should include: concise summary, linked issue/task, test evidence (`npm run lint`, `npx playwright test`), and screenshots for UI changes.

## Security & Configuration Tips
- Do not commit secrets. Keep local values in `.env.local` and `functions/.env`.
- Review rule changes (`firestore.rules`, `storage.rules`) with extra care and include rationale in PRs.
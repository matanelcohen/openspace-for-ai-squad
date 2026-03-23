# Project Context

- **Owner:** Matanel Cohen
- **Project:** openspace.ai — A human-AI squad management tool that allows humans to interact with AI squads, manage tasks, rank priorities, and have voice conversations with AI agents to make human-AI collaboration better.
- **Stack:** TBD
- **Created:** 2026-03-23

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2026-03-23 — PRD published at `docs/prd.md`.** Read this before starting any feature work. It defines v1 scope: web-only, single-squad, 6 core features (Dashboard, Task Board, Activity Feed, Voice, Chat, Real-time Monitoring). See open decisions in §8 of PRD.
- **2026-03-24 — P0-7 Linting & formatting setup complete.** ESLint flat config (`eslint.config.mjs`) at root with TypeScript, React/React-hooks (scoped to apps/web), and import sorting. Prettier configured with `.prettierrc`. Husky + lint-staged for pre-commit hooks. Vitest per-package configs with v8 coverage. Root scripts: `lint`, `format`, `format:check`. All 3 packages pass lint and format:check. All 36 existing tests pass. ESLint 9.x used for React plugin compatibility — upgrade to 10.x when plugins add support.
- **2026-03-24  Phase 0 foundation is complete.** The monorepo baseline, frontend shell, backend scaffold, shared contracts, CI pipeline, and lint/format/test tooling are now aligned. Future validation should treat the shared workspace checks as the default gate for every new phase.
- **2026-03-24 — P1-9 API integration tests complete.** 83 integration tests across 5 suites (agents, tasks, decisions, squad overview, error handling) covering all REST endpoints. Test fixtures at `apps/api/src/__tests__/fixtures/squad/` mirror real `.squad/` structure with 4 agents, 5 tasks (all statuses), 3 decisions. Key patterns: `buildTestApp(squadDir)` for fixture-pointed Fastify instances, temp directory copies for write tests, `injectJSON()` helper for concise assertions. The reorder endpoint is per-task (`PATCH /api/tasks/:id/priority`), decision search is at `/api/decisions/search?q=`. Edge cases covered: concurrent writes, large descriptions (50KB), unicode, special characters, empty directories, malformed JSON. All 296 project tests pass.

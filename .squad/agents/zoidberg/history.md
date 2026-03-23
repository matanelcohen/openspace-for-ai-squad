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

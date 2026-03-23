# Project Context

- **Owner:** Matanel Cohen
- **Project:** openspace.ai — A human-AI squad management tool that allows humans to interact with AI squads, manage tasks, rank priorities, and have voice conversations with AI agents to make human-AI collaboration better.
- **Stack:** TBD
- **Created:** 2026-03-23

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2026-03-23 — PRD published at `docs/prd.md`.** Read this before starting any feature work. It defines v1 scope: web-only, single-squad, 6 core features (Dashboard, Task Board, Activity Feed, Voice, Chat, Real-time Monitoring). Frontend is Next.js + React. See open decisions in §8 of PRD.
- **2026-03-23 — P0-2 Frontend scaffolding complete.** Next.js 14 App Router with Tailwind CSS (dark/light via CSS vars + `class` strategy), shadcn/ui (New York style, Button + Card components), TanStack Query provider, Inter font, sidebar layout with nav to 5 routes: `/` (Dashboard), `/tasks`, `/chat`, `/decisions`, `/voice`. Vitest + React Testing Library configured with 13 passing tests. `next.config.ts` renamed to `.mjs` — Next.js 14.2 doesn't support TS config files. Explicit `types` field added to tsconfig to avoid root-level `@eslint/js` type pollution.
- **2026-03-23  Phase 0 foundation is complete.** The repo now has the monorepo baseline, Next.js frontend shell, shared `@openspace/shared` contracts, CI workflow, and repo-wide quality tooling. Frontend Phase 1 work can now focus on real data flows and `.squad/`-backed product screens instead of scaffolding.

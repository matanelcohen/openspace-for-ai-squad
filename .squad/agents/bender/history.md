# Project Context

- **Owner:** Matanel Cohen
- **Project:** openspace.ai — A human-AI squad management tool that allows humans to interact with AI squads, manage tasks, rank priorities, and have voice conversations with AI agents to make human-AI collaboration better.
- **Stack:** TBD
- **Created:** 2026-03-23

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2026-03-23 — PRD published at `docs/prd.md`.** Read this before starting any feature work. It defines v1 scope: web-only, single-squad, 6 core features (Dashboard, Task Board, Activity Feed, Voice, Chat, Real-time Monitoring). Backend is Node.js with file system integration to `.squad/`. See open decisions in §8 of PRD.
- **2026-03-23 — P0-1 Monorepo initialized.** Turborepo + pnpm workspaces. Structure: `apps/web` (Next.js 14+), `apps/api` (Fastify 5, ESM), `packages/shared`. Root tsconfig uses strict mode + bundler resolution. Turbo pipeline: build depends on ^build, dev is persistent/uncached. API uses `@fastify/cors` + `dotenv`. Shared package uses source-level imports (no build step). `pnpm install` NOT run yet — scaffolding only. All workspace refs use `workspace:*` protocol.

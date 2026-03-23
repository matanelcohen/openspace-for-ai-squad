# Squad Decisions

## Active Decisions

### 2026-03-23T20:42:00Z: PRD created for openspace.ai
**By:** Leela (Lead)
**What:** Created `docs/prd.md`, the v1 Product Requirements Document for openspace.ai.
**Why:** The team needed a shared source of truth for scope, architecture, and prioritization.
**Impact:** All agents should read `docs/prd.md` before starting feature work.

### 2026-03-23T20:50:00Z: Monorepo structure selected
**By:** Bender (Backend Dev)
**What:** Initialized the workspace as a Turborepo + pnpm monorepo with `apps/web`, `apps/api`, and `packages/shared`.
**Why:** Phase 0 needed a concrete foundation after D1/D2 were resolved.
**Impact:** P0-2 through P0-7 are unblocked.

### 2026-03-24T10:00:00Z: Fastify chosen for backend
**By:** Leela (Lead)
**What:** Selected Fastify as the backend framework for the API server.
**Why:** WebSocket support, performance, and TypeScript-native DX make it the best fit.
**Impact:** `apps/api` uses Fastify with `@fastify/cors` and `@fastify/websocket`.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here

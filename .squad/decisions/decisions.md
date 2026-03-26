# Decisions — openspace.ai

Master log of team decisions, scope calls, and design choices.

---

## Decision: PRD Created for openspace.ai

- **Author:** Leela (Lead)
- **Date:** 2026-03-23
- **Status:** Active

### What

The Product Requirements Document (PRD) for openspace.ai has been created at `docs/prd.md`. It defines the full v1 scope, architecture, target users, success metrics, and open decisions.

### Why

The team needs a single source of truth for what we're building, what's in scope, and what's deferred. Without a PRD, agents risk building in different directions.

### Key Scope Calls

- **v1 is web-only.** No mobile app. Responsive design is nice-to-have.
- **v1 is single-squad.** Multi-squad management is v2+.
- **`.squad/` is the source of truth.** The UI is a layer on top, not a replacement.
- **Voice is core, not optional.** It's a v1 feature, not a future nice-to-have.
- **No multi-tenant SaaS in v1.** Single-user/small-team on a single machine.

### Impact

- All agents should read `docs/prd.md` before starting feature work.
- Open decisions in §8 need team resolution before implementation begins.
- Fry should focus on frontend stack setup (Next.js + React).
- Bender should focus on the backend API and `.squad/` file system integration.

### Location

`docs/prd.md`

---

---

# Decision: Use Fastify inject() over supertest for API tests

**Date:** 2026-03-23
**By:** Bender (Backend Dev)
**Status:** Active

## What
Used Fastify's built-in `app.inject()` for testing the health endpoint instead of adding `supertest` as a dependency.

## Why
Fastify provides a lightweight HTTP injection mechanism that doesn't require starting a real server or adding an external dependency. It's faster, has zero overhead, and is the idiomatic Fastify testing approach. The execution plan mentioned supertest, but `inject()` achieves the same result with less complexity.

## Impact
- One fewer devDependency to maintain
- Tests run faster (no TCP socket overhead)
- All future API route tests should follow this pattern: `buildApp({ logger: false })` → `app.inject()` → assertions

---

# Decision: Frontend UI stack — shadcn/ui New York + Tailwind CSS vars

**By:** Fry (Frontend Dev)
**Date:** 2026-03-23
**Task:** P0-2

## What

Chose shadcn/ui "New York" style with CSS variables for the design system foundation. Dark/light mode uses Tailwind's `class` strategy with `next-themes` for runtime switching. Base theme uses zinc palette from shadcn defaults.

## Why

- **shadcn/ui** gives us copy-paste ownership of components — no version lock-in, full customization control. New York style is cleaner and more professional for a dashboard tool.
- **CSS variables** allow runtime theme switching without Tailwind rebuilds, and map cleanly to dark mode.
- **next-themes** handles the `class` attribute on `<html>`, SSR hydration, and system preference detection — no custom code needed.

## Trade-offs

- Components live in our repo (`src/components/ui/`) which means we own maintenance. Acceptable since the team can `npx shadcn@latest add <component>` to update individual components.
- Tailwind v3 (not v4) chosen for shadcn compatibility. Will evaluate v4 migration when shadcn officially supports it.

## Impact

All future UI components should use the `cn()` utility from `@/lib/utils` and the CSS variable color tokens (e.g., `bg-primary`, `text-muted-foreground`). New shadcn components can be added with `npx shadcn@latest add <name>`.

---

# Decision: Shared types use string unions and explicit nulls

**By:** Leela (Lead)  
**Date:** 2026-03-23  
**Status:** Active  
**Task:** P0-4

## What

The `@openspace/shared` types package uses TypeScript string literal union types (e.g., `type TaskStatus = "backlog" | "in-progress" | ...`) instead of `enum`, and nullable fields use `string | null` instead of optional properties (`field?: string`).

## Why

1. **String unions over enums:** Enums compile to runtime objects that don't tree-shake well. String unions are zero-cost at runtime, produce cleaner `.d.ts` files, and work identically in both the Next.js frontend (bundler moduleResolution) and the Fastify backend (ESNext modules). The corresponding const arrays (`TASK_STATUSES`, etc.) use `as const satisfies readonly TaskStatus[]` to remain tuples while ensuring compile-time agreement with the union type.

2. **Explicit nulls over optionals:** `currentTask: string | null` forces every consumer to handle the null case. `currentTask?: string` allows the field to be absent entirely, which creates ambiguity — is it "not loaded yet" or "genuinely has no value"? For a contract package shared between two apps, explicit is safer.

## Impact

All type consumers (apps/web, apps/api, and future packages) should follow this pattern when extending shared types.

## Affected Files

- `packages/shared/src/types/*.ts`
- `packages/shared/src/constants/index.ts`
- `packages/shared/src/index.ts`

---

# Decision: ESLint 9.x + Flat Config for Monorepo Linting

**By:** Zoidberg (Tester)
**Date:** 2026-03-24
**Task:** P0-7 — Linting and formatting setup

## What
- Chose ESLint 9.x (not 10.x) with flat config (`eslint.config.mjs`) as the shared linting setup.
- Used `typescript-eslint` unified package instead of separate parser + plugin packages.
- Used `eslint-plugin-simple-import-sort` for import ordering (simpler than `eslint-plugin-import`).
- Scoped React rules to `apps/web/**` only; Node globals to `apps/api/**` only.
- Prettier runs last via `eslint-config-prettier` to avoid rule conflicts.

## Why
- ESLint 10.x has unresolved peer dependency issues with `eslint-plugin-react` and `eslint-plugin-react-hooks` (both only declare support up to ESLint 9.x). Using 9.x avoids warnings and potential breakage.
- Flat config is the forward-looking format — `.eslintrc` is deprecated.
- `simple-import-sort` has zero config and deterministic sorting vs `eslint-plugin-import` which requires resolver configuration and is slower.

## Impact
- When React ESLint plugins update their peer deps to include ESLint 10+, we should upgrade.
- All new packages added to the monorepo will automatically inherit the root ESLint config.
- Pre-commit hooks via Husky + lint-staged enforce formatting on every commit.

*Last updated: 2026-03-24*

---

# Decision: Channel Storage — Dual Persistence with `.squad/channels/*.md`

**By:** Leela (Lead)
**Date:** 2026-03-25
**Task:** P1 — Channel storage schema and CRUD API contract
**Status:** Active

## What

Channels use the same dual-persistence pattern as tasks and decisions: `.squad/channels/*.md` (YAML frontmatter + markdown body) is the source of truth, with SQLite `chat_channels` table as a cache/query layer. Channel files are named `{channel-id}.md` (e.g., `chan-Abc12345.md`). IDs are generated via `chan-{nanoid(8)}`.

## Why

Consistency with the existing `.squad/`-as-source-of-truth architecture. Channels survive DB corruption (rebuilt from files on startup), are git-diffable and version-controlled, and external tools can create channels by dropping `.md` files into `.squad/channels/`. SQLite provides fast queries and real-time filtering without parsing files on every request.

## Key Decisions

- **Per-workspace scoping:** Each `.squad/channels/` directory is independent. No cross-workspace channel sharing in v1.
- **Conflict resolution:** Files win. `fullSync()` on startup rebuilds DB from files. File watcher triggers `incrementalSync()` on changes.
- **Validation:** Name uniqueness (409), non-blank name (400), non-empty memberAgentIds when provided (400) — enforced at the API layer only.
- **Delete cascades:** Deleting a channel removes associated chat messages from SQLite.

## Impact

All channel CRUD flows through `ChatService` methods which write to both SQLite and `.squad/channels/`. The file watcher and sync pipeline handle `channels/` events. Full ADR: `.squad/decisions/adr-channel-storage.md`.

*Last updated: 2026-03-25*

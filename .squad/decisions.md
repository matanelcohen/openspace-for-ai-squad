# Squad Decisions

## Active Decisions

### 2026-03-23T20:42:00Z: PRD created for openspace.ai
**By:** Leela (Lead)
**What:** Created `docs/prd.md`, the v1 Product Requirements Document for openspace.ai. It defines the product vision, six core features, architecture, non-goals, success metrics, and seven open decisions.
**Why:** The team needed a shared source of truth for scope, architecture, and prioritization before implementation.
**Impact:** All agents should read `docs/prd.md` before starting feature work, and the open decisions in 8 require follow-up resolution.

### 2026-03-23T20:50:00Z: Execution plan created from PRD
**By:** Leela (Lead)
**What:** Created `docs/execution-plan.md`, a 6-phase execution plan with 43 actionable work items, dependencies, agent assignments, and complexity estimates.
**Why:** The PRD needed to be decomposed into executable work with a clear critical path and explicit parallelism opportunities.
**Impact:** Phase 0 can begin immediately, Phases 2 and 3 can run in parallel after the data layer, and voice remains sequenced after chat.

### 2026-03-23T20:50:30Z: Model usage directive
**By:** Matanel Cohen (via Copilot)
**What:** Squad is only allowed to use `claude-opus-4.6` and `gpt-5.4`. No other models are permitted.
**Why:** User directive captured for team memory.

### 2026-03-23T20:56:17Z: Voice chat product directive
**By:** Matanel Cohen (via Copilot)
**What:** The voice interface must be real-time voice chat like ChatGPT voice mode, not push-to-talk commands. The user talks naturally with the full squad in a group conversation, agents respond by voice, and the squad can take actions from voice conversations.
**Why:** User clarified the core product vision. Voice is the differentiator.

### 2026-03-23T20:57:00Z: D1 and D2 resolved
**By:** Matanel Cohen (via Copilot)
**What:** D1 was resolved in favor of a monorepo. D2 was resolved in favor of Fastify for the backend. Both blocking Phase 0 decisions are now closed.
**Why:** User accepted Leela's recommendations and unblocked implementation.
**Impact:** P0-1 can start immediately.

### 2026-03-23T21:00:00Z: Voice interface redesigned as real-time group voice chat
**By:** Leela (Lead)
**What:** Updated `docs/prd.md` §3.4 and §4.4 plus `docs/execution-plan.md` Phase 4 to replace push-to-talk with a real-time, multi-agent voice conversation model. Voice is now continuous, shared-context, action-capable, and WebSocket-based end to end.
**Why:** The product differentiator is a live voice standup with the full squad, not one-shot voice commands.
**Impact:** Phase 4 expanded to 9 work items, complexity increased, D3/D6 were reframed around real-time architecture, and the total project estimate increased to 28–36 sessions.

### 2026-03-23T21:00:00Z: Monorepo structure initialized
**By:** Bender (Backend Dev)
**What:** Initialized the workspace as a Turborepo + pnpm monorepo with `apps/web` (Next.js), `apps/api` (Fastify), `packages/shared`, and root TypeScript/workspace configuration.
**Why:** Phase 0 needed a concrete foundation after D1/D2 were resolved.
**Impact:** P0-2 through P0-7 are unblocked. The repo now has a standard app/package layout for parallel frontend and backend work.

### 2026-03-23T21:02:37Z: Testing required for every implementation
**By:** Matanel Cohen (via Copilot)
**What:** Every development task must ship with tests. Backend and frontend work both require test coverage, and Zoidberg is expected to pair testing with implementation work instead of treating it as follow-up.
**Why:** Prevent regressions and make testing a non-optional quality gate.

### 2026-03-23T21:04:02Z: Every agent must have a unique voice
**By:** Matanel Cohen (via Copilot)
**What:** In voice chat, each agent must have a distinct voice profile, tone, and speaking characteristics so users can identify the speaker without looking at the screen.
**Why:** Multi-agent voice UX only works if speakers are distinguishable by sound alone.
**Impact:** Voice design and implementation must include stable per-agent voice mapping.

### 2026-03-23T21:06:39Z: Self-review is mandatory
**By:** Matanel Cohen (via Copilot)
**What:** Before finishing any task, agents must critically review their own output and ask whether it is the best available solution or can be improved.
**Why:** The user wants a continuous quality mindset, not a “good enough” delivery standard.

### 2026-03-23T21:08:30Z: Deployment work deferred
**By:** Matanel Cohen (via Copilot)
**What:** Skip deployment-focused work, especially `P5-7` Docker/deployment configuration, until explicitly requested. Prioritize features that run locally.
**Why:** Local development is the current priority and deployment is not needed yet.
**Impact:** Delivery effort should stay focused on local product functionality instead of packaging/deployment concerns.

### 2026-03-23T21:09:00Z: SQLite adopted as a cache-only index layer
**By:** Bender (Backend Dev)
**What:** Adopted `better-sqlite3` at `.squad/.cache/openspace.db` as a rebuildable cache for tasks, decisions, chat messages, and activity, with FTS5-enabled search and incremental sync support.
**Why:** Querying and searching directly from markdown files would be too slow for filtering, aggregation, and full-text search.
**Impact:** `.squad/` files remain the source of truth, P1-8 is complete, watcher events can drive cache refreshes, and search endpoints can rely on fast local indexing.

### 2026-03-23T21:09:30Z: D4 resolved in favor of YAML frontmatter task files
**By:** Leela (Lead)
**What:** Resolved task storage to one markdown file per task in `.squad/tasks/`, using YAML frontmatter for metadata and a markdown body for the description, with `{id}.md` filenames.
**Why:** This format is easy to edit by hand, avoids merge-heavy monolithic files, and maps cleanly to the shared `Task` contract.
**Impact:** Task parsing and writing now have a stable on-disk contract, P1-5 is unblocked, and SQLite remains a cache rather than the primary task store.

### 2026-03-23T21:10:00Z: Phase 1 integration testing strategy established
**By:** Zoidberg (Tester)
**What:** Standardized API integration coverage around realistic `.squad/` fixtures for read tests, temporary copied workspaces for write tests, and shared helpers for app setup and JSON assertions.
**Why:** Phase 1 needed contract-level coverage across agents, tasks, decisions, and squad endpoints to prevent regressions as the data layer grew.
**Impact:** The Phase 1 API surface shipped with 83 integration tests and a reported total of 296 passing tests at milestone completion.

### 2026-03-23T21:45:00Z: WebSocket event protocol standardized
**By:** Bender (Backend Dev)
**What:** Defined a uniform real-time envelope of `{ type, payload, timestamp }`, six supported event types, subscription messages for selective delivery, JSON pong heartbeats, a bounded in-memory activity buffer, and synchronous dual-write chat persistence.
**Why:** The real-time layer needed a stable protocol that is easy for the frontend to consume and resilient under rapid file-change bursts.
**Impact:** Phase 3 backend real-time work is complete, later frontend real-time work is unblocked, and Phase 4 voice can build on the same event model.

### 2026-03-23T21:45:30Z: Webpack extension alias added for shared package resolution
**By:** Fry (Frontend Dev)
**What:** Added `resolve.extensionAlias` in `next.config.mjs` so Next.js can resolve `.js` import specifiers in `@openspace/shared` to the underlying TypeScript source files.
**Why:** The shared package uses ESM-style `.js` extensions in TypeScript imports, and the frontend build could not resolve them without explicit webpack aliasing.
**Impact:** Frontend code can import from `@openspace/shared` without build failures, and the alias remains safe even if the shared package later ships compiled JavaScript.

### 2026-03-23T21:46:33Z: Development workflow must include UI screenshots
**By:** Matanel Cohen (via Copilot)
**What:** During development, the team should periodically run the app, open the UI, and capture screenshots at visible milestones so progress can be reviewed visually.
**Why:** The user requested “show, don't tell” progress updates for UI work.
**Impact:** UI implementation should include screenshot checkpoints alongside feature progress.

### 2026-03-23T21:48:57Z: Browser automation should serve both screenshots and E2E tests
**By:** Matanel Cohen (via Copilot)
**What:** Use Playwright or Puppeteer as the shared browser automation tool for milestone screenshots now and `P5-8` E2E coverage later.
**Why:** The same automation stack can support visual progress reporting today and end-to-end testing infrastructure later.
**Impact:** Screenshot tooling and future E2E automation should converge on one browser automation implementation.

### 2026-03-25T21:22:00Z: Channel storage schema & CRUD API contract documented
**By:** Leela (Lead)
**What:** Created `docs/channel-storage-schema.md` — the authoritative design document for channel persistence. Covers the dual-write architecture (SQLite cache + `.squad/channels/*.md` source of truth), the `ChatChannel` data model, CRUD method signatures on `ChatService`, file naming conventions (`{id}.md`), validation rules, conflict handling (files win), membership security model, and the per-workspace scoping decision.
**Why:** The channel system was implemented across multiple files (chat service, channel writer/parser, routes, schemas) but lacked a single reference document capturing the design rationale and API contract.
**Impact:** New contributors and agents can read `docs/channel-storage-schema.md` for the complete channel storage design without reverse-engineering the implementation.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

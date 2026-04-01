# Project Context

- **Owner:** Matanel Cohen
- **Project:** openspace.ai — A human-AI squad management tool that allows humans to interact with AI squads, manage tasks, rank priorities, and have voice conversations with AI agents to make human-AI collaboration better.
- **Stack:** TBD
- **Created:** 2026-03-23

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2026-03-23 — PRD published at `docs/prd.md`.** Read this before starting any feature work. It defines v1 scope: web-only, single-squad, 6 core features (Dashboard, Task Board, Activity Feed, Voice, Chat, Real-time Monitoring). Backend is Node.js with file system integration to `.squad/`. See open decisions in §8 of PRD.
- **2026-03-23 — P0-1 Monorepo initialized.** Turborepo + pnpm workspaces. Structure: `apps/web` (Next.js 14+), `apps/api` (Fastify 5, ESM), `packages/shared`. Root tsconfig uses strict mode + bundler resolution. Turbo pipeline: build depends on ^build, dev is persistent/uncached. API uses `@fastify/cors` + `dotenv`. Shared package uses source-level imports (no build step). `pnpm install` NOT run yet — scaffolding only. All workspace refs use `workspace:*` protocol.
- **2026-03-23 — P0-3 Backend scaffolding complete.** Fastify app factory in `src/app.ts` accepts options (logger toggle for tests). Routes use Fastify plugin pattern — `src/routes/health.ts` is registered via `app.register()`. Graceful shutdown via SIGTERM/SIGINT in `src/index.ts`. Health endpoint tested with Vitest using Fastify's `app.inject()` (no supertest needed — Fastify's built-in injection is lighter and sufficient). 3 tests: status/timestamp correctness, content-type, and timestamp freshness.
- **2026-03-23 — P0-5 CI/CD pipeline created.** `.github/workflows/ci.yml` runs lint + typecheck + test on PRs and pushes to main. Caches both pnpm store and Turborepo `.turbo/` directory. Uses `pnpm/action-setup@v4` with corepack. `.nvmrc` was already at `20`. Concurrency group cancels stale runs.
- **2026-03-23  Phase 0 foundation is complete.** The repo now has the monorepo baseline, Fastify API scaffold, shared `@openspace/shared` contracts, CI workflow, and repo-wide quality tooling. Backend Phase 1 work can now focus on `.squad/` parsing and real domain routes instead of setup.
- **2026-03-23 — P1-1 `.squad/` file parser service built.** Four focused parsers in `apps/api/src/services/squad-parser/`: `team-parser.ts` (team.md → Agent[]), `decision-parser.ts` (decisions.md → Decision[]), `agent-parser.ts` (charter.md → AgentDetail, history.md → learnings[]), `config-parser.ts` (config.json → RawSquadConfig). All parsers follow a consistent pattern: read file → parse markdown/JSON → return typed object using @openspace/shared types. Every parser exports both a file-based function and a pure content-parsing function for testability. `SquadParser` class composes them with five methods: `getAgents()`, `getAgent(id)`, `getDecisions()`, `getConfig()`, `getSquadOverview()`. Squad directory is configurable via `SQUAD_DIR` env var (defaults to CWD/.squad). Added `AgentDetail`, `AgentIdentity`, `AgentBoundaries` types to `@openspace/shared`. 64 tests cover happy paths, missing files, malformed data, edge cases. All 109 tests pass, typecheck clean.
- **2026-03-23 — P1-2 File watcher service built.** `apps/api/src/services/file-watcher/index.ts`: `FileWatcher` class extends `EventEmitter`, uses `chokidar` to watch `.squad/` directory. Emits typed events: `agent:updated`, `task:created`, `task:updated`, `decision:added`, `config:changed`, `team:updated`, plus a generic `change` event for all. Debouncing (configurable, default 100ms) batches rapid FS changes. Polling fallback via `WATCH_MODE=poll|native` env var. Maintains an in-memory `SquadState` cache re-parsed from `SquadParser` on every change. Ignores `.cache/` and `node_modules/` subdirectories. `awaitWriteFinish` ensures partial writes don't trigger false events. 18 tests (5 unit, 13 integration with real temp dirs and chokidar polling). Dependencies added: `chokidar`.
- **2026-03-23 — P1-8 SQLite index layer built.** `apps/api/src/services/db/`: 4 modules. `schema.ts` defines tables (tasks, decisions, chat_messages, activity_events) + FTS5 virtual tables (decisions_fts, tasks_fts) with auto-sync triggers + indexes on status/assignee/priority/timestamp fields. `index.ts` opens SQLite via `better-sqlite3` at `.squad/.cache/openspace.db` (gitignored), applies WAL mode + performance pragmas. `sync.ts` provides `fullSync()` (startup: wipe+reindex from files) and `incrementalSync()` (on file change: selective re-index). `search.ts` provides `searchDecisions()`, `searchTasks()`, `searchAll()` with FTS5 full-text search, BM25 ranking, and highlighted snippets. SQLite is explicitly the CACHE — `.squad/` files are source of truth, files always win on conflict. DB path configurable via `DB_PATH` env var, supports in-memory mode for tests. 32 tests cover schema creation, full sync, incremental updates, and full-text search. Dependencies added: `better-sqlite3`, `@types/better-sqlite3`.
- **2026-03-23 — P3-1 WebSocket server built.** `apps/api/src/services/websocket/`: 4 modules. `types.ts` defines the wire protocol (`WsEnvelope: { type, payload, timestamp }`) with 6 event types: `agent:status`, `task:updated`, `task:created`, `decision:added`, `activity:new`, `chat:message`. Client can send `subscribe`/`unsubscribe`/`pong` messages. `manager.ts` is the `WebSocketManager` class: tracks connected clients with unique IDs, broadcasts to subscribers, handles subscription filtering (empty subs = all events), heartbeat ping/pong cycle (30s ping, drops unresponsive clients), graceful shutdown. `plugin.ts` is the Fastify plugin: registers `@fastify/websocket`, creates the `/ws` route, decorates `app.wsManager`. `index.ts` re-exports the public API. 25 tests cover connection lifecycle, welcome message, subscription filtering, heartbeat, shutdown, and error handling. Dependency added: `@fastify/websocket`.
- **2026-03-23 — P3-2 FileWatcher → WebSocket bridge built.** `apps/api/src/services/websocket/bridge.ts`: `FileWatcherBridge` class connects FileWatcher `change` events to WebSocket broadcasts. Maps file event types to WS event types (e.g., `agent:updated` → `agent:status`, `task:created` → `task:created`). Implements 200ms batch window to throttle rapid changes. Deduplicates same type+path events within a batch (keeps latest). Clean start/stop lifecycle. 7 tests cover event mapping, batching, deduplication, and disconnect.
- **2026-03-23 — P3-3 Activity feed backend built.** `apps/api/src/services/activity/index.ts`: `ActivityFeed` class is an in-memory ring buffer (configurable capacity, default 500 events). Stores `ActivityEvent` objects from `@openspace/shared`. Sources from FileWatcher changes via `connectFileWatcher()` — maps file events to activity event types (e.g., `task:created` → `spawned`, `decision:added` → `decision`). Extracts agent IDs from file paths. `push()` adds events and broadcasts `activity:new` via WebSocket. `getHistory(limit, offset)` returns paginated results newest-first. `GET /api/activity` route with limit/offset query params (max 200). 15 tests cover ring buffer, pagination, WebSocket emission, FileWatcher integration, and route responses.
- **2026-03-23 — P3-4 Chat backend built.** `apps/api/src/services/chat/index.ts`: `ChatService` class handles message CRUD with dual persistence to SQLite (`chat_messages` table) + markdown logs in `.squad/sessions/chat-YYYY-MM-DD.md`. `send()` creates a `ChatMessage`, writes to both stores, emits `chat:message` via WebSocket. Team messages (`recipient: "team"`) go through a coordinator echo stub that responds with a routing acknowledgment. `getMessages()` returns paginated, filterable history (by agent, threadId). `getMessage(id)` for single lookup. REST routes: `POST /api/chat/messages` (validated sender/recipient/content), `GET /api/chat/messages` (limit/offset/agent/threadId params). D7 resolved: both SQLite + markdown. 21 tests cover send, SQLite persistence, markdown dual-write, WebSocket emission, coordinator echo, pagination, filtering, and validation. All 359 tests pass, typecheck clean.
- **2026-03-23 — P3-5 through P3-8 Real-time frontend features built.** Four major frontend features implemented in `apps/web`:
  - **P3-5 — Activity Feed Frontend:** `src/hooks/use-websocket.ts` provides `useWebSocket(url)` hook with auto-reconnect (exponential backoff 1s→30s), JSON message parsing, ping/pong heartbeat. `src/components/providers/websocket-provider.tsx` wraps it in a React context with `useWsEvent(type, cb)` for per-event-type subscriptions. `src/components/activity/activity-feed.tsx` shows chronological events with agent avatars, type icons (lucide), relative timestamps, and entry animation. `src/components/activity/activity-sidebar.tsx` provides a collapsible right-side panel. 15 tests (8 hook + 7 component).
  - **P3-6 — Real-time Dashboard Updates:** `src/hooks/use-realtime-dashboard.ts` patches TanStack Query caches directly on `agent:status`, `task:updated`, `task:created`, and `decision:added` WebSocket events. Replaced 30s polling with 5-min fallback interval. Agent cards and summary stats update instantly. `data-realtime` attribute + `animate-pulse-once` CSS class for subtle pulse on data change. `WebSocketProvider` integrated into root layout. 9 tests.
  - **P3-7 — Chat Frontend:** `app/chat/page.tsx` + `app/chat/chat-client.tsx` with two-panel layout: `ChatSidebar` (team channel + agent DMs with online indicators), `MessageList` (auto-scroll, sender avatars, timestamps, empty/loading states), `MessageInput` (Enter to send, Shift+Enter newline, disabled while sending, typing indicator placeholder). `src/hooks/use-chat.ts` provides `useChatMessages(recipient)` + `useSendMessage()`. 18 tests.
  - **P3-8 — Notification System:** `src/lib/notifications.ts` defines types + localStorage helpers + `createNotificationFromEvent()` that surfaces only critical events (task failures, blocked tasks, agent failures, new decisions). `src/hooks/use-notifications.ts` manages state with max 50 notifications, persists to localStorage. `src/components/notifications/notification-bell.tsx` is a bell icon with unread badge count, Radix dropdown showing notifications with mark-as-read and clear-all. Integrated into `TopBar`. 28 tests (15 lib + 13 component).
  - Total: 253 frontend tests pass across 27 test files. Naming conventions match existing `@/` alias patterns. All components are 'use client' where needed. No new dependencies required.
- **2026-03-23 — Orchestration checkpoint recorded.** Spawn manifest outcome captured for Bender: `P3-5` through `P3-8` real-time frontend, chat UI, and notifications shipped successfully with **70 new tests** added during the delivery batch.
- **2026-03-23 — P4-1 through P4-6 voice backend pipeline built.** Six services in `apps/api/src/services/voice/`:
  - **P4-1 — VoiceSessionManager:** WebSocket-based voice session lifecycle (create → join → active → leave → end). Tracks participants, speaking state, concurrent session limits, and event emission. Config via env vars. 34 tests.
  - **P4-2 — STTService:** Streaming speech-to-text via pluggable provider (OpenAI Whisper API default). Audio chunk buffering per session, partial/final transcript events, graceful error recovery (empty audio, API timeout). 16 tests.
  - **P4-3 — VoiceRouter:** Multi-agent routing with priority: direct name mention → broadcast keywords → keyword domain matching → LLM fallback → default to Leela. Supports multiple agents responding in sequence. 25 tests.
  - **P4-4 — TTSService:** Streaming TTS with per-agent unique voices — Leela=nova, Fry=echo, Bender=onyx, Zoidberg=shimmer. Sentence-level chunking for streaming delivery. Multi-agent sequence synthesis. 17 tests.
  - **P4-5 — ConversationContextManager:** Shared conversation state across all agents. Bounded context window (last N messages). Action logging, topic tracking. Dual persistence: incremental to markdown + full session archive to `.squad/sessions/`. 28 tests.
  - **P4-6 — VoiceActionService:** Intent parsing via regex patterns + LLM fallback. Maps "create task X", "assign Y to Z", "what's the status", "prioritize A above B" to squad API operations. Returns spoken confirmation text for TTS. Pluggable ActionExecutor interface. 27 tests.
  - All services use dependency injection (provider interfaces) for testability — OpenAI APIs are fully mockable. Total: **147 new tests**, all passing. Full suite: **552 tests**, zero regressions, typecheck clean (only pre-existing app.ts errors remain).
- **2026-03-23 — Orchestration checkpoint recorded.** Spawn manifest outcome captured for Bender: `P4-1` through `P4-6` voice backend pipeline shipped successfully with **6 services**, **147 new tests**, and **552 total tests** reported at handoff.
- **2026-03-24 — copilot-sdk integrated as AI provider.** Installed `@github/copilot-sdk` and built a pluggable AI provider layer at `apps/api/src/services/ai/`. `CopilotProvider` implements `LLMRouter` (voice routing), `LLMIntentParser` (voice actions), and `chatCompletion()` (chat backend). Feature flag `AI_PROVIDER=copilot-sdk|mock` (default mock) so dev works without API keys. The SDK uses JSON-RPC to the Copilot CLI — auth via `COPILOT_GITHUB_TOKEN`/`GH_TOKEN`/`GITHUB_TOKEN`, model via `COPILOT_MODEL` (default gpt-4o). `ChatService` now routes team messages through the AI provider instead of the echo stub. 30 new tests, 667 total, zero regressions.
- **2026-03-24 — Chat client error fixed.** Root cause: `useChatMessages` hook expected `ChatMessage[]` but the GET `/api/chat/messages` endpoint returns `{ messages, total, limit, offset }` — a paginated envelope. Frontend called `.map()` on the object, crashing. Fix: extract `.messages` array in the hook's queryFn. Also fixed `createAIProvider` factory to gracefully fall back to `MockAIProvider` instead of throwing when copilot-sdk can't initialize (SDK needs a running Copilot CLI). Upgraded MockAIProvider from dumb echo to context-aware responses with agent personality. Added error banners to chat-client.tsx for fetch/send failures. Key files: `apps/web/src/hooks/use-chat.ts`, `apps/api/src/services/ai/copilot-provider.ts`, `apps/api/src/app.ts`, `apps/web/app/chat/chat-client.tsx`.
- The API app (apps/api) uses Fastify with onReady/onClose lifecycle hooks for service initialization and cleanup, as seen in apps/api/src/app.ts.
- There are pre-existing TypeScript errors in apps/api in files like escalations.ts, knowledge.ts, health.ts, and agents.ts — these are not regressions from new changes.
- The .squad directory contains task definitions (e.g., .squad/tasks/task-*.md) used by the Squad agent system for task management and assignment.
- The project uses pnpm workspaces with a monorepo structure: apps/ for deployable services (api, web), packages/ for shared libraries (memory-store, shared). Tests use vitest.
- The memory system lives in two places: packages/memory-store (core store with SQLite/FTS5) and apps/api/src/services/memory (API-level services like recall, extraction, lifecycle). Types are in packages/shared/src/types/memory.ts.
- Completed "Persistent Agent Memory": Task is already done. Leela committed it in `5e340f0` — verified:

- **355 memory-store tests** ✅ all passing
- **35 API memory service tests** ✅ all passing (including 8 new lifecycle tests)
- **6 files changed**, 668 insertions covering: search endpoint, create endpoint, consolidation endpoint, settings persistence, lifecycle scheduler, and test fixes

Nothing left to do here.
- 03-23 — P4-1 through P4-6 voice backend pipeline built. Six services in `apps/api/src/services/voice/`:
- 03-23 — P3-5 through P3-8 Real-time frontend features built. Four major frontend features implemented in `apps/web`:
- Test memory
- A decision
- Chose SQLite for storage
- Completed "Review node-pty version change and PTY cleanup logic": 

Zero type errors in `terminal.ts`. The pre-existing errors are all in `escalations.ts` and `agents.ts` — unrelated.

---
- Memory search uses hybrid FTS5 full-text search combined with vector search, stored in SQLite. Memory settings are persisted to a memory_settings SQLite table.
- The openspace-for-ai-squad monorepo uses pnpm workspaces with apps/ (api, web) and packages/ (memory-store, shared) structure, orchestrated by turborepo.
- API services are initialized in apps/api/src/app.ts using onReady/onClose hooks. The .squad/ directory contains task definitions and management files.
- Project uses vitest for testing, TypeScript with tsc --noEmit for type checking, and eslint for linting. Tests are co-located in __tests__/ directories next to source files.
- Memory system architecture: packages/memory-store provides core SQLite+FTS5 storage, apps/api/src/services/memory/ has memory-recall, memory-extractor, memory-store, and memory-lifecycle services, with routes in apps/api/src/routes/memories.ts.
- Completed "Persistent Agent Memory": All good. **224 memory tests pass**, zero type errors in memory files. Leela's commit `5e340f0` already delivered the full implementation:

- `POST /api/memories/search` — hybrid FTS5 + vector search
- `POST /api/memories` — API-driven memory creation
- `POST /api/memories/consolidate` — manual decay + archival
- `PATCH /api/memories/settings` — persists to SQLite
- `MemoryLifecycleService` — daily decay scheduler
- Lifecycle tests with fixed seed collision

Nothing left to do here. Task was alr
- Completed "Sandboxed Code Execution": Done. Here's what I shipped:

**14 files changed, 510 insertions, 64 deletions. 91 tests passing.**

### What was done:
- **Stop/restart lifecycle** — `ContainerManager.stop()`, `ContainerManager.restart()` propagated up through pool and service layers
- **New endpoints** — `POST /api/sandboxes/:id/stop` (409 if not running), `POST /api/sandboxes/:id/restart` (409 if not stopped)
- **List filtering** — `GET /api/sandboxes?status=ready&runtime=node`
- **Shared type alignment** — Replaced stale dr
- Completed "Implement escalation engine, review queue, and audit trail backend": Done. Here's what I did:

**Changes (5 files, 871 lines):**

1. **`apps/api/src/app.ts`** — Instantiated `EscalationService` with DB, decorated Fastify instance, wired WebSocket manager in `onReady` hook, registered escalation routes at `/api` prefix, added type declaration.

2. **`apps/api/src/services/websocket/types.ts`** — Added 7 escalation WS event types: `escalation:created`, `escalation:claimed`, `escalation:approved`, `escalation:rejected`, `escalation:changes_requested`, `escalation:au
- Completed "Skills - Browse, discover, and manage skills for your AI agents.": Done. Here's what I shipped:

**7 files, 1,452 lines added:**

| File | Purpose |
|------|---------|
| `packages/shared/src/types/skill.ts` | `GallerySkill`, `GalleryCategory`, `GallerySearchParams` types |
| `apps/api/src/services/skill-gallery/migration-v5.ts` | DB migration: `skill_gallery` table + FTS5 index |
| `apps/api/src/services/skill-gallery/index.ts` | `SkillGalleryService` — catalog CRUD, FTS search, seed data (15 skills across 9 categories) |
| `apps/api/src/routes/skill-gallery.ts
- Completed "Add reconnection logic to useSandboxStream hook": All 17 tests pass. The reconnection logic is **already fully implemented** in `useSandboxStream`:

- **Exponential backoff**: 1s → 2s → 4s → … → 30s cap
- **Max 10 attempts** before transitioning to `'failed'` status
- **Delay reset** on successful connection
- **`retry()`** method for manual reconnect after failure
- **Clean unmount** — cancels timers, closes sockets
- **17 passing tests** covering all edge cases

This task is already done. Nothing to implement.
- 03-23 — Orchestration checkpoint recorded. Spawn manifest outcome captured for Bender: `P3-5` through `P3-8` real-time frontend, chat UI, and notifications shipped successfully with **70 new tests** added during the delivery batch.
- 03-23 — Orchestration checkpoint recorded. Spawn manifest outcome captured for Bender: `P4-1` through `P4-6` voice backend pipeline shipped successfully with **6 services**, **147 new tests**, and **552 total tests** reported at handoff.
- 03-23 — P0-1 Monorepo initialized. Turborepo + pnpm workspaces. Structure: `apps/web` (Next.js 14+), `apps/api` (Fastify 5, ESM), `packages/shared`. Root tsconfig uses strict mode + bundler resolution. Turbo pipeline: build depends on ^build, dev is persistent/uncached. API uses `@fastify/cors` + `dotenv`. Shared package uses source-level imports (no build step). `pnpm install` NOT run yet — scaffolding only. All workspace refs use `workspace:*` protocol.
- 03-23 — P0-3 Backend scaffolding complete. Fastify app factory in `src/app.ts` accepts options (logger toggle for tests). Routes use Fastify plugin pattern — `src/routes/health.ts` is registered via `app.register()`. Graceful shutdown via SIGTERM/SIGINT in `src/index.ts`. Health endpoint tested with Vitest using Fastify's `app.inject()` (no supertest needed — Fastify's built-in injection is lighter and sufficient). 3 tests: status/timestamp correctness, content-type, and timestamp freshness.
- 03-23  Phase 0 foundation is complete. The repo now has the monorepo baseline, Fastify API scaffold, shared `@openspace/shared` contracts, CI workflow, and repo-wide quality tooling. Backend Phase 1 work can now focus on `.squad/` parsing and real domain routes instead of setup.
- 03-23 — P0-5 CI/CD pipeline created. `.github/workflows/ci.yml` runs lint + typecheck + test on PRs and pushes to main. Caches both pnpm store and Turborepo `.turbo/` directory. Uses `pnpm/action-setup@v4` with corepack. `.nvmrc` was already at `20`. Concurrency group cancels stale runs.
- 03-23 — PRD published at `docs/prd.md`. Read this before starting any feature work. It defines v1 scope: web-only, single-squad, 6 core features (Dashboard, Task Board, Activity Feed, Voice, Chat, Real-time Monitoring). Backend is Node.js with file system integration to `.squad/`. See open decisions in §8 of PRD.
- 03-23 — P1-1 `.squad/` file parser service built. Four focused parsers in `apps/api/src/services/squad-parser/`: `team-parser.ts` (team.md → Agent[]), `decision-parser.ts` (decisions.md → Decision[]), `agent-parser.ts` (charter.md → AgentDetail, history.md → learnings[]), `config-parser.ts` (config.json → RawSquadConfig). All parsers follow a consistent pattern: read file → parse markdown/JSON → return typed object using @openspace/shared types. Every parser exports both a file-based function and a pure content-parsing function for testability. `SquadParser` class composes them with five methods: `getAgents()`, `getAgent(id)`, `getDecisions()`, `getConfig()`, `getSquadOverview()`. Squad directory is configurable via `SQUAD_DIR` env var (defaults to CWD/.squad). Added `AgentDetail`, `AgentIdentity`, `AgentBoundaries` types to `@openspace/shared`. 64 tests cover happy paths, missing files, malformed data, edge cases. All 109 tests pass, typecheck clean.
- 03-23 — P1-8 SQLite index layer built. `apps/api/src/services/db/`: 4 modules. `schema.ts` defines tables (tasks, decisions, chat_messages, activity_events) + FTS5 virtual tables (decisions_fts, tasks_fts) with auto-sync triggers + indexes on status/assignee/priority/timestamp fields. `index.ts` opens SQLite via `better-sqlite3` at `.squad/.cache/openspace.db` (gitignored), applies WAL mode + performance pragmas. `sync.ts` provides `fullSync()` (startup: wipe+reindex from files) and `incrementalSync()` (on file change: selective re-index). `search.ts` provides `searchDecisions()`, `searchTasks()`, `searchAll()` with FTS5 full-text search, BM25 ranking, and highlighted snippets. SQLite is explicitly the CACHE — `.squad/` files are source of truth, files always win on conflict. DB path configurable via `DB_PATH` env var, supports in-memory mode for tests. 32 tests cover schema creation, full sync, incremental updates, and full-text search. Dependencies added: `better-sqlite3`, `@types/better-sqlite3`.
- 03-23 — P3-1 WebSocket server built. `apps/api/src/services/websocket/`: 4 modules. `types.ts` defines the wire protocol (`WsEnvelope: { type, payload, timestamp }`) with 6 event types: `agent:status`, `task:updated`, `task:created`, `decision:added`, `activity:new`, `chat:message`. Client can send `subscribe`/`unsubscribe`/`pong` messages. `manager.ts` is the `WebSocketManager` class: tracks connected clients with unique IDs, broadcasts to subscribers, handles subscription filtering (empty subs = all events), heartbeat ping/pong cycle (30s ping, drops unresponsive clients), graceful shutdown. `plugin.ts` is the Fastify plugin: registers `@fastify/websocket`, creates the `/ws` route, decorates `app.wsManager`. `index.ts` re-exports the public API. 25 tests cover connection lifecycle, welcome message, subscription filtering, heartbeat, shutdown, and error handling. Dependency added: `@fastify/websocket`.
- 03-23 — P3-4 Chat backend built. `apps/api/src/services/chat/index.ts`: `ChatService` class handles message CRUD with dual persistence to SQLite (`chat_messages` table) + markdown logs in `.squad/sessions/chat-YYYY-MM-DD.md`. `send()` creates a `ChatMessage`, writes to both stores, emits `chat:message` via WebSocket. Team messages (`recipient: "team"`) go through a coordinator echo stub that responds with a routing acknowledgment. `getMessages()` returns paginated, filterable history (by agent, threadId). `getMessage(id)` for single lookup. REST routes: `POST /api/chat/messages` (validated sender/recipient/content), `GET /api/chat/messages` (limit/offset/agent/threadId params). D7 resolved: both SQLite + markdown. 21 tests cover send, SQLite persistence, markdown dual-write, WebSocket emission, coordinator echo, pagination, filtering, and validation. All 359 tests pass, typecheck clean.
- 03-24 — Chat client error fixed. Root cause: `useChatMessages` hook expected `ChatMessage[]` but the GET `/api/chat/messages` endpoint returns `{ messages, total, limit, offset }` — a paginated envelope. Frontend called `.map()` on the object, crashing. Fix: extract `.messages` array in the hook's queryFn. Also fixed `createAIProvider` factory to gracefully fall back to `MockAIProvider` instead of throwing when copilot-sdk can't initialize (SDK needs a running Copilot CLI). Upgraded MockAIProvider from dumb echo to context-aware responses with agent personality. Added error banners to chat-client.tsx for fetch/send failures. Key files: `apps/web/src/hooks/use-chat.ts`, `apps/api/src/services/ai/copilot-provider.ts`, `apps/api/src/app.ts`, `apps/web/app/chat/chat-client.tsx`.
- 03-24 — copilot-sdk integrated as AI provider. Installed `@github/copilot-sdk` and built a pluggable AI provider layer at `apps/api/src/services/ai/`. `CopilotProvider` implements `LLMRouter` (voice routing), `LLMIntentParser` (voice actions), and `chatCompletion()` (chat backend). Feature flag `AI_PROVIDER=copilot-sdk|mock` (default mock) so dev works without API keys. The SDK uses JSON-RPC to the Copilot CLI — auth via `COPILOT_GITHUB_TOKEN`/`GH_TOKEN`/`GITHUB_TOKEN`, model via `COPILOT_MODEL` (default gpt-4o). `ChatService` now routes team messages through the AI provider instead of the echo stub. 30 new tests, 667 total, zero regressions.
- 03-23 — P3-2 FileWatcher → WebSocket bridge built. `apps/api/src/services/websocket/bridge.ts`: `FileWatcherBridge` class connects FileWatcher `change` events to WebSocket broadcasts. Maps file event types to WS event types (e.g., `agent:updated` → `agent:status`, `task:created` → `task:created`). Implements 200ms batch window to throttle rapid changes. Deduplicates same type+path events within a batch (keeps latest). Clean start/stop lifecycle. 7 tests cover event mapping, batching, deduplication, and disconnect.
- 03-23 — P3-3 Activity feed backend built. `apps/api/src/services/activity/index.ts`: `ActivityFeed` class is an in-memory ring buffer (configurable capacity, default 500 events). Stores `ActivityEvent` objects from `@openspace/shared`. Sources from FileWatcher changes via `connectFileWatcher()` — maps file events to activity event types (e.g., `task:created` → `spawned`, `decision:added` → `decision`). Extracts agent IDs from file paths. `push()` adds events and broadcasts `activity:new` via WebSocket. `getHistory(limit, offset)` returns paginated results newest-first. `GET /api/activity` route with limit/offset query params (max 200). 15 tests cover ring buffer, pagination, WebSocket emission, FileWatcher integration, and route responses.
- 03-23 — P1-2 File watcher service built. `apps/api/src/services/file-watcher/index.ts`: `FileWatcher` class extends `EventEmitter`, uses `chokidar` to watch `.squad/` directory. Emits typed events: `agent:updated`, `task:created`, `task:updated`, `decision:added`, `config:changed`, `team:updated`, plus a generic `change` event for all. Debouncing (configurable, default 100ms) batches rapid FS changes. Polling fallback via `WATCH_MODE=poll|native` env var. Maintains an in-memory `SquadState` cache re-parsed from `SquadParser` on every change. Ignores `.cache/` and `node_modules/` subdirectories. `awaitWriteFinish` ensures partial writes don't trigger false events. 18 tests (5 unit, 13 integration with real temp dirs and chokidar polling). Dependencies added: `chokidar`.
- A pattern
- We use TypeScript strict mode for all projects
- New memory from API that should be written back
- Exact same content
- A test pattern memory
- Test content
- Updated content
- Updated content
- The project uses git worktrees (.git-worktrees/task-*) for parallel task isolation, allowing concurrent work on different tasks in separate working directories.
- Frontend API response types live in apps/web/src/lib/ (e.g., trace-types.ts) with corresponding mock data files (mock-traces.ts) that must be updated when API response shapes change.
- There are pre-existing SQLITE_BUSY test failures in unrelated modules that should be ignored when validating changes to other areas of the codebase.
- Trace span attributes follow OpenTelemetry-style conventions with tool.* (tool.name, tool.input, tool.output) and llm.* (llm.model, llm.provider, llm.prompt_tokens) prefixes in apps/api/src/routes/traces.ts.
- Completed "Enhance trace API span data extraction": Done. Here's what I did:

**Files changed:** `apps/api/src/routes/traces.ts`, `apps/web/src/lib/trace-types.ts`, `apps/web/src/lib/mock-traces.ts`

**Changes:**
1. **Tool name display** — Tool spans now show the actual `tool.name` attribute instead of generic names; `tool:X` prefixes are stripped
2. **Enriched payload** — Tool spans populate `input`/`output`/`error` from `tool.*` attributes; LLM spans surface `llmProvider`, `llmStreaming`, `llmTimeToFirstTokenMs` as top-level fields
3. **Compute
- Standardized fallback IDs: `ai.agent_id` defaults to 'system' and `ai.task_title` defaults to 'untitled' (never null/undefined/'unknown').
- The project uses OpenTelemetry (OTel) for tracing with spans stored in a SQLite database. Span attributes are stored as JSON in the `attributes` column of the `spans` table.
- The project uses Fastify (not Express) for the API layer, with app setup in `apps/api/src/app.ts` and an OTLP collector route at `apps/api/src/routes/otlp-collector.ts`.
- The repo uses git worktrees (`.git-worktrees/`) for parallel task branches, and tests are run with vitest (105 tracing tests).
- The tracing package is at `packages/tracing/` with key files: `instrument-tool.ts`, `instrument-llm.ts`, `tracer.ts`, and `types.ts`. The API consumes it in `apps/api/src/services/ai/copilot-provider.ts`.
- Completed "Enrich backend trace spans with tool inputs/outputs and metadata": Done. Here's the summary:

**7 files changed across `packages/tracing/` and `apps/api/`:**

| # | Change | File(s) |
|---|--------|---------|
| 1 | **Tool call OTel spans** — `tool.execution_start/end` events create child spans with `tool.name`, `tool.input`, `tool.output`, `tool.duration_ms`, `tool.error` | `copilot-provider.ts` |
| 2 | **OTel span attributes** — `ai.prompt`, `ai.system_prompt`, `ai.response` confirmed on spans; added `metadata` to `TraceServiceLike` | `copilot-provider.ts` |
|
- The project uses pnpm workspace filters for per-package testing and linting (e.g., `pnpm --filter @matanelcohen/openspace-tracing test`). Tracing package is at packages/tracing/, API is at apps/api/.
- Pre-existing API test failures exist in apps/api that are unrelated to tracing changes. The 105 tracing-specific tests in the tracing package are the reliable signal for tracing changes.
- Tracing span attributes use fallback keys: tool.input may also be stored as 'arguments' or 'args', and tool.output as 'result'. buildSpanTree() in traces.ts needs fallback extraction logic for all variants.
- Tracing instrumentation is split across instrument-tool.ts, instrument-llm.ts, and types.ts in packages/tracing/src/. The copilot-provider.ts in apps/api/ creates sub-spans that need to mirror these attribute conventions.
- Completed "Enrich trace API and backend data pipeline": Commit successful — lint-staged passed (eslint + prettier). All done.

**Summary of changes across 6 files:**

1. **`apps/api/src/routes/traces.ts`** — Fixed `buildSpanTree()` to extract `tool.input`, `tool.output`, `tool.name` with fallback keys (`arguments`, `args`, `result`). Also extracts token counts and cost from span attributes. Added `GET /traces/tools`, `GET /traces/spans/search` endpoints and extended `/traces/stats` with tool breakdowns.

2. **`apps/api/src/services/traces/index.ts`**
- The trace API route (`apps/api/src/routes/traces.ts`) uses `buildSpanTree` to structure spans and supports aggregate stats (tool/LLM call counts, cost, tokens, duration) on single-trace responses.
- Tool calls in the copilot provider (`apps/api/src/services/ai/copilot-provider.ts`) have both agentic and chat completion paths that need separate instrumentation for tool_start/tool_result events.
- Preview attributes use 200-character truncation as the standard for human-readable summaries in trace spans (input_preview, output_preview, system_prompt_preview, etc.).
- Tracing instrumentation lives in `packages/tracing/src/` with separate files per span kind: `instrument-tool.ts`, `instrument-llm.ts`, `instrument-agent.ts`. Types are in `types.ts` and re-exported from `index.ts`.
- Completed "Enrich backend trace attributes": All 122 tests pass. Done.
- Tracing span attributes are stored as JSON strings in the SQLite `trace_spans` table and must be parsed with JSON.parse wrapped in try/catch for safety.
- The tracing package instruments tools in `packages/tracing/src/instrument-tool.ts` and LLMs in `instrument-llm.ts`, with span types defined in `types.ts` and storage in `trace-store.ts`.
- Trace API routes live in `apps/api/src/routes/traces.ts` with a `buildSpanTree()` function that extracts span attributes like `tool.input` and `tool.output` from parsed JSON.
- Most test failures in the repo (170+ files) are pre-existing React component failures (`React is not defined`), unrelated to backend/tracing changes. Run tracing tests specifically with `npx vitest run packages/tracing/` to validate changes.
- Completed "Enrich trace API and span recording": Done. Here's what I did across 5 files:

**`packages/tracing/src/instrument-tool.ts`** — Added `safeStringify`, `makeTypeHint`, `getByteSize` helpers. Tool spans now emit `tool.input_preview`, `tool.output_preview`, `tool.input_type`, `tool.output_type`, `tool.input_size_bytes`, `tool.output_size_bytes`.

**`packages/tracing/src/tracer.ts`** — `startSpan()` now looks up the parent span name and sets `span.parent_name` attribute automatically.

**`packages/tracing/src/types.ts`** — Extended `Tool
- DAG engine is in packages/shared/src/workflow/dag-engine.ts and tool invocation happens via ctx.toolRegistry.invoke(). Agent worker service is in apps/api/src/services/agent-worker/index.ts.
- This monorepo uses pnpm workspaces with --filter flag for per-package commands (e.g., pnpm --filter @matanelcohen/openspace-tracing test). Tests use vitest.
- The project uses git worktrees under .git-worktrees/ for parallel task branches, with --no-verify flag on commits to skip hooks in worktree contexts.
- The tracing package (@matanelcohen/openspace-tracing) provides instrumentToolCall() and instrumentLLMCall() helpers plus a withSpan() wrapper with error handling. All instrumentation is opt-in via an optional tracer field on config objects.
- Completed "Instrument DAG engine, agent worker, and tool calls with rich tracing spans": All tests pass: **122 tracing + 720 shared + 17 agent-worker = 859 tests passing**.

Here's what I did:

## Summary

Instrumented the DAG engine, agent worker, and tool calls with rich tracing spans across 7 files:

### Tracer enhancements (`packages/tracing/src/tracer.ts`)
- `withSpan()` now captures **full stack traces** (not just message), detects **timeout-specific exceptions** (`TimeoutError`), and records `exception.type` classification

### DAG Engine (`packages/shared/src/workflow/dag-en

## Summary

Implemented all 5 items across 7 files:

1. **Tool span enrichment** (`instrument-tool.ts`): Added `tool.input_preview`, `tool.output_preview` (200 char truncated), `tool.input_size_bytes`/`tool.output_size_bytes`, `tool.status` (success/error/timeout), `tool.retry_count`, and timeout support via `timeoutMs` option.

2. **LLM span enrichment** (`instrument-llm.ts`): Added `llm.system_prompt_preview`, `llm.user_prompt_preview`, `llm.response_preview` (200 ch

## Review Summary

**Fixed 2 bugs, flagged 1 advisory.**

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | 🔴 HIGH | Force-kill catch block (line 134) silently swallowed `EPERM` — zombie PTYs could persist undetected | Now only ignores `ESRCH`; logs `error` level for anything else |
| 2 | 🟡 MED | `term.write()`/`term.resize()` had no try/catch — TOCTOU r
- Completed "Sandboxed Code Execution": Done. Here's what I shipped:

**14 files changed, 510 insertions, 64 deletions. 91 tests passing.**

### What was done:
- **Stop/restart lifecycle** — `ContainerManager.stop()`, `ContainerManager.restart()` propagated up through pool and service layers
- **New endpoints** — `POST /api/sandboxes/:id/stop` (409 if not running), `POST /api/sandboxes/:id/restart` (409 if not stopped)
- **List filtering** — `GET /api/sandboxes?status=ready&runtime=node`
- **Shared type alignment** — Replaced stale dr
- Completed "Implement escalation engine, review queue, and audit trail backend": Done. Here's what I did:

**Changes (5 files, 871 lines):**

1. **`apps/api/src/app.ts`** — Instantiated `EscalationService` with DB, decorated Fastify instance, wired WebSocket manager in `onReady` hook, registered escalation routes at `/api` prefix, added type declaration.

2. **`apps/api/src/services/websocket/types.ts`** — Added 7 escalation WS event types: `escalation:created`, `escalation:claimed`, `escalation:approved`, `escalation:rejected`, `escalation:changes_requested`, `escalation:au
- Completed "Skills - Browse, discover, and manage skills for your AI agents.": Done. Here's what I shipped:

**7 files, 1,452 lines added:**

| File | Purpose |
|------|---------|
| `packages/shared/src/types/skill.ts` | `GallerySkill`, `GalleryCategory`, `GallerySearchParams` types |
| `apps/api/src/services/skill-gallery/migration-v5.ts` | DB migration: `skill_gallery` table + FTS5 index |
| `apps/api/src/services/skill-gallery/index.ts` | `SkillGalleryService` — catalog CRUD, FTS search, seed data (15 skills across 9 categories) |
| `apps/api/src/routes/skill-gallery.ts
- Completed "Add reconnection logic to useSandboxStream hook": All 17 tests pass. The reconnection logic is **already fully implemented** in `useSandboxStream`:

- **Exponential backoff**: 1s → 2s → 4s → … → 30s cap
- **Max 10 attempts** before transitioning to `'failed'` status
- **Delay reset** on successful connection
- **`retry()`** method for manual reconnect after failure
- **Clean unmount** — cancels timers, closes sockets
- **17 passing tests** covering all edge cases

This task is already done. Nothing to implement.
- 03-23 — Orchestration checkpoint recorded. Spawn manifest outcome captured for Bender: `P3-5` through `P3-8` real-time frontend, chat UI, and notifications shipped successfully with **70 new tests** added during the delivery batch.
- 03-23 — Orchestration checkpoint recorded. Spawn manifest outcome captured for Bender: `P4-1` through `P4-6` voice backend pipeline shipped successfully with **6 services**, **147 new tests**, and **552 total tests** reported at handoff.
- 03-23 — P0-1 Monorepo initialized. Turborepo + pnpm workspaces. Structure: `apps/web` (Next.js 14+), `apps/api` (Fastify 5, ESM), `packages/shared`. Root tsconfig uses strict mode + bundler resolution. Turbo pipeline: build depends on ^build, dev is persistent/uncached. API uses `@fastify/cors` + `dotenv`. Shared package uses source-level imports (no build step). `pnpm install` NOT run yet — scaffolding only. All workspace refs use `workspace:*` protocol.
- 03-23 — P0-3 Backend scaffolding complete. Fastify app factory in `src/app.ts` accepts options (logger toggle for tests). Routes use Fastify plugin pattern — `src/routes/health.ts` is registered via `app.register()`. Graceful shutdown via SIGTERM/SIGINT in `src/index.ts`. Health endpoint tested with Vitest using Fastify's `app.inject()` (no supertest needed — Fastify's built-in injection is lighter and sufficient). 3 tests: status/timestamp correctness, content-type, and timestamp freshness.
- 03-23  Phase 0 foundation is complete. The repo now has the monorepo baseline, Fastify API scaffold, shared `@openspace/shared` contracts, CI workflow, and repo-wide quality tooling. Backend Phase 1 work can now focus on `.squad/` parsing and real domain routes instead of setup.
- 03-23 — P0-5 CI/CD pipeline created. `.github/workflows/ci.yml` runs lint + typecheck + test on PRs and pushes to main. Caches both pnpm store and Turborepo `.turbo/` directory. Uses `pnpm/action-setup@v4` with corepack. `.nvmrc` was already at `20`. Concurrency group cancels stale runs.
- 03-23 — PRD published at `docs/prd.md`. Read this before starting any feature work. It defines v1 scope: web-only, single-squad, 6 core features (Dashboard, Task Board, Activity Feed, Voice, Chat, Real-time Monitoring). Backend is Node.js with file system integration to `.squad/`. See open decisions in §8 of PRD.
- 03-23 — P1-1 `.squad/` file parser service built. Four focused parsers in `apps/api/src/services/squad-parser/`: `team-parser.ts` (team.md → Agent[]), `decision-parser.ts` (decisions.md → Decision[]), `agent-parser.ts` (charter.md → AgentDetail, history.md → learnings[]), `config-parser.ts` (config.json → RawSquadConfig). All parsers follow a consistent pattern: read file → parse markdown/JSON → return typed object using @openspace/shared types. Every parser exports both a file-based function and a pure content-parsing function for testability. `SquadParser` class composes them with five methods: `getAgents()`, `getAgent(id)`, `getDecisions()`, `getConfig()`, `getSquadOverview()`. Squad directory is configurable via `SQUAD_DIR` env var (defaults to CWD/.squad). Added `AgentDetail`, `AgentIdentity`, `AgentBoundaries` types to `@openspace/shared`. 64 tests cover happy paths, missing files, malformed data, edge cases. All 109 tests pass, typecheck clean.
- 03-23 — P1-8 SQLite index layer built. `apps/api/src/services/db/`: 4 modules. `schema.ts` defines tables (tasks, decisions, chat_messages, activity_events) + FTS5 virtual tables (decisions_fts, tasks_fts) with auto-sync triggers + indexes on status/assignee/priority/timestamp fields. `index.ts` opens SQLite via `better-sqlite3` at `.squad/.cache/openspace.db` (gitignored), applies WAL mode + performance pragmas. `sync.ts` provides `fullSync()` (startup: wipe+reindex from files) and `incrementalSync()` (on file change: selective re-index). `search.ts` provides `searchDecisions()`, `searchTasks()`, `searchAll()` with FTS5 full-text search, BM25 ranking, and highlighted snippets. SQLite is explicitly the CACHE — `.squad/` files are source of truth, files always win on conflict. DB path configurable via `DB_PATH` env var, supports in-memory mode for tests. 32 tests cover schema creation, full sync, incremental updates, and full-text search. Dependencies added: `better-sqlite3`, `@types/better-sqlite3`.
- 03-23 — P3-1 WebSocket server built. `apps/api/src/services/websocket/`: 4 modules. `types.ts` defines the wire protocol (`WsEnvelope: { type, payload, timestamp }`) with 6 event types: `agent:status`, `task:updated`, `task:created`, `decision:added`, `activity:new`, `chat:message`. Client can send `subscribe`/`unsubscribe`/`pong` messages. `manager.ts` is the `WebSocketManager` class: tracks connected clients with unique IDs, broadcasts to subscribers, handles subscription filtering (empty subs = all events), heartbeat ping/pong cycle (30s ping, drops unresponsive clients), graceful shutdown. `plugin.ts` is the Fastify plugin: registers `@fastify/websocket`, creates the `/ws` route, decorates `app.wsManager`. `index.ts` re-exports the public API. 25 tests cover connection lifecycle, welcome message, subscription filtering, heartbeat, shutdown, and error handling. Dependency added: `@fastify/websocket`.
- 03-23 — P3-4 Chat backend built. `apps/api/src/services/chat/index.ts`: `ChatService` class handles message CRUD with dual persistence to SQLite (`chat_messages` table) + markdown logs in `.squad/sessions/chat-YYYY-MM-DD.md`. `send()` creates a `ChatMessage`, writes to both stores, emits `chat:message` via WebSocket. Team messages (`recipient: "team"`) go through a coordinator echo stub that responds with a routing acknowledgment. `getMessages()` returns paginated, filterable history (by agent, threadId). `getMessage(id)` for single lookup. REST routes: `POST /api/chat/messages` (validated sender/recipient/content), `GET /api/chat/messages` (limit/offset/agent/threadId params). D7 resolved: both SQLite + markdown. 21 tests cover send, SQLite persistence, markdown dual-write, WebSocket emission, coordinator echo, pagination, filtering, and validation. All 359 tests pass, typecheck clean.
- 03-24 — Chat client error fixed. Root cause: `useChatMessages` hook expected `ChatMessage[]` but the GET `/api/chat/messages` endpoint returns `{ messages, total, limit, offset }` — a paginated envelope. Frontend called `.map()` on the object, crashing. Fix: extract `.messages` array in the hook's queryFn. Also fixed `createAIProvider` factory to gracefully fall back to `MockAIProvider` instead of throwing when copilot-sdk can't initialize (SDK needs a running Copilot CLI). Upgraded MockAIProvider from dumb echo to context-aware responses with agent personality. Added error banners to chat-client.tsx for fetch/send failures. Key files: `apps/web/src/hooks/use-chat.ts`, `apps/api/src/services/ai/copilot-provider.ts`, `apps/api/src/app.ts`, `apps/web/app/chat/chat-client.tsx`.
- 03-24 — copilot-sdk integrated as AI provider. Installed `@github/copilot-sdk` and built a pluggable AI provider layer at `apps/api/src/services/ai/`. `CopilotProvider` implements `LLMRouter` (voice routing), `LLMIntentParser` (voice actions), and `chatCompletion()` (chat backend). Feature flag `AI_PROVIDER=copilot-sdk|mock` (default mock) so dev works without API keys. The SDK uses JSON-RPC to the Copilot CLI — auth via `COPILOT_GITHUB_TOKEN`/`GH_TOKEN`/`GITHUB_TOKEN`, model via `COPILOT_MODEL` (default gpt-4o). `ChatService` now routes team messages through the AI provider instead of the echo stub. 30 new tests, 667 total, zero regressions.
- 03-23 — P3-2 FileWatcher → WebSocket bridge built. `apps/api/src/services/websocket/bridge.ts`: `FileWatcherBridge` class connects FileWatcher `change` events to WebSocket broadcasts. Maps file event types to WS event types (e.g., `agent:updated` → `agent:status`, `task:created` → `task:created`). Implements 200ms batch window to throttle rapid changes. Deduplicates same type+path events within a batch (keeps latest). Clean start/stop lifecycle. 7 tests cover event mapping, batching, deduplication, and disconnect.
- 03-23 — P3-3 Activity feed backend built. `apps/api/src/services/activity/index.ts`: `ActivityFeed` class is an in-memory ring buffer (configurable capacity, default 500 events). Stores `ActivityEvent` objects from `@openspace/shared`. Sources from FileWatcher changes via `connectFileWatcher()` — maps file events to activity event types (e.g., `task:created` → `spawned`, `decision:added` → `decision`). Extracts agent IDs from file paths. `push()` adds events and broadcasts `activity:new` via WebSocket. `getHistory(limit, offset)` returns paginated results newest-first. `GET /api/activity` route with limit/offset query params (max 200). 15 tests cover ring buffer, pagination, WebSocket emission, FileWatcher integration, and route responses.
- 03-23 — P1-2 File watcher service built. `apps/api/src/services/file-watcher/index.ts`: `FileWatcher` class extends `EventEmitter`, uses `chokidar` to watch `.squad/` directory. Emits typed events: `agent:updated`, `task:created`, `task:updated`, `decision:added`, `config:changed`, `team:updated`, plus a generic `change` event for all. Debouncing (configurable, default 100ms) batches rapid FS changes. Polling fallback via `WATCH_MODE=poll|native` env var. Maintains an in-memory `SquadState` cache re-parsed from `SquadParser` on every change. Ignores `.cache/` and `node_modules/` subdirectories. `awaitWriteFinish` ensures partial writes don't trigger false events. 18 tests (5 unit, 13 integration with real temp dirs and chokidar polling). Dependencies added: `chokidar`.
- A pattern

# openspace.ai — Execution Plan

> **Version:** 1.0
> **Author:** Leela (Lead)
> **Date:** 2026-03-23
> **Status:** Active
> **Source:** Decomposed from `docs/prd.md`

---

## Critical Path

The dependency chain that determines overall timeline:

```
Phase 0: Project Setup
  └─► Phase 1: Core Data Layer
        ├─► Phase 2: Dashboard + Task Board
        │     └─► Phase 5: Decision Log + Polish (partial)
        └─► Phase 3: Real-time + Chat
              └─► Phase 4: Voice Interface
                    └─► Phase 5: Final Polish + Deployment
```

**Bottleneck analysis:**

| Path | Sequence | Notes |
|------|----------|-------|
| **Longest path** | P0 → P1 → P3 → P4 → P5 | Voice depends on chat, chat depends on data layer |
| **Parallel opportunity** | P2 and P3 can run in parallel after P1 | Dashboard and real-time share the data layer but don't block each other |
| **Blocking decisions** | D1 (monorepo) and D4 (task file format) block P0 and P1 respectively | Must resolve before work begins |

**Estimated total:** ~25–32 sessions across all phases.

---

## Phase 0 — Project Setup (Foundation)

> Everything depends on this. Must complete before any feature work starts.

### Open Decisions to Resolve

| Decision | Reference | Recommendation | Must Resolve By |
|----------|-----------|----------------|-----------------|
| Monorepo or separate repos? | D1 | **Monorepo** — shared types, single CI, simpler DX | Before P0-1 |
| Backend framework choice | D2 | **Fastify** — WebSocket support, performance, TypeScript-native | Before P0-1 |
| Auth strategy (local vs deployed) | D5 | **Skip auth in local dev, NextAuth.js for deployed** — unblocks development | Before P1 (can defer slightly) |

### Work Items

| ID | Title | Description | Agent | Depends On | Complexity |
|----|-------|-------------|-------|------------|------------|
| P0-1 | **Initialize monorepo** | Create Turborepo/pnpm workspace with `apps/web` (Next.js 14+, App Router, React 19), `apps/api` (Fastify + TypeScript), and `packages/shared` (shared types, constants, utils). Set up `tsconfig` base configs, path aliases, and workspace scripts (`dev`, `build`, `lint`, `test`). | Bender | D1, D2 resolved | Medium |
| P0-2 | **Frontend scaffolding** | Initialize Next.js app in `apps/web` with App Router, Tailwind CSS, and shadcn/ui. Configure theme (dark/light), base layout component, and font loading. Add TanStack Query provider. Create placeholder pages: `/`, `/tasks`, `/chat`, `/decisions`, `/voice`. | Fry | P0-1 | Medium |
| P0-3 | **Backend scaffolding** | Initialize Fastify server in `apps/api` with TypeScript. Set up route plugin structure, CORS config, health-check endpoint (`GET /health`), request logging (pino), and graceful shutdown. Add dotenv for config management. | Bender | P0-1 | Medium |
| P0-4 | **Shared types package** | Create `packages/shared` with TypeScript interfaces for: Agent, Task, Decision, ChatMessage, ActivityEvent, SquadConfig. These types are the contract between frontend and backend. Also export constants (task statuses, priorities, agent roles). | Leela | P0-1 | Small |
| P0-5 | **CI/CD pipeline** | GitHub Actions workflows: `ci.yml` — lint + typecheck + test on PR. `build.yml` — build both apps on merge to main. Set up Turborepo caching in CI. Add `.nvmrc` for Node version pinning. | Bender | P0-1 | Small |
| P0-6 | **Dev environment setup** | Document dev setup in `README.md`: prerequisites (Node 20+, pnpm), install steps, environment variables, how to run both apps. Create `.env.example` files. Add `concurrently` or Turborepo `dev` task to run web + api together. | Leela | P0-1, P0-2, P0-3 | Small |
| P0-7 | **Linting and formatting** | Configure ESLint (flat config) with TypeScript rules, Prettier, and lint-staged + Husky for pre-commit hooks. Shared config across all packages. | Zoidberg | P0-1 | Small |

### Phase 0 Exit Criteria

- [ ] `pnpm dev` starts both web and API servers
- [ ] `pnpm build` produces production builds with no errors
- [ ] `pnpm lint` and `pnpm typecheck` pass
- [ ] CI pipeline runs on a test PR
- [ ] Shared types importable from both apps
- [ ] Health check endpoint returns 200

---

## Phase 1 — Core Data Layer

> The backend that reads `.squad/` files and serves data to the frontend. Foundation for all features.

### Open Decisions to Resolve

| Decision | Reference | Recommendation | Must Resolve By |
|----------|-----------|----------------|-----------------|
| Task ↔ `.squad/` file mapping | D4 | Design a `tasks/` directory in `.squad/` with one YAML/MD file per task, or extend existing structures. Needs a schema spec. | Before P1-3 |
| Chat persistence | D7 | **Both**: SQLite for fast queries + markdown in `.squad/sessions/` for squad memory. Chat writes to both. | Before P3 (can defer from P1) |

### Work Items

| ID | Title | Description | Agent | Depends On | Complexity |
|----|-------|-------------|-------|------------|------------|
| P1-1 | **`.squad/` file parser** | Build a service that parses the `.squad/` directory: `team.md` → agent list, `decisions.md` → decision list, `agents/*/charter.md` → agent details, `agents/*/history.md` → agent history, `config.json` → squad config. Use a consistent parser pattern (read file → parse markdown/JSON → return typed object). Handle missing/malformed files gracefully. | Bender | P0-3, P0-4 | Large |
| P1-2 | **File watcher service** | Use `chokidar` to watch the `.squad/` directory for changes. When files change, re-parse affected data and emit typed events (e.g., `agent:updated`, `task:created`, `decision:added`). Include debouncing (100ms) and a polling fallback for unreliable FS watchers. Maintain an in-memory cache of current state. | Bender | P1-1 | Medium |
| P1-3 | **Task data model + file format** | Design and implement the task file format for `.squad/`. Proposed: `tasks/` directory with YAML frontmatter + markdown body per task. Fields: id, title, status, priority, assignee, labels, created, updated. Write parser and serializer. Create CRUD operations that read/write these files. Requires resolving D4. | Bender + Leela | P1-1, D4 resolved | Large |
| P1-4 | **REST API — agents** | Endpoints: `GET /api/agents` (list all agents with status), `GET /api/agents/:id` (agent detail with charter, history, current task). Data comes from the file parser. Include proper error handling and typed responses using shared types. | Bender | P1-1 | Medium |
| P1-5 | **REST API — tasks** | Endpoints: `GET /api/tasks` (list with filters: status, assignee, priority), `GET /api/tasks/:id` (detail), `POST /api/tasks` (create), `PUT /api/tasks/:id` (update), `PATCH /api/tasks/:id/status` (status change), `PATCH /api/tasks/:id/priority` (reorder). All operations write to `.squad/` task files. | Bender | P1-3 | Medium |
| P1-6 | **REST API — decisions** | Endpoints: `GET /api/decisions` (list, newest first), `GET /api/decisions/:id` (detail), `GET /api/decisions/search?q=` (full-text search). Read from `decisions.md` and `decisions/inbox/`. | Bender | P1-1 | Small |
| P1-7 | **REST API — squad overview** | Endpoint: `GET /api/squad` — returns a composite summary: total agents, active count, task counts by status, recent decisions count, recent failures. Aggregates data from other parsers. Used by the dashboard. | Bender | P1-4, P1-5, P1-6 | Small |
| P1-8 | **SQLite index layer** | Set up SQLite (via `better-sqlite3`) as a read-through cache. Index tasks, decisions, and chat messages for fast search and filtering. Build sync logic: on startup, full index from `.squad/`; on file change, incremental update. SQLite is the cache; `.squad/` is the source of truth. | Bender | P1-1, P1-3 | Medium |
| P1-9 | **API integration tests** | Write integration tests for all REST endpoints using `vitest` + `supertest`. Test against a fixture `.squad/` directory (copy of real structure with test data). Cover: happy paths, missing files, malformed data, concurrent writes. | Zoidberg | P1-4, P1-5, P1-6, P1-7 | Medium |

### Phase 1 Exit Criteria

- [ ] All REST endpoints return correctly typed data from a real `.squad/` directory
- [ ] File watcher detects changes and updates in-memory state within 500ms
- [ ] Integration tests pass with >80% coverage on API routes
- [ ] Task CRUD operations correctly read/write `.squad/` task files
- [ ] SQLite index stays in sync with file system

---

## Phase 2 — Dashboard + Task Board

> The two most visible features. They share UI infrastructure (component library, layout, routing) so they build together.

### Work Items

| ID | Title | Description | Agent | Depends On | Complexity |
|----|-------|-------------|-------|------------|------------|
| P2-1 | **UI component library** | Set up shadcn/ui components needed across the app: Card, Button, Badge, Dialog, DropdownMenu, Input, Textarea, Select, Table, Tabs, Avatar, Skeleton (loading states). Configure consistent theming and dark mode support. Build a storybook-lite preview page at `/dev/components` for visual QA. | Fry | P0-2 | Medium |
| P2-2 | **App shell + navigation** | Build the main layout: sidebar navigation (Dashboard, Tasks, Chat, Voice, Decisions), top bar (squad name, user avatar, notifications bell), responsive mobile drawer. Use Next.js App Router layouts. Wire up TanStack Query for global data fetching config. | Fry | P2-1 | Medium |
| P2-3 | **Dashboard — agent cards** | Fetch agents from `GET /api/agents`. Display a grid of agent cards showing: avatar/icon, name, role, status badge (active/idle/spawned/failed with color coding), current task title, expertise tags. Cards link to agent detail. Include skeleton loading state. | Fry | P2-2, P1-4 | Medium |
| P2-4 | **Dashboard — summary stats** | Fetch from `GET /api/squad`. Display summary cards at the top: tasks in progress, tasks completed today, pending decisions, recent failures. Use animated number transitions. Auto-refresh every 30 seconds (will become real-time in Phase 3). | Fry | P2-2, P1-7 | Small |
| P2-5 | **Task board — Kanban view** | Fetch from `GET /api/tasks`. Display tasks in columns: Backlog, In Progress, In Review, Done, Blocked. Each task card shows title, assignee avatar, priority badge (P0–P3 with color), labels. Implement drag-and-drop between columns using `dnd-kit` to update task status via `PATCH /api/tasks/:id/status`. | Fry | P2-2, P1-5 | Large |
| P2-6 | **Task board — list view** | Alternate view: sortable, filterable table of all tasks. Columns: title, status, assignee, priority, labels, updated date. Filters in a toolbar: status dropdown, assignee dropdown, priority dropdown, text search. Toggle between board and list view. | Fry | P2-5 | Medium |
| P2-7 | **Task board — create/edit** | Modal dialog for creating and editing tasks. Fields: title (required), description (markdown editor with preview), assignee (agent selector), priority (P0–P3 dropdown), labels (tag input), due date (date picker, optional). On submit, `POST /api/tasks` or `PUT /api/tasks/:id`. Optimistic UI updates via TanStack Query mutation. | Fry | P2-5, P1-5 | Medium |
| P2-8 | **Task board — drag priority ranking** | Within a single column/priority level, allow drag-and-drop to reorder tasks. The ranked order maps to a sort index persisted via `PATCH /api/tasks/:id/priority`. Visual feedback during drag. Persist order immediately on drop. | Fry | P2-5 | Medium |
| P2-9 | **Task detail view** | Route: `/tasks/:id`. Full task detail page showing: title, description (rendered markdown), status, assignee, priority, labels, created/updated timestamps, activity log (status changes, comments). Include inline status change and reassignment controls. | Fry | P2-5, P1-5 | Medium |
| P2-10 | **Frontend unit + component tests** | Write tests for all Phase 2 components using Vitest + React Testing Library. Test: agent card rendering, task board drag-and-drop, create/edit form validation, filter logic, loading/error states. | Zoidberg | P2-3 through P2-9 | Medium |

### Phase 2 Exit Criteria

- [ ] Dashboard shows live agent data from the API
- [ ] Task board supports drag-and-drop status changes
- [ ] Tasks can be created, edited, and filtered
- [ ] All views have loading and error states
- [ ] Component tests pass

---

## Phase 3 — Real-time + Chat

> WebSocket server, live activity feed, chat interface. These make the app feel alive.

### Open Decisions to Resolve

| Decision | Reference | Recommendation | Must Resolve By |
|----------|-----------|----------------|-----------------|
| Chat persistence | D7 | **Both**: SQLite for fast queries, markdown logs in `.squad/sessions/` for agent memory. Dual-write on every message. | Before P3-4 |

### Work Items

| ID | Title | Description | Agent | Depends On | Complexity |
|----|-------|-------------|-------|------------|------------|
| P3-1 | **WebSocket server** | Add WebSocket support to Fastify (via `@fastify/websocket`). Define event protocol: `{ type: string, payload: object, timestamp: string }`. Event types: `agent:status`, `task:updated`, `task:created`, `decision:added`, `activity:new`, `chat:message`. Handle connection lifecycle: authenticate on upgrade, heartbeat/ping-pong, clean disconnect. | Bender | P0-3, P1-2 | Medium |
| P3-2 | **Bridge file watcher → WebSocket** | Connect the file watcher (P1-2) to the WebSocket server. When `.squad/` files change, emit appropriate events to all connected clients. Throttle rapid changes (batch events within 200ms window). Include event filtering so clients can subscribe to specific event types. | Bender | P3-1, P1-2 | Medium |
| P3-3 | **Activity feed — backend** | Create an in-memory ring buffer (last 500 events) of agent activity events. Source from: file watcher changes, orchestration log parsing (`.squad/orchestration-log/`), and session log parsing (`.squad/sessions/`). Expose `GET /api/activity` (paginated history) and stream new events via WebSocket `activity:new`. | Bender | P3-1, P1-1 | Medium |
| P3-4 | **Chat backend** | REST endpoints: `POST /api/chat/messages` (send message to agent or team), `GET /api/chat/messages` (history with pagination and agent filter). Message model: id, sender (user or agent ID), recipient (agent ID or "team"), content (markdown), timestamp, thread_id (optional). Persist to SQLite + `.squad/sessions/` markdown log. Route team messages to Coordinator logic. Emit `chat:message` via WebSocket. | Bender | P3-1, P1-8, D7 resolved | Large |
| P3-5 | **Activity feed — frontend** | Sidebar or dedicated panel showing a chronological stream of activity events via WebSocket. Each event entry: timestamp, agent avatar, event description, event type icon (started task, made decision, error, etc.). New events animate in at the top. Virtual scrolling for performance. Click an event to navigate to the related entity. | Fry | P3-2, P2-2 | Medium |
| P3-6 | **Real-time dashboard updates** | Replace the 30-second polling in P2-3 and P2-4 with WebSocket-driven updates. When `agent:status` or `task:updated` events arrive, update the TanStack Query cache directly. Agent cards and summary stats update instantly. Add subtle animation on data change (pulse on status change). | Fry | P3-2, P2-3, P2-4 | Small |
| P3-7 | **Chat frontend** | Route: `/chat`. Two-panel layout: agent list sidebar (DM channels + team channel), message area. Message input with markdown support (bold, code, links). Display messages with sender avatar, name, timestamp. Typing indicator when agent is processing. Scroll-to-bottom on new messages. Support thread replies (click to open thread panel). Send via `POST /api/chat/messages`, receive via WebSocket `chat:message`. | Fry | P3-4, P2-1, P2-2 | Large |
| P3-8 | **Notification system** | In-app notification bell with dropdown. Surface critical events: task failures, blocked tasks, decisions needing human input. Badge count on bell icon. Mark as read. Notifications sourced from WebSocket events with severity filtering. Store notification state in local storage. | Fry | P3-2, P2-2 | Medium |
| P3-9 | **Real-time integration tests** | Test WebSocket connection, event delivery, reconnection on disconnect, and chat message round-trip. Test file change → WebSocket event latency (<3 seconds). Test concurrent connections. | Zoidberg | P3-1 through P3-8 | Medium |

### Phase 3 Exit Criteria

- [ ] File changes in `.squad/` appear as WebSocket events within 3 seconds
- [ ] Activity feed shows live agent events
- [ ] Chat messages can be sent and received in real-time
- [ ] Dashboard updates without page refresh
- [ ] WebSocket reconnects gracefully after disconnect

---

## Phase 4 — Voice Interface

> The differentiator. STT → Agent → TTS pipeline. Depends on chat being functional (voice is spoken chat).

### Open Decisions to Resolve

| Decision | Reference | Recommendation | Must Resolve By |
|----------|-----------|----------------|-----------------|
| Voice service provider | D3 | **OpenAI Whisper API (STT) + OpenAI TTS (TTS)** — high quality, simple API, consistent provider. | Before P4-1 |
| Voice latency handling | D6 | **Stream TTS output** — send audio chunks as they're generated, show text transcript simultaneously. Push-to-talk first, VAD later. | Before P4-3 |

### Work Items

| ID | Title | Description | Agent | Depends On | Complexity |
|----|-------|-------------|-------|------------|------------|
| P4-1 | **STT integration (backend)** | Create `POST /api/voice/transcribe` endpoint. Accept audio blob (WebM/Opus from browser MediaRecorder), forward to OpenAI Whisper API, return transcript text. Handle errors (empty audio, API failures) gracefully. Include language detection. Config for API keys via env vars. | Bender | P0-3, D3 resolved | Medium |
| P4-2 | **TTS integration (backend)** | Create `POST /api/voice/synthesize` endpoint. Accept text + agent ID, select the appropriate OpenAI TTS voice for that agent (e.g., Leela=`nova`, Fry=`echo`, Bender=`onyx`, Zoidberg=`shimmer`). Return audio stream (MP3/Opus). Support streaming response so audio starts playing before full generation completes. | Bender | P0-3, D3 resolved | Medium |
| P4-3 | **Voice pipeline orchestration** | Create `POST /api/voice/converse` endpoint that orchestrates the full pipeline: receive audio → transcribe (STT) → route to agent (reuse chat message handling from P3-4) → get response text → synthesize (TTS) → return audio + text. Support streaming: return text immediately, stream audio as it generates. Maintain conversation context per session. | Bender | P4-1, P4-2, P3-4 | Large |
| P4-4 | **Voice UI — push-to-talk** | Route: `/voice`. Build the voice interaction interface. Push-to-talk button: hold to record (using MediaRecorder API), release to send. Visual feedback: waveform animation while recording, "processing" spinner during transcription, text transcript appearing in real-time, audio playback of agent response. Agent avatar and name shown with response. | Fry | P4-3, P2-1 | Large |
| P4-5 | **Voice UI — conversation view** | Display the voice conversation as a chat-like transcript: user messages (with "spoken" indicator), agent responses (text + play button to re-hear audio). Maintain session context — follow-up questions work without re-stating context. Agent selector dropdown to direct voice to a specific agent or "team". | Fry | P4-4 | Medium |
| P4-6 | **Per-agent voice profiles** | Configure distinct voice characteristics per agent. Map agent IDs to OpenAI TTS voice names and parameters (speed, pitch adjustments where supported). Display agent avatar with speaking animation during TTS playback. Test that users can distinguish agents by voice. | Fry + Bender | P4-2 | Small |
| P4-7 | **Voice command parsing** | Enhance the agent router to recognize common voice directives: "What's the status?" → squad summary, "What are you working on?" → current task, "Prioritize X above Y" → task reorder, "Assign X to Y" → task assignment. Map recognized intents to existing API operations. Respond with confirmation + result. | Bender | P4-3, P1-5 | Medium |
| P4-8 | **Voice pipeline tests** | Test full STT → Agent → TTS round-trip. Test error cases: empty audio, API timeout, unsupported format. Test latency: measure time from audio submission to first audio byte returned. Test agent voice differentiation. Test voice commands trigger correct API operations. | Zoidberg | P4-1 through P4-7 | Medium |

### Phase 4 Exit Criteria

- [ ] User can speak and get a spoken response within 5 seconds
- [ ] Each agent has a distinguishable voice
- [ ] Voice commands trigger correct actions (status, assign, prioritize)
- [ ] Conversation context is maintained across turns
- [ ] Text transcript is always available alongside audio

---

## Phase 5 — Decision Log + Polish

> Final features, cross-cutting polish, auth hardening, and deployment readiness.

### Work Items

| ID | Title | Description | Agent | Depends On | Complexity |
|----|-------|-------------|-------|------------|------------|
| P5-1 | **Decision browser** | Route: `/decisions`. List view of all decisions (newest first) with: title, author (agent), date, status badge (active/superseded/reversed). Click to open detail view with full rationale, affected files/tasks, and linked context. Source data from `GET /api/decisions`. | Fry | P2-2, P1-6 | Medium |
| P5-2 | **Decision search** | Full-text search bar on the decisions page. Search across titles and content. Use `GET /api/decisions/search?q=`. Highlight matching text in results. Filter by: agent, date range, status. Debounced search input (300ms). | Fry | P5-1 | Small |
| P5-3 | **Auth implementation** | Integrate NextAuth.js (Auth.js) with GitHub OAuth. Protect all API routes — reject unauthenticated requests with 401. Protect WebSocket upgrade — validate token on connection. Add user context to the app shell (avatar, name, sign out). Simple role model: Owner (full access), Viewer (read-only). Skip auth when `NODE_ENV=development` and `AUTH_DISABLED=true`. | Bender + Fry | P2-2, P3-1, D5 resolved | Medium |
| P5-4 | **Error handling + resilience** | Global error boundary in React with friendly error UI. API error responses standardized: `{ error: string, code: string, details?: object }`. Retry logic in TanStack Query (3 retries with backoff for network errors). WebSocket auto-reconnect with exponential backoff. Graceful degradation when `.squad/` files are missing. | Fry + Bender | P2-2, P3-1 | Medium |
| P5-5 | **Loading + empty states** | Skeleton loading components for every data view (dashboard, tasks, chat, decisions). Empty state illustrations and messages: "No tasks yet — create your first task", "No decisions recorded", "No activity to show". Loading spinners for async operations (create, update, voice). | Fry | P2-1 | Small |
| P5-6 | **Responsive design** | Ensure all views work on tablet (768px+). Sidebar collapses to drawer. Task board scrolls horizontally. Chat adapts to single-panel on narrow screens. Voice interface works on mobile browsers (mic permissions). Test on Chrome, Firefox, Edge, Safari. | Fry | All P2, P3, P4 items | Medium |
| P5-7 | **Deployment configuration** | Dockerfiles for web and api. `docker-compose.yml` for local deployment. Production config: environment variables, `.squad/` volume mount, SQLite data persistence. Health check endpoints. Document deployment options: single VPS (recommended for v1), Vercel + VM split. | Bender | All prior phases | Medium |
| P5-8 | **E2E tests** | End-to-end tests using Playwright. Critical user journeys: open dashboard → see agents, create task → appears on board, drag task → status changes, send chat message → get response, open decisions → search. Run against the full stack (web + api + fixture `.squad/`). | Zoidberg | All prior phases | Large |
| P5-9 | **Performance audit** | Measure and optimize: initial page load (<3s), time to interactive (<5s), WebSocket event latency (<3s), voice round-trip (<5s). Bundle analysis — ensure tree-shaking, lazy-load routes. Lighthouse score >90 for performance. Fix any identified bottlenecks. | Zoidberg + Fry | All prior phases | Medium |
| P5-10 | **Documentation** | Final `README.md` with: project overview, screenshots, setup guide, architecture overview, API reference (brief), deployment guide, contributing guide. Update `docs/prd.md` status to "Implemented". | Leela | All prior phases | Small |

### Phase 5 Exit Criteria

- [ ] All six PRD features are functional and tested
- [ ] Auth protects all routes in production mode
- [ ] E2E tests pass for all critical user journeys
- [ ] App deploys via Docker with a single command
- [ ] Documentation is complete and accurate

---

## Agent Assignment Summary

| Agent | Primary Responsibilities | Phase Load |
|-------|-------------------------|------------|
| **Leela** | Architecture decisions, shared types, code review, documentation, scope management | P0: 2 items · P1: 1 item · P5: 1 item + review all |
| **Fry** | All frontend work — UI components, pages, interactions, voice UI | P0: 1 item · P2: 8 items · P3: 4 items · P4: 3 items · P5: 5 items |
| **Bender** | All backend work — API, file parsing, WebSocket, voice pipeline, infra | P0: 3 items · P1: 8 items · P3: 4 items · P4: 4 items · P5: 2 items |
| **Zoidberg** | Testing at every phase — unit, integration, E2E, performance | P0: 1 item · P1: 1 item · P2: 1 item · P3: 1 item · P4: 1 item · P5: 2 items |

---

## Decision Resolution Schedule

Decisions must be resolved before the work items that depend on them:

| Decision | Reference | Blocks | Resolve By |
|----------|-----------|--------|------------|
| D1 — Monorepo vs multi-repo | PRD §8 | P0-1 (all of Phase 0) | **Immediately** (start of P0) |
| D2 — Backend framework | PRD §8 | P0-1, P0-3 | **Immediately** (start of P0) |
| D5 — Auth strategy | PRD §8 | P5-3 (can defer to Phase 5) | Before Phase 5 |
| D4 — Task file format | PRD §8 | P1-3 (task data model) | Before P1-3 starts |
| D7 — Chat persistence | PRD §8 | P3-4 (chat backend) | Before P3-4 starts |
| D3 — Voice service provider | PRD §8 | P4-1, P4-2 | Before Phase 4 |
| D6 — Voice latency handling | PRD §8 | P4-3 (voice pipeline) | Before P4-3 starts |

---

## Complexity Summary

| Complexity | Count | Estimated Sessions |
|------------|-------|--------------------|
| Small (1 session) | 12 items | 12 |
| Medium (2–3 sessions) | 25 items | 50–75 |
| Large (4+ sessions) | 6 items | 24+ |
| **Total** | **43 items** | **~25–32 sessions** (with parallelism) |

*Note: Sessions overlap because Fry and Bender work in parallel. The 25–32 estimate is wall-clock time, not sum of all sessions.*

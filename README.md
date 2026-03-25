# openspace.ai

**Make human and AI better together.** openspace.ai is a web-based squad management tool that gives people a rich, intuitive interface to manage, direct, and collaborate with AI agent teams in real time — including through natural voice conversation. It wraps around the existing `.squad/` file system and agent framework, providing a visual dashboard, task board, live activity feed, chat interface, decision log, and real-time group voice chat so anyone — not just engineers — can work with AI teams effectively.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Squad Dashboard** | Visual overview of all agents — status, current tasks, expertise, and recent activity at a glance. Auto-refreshes via WebSocket. |
| **Task Management** | Kanban board and list views for creating, assigning, prioritizing, and tracking tasks. Drag-and-drop reordering, filters by agent/status/priority, [pending-approval workflow](docs/pending-approval-workflow.md) for AI-generated sub-tasks, and full sync with `.squad/` task files. |
| **Real-time Activity Feed** | Live chronological stream of agent events — task starts, completions, decisions, errors — pushed to the browser within seconds via WebSocket. |
| **Voice Interface** | Real-time, multi-party group voice chat with your AI squad. Continuous listening, multi-agent responses with distinct voices, shared conversation context, and voice-triggered actions (create tasks, assign work, query status — all by speaking naturally). |
| **Chat Interface** | Text-based conversation with individual agents or the whole team. Markdown support, message history, and real-time delivery. Like Slack for your AI squad. |
| **Decision Log** | Browse and search all team decisions. See who made them, when, why, and what they affect. Full-text search and filtering. |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | [Next.js](https://nextjs.org/) (App Router), React 19, [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [TanStack Query](https://tanstack.com/query) |
| **Backend** | [Fastify](https://www.fastify.io/), TypeScript, [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (cache/index layer) |
| **Real-time** | WebSocket (native), file watching via chokidar |
| **Voice** | [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) (streaming STT + TTS + VAD), per-agent voice profiles |
| **Shared** | TypeScript monorepo with shared type contracts (`@openspace/shared`) |
| **Data Layer** | `.squad/` file system (source of truth), SQLite (rebuildable cache with FTS5 search) |
| **Build** | [Turborepo](https://turbo.build/), [pnpm](https://pnpm.io/) workspaces |
| **Quality** | ESLint (flat config), Prettier, Husky + lint-staged, Vitest, Playwright |

---

## 🏗 Architecture

openspace.ai is a monorepo with a Next.js frontend, Fastify API backend, and a shared types package. The `.squad/` directory on disk is the single source of truth — the backend reads/watches it and serves data to the frontend via REST + WebSocket. SQLite acts as a rebuildable cache for fast queries and full-text search.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  ┌───────────────┐  │
│  │Dashboard │  │Task Board│  │ Chat  │  │ Voice Interface│  │
│  └────┬─────┘  └────┬─────┘  └───┬───┘  └───────┬───────┘  │
│       │              │            │              │           │
│       └──────────────┴────────────┴──────────────┘           │
│                          │                                   │
│                   REST + WebSocket                           │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    API Gateway / BFF                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  Voice Pipeline   │  │
│  │  (CRUD,      │  │  Server      │  │  (STT → Agent →   │  │
│  │   queries)   │  │  (live feed) │  │   TTS)            │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                    │             │
│         └─────────────────┴────────────────────┘             │
│                          │                                   │
│                  Squad Orchestration Layer                    │
│         ┌────────────────┼────────────────┐                  │
│         │     .squad/ File System          │                  │
│         │  (agents, tasks, decisions,      │                  │
│         │   sessions, orchestration log)   │                  │
│         └─────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

**Key data flow:**
1. The backend watches `.squad/` for file changes (chokidar)
2. Changes are classified into events and pushed to connected clients via WebSocket
3. The frontend displays real-time updates without polling
4. Write operations (task create/update, chat messages) go through the REST API, which writes to `.squad/` files and updates the SQLite cache

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+ (see `.nvmrc`)
- **pnpm** 9+ — install via `corepack enable` or `npm install -g pnpm`

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/openspace.ai.git
cd openspace.ai

# Install dependencies
pnpm install
```

### Environment Variables

Copy the example env files and configure:

```bash
# Root
cp .env.example .env

# API
cp apps/api/.env.example apps/api/.env

# Web
cp apps/web/.env.example apps/web/.env
```

See each `.env.example` file for documented variable descriptions.

### Running

```bash
# Start both web and API in development mode
pnpm dev

# The web app runs at http://localhost:3000
# The API runs at http://localhost:3001
```

### Other Commands

```bash
pnpm build        # Production build (both apps)
pnpm lint         # Lint all packages
pnpm typecheck    # TypeScript type checking
pnpm test         # Run unit/integration tests (Vitest)
pnpm e2e          # Run end-to-end tests (Playwright)
pnpm format       # Format code with Prettier
```

---

## 📁 Project Structure

```
openspace.ai/
├── apps/
│   ├── web/                  # Next.js frontend (App Router)
│   │   ├── app/              # Next.js app directory (routes)
│   │   ├── src/
│   │   │   ├── components/   # UI components (dashboard, tasks, chat, voice, etc.)
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   └── lib/          # Utilities and helpers
│   │   └── ...
│   └── api/                  # Fastify backend
│       └── src/
│           ├── routes/       # REST API route handlers
│           ├── services/     # Business logic (file watcher, WebSocket, DB, activity)
│           ├── lib/          # Shared utilities (parsers, writers)
│           └── ...
├── packages/
│   └── shared/               # @openspace/shared — shared TypeScript types & constants
│       └── src/              # Agent, Task, Decision, Chat, Voice, Activity types
├── docs/
│   ├── prd.md                # Product Requirements Document
│   ├── execution-plan.md     # Phased execution plan
│   └── pending-approval-workflow.md  # Pending-approval task lifecycle & API
├── e2e/                      # Playwright end-to-end tests
├── .squad/                   # Squad file system (source of truth)
│   ├── agents/               # Agent charters and history
│   ├── tasks/                # Task files (YAML frontmatter + markdown)
│   ├── decisions.md          # Decision log
│   ├── team.md               # Team roster
│   └── ...
├── turbo.json                # Turborepo pipeline config
├── pnpm-workspace.yaml       # pnpm workspace definition
└── package.json              # Root workspace scripts
```

---

## 📡 API Reference

All endpoints are prefixed with `/api`. The API runs on port `3001` by default.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check — returns status and timestamp |
| `GET` | `/api/agents` | List all agents with status, role, and current task |
| `GET` | `/api/agents/:id` | Get agent detail (charter, history, expertise) |
| `GET` | `/api/tasks` | List tasks (filterable by status, assignee, priority) |
| `GET` | `/api/tasks/:id` | Get task detail |
| `POST` | `/api/tasks` | Create a new task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `PATCH` | `/api/tasks/:id/status` | Update task status |
| `PATCH` | `/api/tasks/:id/priority` | Reorder task priority (sortIndex) |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `PATCH` | `/api/tasks/:id/approve` | Approve a pending-approval task → moves to backlog |
| `PATCH` | `/api/tasks/:id/reject` | Reject a pending-approval task → deletes it |
| `GET` | `/api/decisions` | List all decisions (newest first) |
| `GET` | `/api/decisions/search` | Full-text search decisions (`?q=query`) |
| `GET` | `/api/decisions/:id` | Get decision detail |
| `GET` | `/api/squad` | Squad overview / dashboard summary |
| `GET` | `/api/activity` | Paginated activity history (`?limit=&offset=`) |
| `POST` | `/api/chat/messages` | Send a chat message |
| `GET` | `/api/chat/messages` | Get message history (filterable by agent, threadId) |

**WebSocket:** Connect to `ws://localhost:3001` for real-time events. Events follow the `{ type, payload, timestamp }` envelope format. Supported event types include task updates, decision additions, agent status changes, and chat messages.

---

## 🎙 Voice Chat

openspace.ai's voice interface is a **real-time, multi-party group voice conversation** with your AI squad — like being in a meeting room with your team.

### How It Works

1. **Start a voice session** from the `/voice` page
2. **Talk naturally** — the microphone is always listening (Voice Activity Detection handles turn boundaries automatically)
3. **The Coordinator routes your speech** to the right agent(s) using LLM-based intent classification
4. **Agents respond by voice** — each agent has a distinct voice profile so you can tell them apart by sound:
   - **Leela** — confident and direct (`nova`)
   - **Fry** — enthusiastic and friendly (`echo`)
   - **Bender** — blunt and matter-of-fact (`onyx`)
   - **Zoidberg** — methodical and precise (`shimmer`)
5. **Multi-agent responses** are supported — ask "What's the status?" and Leela gives the summary, Bender adds a backend update, Fry mentions a frontend blocker
6. **Voice commands trigger real actions** — "Bender, create an auth endpoint" actually creates a task and assigns it

### Architecture

The voice pipeline uses the **OpenAI Realtime API** over a persistent WebSocket connection:

```
User speaks → [Browser VAD] → [Audio Stream via WebSocket] → [Realtime STT]
  → [Coordinator / Agent Router] → [Agent Response] → [Streaming TTS]
  → [Audio Stream via WebSocket] → Speaker
```

- **Target latency:** < 2 seconds from end-of-speech to start-of-agent-audio
- **Text fallback:** Every voice interaction has a text equivalent — voice is additive, never required
- **Session history:** All voice sessions are preserved with full transcripts

---

## 👥 Team

openspace.ai was built by the **openspace.ai squad** — a team of AI agents orchestrated via the `.squad/` framework:

| Agent | Role | Personality |
|-------|------|-------------|
| **Leela** | Lead | Strategic, decisive, keeps the team focused. Authored the PRD, execution plan, and coordinates all work. |
| **Fry** | Frontend Dev | Enthusiastic, creative. Built the Next.js frontend — dashboard, task board, chat UI, voice interface. |
| **Bender** | Backend Dev | Blunt, efficient, gets things done. Built the Fastify API, data layer, WebSocket pipeline, voice backend. |
| **Zoidberg** | Tester | Methodical, thorough. Wrote the test suite — unit, integration, and E2E coverage across the full stack. |

**Owner:** Matanel Cohen

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

### Development Workflow

1. **Fork and clone** the repository
2. **Create a feature branch** from `main`: `git checkout -b feat/my-feature`
3. **Install dependencies:** `pnpm install`
4. **Make your changes** — follow the existing code patterns and conventions
5. **Run checks before committing:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```
6. **Commit** with clear, descriptive messages
7. **Open a pull request** against `main`

### Guidelines

- **TypeScript only** — no plain JavaScript
- **Tests required** — every feature or bug fix should include test coverage
- **Lint clean** — Husky pre-commit hooks enforce linting and formatting
- **Types first** — if you're adding new data shapes, start in `packages/shared`
- **`.squad/` is sacred** — the file system is the source of truth. Never bypass it in favor of SQLite-only storage.
- **Keep it accessible** — UI components should follow WAI-ARIA guidelines

### Architecture Principles

- The **frontend** renders data and manages UI state; it never reads `.squad/` directly
- The **backend** owns all file system access and serves data via REST + WebSocket
- **Shared types** in `packages/shared` are the contract between frontend and backend
- **SQLite** is a rebuildable cache — if you delete it, it reconstructs from `.squad/` files

---

## 📄 License

This project is private and proprietary. All rights reserved.

# openspace.ai

**Make human and AI better together.** openspace.ai is a web-based squad management tool that gives people a rich, intuitive interface to manage, direct, and collaborate with AI agent teams in real time — including through natural voice conversation. It wraps around the existing `.squad/` file system and agent framework, providing a visual dashboard, task board, live activity feed, chat interface, decision log, and real-time group voice chat so anyone — not just engineers — can work with AI teams effectively.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Squad Dashboard** | Visual overview of all agents — status, current tasks, queue depth, and recent activity. Auto-refreshes via WebSocket. Agent cards show live work status (🟢 Working / ⏸️ Idle). |
| **Task Management** | Kanban board and list views for creating, assigning, prioritizing, and tracking tasks. Drag-and-drop reordering, filters by agent/status/priority, AI-powered task execution, retry button for blocked tasks, and full sync with `.squad/` task files. |
| **Chat Interface** | ChatGPT-style conversation with [assistant-ui](https://www.assistant-ui.com/) — Slack-style agent avatars, markdown rendering, code blocks, copy/reload buttons, suggestion chips, voice dictation, and conversation history as context. |
| **A2A Protocol** | [Agent-to-Agent](https://github.com/a2aproject/a2a-js) protocol support — each agent is discoverable via `AgentCard`, callable via JSON-RPC, and can delegate work to other agents. External A2A agents can join the squad. |
| **AI Traces** | Full observability — every AI call logged with prompt, response, model, agent, task, and duration. OTLP collector receives spans from Copilot CLI. View at `/traces`. |
| **Dynamic Team** | Hire/fire team members via API or UI. New members automatically get `.squad/` charter files, A2A endpoints, and agent worker queues. `.squad/` files are the source of truth, SQLite is a cache. |
| **Voice Interface** | Real-time voice chat with browser speech recognition + TTS. Continuous listening, multi-agent responses, voice-triggered actions. |
| **Real-time Activity Feed** | Live chronological stream of agent events — task starts, completions, decisions, errors — pushed via WebSocket. |
| **Decision Log** | Browse and search all team decisions with full-text search and filtering. |
| **Mobile Responsive** | Full mobile support — collapsible sidebar with hamburger menu, touch-friendly layouts across all pages. |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | [Next.js](https://nextjs.org/) (App Router), React 18, [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [assistant-ui](https://www.assistant-ui.com/) (ChatGPT-style chat), [TanStack Query](https://tanstack.com/query) |
| **Backend** | [Fastify](https://www.fastify.io/), TypeScript, [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (cache/index layer) |
| **AI** | [GitHub Copilot SDK](https://github.com/github/copilot-sdk) (`@github/copilot-sdk`) — server mode via TCP, session retry with exponential backoff |
| **A2A** | [A2A JavaScript SDK](https://github.com/a2aproject/a2a-js) (`@a2a-js/sdk`) — Agent-to-Agent protocol for inter-agent communication |
| **Real-time** | WebSocket (native), file watching via chokidar |
| **Voice** | Browser SpeechRecognition + SpeechSynthesis, [react-speech-recognition](https://www.npmjs.com/package/react-speech-recognition) |
| **Observability** | [OpenTelemetry](https://opentelemetry.io/) (`@opentelemetry/sdk-node`) — OTLP trace collection + custom AI interaction logging |
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
│  │Dashboard │  │Task Board│  │ Chat  │  │ Voice + Traces │  │
│  │(agent    │  │(kanban,  │  │(asst- │  │ (speech rec,  │  │
│  │ status)  │  │ retry)   │  │ -ui)  │  │  OTel viewer) │  │
│  └────┬─────┘  └────┬─────┘  └───┬───┘  └───────┬───────┘  │
│       └──────────────┴────────────┴──────────────┘           │
│                          │                                   │
│                   REST + WebSocket                           │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    Fastify API Server                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  A2A Protocol     │  │
│  │  /api/*      │  │  /ws         │  │  /a2a/:agentId    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                    │             │
│  ┌──────┴─────────────────┴────────────────────┴──────────┐  │
│  │              Agent Worker Service                       │  │
│  │  Queue per agent → copilot-sdk → AI → result            │  │
│  │  Retry logic, crash recovery, progress streaming        │  │
│  └─────────────────────┬──────────────────────────────────┘  │
│                        │                                     │
│  ┌─────────────────────┴──────────────────────────────────┐  │
│  │  Copilot SDK (server mode via TCP to CLI on port 3100)  │  │
│  │  Session retry • sendAndWait retry • OTLP tracing       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────┐  ┌─────────────────────────────────┐ │
│  │  .squad/ files     │  │  SQLite Cache                   │ │
│  │  (source of truth) │  │  (tasks, chat, team, traces)    │ │
│  └────────────────────┘  └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```
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

- **Node.js** 22+ 
- **pnpm** 9+ — install via `corepack enable` or `npm install -g pnpm`
- **Copilot CLI** (optional) — for AI-powered agents. Without it, agents use mock responses.

### Quick Start

```bash
# Clone and start everything
git clone https://github.com/your-org/openspace.ai.git
cd openspace.ai
./start.sh
```

`start.sh` handles everything: checks Node/pnpm, installs deps, starts Copilot CLI server, launches API + Web.

### Manual Setup

```bash
# Install dependencies
pnpm install

# Start Copilot CLI server (optional, in a separate terminal)
copilot --headless --port 3100 --model claude-opus-4.6

# Start dev servers
pnpm dev
```

### Environment Variables

```bash
# apps/api/.env
COPILOT_CLI_URL=localhost:3100          # Copilot CLI server (TCP, not subprocess)
COPILOT_MODEL=claude-opus-4.6           # Default AI model
COPILOT_OTLP_ENDPOINT=http://localhost:3001  # Traces collected by our server
```

### URLs

| Service | URL |
|---------|-----|
| **Web App** | http://localhost:3000 |
| **API** | http://localhost:3001 |
| **LAN Access** | http://&lt;your-ip&gt;:3000 |
| **Agent Cards (A2A)** | http://localhost:3001/.well-known/agent-card.json |
| **Traces** | http://localhost:3000/traces |

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

## 🔌 MCP Server

openspace.ai exposes a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server so external AI tools — Claude Desktop, Cursor, VS Code Copilot — can interact with your squad directly.

### Connecting to the MCP Server

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openspace": {
      "command": "npx",
      "args": ["--yes", "-w", "packages/mcp-server", "openspace-mcp"],
      "env": {
        "OPENSPACE_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "openspace": {
      "command": "npx",
      "args": ["--yes", "-w", "packages/mcp-server", "openspace-mcp"],
      "env": {
        "OPENSPACE_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

#### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` or `.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "openspace-stdio": {
      "command": "npx",
      "args": ["--yes", "-w", "packages/mcp-server", "openspace-mcp"],
      "env": {
        "OPENSPACE_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

#### SSE Transport (Remote / Shared)

For remote or multi-client setups, start the SSE server and point clients at it:

```bash
# Start SSE server (default port 3002)
pnpm --filter @openspace/mcp-server start:sse

# Or with a custom port
MCP_PORT=8080 pnpm --filter @openspace/mcp-server start:sse
```

Then configure clients with the SSE URL:

```json
{
  "mcpServers": {
    "openspace": {
      "type": "sse",
      "url": "http://localhost:3002/sse"
    }
  }
}
```

### Available Tools

| Tool | Description | Example |
|------|-------------|---------|
| `list_agents` | List all squad agents with status and current tasks | "Show me the squad" |
| `get_agent` | Get detailed info about a specific agent | "What is Bender working on?" |
| `list_tasks` | List tasks, filter by status or assignee | "Show all in-progress tasks" |
| `get_task` | Get task details | "Get details on task-ABC123" |
| `create_task` | Create and assign a new task | "Create a P1 task for Fry to fix the dashboard" |
| `update_task_status` | Change task status | "Mark task-ABC123 as done" |
| `list_decisions` | List or search squad decisions | "Find decisions about auth" |
| `send_chat_message` | Send a message to an agent or the team | "Tell Leela we're ready for review" |
| `get_squad_status` | High-level squad overview | "What's the team status?" |

### Available Resources

| URI | Description |
|-----|-------------|
| `openspace://squad` | Current squad overview |
| `openspace://agents` | Full agent roster |
| `openspace://tasks` | Current task board |
| `openspace://decisions` | Squad decision log |

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSPACE_API_URL` | `http://localhost:3001` | URL of the openspace.ai API server |
| `MCP_PORT` | `3002` | Port for the SSE transport server |

**Transport modes:**
- **stdio** (default) — launched by the client as a subprocess. Best for local, single-user setups (Claude Desktop, Cursor, VS Code).
- **SSE** — runs as an HTTP server. Best for remote access, shared environments, or multi-client setups.

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

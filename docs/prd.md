# openspace.ai — Product Requirements Document

> **Version:** 1.0  
> **Author:** Leela (Lead)  
> **Date:** 2026-03-23  
> **Status:** Draft  
> **Owner:** Matanel Cohen

---

## Table of Contents

1. [Vision & Problem Statement](#1-vision--problem-statement)
2. [Target Users](#2-target-users)
3. [Core Features (MVP / v1)](#3-core-features-mvp--v1)
4. [Architecture Overview](#4-architecture-overview)
5. [Future Features (v2+)](#5-future-features-v2)
6. [Non-Goals (Out of Scope for v1)](#6-non-goals-out-of-scope-for-v1)
7. [Success Metrics](#7-success-metrics)
8. [Technical Constraints & Decisions Needed](#8-technical-constraints--decisions-needed)

---

## 1. Vision & Problem Statement

### Vision

**Make human and AI better together** — by giving people a rich, intuitive interface to manage, direct, and collaborate with AI agent teams in real time, including through natural voice conversation.

### The Problem

Today's AI agent orchestration tools (Squad, CrewAI, AutoGen, etc.) are **CLI-only, developer-centric, and opaque**. They work — but only for engineers comfortable in a terminal. This creates several gaps:

| Gap | Impact |
|-----|--------|
| **Visibility** | You can't see what agents are doing without reading log files or terminal output. There's no dashboard, no live feed, no status board. |
| **Accessibility** | Non-technical users (PMs, team leads, designers) can't participate in directing AI work. The CLI is a wall. |
| **Interaction** | Communicating with agents requires editing config files or typing structured commands. There's no natural conversation — and certainly no voice. |
| **Management** | Task prioritization, assignment, and tracking happen in markdown files or ad-hoc. There's no drag-and-drop, no filtering, no board view. |
| **Decision Transparency** | Agents make decisions that affect project direction, but these decisions are buried in files. There's no browsable, searchable log. |

### The Opportunity

openspace.ai bridges this gap. It's a **web-based squad management tool** that wraps around existing squad orchestration (the `.squad/` file system and agent framework) and provides:

- A **visual dashboard** so anyone can see squad status at a glance
- A **task board** so work can be created, prioritized, and tracked visually
- A **live activity feed** so you always know what agents are doing right now
- A **voice interface** so you can talk to your AI team like you would a human team — ask questions, give directives, run standups
- A **chat interface** for text-based conversation with agents
- A **decision log** so every team decision is browsable and searchable

The key insight: **the squad already exists and works.** openspace.ai doesn't replace the agent framework — it makes it usable by everyone.

---

## 2. Target Users

### Primary Users

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Developer (Squad Manager)** | Engineers who currently use Squad via CLI. They configure agents, assign work, and review output. | Faster overview, less context-switching, voice for quick status checks. |
| **Team Lead** | Technical leads who oversee multiple workstreams and need to direct priorities without diving into terminal output. | Dashboard visibility, priority management, decision history. |
| **Product Manager** | PMs who want to direct AI work at a high level — set priorities, understand progress, give feedback — without learning CLI tools. | Accessible UI, task management, voice interaction for directives. |

### Secondary Users

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Designer / Non-Technical Collaborator** | Contributors who interact with AI output but don't operate the orchestration layer. | Read-only views, chat for asking questions, voice for quick interactions. |
| **Executive / Stakeholder** | People who want a high-level view of what AI teams are producing. | Dashboard summaries, progress metrics, decision audit trail. |

### User Assumptions

- Users have a modern web browser (Chrome, Firefox, Edge, Safari)
- Users may or may not have technical backgrounds
- Users have microphone access for voice features (optional — all voice features have text fallbacks)
- The underlying Squad framework is already configured and running

---

## 3. Core Features (MVP / v1)

### 3.1 Squad Dashboard

**Purpose:** Visual overview of the team — who's on it, what they're working on, and how things are going.

**Requirements:**

- Display all squad members with their name, role, status (active, idle, spawned, failed), and current task
- Show a summary card for each agent with avatar/icon, expertise tags, and recent activity
- Global status indicators: tasks in progress, tasks completed today, pending decisions, recent failures
- Auto-refresh on a short interval or via real-time push (WebSocket/SSE)
- Responsive layout — usable on desktop and tablet

**User Stories:**

- *As a team lead, I want to open one page and immediately see what every agent is doing, so I don't have to check logs.*
- *As a PM, I want to see a high-level health indicator for the squad, so I know if things are on track.*

### 3.2 Task Management

**Purpose:** Create, assign, prioritize, and track tasks. The central hub for directing work.

**Requirements:**

- **Task Board View:** Kanban-style columns (Backlog, In Progress, In Review, Done, Blocked)
- **Task List View:** Sortable, filterable table of all tasks
- **Create Task:** Title, description (markdown), assignee (agent or unassigned), priority (P0–P3), labels/tags, due date (optional)
- **Drag-and-Drop Priority Ranking:** Within a priority level, drag tasks to reorder. The ranked order is what the squad respects.
- **Filters:** By agent, status, priority, label, date range
- **Task Detail View:** Full task description, activity log (comments, status changes, agent output), linked decisions
- **Bulk Operations:** Multi-select tasks for reassignment, priority change, or status update
- **Sync with `.squad/`:** Tasks map to the squad's internal task tracking. Changes in the UI are reflected in the file system and vice versa.

**User Stories:**

- *As a developer, I want to create a task and assign it to Bender, so I can track backend work visually.*
- *As a PM, I want to drag tasks to re-prioritize them, so the squad works on the most important things first.*
- *As a team lead, I want to filter tasks by "blocked" status, so I can unblock the team.*

### 3.3 Real-time Agent Activity

**Purpose:** Live view of what agents are doing right now. Think CI/CD pipeline view meets team activity feed.

**Requirements:**

- **Activity Feed:** Chronological stream of agent events — spawned, started task, made decision, completed task, encountered error, waiting for input
- **Per-Agent Activity:** Click an agent to see their individual activity stream
- **Status Indicators:** Visual state machine — Idle → Spawned → Working → Waiting → Completed / Failed
- **Live Logs (optional toggle):** For technical users, expand an activity entry to see the underlying log output
- **Notifications:** Surface critical events (failures, blocked tasks, decisions needing human input) as in-app alerts
- **Real-time Updates:** Events appear within 2-3 seconds of occurrence via WebSocket or SSE

**User Stories:**

- *As a developer, I want to see a live feed of agent activity, so I catch failures early.*
- *As a team lead, I want to get notified when an agent is blocked and needs my input.*

### 3.4 Voice Interface — Real-time Group Voice Chat

**Purpose:** Have a live voice conversation with your entire AI squad — like being in a room with your team. You talk naturally, agents respond by voice, multiple agents can participate, and voice directives trigger real actions. Think: ChatGPT Advanced Voice mode, but for a *group* of AI agents.

**Core Concept:** This is NOT push-to-talk command-response. It is a **continuous, multi-party, real-time voice conversation**. The user speaks naturally (the system is always listening), the Coordinator determines which agent(s) should respond, and agents can build on each other's responses — just like a real standup.

**Requirements:**

- **Continuous Listening (Always-On):** The microphone is open by default during a voice session. Voice Activity Detection (VAD) segments user speech automatically — no push-to-talk button needed. The user simply talks, pauses, and continues naturally. A mute toggle is available but the default is *live*.
- **Multi-Agent Voice Responses:** Multiple agents can respond in the same conversation. The Coordinator routes each user utterance to the most relevant agent(s). Agents take turns speaking (no overlapping audio) with smooth transitions. Example: user asks "What's the status?" → Leela gives the high-level summary → Bender adds a backend-specific update → Fry mentions a frontend blocker.
- **Agent Personality in Voice:** Each agent has a distinct, recognizable voice. Leela sounds confident and direct, Fry sounds enthusiastic and friendly, Bender sounds blunt and matter-of-fact, Zoidberg sounds methodical and precise. Voice profiles are consistent across sessions.
- **Shared Conversation Context:** All agents in a voice session share the same conversation state. When the user talks to Bender about the API, Leela hears that context too. Agents can reference what other agents said ("As Bender mentioned, the endpoint is ready — I'll update the task board"). Context persists across the full session.
- **Voice-Triggered Action Execution:** Voice directives trigger real squad operations, not just information retrieval:
  - "Bender, create an auth endpoint for JWT tokens" → Creates a task, Bender acknowledges and starts work
  - "Fry, the login page needs a loading spinner" → Creates a task assigned to Fry
  - "Prioritize the auth work above the dashboard" → Reorders task priorities
  - "What decisions were made today?" → Queries and reads back decision log entries
  - "Leela, assign the database migration to Bender" → Executes task assignment
  - The intent parser maps natural speech to squad operations (task creation, assignment, priority changes, status queries, decision lookups). Agents confirm actions before or after execution.
- **Streaming Audio Pipeline (Low Latency):** Audio streams bidirectionally in real time. User speech streams to STT as the user talks (not after they stop). Agent responses stream from TTS as they are generated (first audio bytes play within ~500ms of agent producing text). Target: <2 seconds from end-of-user-speech to start-of-agent-audio.
- **Conversation View UI:** The voice session is displayed as a live conversation transcript — like a meeting view. Each participant (user + agents) has labeled turns. Real-time transcription shows user words as they speak. Agent responses appear as both text and audio. Users can scroll back, replay any agent response, or copy text.
- **Text Fallback:** Every voice interaction has a text equivalent. Voice is additive, never required. Users can type into the voice session if they prefer (hybrid mode).
- **Visual Feedback:** Waveform animation shows who is currently speaking. Agent avatars light up when their turn is active. A "thinking" indicator shows when the Coordinator is routing or an agent is processing. Real-time transcription appears as the user speaks.
- **Session Management:** Voice sessions are explicit — the user starts and ends them. Multiple sessions are supported (e.g., one for standup, one for code review). Session history is preserved and searchable.

**User Stories:**

- *As a developer, I want to open a voice session, say "Morning squad, what's the status?" and hear Leela, Bender, and Fry each give their updates — like a real standup.*
- *As a PM, I want to say "Bender, create an API endpoint for user profiles" and have it actually become a tracked task that Bender starts working on.*
- *As a developer, I want to have a back-and-forth conversation with Fry about a UI problem, then have Leela jump in with a prioritization suggestion — all by voice, all in one session.*
- *As a user, I want to mute my mic, type a question, and still get a spoken response from the right agent.*
- *As a team lead, I want to say "Leela, what's blocking the launch?" and hear a synthesized summary that references what each agent reported — not just a single agent's view.*

### 3.5 Decision Log

**Purpose:** Browse and search all team decisions. See who made them, when, and why.

**Requirements:**

- **Decision List:** Chronological list of all decisions, newest first
- **Decision Detail:** Each decision shows: title, author (agent), date, rationale, affected files/tasks, status (active, superseded, reversed)
- **Search:** Full-text search across decision titles and content
- **Filter:** By agent, date range, status
- **Sync with `.squad/decisions.md`:** Reads from and writes to the squad's decision file system
- **Link to Context:** Decisions link to the tasks, PRs, or discussions that prompted them

**User Stories:**

- *As a team lead, I want to search decisions for "authentication" to understand what architectural choices were made.*
- *As a developer, I want to see why a decision was made, not just what it was.*

### 3.6 Chat Interface

**Purpose:** Text-based conversation with individual agents or the whole team. Like Slack for your AI squad.

**Requirements:**

- **Direct Messages:** Chat with a single agent (e.g., ask Bender about backend architecture)
- **Team Chat:** Send a message to the entire squad (the Coordinator routes it to the right agent)
- **Message History:** Persistent chat history, searchable
- **Rich Messages:** Support markdown, code blocks, links, and file references in messages
- **Agent Responses:** Agents respond in character (using their defined personality/voice)
- **Inline Actions:** Agent responses can include actionable suggestions (e.g., "Should I create a task for this?" with a clickable button)
- **Thread Support:** Reply to specific messages to create focused threads
- **Typing Indicators:** Show when an agent is processing/responding

**User Stories:**

- *As a developer, I want to DM Fry and ask "Can you add a loading spinner to the dashboard?" and have it become a tracked task.*
- *As a PM, I want to message the team channel and say "What's blocking the v1 launch?" and get responses from relevant agents.*

---

## 4. Architecture Overview

### 4.1 System Diagram (High-Level)

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

### 4.2 Frontend

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| **Framework** | Next.js (App Router) with React 19 | SSR for initial load, client components for interactivity, strong ecosystem |
| **State Management** | Zustand or Jotai | Lightweight, avoids Redux boilerplate, good for real-time updates |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid development, consistent design system, accessible components |
| **Real-time** | Native WebSocket client | Direct connection for live updates, lightweight |
| **Voice UI** | Web Speech API + custom audio pipeline | Browser-native STT for quick MVP; custom pipeline for production quality |
| **Data Fetching** | TanStack Query (React Query) | Caching, optimistic updates, background refetching |
| **Drag-and-Drop** | dnd-kit | Accessible, performant, well-maintained |

### 4.3 Backend

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| **Runtime** | Node.js (with TypeScript) | Same language as frontend, strong ecosystem for real-time apps |
| **Framework** | Fastify or Hono | High-performance HTTP + WebSocket, lightweight |
| **API Style** | REST for CRUD, WebSocket for real-time, RPC-style for voice commands | Each interaction pattern gets the right protocol |
| **Data Layer** | `.squad/` file system as primary source of truth | No migration needed; the squad framework already stores everything in files. The backend reads/watches these files. |
| **Database (optional)** | SQLite (via better-sqlite3 or Drizzle) | For indexing, search, caching, and chat history. Augments the file system, doesn't replace it. |
| **File Watching** | chokidar or Node.js `fs.watch` | Watch `.squad/` for changes and push updates to clients via WebSocket |

### 4.4 Voice Pipeline

```
User speaks → [Microphone] → [STT Service] → Text
    → [Agent Router] → Agent processes message → Response text
    → [TTS Service] → Audio → [Speaker]
```

| Component | Options | v1 Recommendation |
|-----------|---------|-------------------|
| **Speech-to-Text** | Azure Speech Services, OpenAI Whisper API, Deepgram, browser Web Speech API | **OpenAI Whisper API** — high accuracy, simple API, aligns with existing AI stack |
| **Text-to-Speech** | Azure Speech Services, ElevenLabs, OpenAI TTS, browser speechSynthesis | **OpenAI TTS** — multiple voice options, good quality, simple API. Use distinct voices per agent. |
| **Voice Activity Detection** | Browser-based VAD (e.g., @ricky0123/vad-web) | Start with push-to-talk; add VAD in a fast follow. |

### 4.5 Real-time Communication

| Aspect | Decision |
|--------|----------|
| **Protocol** | WebSocket (primary), with SSE fallback for environments where WebSocket is blocked |
| **Events** | Agent status changes, task updates, new decisions, chat messages, system alerts |
| **Scaling** | Single-server for v1. For v2+, consider Redis pub/sub for multi-instance coordination. |

### 4.6 Authentication & Authorization

| Aspect | v1 Approach |
|--------|-------------|
| **Auth Provider** | NextAuth.js (Auth.js) with GitHub OAuth as primary provider |
| **Session Management** | JWT-based sessions |
| **Authorization Model** | Simple role-based: Owner (full control), Member (can manage tasks, chat), Viewer (read-only) |
| **API Security** | All API endpoints require authentication. WebSocket connections authenticated on upgrade. |

### 4.7 Deployment

| Aspect | Recommendation |
|--------|----------------|
| **Hosting** | Vercel (frontend) + a dedicated server/VM for the backend + file system (the `.squad/` directory needs persistent file access) |
| **Alternative** | Single VPS/VM running both frontend and backend (simpler for v1) |
| **CI/CD** | GitHub Actions |
| **Environment** | The backend must run on the same machine (or have filesystem access to) where the squad operates, since it reads `.squad/` directly |

---

## 5. Future Features (v2+)

These are explicitly **deferred** from v1. They are real priorities but not launch-blocking.

| Feature | Description | Why Deferred |
|---------|-------------|--------------|
| **Voice-First Mobile App** | Native iOS/Android app optimized for voice interaction with your squad. Talk to your agents on the go. | Mobile adds significant complexity. Web-first proves the concept. |
| **Multi-Squad Management** | Manage multiple squads from a single dashboard. Switch between projects, compare progress, share agents across squads. | v1 focuses on single-squad excellence. |
| **Analytics Dashboard** | Metrics on agent performance, task throughput, decision frequency, cost tracking (API spend per agent). | Need real usage data before building analytics. |
| **Slack / Teams Integration** | Interact with your squad from Slack or Microsoft Teams. Receive notifications, send commands, view status — without leaving your existing tools. | Integration work is significant. Standalone tool first. |
| **Custom Agent Marketplace** | Browse, install, and configure community-built agent templates. Share your custom agents with others. | Requires ecosystem maturity and community. |
| **Workflow Automation** | Define triggers and automated workflows (e.g., "When a task is marked done, auto-assign review to Zoidberg"). | v1 keeps workflows manual and human-directed. |
| **Advanced Voice Features** | Continuous listening with wake word, multi-language support, voice cloning for custom agent voices. | Adds complexity; basic voice is the v1 priority. |
| **Collaborative Multi-User** | Multiple human users interacting with the same squad simultaneously, with presence indicators and conflict resolution. | Single-user interaction is sufficient for v1. |
| **Git Integration UI** | Visual PR review, branch management, and commit history tied to agent activity. | The squad already handles git via CLI. UI can come later. |

---

## 6. Non-Goals (Out of Scope for v1)

To keep the team focused, these are things we are **explicitly not building** in v1:

1. **We are not building a new agent framework.** openspace.ai is a UI layer on top of the existing Squad framework. We read from and write to `.squad/` — we don't replace it.

2. **We are not building a mobile app.** Web only. Responsive design for tablets is nice-to-have, but native mobile is v2+.

3. **We are not building multi-tenant SaaS infrastructure.** v1 is single-user (or small team) on a single machine. No tenant isolation, no billing, no cloud-hosted squad orchestration.

4. **We are not building code editing or IDE features.** Agents write code via their existing tools. openspace.ai shows what they're doing and lets you direct them — it doesn't replace VS Code or Copilot.

5. **We are not building agent training or fine-tuning.** Agents use their existing models and configurations. openspace.ai doesn't modify agent internals.

6. **We are not handling billing, payments, or subscription management.** No commercial infrastructure in v1.

7. **We are not building offline support.** The app requires a live connection to the backend (and therefore to the squad's file system).

8. **We are not building a public API for third-party integrations.** The API exists to serve the frontend. External integrations come later.

---

## 7. Success Metrics

### Launch Criteria (MVP is "done" when...)

| Metric | Target |
|--------|--------|
| A user can open the dashboard and see all squad agents and their current status | ✅ Working |
| A user can create, assign, and prioritize tasks via the UI | ✅ Working |
| A user can see real-time agent activity (events appear within 5 seconds) | ✅ Working |
| A user can have a voice conversation with an agent (speak → get spoken response) | ✅ Working |
| A user can browse and search the decision log | ✅ Working |
| A user can send and receive chat messages with agents | ✅ Working |

### Post-Launch Success Metrics (measured over first 30 days)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Daily Active Usage** | Used daily by the project owner (Matanel) | If the creator doesn't use it, something's wrong. |
| **Task Creation Rate** | >80% of squad tasks created via UI (vs. CLI/manual) | Measures whether the UI is genuinely faster than the old way. |
| **Voice Interaction Adoption** | Voice used at least 3x per day | Validates the voice hypothesis — is it actually useful? |
| **Time to Awareness** | <30 seconds from opening app to understanding squad status | Measures dashboard effectiveness. |
| **Error Recovery** | <5% of voice commands fail to be understood | Measures voice pipeline quality. |
| **Decision Discoverability** | Users can find a specific past decision in <15 seconds | Measures search and log quality. |

---

## 8. Technical Constraints & Decisions Needed

### Hard Constraints

1. **File System Dependency:** The backend MUST have direct file system access to the `.squad/` directory. This constrains deployment options — the backend must run on (or mount) the same filesystem where the squad operates.

2. **Existing Squad Protocol:** The UI must respect the squad's existing file format and conventions. We read `team.md`, `decisions.md`, agent charters, orchestration logs, etc. Any writes must produce files the squad framework can consume.

3. **Single Source of Truth:** `.squad/` is the source of truth. The UI database (if any) is a cache/index. If they conflict, `.squad/` wins.

### Open Decisions (Team Must Resolve)

| # | Decision | Options | Impact | Owner |
|---|----------|---------|--------|-------|
| **D1** | **Monorepo or separate repos?** | (a) Monorepo with `apps/web` and `apps/api` (b) Separate frontend and backend repos | Affects CI/CD, shared types, developer experience. | Leela + team |
| **D2** | **Backend framework choice** | (a) Fastify (b) Hono (c) Express (d) Next.js API routes for everything | Affects performance, WebSocket support, developer familiarity. | Bender |
| **D3** | **Voice service provider** | (a) OpenAI Whisper + TTS (b) Azure Speech Services (c) Deepgram + ElevenLabs (d) Browser-native (free, lower quality) | Affects cost, latency, voice quality. | Leela + Fry |
| **D4** | **How do tasks map to `.squad/` files?** | Need to design the task file format or extend existing `.squad/` conventions. | Core data model question — affects everything. | Bender + Leela |
| **D5** | **Auth strategy for local dev vs. deployed** | Local: skip auth? Simple token? Deployed: OAuth? | Affects developer experience and security. | Bender |
| **D6** | **How does the voice pipeline handle latency?** | Stream responses (word-by-word TTS) vs. wait for full response? | Affects perceived responsiveness of voice interactions. | Fry |
| **D7** | **Chat persistence — where does chat history live?** | (a) In `.squad/` as markdown (b) In SQLite (c) Both | Affects whether chat is part of the squad's "memory" or a UI-only concern. | Leela |

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Voice latency too high for natural conversation** | Medium | High | Stream TTS output; use faster models; show text while audio loads |
| **File system watching is unreliable on some OS/FS** | Medium | Medium | Use polling fallback; test on target OS early |
| **Squad file format changes break the UI** | Low | High | Define a contract/schema for `.squad/` files the UI depends on; version it |
| **Real-time updates overwhelm the client** | Low | Medium | Throttle/batch WebSocket events; virtual scrolling for activity feed |
| **Browser mic permissions confuse non-technical users** | Medium | Medium | Clear onboarding UX; graceful degradation to text |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Squad** | A team of AI agents configured to work together on a project, managed via the `.squad/` framework |
| **Agent** | An individual AI worker with a defined role, charter, and personality (e.g., Fry the Frontend Dev) |
| **Coordinator** | The orchestration agent that routes work and enforces handoffs between agents |
| **Charter** | A markdown file defining an agent's identity, expertise, boundaries, and collaboration rules |
| **Decision** | A recorded team choice captured in `.squad/decisions.md` or the decisions inbox |
| **`.squad/` Directory** | The file-based system that stores all squad configuration, state, and history |

---

## Appendix B: Reference — Current `.squad/` Structure

```
.squad/
├── agents/           # Agent charters and history
│   ├── leela/
│   ├── fry/
│   ├── bender/
│   ├── zoidberg/
│   └── scribe/
├── decisions/        # Decision records and inbox
│   ├── inbox/
│   └── ...
├── decisions.md      # Consolidated decision log
├── team.md           # Team roster and project context
├── config.json       # Squad configuration
├── routing.md        # Message routing rules
├── ceremonies.md     # Team ceremonies and rituals
├── sessions/         # Session records
├── log/              # Orchestration logs
├── orchestration-log/
├── identity/         # Team identity (wisdom, focus)
│   ├── wisdom.md
│   └── now.md
├── templates/        # Reusable templates
├── skills/           # Squad skills
├── plugins/          # Squad plugins
└── casting/          # Agent casting rules
```

This is the data layer the UI reads from and writes to. Understanding this structure is essential for backend development.

---

*This document is a living spec. As decisions are made (see §8), this PRD will be updated to reflect them. All changes should be reviewed by Leela before merging.*

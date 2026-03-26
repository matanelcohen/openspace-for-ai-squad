---
id: task-qeC0GY5Z
title: Implement sandbox container backend and runtime support
status: done
priority: P1
assignee: bender
labels:
  - backend
  - infrastructure
  - docker
  - sandbox
  - 'parent:task-RpGqbXvk'
created: '2026-03-25T23:19:27.919Z'
updated: '2026-03-26T06:37:57.824Z'
sortIndex: 150
---
Build the backend service that manages isolated container lifecycles. Use Docker or a lightweight container runtime to spin up ephemeral sandboxes per agent request. Implement: container pool management, runtime provisioning (Node, Python, Go base images), command execution API (run build/test/script), stdout/stderr streaming via WebSocket, resource limits (CPU, memory, timeout), filesystem snapshot for artifact retrieval. Expose REST endpoints for create/execute/destroy and a WebSocket endpoint for real-time output streaming.

---
**[2026-03-26 06:37:57]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 06:28:40]** 🧠 Thinking: Let me analyze this task. I need to build a backend service for managing isolated container lifecycles. Let me first explore the codebase to understan
**[2026-03-26 06:28:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:48]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:48]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:53]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:53]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:53]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:54]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:54]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:54]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:59]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:59]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:59]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:04]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:04]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:04]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:04]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:04]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:06]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:06]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:06]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:06]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:10]** 🧠 Thinking: Now I have a good understanding of the codebase. Let me look at a few existing route and service patterns to follow their conventions.
**[2026-03-26 06:29:11]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:11]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:11]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:11]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:12]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:12]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:12]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:12]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:17]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:17]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:17]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:17]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:26]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:26]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:26]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:26]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:27]** 🧠 Thinking: Now I have a very good understanding of the codebase. Let me now look at the existing test patterns quickly, and then create my plan and start impleme
**[2026-03-26 06:29:27]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:27]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:27]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:31]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:31]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:31]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:31]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:43]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:43]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:43]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:43]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:47]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:52]** ℹ️ /Users/matancohen/.copilot/session-state/6499a87c-b178-4d11-a0c2-569c67622877/plan.md
**[2026-03-26 06:29:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:29:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:30:23]** 🔧 Using tool: `unknown`
**[2026-03-26 06:30:23]** 🔧 Using tool: `unknown`
**[2026-03-26 06:30:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:30:39]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox/types.ts
**[2026-03-26 06:31:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:31:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:31:07]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox/container-manager.ts
**[2026-03-26 06:31:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:31:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:31:34]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox/container-pool.ts
**[2026-03-26 06:31:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:31:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:31:52]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox/index.ts
**[2026-03-26 06:32:23]** 🔧 Using tool: `unknown`
**[2026-03-26 06:32:23]** 🔧 Using tool: `unknown`
**[2026-03-26 06:32:23]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/sandboxes.ts
**[2026-03-26 06:32:32]** 🔧 Using tool: `unknown`
**[2026-03-26 06:32:32]** 🔧 Using tool: `unknown`
**[2026-03-26 06:32:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:32:43]** 🔧 Using tool: `unknown`
**[2026-03-26 06:32:49]** 🔧 Using tool: `unknown`
**[2026-03-26 06:32:54]** 🔧 Using tool: `unknown`
**[2026-03-26 06:33:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:33:05]** 🔧 Using tool: `unknown`
**[2026-03-26 06:33:10]** 🔧 Using tool: `unknown`
**[2026-03-26 06:33:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:33:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:33:26]** 🔧 Using tool: `unknown`
**[2026-03-26 06:33:31]** 🔧 Using tool: `unknown`
**[2026-03-26 06:33:31]** 🔧 Using tool: `unknown`
**[2026-03-26 06:34:05]** 🔧 Using tool: `unknown`
**[2026-03-26 06:34:05]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox/__tests__/container-manager.test.ts
**[2026-03-26 06:34:26]** 🔧 Using tool: `unknown`
**[2026-03-26 06:34:26]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox/__tests__/container-pool.test.ts
**[2026-03-26 06:34:49]** 🔧 Using tool: `unknown`
**[2026-03-26 06:34:49]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/sandboxes.test.ts
**[2026-03-26 06:34:54]** 🔧 Using tool: `unknown`
**[2026-03-26 06:34:54]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:03]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:11]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:20]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:26]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:50]** 🔧 Using tool: `unknown`
**[2026-03-26 06:35:50]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:01]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:28]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:36]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:43]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:49]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:57]** 🔧 Using tool: `unknown`
**[2026-03-26 06:36:57]** 🔧 Using tool: `unknown`
**[2026-03-26 06:37:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:37:08]** 🔧 Using tool: `unknown`
**[2026-03-26 06:37:13]** 🔧 Using tool: `unknown`
**[2026-03-26 06:37:20]** 🔧 Using tool: `unknown`
**[2026-03-26 06:37:36]** 🔧 Using tool: `unknown`
**[2026-03-26 06:37:45]** 🔧 Using tool: `unknown`

**[2026-03-26 06:37:57]** ✅ Bender completed this task.

**Result:**
Done. Here's what I built:

**Sandbox Container Backend** — 11 files, 2043 lines added across 3 layers:

**Service layer** (`apps/api/src/services/sandbox/`):
- **`types.ts`** — Runtime enums (node/python/go), resource limits, pool config, exec/stream types
- **`container-manager.ts`** — Docker lifecycle via dockerode: create containers with CPU/memory limits, network isolation (`NetworkMode=none`), exec with timeout enforcement, stdout/stderr streaming via EventEmitter, filesystem copy-out
- **`container-pool.ts`** — Pool with max capacity (default 10), idle cleanup timer, acquire/release pattern, warmup support
- **`index.ts`** — `SandboxService` orchestrator + barrel exports

**Route layer** (`apps/api/src/routes/sandboxes.ts`):
- `POST /api/sandboxes` — Create sandbox (returns 429 if pool full)
- `GET /api/sandboxes` / `GET /api/sandboxes/:id` — List/status
- `POST /api/sandboxes/:id/exec` — Run command, get stdout/stderr/exitCode
- `GET /api/sandboxes/:id/files/*` — Download files as tar
- `DELETE /api/sandboxes/:id` — Destroy
- `GET /api/sandboxes/:id/stream` — WebSocket for real-time output streaming (also accepts `exec` commands over WS)

**Tests** — 38 tests passing (27 service + 11 route), lint clean.

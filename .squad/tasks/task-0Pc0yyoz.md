---
id: task-0Pc0yyoz
title: Design sandbox architecture and API contract
status: done
priority: P1
assignee: leela
labels:
  - architecture
  - design
  - sandbox
  - 'parent:task-RpGqbXvk'
created: '2026-03-25T23:19:27.904Z'
updated: '2026-03-26T06:28:29.849Z'
sortIndex: 149
---
Define the overall architecture for sandboxed code execution: container lifecycle (create, execute, destroy), API surface (REST/WebSocket endpoints), security model (resource limits, network isolation, filesystem isolation), and runtime plugin interface for supporting Node, Python, Go. Produce an architecture doc and OpenAPI spec that bender and fry can build against.

---
**[2026-03-26 06:28:29]** 🚀 Leela started working on this task.

**Progress:**
**[2026-03-26 06:21:33]** 🧠 Thinking: Let me analyze this task. I need to design the sandbox architecture and API contract for sandboxed code execution. This involves:

1. Architecture doc
**[2026-03-26 06:21:33]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:33]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:36]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:37]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:37]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:37]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:37]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:37]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:37]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:41]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:41]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:41]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:41]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:53]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:53]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:53]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:53]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:53]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:21:58]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:02]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:11]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:11]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:11]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:16]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:16]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:16]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:16]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:21]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:22:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:37]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:42]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:50]** 🧠 Thinking: Now I have a thorough understanding of the codebase. Let me also check existing sandbox-related types and any existing docs to understand what's alrea
**[2026-03-26 06:23:50]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:50]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:50]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:50]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:59]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:59]** 🔧 Using tool: `unknown`
**[2026-03-26 06:23:59]** 🔧 Using tool: `unknown`
**[2026-03-26 06:24:07]** 🧠 Thinking: Now I have a comprehensive understanding of the codebase. Let me look at the existing architecture docs to match the style and depth, and also check w
**[2026-03-26 06:24:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:24:08]** 🔧 Using tool: `unknown`
**[2026-03-26 06:24:08]** 🔧 Using tool: `unknown`
**[2026-03-26 06:26:42]** 🔧 Using tool: `unknown`
**[2026-03-26 06:26:42]** 🔧 Using tool: `unknown`
**[2026-03-26 06:26:43]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/docs/sandbox-architecture.md
**[2026-03-26 06:27:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:27:40]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/docs/sandbox-openapi.yaml
**[2026-03-26 06:27:49]** 🔧 Using tool: `unknown`
**[2026-03-26 06:27:49]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:01]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:06]** 🔧 Using tool: `unknown`
**[2026-03-26 06:28:17]** 🔧 Using tool: `unknown`

**[2026-03-26 06:28:29]** ✅ Leela completed this task.

**Result:**
Committed. Here's what I delivered:

**Two files committed:**

1. **`docs/sandbox-architecture.md`** — Full architecture doc covering:
   - Container lifecycle state machine (create → running → stopped → destroying)
   - Security model: resource limits (CPU/mem/disk/PIDs), network isolation via internal Docker network, filesystem isolation with read-only rootfs, capability dropping, non-root user
   - Runtime plugin interface (`RuntimePlugin`) with built-in Node.js 22, Python 3.12, Go 1.23 implementations
   - Service module structure (`SandboxService`, `ContainerDriver`, `ExecEngine`, `StreamRouter`, `SandboxReaper`)
   - DAG workflow integration via `SandboxStepExecutor`
   - DB schema, observability, deployment config
   - 7-phase implementation plan for bender and fry

2. **`docs/sandbox-openapi.yaml`** — Complete OpenAPI 3.1 spec with:
   - 9 REST endpoints (CRUD + exec + file ops)
   - WebSocket streaming protocol (output, batch, exec:done, status events)
   - Full request/response schemas matching existing `@openspace/shared` types
   - Error codes and examples

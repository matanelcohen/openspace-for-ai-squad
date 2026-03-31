---
id: task-HFurayVB
title: Add E2E and integration tests for sandbox execution
status: done
priority: P2
assignee: zoidberg
labels:
  - testing
  - e2e
  - integration
  - sandbox
  - 'parent:task-RpGqbXvk'
created: '2026-03-25T23:19:27.947Z'
updated: '2026-03-31T21:51:04.863Z'
sortIndex: 101
---
Write comprehensive tests covering: container lifecycle (create → execute → destroy), multi-runtime execution (Node, Python, Go each run a hello-world + dependency install), resource limit enforcement (CPU/memory/timeout kills), concurrent sandbox isolation (two sandboxes don't leak state), WebSocket streaming correctness, error handling (bad commands, container crashes, OOM). Include both integration tests against the real backend and E2E tests through the UI.

---
**[2026-03-26 07:29:27]** 🚀 Zoidberg started working on this task.

**Progress:**
**[2026-03-26 07:20:01]** 🧠 Thinking: Let me start by understanding the codebase structure, particularly the sandbox-related code and existing tests, before writing comprehensive tests.
**[2026-03-26 07:20:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:15]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:24]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:40]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:50]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:20:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:02]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:02]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:02]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:02]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:08]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:08]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:08]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:21:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:16]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:16]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:26]** 🧠 Thinking: Let me read the key parts of the exploration results and also look at the existing tests and configs to understand the patterns.
**[2026-03-26 07:22:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:33]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:33]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:33]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:33]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:54]** 🔧 Using tool: `unknown`
**[2026-03-26 07:22:54]** 🔧 Using tool: `unknown`
**[2026-03-26 07:23:16]** 🔧 Using tool: `unknown`
**[2026-03-26 07:23:16]** 🔧 Using tool: `unknown`
**[2026-03-26 07:23:16]** 🔧 Using tool: `unknown`
**[2026-03-26 07:23:16]** ℹ️ /Users/matancohen/.copilot/session-state/d25b01db-617c-4635-ba0e-abf943350c41/plan.md
**[2026-03-26 07:23:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:23:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:23:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:24:18]** 🔧 Using tool: `unknown`
**[2026-03-26 07:24:18]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox/__tests__/sandbox-service.test.ts
**[2026-03-26 07:25:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:20]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/__tests__/integration/sandboxes.test.ts
**[2026-03-26 07:25:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:53]** 🔧 Using tool: `unknown`
**[2026-03-26 07:25:58]** 🔧 Using tool: `unknown`
**[2026-03-26 07:26:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:26:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:26:14]** 🔧 Using tool: `unknown`
**[2026-03-26 07:26:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:26:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:26:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:26:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:27:14]** 🔧 Using tool: `unknown`
**[2026-03-26 07:27:14]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/e2e/sandbox.spec.ts
**[2026-03-26 07:27:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:27:20]** 🔧 Using tool: `unknown`
**[2026-03-26 07:27:27]** 🔧 Using tool: `unknown`
**[2026-03-26 07:27:35]** 🔧 Using tool: `unknown`
**[2026-03-26 07:27:45]** 🔧 Using tool: `unknown`
**[2026-03-26 07:27:49]** 🔧 Using tool: `unknown`
**[2026-03-26 07:27:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:21]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:21]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:31]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:38]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:49]** 🔧 Using tool: `unknown`
**[2026-03-26 07:28:55]** 🔧 Using tool: `unknown`
**[2026-03-26 07:29:11]** 🔧 Using tool: `unknown`

**[2026-03-26 07:29:27]** ✅ Zoidberg completed this task.

**Result:**
Committed successfully. Here's the summary:

## Done ✅

Created **3 test files** with **78 total tests** covering sandbox execution:

| File | Tests | Layer |
|------|-------|-------|
| `apps/api/src/services/sandbox/__tests__/sandbox-service.test.ts` | 29 | Service integration |
| `apps/api/src/__tests__/integration/sandboxes.test.ts` | 35 | API integration |
| `e2e/sandbox.spec.ts` | 14 | E2E (Playwright) |

**Coverage areas:**
- **Lifecycle**: create → exec → exec → destroy full round-trip
- **Multi-runtime**: Node, Python, Go each independently executable
- **Resource limits**: custom CPU/memory/timeout, per-exec overrides, timeout kill reporting
- **Concurrent isolation**: separate IDs/containers, no state leakage between sandboxes
- **Error handling**: 404/410/429/500, bad commands (exit 127), OOM, container crashes, recovery to `ready` status after failures
- **WebSocket streaming**: stream event listener wiring (onStreamData/onStreamEnd)
- **API validation**: invalid runtime, empty/missing command, file retrieval path handling
- **E2E UI**: panel rendering, create form, runtime selector, terminal output, destroy flow

All 64 vitest tests pass with ESLint/Prettier clean. Committed as `20e93fd`.

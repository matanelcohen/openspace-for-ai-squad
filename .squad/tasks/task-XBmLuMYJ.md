---
id: task-XBmLuMYJ
title: Add reconnection and error-path test coverage
status: done
priority: P1
assignee: fry
labels:
  - testing
  - websocket
  - regression
  - 'parent:task-GPxctKEl'
created: '2026-03-26T14:47:32.574Z'
updated: '2026-03-31T08:39:23.825Z'
sortIndex: 188
---
**[2026-03-31 08:38:04]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-31 08:36:22]** 🧠 Thinking: Let me analyze this task. I need to add reconnection and error-path test coverage for WebSocket-related frontend hooks. Let me first explore the codebase to understand the current state of WebSocket t
**[2026-03-31 08:36:22]** 🔧 Using tool: `unknown` — {"intent":"Exploring WebSocket test state"}
**[2026-03-31 08:36:22]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager branch --show-current && git`
**[2026-03-31 08:36:22]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && find . -path ./node_modules -prune -o -name`
**[2026-03-31 08:36:22]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && find . -path ./node_modules -prune -o -name`
**[2026-03-31 08:36:33]** 🧠 Thinking: It looks like there are already some WebSocket error-path test files. Let me check if these are from my previous work or if this is a fresh branch that needs the work. Let me look at the test files an
**[2026-03-31 08:36:33]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager status --short | head -20`
**[2026-03-31 08:36:33]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager log --oneline --all | grep -`
**[2026-03-31 08:36:33]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && grep -c 'it(' apps/web/src/hooks/__tests__/`
**[2026-03-31 08:36:43]** 🧠 Thinking: I can see that:

1. Commit `07c4e7d` already has "test: add reconnection and error-path test coverage for WebSocket hooks" — this is from my previous work
2. The test files exist with tests: 16 + 21 +
**[2026-03-31 08:36:43]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager branch --contains 07c4e7d 2>`
**[2026-03-31 08:36:43]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager log --oneline feat/sandbox-c`
**[2026-03-31 08:36:50]** 🔧 Using tool: `unknown` — {"intent":"Verifying WebSocket test coverage"}
**[2026-03-31 08:36:50]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && npx vitest run --reporter=verbose apps/web/`
**[2026-03-31 08:37:02]** 🧠 Thinking: The tests are failing because they can't resolve `@/hooks/use-websocket`. This is a path alias issue. Let me check how the vitest config resolves these paths and what the actual module structure looks
**[2026-03-31 08:37:02]** 🔧 Using tool: `unknown` — {"agent_type":"explore","description":"Explore vitest path alias config","mode":"sync","name":"explo
**[2026-03-31 08:37:06]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/vitest.config.ts"}
**[2026-03-31 08:37:06]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/vite.config.ts"}
**[2026-03-31 08:37:06]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/tsconfig.json"}
**[2026-03-31 08:37:06]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/src/hooks/use-websocket.ts"}
**[2026-03-31 08:37:06]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/src/hooks/__tests__/use-websocket.test.ts"}
**[2026-03-31 08:37:06]** 🔧 Using tool: `unknown` — {"pattern":"vitest.config.ts"}
**[2026-03-31 08:37:06]** 🔧 Using tool: `unknown` — {"pattern":"vitest.config.*.ts"}
**[2026-03-31 08:37:06]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/**/*.config.ts"}
**[2026-03-31 08:37:11]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/vitest.config.ts
**[2026-03-31 08:37:11]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/tsconfig.json
**[2026-03-31 08:37:11]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/use-websocket.ts
**[2026-03-31 08:37:11]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/__tests__/use-websocket.test.ts
**[2026-03-31 08:37:11]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/vitest.config.ts
**[2026-03-31 08:37:11]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/vitest.setup.ts"}
**[2026-03-31 08:37:15]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/tsconfig.json
**[2026-03-31 08:37:15]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/test
**[2026-03-31 08:37:20]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/test/setup.ts
**[2026-03-31 08:37:37]** 🧠 Thinking: The config looks correct. The `@/` alias is properly configured. Let me check if the tests are being run from the right directory. The vitest command I used may have been running from the root, not fr
**[2026-03-31 08:37:37]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && cat package.json | grep -A5 '"test"' | head`
**[2026-03-31 08:37:37]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web && npx vitest run --reporter=verbose `
**[2026-03-31 08:37:48]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web && npx vitest run --reporter=verbose `

**[2026-03-31 08:38:04]** ✅ Fry completed this task.

**Result:**
All **83 tests pass** (13 + 70) across all 5 WebSocket test files. ✅

This task is already complete — commit `07c4e7d` ("test: add reconnection and error-path test coverage for WebSocket hooks") is on the current branch with:

| File | Tests | Coverage |
|---|---|---|
| `use-websocket.test.ts` | 13 | Core hook behavior + error envelopes |
| `use-websocket-error-paths.test.ts` | 16 | send() when disconnected, state transitions, onerror→onclose→reconnect, non-string data, timer cleanup, duplicate closes, backoff |
| `websocket-resilience.test.ts` | 16 | Reconnection, backoff cap, error→close chain, server error codes, unmount cleanup |
| `use-sandbox-stream.test.ts` | 17 | Stream lifecycle, reconnect, retry, clear, sandboxId changes |
| `use-sandbox-stream-error-paths.test.ts` | 21 | Error envelopes, line truncation, pre-open errors, rapid cycles, status transitions |

**83 tests, all passing.** No additional work needed — the reconnection and error-path test coverage is already shipped. 🎉

---
⏭️ YOLO skipped: Already in progress — Fry is actively working on this task.

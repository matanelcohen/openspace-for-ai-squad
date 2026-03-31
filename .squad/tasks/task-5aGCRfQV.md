---
id: task-5aGCRfQV
title: Add reconnection logic to useSandboxStream hook
status: done
priority: P0
assignee: bender
labels:
  - bug
  - websocket
  - terminal
  - 'parent:task-GPxctKEl'
created: '2026-03-26T14:47:32.479Z'
updated: '2026-03-31T21:51:05.022Z'
sortIndex: 129
---
**[2026-03-30 14:40:34]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-30 14:38:12]** 🧠 Thinking: Let me understand the task: Add reconnection logic to the `useSandboxStream` hook. I need to find the existing hook and understand the codebase's exponential backoff pattern, then implement reconnecti
**[2026-03-30 14:38:12]** 🔧 Using tool: `unknown` — {"intent":"Exploring reconnection patterns"}
**[2026-03-30 14:38:12]** 🔧 Using tool: `unknown` — {"agent_type":"explore","description":"Find reconnection patterns","mode":"sync","name":"explore-rec
**[2026-03-30 14:38:15]** 🔧 Using tool: `unknown` — {"pattern":"**/*useSandboxStream*"}
**[2026-03-30 14:38:15]** 🔧 Using tool: `unknown` — {"pattern":"**/*sandbox*stream*"}
**[2026-03-30 14:38:15]** 🔧 Using tool: `unknown` — {"pattern":"backoff|reconnect|retry|exponential","type":"ts,tsx,js,jsx","output_mode":"files_with_ma
**[2026-03-30 14:38:15]** 🔧 Using tool: `unknown` — {"pattern":"useWebSocket|useStream","type":"ts,tsx,js,jsx","output_mode":"files_with_matches"}
**[2026-03-30 14:38:19]** 🔧 Using tool: `unknown` — {"output_mode":"files_with_matches","pattern":"backoff|reconnect|retry|exponential","glob":"**/*.{ts
**[2026-03-30 14:38:19]** 🔧 Using tool: `unknown` — {"output_mode":"files_with_matches","pattern":"useWebSocket|useStream","glob":"**/*.{ts,tsx,js,jsx}"
**[2026-03-30 14:38:19]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/use-sandbox-stream.ts
**[2026-03-30 14:38:19]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/__tests__/use-sandbox-stream.test.ts
**[2026-03-30 14:38:32]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/use-websocket.ts
**[2026-03-30 14:38:32]** 🔧 Using tool: `unknown` — `find /Users/matancohen/microsoft/openspace-for-ai-squad -type f \( -name "*resilience*" -o -name "*b`
**[2026-03-30 14:38:39]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/__tests__/websocket-resilience.test.ts
**[2026-03-30 14:38:42]** 🔧 Using tool: `unknown` — `grep -r "useCallback\|useRef" /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks `
**[2026-03-30 14:38:58]** 🧠 Thinking: The explore agent says the hook already has reconnection logic. Let me verify this by reading the actual file contents to see the current state of the code.
**[2026-03-30 14:38:58]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/use-sandbox-stream.ts
**[2026-03-30 14:39:03]** 🧠 Thinking: The hook already has full exponential backoff reconnection logic implemented. Let me check the test file to see if there are tests for the reconnection logic too.
**[2026-03-30 14:39:03]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/__tests__/use-sandbox-stream.test.ts
**[2026-03-30 14:39:09]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && npx vitest run apps/web/src/hooks/__tests__`
**[2026-03-30 14:39:21]** 🧠 Thinking: The test file uses `@/hooks/use-sandbox-stream` as an import path, but this path alias isn't resolved by vitest. Let me check how other tests in this app resolve path aliases.
**[2026-03-30 14:39:21]** 🔧 Using tool: `unknown` — {"intent":"Fixing test configuration"}
**[2026-03-30 14:39:21]** 🔧 Using tool: `unknown` — {"agent_type":"explore","description":"Find vitest config for web","mode":"sync","name":"explore-vit
**[2026-03-30 14:39:25]** 🔧 Using tool: `unknown` — {"pattern":"**/vitest.config.{ts,mts,js}"}
**[2026-03-30 14:39:25]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/tsconfig.json"}
**[2026-03-30 14:39:25]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/src/hooks/__tests__/**/*.{ts,tsx}"}
**[2026-03-30 14:39:25]** 🔧 Using tool: `unknown` — {"pattern":"vitest.config.ts"}
**[2026-03-30 14:39:33]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/vitest.config.ts
**[2026-03-30 14:39:33]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/vitest.config.ts
**[2026-03-30 14:39:33]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/tsconfig.json
**[2026-03-30 14:39:33]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/__tests__/use-sandbox-stream.test.ts
**[2026-03-30 14:39:33]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/__tests__/use-websocket.test.ts
**[2026-03-30 14:39:36]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/__tests__/use-channels.test.tsx
**[2026-03-30 14:39:36]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/__tests__/hooks.test.tsx
**[2026-03-30 14:39:39]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/tsconfig.json
**[2026-03-30 14:39:39]** 🔧 Using tool: `unknown` — `grep -r "use-sandbox-stream" /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src --inclu`
**[2026-03-30 14:39:44]** 🔧 Using tool: `unknown` — `ls -la /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/ | grep -E "use-sandbox`
**[2026-03-30 14:40:03]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web && npx vitest run src/hooks/__tests__`

**[2026-03-30 14:40:34]** ✅ Bender completed this task.

**Result:**
All 17 tests pass. The reconnection logic is **already fully implemented** in `useSandboxStream`:

- **Exponential backoff**: 1s → 2s → 4s → … → 30s cap
- **Max 10 attempts** before transitioning to `'failed'` status
- **Delay reset** on successful connection
- **`retry()`** method for manual reconnect after failure
- **Clean unmount** — cancels timers, closes sockets
- **17 passing tests** covering all edge cases

This task is already done. Nothing to implement.

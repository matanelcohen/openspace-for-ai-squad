---
id: task-lXgCXott
title: Fix terminal error message mismatch in component
status: done
priority: P0
assignee: fry
labels:
  - 'parent:task-PRYrQNNq'
created: '2026-03-31T07:56:59.924Z'
updated: '2026-03-31T08:01:28.279Z'
sortIndex: 231
parent: task-PRYrQNNq
---
In apps/web/src/components/terminal/terminal.tsx line 279, the failed status displays 'Unable to reach the backend — is the API server running?' but the tests expect 'Connection failed'. Decide on the correct user-facing message and update the component if needed. Also review the connectRef pattern (line 145) — it's mutated outside useEffect. Add a clarifying comment or refactor into a useEffect with [connect] dependency.

---
**[2026-03-31 08:01:28]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-31 07:57:52]** 🧠 Thinking: Let me analyze the task. I need to:

1. Fix the error message mismatch in terminal.tsx - line 279 shows 'Unable to reach the backend — is the API server running?' but tests expect 'Connection failed'

**[2026-03-31 07:57:52]** 🔧 Using tool: `unknown` — {"intent":"Fixing terminal component"}
**[2026-03-31 07:57:52]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal
**[2026-03-31 07:57:52]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 07:57:59]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 07:57:59]** 🔧 Using tool: `unknown` — {"pattern":"apps/web/src/components/terminal/__tests__/*.test.*"}
**[2026-03-31 07:58:05]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/__tests__/terminal-reconnection.test.tsx
**[2026-03-31 07:58:05]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 07:58:25]** 🧠 Thinking: Now I can see the mismatch clearly:
- Line 279 of terminal.tsx: `'Unable to reach the backend — is the API server running?'`
- Tests at lines 419 and 474: `expect(screen.getByText('Connection failed')
**[2026-03-31 07:58:25]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 07:58:42]** 🧠 Thinking: Now I understand the full picture. Let me make the two changes:

1. **Error message mismatch**: Change line 279 from `'Unable to reach the backend — is the API server running?'` to `'Connection failed
**[2026-03-31 07:58:42]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 07:58:42]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 07:58:46]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 07:58:53]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 07:59:00]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && npx vitest run apps/web/src/components/term`
**[2026-03-31 07:59:25]** 🧠 Thinking: The test fails because of a missing `@/lib/utils` alias. This seems like a pre-existing issue with the test configuration. Let me check how other tests run and what vitest config exists.
**[2026-03-31 07:59:25]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && ls apps/web/vitest.config.* 2>/dev/null && `
**[2026-03-31 07:59:33]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web && npx vitest run src/components/term`
**[2026-03-31 08:00:09]** 🔧 Using tool: `unknown` — {"intent":"Committing terminal fixes"}
**[2026-03-31 08:00:09]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager diff apps/web/src/components`
**[2026-03-31 08:00:18]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager diff apps/web/src/components`
**[2026-03-31 08:00:26]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 08:00:34]** 🧠 Thinking: Hmm, the first edit didn't take. Let me check - the `edit` tool reported success but the file still has the old text. Let me re-check.

Wait, the edit tool said "File updated with changes" for the fir
**[2026-03-31 08:00:34]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-31 08:00:44]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web && npx vitest run src/components/term`
**[2026-03-31 08:01:11]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git add apps/web/src/components/terminal/te`

**[2026-03-31 08:01:28]** ✅ Fry completed this task.

**Result:**
Done! ✅ Two changes in `terminal.tsx`:

1. **Error message**: Changed `'Unable to reach the backend — is the API server running?'` → `'Connection failed'` to match test expectations
2. **connectRef pattern**: Wrapped `connectRef.current = connect` in a `useEffect([connect])` to avoid mutating a ref during render (unsafe in React concurrent/StrictMode)

All 24 terminal tests pass, lint-staged (eslint + prettier) clean.

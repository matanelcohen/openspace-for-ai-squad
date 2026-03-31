---
id: task-BK9Wb4e3
title: Review node-pty version change and PTY cleanup logic
status: done
priority: P1
assignee: bender
labels:
  - 'parent:task-_U_Q7gHO'
created: '2026-03-31T08:35:47.555Z'
updated: '2026-03-31T08:50:44.942Z'
sortIndex: 293
parent: task-_U_Q7gHO
---
Review bender's node-pty version change for security and stability implications. Audit the PTY cleanup-on-disconnect logic — specifically the catch block around line 103 in the terminal backend code that may be silently masking errors. Ensure proper resource cleanup (no zombie PTY processes) and that error handling is explicit. Flag any concerns with the version bump (breaking changes, CVEs, compatibility).

---
**[2026-03-31 08:50:44]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-31 08:47:06]** 🧠 Thinking: The user wants me to review:
1. A node-pty version change
2. PTY cleanup-on-disconnect logic, specifically a catch block around line 103 in the terminal backend code

Let me explore the codebase to fi
**[2026-03-31 08:47:06]** 🔧 Using tool: `unknown` — {"intent":"Reviewing PTY cleanup logic"}
**[2026-03-31 08:47:06]** 🔧 Using tool: `unknown` — {"agent_type":"explore","description":"Find PTY-related files","mode":"sync","name":"find-pty-files"
**[2026-03-31 08:47:15]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad
**[2026-03-31 08:47:15]** 🔧 Using tool: `unknown` — {"pattern":"**/terminal*.ts"}
**[2026-03-31 08:47:15]** 🔧 Using tool: `unknown` — {"pattern":"**/pty*.ts"}
**[2026-03-31 08:47:15]** 🔧 Using tool: `unknown` — {"pattern":"**/services/*.ts"}
**[2026-03-31 08:47:15]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager log --all --oneline -20`
**[2026-03-31 08:47:15]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager diff HEAD~5 -- '**/package.j`
**[2026-03-31 08:47:19]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && find . -name "*terminal*" -type f | grep -v`
**[2026-03-31 08:47:19]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && find . -path "*/apps/api/src/services*" -na`
**[2026-03-31 08:47:19]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src
**[2026-03-31 08:47:31]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/terminal.ts
**[2026-03-31 08:47:31]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/package.json
**[2026-03-31 08:47:31]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/package.json
**[2026-03-31 08:47:31]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/__tests__/terminal-lifecycle-regression.test.ts
**[2026-03-31 08:47:34]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager log --all --oneline --follow`
**[2026-03-31 08:47:34]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager log --all --grep="pty\|PTY\|`
**[2026-03-31 08:47:38]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && git --no-pager show a770758`
**[2026-03-31 08:48:16]** 🧠 Thinking: Great, I now have a thorough understanding of the codebase. Let me review:

1. **node-pty version 1.2.0-beta.12** — this is a beta version, which is concerning for production. Let me check what the la
**[2026-03-31 08:48:16]** 🔧 Using tool: `unknown` — {"max_length":3000,"url":"https://registry.npmjs.org/node-pty"}
**[2026-03-31 08:48:16]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && cat .nvmrc 2>/dev/null; node -v 2>/dev/null`
**[2026-03-31 08:48:16]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/terminal.ts
**[2026-03-31 08:48:37]** 🧠 Thinking: Now let me analyze the code in detail:

Key findings:

### 1. node-pty version 1.2.0-beta.12 concerns:
- The latest stable release is **1.1.0** (from npm dist-tags)
- The beta tag is `1.2.0-beta.12`
-
**[2026-03-31 08:48:37]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && grep -n 'terminal' apps/api/src/app.ts | he`
**[2026-03-31 08:48:37]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/__tests__/terminal-lifecycle-regression.test.ts
**[2026-03-31 08:48:53]** 🧠 Thinking: Now I have a complete picture. Let me write the code review and fix the issues.

The key issues are:

1. **Empty catch block on line 134** — silently swallows EPERM errors (the main concern raised)
2.
**[2026-03-31 08:48:53]** 🔧 Using tool: `unknown` — {"intent":"Fixing PTY cleanup bugs"}
**[2026-03-31 08:48:53]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/terminal.ts
**[2026-03-31 08:49:00]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/terminal.ts
**[2026-03-31 08:49:05]** 🔧 Using tool: `unknown` — /Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/routes/terminal.ts
**[2026-03-31 08:49:11]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && npx vitest run apps/api/src/routes/__tests_`
**[2026-03-31 08:49:22]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && npx tsc --noEmit --project apps/api/tsconfi`
**[2026-03-31 08:49:57]** 🔧 Using tool: `unknown` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad && npx tsc --noEmit --project apps/api/tsconfi`

**[2026-03-31 08:50:44]** ✅ Bender completed this task.

**Result:**


Zero type errors in `terminal.ts`. The pre-existing errors are all in `escalations.ts` and `agents.ts` — unrelated.

---

## Review Summary

**Fixed 2 bugs, flagged 1 advisory.**

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | 🔴 HIGH | Force-kill catch block (line 134) silently swallowed `EPERM` — zombie PTYs could persist undetected | Now only ignores `ESRCH`; logs `error` level for anything else |
| 2 | 🟡 MED | `term.write()`/`term.resize()` had no try/catch — TOCTOU race if PTY dies between `ptyAlive` check and the call | Wrapped in try/catch, sets `ptyAlive = false` on failure |
| 3 | ℹ️ INFO | `node-pty@1.2.0-beta.12` is beta (stable is `1.1.0`) | Justified for macOS arm64 + Node 22. No CVEs found. Revisit when 1.2.0 stable ships. |

**40 tests passing. 0 type errors in terminal.ts.**

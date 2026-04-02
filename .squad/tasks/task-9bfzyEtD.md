---
id: task-9bfzyEtD
title: Fix exec() shell injection and sandbox transformScript
status: in-review
priority: P0
assignee: bender
labels:
  - 'parent:task-Urssjc5k'
created: '2026-04-02T10:16:01.695Z'
updated: '2026-04-02T10:19:50.128Z'
sortIndex: 3
parent: task-Urssjc5k
---
In apps/api/src/services/tool-registry/custom-tool-provider.ts: (1) Replace `exec(fullCommand)` at ~line 145 with `execFile()` using an argv array — split the command and arguments properly so no shell interpolation occurs, and validate/escape all substituted parameters. (2) Replace `new Function('content', 'params', config.transformScript)` at ~line 209 with Node's `vm.runInNewContext()` using a frozen, minimal context (only expose `content` and `params`, no `require`, no `process`, no globals). Add a timeout (e.g. 1000ms) to prevent infinite loops. If vm sandboxing proves too complex, remove the transformScript feature entirely and throw a clear error. Add input validation for both paths.

---
**[2026-04-02 10:19:50]** 🚀 Bender started working on this task.

**Progress:**
**[2026-04-02 10:16:16]** 🧠 Thinking: Let me analyze the task. I need to fix two security vulnerabilities in `apps/api/src/services/tool-registry/custom-tool-provider.ts`:

1. Replace `exec(fullCommand)` with `execFile()` using argv array to prevent shell injection
2. Replace `new Function()` with `vm.runInNewContext()` for sandboxing transformScript

Let me start by examining the file.
**[2026-04-02 10:16:16]** 🔧 Using tool: `report_intent` — {"intent":"Fixing shell injection vulnerabilities"}
**[2026-04-02 10:16:16]** 🔧 Using tool: `view` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/custom-tool-provider.ts
**[2026-04-02 10:16:16]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK && ls node_modules/.package-lock.json 2>/dev/null || echo "NO_NODE_MODULES"`
**[2026-04-02 10:16:16]** ✅ Tool result: [object Object]
**[2026-04-02 10:16:16]** ✅ Tool result: [object Object]
**[2026-04-02 10:16:17]** ✅ Tool result: [object Object]
**[2026-04-02 10:16:31]** 🧠 Thinking: I need to:
1. Replace `exec(fullCommand)` with `execFile()` using argv array
2. Replace `new Function()` with `vm.runInNewContext()` 
3. Add input validation

Let me also check the types file to understand the interfaces, and install dependencies.
**[2026-04-02 10:16:31]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK && pnpm install --frozen-lockfile 2>&1 | tail -5`
**[2026-04-02 10:16:31]** 🔧 Using tool: `task` — {"agent_type":"explore","description":"Explore tool registry types","mode":"sync","name":"explore-types","prompt":"In the repo at /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK, find the types file for the tool-registry service. Specifically I need the interfaces: CliCommandExecution, FileProcessorExecution, and any related types. The types file is likely at apps/api/src/services/tool-registry/types.ts or similar. Show me the full content of the relevant type definitions."}
**[2026-04-02 10:16:35]** 🔧 Using tool: `glob` — {"pattern":"**/tool-registry/types.ts"}
**[2026-04-02 10:16:35]** 🔧 Using tool: `glob` — {"pattern":"**/tool-registry/*.ts"}
**[2026-04-02 10:16:42]** ✅ Tool result: [object Object]
**[2026-04-02 10:16:44]** ✅ Tool result: [object Object]
**[2026-04-02 10:16:47]** 🔧 Using tool: `view` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/types.ts
**[2026-04-02 10:16:47]** ✅ Tool result: [object Object]
**[2026-04-02 10:16:48]** ✅ Tool result: [object Object]
**[2026-04-02 10:16:58]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:03]** 🧠 Thinking: Now I have a clear picture. Let me also check if there are existing tests for this file.
**[2026-04-02 10:17:03]** 🔧 Using tool: `glob` — {"pattern":"**/*custom-tool-provider*test*"}
**[2026-04-02 10:17:03]** 🔧 Using tool: `glob` — {"pattern":"**/*custom-tool-provider*spec*"}
**[2026-04-02 10:17:03]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:03]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:07]** 🔧 Using tool: `view` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/__tests__/custom-tool-provider.test.ts
**[2026-04-02 10:17:07]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:12]** 🔧 Using tool: `view` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/__tests__/custom-tool-provider.test.ts
**[2026-04-02 10:17:12]** 🔧 Using tool: `grep` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/__tests__/custom-tool-provider.test.ts
**[2026-04-02 10:17:12]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:12]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:19]** 🧠 Thinking: Let me see the full test file to understand what tests I need to adapt, especially for the CLI command and file-processor transform tests.
**[2026-04-02 10:17:19]** 🔧 Using tool: `view` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/__tests__/custom-tool-provider.test.ts
**[2026-04-02 10:17:19]** 🔧 Using tool: `view` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/__tests__/custom-tool-provider.test.ts
**[2026-04-02 10:17:20]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:21]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:51]** 🧠 Thinking: Now I have a clear picture. Let me now implement the fixes:

1. **Replace `exec()` with `execFile()`**: Use `execFile` from `node:child_process` which takes command and args separately, avoiding shell injection. I also need to validate parameters to prevent injection through substituted values.

2. **Replace `new Function()` with `vm.runInNewContext()`**: Use Node's `vm` module to sandbox the transform script. The script currently uses `return content.toUpperCase();` style, so I need to wrap it in a function expression for `vm.runInNewContext()`.

Let me also add input validation for:


- CLI command: validate the command is not empty, and with `execFile` I don't need to worry about shell metacharacters since there's no shell involved
- transformScript: validate it's a string

For the `vm.runInNewContext()` approach, I need to convert the current `new Function` pattern into a sandboxed execution. The existing code creates a function with `content` and `params` parameters, so I'll need to wrap the script body in a function expression that `vm.runInNewContext()` can execute safely.

Setting up the sandbox... Setting up the execFile call with the command, arguments, and options like working directory, timeout, and environment variables, then handling the callback with error and output. For validation, I need to check that CLI commands don't have path traversal or null bytes, and that params are free of null bytes across both approaches. Since execFile doesn't invoke a shell, shell metacharacters in parameters won't be interpreted, so I mainly need to focus on null byte validation there.

Now I'm reconsidering how the existing tests will behave with execFile instead of exec. The test that runs `ls` with an invalid flag should still work since execFile searches PATH for the command. For the echo tests, execFile will pass arguments directly to the executable rather than through shell interpretation, so I need to verify the behavior matches what's expected.

I'm going to add null byte validation to the parameter substitution function to catch any malicious input early, and then implement similar checks in the CLI command execution to ensure we're not passing dangerous values through to the system.

Adding validation logic...
**[2026-04-02 10:17:51]** 🔧 Using tool: `report_intent` — {"intent":"Implementing security fixes"}
**[2026-04-02 10:17:51]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/custom-tool-provider.ts
**[2026-04-02 10:17:51]** ✅ Tool result: [object Object]
**[2026-04-02 10:17:51]** ✅ Tool result: [object Object]
**[2026-04-02 10:18:02]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/custom-tool-provider.ts
**[2026-04-02 10:18:02]** ✅ Tool result: [object Object]
**[2026-04-02 10:18:14]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/custom-tool-provider.ts
**[2026-04-02 10:18:14]** ✅ Tool result: [object Object]
**[2026-04-02 10:18:25]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/custom-tool-provider.ts
**[2026-04-02 10:18:26]** ✅ Tool result: [object Object]
**[2026-04-02 10:18:30]** 🔧 Using tool: `view` — /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK/apps/api/src/services/tool-registry/custom-tool-provider.ts
**[2026-04-02 10:18:31]** ✅ Tool result: [object Object]
**[2026-04-02 10:18:36]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK && pnpm vitest run apps/api/src/services/tool-registry/__tests__/custom-tool-provider.test.ts 2>&1 | tail -40`
**[2026-04-02 10:18:41]** ✅ Tool result: [object Object]
**[2026-04-02 10:18:46]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK && pnpm turbo build --filter='./apps/api' 2>&1 | tail -20`
**[2026-04-02 10:18:53]** ✅ Tool result: [object Object]
**[2026-04-02 10:18:58]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK && npx tsc --noEmit --project apps/api/tsconfig.json 2>&1 | head -20`
**[2026-04-02 10:19:05]** ✅ Tool result: [object Object]
**[2026-04-02 10:19:10]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK && npx tsc --noEmit --project apps/api/tsconfig.json 2>&1 | grep -c "custom-tool-provider"`
**[2026-04-02 10:19:16]** ✅ Tool result: [object Object]
**[2026-04-02 10:19:24]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK && git add apps/api/src/services/tool-registry/custom-tool-provider.ts && git commit -m "fix: replace exec() with execFile() and sandbox transformScript with vm

- Replace exec(fullCommand) with execFile(command, args) to prevent
  shell injection — arguments are passed as an array, no shell involved
- Replace new Function() with vm.runInNewContext() using a frozen,
  minimal context (only content and params exposed, no require/process/globals)
- Add 1000ms timeout to vm execution to prevent infinite loops
- Add null-byte validation on command strings and substituted parameters

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>" 2>&1`
**[2026-04-02 10:19:35]** ✅ Tool result: [object Object]
**[2026-04-02 10:19:41]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-9bfzyEtD--30582-FMlerA7F3RiK && git --no-pager log --oneline -1`
**[2026-04-02 10:19:42]** ✅ Tool result: [object Object]
**Branch:** `task/task-9bfzyEtD`

**[2026-04-02 10:19:50]** ✅ Bender completed this task.

**Result:**
Done. Here's what I did:

**1. Shell injection fix** — Replaced `exec(fullCommand)` with `execFile(command, args)`. Arguments are passed as an array directly to the process, bypassing the shell entirely. No shell metacharacters can be interpreted.

**2. transformScript sandbox** — Replaced `new Function()` with `vm.runInNewContext()`. The script runs in an isolated context with only `content` and `params` exposed (frozen). No access to `require`, `process`, or any Node globals. Added a 1000ms timeout to prevent infinite loops.

**3. Input validation** — Added null-byte validation on CLI commands and all substituted parameters.

All 49 existing tests pass, zero new TS errors introduced.

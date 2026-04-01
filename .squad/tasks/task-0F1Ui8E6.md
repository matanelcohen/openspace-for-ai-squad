---
id: task-0F1Ui8E6
title: Redesign trace detail UI for rich span visibility
status: blocked
priority: P0
assignee: fry
labels:
  - 'parent:task-gQvmERyq'
created: '2026-04-01T09:19:43.959Z'
updated: '2026-04-01T09:24:12.910Z'
sortIndex: 346
parent: task-gQvmERyq
---
Overhaul the trace detail frontend to show much richer information at a glance:

1. **Fix span labels in waterfall**: In `apps/web/src/components/traces/trace-detail.tsx`, show the actual tool name (e.g., 'Web Search') instead of generic 'tool'. Display format: `kind_icon tool_name` for tools, `kind_icon model_name` for LLM spans.
2. **Inline previews on waterfall rows**: Show a truncated input/output preview (use new `inputPreview`/`outputPreview` fields) directly on each waterfall row beneath the span name in a muted smaller font. This lets users scan what happened without clicking each span.
3. **Enhanced span detail panel**: 
   - Add copy-to-clipboard buttons for Input and Output JSON tabs
   - Show formatted JSON with syntax highlighting (use a lightweight JSON viewer or `<pre>` with color)
   - Add an 'Events' tab showing span events (exceptions with stack traces, streaming milestones)
   - Show input/output byte sizes
   - For LLM spans: show model, provider, time-to-first-token, streaming indicator
   - For tool spans: show tool ID, tool duration prominently
4. **Add span kind filter/legend**: Add a row of toggleable kind badges (agent/tool/llm/reasoning) above the waterfall to filter which span types are visible.
5. **Error enhancement**: For error spans, show the full error message and stack trace in a red-tinted expandable section, not just the error string.
6. **Token & cost badges**: Show small token count and cost badges inline on LLM spans in the waterfall.

Key files: `apps/web/src/components/traces/trace-detail.tsx`, `apps/web/src/lib/trace-types.ts`.

---
**[2026-04-01 09:19:43]** 🚀 Fry started working on this task.
**[2026-04-01 09:19:43]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:23:40]** 🚀 Fry started working on this task.
**[2026-04-01 09:23:40]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:23:40]** 🚀 Fry started working on this task.
**[2026-04-01 09:23:40]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:23:59]** 🚀 Fry started working on this task.
**[2026-04-01 09:23:59]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:24:07]** ❌ **BLOCKED** — fry failed.

**Error:** Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-0F1Ui8E6' -b 'task/task-0F1Ui8E6' 'feature/task-gQvmERyq'
Preparing worktree (new branch 'task/task-0F1Ui8E6')
fatal: a branch named 'task/task-0F1Ui8E6' already exists


**Stack:** ```
Error: Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-0F1Ui8E6' -b 'task/task-0F1Ui8E6' 'feature/task-gQvmERyq'
Preparing worktree (new branch 'task/task-0F1Ui8E6')
fatal: a branch named 'task/task-0F1Ui8E6' already exists

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at WorktreeServ
```

---
**[2026-04-01 09:24:12]** ❌ **BLOCKED** — fry failed.

**Error:** Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-0F1Ui8E6' -b 'task/task-0F1Ui8E6' 'feature/task-gQvmERyq'
Preparing worktree (new branch 'task/task-0F1Ui8E6')
fatal: a branch named 'task/task-0F1Ui8E6' already exists


**Stack:** ```
Error: Command failed: git worktree add '/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-0F1Ui8E6' -b 'task/task-0F1Ui8E6' 'feature/task-gQvmERyq'
Preparing worktree (new branch 'task/task-0F1Ui8E6')
fatal: a branch named 'task/task-0F1Ui8E6' already exists

    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at execSync (node:child_process:988:15)
    at WorktreeServ
```

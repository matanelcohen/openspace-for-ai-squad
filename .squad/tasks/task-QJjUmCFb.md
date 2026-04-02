---
id: task-QJjUmCFb
title: Install rehype-sanitize and create shared SafeMarkdown component
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-CPKbMuye'
created: '2026-04-02T02:02:55.200Z'
updated: '2026-04-02T02:19:25.411Z'
sortIndex: 595
parent: task-CPKbMuye
---
Install `rehype-sanitize` in apps/web (`pnpm add rehype-sanitize`). Create a reusable `SafeMarkdown` component at `apps/web/src/components/ui/safe-markdown.tsx` that wraps `react-markdown` with `rehypePlugins={[rehypeSanitize]}` and `remarkPlugins={[remarkGfm]}` as defaults. Also export a `sanitizeRehypePlugin` for use with `@assistant-ui/react-markdown`'s `MarkdownTextPrimitive`. Then update ALL 4 affected files to use it:

1. `apps/web/app/tasks/[id]/page.tsx` (lines 685, 707) — replace `<Markdown remarkPlugins={[remarkGfm]}>` with `<SafeMarkdown>`
2. `apps/web/app/team-members/[id]/page.tsx` (lines 310, 359) — replace `<ReactMarkdown remarkPlugins={[remarkGfm]}>` with `<SafeMarkdown>`
3. `apps/web/src/components/tasks/task-form-dialog.tsx` (line 188) — replace `<Markdown remarkPlugins={[remarkGfm]}>` with `<SafeMarkdown>`
4. `apps/web/src/components/assistant-ui/markdown-text.tsx` (line 20) — add `rehypePlugins={[rehypeSanitize]}` to `<MarkdownTextPrimitive>`

Remove now-unused direct imports of `react-markdown` and `remark-gfm` from each updated file. Ensure the build passes (`pnpm build --filter web`).

---
**[2026-04-02 02:02:56]** 🚀 Fry started working on this task.
**[2026-04-02 02:02:56]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:19:25]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```

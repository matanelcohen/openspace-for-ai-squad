---
id: task-fL-78Och
title: Wire CodeReviewService into agent-worker post-PR flow
status: pending
priority: P0
assignee: 'null'
labels:
  - 'parent:task-l8ICv8lq'
created: '2026-03-31T21:21:03.708Z'
updated: '2026-03-31T22:40:40.311Z'
sortIndex: 343
parent: task-l8ICv8lq
---
In `apps/api/src/services/agent-worker/index.ts`, after the PR is successfully created (around line 663-672, after `prInfo = await wts.createPR(...)`): 1) Add `codeReviewService?: CodeReviewService` to the AgentWorker config interface. 2) After PR creation succeeds and prInfo is set, trigger review: `if (this.config.codeReviewService && prInfo) { this.config.codeReviewService.reviewPR(prInfo.number, { title: task.title, agentName: agent.name }).catch(err => console.warn('[AgentWorker] Code review failed:', err)); }`. The review runs async (fire-and-forget) so it doesn't block task completion. 3) Add `code-review` capability to zoidberg in squad.config.ts. 4) Wire CodeReviewService instantiation in the server bootstrap (wherever AgentWorker is constructed — find and update). Only review agent-created PRs — the guard is simply that this code path only executes when prInfo exists from agent-created worktree flow.

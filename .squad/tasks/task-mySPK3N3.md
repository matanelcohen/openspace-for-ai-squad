---
id: task-mySPK3N3
title: Add batch agent-skills endpoint
status: blocked
priority: P2
assignee: bender
labels:
  - 'parent:task-HprYEdcG'
created: '2026-04-02T02:00:40.643Z'
updated: '2026-04-02T02:16:18.028Z'
sortIndex: 590
parent: task-HprYEdcG
---
In `apps/api/src/routes/agents.ts`, add a new `GET /api/agents/skills/batch` endpoint that accepts an optional `agentIds` query param (comma-separated) and returns an array of `AgentSkillsResponse` objects — one per agent. Reuse the existing per-agent logic from the `GET /api/agents/:id/skills` handler (lines 226-260) but loop over all requested agents in a single request. If no `agentIds` param is provided, return skills for all agents. Also implement the missing `PUT /api/agents/:id/skills/bulk-toggle` endpoint that the frontend hook `useBulkToggleAgentSkills` (use-skills.ts:169-197) already declares.

---
**[2026-04-02 02:00:42]** 🚀 Bender started working on this task.
**[2026-04-02 02:00:42]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 02:16:18]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```

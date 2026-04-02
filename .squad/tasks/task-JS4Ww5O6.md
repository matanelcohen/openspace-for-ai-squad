---
id: task-JS4Ww5O6
title: Test batch fetching and dynamic agent support
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-HprYEdcG'
created: '2026-04-02T02:00:42.502Z'
updated: '2026-04-02T02:00:42.523Z'
sortIndex: 592
parent: task-HprYEdcG
dependsOn:
  - task-sX4wzIy9
---
Verify the fixes in both the API and frontend:

1. **API test**: Add/extend tests for `GET /api/agents/skills/batch` — confirm it returns correct skills for all agents in one response, and that the optional `agentIds` filter works.

2. **N+1 elimination test**: In the skills detail page test, mock 6+ agents and assert only ONE `/api/agents/skills/batch` network call is made (not N individual calls).

3. **Dynamic agent count test**: In skill-grid tests, render with 6 agents and assert all 6 appear in the grid (not just 4). Confirm no console errors or silent truncation.

4. **Regression**: Ensure toggling a skill on/off for an agent still works correctly after the refactor.

---
id: task-c4ckpGIx
title: Test error handling and validation in MCP server tool handlers
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-IrA_Pt-f'
created: '2026-04-02T11:07:33.614Z'
updated: '2026-04-02T11:07:33.617Z'
sortIndex: 81
parent: task-IrA_Pt-f
dependsOn:
  - task-5Nm7QuIb
---
Write tests for the MCP server tool handlers in packages/mcp-server to verify: (1) all 6 fixed handlers (list_agents, get_agent, list_tasks, get_task, list_decisions, get_squad_status) properly throw or return an error when the HTTP response is not ok (4xx/5xx), (2) update_task_status rejects invalid status values that aren't in the enum, and (3) update_task_status still accepts all valid status values. Mock fetch responses to simulate error scenarios. Run existing tests first to confirm nothing is broken.

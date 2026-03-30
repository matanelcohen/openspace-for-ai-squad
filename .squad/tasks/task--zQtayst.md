---
id: task--zQtayst
title: Dynamic Tool Registry
status: pending
priority: P1
assignee: bender
labels:
  - agent-infra
  - tools
  - registry
created: '2026-03-25T23:18:08.618Z'
updated: '2026-03-30T08:33:24.869Z'
sortIndex: 4
---
Build a runtime tool registry where agents discover and invoke tools dynamically (git, search, APIs, file ops). Tools are registered with schemas, agents select them based on task context. Inspired by Composio and LangChain tool patterns. Should support adding custom tools via config.

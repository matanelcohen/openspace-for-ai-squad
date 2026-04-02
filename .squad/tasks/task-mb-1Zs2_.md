---
id: task-mb-1Zs2_
title: Test attribute truncation and error recording
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-h4zvhYWj'
created: '2026-04-02T11:06:58.901Z'
updated: '2026-04-02T11:06:58.904Z'
sortIndex: 76
parent: task-h4zvhYWj
dependsOn:
  - task-vkuviobY
---
Write tests for the tracing changes: 1) Test that the truncateAttribute helper correctly truncates strings over 4KB and leaves shorter strings unchanged. 2) Test that instrument-llm span attributes are truncated when given a large (>4KB) LLM response. 3) Test that instrument-llm records exceptions on the span when the wrapped function throws (matching instrument-tool behavior). 4) Test that 1000 spans with large outputs stay well under 100MB total memory. Look at existing test patterns in packages/tracing/ for conventions.

---
id: task-G7D1pWp7
title: Add tests for XSS safety and rendering correctness of SyntaxHighlightedJson
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-L8xCN_RD'
created: '2026-04-02T11:10:43.382Z'
updated: '2026-04-02T11:10:43.384Z'
sortIndex: 95
parent: task-L8xCN_RD
dependsOn:
  - task-bXkzNdCL
---
After the frontend refactor is complete, write tests for the updated SyntaxHighlightedJson component. Test cases should include: (1) Normal JSON renders correctly with proper syntax highlighting spans, (2) JSON containing HTML-like strings (e.g. '<script>alert(1)</script>' as a value) renders safely as text without executing, (3) JSON with special characters (&, <, >, quotes) displays correctly, (4) Deeply nested JSON objects render without errors, (5) Verify dangerouslySetInnerHTML is no longer used anywhere in trace-detail.tsx (grep/static check). Use the existing test framework (vitest). Run the full test suite to ensure no regressions.

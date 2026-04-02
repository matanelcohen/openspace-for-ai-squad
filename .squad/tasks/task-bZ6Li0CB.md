---
id: task-bZ6Li0CB
title: Test XSS fix in trace detail JSON highlighter
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-dtKSjadt'
created: '2026-04-02T02:12:53.826Z'
updated: '2026-04-02T02:12:53.830Z'
sortIndex: 615
parent: task-dtKSjadt
dependsOn:
  - task-F_HacHaW
---
After the frontend fix lands, verify the XSS vulnerability is eliminated and the component still works correctly. Tests to write/run: (1) Create a unit test for the SyntaxHighlightedJson component (or its replacement) that passes malicious JSON payloads containing XSS vectors — strings with <script> tags, event handlers like onerror, and regex replacement pattern attacks using $& and $` characters — and assert no raw HTML is injected into the DOM. (2) Verify the ESLint rule catches dangerouslySetInnerHTML — add a temporary test file with dangerouslySetInnerHTML and confirm the linter flags it, then remove the test file. (3) Run the existing test suite to confirm no regressions. The trace detail view should still render JSON with proper syntax highlighting visually.

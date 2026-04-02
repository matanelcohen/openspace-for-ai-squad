---
id: task-6Qqhs1PZ
title: Test error boundaries catch and recover from errors
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-63HS6fKU'
created: '2026-04-02T10:31:26.791Z'
updated: '2026-04-02T10:31:26.795Z'
sortIndex: 29
parent: task-63HS6fKU
dependsOn:
  - task-_alaMkL5
---
Write tests verifying the new error.tsx boundaries work correctly: (1) For each error.tsx (global, settings, traces, chat), write a test that simulates a rendering error in a child component and asserts the error boundary catches it and renders recovery UI instead of crashing. (2) Test that the 'Try again' (reset) button re-renders the route. (3) Test that the 'Go home' link navigates to '/'. (4) Verify that errors in settings/traces/chat are caught by their specific boundary, not the global one. Use the existing test framework in the repo (vitest + testing-library or playwright as appropriate).

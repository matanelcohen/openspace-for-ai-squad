---
id: task-pzmg8uBA
title: Add tests for multi-theme switching functionality
status: pending
priority: P1
assignee: zoidberg
labels:
  - theme
  - testing
  - qa
  - 'parent:task-y3BEyz6t'
created: '2026-03-31T09:27:50.703Z'
updated: '2026-03-31T09:27:50.703Z'
sortIndex: 301
---
Write tests covering: 1) ThemeProvider renders with correct theme class on html/body, 2) Theme selector dropdown shows all available themes and switches between them, 3) Theme persists across page reloads (localStorage), 4) System theme preference is respected as default, 5) CSS variables resolve correctly for each theme (spot-check key tokens like --background, --primary). Use existing test framework in the repo.

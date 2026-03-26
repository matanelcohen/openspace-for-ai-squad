---
id: task-Ngsv-T8c
title: Visual regression and interaction tests for chat input
status: pending-approval
priority: P1
assignee: zoidberg
labels:
  - testing
  - e2e
  - chat
  - qa
  - 'parent:task-vtSOSCNr'
created: '2026-03-26T09:57:53.134Z'
updated: '2026-03-26T09:57:53.134Z'
sortIndex: 175
---
Write E2E tests (Playwright, already configured via playwright.config.ts) covering: input renders correctly, auto-grows on multiline, Enter sends message, Shift+Enter adds newline, send button appears when text is present, mic button toggles recording state, and disabled states render properly. Cover both the MessageInput and Composer surfaces. Add snapshot or visual comparison if the project supports it.

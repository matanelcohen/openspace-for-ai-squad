---
id: task-qwrxtdjY
title: Test XSS prevention across all Markdown renderers
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-CPKbMuye'
created: '2026-04-02T02:02:55.768Z'
updated: '2026-04-02T02:02:55.780Z'
sortIndex: 596
parent: task-CPKbMuye
dependsOn:
  - task-QJjUmCFb
---
Write tests to verify that stored XSS is blocked in all 5 Markdown render sites. Create a test file at `apps/web/src/components/ui/__tests__/safe-markdown.test.tsx` (or similar) that renders the `SafeMarkdown` component with known XSS payloads and asserts the malicious content is stripped:

Payloads to test:
- `<script>alert('xss')</script>` — must be stripped entirely
- `<img src=x onerror="alert('xss')" />` — onerror attribute must be removed
- `<a href="javascript:alert('xss')">click</a>` — javascript: href must be sanitized
- `<iframe src="evil.com"></iframe>` — iframe must be stripped
- `<div onmouseover="alert('xss')">hover</div>` — event handler must be removed
- Valid markdown like `**bold**`, `[link](https://safe.com)`, `` `code` `` — must render correctly

Run with `pnpm test` or `pnpm vitest` and ensure all tests pass. Also manually verify the build succeeds.

---
id: task-M2FpK1Hn
title: Test cron memoization and validation
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-Byck8llE'
created: '2026-04-02T03:59:48.849Z'
updated: '2026-04-02T03:59:48.852Z'
sortIndex: 683
parent: task-Byck8llE
dependsOn:
  - task-FgmrEpFw
---
Add tests for the cron page changes in `apps/web`:

1. **Unit-test `getNextCronRuns` caching**: Verify that calling with the same expression twice returns the same result without re-computing (e.g., spy on internals or measure timing). Test cache eviction when exceeding the size cap.

2. **Unit-test `validateCronExpression`**: Test cases for: valid expressions (`'*/5 * * * *'`, `'0 9 * * 1-5'`), invalid field count (`'* *'`), out-of-range values (`'60 * * * *'`, `'* 25 * * *'`), invalid characters (`'a b c d e'`), edge cases (empty string, extra spaces).

3. **Component-level test**: Verify that validation error messages appear when an invalid cron expression is entered in the Create/Edit dialogs, and disappear when corrected.

Use the existing test framework (vitest). Place tests alongside or in the standard test directory for `apps/web`.

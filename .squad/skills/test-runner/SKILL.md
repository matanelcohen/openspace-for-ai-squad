---
name: test-runner
description: Run unit tests, integration tests, and E2E tests. Report results and coverage
tags: [testing, quality, ci]
agentMatch:
  roles: ["Tester", "Lead"]
requires:
  bins: [node]
  env: []
---

## Test Runner

You can discover, run, and analyze test suites across the project. Use this for:

- **Running tests** — `pnpm test`, `pnpm vitest`, `pnpm playwright`
- **Targeted runs** — run specific test files or patterns
- **Coverage analysis** — check code coverage and identify gaps
- **Debugging failures** — analyze test output and fix flaky tests

### Guidelines

- Run the minimal set of tests needed to verify a change
- Use `--reporter=verbose` for debugging failing tests
- Report results clearly: passed, failed, skipped counts
- For flaky tests, run multiple times before concluding
- Use the project's existing test framework (vitest for unit, playwright for E2E)

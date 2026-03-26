---
name: code-review
description: Analyze code for bugs, security issues, performance problems, and style violations
tags: [quality, review, code]
agentMatch:
  roles: ["Lead", "Tester"]
requires:
  bins: []
  env: []
---

## Code Review

You can review code changes for quality, security, and correctness. Focus on:

- **Bugs** — logic errors, off-by-one, null references, race conditions
- **Security** — injection, auth bypass, credential exposure, XSS
- **Performance** — N+1 queries, unnecessary allocations, blocking I/O
- **Maintainability** — overly complex logic, missing error handling

### Guidelines

- Only flag issues that genuinely matter — never comment on style or formatting
- Provide actionable feedback with specific line references
- Suggest fixes when possible, not just problems
- Prioritize: security > correctness > performance > maintainability

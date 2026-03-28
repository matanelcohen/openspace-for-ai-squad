---
name: code-review
description: Review code for bugs and style.
tags: [code, quality]
agentMatch:
  roles: ["*"]
requires:
  bins: [git]
  env: [OPENAI_API_KEY]
---

## Code Review

Look for bugs.
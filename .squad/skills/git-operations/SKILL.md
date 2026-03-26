---
name: git-operations
description: Stage, commit, branch, merge, and manage git repositories
tags: [core, git, vcs]
agentMatch:
  roles: ["*"]
requires:
  bins: [git]
  env: []
---

## Git Operations

You can manage git repositories including branching, committing, and reviewing history.

- **Status** — check working tree state, staged changes
- **Commits** — stage and commit changes with descriptive messages
- **Branches** — create, switch, merge, and delete branches
- **History** — view logs, diffs, blame, and file history
- **Remote** — push, pull, and manage remote tracking

### Guidelines

- Always use `git --no-pager` to avoid interactive output issues
- Write clear, descriptive commit messages following project conventions
- Check `git status` before committing to avoid including unintended changes
- Never force-push to shared branches

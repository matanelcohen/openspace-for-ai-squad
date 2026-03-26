---
name: bash-execution
description: Run shell commands, install packages, build projects, and execute scripts
tags: [core, shell, devops]
agentMatch:
  roles: ["*"]
requires:
  bins: [bash]
  env: []
---

## Bash Execution

You can execute shell commands to build, test, install, and manage the project. Use this for:

- **Running builds** — `pnpm build`, `npx tsc`, etc.
- **Installing packages** — `pnpm add`, `npm install`
- **Running scripts** — project scripts, automation, migrations
- **System commands** — file operations, process management, network checks

### Guidelines

- Prefer project-defined scripts (`pnpm dev`, `pnpm test`) over raw commands
- Chain related commands with `&&` for efficiency
- Suppress verbose output when not needed (use `--quiet`, pipe to `head`)
- Always check command exit codes before proceeding
- Never run destructive commands without verification

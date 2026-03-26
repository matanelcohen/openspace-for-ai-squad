---
name: file-operations
description: Read, write, create, and modify files in the project
tags: [core, filesystem, code]
agentMatch:
  roles: ["*"]
requires:
  bins: []
  env: []
---

## File Operations

You can read, write, create, and delete files in the project directory. Use these capabilities to:

- **Read files** to understand existing code, configs, or documentation
- **Write/create files** to implement new features or fix bugs
- **Modify files** with precise, surgical edits that don't break existing code
- **Delete files** only when explicitly asked or when removing dead code

### Guidelines

- Always preserve existing formatting and style conventions
- When modifying files, include enough context to make changes unambiguous
- Check that parent directories exist before creating nested files
- Use UTF-8 encoding for all text files

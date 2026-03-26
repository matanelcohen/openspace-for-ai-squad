# MCP Integration — Configuration and Samples

MCP (Model Context Protocol) servers extend Squad with tools for external services — Trello, Aspire dashboards, Azure, Notion, and more. The user configures MCP servers in their environment; Squad discovers and uses them.

> **Full patterns:** Read `.squad/skills/mcp-tool-discovery/SKILL.md` for discovery patterns, domain-specific usage, and graceful degradation.

## Config File Locations

Users configure MCP servers at these locations (checked in priority order):
1. **Repository-level:** `.copilot/mcp-config.json` (team-shared, committed to repo)
2. **Workspace-level:** `.vscode/mcp.json` (VS Code workspaces)
3. **User-level:** `~/.copilot/mcp-config.json` (personal)
4. **CLI override:** `--additional-mcp-config` flag (session-specific)

## Sample Config — openspace.ai (This Squad)

The squad's own MCP server. Exposes squad tools (tasks, agents, decisions, chat) to external AI clients.

### stdio transport (recommended for local dev)

```json
{
  "mcpServers": {
    "openspace": {
      "command": "npx",
      "args": ["--yes", "-w", "packages/mcp-server", "openspace-mcp"],
      "env": {
        "OPENSPACE_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### SSE transport (remote / multi-client)

First start the SSE server: `pnpm --filter @openspace/mcp-server start:sse`

```json
{
  "mcpServers": {
    "openspace": {
      "type": "sse",
      "url": "http://localhost:3002/sse"
    }
  }
}
```

**Available tools:** `list_agents`, `get_agent`, `list_tasks`, `get_task`, `create_task`, `update_task_status`, `list_decisions`, `send_chat_message`, `get_squad_status`

**Available resources:** `openspace://squad`, `openspace://agents`, `openspace://tasks`, `openspace://decisions`

**Environment variables:** `OPENSPACE_API_URL` (default `http://localhost:3001`), `MCP_PORT` (SSE only, default `3002`)

## Sample Config — Trello

```json
{
  "mcpServers": {
    "trello": {
      "command": "npx",
      "args": ["-y", "@trello/mcp-server"],
      "env": {
        "TRELLO_API_KEY": "${TRELLO_API_KEY}",
        "TRELLO_TOKEN": "${TRELLO_TOKEN}"
      }
    }
  }
}
```

## Sample Config — GitHub

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## Sample Config — Azure

```json
{
  "mcpServers": {
    "azure": {
      "command": "npx",
      "args": ["-y", "@azure/mcp-server"],
      "env": {
        "AZURE_SUBSCRIPTION_ID": "${AZURE_SUBSCRIPTION_ID}",
        "AZURE_CLIENT_ID": "${AZURE_CLIENT_ID}",
        "AZURE_CLIENT_SECRET": "${AZURE_CLIENT_SECRET}",
        "AZURE_TENANT_ID": "${AZURE_TENANT_ID}"
      }
    }
  }
}
```

## Sample Config — Aspire

```json
{
  "mcpServers": {
    "aspire": {
      "command": "npx",
      "args": ["-y", "@aspire/mcp-server"],
      "env": {
        "ASPIRE_DASHBOARD_URL": "${ASPIRE_DASHBOARD_URL}"
      }
    }
  }
}
```

## Authentication Notes

- **GitHub MCP requires a separate token** from the `gh` CLI auth. Generate at https://github.com/settings/tokens
- **Trello requires API key + token** from https://trello.com/power-ups/admin
- **Azure requires service principal credentials** — see Azure docs for setup
- **Aspire uses the dashboard URL** — typically `http://localhost:18888` during local dev

Auth is a real blocker for some MCP servers. Users need separate tokens for GitHub MCP, Azure MCP, Trello MCP, etc. This is a documentation problem, not a code problem.

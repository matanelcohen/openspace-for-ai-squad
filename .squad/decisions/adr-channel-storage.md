# ADR: Channel Storage Schema & CRUD API Contract

**Author:** Leela (Lead)
**Date:** 2026-03-25
**Status:** Active
**Task:** P1 — Channel storage schema and CRUD API contract

---

## Context

Channels are group chat conversations containing a subset of the agent team. They need persistent storage that integrates with the existing `.squad/`-as-source-of-truth architecture while supporting fast queries and real-time updates.

## Decision

### Storage Strategy: Dual Persistence (files + SQLite cache)

Channels use the same dual-persistence pattern as tasks and decisions:

| Layer | Role | Location |
|-------|------|----------|
| **`.squad/channels/*.md`** | Source of truth | Per-workspace, version-controlled |
| **SQLite `chat_channels`** | Cache / query layer | Ephemeral, rebuilt from files on startup |

**If they conflict, files win.** SQLite is rebuilt via `fullSync()` on startup and `incrementalSync()` on file changes.

### Data Model

The `ChatChannel` interface from `@openspace/shared` is the canonical type:

```typescript
interface ChatChannel {
  id: string;              // Unique ID: "chan-{nanoid(8)}"
  name: string;            // Human-readable name (1–100 chars)
  description: string;     // Markdown body (0–500 chars)
  memberAgentIds: string[];// IDs of member agents
  createdAt: string;       // ISO-8601 creation timestamp
  updatedAt: string;       // ISO-8601 last-updated timestamp
}
```

The `Channel` type alias is preferred in non-chat contexts.

### File Format: YAML Frontmatter + Markdown

Each channel is stored as `.squad/channels/{id}.md`:

```markdown
---
id: chan-Abc12345
name: Frontend
memberAgentIds:
  - fry
  - amy
createdAt: '2026-03-25T10:00:00.000Z'
updatedAt: '2026-03-25T10:00:00.000Z'
---
Channel for frontend design and implementation discussions.
```

**File naming convention:**
- Filename: `{channel-id}.md` (e.g., `chan-Abc12345.md`)
- The `id` field in frontmatter MUST match the filename (without `.md`)
- IDs are generated via `chan-{nanoid(8)}` — URL-safe, collision-resistant

**Markdown body = description.** No additional body sections are defined in v1.

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS chat_channels (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  member_agent_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_channels_name ON chat_channels(name);
```

`member_agent_ids` is stored as a JSON-serialized string array. Parsed to `string[]` on read.

### CRUD API Contract

#### ChatService Methods

| Method | Signature | Returns |
|--------|-----------|---------|
| **listChannels** | `(): ChatChannel[]` | All channels, sorted by `createdAt` ASC |
| **getChannel** | `(id: string): ChatChannel \| null` | Single channel or null |
| **createChannel** | `(input: { name, description?, memberAgentIds? }): ChatChannel` | Created channel |
| **updateChannel** | `(id: string, input: { name?, description?, memberAgentIds? }): ChatChannel \| null` | Updated channel or null if not found |
| **deleteChannel** | `(id: string): DeleteChannelResult` | `{ deleted: boolean, deletedMessages: number }` |

#### REST API

Routes are registered under the `/api/chat` prefix (via `chat.ts` → `channelsRoute` with `prefix: '/chat'`).

| Method | Path | Body / Params | Response |
|--------|------|---------------|----------|
| `GET` | `/api/chat/channels` | `?limit=N&offset=N` | `ChatChannel[]` |
| `GET` | `/api/chat/channels/:id` | — | `ChatChannel` or 404 |
| `POST` | `/api/chat/channels` | `{ name, description?, memberAgentIds? }` | `201 ChatChannel` |
| `PUT` | `/api/chat/channels/:id` | `{ name?, description?, memberAgentIds? }` | `ChatChannel` or 404 |
| `PATCH` | `/api/chat/channels/:id` | `{ name?, description?, memberAgentIds? }` | `ChatChannel` or 404 |
| `DELETE` | `/api/chat/channels/:id` | — | `200 { success: true }` or 404 |

#### Validation Rules

| Rule | Error Code | HTTP Status |
|------|-----------|-------------|
| Name is required and non-blank | `NAME_REQUIRED` | 400 |
| Name must be unique (case-sensitive) | `DUPLICATE_NAME` | 409 |
| `memberAgentIds` must not be empty array (when provided) | `EMPTY_MEMBER_LIST` | 400 |

#### WebSocket Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `channel:created` | `ChatChannel` | After `createChannel()` |
| `channel:updated` | `ChatChannel` | After `updateChannel()` |
| `channel:deleted` | `{ id, deletedMessages }` | After `deleteChannel()` |

### Write Flow (Create/Update/Delete)

1. Validate input (name uniqueness, member list)
2. Write to SQLite (primary for fast reads)
3. Write to `.squad/channels/{id}.md` (async, best-effort — logged on failure)
4. Broadcast WebSocket event
5. Return result to caller

The `.squad/` write is fire-and-forget (`catch` logs errors). SQLite is the authoritative store at runtime; file writes ensure persistence across restarts.

### Sync Flow (Startup & File Changes)

**fullSync() — on startup:**
1. Parse all `.squad/channels/*.md` files via `parseAllChannels()`
2. Clear `chat_channels` table
3. Re-insert all parsed channels
4. Files win: any channels only in SQLite are lost

**incrementalSync() — on file watcher event:**
1. File watcher detects change in `channels/` subdirectory
2. Emits `channel:created`, `channel:updated`, or `channel:deleted` event
3. Sync handler re-parses all channels and replaces DB contents

### Conflict Handling

| Scenario | Resolution |
|----------|-----------|
| File edited externally (git pull, manual edit) | File watcher triggers incrementalSync → DB updated from file |
| DB and file diverge (crash during write) | Next fullSync (restart) rebuilds DB from files |
| Two users edit same channel file (git merge conflict) | Standard git conflict resolution — not handled by the app |
| Duplicate channel names across files | Both persist; uniqueness only enforced at the API layer |

### Scoping: Per-Workspace

Channels are scoped to the workspace (the directory containing `.squad/`):

- **Per-workspace:** Each `.squad/channels/` directory is independent
- **Not global:** No cross-workspace channel sharing in v1
- **Version-controlled:** `.squad/channels/*.md` files should be committed to git
- **Portable:** Cloning a repo brings all channel definitions along

## Consequences

- Channels survive DB corruption or SQLite deletion (rebuilt from files)
- Channel files are human-readable and git-diffable
- External tools can create channels by dropping `.md` files into `.squad/channels/`
- The file watcher and sync pipeline must handle `channels/` events to keep DB in sync

## Affected Files

- `packages/shared/src/types/chat.ts` — ChatChannel type (existing)
- `apps/api/src/services/chat/index.ts` — ChatService CRUD (existing)
- `apps/api/src/services/squad-writer/channel-writer.ts` — File CRUD (existing)
- `apps/api/src/services/squad-parser/channel-parser.ts` — File parser (existing)
- `apps/api/src/services/db/schema.ts` — SQLite schema (existing)
- `apps/api/src/services/db/sync.ts` — Sync pipeline (adding channel sync)
- `apps/api/src/services/file-watcher/index.ts` — File watcher (adding channel events)
- `apps/api/src/routes/channels.ts` — REST routes (existing)
- `apps/api/src/routes/channels.schemas.ts` — Validation schemas (existing)

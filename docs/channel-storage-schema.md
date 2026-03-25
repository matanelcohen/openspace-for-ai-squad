# Channel Storage Schema & CRUD API Contract

> **Status:** Active  
> **Author:** Leela (Lead)  
> **Decision ID:** D-CHAN-STORAGE

---

## 1. Problem Statement

Channels are group conversations scoped to a subset of agents. We need a
storage strategy that is:

- **Version-controllable** — channel definitions live in git alongside the
  rest of `.squad/`.
- **Queryable** — the API can list, search, and filter channels without
  scanning the file system on every request.
- **Conflict-resistant** — concurrent creates/updates from the UI and
  file-system edits don't silently lose data.

This document captures the data model, persistence architecture, file
conventions, CRUD API contract, and conflict-handling rules.

---

## 2. Data Model

The canonical type is `ChatChannel` from `@openspace/shared`:

```typescript
// packages/shared/src/types/chat.ts

export interface ChatChannel {
  id: string;              // Unique identifier
  name: string;            // Human-readable name (e.g., "Frontend")
  description: string;     // Markdown-formatted description
  memberAgentIds: string[];// Agent IDs that belong to this channel
  createdAt: string;       // ISO-8601 creation timestamp
  updatedAt: string;       // ISO-8601 last-modified timestamp
}

export type Channel = ChatChannel; // Alias for non-chat contexts
```

### ID Generation

| Format | Generator | Example |
|--------|-----------|---------|
| `chan-{nanoid(8)}` | `channel-writer.ts → generateChannelId()` | `chan-Xk9m2pLq` |
| `nanoid(12)` | `ChatService.createChannel()` (DB path) | `V1StGXR8_Z5j` |

> **Note:** The writer and service use slightly different ID formats. The
> service ID (`nanoid(12)`) is the authoritative one because the service
> creates the DB record first, then fires-and-forgets the file write. The
> file write receives the already-generated ID.

### Recipient Convention

Messages targeting a channel use the prefix `channel:` followed by the
channel ID:

```
channel:V1StGXR8_Z5j
```

This is defined as `CHAT_CHANNEL_PREFIX` in `@openspace/shared`.

---

## 3. Storage Strategy: Dual-Write Architecture

Channels use the same dual-write pattern as tasks and decisions:

```
┌──────────────────────────┐       ┌──────────────────────────┐
│   .squad/channels/*.md   │       │   .squad/.cache/         │
│   (Source of Truth)      │◄─sync─┤   openspace.db           │
│   YAML frontmatter +    │       │   chat_channels table    │
│   markdown body          │       │   (Query Cache)          │
└──────────────────────────┘       └──────────────────────────┘
```

| Layer | Role | Reads | Writes |
|-------|------|-------|--------|
| **`.squad/channels/*.md`** | Source of truth, version-controlled | On sync, on startup | On create/update/delete |
| **SQLite `chat_channels`** | Fast query cache | All API reads | On create/update/delete; rebuilt from files on sync |

### Write Flow

1. **API request** → `ChatService.createChannel()` validates input.
2. **SQLite write** — synchronous, immediate consistency for reads.
3. **File write** — async fire-and-forget to `.squad/channels/{id}.md`.
4. **WebSocket broadcast** — `channel:created` event to all connected clients.
5. **File watcher** — if the file write triggers a watcher event, the sync
   service sees the file is already consistent and skips re-import.

### Read Flow

All reads go through SQLite for performance:

```
GET /api/channels → ChatService.listChannels() → SELECT * FROM chat_channels
```

Files are only read during:
- Initial startup sync
- File-watcher-triggered incremental sync
- Manual rebuild (`/api/squad/sync`)

---

## 4. File Format & Naming Conventions

### Directory

```
.squad/channels/
├── V1StGXR8_Z5j.md
├── chan-Xk9m2pLq.md
└── ...
```

### File Name

`{channel.id}.md` — the channel ID is the filename stem. No slugification
of the channel name is used (avoids rename-induced filename changes).

### File Content

YAML frontmatter + markdown body (parsed via `gray-matter`):

```markdown
---
id: V1StGXR8_Z5j
name: Frontend
memberAgentIds:
  - fry
  - leela
createdAt: '2026-03-25T12:00:00.000Z'
updatedAt: '2026-03-25T12:00:00.000Z'
---

Group channel for frontend team coordination and code reviews.
```

| Frontmatter Field | Type | Required | Notes |
|-------------------|------|----------|-------|
| `id` | `string` | ✅ | Must match filename stem |
| `name` | `string` | ✅ | Non-empty after trim |
| `memberAgentIds` | `string[]` | ❌ | Defaults to `[]` |
| `createdAt` | `string` (ISO-8601) | ❌ | Falls back to `now()` |
| `updatedAt` | `string` (ISO-8601) | ❌ | Falls back to `now()` |

The **markdown body** (everything after `---`) becomes the `description`
field, trimmed of leading/trailing whitespace.

---

## 5. SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS chat_channels (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  member_agent_ids TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  created_at       TEXT NOT NULL,                -- ISO-8601
  updated_at       TEXT NOT NULL                 -- ISO-8601
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_name ON chat_channels(name);
```

`member_agent_ids` is stored as a JSON string (e.g., `'["fry","leela"]'`)
and parsed with `JSON.parse()` on read. This keeps the schema flat while
supporting variable-length membership.

### Related: Messages Table

Channel messages are stored in the existing `chat_messages` table with
`recipient = 'channel:{id}'`:

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  sender     TEXT NOT NULL,
  recipient  TEXT NOT NULL,     -- "channel:V1StGXR8_Z5j"
  content    TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  thread_id  TEXT
);
```

On channel deletion, all messages with `recipient = 'channel:{id}'` are
cascade-deleted.

---

## 6. CRUD API Contract

### 6.1 List Channels

```
GET /api/channels?limit=50&offset=0
```

**Response:** `200 OK` → `ChatChannel[]`

| Query Param | Type | Default | Constraints |
|-------------|------|---------|-------------|
| `limit` | `integer` | — | 1–200 |
| `offset` | `integer` | — | ≥ 0 |

### 6.2 Get Channel

```
GET /api/channels/:id
```

**Response:** `200 OK` → `ChatChannel` | `404 Not Found`

### 6.3 Create Channel

```
POST /api/channels
Content-Type: application/json

{
  "name": "Frontend",                          // required, 1–100 chars, must contain non-whitespace
  "description": "Frontend coordination",      // optional, max 500 chars
  "memberAgentIds": ["fry", "leela"]           // optional (defaults to []), must not be empty array
}
```

**Response:** `201 Created` → `ChatChannel`

**Errors:**

| Code | HTTP | Condition |
|------|------|-----------|
| `NAME_REQUIRED` | `400` | Name empty or whitespace-only |
| `DUPLICATE_NAME` | `409` | A channel with this name already exists (case-sensitive, trimmed) |
| `EMPTY_MEMBER_LIST` | `400` | `memberAgentIds` explicitly set to `[]` |

### 6.4 Update Channel

```
PATCH /api/channels/:id
PUT   /api/channels/:id
Content-Type: application/json

{
  "name": "Frontend v2",                       // optional
  "description": "Updated description",        // optional
  "memberAgentIds": ["fry", "leela", "bender"] // optional, must not be empty array
}
```

Both `PUT` and `PATCH` behave as partial updates — omitted fields retain
their current values.

**Response:** `200 OK` → `ChatChannel` | `404 Not Found`

**Errors:** Same as Create, plus `404` if channel doesn't exist.

### 6.5 Delete Channel

```
DELETE /api/channels/:id
```

**Response:** `200 OK` → `{ "success": true }` | `404 Not Found`

**Side effects:**
- All messages with `recipient = 'channel:{id}'` are deleted.
- The `.squad/channels/{id}.md` file is removed.
- A `channel:deleted` WebSocket event is broadcast.

---

## 7. ChatService Method Signatures

```typescript
class ChatService {
  /** List all channels, ordered by created_at ASC. */
  listChannels(): ChatChannel[];

  /** Get a single channel by ID. Returns null if not found. */
  getChannel(id: string): ChatChannel | null;

  /** Create a channel. Validates name uniqueness and non-empty constraints. */
  createChannel(input: {
    name: string;
    description?: string;
    memberAgentIds?: string[];
  }): ChatChannel;

  /** Update a channel. Returns null if not found. Validates constraints. */
  updateChannel(
    id: string,
    input: {
      name?: string;
      description?: string;
      memberAgentIds?: string[];
    },
  ): ChatChannel | null;

  /** Delete a channel and its messages. Returns deletion stats. */
  deleteChannel(id: string): { deleted: boolean; deletedMessages: number };
}
```

### Channel Writer (File I/O)

```typescript
// apps/api/src/services/squad-writer/channel-writer.ts

interface CreateChannelInput {
  name: string;
  description?: string;
  memberAgentIds?: string[];
}

type UpdateChannelInput = Partial<Omit<ChatChannel, 'id' | 'createdAt'>>;

function generateChannelId(): string;                                        // → "chan-{nanoid(8)}"
function createChannel(dir: string, input: CreateChannelInput): Promise<ChatChannel>;
function updateChannel(dir: string, id: string, updates: UpdateChannelInput): Promise<ChatChannel>;
function deleteChannel(dir: string, id: string): Promise<void>;
function getChannel(dir: string, id: string): Promise<ChatChannel>;
function listChannels(dir: string): Promise<ChatChannel[]>;
```

### Channel Parser (File → Object)

```typescript
// apps/api/src/services/squad-parser/channel-parser.ts

interface ParseChannelResult { channel: ChatChannel; filePath: string; }
interface ParseChannelError  { filePath: string; error: string; }
interface ParseAllChannelsResult { channels: ParseChannelResult[]; errors: ParseChannelError[]; }

function parseChannelFile(content: string, filePath: string): ParseChannelResult;
function parseAllChannels(channelsDir: string): Promise<ParseAllChannelsResult>;
```

---

## 8. Validation Rules

| Rule | Create | Update | Details |
|------|--------|--------|---------|
| Name required | ✅ | — | Must be non-empty after `.trim()` |
| Name unique | ✅ | ✅ | Case-sensitive, trimmed; excludes self on update |
| Name length | ✅ | ✅ | 1–100 characters (schema enforced) |
| Description length | ✅ | ✅ | Max 500 characters (schema enforced) |
| Members not empty array | ✅ | ✅ | Explicit `[]` is rejected; omitting is fine |
| ID immutable | — | ✅ | Cannot change `id` or `createdAt` |

### Error Types

```typescript
class ChannelValidationError extends Error {
  code: 'NAME_REQUIRED' | 'DUPLICATE_NAME' | 'EMPTY_MEMBER_LIST';
}

class ChannelMembershipError extends Error {
  code: 'CHANNEL_NOT_FOUND' | 'NOT_A_MEMBER';
}
```

---

## 9. Channel Membership & Security

Channel membership is enforced on **message send**, not on read:

```typescript
private validateChannelMembership(sender: string, recipient: string): void
```

- Only applies to recipients prefixed with `channel:`.
- The human user (`sender === 'user'`) bypasses membership checks.
- Agent senders must be listed in `channel.memberAgentIds`.
- Throws `ChannelMembershipError` on violation.

This means agents cannot post to channels they don't belong to, but the
human operator can always send to any channel.

---

## 10. Real-Time Events (WebSocket)

| Event | Payload | When |
|-------|---------|------|
| `channel:created` | Full `ChatChannel` object | After successful create |
| `channel:updated` | Full `ChatChannel` object | After successful update |
| `channel:deleted` | `{ id, deletedMessages }` | After successful delete |

Events are broadcast to **all** connected clients (no channel-scoped
subscriptions yet).

---

## 11. Conflict Handling

### UI vs UI (Concurrent API Requests)

SQLite's WAL mode + synchronous writes provide serializable isolation.
Name uniqueness is enforced at the DB level, so concurrent creates with the
same name will have one succeed and the other receive a `409 DUPLICATE_NAME`.

### UI vs File Edit (Human Edits .squad/channels/)

The file watcher detects changes and triggers a sync that re-imports files
into SQLite. **Files win** — the `.squad/` directory is the source of truth.
If someone edits a channel file directly:

1. File watcher fires.
2. Sync service reads all `.squad/channels/*.md` files.
3. SQLite cache is rebuilt from file contents.
4. Any in-DB-only state is overwritten.

### File Write Failures

The async file write is fire-and-forget. If it fails:
- The SQLite record is already committed (API call succeeds).
- An error is logged: `[Chat] Failed to write channel file: ...`.
- The next full sync will detect the missing file and may remove the DB
  record, or the file can be manually created.

**Mitigation:** This is acceptable for local-first tooling where the API
and file system are on the same machine. Network-split scenarios don't
apply.

---

## 12. Scope: Per-Workspace

Channels are persisted **per-workspace**, not globally:

- `.squad/` lives at the workspace root and is committed to the repo.
- SQLite DB lives at `.squad/.cache/openspace.db` (gitignored).
- Each workspace (repository) has its own set of channels.
- There is no cross-workspace channel sharing.

This aligns with the broader `.squad/` philosophy: the squad definition,
tasks, decisions, and channels are all workspace-scoped and version-controlled.

---

## 13. Edge Cases & Tested Behavior

| Scenario | Behavior |
|----------|----------|
| Unicode channel names (`频道`) | Supported |
| Emoji channel names (`🚀`) | Supported |
| SQL-injection-like names | Safely handled (parameterized queries) |
| Path-traversal IDs (`../../etc/passwd`) | Returns null / not found |
| Very long descriptions (500 chars) | Accepted (schema max) |
| 100+ member IDs | Accepted (no hard limit) |
| Delete non-existent channel | Returns `{ deleted: false, deletedMessages: 0 }` |
| Empty channels dir on startup | Returns `[]`, no error |
| Malformed `.md` file | Logged as parse error, skipped |

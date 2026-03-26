# RAG Architecture & Data Schema

> **Status:** Approved Design · **Author:** Leela (Squad Lead) · **Last Updated:** 2026-03-26

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Vector Store Selection](#3-vector-store-selection)
4. [Embedding Model](#4-embedding-model)
5. [Chunking Strategy](#5-chunking-strategy)
6. [Metadata Schema](#6-metadata-schema)
7. [Query & Retrieval Pipeline](#7-query--retrieval-pipeline)
8. [Persistent Agent Memory Integration](#8-persistent-agent-memory-integration)
9. [SQLite Schema Extensions](#9-sqlite-schema-extensions)
10. [API Surface](#10-api-surface)
11. [Ingestion Pipeline](#11-ingestion-pipeline)
12. [Configuration](#12-configuration)
13. [Migration & Rollout](#13-migration--rollout)

---

## 1. Overview

### Problem

openspace.ai agents currently have **no semantic memory**. The existing search (`FTS5`) provides keyword matching over decisions and tasks, but agents cannot:

- Retrieve contextually relevant knowledge across sessions
- Learn from past commits, PRs, or conversations
- Recall why a decision was made six months ago
- Build a growing understanding of the codebase and team patterns

### Solution

A **Retrieval-Augmented Generation (RAG)** system that:

1. **Ingests** squad knowledge (commits, PRs, docs, tasks, decisions, voice transcripts, chat threads) into vector embeddings
2. **Stores** embeddings with rich metadata for filtered retrieval
3. **Retrieves** the most relevant context for any agent query
4. **Augments** LLM prompts with grounded, source-attributed knowledge
5. **Integrates** with the Persistent Agent Memory system so agents build long-term understanding

### Design Principles

| Principle | Rationale |
|-----------|-----------|
| **`.squad/` remains source of truth** | RAG is a read-path optimization; all writes go through the existing file system |
| **SQLite-first for local dev** | Zero new infrastructure for contributors; production can scale to Qdrant |
| **Pluggable vector store** | Abstract the storage layer so we can swap backends without changing the pipeline |
| **Metadata-heavy** | Rich metadata enables precise filtered retrieval (by agent, source type, date, status) |
| **Incremental ingestion** | File watcher triggers re-embedding only for changed content; no full re-index needed |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INGESTION PIPELINE                               │
│                                                                         │
│  .squad/ files ──┐                                                      │
│  Git commits ────┤                                                      │
│  PR data ────────┤──→ [Chunker] ──→ [Embedder] ──→ [Vector Store]      │
│  Voice sessions ─┤        │              │               │              │
│  Chat threads ───┘        │              │               │              │
│                     ┌─────┘         ┌────┘          ┌────┘              │
│                     ▼               ▼               ▼                   │
│               Chunk with       Embedding       Store with               │
│               metadata         vector          metadata                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        RETRIEVAL PIPELINE                               │
│                                                                         │
│  Agent Query                                                            │
│      │                                                                  │
│      ▼                                                                  │
│  [Query Embedding] ──→ [Metadata Pre-Filter] ──→ [Vector Search]       │
│                              │                        │                 │
│                         Filter by:              Top-K results           │
│                         - source_type                 │                 │
│                         - agent_id                    ▼                 │
│                         - date range          [Re-Ranker (optional)]   │
│                         - status                      │                 │
│                                                       ▼                 │
│                                              [Context Assembly]         │
│                                                       │                 │
│                                                       ▼                 │
│                                              Augmented LLM Prompt       │
│                                              with source citations      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                     MEMORY INTEGRATION                                  │
│                                                                         │
│  [RAG Retrieval] ◄──────────────► [Agent Memory Store]                 │
│       │                                    │                            │
│       │  Memories are embedded             │  Recalled memories update  │
│       │  alongside other sources           │  lastRecalledAt + score    │
│       │                                    │                            │
│       ▼                                    ▼                            │
│  Agent gets memories + context      Memory consolidation               │
│  in a unified retrieval pass        (merge similar, decay old)         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Vector Store Selection

### Recommendation: Tiered Approach

| Environment | Store | Rationale |
|-------------|-------|-----------|
| **Local Development** | **sqlite-vec** (SQLite extension) | Zero infrastructure. Works with existing `better-sqlite3`. Single-file DB. |
| **Production** | **Qdrant** (self-hosted or cloud) | Best-in-class metadata filtering, ANN performance, native TypeScript SDK. |

### Why sqlite-vec for Local Dev

- **Zero dependencies**: Works as a loadable extension to the existing `better-sqlite3` setup
- **Same `.squad/.cache/` pattern**: Embeddings live alongside the existing SQLite cache
- **npm package**: `sqlite-vec` provides prebuilt binaries for macOS/Linux/Windows
- **Supports**: L2, cosine, and inner product distance; up to ~1M vectors comfortably
- **Limitation**: No built-in ANN index (brute-force scan), which is fine for squad-scale data (typically <100K chunks)

### Why Qdrant for Production

- **Metadata filtering**: First-class support for filtering by payload fields *before* ANN search — critical for agent-scoped and source-type-scoped retrieval
- **HNSW index**: Sub-millisecond search at millions of vectors
- **TypeScript SDK**: `@qdrant/js-client-rest` is well-maintained
- **Deployment flexibility**: Single Docker container, or Qdrant Cloud managed service
- **Cost**: Free self-hosted; Cloud has a free tier (1GB)

### Rejected Alternatives

| Store | Why Not |
|-------|---------|
| **pgvector** | Requires PostgreSQL — a new database dependency the project doesn't use |
| **Pinecone** | Cloud-only, no self-hosting, vendor lock-in |
| **Weaviate** | Heavier than needed; module system adds complexity |
| **ChromaDB** | Python-native; JS client is a thin wrapper over HTTP |

### Abstraction Layer

All vector operations go through a `VectorStore` interface (defined in `packages/shared/src/types/rag.ts`), allowing seamless switching:

```typescript
interface VectorStore {
  upsert(chunks: EmbeddedChunk[]): Promise<void>;
  search(query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  delete(filter: ChunkFilter): Promise<number>;
  count(filter?: ChunkFilter): Promise<number>;
}
```

---

## 4. Embedding Model

### Recommendation: OpenAI `text-embedding-3-small`

| Property | Value |
|----------|-------|
| **Dimensions** | 1536 |
| **Max Tokens** | 8191 |
| **Cost** | $0.02 / 1M tokens |
| **Matryoshka** | Yes (can reduce to 512 dims with minimal quality loss) |

### Why This Model

1. **Quality/cost sweet spot**: 62.3% on MTEB at $0.02/1M tokens — 5× cheaper than `text-embedding-3-large` with only ~2% quality difference
2. **Matryoshka support**: Can use 512 dimensions instead of 1536 for 3× smaller index with ~1% quality drop — good for local dev
3. **Token limit**: 8191 tokens per chunk is generous; our largest chunks (doc sections) will be ~512 tokens
4. **Wide adoption**: Battle-tested in production RAG systems

### Configuration

```typescript
interface EmbeddingConfig {
  provider: 'openai' | 'ollama' | 'copilot';
  model: string;           // 'text-embedding-3-small'
  dimensions: number;      // 1536 (prod) or 512 (local)
  batchSize: number;       // 100 (OpenAI supports up to 2048)
  maxTokensPerChunk: number; // 512
}
```

### Fallback: Local Embeddings via Ollama

For offline or cost-sensitive scenarios:

| Property | Value |
|----------|-------|
| **Model** | `nomic-embed-text-v1.5` |
| **Dimensions** | 768 |
| **License** | Apache 2.0 |
| **Runtime** | Ollama (local) |

### Environment Variables

```env
EMBEDDING_PROVIDER=openai          # openai | ollama
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536          # 1536 | 512 (matryoshka)
EMBEDDING_API_KEY=sk-...           # OpenAI key (if provider=openai)
OLLAMA_BASE_URL=http://localhost:11434  # Ollama URL (if provider=ollama)
```

---

## 5. Chunking Strategy

Each source type has a tailored chunking strategy. The goal: chunks should be **self-contained**, **attributable**, and **small enough for precise retrieval**.

### 5.1 Chunk Size Defaults

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Target chunk size** | 512 tokens | Balances granularity with context |
| **Max chunk size** | 1024 tokens | Hard limit to stay within embedding model window |
| **Overlap** | 64 tokens | Prevents losing context at chunk boundaries |

### 5.2 Per-Source Chunking

#### Commits (`source_type: 'commit'`)

```
Strategy: SINGLE_CHUNK
One chunk per commit containing:
  - Commit message (subject + body)
  - Author and date
  - File change summary (files changed, insertions, deletions)
  - First 20 lines of diff (if commit is small)

For large commits (>50 files or >1000 diff lines):
  - Chunk 0: Commit message + file list summary
  - Chunk 1..N: Per-file diff chunks (grouped by directory)
```

**Example chunk content:**
```
Commit: abc1234 | Author: bender | Date: 2026-03-15
Subject: Add WebSocket reconnection logic with exponential backoff

Body: Implements automatic reconnection for the real-time event stream.
Uses exponential backoff starting at 1s, capped at 30s. Adds connection
state tracking to the WebSocket service.

Files changed: 3 (apps/api/src/services/websocket/index.ts, +42 -8) ...
```

#### Pull Requests (`source_type: 'pull_request'`)

```
Strategy: MULTI_CHUNK
  - Chunk 0: PR title + description + labels + base/head branches
  - Chunk 1..N: Individual review comments (grouped by file)
  - Final chunk: Merge commit summary (if merged)
```

#### Documentation (`source_type: 'doc'`)

```
Strategy: HEADING_AWARE_RECURSIVE
  - Split on markdown headings (##, ###)
  - Each section becomes a chunk if ≤512 tokens
  - Long sections are recursively split on paragraphs, then sentences
  - 64-token overlap between sequential chunks within the same section
  - Preserve heading hierarchy as metadata (e.g., "## Architecture > ### Database")
```

**Applies to:** `.squad/` markdown files, `docs/*.md`, agent charters

#### Tasks (`source_type: 'task'`)

```
Strategy: SINGLE_CHUNK
One chunk per task containing:
  - Title, status, priority, assignee
  - Full description text
  - Labels/tags

Re-embedded when task is updated (status change, description edit).
```

#### Decisions (`source_type: 'decision'`)

```
Strategy: SINGLE_CHUNK
One chunk per decision containing:
  - Title, author, date, status
  - Full rationale text
  - Affected files list
```

#### Voice Session Transcripts (`source_type: 'voice_session'`)

```
Strategy: SLIDING_WINDOW
  - Window size: 5 messages
  - Stride: 3 messages (2-message overlap)
  - Each chunk includes speaker labels and timestamps
  - Session metadata (topic, participants) in every chunk
```

#### Chat Threads (`source_type: 'chat_thread'`)

```
Strategy: THREAD_GROUPED
  - All messages in a single thread → 1 chunk (if ≤512 tokens)
  - Long threads split at natural breaks (time gaps >30 min)
  - Channel-level messages without threads: sliding window (10 msgs, stride 7)
```

#### Agent Charters (`source_type: 'agent_charter'`)

```
Strategy: SINGLE_CHUNK
  - One chunk per agent charter file
  - Re-embedded when charter changes (file watcher triggers)
  - Always included in agent-specific queries (boosted relevance)
```

### 5.3 Chunking Pipeline

```typescript
interface ChunkerConfig {
  targetTokens: number;    // 512
  maxTokens: number;       // 1024
  overlapTokens: number;   // 64
}

interface Chunk {
  id: string;                    // deterministic: hash(source_id + chunk_index)
  content: string;               // the text to embed
  metadata: ChunkMetadata;       // rich metadata for filtering
  tokenCount: number;            // actual token count
}
```

---

## 6. Metadata Schema

Every chunk carries metadata enabling precise filtered retrieval. This is the **core data model** of the RAG system.

### 6.1 ChunkMetadata Interface

```typescript
interface ChunkMetadata {
  // ── Identity ────────────────────────────────────
  sourceType: SourceType;
  sourceId: string;          // commit SHA, PR number, task ID, etc.
  chunkIndex: number;        // position within the source document
  chunkTotal: number;        // total chunks from this source

  // ── Location ────────────────────────────────────
  squadPath: string | null;  // path in .squad/ (e.g., "tasks/add-auth.md")
  filePath: string | null;   // repo file path for code-related chunks

  // ── Ownership ───────────────────────────────────
  agentIds: string[];        // agents associated with this chunk
  author: string | null;     // human or agent who created the source

  // ── Temporal ────────────────────────────────────
  createdAt: string;         // ISO-8601 timestamp
  updatedAt: string;         // ISO-8601 timestamp

  // ── Classification ──────────────────────────────
  tags: string[];            // user-defined or auto-extracted tags
  status: string | null;     // task status, decision status, PR state
  priority: string | null;   // task priority (P0-P3)

  // ── Context ─────────────────────────────────────
  headingPath: string | null;  // for docs: "## Arch > ### DB" breadcrumb
  threadId: string | null;     // for chat: thread grouping
  sessionId: string | null;    // for voice: session grouping
}
```

### 6.2 Source Types

```typescript
type SourceType =
  | 'commit'
  | 'pull_request'
  | 'doc'
  | 'task'
  | 'decision'
  | 'voice_session'
  | 'chat_thread'
  | 'agent_charter'
  | 'agent_memory';    // memories from the Persistent Agent Memory system
```

### 6.3 Indexed Fields for Filtering

The following metadata fields are indexed in the vector store for pre-filter queries:

| Field | Index Type | Use Case |
|-------|-----------|----------|
| `sourceType` | Keyword | "Show me only decisions" |
| `agentIds` | Keyword (array) | "What does Bender know about this?" |
| `author` | Keyword | "What has Fry worked on?" |
| `status` | Keyword | "Active decisions only" |
| `priority` | Keyword | "P0/P1 tasks" |
| `tags` | Keyword (array) | "Everything tagged #auth" |
| `createdAt` | Range (datetime) | "Last 30 days" |
| `updatedAt` | Range (datetime) | "Recently modified" |
| `squadPath` | Keyword | "All chunks from tasks/" |
| `sessionId` | Keyword | "This voice session's context" |
| `threadId` | Keyword | "This chat thread" |

### 6.4 Qdrant Collection Schema

```json
{
  "collection_name": "openspace_knowledge",
  "vectors": {
    "size": 1536,
    "distance": "Cosine"
  },
  "payload_schema": {
    "source_type":  { "type": "keyword" },
    "source_id":    { "type": "keyword" },
    "agent_ids":    { "type": "keyword" },
    "author":       { "type": "keyword" },
    "status":       { "type": "keyword" },
    "priority":     { "type": "keyword" },
    "tags":         { "type": "keyword" },
    "created_at":   { "type": "datetime" },
    "updated_at":   { "type": "datetime" },
    "squad_path":   { "type": "keyword" },
    "session_id":   { "type": "keyword" },
    "thread_id":    { "type": "keyword" },
    "chunk_index":  { "type": "integer" },
    "content":      { "type": "text" }
  }
}
```

### 6.5 SQLite-vec Schema (Local Dev)

```sql
-- Chunk storage with metadata
CREATE TABLE IF NOT EXISTS rag_chunks (
  id           TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  source_type  TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL DEFAULT 0,
  chunk_total  INTEGER NOT NULL DEFAULT 1,
  squad_path   TEXT,
  file_path    TEXT,
  agent_ids    TEXT NOT NULL DEFAULT '[]',  -- JSON array
  author       TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  tags         TEXT NOT NULL DEFAULT '[]',  -- JSON array
  status       TEXT,
  priority     TEXT,
  heading_path TEXT,
  thread_id    TEXT,
  session_id   TEXT,
  token_count  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rag_source_type ON rag_chunks(source_type);
CREATE INDEX IF NOT EXISTS idx_rag_source_id ON rag_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_squad_path ON rag_chunks(squad_path);
CREATE INDEX IF NOT EXISTS idx_rag_created_at ON rag_chunks(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_status ON rag_chunks(status);

-- Vector embeddings (sqlite-vec virtual table)
CREATE VIRTUAL TABLE IF NOT EXISTS rag_embeddings USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding FLOAT[1536]
);
```

---

## 7. Query & Retrieval Pipeline

### 7.1 Pipeline Stages

```
User/Agent Query
       │
       ▼
 ┌─────────────┐
 │ 1. CLASSIFY  │  Determine query type and extract filter hints
 │    QUERY     │  (optional LLM call for complex queries)
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ 2. EMBED    │  Convert query text to vector
 │    QUERY    │  using same model as ingestion
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ 3. PRE-     │  Apply metadata filters BEFORE vector search
 │    FILTER   │  (source_type, agent_id, date range, status)
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ 4. VECTOR   │  Cosine similarity search over filtered subset
 │    SEARCH   │  Top-K (default: 10)
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ 5. HYBRID   │  Combine with FTS5 keyword results (RRF fusion)
 │    MERGE    │  Reciprocal Rank Fusion for best of both worlds
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ 6. RE-RANK  │  Cross-encoder or LLM-based re-ranking
 │  (optional) │  For high-stakes queries (agent decisions)
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ 7. CONTEXT  │  Assemble context window with:
 │    BUILD    │  - Source attribution
 │             │  - Chunk deduplication
 │             │  - Token budget enforcement
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ 8. AUGMENT  │  Inject into LLM system prompt or context block
 │    PROMPT   │  with citation markers [1], [2], ...
 └─────────────┘
```

### 7.2 Query Classification

Before searching, the pipeline classifies the query to set optimal parameters:

| Query Type | Filters Applied | K | Re-rank |
|------------|----------------|---|---------|
| **Agent-scoped** ("What do I know about auth?") | `agentIds` contains requesting agent | 10 | No |
| **Source-scoped** ("What decisions were made about the DB?") | `sourceType = 'decision'` | 15 | No |
| **Time-scoped** ("What happened this week?") | `createdAt > 7 days ago` | 20 | No |
| **General knowledge** ("How does the voice pipeline work?") | None | 10 | Yes |
| **Memory recall** ("What patterns have I learned?") | `sourceType = 'agent_memory'` + `agentIds` | 10 | No |

### 7.3 Hybrid Search (Vector + FTS5)

We use **Reciprocal Rank Fusion (RRF)** to combine vector and keyword results:

```typescript
function reciprocalRankFusion(
  vectorResults: SearchResult[],
  ftsResults: SearchResult[],
  k: number = 60,  // RRF constant
): SearchResult[] {
  const scores = new Map<string, number>();

  vectorResults.forEach((r, i) => {
    const rrf = 1 / (k + i + 1);
    scores.set(r.id, (scores.get(r.id) ?? 0) + rrf);
  });

  ftsResults.forEach((r, i) => {
    const rrf = 1 / (k + i + 1);
    scores.set(r.id, (scores.get(r.id) ?? 0) + rrf);
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));
}
```

**Why hybrid?** Pure vector search misses exact keyword matches (e.g., "PR #142"). Pure FTS5 misses semantic similarity (e.g., "authentication" ↔ "login flow"). RRF combines both with zero tuning.

### 7.4 Context Assembly

```typescript
interface RetrievalContext {
  chunks: RetrievedChunk[];
  totalTokens: number;
  sources: SourceAttribution[];
}

interface RetrievedChunk {
  content: string;
  score: number;
  metadata: ChunkMetadata;
  citationIndex: number;  // [1], [2], ...
}

interface SourceAttribution {
  citationIndex: number;
  sourceType: SourceType;
  sourceId: string;
  title: string;
  url: string | null;     // link to source (PR URL, file path, etc.)
}
```

**Token Budget**: The context assembly stage enforces a configurable token budget (default: 4096 tokens). Chunks are added in score order until the budget is exhausted. A chunk is never truncated — if it doesn't fit, it's skipped.

### 7.5 LLM Prompt Augmentation

The retrieved context is injected as a structured block in the system prompt:

```
<retrieved_context>
You have access to the following relevant knowledge from the squad's history.
Use it to inform your response. Cite sources using [1], [2], etc.

[1] Decision: Use SQLite as cache layer (2026-01-15, by leela)
SQLite was chosen because it requires zero infrastructure and .squad/ files
remain the source of truth. The cache is rebuildable from the file system.

[2] Task: Implement FTS5 search (completed, assigned to bender)
Added full-text search over decisions and tasks using SQLite FTS5 virtual
tables with BM25 ranking and highlighted snippets.

[3] Commit: abc1234 - Add WebSocket reconnection (by bender, 2026-03-15)
Implements exponential backoff for WebSocket reconnection. Starts at 1s,
caps at 30s. Tracks connection state in the WebSocket service.
</retrieved_context>
```

---

## 8. Persistent Agent Memory Integration

The RAG system deeply integrates with the Agent Memory system (types in `memory.ts`).

### 8.1 Memory as a RAG Source

Agent memories (`Memory` objects) are treated as first-class RAG content:

```typescript
// Memory → Chunk mapping
function memoryToChunk(memory: Memory): Chunk {
  return {
    id: `memory-${memory.id}`,
    content: memory.content,
    metadata: {
      sourceType: 'agent_memory',
      sourceId: memory.id,
      agentIds: [memory.agentId],
      tags: [memory.type],         // 'preference', 'pattern', 'decision'
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      // ...
    },
  };
}
```

### 8.2 Extended Memory Types

The `Memory` type is extended with RAG-aware fields:

```typescript
interface Memory {
  // ... existing fields ...

  /** Vector embedding of the memory content. */
  embeddingId: string | null;

  /** Relevance score from last recall (0-1). */
  relevanceScore: number;

  /** Number of times this memory has been recalled. */
  recallCount: number;

  /** Decay factor — memories that aren't recalled fade (0-1, 1 = full strength). */
  strength: number;

  /** Source chunks that informed this memory (provenance). */
  sourceChunkIds: string[];

  /** Optional: condensed embedding for similarity dedup. */
  contentHash: string;
}
```

### 8.3 Memory Lifecycle with RAG

```
  New Information (conversation, task result, decision)
           │
           ▼
  ┌─────────────────┐
  │ Extract Memory   │  LLM extracts preference/pattern/decision
  │ from Interaction │  from the interaction context
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Deduplication    │  Embed candidate → search existing memories
  │ Check            │  If similarity > 0.92 → merge instead of create
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Embed & Store    │  Create embedding, store in vector DB
  │                  │  Also write to .squad/memories/{agent}.json
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Available for    │  Memory appears in future RAG retrievals
  │ Retrieval        │  filtered by agentId
  └─────────────────┘
```

### 8.4 Memory Recall & Decay

When a memory is retrieved during RAG:

1. **Update `lastRecalledAt`** to current timestamp
2. **Increment `recallCount`**
3. **Boost `strength`** back toward 1.0 (reinforcement)

Memories that are never recalled gradually lose strength:

```typescript
function calculateStrength(memory: Memory, now: Date): number {
  const daysSinceRecall = memory.lastRecalledAt
    ? (now.getTime() - new Date(memory.lastRecalledAt).getTime()) / 86_400_000
    : (now.getTime() - new Date(memory.createdAt).getTime()) / 86_400_000;

  // Half-life of 90 days: memory loses half its strength every 90 days without recall
  const halfLife = 90;
  const decay = Math.pow(0.5, daysSinceRecall / halfLife);

  // Recall count boosts base strength (frequently recalled = more durable)
  const recallBoost = Math.min(1.0, 0.5 + memory.recallCount * 0.05);

  return Math.max(0.01, decay * recallBoost);
}
```

### 8.5 Memory Consolidation

Periodically (daily cron or on-demand), the system consolidates memories:

1. **Merge similar memories** (cosine similarity > 0.92) into a single, richer memory
2. **Archive weak memories** (strength < 0.1) — move to cold storage, remove from vector index
3. **Summarize** — for agents with >100 active memories, generate a "memory summary" meta-chunk

### 8.6 Agent-Scoped Retrieval

When an agent queries the RAG system, their memories are **always included** with a relevance boost:

```typescript
async function retrieveForAgent(
  agentId: string,
  query: string,
  options: RetrievalOptions,
): Promise<RetrievalContext> {
  // 1. Retrieve general knowledge
  const generalResults = await vectorSearch(query, {
    ...options,
    limit: options.limit - 3,  // reserve slots for memories
  });

  // 2. Retrieve agent-specific memories (always)
  const memoryResults = await vectorSearch(query, {
    filter: { sourceType: 'agent_memory', agentIds: [agentId] },
    limit: 3,
    minScore: 0.3,  // lower threshold for own memories
  });

  // 3. Boost memory scores by strength
  for (const result of memoryResults) {
    result.score *= result.metadata.strength ?? 1.0;
  }

  // 4. Merge and assemble context
  return assembleContext([...generalResults, ...memoryResults], options.tokenBudget);
}
```

---

## 9. SQLite Schema Extensions

These tables extend the existing schema in `apps/api/src/services/db/schema.ts`:

```sql
-- ── RAG Chunks ────────────────────────────────────────────────────
-- Stores the text content and metadata for each chunk.
-- The vector embedding is stored separately in the vec0 virtual table.

CREATE TABLE IF NOT EXISTS rag_chunks (
  id           TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  source_type  TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL DEFAULT 0,
  chunk_total  INTEGER NOT NULL DEFAULT 1,
  squad_path   TEXT,
  file_path    TEXT,
  agent_ids    TEXT NOT NULL DEFAULT '[]',
  author       TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  tags         TEXT NOT NULL DEFAULT '[]',
  status       TEXT,
  priority     TEXT,
  heading_path TEXT,
  thread_id    TEXT,
  session_id   TEXT,
  token_count  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rag_source_type ON rag_chunks(source_type);
CREATE INDEX IF NOT EXISTS idx_rag_source_id ON rag_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_squad_path ON rag_chunks(squad_path);
CREATE INDEX IF NOT EXISTS idx_rag_created_at ON rag_chunks(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_status ON rag_chunks(status);
CREATE INDEX IF NOT EXISTS idx_rag_thread_id ON rag_chunks(thread_id);
CREATE INDEX IF NOT EXISTS idx_rag_session_id ON rag_chunks(session_id);

-- ── Vector Embeddings (sqlite-vec) ────────────────────────────────
-- Virtual table mapping chunk IDs to their embedding vectors.

CREATE VIRTUAL TABLE IF NOT EXISTS rag_embeddings USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding FLOAT[1536]
);

-- ── Agent Memories ────────────────────────────────────────────────
-- Persistent memory storage for agents (implements the Memory type).

CREATE TABLE IF NOT EXISTS agent_memories (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  type             TEXT NOT NULL,          -- 'preference' | 'pattern' | 'decision'
  content          TEXT NOT NULL,
  source_session   TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_recalled_at TEXT,
  enabled          INTEGER NOT NULL DEFAULT 1,
  embedding_id     TEXT,                   -- FK to rag_chunks.id
  relevance_score  REAL NOT NULL DEFAULT 0.0,
  recall_count     INTEGER NOT NULL DEFAULT 0,
  strength         REAL NOT NULL DEFAULT 1.0,
  source_chunk_ids TEXT NOT NULL DEFAULT '[]',
  content_hash     TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_agent ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON agent_memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_strength ON agent_memories(strength);
CREATE INDEX IF NOT EXISTS idx_memories_enabled ON agent_memories(enabled);

-- ── Ingestion State ───────────────────────────────────────────────
-- Tracks what has been ingested to enable incremental updates.

CREATE TABLE IF NOT EXISTS rag_ingestion_state (
  source_type   TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  content_hash  TEXT NOT NULL,       -- hash of source content to detect changes
  chunk_count   INTEGER NOT NULL,
  ingested_at   TEXT NOT NULL,
  PRIMARY KEY (source_type, source_id)
);
```

---

## 10. API Surface

### 10.1 REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/rag/search` | Semantic search with optional filters |
| `POST` | `/api/rag/ingest` | Trigger ingestion for a specific source |
| `POST` | `/api/rag/ingest/all` | Full re-index (admin) |
| `GET`  | `/api/rag/stats` | Ingestion stats (chunk counts, last indexed) |
| `DELETE` | `/api/rag/chunks` | Delete chunks by filter |
| `GET`  | `/api/memories/:agentId` | List memories for an agent |
| `POST` | `/api/memories/:agentId` | Create/update a memory |
| `DELETE` | `/api/memories/:agentId/:memoryId` | Delete a memory |
| `POST` | `/api/memories/:agentId/consolidate` | Trigger memory consolidation |

### 10.2 Search Request/Response

```typescript
// POST /api/rag/search
interface RAGSearchRequest {
  query: string;
  agentId?: string;          // scope to agent's knowledge + memories
  filters?: {
    sourceTypes?: SourceType[];
    agentIds?: string[];
    tags?: string[];
    status?: string[];
    dateRange?: { from?: string; to?: string };
  };
  limit?: number;            // default: 10
  tokenBudget?: number;      // default: 4096
  includeMemories?: boolean; // default: true
  hybridSearch?: boolean;    // combine vector + FTS5 (default: true)
}

interface RAGSearchResponse {
  results: RetrievedChunk[];
  totalTokens: number;
  sources: SourceAttribution[];
  searchTimeMs: number;
}
```

### 10.3 Internal Service Interface

```typescript
interface RAGService {
  // Query
  search(request: RAGSearchRequest): Promise<RAGSearchResponse>;
  retrieveForAgent(agentId: string, query: string, options?: RetrievalOptions): Promise<RetrievalContext>;

  // Ingestion
  ingestSource(sourceType: SourceType, sourceId: string, content: string, metadata: Partial<ChunkMetadata>): Promise<void>;
  ingestSquadFile(filePath: string): Promise<void>;
  reindexAll(): Promise<{ chunksCreated: number; timeMs: number }>;

  // Memory
  createMemory(agentId: string, memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Memory>;
  recallMemories(agentId: string, query: string, limit?: number): Promise<Memory[]>;
  consolidateMemories(agentId: string): Promise<{ merged: number; archived: number }>;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getStats(): Promise<RAGStats>;
}
```

---

## 11. Ingestion Pipeline

### 11.1 Trigger Sources

| Trigger | Source Type | Mechanism |
|---------|-----------|-----------|
| **File watcher** (chokidar) | Tasks, decisions, docs, charters | Existing watcher emits events → ingest changed file |
| **Chat message POST** | Chat threads | After persisting message, async embed new chunk |
| **Voice session end** | Voice transcripts | On `persistSession()`, ingest transcript chunks |
| **Git hook / CI** | Commits, PRs | Post-push webhook or periodic git log scan |
| **Memory creation** | Agent memories | Inline embedding on create |
| **Manual / Admin** | Any | `/api/rag/ingest/all` endpoint |

### 11.2 Incremental Ingestion

The `rag_ingestion_state` table tracks content hashes. On re-ingestion:

1. Compute hash of source content
2. Compare with stored hash in `rag_ingestion_state`
3. If unchanged → skip
4. If changed → delete old chunks for this `(source_type, source_id)`, re-chunk, re-embed, store

```typescript
async function ingestIfChanged(
  sourceType: SourceType,
  sourceId: string,
  content: string,
  metadata: Partial<ChunkMetadata>,
): Promise<boolean> {
  const hash = createHash('sha256').update(content).digest('hex');
  const existing = db.prepare(
    'SELECT content_hash FROM rag_ingestion_state WHERE source_type = ? AND source_id = ?'
  ).get(sourceType, sourceId);

  if (existing?.content_hash === hash) return false; // skip

  // Delete old chunks
  await vectorStore.delete({ sourceType, sourceId });

  // Chunk → Embed → Store
  const chunks = chunker.chunk(content, sourceType, metadata);
  const embedded = await embedder.embedBatch(chunks);
  await vectorStore.upsert(embedded);

  // Update ingestion state
  db.prepare(
    'INSERT OR REPLACE INTO rag_ingestion_state VALUES (?, ?, ?, ?, ?)'
  ).run(sourceType, sourceId, hash, chunks.length, new Date().toISOString());

  return true;
}
```

### 11.3 Integration with Existing File Watcher

The current `file-watcher` service in `apps/api/src/services/file-watcher/` monitors `.squad/` for changes and syncs to SQLite. We extend this:

```typescript
// In file-watcher/index.ts — add RAG ingestion hook
fileWatcher.on('change', async (filePath: string) => {
  // Existing: sync to SQLite cache
  await syncToSqlite(filePath);

  // New: trigger RAG ingestion
  const sourceType = inferSourceType(filePath); // tasks/, decisions.md, etc.
  if (sourceType) {
    await ragService.ingestSquadFile(filePath);
  }
});
```

---

## 12. Configuration

### 12.1 Environment Variables

```env
# ── RAG Feature Flag ──────────────────────────────────
RAG_ENABLED=true                      # Enable/disable the RAG pipeline

# ── Vector Store ──────────────────────────────────────
VECTOR_STORE_PROVIDER=sqlite-vec      # sqlite-vec | qdrant
QDRANT_URL=http://localhost:6333      # Qdrant URL (if provider=qdrant)
QDRANT_API_KEY=                       # Qdrant API key (optional, for cloud)
QDRANT_COLLECTION=openspace_knowledge # Collection name

# ── Embedding ─────────────────────────────────────────
EMBEDDING_PROVIDER=openai             # openai | ollama
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536             # 1536 | 512 (matryoshka)
EMBEDDING_API_KEY=sk-...              # OpenAI API key
EMBEDDING_BATCH_SIZE=100              # Batch size for embedding requests
OLLAMA_BASE_URL=http://localhost:11434

# ── Retrieval ─────────────────────────────────────────
RAG_DEFAULT_TOP_K=10                  # Default number of results
RAG_TOKEN_BUDGET=4096                 # Max tokens in context window
RAG_HYBRID_SEARCH=true                # Combine vector + FTS5
RAG_MIN_SCORE=0.25                    # Minimum similarity threshold

# ── Memory ────────────────────────────────────────────
MEMORY_ENABLED=true                   # Enable agent memory
MEMORY_HALF_LIFE_DAYS=90              # Memory decay half-life
MEMORY_CONSOLIDATION_INTERVAL=86400   # Consolidation interval (seconds)
MEMORY_MAX_PER_AGENT=200              # Max active memories per agent
MEMORY_SIMILARITY_THRESHOLD=0.92      # Threshold for dedup merge
```

### 12.2 Default Config Object

```typescript
const DEFAULT_RAG_CONFIG: RAGConfig = {
  enabled: true,
  vectorStore: {
    provider: 'sqlite-vec',
    sqlitePath: '.squad/.cache/openspace.db', // same DB as existing cache
    qdrantUrl: 'http://localhost:6333',
    collection: 'openspace_knowledge',
  },
  embedding: {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    batchSize: 100,
    maxTokensPerChunk: 512,
  },
  retrieval: {
    defaultTopK: 10,
    tokenBudget: 4096,
    hybridSearch: true,
    minScore: 0.25,
    reranking: false,
  },
  chunking: {
    targetTokens: 512,
    maxTokens: 1024,
    overlapTokens: 64,
  },
  memory: {
    enabled: true,
    halfLifeDays: 90,
    consolidationIntervalSeconds: 86400,
    maxPerAgent: 200,
    similarityThreshold: 0.92,
  },
};
```

---

## 13. Migration & Rollout

### Phase 1: Foundation (current task)
- ✅ Architecture document (this file)
- ✅ Shared TypeScript types (`packages/shared/src/types/rag.ts`)
- ✅ Extended Memory types

### Phase 2: Core Implementation
- [ ] Implement `VectorStore` interface with sqlite-vec backend
- [ ] Implement `Embedder` service (OpenAI provider)
- [ ] Implement `Chunker` with per-source strategies
- [ ] SQLite schema migration (add RAG tables)

### Phase 3: Ingestion Pipeline
- [ ] File watcher integration for .squad/ changes
- [ ] Chat message ingestion hook
- [ ] Voice session transcript ingestion
- [ ] Initial full-index command

### Phase 4: Retrieval Pipeline
- [ ] `RAGService.search()` implementation
- [ ] Hybrid search (vector + FTS5 with RRF)
- [ ] Context assembly with token budgeting
- [ ] LLM prompt augmentation

### Phase 5: Agent Memory
- [ ] Memory CRUD operations
- [ ] Memory embedding and recall
- [ ] Decay and consolidation logic
- [ ] Memory API endpoints

### Phase 6: Production Readiness
- [ ] Qdrant vector store backend
- [ ] Git commit/PR ingestion pipeline
- [ ] Monitoring and observability
- [ ] Performance benchmarks

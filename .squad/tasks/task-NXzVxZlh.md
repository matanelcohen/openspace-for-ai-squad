---
id: task-NXzVxZlh
title: Design RAG architecture and data schema
status: done
priority: P1
assignee: leela
labels:
  - architecture
  - design
  - RAG
  - 'parent:task-Kn1c77z_'
created: '2026-03-25T23:19:13.902Z'
updated: '2026-03-26T00:14:33.637Z'
sortIndex: 144
---
Define the overall architecture for the RAG knowledge base: vector store selection (e.g., pgvector, Pinecone, Qdrant), embedding model choice (e.g., OpenAI ada-002, local model), chunking strategy for different source types (commits, PRs, docs, tasks), metadata schema for filtered retrieval, and the query/retrieval pipeline design. Document integration points with the Persistent Agent Memory system.

---
**[2026-03-26 00:01:49]** 🚀 Leela started working on this task.

---
**[2026-03-26 00:14:33]** 🚀 Leela started working on this task.

**Progress:**
**[2026-03-26 00:05:44]** 🧠 Thinking: The user wants me to design a RAG architecture and data schema for the openspace.ai project. Let me first explore the codebase to understand the exist
**[2026-03-26 00:05:44]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:44]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:47]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:54]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:54]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:54]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:54]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:21]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:21]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:21]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:28]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:28]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:28]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:33]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:33]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:33]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:36]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:36]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:36]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:39]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:39]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:43]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:43]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:43]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:50]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:50]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:50]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:54]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:54]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:54]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:00]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:26]** 🧠 Thinking: Excellent! Now I have a comprehensive understanding of the codebase. Let me now design the RAG architecture document. Key observations:

1. **Existing
**[2026-03-26 00:08:26]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:26]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:26]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:26]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:32]** 🧠 Thinking: Now let me also look at the voice context manager and the AI provider to understand integration points better.
**[2026-03-26 00:08:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:09:08]** 🧠 Thinking: Now I have a very thorough understanding of the existing codebase. Let me now create the comprehensive RAG architecture document. I need to:

1. Creat
**[2026-03-26 00:09:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:09:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:09:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:09:08]** ℹ️ /Users/matancohen/.copilot/session-state/d7c98b39-4da6-456c-98f1-1d9ba6857d8c/plan.md
**[2026-03-26 00:09:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:23]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:23]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:23]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/docs/rag-architecture.md
**[2026-03-26 00:13:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:13]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/shared/src/types/rag.ts
**[2026-03-26 00:13:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:37]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:37]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:45]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:04]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:14]** 🔧 Using tool: `unknown`

**[2026-03-26 00:14:33]** ✅ Leela completed this task.

**Result:**
Committed successfully. Lint and prettier passed. Here's a summary of what was delivered:

---

**Committed `57fa13c`** — 4 files, 1,688 lines added:

### Deliverables

1. **`docs/rag-architecture.md`** — Full architecture document covering:
   - **Vector store**: sqlite-vec for local dev (zero infra, fits existing better-sqlite3), Qdrant for production (best metadata filtering + ANN)
   - **Embedding model**: OpenAI `text-embedding-3-small` (1536 dims, $0.02/1M tokens), with Ollama `nomic-embed-text` as local fallback
   - **Chunking strategies**: Per-source-type — single-chunk for tasks/decisions/commits, heading-aware recursive for docs, sliding window for voice transcripts, thread-grouped for chat
   - **Metadata schema**: 15 filterable fields (sourceType, agentIds, tags, status, dateRange, etc.)
   - **Query pipeline**: 8-stage (classify → embed → pre-filter → vector search → hybrid FTS5 merge via RRF → re-rank → context assembly → prompt augment)
   - **Memory integration**: Memories as first-class RAG source with decay (90-day half-life), recall reinforcement, dedup merging, and consolidation

2. **`packages/shared/src/types/rag.ts`** — 25+ TypeScript interfaces covering chunks, embeddings, vector store abstraction, retrieval pipeline, ingestion state, and full configuration

3. **`packages/shared/src/types/memory.ts`** — Extended with RAG fields: `embeddingId`, `relevanceScore`, `recallCount`, `strength`, `sourceChunkIds`, `contentHash`, and `MemoryConsolidationResult`

4. **`packages/shared/src/types/index.ts`** — Updated barrel exports

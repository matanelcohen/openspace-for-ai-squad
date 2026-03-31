---
id: task-HsHlMzCo
title: Test RAG pipeline end-to-end with quality benchmarks
status: done
priority: P2
assignee: zoidberg
labels:
  - testing
  - QA
  - integration
  - RAG
  - 'parent:task-Kn1c77z_'
created: '2026-03-25T23:19:13.972Z'
updated: '2026-03-31T21:51:04.862Z'
sortIndex: 97
---
Write comprehensive tests for the RAG knowledge base: unit tests for each ingestion connector (commit, PR, docs, tasks), unit tests for chunking and embedding generation, integration tests for the full ingest→embed→store→query pipeline, retrieval quality benchmarks using known query/answer pairs to measure precision@k and recall, and E2E tests verifying agents receive relevant context when querying. Include edge cases: empty repos, large diffs, non-English content, and concurrent ingestion.

---
**[2026-03-26 07:19:53]** 🚀 Zoidberg started working on this task.

**Progress:**
**[2026-03-26 07:04:59]** 🧠 Thinking: Let me analyze this task. I need to write comprehensive tests for a RAG (Retrieval-Augmented Generation) pipeline. Let me first explore the codebase t
**[2026-03-26 07:04:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:13]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:13]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:13]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:17]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:27]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:27]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:27]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:27]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:27]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:32]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:32]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:32]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:32]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:32]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:33]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:36]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:52]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:52]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:52]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:52]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:05:59]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:04]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:08]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:08]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:08]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:09]** 🧠 Thinking: Let me check the existing test files to understand what's already covered. These look like they may have been pre-written. Let me check if they're emp
**[2026-03-26 07:06:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:09]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:22]** 🧠 Thinking: These existing test files already cover the memory store layer. But the task description asks for RAG pipeline tests specifically - unit tests for ing
**[2026-03-26 07:06:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:22]** 🔧 Using tool: `unknown`
**[2026-03-26 07:06:26]** 🔧 Using tool: `unknown`
**[2026-03-26 07:07:30]** 🧠 Thinking: Based on my exploration, I can see:

1. The RAG types are fully defined in `packages/shared/src/types/rag.ts` - with types for ingestion connectors, c
**[2026-03-26 07:07:30]** 🔧 Using tool: `unknown`
**[2026-03-26 07:07:30]** 🔧 Using tool: `unknown`
**[2026-03-26 07:07:30]** 🔧 Using tool: `unknown`
**[2026-03-26 07:07:31]** ℹ️ /Users/matancohen/.copilot/session-state/ea1e6b72-693e-467b-b385-85730bc9d172/plan.md
**[2026-03-26 07:07:34]** 🔧 Using tool: `unknown`
**[2026-03-26 07:07:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:07:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:07:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:08:10]** 🔧 Using tool: `unknown`
**[2026-03-26 07:08:11]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/chunker.ts
**[2026-03-26 07:08:44]** 🔧 Using tool: `unknown`
**[2026-03-26 07:08:44]** 🔧 Using tool: `unknown`
**[2026-03-26 07:08:45]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/connectors.ts
**[2026-03-26 07:09:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:09:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:09:29]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/vector-store.ts
**[2026-03-26 07:10:11]** 🔧 Using tool: `unknown`
**[2026-03-26 07:10:11]** 🔧 Using tool: `unknown`
**[2026-03-26 07:10:12]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/rag-service.ts
**[2026-03-26 07:10:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:10:19]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/index.ts
**[2026-03-26 07:10:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:10:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:10:29]** 🔧 Using tool: `unknown`
**[2026-03-26 07:11:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:11:08]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/__tests__/chunker.test.ts
**[2026-03-26 07:12:00]** 🔧 Using tool: `unknown`
**[2026-03-26 07:12:01]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/__tests__/connectors.test.ts
**[2026-03-26 07:12:48]** 🔧 Using tool: `unknown`
**[2026-03-26 07:12:49]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/__tests__/vector-store.test.ts
**[2026-03-26 07:12:55]** 🔧 Using tool: `unknown`
**[2026-03-26 07:13:42]** 🔧 Using tool: `unknown`
**[2026-03-26 07:13:42]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/__tests__/rag-integration.test.ts
**[2026-03-26 07:14:37]** 🔧 Using tool: `unknown`
**[2026-03-26 07:14:38]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/__tests__/retrieval-quality.test.ts
**[2026-03-26 07:15:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:15:29]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/__tests__/rag-e2e.test.ts
**[2026-03-26 07:16:35]** 🔧 Using tool: `unknown`
**[2026-03-26 07:16:36]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/memory-store/src/rag/__tests__/edge-cases.test.ts
**[2026-03-26 07:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 07:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 07:16:44]** 🔧 Using tool: `unknown`
**[2026-03-26 07:16:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:05]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:14]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:21]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:35]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:43]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:52]** 🔧 Using tool: `unknown`
**[2026-03-26 07:17:52]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:25]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:41]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:47]** 🔧 Using tool: `unknown`
**[2026-03-26 07:18:53]** 🔧 Using tool: `unknown`
**[2026-03-26 07:19:00]** 🔧 Using tool: `unknown`
**[2026-03-26 07:19:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:19:14]** 🔧 Using tool: `unknown`
**[2026-03-26 07:19:30]** 🔧 Using tool: `unknown`
**[2026-03-26 07:19:39]** 🔧 Using tool: `unknown`

**[2026-03-26 07:19:53]** ✅ Zoidberg completed this task.

**Result:**
Done. Here's a summary:

## Completed: RAG Pipeline E2E Tests with Quality Benchmarks

**Implementation** (4 files in `packages/memory-store/src/rag/`):
- **chunker.ts** — Token estimation, heading-aware splitting, overlap
- **connectors.ts** — Ingestion connectors for commit, PR, doc, task sources
- **vector-store.ts** — SQLite vector store with FTS5 hybrid search
- **rag-service.ts** — Full pipeline orchestrator (ingest→chunk→embed→store→query)

**Tests** (166 passing across 7 files):
| File | Tests | Coverage |
|------|-------|----------|
| `chunker.test.ts` | 26 | Token estimation, chunk IDs, heading paths, overlap, boundaries |
| `connectors.test.ts` | 31 | All 4 connectors: commit, PR, doc, task + edge cases |
| `vector-store.test.ts` | 29 | CRUD, search, filters (sourceType/agents/tags/date), FTS |
| `rag-integration.test.ts` | 12 | Full round-trip: ingest→search for all source types |
| `retrieval-quality.test.ts` | 30 | Precision@k, Recall@k, MRR benchmarks (16-entry corpus, 8 topics) |
| `rag-e2e.test.ts` | 10 | Agent context retrieval, multi-agent isolation, token budgets |
| `edge-cases.test.ts` | 28 | Empty repos, 10k-line diffs, CJK/Japanese/Korean/Arabic/emoji, concurrent ingestion |

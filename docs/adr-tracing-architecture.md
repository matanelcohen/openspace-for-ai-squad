# ADR: Tracing Data Model & Architecture

**Status:** Accepted  
**Date:** 2026-03-26  
**Authors:** openspace.ai squad

## Context

openspace.ai orchestrates AI agent squads that execute multi-step tasks involving LLM calls, tool invocations, reasoning steps, and agent-to-agent delegation. Operators need visibility into what agents are doing, how much it costs, and where things go wrong. Without structured tracing, debugging agent failures, auditing decisions, and optimizing cost/latency is guesswork.

The `@openspace/tracing` package already provides span-based instrumentation (Tracer, TraceCollector, LLM/tool auto-instrumentation, cost calculation). This ADR formalizes the data model and defines the end-to-end architecture from agent execution through storage to the UI.

## Decision

### 1. Data Model

Three core entities form a hierarchy: **Run → Span → Step**.

```
Run (1 per agent execution)
 └── Span tree (parent-child via parentSpanId)
      └── Steps (semantic projection of spans for UI)
```

#### Run

A **Run** is the top-level container for a complete agent execution session. Its `runId` equals the root `traceId`.

```typescript
interface Run {
  readonly runId: string;          // = traceId
  readonly agentId: string;        // which agent executed
  readonly taskId?: string;        // optional linked task
  readonly trigger: RunTrigger;    // 'user' | 'cron' | 'webhook' | 'delegation' | 'workflow'
  readonly status: RunStatus;      // 'running' | 'completed' | 'failed' | 'cancelled'
  readonly startTime: number;      // epoch ms
  readonly endTime?: number;
  readonly durationMs?: number;
  readonly tokenUsage: TokenUsage; // aggregated across all child spans
  readonly totalCostUsd: number;   // aggregated
  readonly spanCount: number;
  readonly errorMessage?: string;
  readonly metadata?: Record<string, unknown>;
}
```

#### Span

A **Span** is a unit of work within a run. Spans form a tree via `parentSpanId`. Each span captures timing, token usage, cost, and status.

```typescript
interface Span {
  readonly context: SpanContext;                  // { traceId, spanId, parentSpanId }
  readonly name: string;                          // e.g. "llm:gpt-4o", "tool:search"
  readonly kind: SpanKind;                        // 'internal' | 'tool' | 'llm' | 'agent' | 'reasoning'
  readonly status: SpanStatus;                    // 'ok' | 'error' | 'unset'
  readonly startTime: number;                     // epoch ms
  readonly endTime?: number;
  readonly durationMs?: number;                   // endTime - startTime
  readonly tokenUsage?: TokenUsage;               // promoted from llm.* attributes
  readonly costUsd?: number;                      // promoted from llm.cost_usd
  readonly attributes: Record<string, unknown>;   // domain-specific attributes
  readonly events: readonly SpanEvent[];           // timestamped events within the span
}

interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}
```

**Attribute conventions** (OpenTelemetry-aligned):

| Kind | Key attributes |
|------|---------------|
| `llm` | `llm.model`, `llm.provider`, `llm.prompt_tokens`, `llm.completion_tokens`, `llm.cost_usd`, `llm.streaming`, `llm.time_to_first_token_ms` |
| `tool` | `tool.id`, `tool.name`, `tool.input`, `tool.output`, `tool.error`, `tool.duration_ms` |
| `agent` | `agent.id`, `agent.name`, `service.name` |
| `reasoning` | `reasoning.strategy`, `reasoning.conclusion` |

#### Step

A **Step** is a UI-friendly projection of a Span. Steps flatten the span tree into an ordered action list for display in the trace detail view.

```typescript
type StepType = 'reasoning' | 'tool-call' | 'llm-call' | 'agent' | 'internal';

interface Step {
  readonly stepId: string;             // = spanId
  readonly runId: string;              // = traceId
  readonly parentStepId?: string;      // = parentSpanId
  readonly type: StepType;             // derived from SpanKind
  readonly name: string;
  readonly status: SpanStatus;
  readonly startTime: number;
  readonly endTime?: number;
  readonly durationMs?: number;
  readonly input?: unknown;            // from tool.input or llm prompt
  readonly output?: unknown;           // from tool.output or llm response
  readonly error?: string;
  readonly tokenUsage?: TokenUsage;
  readonly costUsd?: number;
  readonly metadata?: Record<string, unknown>;
}
```

Steps are **computed, not stored**. The `SPAN_KIND_TO_STEP_TYPE` mapping converts span kind → step type. Input/output are extracted from span attributes.

#### Trace

A **Trace** assembles a complete Run with all its spans for retrieval:

```typescript
interface Trace {
  readonly traceId: string;
  readonly rootSpanId: string;
  readonly spans: readonly Span[];
  readonly startTime: number;
  readonly endTime?: number;
  readonly durationMs?: number;
  readonly tokenUsage: TokenUsage;     // aggregated
  readonly totalCostUsd: number;       // aggregated
  readonly run?: Run;
}
```

### 2. Data Flow

```
┌──────────────┐    spans     ┌──────────────┐   batch flush   ┌──────────────┐
│    Agent      │─────────────▶│   Tracer +    │────────────────▶│  TraceStore   │
│  (execution)  │              │  Collector    │                 │  (SQLite)     │
└──────────────┘              └──────────────┘                 └──────┬───────┘
                                                                      │
                                                                      │ query
                                                                      ▼
┌──────────────┐   REST/WS    ┌──────────────┐                ┌──────────────┐
│    Web UI     │◀────────────│   API Server  │◀───────────────│  TraceStore   │
│  (traces/)    │             │  (Fastify)    │   listRuns()   │   (reads)     │
└──────────────┘              └──────────────┘   getTrace()    └──────────────┘
```

**Detailed flow:**

1. **Agent execution** — The agent's `Tracer` instance wraps each operation in spans via `withSpan()`. Instrumentation helpers (`instrumentLLMCall`, `instrumentToolCall`) auto-create spans for LLM and tool calls.

2. **Context propagation** — `AsyncLocalStorage` propagates `SpanContext` across async boundaries. Child spans automatically inherit `traceId` and set `parentSpanId`.

3. **Collection** — The `TraceCollector` buffers completed spans in memory. It flushes to the configured `TraceSink` on two triggers:
   - **Batch size** reached (default: 64 spans)
   - **Time interval** elapsed (default: 5000ms)

4. **Storage** — The `TraceSink` calls `TraceStore.appendSpans()` and `TraceStore.upsertRun()` to persist data. The append-only design means spans are never mutated after write.

5. **API** — Fastify routes expose:
   - `GET /api/traces` → `TraceStore.listRuns(query)`
   - `GET /api/traces/:runId` → `TraceStore.getTrace(runId)`

6. **UI** — The Next.js `traces/` components fetch from the API and render the run list, trace timeline, and step detail.

### 3. Storage Strategy

#### Append-Only Design

Spans are **immutable after write**. The store only performs:
- `INSERT` for new spans (idempotent on spanId)
- `UPSERT` for run records (status/endTime/aggregated metrics update as new spans arrive)
- `DELETE` only for retention pruning

This simplifies concurrency (no read-modify-write conflicts) and makes the system suitable for write-ahead logging.

#### SQLite Schema (Production)

Two tables, indexed by runId:

```sql
-- Runs: one row per agent execution, updated as spans complete
CREATE TABLE trace_runs (
  run_id        TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  task_id       TEXT,
  trigger       TEXT NOT NULL DEFAULT 'unknown',
  status        TEXT NOT NULL DEFAULT 'running',
  start_time    INTEGER NOT NULL,            -- epoch ms
  end_time      INTEGER,
  duration_ms   INTEGER,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  total_cost_usd    REAL NOT NULL DEFAULT 0,
  span_count        INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata      TEXT                         -- JSON blob
);

CREATE INDEX idx_runs_agent    ON trace_runs(agent_id);
CREATE INDEX idx_runs_status   ON trace_runs(status);
CREATE INDEX idx_runs_start    ON trace_runs(start_time DESC);

-- Spans: append-only, one row per span
CREATE TABLE trace_spans (
  span_id       TEXT PRIMARY KEY,
  trace_id      TEXT NOT NULL,               -- = run_id
  parent_span_id TEXT,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,               -- 'internal' | 'tool' | 'llm' | 'agent' | 'reasoning'
  status        TEXT NOT NULL,
  start_time    INTEGER NOT NULL,
  end_time      INTEGER,
  duration_ms   INTEGER,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  cost_usd      REAL,
  attributes    TEXT NOT NULL DEFAULT '{}',   -- JSON blob
  events        TEXT NOT NULL DEFAULT '[]'    -- JSON array
);

CREATE INDEX idx_spans_trace ON trace_spans(trace_id);
CREATE INDEX idx_spans_kind  ON trace_spans(kind);
```

**Why SQLite:**
- Already used in the stack (`.squad/db.sqlite` for chat channels)
- Zero-config, embedded, file-based
- WAL mode handles concurrent reads + single writer well
- Sufficient for single-machine squad deployments (target: <10K spans/hour)

#### Write Path

The `TraceSink` implementation:
1. Begins a transaction
2. `INSERT OR IGNORE INTO trace_spans` for each span in the batch
3. `INSERT OR REPLACE INTO trace_runs` with aggregated metrics recomputed from all spans for that runId
4. Commits

All writes happen in the collector's flush cycle — the agent's hot path never touches SQLite.

#### Read Path

- **List runs**: `SELECT * FROM trace_runs WHERE ... ORDER BY start_time DESC LIMIT ? OFFSET ?`
- **Get trace**: `SELECT * FROM trace_spans WHERE trace_id = ?` + `SELECT * FROM trace_runs WHERE run_id = ?`
- Steps are computed on read by projecting spans through `SPAN_KIND_TO_STEP_TYPE`

### 4. Retention Policy

| Setting | Default | Configurable via |
|---------|---------|-----------------|
| **Max age** | 30 days | `TRACE_RETENTION_DAYS` env var |
| **Max runs** | 10,000 | `TRACE_MAX_RUNS` env var |
| **Max storage** | 500 MB | `TRACE_MAX_STORAGE_MB` env var |

**Pruning strategy:**
- A periodic job (runs every hour, unref'd `setInterval`) calls `TraceStore.pruneRunsBefore()` for the age limit
- After pruning by age, if count or storage exceeds limits, prune oldest-first until under budget
- `VACUUM` runs after large pruning operations to reclaim space

**Sensitive data:**
- Tool inputs/outputs and LLM prompts are stored as-is by default
- Opt-in redaction: configure `TracerConfig.redactAttributes` to strip sensitive fields before persistence

### 5. Performance Budget

**Target: tracing overhead < 5% of agent latency.**

#### Analysis

Typical agent execution:
- LLM call: 500ms–5000ms
- Tool call: 50ms–2000ms
- Total run: 2s–60s

Tracing operations per span:
| Operation | Cost | Notes |
|-----------|------|-------|
| `startSpan()` | ~5µs | Object allocation + `AsyncLocalStorage.getStore()` |
| `setAttributes()` | ~2µs | Object.assign on in-memory map |
| `endSpan()` | ~10µs | Freeze + push to collector buffer |
| Collector buffer push | ~1µs | Array.push (in-memory) |

**Total per span: ~18µs** (~0.002% of a 1s operation)

Collector flush (batch of 64 spans):
| Operation | Cost | Notes |
|-----------|------|-------|
| Serialize 64 spans to JSON | ~500µs | Runs in collector's async flush, off hot path |
| SQLite INSERT 64 rows | ~2ms | WAL mode, single transaction |
| Run upsert + aggregation | ~500µs | Single UPDATE |

**Total flush: ~3ms** — happens asynchronously, never blocks the agent.

#### Safeguards

1. **Async flush** — Collector uses `setInterval` (unref'd) and batch-size triggers. The agent never waits for I/O.
2. **Backpressure** — If flush fails, spans return to the buffer. If buffer exceeds 10× batchSize, oldest spans are dropped with a warning.
3. **No-op mode** — If no collector is configured, `Tracer` still works but `submit()` is never called. Zero overhead.
4. **Sampling** (future) — Support head-based sampling (`TracerConfig.sampleRate: 0.0–1.0`) to reduce volume for high-throughput scenarios.

## Consequences

### Positive
- Full visibility into agent execution: what happened, how long, what it cost
- Append-only design is simple, fast, and debuggable
- Types are backward-compatible with existing Tracer/Collector code
- SQLite keeps the stack dependency-free (no external services)
- Steps as computed projections avoid data duplication

### Negative
- SQLite limits horizontal scaling (single-machine only) — acceptable for current squad deployments
- Storing raw tool inputs/outputs increases storage; mitigated by retention policy
- No distributed tracing support (no W3C trace context propagation across services) — can be added later

### Risks
- Large tool outputs (e.g., file contents) could bloat span storage → mitigate with attribute size limits (default: 64KB per attribute)
- High-frequency agent loops could generate thousands of spans per minute → mitigate with sampling and backpressure

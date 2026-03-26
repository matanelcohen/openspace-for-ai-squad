# DAG Workflow Engine — Architecture & Data Model

> **Status:** Draft · **Author:** Leela (Squad Lead) · **Date:** 2026-03-25
>
> Defines the core architecture for the DAG workflow engine: graph data
> structures, execution model, checkpoint/resume strategy, and Tool Registry
> integration.

---

## 1. Problem Statement

The existing `WorkflowEngine` in `packages/shared/src/workflow/index.ts`
provides a working foundation — topological sort, cycle detection, HITL gates,
basic serial execution — but has several gaps that prevent production use:

| Gap | Impact |
|-----|--------|
| No conditional predicates on edges | Condition nodes evaluate to a branch label string, but there is no structured predicate model — callers must supply opaque evaluators |
| No `ExecutionContext` | Node inputs are bare `Record<string, unknown>` threaded through predecessors. No scoped variables, secrets, or workflow-level state |
| No `CheckpointStore` | Serialization helpers exist, but there is no persistence abstraction — callers must manage storage themselves |
| Sequential "parallel" execution | `parallel_split`/`parallel_join` are structural markers only; nodes inside a fork still execute one at a time |
| No retry / timeout per step | A single node failure kills the entire workflow with no recovery path |
| No Tool Registry integration | The `NodeExecutor` callback *could* call the registry, but there is no first-class binding between step config and tool invocation |
| No error propagation strategy | Fail-fast only — no partial failure, no skip-on-error, no error handlers |
| No workflow versioning | Definition changes after an execution starts are undefined behavior |

This design addresses every item above while preserving backward compatibility
with existing types and tests.

---

## 2. Design Principles

1. **Immutable state transitions** — every mutation returns a new state object.
   Never mutate in place.
2. **Pure core, effectful shell** — graph logic and state derivation are pure
   functions. I/O (tool invocation, persistence, notifications) happens at the
   boundary via injected interfaces.
3. **Progressive enhancement** — the new engine must accept existing
   `WorkflowDefinition` shapes unchanged. New features are opt-in via extended
   config objects.
4. **Parallel by default** — if two nodes have no data dependency, they execute
   concurrently via `Promise.all`.
5. **Checkpoint-first** — state is persisted before and after every node
   execution. Crash recovery resumes from the last checkpoint.

---

## 3. Data Model

### 3.1 Core Graph Types

```typescript
// ── Node Types (extends existing WorkflowNodeType) ──────────────

type StepNodeType =
  | 'task'           // Invokes a tool or custom handler
  | 'condition'      // Evaluates a predicate, selects outbound edges
  | 'hitl_gate'      // Pauses for human approval
  | 'parallel_split' // Fork point — enables concurrent branches
  | 'parallel_join'  // Join point — waits for all/any inbound branches
  | 'sub_workflow'    // Delegates to a nested DAGWorkflow
  | 'start'          // Entry sentinel
  | 'end';           // Exit sentinel

// ── StepNode ────────────────────────────────────────────────────

interface StepNode {
  /** Unique within the workflow. Kebab-case recommended. */
  id: string;

  /** Human-readable label shown in the UI. */
  label: string;

  /** Discriminator for execution dispatch. */
  type: StepNodeType;

  /**
   * Type-specific configuration.
   *
   * For 'task' nodes:
   *   toolId?:     string           — Tool Registry ID to invoke
   *   toolParams?: Record<string, unknown> | ParameterMapping[]
   *   handler?:    string           — named custom handler (fallback if no toolId)
   *
   * For 'condition' nodes:
   *   predicate:   ConditionalPredicate
   *
   * For 'hitl_gate' nodes:
   *   escalationChainId?: string
   *   prompt?:     string           — message shown to the reviewer
   *
   * For 'parallel_join' nodes:
   *   joinStrategy: 'all' | 'any'  — wait for all branches or first
   *
   * For 'sub_workflow' nodes:
   *   workflowId:  string           — ID of nested workflow definition
   *   inputMapping?: ParameterMapping[]
   */
  config: StepNodeConfig;

  /** Maximum time (ms) this node may execute before being killed. */
  timeoutMs?: number;

  /** Number of automatic retries on transient failure. Default 0. */
  retries?: number;

  /** Delay (ms) between retries. Supports exponential backoff. */
  retryDelayMs?: number;

  /** What to do when this node fails after all retries. */
  onFailure?: 'fail_workflow' | 'skip' | 'continue';

  /** Metadata for UI rendering (position, color, icon). */
  metadata?: Record<string, unknown>;
}
```

### 3.2 Step Node Config (discriminated by `StepNodeType`)

```typescript
// ── Task Node Config ────────────────────────────────────────────

interface TaskNodeConfig {
  /** Tool Registry ID. If set, the engine invokes this tool. */
  toolId?: string;

  /**
   * Static parameters or dynamic mappings from ExecutionContext.
   * Static:  { "repo": "openspace", "branch": "main" }
   * Dynamic: [{ param: "branch", from: "ctx.inputs.branchName" }]
   */
  toolParams?: Record<string, unknown> | ParameterMapping[];

  /** Named handler for non-tool execution. */
  handler?: string;
}

interface ParameterMapping {
  /** Target parameter name on the tool. */
  param: string;

  /**
   * JSONPath-like expression resolved against ExecutionContext.
   * Examples:
   *   "ctx.vars.repoUrl"
   *   "ctx.nodeOutputs['fetch-repo'].data.commitSha"
   *   "ctx.secrets.GITHUB_TOKEN"
   */
  from: string;
}

// ── Condition Node Config ───────────────────────────────────────

interface ConditionNodeConfig {
  predicate: ConditionalPredicate;
}

// ── HITL Gate Config ────────────────────────────────────────────

interface HITLGateNodeConfig {
  escalationChainId?: string;
  prompt?: string;
}

// ── Parallel Join Config ────────────────────────────────────────

interface ParallelJoinNodeConfig {
  /** 'all' = wait for every inbound branch. 'any' = first to complete wins. */
  joinStrategy: 'all' | 'any';
}

// ── Sub-Workflow Config ─────────────────────────────────────────

interface SubWorkflowNodeConfig {
  workflowId: string;
  inputMapping?: ParameterMapping[];
}

// ── Union ───────────────────────────────────────────────────────

type StepNodeConfig =
  | TaskNodeConfig
  | ConditionNodeConfig
  | HITLGateNodeConfig
  | ParallelJoinNodeConfig
  | SubWorkflowNodeConfig
  | Record<string, unknown>; // start/end/parallel_split carry no config
```

### 3.3 Edges & Conditional Predicates

```typescript
// ── Edge ────────────────────────────────────────────────────────

interface Edge {
  /** Source node ID. */
  from: string;

  /** Target node ID. */
  to: string;

  /**
   * Optional predicate. If present, this edge is only traversed when the
   * predicate evaluates to true against the source node's output and the
   * ExecutionContext.
   *
   * Edges without a predicate are "default" — traversed when no sibling
   * predicate matches (like an else branch).
   */
  condition?: ConditionalPredicate;

  /**
   * Human-readable label for the edge (shown in UI on arrows).
   * e.g. "on success", "score > 0.8", "else"
   */
  label?: string;

  /** Execution priority when multiple edges are eligible. Lower = first. */
  priority?: number;
}

// ── Conditional Predicate ───────────────────────────────────────

/**
 * A structured, serializable predicate that the engine evaluates
 * without requiring caller-supplied functions.
 *
 * Supports simple comparisons, logical combinators, and
 * JSONPath-like field references into the ExecutionContext.
 */
type ConditionalPredicate =
  | ComparisonPredicate
  | LogicalPredicate
  | ExpressionPredicate;

interface ComparisonPredicate {
  type: 'comparison';
  /** JSONPath-like reference. e.g. "output.status", "ctx.vars.env" */
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'matches';
  value: unknown;
}

interface LogicalPredicate {
  type: 'and' | 'or' | 'not';
  operands: ConditionalPredicate[];
}

/**
 * Escape hatch for complex predicates that can't be expressed
 * as simple comparisons. Evaluated in a sandboxed expression
 * evaluator (NOT eval).
 */
interface ExpressionPredicate {
  type: 'expression';
  /** Safe expression string, e.g. "output.score > 0.8 && ctx.vars.env === 'prod'" */
  expr: string;
}
```

### 3.4 DAGWorkflow (Definition)

```typescript
interface DAGWorkflow {
  /** Unique identifier for the workflow definition. */
  id: string;

  /** Human-readable name. */
  name: string;

  /** Semantic version string (major.minor.patch). */
  version: string;

  /** Optional description. */
  description?: string;

  /** All nodes in the graph. */
  nodes: StepNode[];

  /** All directed edges. */
  edges: Edge[];

  /**
   * Workflow-level variables available to all nodes via ExecutionContext.
   * Can be overridden at execution time.
   */
  defaultVars?: Record<string, unknown>;

  /**
   * Secrets the workflow requires (names only — values are injected
   * at runtime from a secure store, never serialized).
   */
  requiredSecrets?: string[];

  /** Maximum total execution time (ms) for the entire workflow. */
  timeoutMs?: number;

  /** Metadata for UI (layout positions, tags, etc). */
  metadata?: Record<string, unknown>;
}
```

### 3.5 ExecutionContext

```typescript
/**
 * The runtime context threaded through every node execution.
 * Provides access to workflow variables, predecessor outputs,
 * secrets, and the Tool Registry.
 *
 * Immutable — every update returns a new context.
 */
interface ExecutionContext {
  /** The current workflow execution ID. */
  executionId: string;

  /** The workflow definition ID + version. */
  workflowId: string;
  workflowVersion: string;

  /**
   * Workflow-level variables (merged: definition defaults → runtime overrides).
   * Mutable by nodes via `setVar()`.
   */
  vars: Record<string, unknown>;

  /**
   * Collected outputs from all completed nodes, keyed by node ID.
   * Populated automatically by the engine after each node completes.
   */
  nodeOutputs: Record<string, NodeOutput>;

  /**
   * Secret values, injected at workflow start from a secure provider.
   * Never serialized to checkpoints.
   */
  secrets: Record<string, string>;

  /**
   * Reference to the Tool Registry for dynamic tool discovery/invocation
   * within custom handlers. Not serialized.
   */
  toolRegistry: ToolRegistryRef;

  /** ISO-8601 timestamp when the execution started. */
  startedAt: string;

  /** Correlation ID for distributed tracing / logging. */
  traceId: string;
}

interface NodeOutput {
  /** The data returned by the node. */
  data: unknown;
  /** ISO-8601 completion timestamp. */
  completedAt: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

/**
 * Minimal interface the workflow engine needs from the Tool Registry.
 * Avoids coupling to the full ToolRegistry class.
 */
interface ToolRegistryRef {
  invoke(input: { toolId: string; parameters: Record<string, unknown>; timeout?: number }): Promise<{
    success: boolean;
    data?: unknown;
    error?: { code: string; message: string };
    durationMs: number;
  }>;
  discover(filter?: { category?: string; name?: string }): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
  }>;
}
```

### 3.6 Execution State (enhanced)

```typescript
/** Execution status of a single node (extends existing). */
type NodeExecutionStatus =
  | 'pending'
  | 'queued'      // NEW: scheduled for execution but not yet started
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'      // HITL gate waiting for human
  | 'skipped'     // condition branch not taken
  | 'cancelled'   // NEW: workflow cancelled while node was pending/running
  | 'retrying';   // NEW: failed but retrying

interface NodeExecutionState {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  output: unknown;
  error: string | null;
  escalationId: string | null;

  // ── New fields ──
  /** Current retry attempt (0-based). */
  attempt: number;
  /** History of all attempts (for debugging). */
  attempts: AttemptRecord[];
  /** Duration of the successful/final attempt in ms. */
  durationMs: number | null;
}

interface AttemptRecord {
  attempt: number;
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'failed';
  output?: unknown;
  error?: string;
  durationMs: number;
}

/** Workflow-level execution status (extends existing). */
type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';    // NEW: workflow-level timeout exceeded

interface WorkflowExecutionState {
  executionId: string;
  workflowId: string;
  workflowVersion: string;   // NEW: pins the definition version
  status: WorkflowExecutionStatus;
  nodeStates: Record<string, NodeExecutionState>;
  /** Serializable subset of ExecutionContext (secrets excluded). */
  contextSnapshot: SerializedContext;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null; // NEW
  /** Which checkpoint version this state represents. */
  checkpointVersion: number;  // NEW
}

interface SerializedContext {
  vars: Record<string, unknown>;
  nodeOutputs: Record<string, NodeOutput>;
  startedAt: string;
  traceId: string;
}
```

---

## 4. Execution Model

### 4.1 Execution Lifecycle

```
 ┌──────────┐
 │ validate  │  ── cycle detection, edge references, start/end nodes
 └────┬─────┘
      ▼
 ┌──────────┐
 │ init ctx  │  ── merge default vars + runtime overrides, inject secrets
 └────┬─────┘
      ▼
 ┌──────────┐
 │checkpoint │  ── persist initial state (version 0)
 └────┬─────┘
      ▼
 ┌───────────────────────────────────────────────┐
 │              main loop                         │
 │                                                │
 │  1. getReadyNodes(state)                       │
 │  2. if none → derive final status, exit        │
 │  3. partition into parallel batches             │
 │  4. Promise.all(batch.map(executeNode))         │
 │  5. for each completed node:                   │
 │     a. evaluate outbound edge predicates       │
 │     b. mark unreachable successors as skipped  │
 │     c. update ExecutionContext.nodeOutputs      │
 │  6. checkpoint state                           │
 │  7. if any node paused → return 'paused'       │
 │  8. if any node failed (no retries left) →     │
 │     apply onFailure policy                     │
 │  9. goto 1                                     │
 └───────────────────────────────────────────────┘
```

### 4.2 Parallel Fan-Out / Fan-In

**Fan-Out** at a `parallel_split` node:
1. The split node completes immediately.
2. All outbound edges from the split are evaluated.
3. Eligible successor nodes are added to the ready set.
4. The engine schedules them concurrently via `Promise.all`.

**Fan-In** at a `parallel_join` node:
- **`joinStrategy: 'all'`** — the join node becomes ready only when *all*
  inbound predecessors are `completed` or `skipped`.
- **`joinStrategy: 'any'`** — the join node becomes ready when *any one*
  inbound predecessor completes. Remaining branches are cancelled.

```
    ┌─ [lint]  ──┐
[split]─ [test] ──[join]── [deploy]
    └─ [audit] ──┘
```

The engine's `getReadyNodes()` function (already present) naturally handles
this: a node is ready when all its predecessors (via inbound edges) are in a
terminal state. For `any` joins, we enhance the check:

```typescript
function isNodeReady(nodeId: string, def: DAGWorkflow, state: WorkflowExecutionState): boolean {
  const inbound = def.edges.filter(e => e.to === nodeId);
  const node = def.nodes.find(n => n.id === nodeId);

  if (node?.type === 'parallel_join' && node.config.joinStrategy === 'any') {
    // Ready if ANY predecessor completed
    return inbound.some(e => {
      const s = state.nodeStates[e.from]?.status;
      return s === 'completed';
    });
  }

  // Default: ready when ALL predecessors are terminal
  return inbound.every(e => {
    const s = state.nodeStates[e.from]?.status;
    return s === 'completed' || s === 'skipped' || s === 'cancelled';
  });
}
```

### 4.3 Topological Sort & Scheduling

The existing Kahn's algorithm implementation is correct and retained. We
extend it to produce *level-based* ordering for parallel scheduling:

```typescript
/**
 * Returns nodes grouped by topological level.
 * Nodes at the same level have no dependency between them
 * and can execute in parallel.
 */
function topologicalLevels(nodes: StepNode[], edges: Edge[]): string[][] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) { inDegree.set(n.id, 0); adj.set(n.id, []); }
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  const levels: string[][] = [];
  let queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);

  while (queue.length > 0) {
    levels.push([...queue]);
    const next: string[] = [];
    for (const id of queue) {
      for (const neighbor of adj.get(id) ?? []) {
        const d = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, d);
        if (d === 0) next.push(neighbor);
      }
    }
    queue = next;
  }

  return levels;
}
```

### 4.4 Cycle Detection

Retained as-is (DFS with recursion stack). Runs during `validateWorkflow()`
before execution starts. The algorithm is O(V+E) which is sufficient for
workflows up to tens of thousands of nodes.

### 4.5 Condition Evaluation & Edge Traversal

After a `condition` node completes, the engine evaluates outbound edge
predicates to determine which branches to activate:

```typescript
function evaluateEdgePredicate(
  predicate: ConditionalPredicate,
  nodeOutput: unknown,
  ctx: ExecutionContext,
): boolean {
  switch (predicate.type) {
    case 'comparison': {
      const actual = resolveField(predicate.field, nodeOutput, ctx);
      return compareValues(actual, predicate.operator, predicate.value);
    }
    case 'and':
      return predicate.operands.every(op => evaluateEdgePredicate(op, nodeOutput, ctx));
    case 'or':
      return predicate.operands.some(op => evaluateEdgePredicate(op, nodeOutput, ctx));
    case 'not':
      return !evaluateEdgePredicate(predicate.operands[0], nodeOutput, ctx);
    case 'expression':
      return evaluateSandboxedExpression(predicate.expr, nodeOutput, ctx);
  }
}
```

**Edge Selection Rules:**
1. Evaluate all outbound edges with predicates.
2. Edges whose predicates return `true` are *active* — their target nodes
   become eligible.
3. If no predicate matches, edges without a predicate (default edges) are
   activated.
4. If *still* no edge matches, the engine throws `NoMatchingEdgeError`.
5. Target nodes of inactive edges are recursively marked `skipped`.

### 4.6 Error Propagation

Each `StepNode` declares its failure policy via `onFailure`:

| Policy | Behavior |
|--------|----------|
| `fail_workflow` (default) | Node failure stops the workflow. Status → `failed`. |
| `skip` | Node failure marks it and all unreachable descendants as `skipped`. Execution continues on other branches. |
| `continue` | Node failure is recorded but execution continues as if it completed (output = `null`). |

**Retry logic** wraps each node execution:

```typescript
async function executeWithRetry(
  node: StepNode,
  ctx: ExecutionContext,
  handler: NodeHandler,
): Promise<NodeResult> {
  const maxAttempts = (node.retries ?? 0) + 1;
  const attempts: AttemptRecord[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = (node.retryDelayMs ?? 1000) * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
    const start = Date.now();
    try {
      const output = await withTimeout(handler(node, ctx), node.timeoutMs ?? 30_000);
      attempts.push({ attempt, startedAt: new Date(start).toISOString(), completedAt: new Date().toISOString(), status: 'completed', output, durationMs: Date.now() - start });
      return { status: 'completed', output, attempts };
    } catch (err) {
      attempts.push({ attempt, startedAt: new Date(start).toISOString(), completedAt: new Date().toISOString(), status: 'failed', error: String(err), durationMs: Date.now() - start });
    }
  }

  return { status: 'failed', error: attempts.at(-1)?.error ?? 'Unknown', attempts };
}
```

---

## 5. Checkpoint / Resume Strategy

### 5.1 CheckpointStore Interface

```typescript
/**
 * Persistence layer for workflow execution state.
 * Implementations: SQLite (local), Azure Blob (cloud), In-Memory (tests).
 */
interface CheckpointStore {
  /**
   * Save a checkpoint. Implementations must be atomic —
   * a half-written checkpoint must not be visible to readers.
   */
  save(state: WorkflowExecutionState): Promise<void>;

  /**
   * Load the latest checkpoint for a workflow execution.
   * Returns null if no checkpoint exists.
   */
  load(executionId: string): Promise<WorkflowExecutionState | null>;

  /**
   * Load a specific checkpoint version.
   */
  loadVersion(executionId: string, version: number): Promise<WorkflowExecutionState | null>;

  /**
   * List all checkpoint versions for an execution (metadata only).
   */
  listVersions(executionId: string): Promise<CheckpointMetadata[]>;

  /**
   * Delete all checkpoints for an execution (cleanup after completion).
   */
  delete(executionId: string): Promise<void>;

  /**
   * Delete checkpoint versions older than `keepLast` for an execution.
   * Prevents unbounded storage growth for long-running workflows.
   */
  prune(executionId: string, keepLast: number): Promise<number>;
}

interface CheckpointMetadata {
  executionId: string;
  version: number;
  status: WorkflowExecutionStatus;
  savedAt: string;
  sizeBytes: number;
}
```

### 5.2 Checkpoint Protocol

1. **Before execution starts:** Save checkpoint v0 (all nodes `pending`).
2. **After each execution batch:** Save checkpoint v(n+1) with updated node
   states and context snapshot.
3. **On pause (HITL gate):** Save checkpoint with `status: 'paused'`.
4. **On resume:** Load latest checkpoint, verify it's `paused`, continue.
5. **On completion/failure:** Save final checkpoint, then prune old versions.

**What IS checkpointed:**
- `WorkflowExecutionState` (all node states, attempts, outputs)
- `SerializedContext` (vars, nodeOutputs, traceId)
- Workflow definition version (to detect schema drift)

**What is NOT checkpointed:**
- `secrets` (re-injected on resume from secure provider)
- `toolRegistry` reference (re-injected on resume)
- In-flight promise state (nodes marked `running` at crash time are reset to
  `pending` on recovery)

### 5.3 Crash Recovery

```typescript
function recoverState(state: WorkflowExecutionState): WorkflowExecutionState {
  const recovered = { ...state, nodeStates: { ...state.nodeStates } };
  for (const [nodeId, ns] of Object.entries(recovered.nodeStates)) {
    if (ns.status === 'running' || ns.status === 'queued' || ns.status === 'retrying') {
      // Reset in-flight nodes to pending — they will be re-executed
      recovered.nodeStates[nodeId] = {
        ...ns,
        status: 'pending',
        startedAt: null,
        completedAt: null,
      };
    }
  }
  recovered.status = 'running';
  return recovered;
}
```

### 5.4 SQLite Checkpoint Implementation (reference)

Since the project already uses `better-sqlite3`, the default `CheckpointStore`
implementation uses a dedicated table:

```sql
CREATE TABLE IF NOT EXISTS workflow_checkpoints (
  execution_id  TEXT    NOT NULL,
  version       INTEGER NOT NULL,
  status        TEXT    NOT NULL,
  state_json    TEXT    NOT NULL,
  saved_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  size_bytes    INTEGER NOT NULL,
  PRIMARY KEY (execution_id, version)
);

CREATE INDEX idx_checkpoints_execution ON workflow_checkpoints(execution_id, version DESC);
```

---

## 6. Tool Registry Integration

### 6.1 Binding Model

Task nodes can declare a `toolId` in their config. The engine resolves this
against the injected `ToolRegistryRef` at execution time:

```typescript
async function executeTaskNode(
  node: StepNode,
  ctx: ExecutionContext,
): Promise<unknown> {
  const config = node.config as TaskNodeConfig;

  if (config.toolId) {
    // Resolve parameters
    const params = resolveToolParams(config.toolParams, ctx);

    // Invoke via Tool Registry
    const result = await ctx.toolRegistry.invoke({
      toolId: config.toolId,
      parameters: params,
      timeout: node.timeoutMs,
    });

    if (!result.success) {
      throw new ToolExecutionError(config.toolId, result.error);
    }

    return result.data;
  }

  if (config.handler) {
    // Fall back to named handler
    const handler = ctx.handlers?.[config.handler];
    if (!handler) throw new Error(`Unknown handler: "${config.handler}"`);
    return handler(node, ctx);
  }

  throw new Error(`Task node "${node.id}" has neither toolId nor handler`);
}
```

### 6.2 Parameter Resolution

`ParameterMapping` entries are resolved against the `ExecutionContext` using a
simple dot-path resolver:

```typescript
function resolveToolParams(
  params: Record<string, unknown> | ParameterMapping[] | undefined,
  ctx: ExecutionContext,
): Record<string, unknown> {
  if (!params) return {};
  if (!Array.isArray(params)) return params; // static params

  const resolved: Record<string, unknown> = {};
  for (const mapping of params) {
    resolved[mapping.param] = resolvePath(mapping.from, ctx);
  }
  return resolved;
}

function resolvePath(path: string, ctx: ExecutionContext): unknown {
  const parts = path.split('.');
  let current: unknown = { ctx };
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    // Handle bracket notation: nodeOutputs['fetch-repo']
    const bracketMatch = part.match(/^(\w+)\['([^']+)'\]$/);
    if (bracketMatch) {
      current = (current as Record<string, unknown>)[bracketMatch[1]];
      current = (current as Record<string, unknown>)?.[bracketMatch[2]];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}
```

### 6.3 Interaction Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    DAGWorkflow Engine                     │
│                                                          │
│  DAGWorkflow ──► Validator ──► Scheduler (topo levels)   │
│                                    │                     │
│                         ┌──────────┼──────────┐          │
│                         ▼          ▼          ▼          │
│                     [task-A]   [task-B]   [task-C]       │
│                         │          │          │          │
│                         ▼          ▼          ▼          │
│                   ┌─────────────────────────────┐        │
│                   │      ExecutionContext        │        │
│                   │  vars, nodeOutputs, secrets  │        │
│                   └──────────┬──────────────────┘        │
│                              │                           │
│                   ┌──────────▼──────────────────┐        │
│                   │      ToolRegistryRef         │        │
│                   │  invoke() / discover()       │        │
│                   └──────────┬──────────────────┘        │
│                              │                           │
│                   ┌──────────▼──────────────────┐        │
│                   │      CheckpointStore         │        │
│                   │  save() / load() / prune()   │        │
│                   └─────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
                              │
                   ┌──────────▼──────────────────┐
                   │     Tool Registry            │
                   │  (apps/api/services)         │
                   │                              │
                   │  ToolProvider (Git, File,     │
                   │   API, Search, Custom)        │
                   └──────────────────────────────┘
```

---

## 7. Engine API (public surface)

```typescript
class DAGWorkflowEngine {
  constructor(config: DAGWorkflowEngineConfig);

  /** Validate a workflow definition. Returns errors (empty = valid). */
  validate(workflow: DAGWorkflow): string[];

  /** Start a new execution. Returns the initial state after checkpoint v0. */
  start(
    workflow: DAGWorkflow,
    options?: {
      executionId?: string;
      vars?: Record<string, unknown>;
      secrets?: Record<string, string>;
      traceId?: string;
    },
  ): Promise<WorkflowExecutionState>;

  /** Resume a paused execution (after HITL approval). */
  resume(
    workflow: DAGWorkflow,
    executionId: string,
    resolution: { escalationId: string; approved: boolean; output?: unknown },
  ): Promise<WorkflowExecutionState>;

  /** Cancel a running or paused execution. */
  cancel(executionId: string): Promise<WorkflowExecutionState>;

  /** Get the current state of an execution. */
  getState(executionId: string): Promise<WorkflowExecutionState | null>;

  /** Subscribe to execution events. */
  on(event: WorkflowEvent, handler: WorkflowEventHandler): void;
}

interface DAGWorkflowEngineConfig {
  /** Persistence layer for checkpoints. */
  checkpointStore: CheckpointStore;

  /** Tool Registry for tool invocation. */
  toolRegistry: ToolRegistryRef;

  /** Named custom handlers for non-tool task nodes. */
  handlers?: Record<string, NodeHandler>;

  /** HITL gate handler (creates escalation items). */
  onHITLGate: (node: StepNode, executionId: string, ctx: ExecutionContext) => Promise<string>;

  /** Escalation resolution provider. */
  resolveEscalation: (escalationId: string) => Promise<{ approved: boolean; output?: unknown }>;

  /** Maximum concurrent node executions. Default: 10. */
  maxConcurrency?: number;

  /** Event listeners for observability. */
  eventListeners?: WorkflowEventHandler[];
}

type NodeHandler = (node: StepNode, ctx: ExecutionContext) => Promise<unknown>;

// ── Events ──────────────────────────────────────────────────────

type WorkflowEvent =
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:paused'
  | 'workflow:resumed'
  | 'workflow:cancelled'
  | 'node:started'
  | 'node:completed'
  | 'node:failed'
  | 'node:retrying'
  | 'node:skipped'
  | 'node:paused'
  | 'checkpoint:saved';

interface WorkflowEventPayload {
  executionId: string;
  workflowId: string;
  event: WorkflowEvent;
  nodeId?: string;
  timestamp: string;
  data?: unknown;
}

type WorkflowEventHandler = (payload: WorkflowEventPayload) => void;
```

---

## 8. State Serialization

### 8.1 Wire Format

All state is JSON-serializable. The canonical format:

```json
{
  "executionId": "exec-abc123",
  "workflowId": "deploy-pipeline",
  "workflowVersion": "1.2.0",
  "status": "running",
  "checkpointVersion": 3,
  "nodeStates": {
    "start": { "nodeId": "start", "status": "completed", "attempt": 0, "attempts": [...], ... },
    "lint":  { "nodeId": "lint",  "status": "completed", "attempt": 0, "attempts": [...], ... },
    "test":  { "nodeId": "test",  "status": "running",   "attempt": 1, "attempts": [...], ... }
  },
  "contextSnapshot": {
    "vars": { "env": "staging", "branch": "main" },
    "nodeOutputs": {
      "lint": { "data": { "passed": true, "warnings": 2 }, "completedAt": "...", "durationMs": 1230 }
    },
    "startedAt": "2026-03-25T23:00:00.000Z",
    "traceId": "trace-xyz"
  },
  "createdAt": "2026-03-25T23:00:00.000Z",
  "updatedAt": "2026-03-25T23:01:30.000Z",
  "completedAt": null
}
```

### 8.2 Schema Versioning

Each serialized state includes `checkpointVersion` (per-execution counter) and
the `workflowVersion` from the definition. On deserialization:

1. If `workflowVersion` doesn't match the current definition version, the
   engine emits a `workflow:version_mismatch` warning but continues (the
   execution is pinned to the version it started with).
2. Future: migration functions can transform old state shapes.

---

## 9. Backward Compatibility

The existing `WorkflowDefinition`, `DAGNode`, and `DAGEdge` types are a
strict subset of the new `DAGWorkflow`, `StepNode`, and `Edge` types:

| Existing | New | Migration |
|----------|-----|-----------|
| `DAGNode` | `StepNode` | Add `retries: 0`, `onFailure: 'fail_workflow'` defaults |
| `DAGEdge.condition: string` | `Edge.condition: ConditionalPredicate` | Wrap in `{ type: 'comparison', field: 'output.branch', operator: 'eq', value: oldConditionString }` |
| `WorkflowDefinition` | `DAGWorkflow` | Add `version: '1.0.0'` default |
| `WorkflowEngine` | `DAGWorkflowEngine` | Old class remains, new class extends capabilities |

A `migrateLegacyWorkflow(def: WorkflowDefinition): DAGWorkflow` helper will
be provided for zero-effort upgrades.

---

## 10. File Layout (proposed)

```
packages/shared/src/
├── types/
│   ├── workflow.ts              ← existing (unchanged, re-exported)
│   └── dag-workflow.ts          ← NEW: StepNode, Edge, DAGWorkflow,
│                                   ExecutionContext, CheckpointStore,
│                                   ConditionalPredicate, etc.
├── workflow/
│   ├── index.ts                 ← existing engine (unchanged)
│   ├── dag-engine.ts            ← NEW: DAGWorkflowEngine class
│   ├── predicate-evaluator.ts   ← NEW: edge condition evaluation
│   ├── parameter-resolver.ts    ← NEW: ParameterMapping resolution
│   ├── checkpoint.ts            ← NEW: CheckpointStore interface + helpers
│   └── migrate.ts               ← NEW: legacy → new type migration
└── index.ts                     ← add new exports

apps/api/src/services/
└── workflow/                     ← NEW: server-side workflow service
    ├── workflow-service.ts       ← orchestrates engine + checkpoint + tools
    ├── sqlite-checkpoint-store.ts ← CheckpointStore impl for better-sqlite3
    └── __tests__/
        └── workflow-service.test.ts
```

---

## 11. Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | Should the expression predicate use a real expression language (e.g. `filtrex`) or a custom parser? | Start with a restricted custom parser for safety; evaluate `filtrex` later if demand grows. |
| 2 | Should sub-workflows share the parent's `ExecutionContext` or get a copy? | Copy — prevents unintended side effects. Parent maps outputs explicitly. |
| 3 | What is the maximum workflow size we need to support? | Target 500 nodes / 2000 edges for v1. Stress-test with 5,000. |
| 4 | Should `CheckpointStore` support transactions across multiple executions? | No — each execution is independent. Cross-execution coordination is the caller's job. |

---

## 12. Implementation Order

1. **Types** — `dag-workflow.ts` with all interfaces (no runtime code)
2. **Predicate evaluator** — pure function, fully unit-tested
3. **Parameter resolver** — pure function, fully unit-tested
4. **CheckpointStore interface + in-memory impl** — for testing
5. **DAGWorkflowEngine** — core loop with parallel execution
6. **SQLite CheckpointStore** — persistence layer
7. **Legacy migration helper** — backward compat
8. **Integration with existing WorkflowEngine tests** — ensure no regressions

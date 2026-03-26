# HITL Escalation Architecture & Interrupt Model

> **Status:** Draft · **Author:** Leela (Squad Lead) · **Date:** 2026-03-26
>
> Defines the core architecture for human-in-the-loop interrupts, escalation
> chains, state serialization for pause/resume, and the integration contract
> between the interrupt model and the DAG Workflow Engine.

---

## 1. Problem Statement

Agent workflows make decisions autonomously, but some decisions require human
oversight — destructive actions, low-confidence outputs, policy violations, or
cost thresholds. The system needs a way for:

1. **Nodes to signal uncertainty** — any node handler can pause execution and
   request human review.
2. **Declarative policies** — workflow authors can attach interrupt rules to
   any node without modifying the handler code.
3. **Clean pause/resume** — execution halts at the interrupt point, serializes
   all state, and resumes exactly where it left off after human resolution.
4. **Escalation chains** — unresolved interrupts escalate through configurable
   reviewer tiers with timeout-based auto-progression.
5. **Timeout safety** — no workflow hangs indefinitely; every interrupt has a
   default action if humans don't respond.

### Prior Art

This design is inspired by [LangGraph's interrupt model](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/),
where any node can throw an interrupt signal that pauses the graph, serializes
state to a checkpoint, and resumes after external input. We adapt this pattern
to our DAG workflow engine with richer escalation semantics.

---

## 2. Design Principles

1. **Interrupts are control flow, not errors.** An `InterruptError` is a signal,
   not a failure. The engine catches it and transitions the node to `paused`.
2. **Two trigger modes.** Interrupts can be *imperative* (node handler calls
   `interrupt()`) or *declarative* (engine evaluates an `InterruptPolicy` after
   node execution). Both produce the same `InterruptState`.
3. **Checkpoint-first.** Interrupt state is persisted atomically with the
   workflow execution state. A crash during an interrupt is recoverable.
4. **Composable with existing HITL gates.** The `hitl_gate` node type is a
   special case of the interrupt model. Existing workflows continue to work
   unchanged; the interrupt model is strictly additive.
5. **Pure functions for policy evaluation.** `shouldInterrupt()` is a pure
   function — no side effects, no I/O. The engine calls it; the handler
   creates escalation items.

---

## 3. Conceptual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      DAG Workflow Engine                         │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  start   │───▶│  task-a  │───▶│  task-b  │───▶│   end    │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                       │               │                         │
│                       │ InterruptError│ InterruptPolicy         │
│                       ▼               ▼ (post-execution)        │
│                  ┌─────────────────────────┐                    │
│                  │    Interrupt Handler     │                    │
│                  │  ┌───────────────────┐  │                    │
│                  │  │ InterruptState    │  │                    │
│                  │  │ (serialized to    │  │                    │
│                  │  │  checkpoint)      │  │                    │
│                  │  └───────────────────┘  │                    │
│                  └────────────┬────────────┘                    │
│                               │                                 │
│                  ┌────────────▼────────────┐                    │
│                  │   Escalation Manager    │                    │
│                  │  ┌───────────────────┐  │                    │
│                  │  │ EscalationItem    │  │                    │
│                  │  │ EscalationChain   │  │                    │
│                  │  │ Audit Trail       │  │                    │
│                  │  └───────────────────┘  │                    │
│                  └────────────┬────────────┘                    │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                   ┌────────────▼────────────┐
                   │   Human Review UI       │
                   │  - Context snapshot      │
                   │  - Proposed action       │
                   │  - Choices / free-form   │
                   │  - Approve / Reject /    │
                   │    Modify / Delegate     │
                   └────────────┬────────────┘
                                │
                   ┌────────────▼────────────┐
                   │  InterruptResolution    │
                   │  ─▶ Engine.resume()     │
                   └─────────────────────────┘
```

---

## 4. Interrupt Point Abstraction

### 4.1 Imperative Interrupts (`interrupt()`)

Any node handler can call `interrupt()` to pause execution:

```typescript
import { interrupt } from '@openspace/shared/workflow/interrupt';

async function deployHandler(node: StepNode, ctx: ExecutionContext) {
  const plan = await generateDeployPlan(ctx);

  if (plan.risk === 'high') {
    interrupt({
      reason: 'destructive_action',
      message: `Deploy to production affects ${plan.services.length} services`,
      confidenceScore: 0.6,
      proposedAction: plan,
      reasoning: 'High-risk deployment requires human approval',
      choices: [
        { id: 'approve', label: 'Approve deployment', value: true },
        { id: 'reject', label: 'Reject deployment', value: false },
        { id: 'modify', label: 'Modify plan', value: 'modify' },
      ],
      partialState: { plan },
    });
    // ↑ This throws InterruptError — execution never reaches here.
    // The engine catches it, serializes state, and pauses the workflow.
  }

  return executePlan(plan);
}
```

**Mechanism:** `interrupt()` throws an `InterruptError` (a subclass of `Error`
with `__isInterrupt = true`). The engine catches this specific error in
`executeNode()` and transitions the node to `paused` status — it does NOT
treat it as a failure.

### 4.2 Declarative Interrupts (`InterruptPolicy`)

Workflow authors can attach an `InterruptPolicy` to any node. The engine
evaluates this *after* the node completes but *before* committing the output:

```typescript
const workflow = new DAGBuilder('review-pipeline', 'Review Pipeline')
  .addStep({
    id: 'analyze-code',
    label: 'Analyze Code',
    type: 'task',
    config: { toolId: 'code-analysis' },
    interruptPolicy: {
      confidenceThreshold: 0.7,
      interruptWhen: [
        "output.risk === 'critical'",
        "output.vulnerabilities > 5",
      ],
      escalationChainId: 'security-review',
      priority: 'high',
      reviewPrompt: 'Code analysis for {{nodeId}} found {{confidence}} confidence. Please review.',
      timeout: {
        timeoutMs: 30 * 60 * 1000, // 30 minutes
        defaultAction: 'reject',
      },
    },
  })
  .build();
```

**Mechanism:** After `executeTaskWithRetry()` succeeds, the engine calls
`shouldInterrupt(policy, output, nodeId)`. If it returns a non-null
`InterruptRequest`, the engine creates an `InterruptState` and pauses
the node — identical to the imperative path.

### 4.3 HITL Gate Nodes (Legacy Compatible)

The existing `hitl_gate` node type continues to work as before. It is now
modeled as a node that *always* interrupts — a degenerate case where the
interrupt is unconditional:

```typescript
// hitl_gate is syntactic sugar for:
{
  type: 'task',
  config: { handler: '__hitl_noop' },
  interruptPolicy: {
    confidenceThreshold: 1.0,  // always triggers (any output < 1.0)
    escalationChainId: config.escalationChainId,
    priority: config.priority ?? 'medium',
    reviewPrompt: config.prompt,
    timeout: config.timeout,
  },
}
```

The engine preserves the `hitl_gate` node type for backward compatibility and
routes it through the enhanced interrupt path with the `EnhancedHITLGateConfig`.

---

## 5. Data Model

### 5.1 InterruptRequest

What the node provides when requesting an interrupt:

```typescript
interface InterruptRequest {
  reason: InterruptReason;        // 'destructive_action' | 'low_confidence' | ...
  message: string;                // Human-readable explanation
  confidenceScore: number;        // 0–1, lower = more uncertain
  proposedAction: unknown;        // What the agent wants to do
  reasoning?: string;             // Supporting evidence
  choices?: InterruptChoice[];    // Discrete options for the reviewer
  partialState?: Record<string, unknown>;  // For resuming mid-computation
  metadata?: Record<string, unknown>;      // Domain-specific context
}
```

### 5.2 InterruptState

The serialized snapshot stored in the checkpoint:

```typescript
interface InterruptState {
  id: string;                     // Unique interrupt instance ID
  nodeId: string;                 // The paused node
  executionId: string;            // Parent workflow execution
  request: InterruptRequest;      // The original request
  escalationId: string | null;    // Linked escalation item (if created)
  status: 'pending' | 'claimed' | 'resolved' | 'timed_out' | 'auto_resolved';
  resolution: InterruptResolution | null;
  createdAt: string;              // ISO-8601
  timeoutAt: string | null;       // When the timeout expires
  timeoutPolicy: InterruptTimeoutPolicy | null;
}
```

### 5.3 InterruptResolution

The human's decision:

```typescript
interface InterruptResolution {
  action: 'approve' | 'reject' | 'modify' | 'delegate' | 'retry';
  output?: unknown;               // Modified output, rejection reason, etc.
  comment?: string;               // Reviewer's explanation
  reviewerId: string;             // Who resolved it
  resolvedAt: string;             // ISO-8601
  delegateTo?: string;            // Target for delegation
}
```

### 5.4 InterruptPolicy

Declarative rules attached to a node:

```typescript
interface InterruptPolicy {
  confidenceThreshold?: number;   // Auto-interrupt if output.confidence < this
  interruptWhen?: string[];       // Condition expressions against output
  escalationChainId?: string;     // Which chain to follow
  priority?: EscalationPriority;  // 'critical' | 'high' | 'medium' | 'low'
  reviewPrompt?: string;          // Template with {{nodeId}}, {{confidence}}, {{output}}
  timeout?: InterruptTimeoutPolicy;
}
```

### 5.5 InterruptTimeoutPolicy

What happens when humans don't respond:

```typescript
interface InterruptTimeoutPolicy {
  timeoutMs: number;              // Max wait time
  defaultAction: 'approve' | 'reject' | 'escalate' | 'skip' | 'use_default';
  defaultValue?: unknown;         // Output for 'use_default'
}
```

### 5.6 EscalationChain

Multi-tier reviewer escalation:

```typescript
interface EscalationChain {
  id: string;
  name: string;
  levels: EscalationChainLevel[];  // Ordered L1 → L2 → L3
}

interface EscalationChainLevel {
  level: number;                  // 1, 2, 3, ...
  name: string;                   // "L1 Reviewer", "Senior Engineer", etc.
  reviewerIds: string[];          // Who can claim at this level
  timeoutMs: number;              // Auto-escalate to next level after this
}
```

### 5.7 ContextSnapshot

What the reviewer sees:

```typescript
interface ContextSnapshotConfig {
  includeVars?: boolean;                        // Default: true
  includeNodeOutputs?: string[] | 'all' | 'none';  // Default: 'all'
  extraFields?: Array<{ label: string; path: string }>;
  maxSizeBytes?: number;                        // Truncation limit
}
```

### 5.8 InterruptStore

Persistence interface for managing interrupt lifecycle:

```typescript
interface InterruptStore {
  /** Save or update an interrupt state. */
  save(state: InterruptState): Promise<void>;

  /** Load an interrupt by ID. */
  load(interruptId: string): Promise<InterruptState | null>;

  /** Load all active interrupts for an execution. */
  loadByExecution(executionId: string): Promise<InterruptState[]>;

  /** Load the interrupt for a specific paused node. */
  loadByNode(executionId: string, nodeId: string): Promise<InterruptState | null>;

  /** Update status and resolution. */
  resolve(interruptId: string, resolution: InterruptResolution): Promise<InterruptState>;

  /** Find all interrupts that have timed out. */
  findTimedOut(now?: string): Promise<InterruptState[]>;

  /** Delete all interrupts for an execution (cleanup). */
  deleteByExecution(executionId: string): Promise<void>;
}
```

---

## 6. State Serialization & Pause/Resume

### 6.1 Checkpoint Structure

When a workflow pauses due to an interrupt, the checkpoint contains everything
needed to resume:

```typescript
interface EnhancedWorkflowExecutionState {
  executionId: string;
  workflowId: string;
  workflowVersion: string;
  status: 'paused';                          // ← set by the engine

  nodeStates: Record<string, EnhancedNodeExecutionState>;
  // The interrupted node has: { status: 'paused', escalationId: '...' }

  contextSnapshot: SerializedContext;
  // vars + nodeOutputs (secrets excluded)

  activeInterrupts: InterruptState[];
  // All unresolved interrupts (usually 1, but parallel branches can produce multiple)

  createdAt: string;
  updatedAt: string;
  completedAt: null;
  checkpointVersion: number;
}
```

**Key invariant:** `activeInterrupts` is the source of truth for pending
interrupts. It is persisted atomically with the checkpoint. The `InterruptStore`
is a query-optimized secondary index that can be rebuilt from checkpoints.

### 6.2 Serialization Rules

| Field | Serialized? | Notes |
|-------|-------------|-------|
| `vars` | ✅ | Workflow variables |
| `nodeOutputs` | ✅ | Outputs from completed nodes |
| `secrets` | ❌ | Never serialized; re-injected on resume |
| `toolRegistry` | ❌ | Reference; re-injected on resume |
| `activeInterrupts` | ✅ | Full interrupt state including request |
| `partialState` | ✅ | Node handler's partial computation |
| `InterruptRequest.proposedAction` | ✅ | Must be JSON-serializable |

### 6.3 Pause Sequence

```
1. Node handler calls interrupt(request)
   └─▶ throws InterruptError(request)

2. Engine catches InterruptError in executeNode()
   └─▶ Validates request (confidenceScore in range, etc.)
   └─▶ Creates InterruptState via createInterruptState()
   └─▶ Calls InterruptHandler to create EscalationItem
   └─▶ Sets nodeState.status = 'paused'
   └─▶ Sets nodeState.escalationId = escalationItem.id
   └─▶ Adds InterruptState to state.activeInterrupts[]
   └─▶ Checkpoints the entire state atomically
   └─▶ Sets workflowState.status = 'paused'
   └─▶ Emits 'node:paused' + 'workflow:paused' events
   └─▶ Returns the paused state to the caller
```

For declarative policies, step 1 is replaced by:
```
1. Node completes successfully
   └─▶ Engine calls shouldInterrupt(policy, output, nodeId)
   └─▶ Returns InterruptRequest (non-null = trigger)
   └─▶ Engine creates InterruptError internally
   └─▶ Continues from step 2
```

### 6.4 Resume Sequence

```
1. External system calls engine.resume(workflow, executionId, resolution)
   └─▶ Loads checkpoint from CheckpointStore
   └─▶ Validates status === 'paused'

2. Finds the paused node matching the resolution
   └─▶ Matches by interruptId or escalationId

3. Applies the resolution:
   ├─▶ 'approve': Node completes with resolution.output ?? proposedAction
   ├─▶ 'reject': Node fails with rejection reason
   ├─▶ 'modify': Node completes with resolution.output (modified by reviewer)
   ├─▶ 'delegate': Re-escalate to delegateTo target, keep paused
   └─▶ 'retry': Re-execute the node from scratch

4. Removes the interrupt from activeInterrupts[]
5. Updates InterruptStore with resolution
6. Rebuilds ExecutionContext from checkpoint (re-injects secrets, toolRegistry)
7. Emits 'workflow:resumed' event
8. Continues the runLoop() from the resolved point
```

### 6.5 Crash Recovery

If the process crashes while an interrupt is pending:

1. On restart, load the latest checkpoint
2. `recoverState()` resets `running`/`queued`/`retrying` nodes to `pending`
3. `paused` nodes are **not** reset — they stay paused
4. `activeInterrupts` are preserved in the checkpoint
5. The workflow remains in `paused` status until `resume()` is called
6. The timeout watchdog can pick up and auto-resolve timed-out interrupts

---

## 7. Escalation Chain Mechanics

### 7.1 Chain Progression

```
         ┌──────────────────────────────────────────────┐
         │          Escalation Chain: "security-review"  │
         │                                               │
  ┌──────┤  L1: Security Analyst (15 min timeout)       │
  │      │  L2: Security Lead (30 min timeout)          │
  │      │  L3: VP Engineering (60 min timeout)         │
  │      └──────────────────────────────────────────────┘
  │
  │  timeout at L1
  ▼
  ┌──────────────────────────┐
  │  Auto-escalate to L2     │
  │  - New timeout starts    │
  │  - L1 reviewers lose     │
  │    claim eligibility     │
  │  - Audit trail updated   │
  └──────────────────────────┘
  │
  │  timeout at L2
  ▼
  ┌──────────────────────────┐
  │  Auto-escalate to L3     │
  │  (final level)           │
  └──────────────────────────┘
  │
  │  timeout at L3
  ▼
  ┌──────────────────────────┐
  │  Apply timeout policy    │
  │  defaultAction from      │
  │  InterruptTimeoutPolicy  │
  └──────────────────────────┘
```

### 7.2 Level Timeout Algorithm

```typescript
function processEscalationTimeout(item: EscalationItem, chain: EscalationChain): EscalationItem {
  const currentLevel = chain.levels.find(l => l.level === item.currentLevel);
  const nextLevel = chain.levels.find(l => l.level === item.currentLevel + 1);

  if (nextLevel) {
    // Escalate to next level
    return {
      ...item,
      status: 'pending',           // Reset to pending for new reviewers
      currentLevel: nextLevel.level,
      claimedBy: null,
      claimedAt: null,
      timeoutAt: addMs(now(), nextLevel.timeoutMs),
      auditTrail: [...item.auditTrail, {
        id: generateId(),
        escalationId: item.id,
        action: 'level_changed',
        actor: 'system',
        timestamp: now(),
        details: `Auto-escalated from L${currentLevel.level} to L${nextLevel.level}`,
        previousStatus: 'timed_out',
        newStatus: 'pending',
      }],
    };
  } else {
    // Final level timed out — apply timeout policy
    return { ...item, status: 'timed_out' };
  }
}
```

---

## 8. Integration Contract with DAG Workflow Engine

### 8.1 Engine Configuration (Extended)

```typescript
interface DAGWorkflowEngineConfig {
  // ... existing fields ...

  /** Handler for creating escalation items from interrupts. */
  onInterrupt?: InterruptHandler;
  // (interruptState: InterruptState) => Promise<string>  // returns escalation ID

  /** Provider for resolving interrupts (used by resume). */
  interruptResolver?: InterruptResolver;

  /** Store for interrupt state persistence. */
  interruptStore?: InterruptStore;
}
```

### 8.2 How Nodes Signal Uncertainty

**Path A: Imperative (handler calls `interrupt()`)**

```
executeTaskWithRetry()
  └─▶ handler(node, ctx)
      └─▶ handler calls interrupt({...})
          └─▶ throws InterruptError(request)
  └─▶ catch (err)
      └─▶ if isInterruptError(err):
          └─▶ return { status: 'interrupted', request: err.request }
```

**Path B: Declarative (InterruptPolicy on node)**

```
executeNode()
  └─▶ executeTaskWithRetry()  → succeeds with output
  └─▶ if (node.interruptPolicy):
      └─▶ shouldInterrupt(policy, output, nodeId)
          └─▶ returns InterruptRequest | null
      └─▶ if request:
          └─▶ treat as interrupted (same as Path A)
```

**Path C: HITL Gate Node**

```
executeNode()
  └─▶ node.type === 'hitl_gate'
  └─▶ build InterruptRequest from EnhancedHITLGateConfig
  └─▶ treat as interrupted (same as Path A)
```

### 8.3 How Execution Halts

When any node triggers an interrupt:

1. The engine creates an `InterruptState` and adds it to `state.activeInterrupts`
2. The node's status becomes `paused`
3. The `InterruptHandler` is called to create an `EscalationItem` for the review queue
4. The `InterruptStore.save()` persists the interrupt state
5. The engine checkpoints the full state atomically
6. If any node in the current batch is `paused`, the engine sets workflow
   status to `paused` and returns — **it does not start new node batches**
7. The `workflow:paused` event is emitted

**Important:** In a parallel batch, multiple nodes can interrupt simultaneously.
All interrupts are collected, all nodes paused, and all interrupt states are
persisted in the checkpoint. The workflow remains paused until ALL active
interrupts are resolved.

### 8.4 How Execution Resumes

The engine provides two resume paths:

**Enhanced resume (with `InterruptResolution`):**

```typescript
engine.resumeInterrupt(workflow, executionId, {
  interruptId: 'int-abc123',
  resolution: {
    action: 'approve',
    output: { deployPlan: modifiedPlan },
    comment: 'Approved with modified rollback plan',
    reviewerId: 'user-456',
    resolvedAt: new Date().toISOString(),
  },
});
```

**Legacy resume (backward compatible):**

```typescript
engine.resume(workflow, executionId, {
  escalationId: 'esc-123',
  approved: true,
  output: { approved: true },
});
```

Both paths converge in the engine:

```
resume()
  └─▶ Load checkpoint
  └─▶ Find paused node (by interruptId or escalationId)
  └─▶ Apply resolution to node state
  └─▶ Remove from activeInterrupts
  └─▶ Update InterruptStore
  └─▶ Rebuild context (re-inject secrets, toolRegistry)
  └─▶ Continue runLoop()
```

### 8.5 Resolution Action Semantics

| Action | Node Status | Output | Effect |
|--------|-------------|--------|--------|
| `approve` | `completed` | `resolution.output ?? request.proposedAction` | Node succeeds with approved output |
| `reject` | `failed` | `resolution.output` (rejection reason) | Node fails; `onFailure` policy applies |
| `modify` | `completed` | `resolution.output` (required) | Node succeeds with reviewer-modified output |
| `delegate` | `paused` (new interrupt) | — | New escalation to `delegateTo` target |
| `retry` | `pending` (re-queued) | — | Node re-executes from scratch |

### 8.6 Parallel Interrupt Handling

When a parallel batch contains multiple interruptable nodes:

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ node-a  │     │ node-b  │     │ node-c  │
│ (task)  │     │ (task)  │     │ (task)  │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     ▼               ▼               ▼
  completed     InterruptError    InterruptError
                     │               │
                     ▼               ▼
              ┌──────────────────────────┐
              │  activeInterrupts: [     │
              │    { nodeId: 'node-b' }, │
              │    { nodeId: 'node-c' }, │
              │  ]                       │
              └──────────────────────────┘
              │
              ▼
         workflow: paused
```

**Rules:**
- Completed nodes (node-a) have their outputs committed normally
- All interrupted nodes are paused and tracked in `activeInterrupts`
- The workflow stays paused until ALL interrupts are resolved
- Interrupts can be resolved independently (one at a time)
- After each resolution, the engine checks if more interrupts remain
- When `activeInterrupts` is empty, the engine resumes `runLoop()`

---

## 9. Timeout Watchdog

A background process periodically scans for timed-out interrupts:

```typescript
class InterruptTimeoutWatchdog {
  constructor(
    private interruptStore: InterruptStore,
    private engine: DAGWorkflowEngine,
    private escalationManager: EscalationManager,
    private pollIntervalMs: number = 30_000,  // 30 seconds
  ) {}

  start(): void {
    this.timer = setInterval(() => this.tick(), this.pollIntervalMs);
  }

  private async tick(): Promise<void> {
    const timedOut = await this.interruptStore.findTimedOut();

    for (const interrupt of timedOut) {
      const resolved = applyTimeoutPolicy(interrupt);
      if (!resolved) continue;

      if (resolved.status === 'timed_out') {
        // Escalation chain: try next level
        await this.escalationManager.escalateToNextLevel(interrupt.escalationId);
      } else {
        // Auto-resolve with default action
        await this.engine.resumeInterrupt(workflow, interrupt.executionId, {
          interruptId: interrupt.id,
          resolution: resolved.resolution,
        });
      }
    }
  }
}
```

---

## 10. Event Model

### Interrupt Lifecycle Events

| Event | When | Payload |
|-------|------|---------|
| `interrupt:created` | Interrupt state created | `{ interruptId, nodeId, request }` |
| `interrupt:claimed` | Reviewer claims the interrupt | `{ interruptId, reviewerId }` |
| `interrupt:resolved` | Human provides resolution | `{ interruptId, resolution }` |
| `interrupt:timed_out` | Timeout expired, escalating | `{ interruptId, timeoutPolicy }` |
| `interrupt:auto_resolved` | Timeout default action applied | `{ interruptId, resolution }` |

These events extend the existing `WorkflowEvent` union and are emitted through
the same `WorkflowEventHandler` interface.

---

## 11. Security Considerations

1. **Context snapshot truncation.** Large node outputs are truncated via
   `maxSizeBytes` to prevent reviewer UI DoS.
2. **Secrets exclusion.** `ExecutionContext.secrets` is NEVER serialized to
   checkpoints or included in context snapshots.
3. **Reviewer authorization.** The `EscalationChainLevel.reviewerIds` field
   restricts who can claim items at each level. The API layer must enforce this.
4. **Expression sandboxing.** `interruptWhen` conditions use a restricted
   evaluator — no arbitrary code execution, no access to `process`, `require`,
   or globals.
5. **Audit trail immutability.** Every state transition is recorded in
   `AuditEntry[]`. Entries are append-only.

---

## 12. File Inventory

| File | Purpose |
|------|---------|
| `types/interrupt.ts` | Type definitions for the interrupt model |
| `types/escalation.ts` | Type definitions for escalation framework |
| `types/dag-workflow.ts` | DAG engine types (extended with `interruptPolicy`, `activeInterrupts`) |
| `workflow/interrupt.ts` | Runtime: `interrupt()`, `shouldInterrupt()`, `createInterruptState()`, etc. |
| `workflow/interrupt-store.ts` | `InterruptStore` interface + `InMemoryInterruptStore` |
| `workflow/dag-engine.ts` | Engine integration: `InterruptError` catch, policy evaluation, enhanced resume |
| `workflow/checkpoint.ts` | Checkpoint persistence (now includes `activeInterrupts`) |

---

## 13. Migration Path

### Existing `hitl_gate` nodes
No changes required. The engine continues to handle `hitl_gate` through the
existing `onHITLGate` callback. Internally, the engine now also creates an
`InterruptState` for consistency, but the external contract is unchanged.

### Existing `resume()` API
The `resume(workflow, executionId, escalationResolution)` method continues to
work. A new `resumeInterrupt()` method is added for the richer
`InterruptResolution` model. Both methods coexist.

### Existing checkpoint format
The `activeInterrupts` field defaults to `[]` when loading checkpoints that
predate this change. `deserializeState()` handles the missing field gracefully.

---

## 14. Example: End-to-End Flow

```typescript
// 1. Define a workflow with interrupt policy
const workflow = new DAGBuilder('deploy-pipeline', 'Deploy Pipeline')
  .addStep({
    id: 'plan',
    label: 'Generate Deploy Plan',
    type: 'task',
    config: { handler: 'generatePlan' },
    interruptPolicy: {
      confidenceThreshold: 0.8,
      interruptWhen: ["output.risk === 'critical'"],
      escalationChainId: 'deploy-review',
      priority: 'high',
      timeout: { timeoutMs: 30 * 60_000, defaultAction: 'reject' },
    },
  })
  .addStep({
    id: 'execute',
    label: 'Execute Deploy',
    type: 'task',
    config: { handler: 'executeDeploy' },
  })
  .addEdge('plan', 'execute')
  .build();

// 2. Start execution
const state = await engine.start(workflow, { vars: { env: 'production' } });
// → state.status === 'paused' (plan node outputted confidence 0.65)
// → state.activeInterrupts[0].request.confidenceScore === 0.65

// 3. Reviewer approves with modifications
const resumed = await engine.resumeInterrupt(workflow, state.executionId, {
  interruptId: state.activeInterrupts[0].id,
  resolution: {
    action: 'modify',
    output: { ...plan, rollbackEnabled: true },
    comment: 'Approved with mandatory rollback plan',
    reviewerId: 'eng-lead-42',
    resolvedAt: new Date().toISOString(),
  },
});
// → resumed.status === 'completed' (execute node ran with modified plan)
```

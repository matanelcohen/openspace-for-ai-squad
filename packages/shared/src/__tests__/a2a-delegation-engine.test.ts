import { beforeEach, describe, expect, it, vi } from 'vitest';

import { A2AMessageBus } from '../a2a/message-bus.js';
import { CorrelationTracker } from '../a2a/correlation-tracker.js';
import { StatusBroadcaster } from '../a2a/status-broadcaster.js';
import { DelegationEngine } from '../a2a/delegation-engine.js';
import type { DelegationRequest, SplitWorkPlan } from '../a2a/delegation-engine.js';
import type { A2ADelegationRequest } from '../types/a2a.js';
import type { AgentResolver } from '../a2a/message-bus.js';

// ── Helpers ──────────────────────────────────────────────────────

function createMockResolver(): AgentResolver {
  return {
    getAgent: (id: string) => ({ id, role: 'Backend', capabilities: ['api'], currentLoad: 1 }),
    getAllAgents: () => [
      { id: 'bender', role: 'Backend', capabilities: ['api'], currentLoad: 1 },
      { id: 'fry', role: 'Frontend', capabilities: ['ui'], currentLoad: 2 },
    ],
    getAgentsByRole: (role: string) =>
      [
        { id: 'bender', role: 'Backend', capabilities: ['api'], currentLoad: 1 },
        { id: 'fry', role: 'Frontend', capabilities: ['ui'], currentLoad: 2 },
      ].filter((a) => a.role === role),
    getAgentsByCapability: (caps: string[]) =>
      [
        { id: 'bender', role: 'Backend', capabilities: ['api'], currentLoad: 1 },
        { id: 'fry', role: 'Frontend', capabilities: ['ui'], currentLoad: 2 },
      ].filter((a) => a.capabilities.some((c) => caps.includes(c))),
  };
}

let idSeq = 0;
function deterministicId(prefix: string): string {
  return `${prefix}-${++idSeq}`;
}

function createEngine(opts?: { broadcaster?: StatusBroadcaster }) {
  const bus = new A2AMessageBus({ agentResolver: createMockResolver(), broadcaster: opts?.broadcaster });
  const tracker = new CorrelationTracker();
  const engine = new DelegationEngine({
    messageBus: bus,
    correlationTracker: tracker,
    broadcaster: opts?.broadcaster,
    generateId: deterministicId,
  });
  return { bus, tracker, engine };
}

function baseDelegationRequest(overrides: Partial<DelegationRequest> = {}): DelegationRequest {
  return {
    fromAgentId: 'leela',
    routing: { strategy: 'direct', target: 'bender' },
    taskId: 'task-42',
    summary: 'Build the API',
    instructions: 'Create REST endpoints',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('DelegationEngine', () => {
  beforeEach(() => {
    idSeq = 0;
  });

  // ── delegate ────────────────────────────────────────────────

  describe('delegate()', () => {
    it('sends a delegation request and registers in tracker', async () => {
      const { engine, tracker } = createEngine();
      const result = await engine.delegate(baseDelegationRequest());

      expect(result.requestMessage.type).toBe('delegation_request');
      expect(result.requestMessage.sender).toBe('leela');
      expect(result.requestMessage.recipient).toBe('bender');
      expect(result.correlationId).toBeTruthy();

      // Tracker should have the sub-task
      const subTasks = tracker.getSubTasks(result.correlationId);
      expect(subTasks).toHaveLength(1);
      expect(subTasks[0]!.status).toBe('queued');
    });

    it('uses custom priority', async () => {
      const { engine } = createEngine();
      const result = await engine.delegate(baseDelegationRequest({ priority: 'critical' }));
      expect(result.requestMessage.priority).toBe('critical');
    });

    it('uses custom retryPolicy', async () => {
      const { engine } = createEngine();
      const customRetry = { maxAttempts: 5, initialDelayMs: 500, backoffMultiplier: 3, maxDelayMs: 60000, ttlMs: 600000 };
      const result = await engine.delegate(baseDelegationRequest({ retryPolicy: customRetry }));
      expect(result.requestMessage.retryPolicy).toEqual(customRetry);
    });

    it('uses deadline from request', async () => {
      const { engine } = createEngine();
      const deadline = new Date(Date.now() + 3600000).toISOString();
      const result = await engine.delegate(baseDelegationRequest({ deadline }));
      expect(result.requestMessage.payload.deadline).toBe(deadline);
    });

    it('uses requiredCapabilities from request', async () => {
      const { engine } = createEngine();
      const result = await engine.delegate(
        baseDelegationRequest({ requiredCapabilities: ['api', 'db'] }),
      );
      expect(result.requestMessage.payload.requiredCapabilities).toEqual(['api', 'db']);
    });

    it('uses constraints from request', async () => {
      const { engine } = createEngine();
      const result = await engine.delegate(
        baseDelegationRequest({ constraints: ['no-external-calls'] }),
      );
      expect(result.requestMessage.payload.constraints).toEqual(['no-external-calls']);
    });

    it('sets allowSubDelegation to true when specified', async () => {
      const { engine } = createEngine();
      const result = await engine.delegate(
        baseDelegationRequest({ allowSubDelegation: true }),
      );
      expect(result.requestMessage.payload.allowSubDelegation).toBe(true);
    });

    it('defaults allowSubDelegation to false', async () => {
      const { engine } = createEngine();
      const result = await engine.delegate(baseDelegationRequest());
      expect(result.requestMessage.payload.allowSubDelegation).toBe(false);
    });

    it('emits delegation:requested via broadcaster', async () => {
      const broadcaster = new StatusBroadcaster();
      const listener = vi.fn();
      broadcaster.on('delegation:requested', listener);

      const { engine } = createEngine({ broadcaster });
      await engine.delegate(baseDelegationRequest());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'delegation:requested' }),
      );
    });
  });

  // ── splitWork ───────────────────────────────────────────────

  describe('splitWork()', () => {
    it('creates multiple delegations with a shared correlationId', async () => {
      const { engine } = createEngine();

      const plan: SplitWorkPlan = {
        parentTaskId: 'parent-1',
        coordinatorAgentId: 'leela',
        subTasks: [
          baseDelegationRequest({ taskId: 'sub-1', routing: { strategy: 'direct', target: 'bender' } }),
          baseDelegationRequest({ taskId: 'sub-2', routing: { strategy: 'direct', target: 'fry' } }),
        ],
      };

      const result = await engine.splitWork(plan);

      expect(result.delegations).toHaveLength(2);
      // All share the same correlationId
      expect(result.delegations[0]!.correlationId).toBe(result.correlationId);
      expect(result.delegations[1]!.correlationId).toBe(result.correlationId);
    });

    it('each sub-task gets context with parentTaskId', async () => {
      const { engine } = createEngine();

      const plan: SplitWorkPlan = {
        parentTaskId: 'parent-1',
        coordinatorAgentId: 'leela',
        subTasks: [
          baseDelegationRequest({ taskId: 'sub-1', routing: { strategy: 'direct', target: 'bender' } }),
        ],
      };

      const result = await engine.splitWork(plan);
      const payload = result.delegations[0]!.requestMessage.payload;
      expect(payload.context).toHaveProperty('parentTaskId', 'parent-1');
      expect(payload.context).toHaveProperty('correlationId', result.correlationId);
    });

    it('registers sub-tasks in tracker under shared correlationId', async () => {
      const { engine, tracker } = createEngine();

      const plan: SplitWorkPlan = {
        parentTaskId: 'parent-1',
        coordinatorAgentId: 'leela',
        subTasks: [
          baseDelegationRequest({ taskId: 'sub-1', routing: { strategy: 'direct', target: 'bender' } }),
          baseDelegationRequest({ taskId: 'sub-2', routing: { strategy: 'direct', target: 'fry' } }),
        ],
      };

      const result = await engine.splitWork(plan);
      const subTasks = tracker.getSubTasks(result.correlationId);
      expect(subTasks).toHaveLength(2);
    });
  });

  // ── respond ─────────────────────────────────────────────────

  describe('respond()', () => {
    it('responds with "accepted" and updates tracker to in_progress', async () => {
      const { engine, tracker } = createEngine();
      const delegation = await engine.delegate(baseDelegationRequest());

      const response = await engine.respond(
        delegation.requestMessage,
        'bender',
        'accepted',
      );

      expect(response.type).toBe('delegation_response');
      expect(response.payload.outcome).toBe('accepted');
      expect(response.sender).toBe('bender');
      expect(response.recipient).toBe('leela');

      const subTasks = tracker.getSubTasks(delegation.correlationId);
      expect(subTasks[0]!.status).toBe('in_progress');
    });

    it('responds with "rejected" and updates tracker to failed', async () => {
      const { engine, tracker } = createEngine();
      const delegation = await engine.delegate(baseDelegationRequest());

      await engine.respond(
        delegation.requestMessage,
        'bender',
        'rejected',
        { reason: 'Too busy' },
      );

      const subTasks = tracker.getSubTasks(delegation.correlationId);
      expect(subTasks[0]!.status).toBe('failed');
    });

    it('responds with "counter_proposed" and includes counter proposal', async () => {
      const { engine } = createEngine();
      const delegation = await engine.delegate(baseDelegationRequest());

      const response = await engine.respond(
        delegation.requestMessage,
        'bender',
        'counter_proposed',
        {
          reason: 'Need more time',
          counterProposal: {
            summary: 'Revised plan',
            instructions: 'Build simpler API',
            estimatedEffort: 'PT4H',
          },
        },
      );

      expect(response.payload.outcome).toBe('counter_proposed');
      expect(response.payload.counterProposal?.summary).toBe('Revised plan');
    });

    it('emits delegation:responded via broadcaster', async () => {
      const broadcaster = new StatusBroadcaster();
      const listener = vi.fn();
      broadcaster.on('delegation:responded', listener);

      const { engine } = createEngine({ broadcaster });
      const delegation = await engine.delegate(baseDelegationRequest());
      await engine.respond(delegation.requestMessage, 'bender', 'accepted');

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ── reportStatus ────────────────────────────────────────────

  describe('reportStatus()', () => {
    it('sends a status update and updates tracker', async () => {
      const { engine, tracker } = createEngine();
      const delegation = await engine.delegate(baseDelegationRequest());
      await engine.respond(delegation.requestMessage, 'bender', 'accepted');

      const statusMsg = await engine.reportStatus(
        delegation.correlationId,
        'bender',
        delegation.requestMessage.id,
        {
          taskId: 'task-42',
          status: 'in_progress',
          description: 'Working on it',
          progressPercent: 50,
        },
        'leela',
      );

      expect(statusMsg.type).toBe('status_update');
      expect(statusMsg.payload.status).toBe('in_progress');

      const subTasks = tracker.getSubTasks(delegation.correlationId);
      expect(subTasks[0]!.progressPercent).toBe(50);
    });

    it('emits correlation:completed when all sub-tasks are done', async () => {
      const broadcaster = new StatusBroadcaster();
      const listener = vi.fn();
      broadcaster.on('correlation:completed', listener);

      const { engine } = createEngine({ broadcaster });
      const delegation = await engine.delegate(baseDelegationRequest());
      await engine.respond(delegation.requestMessage, 'bender', 'accepted');

      await engine.reportStatus(
        delegation.correlationId,
        'bender',
        delegation.requestMessage.id,
        {
          taskId: 'task-42',
          status: 'completed',
          description: 'Done',
          progressPercent: 100,
        },
        'leela',
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'correlation:completed',
          data: expect.objectContaining({ correlationId: delegation.correlationId }),
        }),
      );
    });
  });

  // ── getCorrelationStatus ────────────────────────────────────

  describe('getCorrelationStatus()', () => {
    it('returns aggregated status from the tracker', async () => {
      const { engine } = createEngine();
      const delegation = await engine.delegate(baseDelegationRequest());

      const status = engine.getCorrelationStatus(delegation.correlationId);
      expect(status).not.toBeNull();
      expect(status!.totalSubTasks).toBe(1);
    });

    it('returns null for unknown correlationId', () => {
      const { engine } = createEngine();
      expect(engine.getCorrelationStatus('nonexistent')).toBeNull();
    });
  });

  // ── isDelegationComplete ────────────────────────────────────

  describe('isDelegationComplete()', () => {
    it('returns false when sub-tasks are still pending', async () => {
      const { engine } = createEngine();
      const delegation = await engine.delegate(baseDelegationRequest());
      expect(engine.isDelegationComplete(delegation.correlationId)).toBe(false);
    });

    it('returns true when all sub-tasks are terminal', async () => {
      const { engine, tracker } = createEngine();
      const delegation = await engine.delegate(baseDelegationRequest());

      tracker.updateSubTask(
        delegation.correlationId,
        delegation.requestMessage.id,
        { status: 'completed' },
      );

      expect(engine.isDelegationComplete(delegation.correlationId)).toBe(true);
    });
  });

  // ── collectResults ──────────────────────────────────────────

  describe('collectResults()', () => {
    it('collects artifacts from completed sub-tasks', async () => {
      const { engine, tracker } = createEngine();
      const delegation = await engine.delegate(baseDelegationRequest());

      const artifact = { id: 'art-1', label: 'Result', mimeType: 'application/json', uri: '/out.json', createdAt: '' };
      tracker.updateSubTask(
        delegation.correlationId,
        delegation.requestMessage.id,
        { status: 'completed', artifacts: [artifact] },
      );

      const results = engine.collectResults(delegation.correlationId);
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('art-1');
    });
  });
});

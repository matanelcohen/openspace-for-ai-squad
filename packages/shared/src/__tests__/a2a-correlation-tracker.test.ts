import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CorrelationTracker,
  findSubTaskMessages,
} from '../a2a/correlation-tracker.js';
import type { SubTaskEntry, CorrelationStatus } from '../a2a/correlation-tracker.js';
import type { A2AMessage } from '../types/a2a.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeEntry(overrides: Partial<SubTaskEntry> = {}): SubTaskEntry {
  return {
    messageId: overrides.messageId ?? 'msg-1',
    assigneeId: overrides.assigneeId ?? 'agent-a',
    taskId: overrides.taskId ?? 'task-1',
    status: overrides.status ?? 'queued',
    progressPercent: overrides.progressPercent ?? 0,
    artifacts: overrides.artifacts ?? [],
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('CorrelationTracker', () => {
  let tracker: CorrelationTracker;

  beforeEach(() => {
    tracker = new CorrelationTracker();
  });

  // ── registerCorrelation ─────────────────────────────────────

  describe('registerCorrelation()', () => {
    it('sets up a correlation group with an origin message', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      const status = tracker.getStatus('corr-1');
      expect(status).not.toBeNull();
      expect(status!.correlationId).toBe('corr-1');
      expect(status!.originMessageId).toBe('origin-msg');
      expect(status!.totalSubTasks).toBe(0);
    });
  });

  // ── addSubTask ──────────────────────────────────────────────

  describe('addSubTask()', () => {
    it('adds an entry to the group', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1' }));

      const entries = tracker.getSubTasks('corr-1');
      expect(entries).toHaveLength(1);
      expect(entries[0]!.messageId).toBe('msg-1');
    });

    it('creates the group implicitly if not registered', () => {
      tracker.addSubTask('corr-new', makeEntry({ messageId: 'msg-x' }));
      const entries = tracker.getSubTasks('corr-new');
      expect(entries).toHaveLength(1);
    });

    it('notifies listeners when a sub-task is added', () => {
      const listener = vi.fn();
      tracker.onChange(listener);

      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'corr-1' }),
      );
    });
  });

  // ── updateSubTask ───────────────────────────────────────────

  describe('updateSubTask()', () => {
    it('updates status, progress, and artifacts', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1' }));

      const artifact = {
        id: 'art-1',
        label: 'Result',
        mimeType: 'text/plain',
        uri: '/out.txt',
        createdAt: new Date().toISOString(),
      };

      const result = tracker.updateSubTask('corr-1', 'msg-1', {
        status: 'in_progress',
        progressPercent: 50,
        artifacts: [artifact],
      });

      expect(result).not.toBeNull();
      expect(result!.overallStatus).toBe('in_progress');

      const entries = tracker.getSubTasks('corr-1');
      expect(entries[0]!.status).toBe('in_progress');
      expect(entries[0]!.progressPercent).toBe(50);
      expect(entries[0]!.artifacts).toHaveLength(1);
    });

    it('returns CorrelationStatus on success', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1' }));

      const result = tracker.updateSubTask('corr-1', 'msg-1', { status: 'completed' });
      expect(result).toHaveProperty('correlationId', 'corr-1');
      expect(result).toHaveProperty('completedSubTasks', 1);
    });

    it('returns null for unknown correlation group', () => {
      const result = tracker.updateSubTask('nonexistent', 'msg-1', { status: 'completed' });
      expect(result).toBeNull();
    });

    it('returns null for unknown messageId within a group', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1' }));

      const result = tracker.updateSubTask('corr-1', 'msg-unknown', { status: 'completed' });
      expect(result).toBeNull();
    });

    it('appends artifacts rather than replacing them', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      const art1 = { id: 'a1', label: 'A1', mimeType: 'text/plain', uri: '/a1', createdAt: '' };
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1', artifacts: [art1] }));

      const art2 = { id: 'a2', label: 'A2', mimeType: 'text/plain', uri: '/a2', createdAt: '' };
      tracker.updateSubTask('corr-1', 'msg-1', { artifacts: [art2] });

      const entries = tracker.getSubTasks('corr-1');
      expect(entries[0]!.artifacts).toHaveLength(2);
    });
  });

  // ── getStatus ───────────────────────────────────────────────

  describe('getStatus()', () => {
    it('aggregates totalSubTasks, completedSubTasks, failedSubTasks, progressPercent', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1', status: 'completed', progressPercent: 100 }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-2', status: 'failed', progressPercent: 0 }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-3', status: 'in_progress', progressPercent: 50 }));

      const status = tracker.getStatus('corr-1')!;
      expect(status.totalSubTasks).toBe(3);
      expect(status.completedSubTasks).toBe(1);
      expect(status.failedSubTasks).toBe(1);
      expect(status.progressPercent).toBe(50); // Math.round((100+0+50)/3)
    });

    it('returns null for unknown correlationId', () => {
      expect(tracker.getStatus('nonexistent')).toBeNull();
    });

    it('returns 0 progressPercent for empty group', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      const status = tracker.getStatus('corr-1')!;
      expect(status.progressPercent).toBe(0);
    });
  });

  // ── getSubTasks ─────────────────────────────────────────────

  describe('getSubTasks()', () => {
    it('returns entries for a known group', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-2' }));

      expect(tracker.getSubTasks('corr-1')).toHaveLength(2);
    });

    it('returns empty array for unknown group', () => {
      expect(tracker.getSubTasks('nonexistent')).toEqual([]);
    });
  });

  // ── isComplete ──────────────────────────────────────────────

  describe('isComplete()', () => {
    it('returns true when all sub-tasks are completed', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1', status: 'completed' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-2', status: 'completed' }));

      expect(tracker.isComplete('corr-1')).toBe(true);
    });

    it('returns true when all sub-tasks are completed or failed (terminal)', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1', status: 'completed' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-2', status: 'failed' }));

      expect(tracker.isComplete('corr-1')).toBe(true);
    });

    it('returns false when any sub-task is still in_progress', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1', status: 'completed' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-2', status: 'in_progress' }));

      expect(tracker.isComplete('corr-1')).toBe(false);
    });

    it('returns false for an empty group', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      expect(tracker.isComplete('corr-1')).toBe(false);
    });

    it('returns false for unknown group', () => {
      expect(tracker.isComplete('nonexistent')).toBe(false);
    });
  });

  // ── collectArtifacts ────────────────────────────────────────

  describe('collectArtifacts()', () => {
    it('only collects artifacts from completed sub-tasks', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');

      const art1 = { id: 'a1', label: 'A1', mimeType: 'text/plain', uri: '/a1', createdAt: '' };
      const art2 = { id: 'a2', label: 'A2', mimeType: 'text/plain', uri: '/a2', createdAt: '' };

      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1', status: 'completed', artifacts: [art1] }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-2', status: 'in_progress', artifacts: [art2] }));

      const artifacts = tracker.collectArtifacts('corr-1');
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]!.id).toBe('a1');
    });

    it('returns empty array for unknown group', () => {
      expect(tracker.collectArtifacts('nonexistent')).toEqual([]);
    });
  });

  // ── onChange ─────────────────────────────────────────────────

  describe('onChange()', () => {
    it('fires listener on addSubTask', () => {
      const listener = vi.fn();
      tracker.onChange(listener);

      tracker.addSubTask('corr-1', makeEntry());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('fires listener on updateSubTask', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1' }));

      const listener = vi.fn();
      tracker.onChange(listener);

      tracker.updateSubTask('corr-1', 'msg-1', { status: 'in_progress' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function that stops notifications', () => {
      const listener = vi.fn();
      const unsub = tracker.onChange(listener);

      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-1' }));
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();

      tracker.addSubTask('corr-1', makeEntry({ messageId: 'msg-2' }));
      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });

    it('swallows listener errors without breaking the tracker', () => {
      const badListener = vi.fn(() => { throw new Error('boom'); });
      const goodListener = vi.fn();
      tracker.onChange(badListener);
      tracker.onChange(goodListener);

      tracker.addSubTask('corr-1', makeEntry());
      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ── remove ──────────────────────────────────────────────────

  describe('remove()', () => {
    it('cleans up a correlation group', () => {
      tracker.registerCorrelation('corr-1', 'origin-msg');
      tracker.addSubTask('corr-1', makeEntry());

      tracker.remove('corr-1');

      expect(tracker.getStatus('corr-1')).toBeNull();
      expect(tracker.getSubTasks('corr-1')).toEqual([]);
    });
  });

  // ── Overall status derivation ───────────────────────────────

  describe('overallStatus derivation', () => {
    it('returns "completed" when all sub-tasks completed', () => {
      tracker.registerCorrelation('corr-1', 'o');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm1', status: 'completed' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm2', status: 'completed' }));

      expect(tracker.getStatus('corr-1')!.overallStatus).toBe('completed');
    });

    it('returns "failed" when any failed and all terminal', () => {
      tracker.registerCorrelation('corr-1', 'o');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm1', status: 'completed' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm2', status: 'failed' }));

      expect(tracker.getStatus('corr-1')!.overallStatus).toBe('failed');
    });

    it('returns "blocked" when any sub-task is blocked', () => {
      tracker.registerCorrelation('corr-1', 'o');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm1', status: 'in_progress' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm2', status: 'blocked' }));

      expect(tracker.getStatus('corr-1')!.overallStatus).toBe('blocked');
    });

    it('returns "in_progress" when any sub-task is in_progress', () => {
      tracker.registerCorrelation('corr-1', 'o');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm1', status: 'queued' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm2', status: 'in_progress' }));

      expect(tracker.getStatus('corr-1')!.overallStatus).toBe('in_progress');
    });

    it('returns "queued" by default (all queued)', () => {
      tracker.registerCorrelation('corr-1', 'o');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm1', status: 'queued' }));

      expect(tracker.getStatus('corr-1')!.overallStatus).toBe('queued');
    });

    it('returns "queued" for empty group', () => {
      tracker.registerCorrelation('corr-1', 'o');
      expect(tracker.getStatus('corr-1')!.overallStatus).toBe('queued');
    });

    it('returns "needs_input" when any sub-task needs input', () => {
      tracker.registerCorrelation('corr-1', 'o');
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm1', status: 'queued' }));
      tracker.addSubTask('corr-1', makeEntry({ messageId: 'm2', status: 'needs_input' }));

      expect(tracker.getStatus('corr-1')!.overallStatus).toBe('needs_input');
    });
  });
});

// ── findSubTaskMessages ─────────────────────────────────────────

describe('findSubTaskMessages()', () => {
  it('returns delegation_request messages matching the correlationId', () => {
    const messages: A2AMessage[] = [
      {
        id: 'msg-1',
        correlationId: 'corr-1',
        type: 'delegation_request',
        sender: 'a',
        recipient: 'b',
        routing: { strategy: 'direct', target: 'b' },
        priority: 'normal',
        status: 'sent',
        payload: {
          taskId: 't1',
          summary: '',
          instructions: '',
          context: {},
          allowSubDelegation: false,
        },
        retryPolicy: { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, ttlMs: 300000 },
        attemptCount: 1,
        createdAt: '',
        updatedAt: '',
        expiresAt: '',
        protocolVersion: 1,
      },
      {
        id: 'msg-2',
        correlationId: 'corr-1',
        type: 'status_update',
        sender: 'b',
        recipient: 'a',
        routing: { strategy: 'direct', target: 'a' },
        priority: 'normal',
        status: 'sent',
        payload: {
          taskId: 't1',
          status: 'in_progress',
          description: 'working',
        },
        retryPolicy: { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, ttlMs: 300000 },
        attemptCount: 1,
        createdAt: '',
        updatedAt: '',
        expiresAt: '',
        protocolVersion: 1,
      },
      {
        id: 'msg-3',
        correlationId: 'corr-other',
        type: 'delegation_request',
        sender: 'a',
        recipient: 'c',
        routing: { strategy: 'direct', target: 'c' },
        priority: 'normal',
        status: 'sent',
        payload: {
          taskId: 't2',
          summary: '',
          instructions: '',
          context: {},
          allowSubDelegation: false,
        },
        retryPolicy: { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, ttlMs: 300000 },
        attemptCount: 1,
        createdAt: '',
        updatedAt: '',
        expiresAt: '',
        protocolVersion: 1,
      },
    ];

    const result = findSubTaskMessages(messages, 'corr-1');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('msg-1');
  });

  it('returns empty array when no matches', () => {
    expect(findSubTaskMessages([], 'corr-1')).toEqual([]);
  });
});

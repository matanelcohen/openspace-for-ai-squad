/**
 * Tests for VoiceSessionManager (P4-1).
 *
 * Covers session lifecycle, participant management, speaking state,
 * concurrent session limits, and event emission.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceSessionManager } from './session-manager.js';

describe('VoiceSessionManager', () => {
  let manager: VoiceSessionManager;

  beforeEach(() => {
    manager = new VoiceSessionManager({
      maxSessions: 3,
      maxParticipants: 5,
      openaiApiKey: 'test-key',
    });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  // ── Session lifecycle ──────────────────────────────────────────

  describe('session lifecycle', () => {
    it('creates a session with correct defaults', () => {
      const session = manager.createSession('Morning Standup');
      expect(session.id).toBeTruthy();
      expect(session.title).toBe('Morning Standup');
      expect(session.status).toBe('active');
      expect(session.participantAgentIds).toEqual([]);
      expect(session.startedAt).toBeTruthy();
      expect(session.endedAt).toBeNull();
      expect(session.messages).toEqual([]);
    });

    it('creates a session with pre-specified agent IDs', () => {
      const session = manager.createSession('Team Chat', ['leela', 'bender']);
      expect(session.participantAgentIds).toEqual(['leela', 'bender']);
    });

    it('emits session:created on creation', () => {
      const handler = vi.fn();
      manager.on('session:created', handler);
      const session = manager.createSession('Test');
      expect(handler).toHaveBeenCalledWith(session);
    });

    it('ends a session correctly', () => {
      const session = manager.createSession('Test');
      const ended = manager.endSession(session.id);
      expect(ended).not.toBeNull();
      expect(ended!.status).toBe('ended');
      expect(ended!.endedAt).toBeTruthy();
    });

    it('emits session:ended on end', () => {
      const handler = vi.fn();
      manager.on('session:ended', handler);
      const session = manager.createSession('Test');
      manager.endSession(session.id);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns null when ending a non-existent session', () => {
      expect(manager.endSession('nonexistent')).toBeNull();
    });

    it('removes a session from the manager', () => {
      const session = manager.createSession('Test');
      expect(manager.removeSession(session.id)).toBe(true);
      expect(manager.getSession(session.id)).toBeNull();
    });

    it('returns false when removing non-existent session', () => {
      expect(manager.removeSession('nonexistent')).toBe(false);
    });

    it('enforces max concurrent sessions', () => {
      manager.createSession('One');
      manager.createSession('Two');
      manager.createSession('Three');
      expect(() => manager.createSession('Four')).toThrow('Maximum concurrent sessions');
    });

    it('ended sessions free up slots for new ones', () => {
      const s1 = manager.createSession('One');
      manager.createSession('Two');
      manager.createSession('Three');
      manager.endSession(s1.id);
      // Still 3 in map (ended counts), so should still throw
      // unless we remove it
      manager.removeSession(s1.id);
      expect(() => manager.createSession('Four')).not.toThrow();
    });
  });

  // ── Participant management ─────────────────────────────────────

  describe('participant management', () => {
    it('adds a participant to a session', () => {
      const session = manager.createSession('Test');
      const participant = manager.joinSession(session.id, 'user-1', 'Alice', 'user');
      expect(participant).not.toBeNull();
      expect(participant!.id).toBe('user-1');
      expect(participant!.name).toBe('Alice');
      expect(participant!.role).toBe('user');
      expect(participant!.isSpeaking).toBe(false);
    });

    it('emits participant:joined event', () => {
      const handler = vi.fn();
      manager.on('participant:joined', handler);
      const session = manager.createSession('Test');
      manager.joinSession(session.id, 'user-1', 'Alice', 'user');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].sessionId).toBe(session.id);
    });

    it('tracks agent IDs when agents join', () => {
      const session = manager.createSession('Test');
      manager.joinSession(session.id, 'bender', 'Bender', 'agent');
      expect(session.participantAgentIds).toContain('bender');
    });

    it('does not double-add agent IDs', () => {
      const session = manager.createSession('Test', ['bender']);
      manager.joinSession(session.id, 'bender', 'Bender', 'agent');
      expect(session.participantAgentIds.filter((id) => id === 'bender')).toHaveLength(1);
    });

    it('does not duplicate participant on double-join', () => {
      const session = manager.createSession('Test');
      manager.joinSession(session.id, 'user-1', 'Alice', 'user');
      const second = manager.joinSession(session.id, 'user-1', 'Alice', 'user');
      expect(second!.id).toBe('user-1');
      expect(manager.getParticipants(session.id)).toHaveLength(1);
    });

    it('returns null when joining non-existent session', () => {
      expect(manager.joinSession('nonexistent', 'u1', 'Alice', 'user')).toBeNull();
    });

    it('throws when joining an ended session', () => {
      const session = manager.createSession('Test');
      manager.endSession(session.id);
      expect(() => manager.joinSession(session.id, 'u1', 'Alice', 'user')).toThrow(
        'not active',
      );
    });

    it('enforces max participants per session', () => {
      const session = manager.createSession('Test');
      for (let i = 0; i < 5; i++) {
        manager.joinSession(session.id, `user-${i}`, `User ${i}`, 'user');
      }
      expect(() =>
        manager.joinSession(session.id, 'user-6', 'User 6', 'user'),
      ).toThrow('full');
    });

    it('removes a participant from a session', () => {
      const session = manager.createSession('Test');
      manager.joinSession(session.id, 'user-1', 'Alice', 'user');
      expect(manager.leaveSession(session.id, 'user-1')).toBe(true);
      expect(manager.getParticipants(session.id)).toHaveLength(0);
    });

    it('emits participant:left event', () => {
      const handler = vi.fn();
      manager.on('participant:left', handler);
      const session = manager.createSession('Test');
      manager.joinSession(session.id, 'user-1', 'Alice', 'user');
      manager.leaveSession(session.id, 'user-1');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns false when leaving non-existent session or participant', () => {
      expect(manager.leaveSession('nonexistent', 'u1')).toBe(false);
      const session = manager.createSession('Test');
      expect(manager.leaveSession(session.id, 'nonexistent')).toBe(false);
    });
  });

  // ── Speaking state ─────────────────────────────────────────────

  describe('speaking state', () => {
    it('sets speaking state on a participant', () => {
      const session = manager.createSession('Test');
      manager.joinSession(session.id, 'user-1', 'Alice', 'user');
      expect(manager.setSpeaking(session.id, 'user-1', true)).toBe(true);
      const speakers = manager.getActiveSpeakers(session.id);
      expect(speakers).toHaveLength(1);
      expect(speakers[0].id).toBe('user-1');
    });

    it('emits speaking/silent events', () => {
      const speakingHandler = vi.fn();
      const silentHandler = vi.fn();
      manager.on('participant:speaking', speakingHandler);
      manager.on('participant:silent', silentHandler);

      const session = manager.createSession('Test');
      manager.joinSession(session.id, 'user-1', 'Alice', 'user');
      manager.setSpeaking(session.id, 'user-1', true);
      manager.setSpeaking(session.id, 'user-1', false);

      expect(speakingHandler).toHaveBeenCalledTimes(1);
      expect(silentHandler).toHaveBeenCalledTimes(1);
    });

    it('returns false for invalid session/participant', () => {
      expect(manager.setSpeaking('nonexistent', 'u1', true)).toBe(false);
      const session = manager.createSession('Test');
      expect(manager.setSpeaking(session.id, 'nonexistent', true)).toBe(false);
    });
  });

  // ── Queries ────────────────────────────────────────────────────

  describe('queries', () => {
    it('gets a session by ID', () => {
      const session = manager.createSession('Test');
      expect(manager.getSession(session.id)).toEqual(session);
    });

    it('returns null for non-existent session', () => {
      expect(manager.getSession('nonexistent')).toBeNull();
    });

    it('lists active sessions only', () => {
      const s1 = manager.createSession('Active');
      const s2 = manager.createSession('To End');
      manager.endSession(s2.id);
      const active = manager.getActiveSessions();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(s1.id);
    });

    it('lists all sessions including ended', () => {
      manager.createSession('Active');
      const s2 = manager.createSession('Ended');
      manager.endSession(s2.id);
      expect(manager.getAllSessions()).toHaveLength(2);
    });

    it('tracks active session count', () => {
      manager.createSession('One');
      const s2 = manager.createSession('Two');
      manager.endSession(s2.id);
      expect(manager.activeSessionCount).toBe(1);
    });

    it('tracks total session count', () => {
      manager.createSession('One');
      manager.createSession('Two');
      expect(manager.sessionCount).toBe(2);
    });
  });

  // ── Shutdown ───────────────────────────────────────────────────

  describe('shutdown', () => {
    it('ends all sessions and clears state', async () => {
      manager.createSession('One');
      manager.createSession('Two');
      await manager.shutdown();
      expect(manager.sessionCount).toBe(0);
    });

    it('emits session:ended for active sessions during shutdown', async () => {
      const handler = vi.fn();
      manager.on('session:ended', handler);
      manager.createSession('One');
      manager.createSession('Two');
      await manager.shutdown();
      // Events fire before removeAllListeners in shutdown
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // ── Config ─────────────────────────────────────────────────────

  describe('config', () => {
    it('reads API key from config', () => {
      expect(manager.openaiApiKey).toBe('test-key');
    });

    it('defaults API key from env when not provided', () => {
      const original = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-key';
      const m = new VoiceSessionManager();
      expect(m.openaiApiKey).toBe('env-key');
      process.env.OPENAI_API_KEY = original;
    });
  });
});

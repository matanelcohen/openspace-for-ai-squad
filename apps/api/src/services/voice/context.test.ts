/**
 * Tests for ConversationContextManager (P4-5).
 *
 * Covers context lifecycle, message management, context windows,
 * action logging, topic tracking, and transcript persistence.
 */

import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConversationContextManager } from './context.js';

describe('ConversationContextManager', () => {
  let ctxManager: ConversationContextManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `voice-ctx-test-${Date.now()}`);
    ctxManager = new ConversationContextManager({
      maxContextWindow: 10,
      sessionsDir: tempDir,
    });
  });

  afterEach(async () => {
    await ctxManager.shutdown();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  // ── Context lifecycle ──────────────────────────────────────────

  describe('context lifecycle', () => {
    it('creates a new context for a session', () => {
      const ctx = ctxManager.createContext('session-1');
      expect(ctx.sessionId).toBe('session-1');
      expect(ctx.messages).toEqual([]);
      expect(ctx.currentTopic).toBeNull();
      expect(ctx.actionLog).toEqual([]);
    });

    it('retrieves an existing context', () => {
      ctxManager.createContext('session-1');
      const ctx = ctxManager.getContext('session-1');
      expect(ctx).not.toBeNull();
      expect(ctx!.sessionId).toBe('session-1');
    });

    it('returns null for non-existent context', () => {
      expect(ctxManager.getContext('nonexistent')).toBeNull();
    });

    it('removes a context', () => {
      ctxManager.createContext('session-1');
      expect(ctxManager.removeContext('session-1')).toBe(true);
      expect(ctxManager.getContext('session-1')).toBeNull();
    });

    it('returns false when removing non-existent context', () => {
      expect(ctxManager.removeContext('nonexistent')).toBe(false);
    });
  });

  // ── Message management ─────────────────────────────────────────

  describe('message management', () => {
    it('adds a user message', async () => {
      ctxManager.createContext('session-1');
      const msg = await ctxManager.addMessage('session-1', 'user', null, 'Hello squad');
      expect(msg.role).toBe('user');
      expect(msg.agentId).toBeNull();
      expect(msg.content).toBe('Hello squad');
      expect(msg.sessionId).toBe('session-1');
    });

    it('adds an agent message', async () => {
      ctxManager.createContext('session-1');
      const msg = await ctxManager.addMessage('session-1', 'agent', 'bender', 'Backend ready');
      expect(msg.role).toBe('agent');
      expect(msg.agentId).toBe('bender');
    });

    it('auto-creates context if none exists', async () => {
      const msg = await ctxManager.addMessage('auto-session', 'user', null, 'Hi');
      expect(msg.sessionId).toBe('auto-session');
      expect(ctxManager.getContext('auto-session')).not.toBeNull();
    });

    it('trims messages to maxContextWindow', async () => {
      ctxManager.createContext('session-1');
      for (let i = 0; i < 15; i++) {
        await ctxManager.addMessage('session-1', 'user', null, `Message ${i}`);
      }
      const ctx = ctxManager.getContext('session-1')!;
      expect(ctx.messages).toHaveLength(10);
      // Should have the last 10 messages
      expect(ctx.messages[0]!.content).toBe('Message 5');
      expect(ctx.messages[9]!.content).toBe('Message 14');
    });

    it('updates lastUpdatedAt on each message', async () => {
      ctxManager.createContext('session-1');
      const msg = await ctxManager.addMessage('session-1', 'user', null, 'Hi');
      const ctx = ctxManager.getContext('session-1')!;
      expect(ctx.lastUpdatedAt).toBe(msg.timestamp);
    });
  });

  // ── Context window ─────────────────────────────────────────────

  describe('context window', () => {
    it('returns recent messages as context window', async () => {
      ctxManager.createContext('session-1');
      await ctxManager.addMessage('session-1', 'user', null, 'First');
      await ctxManager.addMessage('session-1', 'agent', 'leela', 'Second');
      await ctxManager.addMessage('session-1', 'user', null, 'Third');

      const window = ctxManager.getContextWindow('session-1', 2);
      expect(window).toHaveLength(2);
      expect(window[0]!.content).toBe('Second');
      expect(window[1]!.content).toBe('Third');
    });

    it('returns all messages if limit exceeds count', async () => {
      ctxManager.createContext('session-1');
      await ctxManager.addMessage('session-1', 'user', null, 'Only one');

      const window = ctxManager.getContextWindow('session-1', 100);
      expect(window).toHaveLength(1);
    });

    it('returns empty for non-existent session', () => {
      expect(ctxManager.getContextWindow('nonexistent')).toEqual([]);
    });
  });

  // ── Context summary ────────────────────────────────────────────

  describe('context summary', () => {
    it('produces a formatted text summary', async () => {
      ctxManager.createContext('session-1');
      await ctxManager.addMessage('session-1', 'user', null, 'What is the status?');
      await ctxManager.addMessage('session-1', 'agent', 'leela', 'Everything is on track.');

      const summary = ctxManager.getContextSummary('session-1');
      expect(summary).toContain('User: What is the status?');
      expect(summary).toContain('leela: Everything is on track.');
    });

    it('returns empty string for empty session', () => {
      ctxManager.createContext('session-1');
      expect(ctxManager.getContextSummary('session-1')).toBe('');
    });

    it('respects limit parameter', async () => {
      ctxManager.createContext('session-1');
      for (let i = 0; i < 5; i++) {
        await ctxManager.addMessage('session-1', 'user', null, `Msg ${i}`);
      }
      const summary = ctxManager.getContextSummary('session-1', 2);
      const lines = summary.split('\n').filter((l) => l.trim());
      expect(lines).toHaveLength(2);
    });
  });

  // ── Action log ─────────────────────────────────────────────────

  describe('action log', () => {
    it('logs an action in a session', () => {
      ctxManager.createContext('session-1');
      const entry = ctxManager.logAction(
        'session-1',
        'bender',
        'create_task',
        'Created "Auth endpoint"',
      );
      expect(entry).not.toBeNull();
      expect(entry!.action).toBe('create_task');
      expect(entry!.agentId).toBe('bender');
    });

    it('returns null for non-existent session', () => {
      expect(ctxManager.logAction('nonexistent', 'bender', 'test', 'test')).toBeNull();
    });

    it('retrieves action log', () => {
      ctxManager.createContext('session-1');
      ctxManager.logAction('session-1', 'bender', 'create', 'Result 1');
      ctxManager.logAction('session-1', 'leela', 'assign', 'Result 2');

      const log = ctxManager.getActionLog('session-1');
      expect(log).toHaveLength(2);
    });

    it('returns empty array for session without actions', () => {
      ctxManager.createContext('session-1');
      expect(ctxManager.getActionLog('session-1')).toEqual([]);
    });
  });

  // ── Topic tracking ─────────────────────────────────────────────

  describe('topic tracking', () => {
    it('auto-updates topic from user messages', async () => {
      ctxManager.createContext('session-1');
      await ctxManager.addMessage(
        'session-1',
        'user',
        null,
        'Let us talk about the authentication system',
      );

      const topic = ctxManager.getTopic('session-1');
      expect(topic).toContain('authentication system');
    });

    it('allows manual topic setting', () => {
      ctxManager.createContext('session-1');
      ctxManager.setTopic('session-1', 'Sprint Planning');
      expect(ctxManager.getTopic('session-1')).toBe('Sprint Planning');
    });

    it('returns null for session without topic', () => {
      ctxManager.createContext('session-1');
      expect(ctxManager.getTopic('session-1')).toBeNull();
    });
  });

  // ── Persistence ────────────────────────────────────────────────

  describe('persistence', () => {
    it('persists messages incrementally to disk', async () => {
      ctxManager.createContext('session-1');
      await ctxManager.addMessage('session-1', 'user', null, 'Hello');
      await ctxManager.addMessage('session-1', 'agent', 'bender', 'Hi there');

      // Find the persisted file
      const files = readdirSync(tempDir);
      const voiceFile = files.find(
        (f: string) => f.startsWith('voice-') && f.includes('session-1'),
      );
      expect(voiceFile).toBeTruthy();

      const content = readFileSync(join(tempDir, voiceFile!), 'utf-8');
      expect(content).toContain('User');
      expect(content).toContain('Hello');
      expect(content).toContain('bender');
      expect(content).toContain('Hi there');
    });

    it('persists full session transcript on demand', async () => {
      ctxManager.createContext('session-1');
      await ctxManager.addMessage('session-1', 'user', null, 'Test message');
      ctxManager.logAction('session-1', 'bender', 'test', 'Done');

      const filePath = await ctxManager.persistSession('session-1', 'Test Session');
      expect(filePath).not.toBeNull();
      expect(existsSync(filePath!)).toBe(true);

      const content = readFileSync(filePath!, 'utf-8');
      expect(content).toContain('Test Session');
      expect(content).toContain('Test message');
      expect(content).toContain('Actions Executed');
    });

    it('returns null when no sessions dir configured', async () => {
      const noPersist = new ConversationContextManager({ sessionsDir: null });
      noPersist.createContext('session-1');
      await noPersist.addMessage('session-1', 'user', null, 'No persist');
      const result = await noPersist.persistSession('session-1', 'Test');
      expect(result).toBeNull();
      await noPersist.shutdown();
    });

    it('returns null for empty session', async () => {
      ctxManager.createContext('session-1');
      const result = await ctxManager.persistSession('session-1', 'Empty');
      expect(result).toBeNull();
    });
  });

  // ── Shutdown ───────────────────────────────────────────────────

  describe('shutdown', () => {
    it('persists active sessions and clears state', async () => {
      await ctxManager.addMessage('session-1', 'user', null, 'Before shutdown');
      await ctxManager.shutdown();
      expect(ctxManager.getContext('session-1')).toBeNull();
    });
  });
});

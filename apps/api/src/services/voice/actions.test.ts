/**
 * Tests for VoiceActionService (P4-6).
 *
 * Covers intent parsing (create, assign, status, prioritize, decisions),
 * action execution, error handling, and LLM fallback.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionExecutor, LLMIntentParser } from './actions.js';
import { VoiceActionService } from './actions.js';

// ── Mock Action Executor ──────────────────────────────────────────

function createMockExecutor(overrides: Partial<ActionExecutor> = {}): ActionExecutor {
  return {
    createTask: vi.fn().mockResolvedValue({ id: 'task-1', title: 'Test Task' }),
    assignTask: vi.fn().mockResolvedValue({ id: 'task-1', assignee: 'bender' }),
    updateTaskStatus: vi.fn().mockResolvedValue({ id: 'task-1', status: 'done' }),
    prioritizeTask: vi.fn().mockResolvedValue({ id: 'task-1', priority: 'P1' }),
    queryStatus: vi.fn().mockResolvedValue([
      { id: 'task-1', title: 'Auth endpoint', status: 'in-progress', assignee: 'bender' },
      { id: 'task-2', title: 'Login page', status: 'backlog', assignee: 'fry' },
    ]),
    queryDecisions: vi
      .fn()
      .mockResolvedValue([
        { title: 'Use Fastify', by: 'leela', summary: 'Chose Fastify for backend' },
      ]),
    ...overrides,
  };
}

describe('VoiceActionService', () => {
  let service: VoiceActionService;
  let mockExecutor: ActionExecutor;

  // ── Intent parsing ─────────────────────────────────────────────

  describe('intent parsing', () => {
    beforeEach(() => {
      mockExecutor = createMockExecutor();
      service = new VoiceActionService(mockExecutor);
    });

    describe('create_task intent', () => {
      it('parses "create a task for auth endpoint"', async () => {
        const intent = await service.parseIntent('Create a task for auth endpoint');
        expect(intent.action).toBe('create_task');
        expect(intent.params.title).toContain('auth endpoint');
        expect(intent.confidence).toBeGreaterThan(0.5);
      });

      it('parses "add a task called user profile page"', async () => {
        const intent = await service.parseIntent('add a task called user profile page');
        expect(intent.action).toBe('create_task');
        expect(intent.params.title).toContain('user profile page');
      });

      it('parses "Bender, create an auth endpoint"', async () => {
        const intent = await service.parseIntent('Bender, create an auth endpoint');
        expect(intent.action).toBe('create_task');
        expect(intent.params.assignee).toBe('bender');
        expect(intent.params.title).toBeTruthy();
      });

      it('parses "new task: fix the login bug"', async () => {
        const intent = await service.parseIntent('new task: fix the login bug');
        expect(intent.action).toBe('create_task');
        expect(intent.params.title).toContain('fix the login bug');
      });
    });

    describe('assign_task intent', () => {
      it('parses "assign the auth task to bender"', async () => {
        const intent = await service.parseIntent('assign the auth task to bender');
        expect(intent.action).toBe('assign_task');
        expect(intent.params.title).toContain('auth task');
        expect(intent.params.assignee).toBe('bender');
      });
    });

    describe('update_status intent', () => {
      it('parses "mark auth endpoint as done"', async () => {
        const intent = await service.parseIntent('mark auth endpoint as done');
        expect(intent.action).toBe('update_status');
        expect(intent.params.title).toContain('auth endpoint');
        expect(intent.params.status).toContain('done');
      });

      it('parses "set login page to in progress"', async () => {
        const intent = await service.parseIntent('set login page to in progress');
        expect(intent.action).toBe('update_status');
      });
    });

    describe('prioritize intent', () => {
      it('parses "prioritize auth work above the dashboard"', async () => {
        const intent = await service.parseIntent('prioritize auth work above the dashboard');
        expect(intent.action).toBe('prioritize');
        expect(intent.params.title).toContain('auth work');
        expect(intent.params.target).toContain('dashboard');
      });
    });

    describe('query_status intent', () => {
      it('parses "what is the status"', async () => {
        const intent = await service.parseIntent("what's the status");
        expect(intent.action).toBe('query_status');
      });

      it('parses "how is everything going"', async () => {
        const intent = await service.parseIntent("how's everything going");
        expect(intent.action).toBe('query_status');
      });

      it('parses "give me a status update"', async () => {
        const intent = await service.parseIntent('give me a status update');
        expect(intent.action).toBe('query_status');
      });
    });

    describe('query_decisions intent', () => {
      it('parses "what decisions were made today"', async () => {
        const intent = await service.parseIntent('what decisions were made today');
        expect(intent.action).toBe('query_decisions');
      });

      it('parses "show me the decisions"', async () => {
        const intent = await service.parseIntent('show me the decisions');
        expect(intent.action).toBe('query_decisions');
      });
    });

    describe('unknown intent', () => {
      it('returns unknown for ambiguous input', async () => {
        const intent = await service.parseIntent('I like pizza');
        expect(intent.action).toBe('unknown');
        expect(intent.confidence).toBe(0);
      });

      it('returns unknown for empty input', async () => {
        const intent = await service.parseIntent('');
        expect(intent.action).toBe('unknown');
      });
    });

    describe('LLM fallback', () => {
      it('uses LLM parser when pattern matching fails', async () => {
        const llmParser: LLMIntentParser = {
          parse: vi.fn().mockResolvedValue({
            action: 'create_task',
            confidence: 0.9,
            params: { title: 'LLM detected task' },
            transcript: 'something complex',
          }),
        };
        const llmService = new VoiceActionService(mockExecutor, llmParser);
        const intent = await llmService.parseIntent('something complex');
        expect(intent.action).toBe('create_task');
        expect(intent.params.title).toBe('LLM detected task');
      });

      it('returns unknown when LLM also fails', async () => {
        const llmParser: LLMIntentParser = {
          parse: vi.fn().mockRejectedValue(new Error('LLM error')),
        };
        const llmService = new VoiceActionService(mockExecutor, llmParser);
        const intent = await llmService.parseIntent('something complex');
        expect(intent.action).toBe('unknown');
      });
    });
  });

  // ── Action execution ───────────────────────────────────────────

  describe('action execution', () => {
    beforeEach(() => {
      mockExecutor = createMockExecutor();
      service = new VoiceActionService(mockExecutor);
    });

    it('executes create_task and returns confirmation', async () => {
      const result = await service.processVoiceCommand('Create a task for auth endpoint');
      expect(result.success).toBe(true);
      expect(result.message).toContain('created');
      expect(mockExecutor.createTask).toHaveBeenCalled();
    });

    it('executes assign_task and returns confirmation', async () => {
      const result = await service.processVoiceCommand('assign the auth task to bender');
      expect(result.success).toBe(true);
      expect(result.message).toContain('assigned');
      expect(mockExecutor.assignTask).toHaveBeenCalled();
    });

    it('executes update_status and returns confirmation', async () => {
      const result = await service.processVoiceCommand('mark auth endpoint as done');
      expect(result.success).toBe(true);
      expect(result.message).toContain('done');
      expect(mockExecutor.updateTaskStatus).toHaveBeenCalled();
    });

    it('executes query_status and returns summary', async () => {
      const result = await service.processVoiceCommand("what's the status");
      expect(result.success).toBe(true);
      expect(result.message).toContain('status');
      expect(mockExecutor.queryStatus).toHaveBeenCalled();
    });

    it('executes query_decisions and returns summary', async () => {
      const result = await service.processVoiceCommand('what decisions were made today');
      expect(result.success).toBe(true);
      expect(result.message).toContain('decisions');
      expect(mockExecutor.queryDecisions).toHaveBeenCalled();
    });

    it('returns helpful message for unknown intent', async () => {
      const result = await service.processVoiceCommand('I like pizza');
      expect(result.success).toBe(false);
      expect(result.message).toContain('action');
    });
  });

  // ── Error handling ─────────────────────────────────────────────

  describe('error handling', () => {
    it('returns error message when executor fails', async () => {
      const failExecutor = createMockExecutor({
        createTask: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      });
      const failService = new VoiceActionService(failExecutor);
      const result = await failService.processVoiceCommand('Create a task for test');
      expect(result.success).toBe(false);
      expect(result.message).toContain('error');
    });

    it('returns helpful message when task title is missing', async () => {
      // Directly construct intent with empty title to test the handler
      const intent = {
        action: 'create_task' as const,
        confidence: 0.85,
        params: { title: '' },
        transcript: 'create a task',
      };
      const result = await service.executeAction(intent);
      expect(result.success).toBe(false);
      expect(result.message).toContain("couldn't determine");
    });

    it('handles empty status query results', async () => {
      const emptyExecutor = createMockExecutor({
        queryStatus: vi.fn().mockResolvedValue([]),
      });
      const emptyService = new VoiceActionService(emptyExecutor);
      const result = await emptyService.processVoiceCommand("what's the status");
      expect(result.success).toBe(true);
      expect(result.message).toContain('No active tasks');
    });

    it('handles empty decisions query results', async () => {
      const emptyExecutor = createMockExecutor({
        queryDecisions: vi.fn().mockResolvedValue([]),
      });
      const emptyService = new VoiceActionService(emptyExecutor);
      const result = await emptyService.processVoiceCommand('show me the decisions');
      expect(result.success).toBe(true);
      expect(result.message).toContain('No decisions found');
    });
  });
});

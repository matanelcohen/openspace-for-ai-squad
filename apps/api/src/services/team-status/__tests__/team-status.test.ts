/**
 * Tests for TeamStatusService — formatted team status and system prompt integration.
 *
 * Covers:
 * 1. getFormattedStatus() with active agents + excludeAgentId filtering
 * 2. Empty state (all idle) → returns empty string
 * 3. Staleness — working events older than 30 min are excluded
 * 4. Integration — system prompt includes/omits "## Team Status" section
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AgentStatusProvider, TeamStatusService } from '../index.js';

// ── Helpers ──────────────────────────────────────────────────────

const AGENTS = [
  { id: 'leela', name: 'Leela', role: 'Lead' },
  { id: 'bender', name: 'Bender', role: 'Backend Engineer' },
  { id: 'fry', name: 'Fry', role: 'Frontend Engineer' },
  { id: 'zoidberg', name: 'Zoidberg', role: 'Tester' },
];

function createMockProvider(
  statusOverrides: Record<string, { activeTask: string | null; queueLength: number }> = {},
): AgentStatusProvider {
  const defaultStatus: Record<string, { activeTask: string | null; queueLength: number }> = {};
  for (const agent of AGENTS) {
    defaultStatus[agent.id] = { activeTask: null, queueLength: 0 };
  }

  return {
    getStatus: vi.fn(() => ({ ...defaultStatus, ...statusOverrides })),
    getAgents: vi.fn(() => [...AGENTS]),
  };
}

/** Build a system prompt the same way AgentWorkerService does, with optional team status. */
function buildSystemPrompt(
  agent: { name: string; role: string; personality: string },
  teamStatusBlock: string,
): string {
  return (
    `You are ${agent.name}, the ${agent.role} of the openspace.ai squad. ` +
    `Personality: ${agent.personality}\n\n` +
    `You have been assigned a task. Execute it fully — write code, create files, make changes. ` +
    `Do the actual work, don't just describe what you would do.\n\n` +
    `RULES:\n` +
    `- Do NOT create or modify files in .squad/ — it is managed by the system.\n` +
    `- Only modify files under apps/, packages/, src/, or other project source directories.\n` +
    `- Complete the task in a single pass. Do not create sub-tasks.\n` +
    `- After making changes, ALWAYS run the project's build and test commands to verify your work.\n` +
    `- Install dependencies first if node_modules or equivalent is missing.\n` +
    `- If build or tests fail, fix the issues and re-run until everything passes.\n` +
    `- Do not consider the task done until build and tests pass.\n\n` +
    (teamStatusBlock ? `${teamStatusBlock}\n\n` : '') +
    `When done, provide a brief summary of what you did.`
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe('TeamStatusService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T20:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. getFormattedStatus with active agents ────────────────────

  describe('getFormattedStatus() — active agents', () => {
    it('returns markdown with active agents, excluding the specified agent', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
        fry: { activeTask: 'task-102', queueLength: 1 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('bender', 'task-101', 'Implement auth module');
      service.recordWorkingEvent('fry', 'task-102', 'Build dashboard UI');

      const result = service.getFormattedStatus('leela');

      // Should contain the header
      expect(result).toContain('## Team Status');

      // Should include both active agents
      expect(result).toContain('**Bender** (Backend Engineer)');
      expect(result).toContain('Working on "Implement auth module"');
      expect(result).toContain('**Fry** (Frontend Engineer)');
      expect(result).toContain('Working on "Build dashboard UI"');

      // Should NOT include the excluded agent (leela)
      expect(result).not.toContain('Leela');

      // Should NOT include idle agent (zoidberg)
      expect(result).not.toContain('Zoidberg');
    });

    it('uses task ID as fallback when no working event is recorded', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
      });

      // No recordWorkingEvent — service has no event for bender
      const service = new TeamStatusService(provider);
      const result = service.getFormattedStatus('leela');

      expect(result).toContain('## Team Status');
      expect(result).toContain('**Bender** (Backend Engineer)');
      expect(result).toContain('Working on "task-101"');
    });

    it('excludes the requesting agent from the output', () => {
      const provider = createMockProvider({
        leela: { activeTask: 'task-100', queueLength: 0 },
        bender: { activeTask: 'task-101', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('leela', 'task-100', 'Review PR');
      service.recordWorkingEvent('bender', 'task-101', 'Fix tests');

      // Exclude bender — should only see leela
      const result = service.getFormattedStatus('bender');

      expect(result).toContain('**Leela** (Lead)');
      expect(result).not.toContain('Bender');
    });

    it('formats output as markdown bullet list', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
        fry: { activeTask: 'task-102', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('bender', 'task-101', 'Task A');
      service.recordWorkingEvent('fry', 'task-102', 'Task B');

      const result = service.getFormattedStatus('leela');
      const lines = result.split('\n');

      // Header line, blank line, then bullet items
      expect(lines[0]).toBe('## Team Status');
      expect(lines[1]).toBe('');
      expect(lines[2]).toMatch(/^- \*\*/);
      expect(lines[3]).toMatch(/^- \*\*/);
    });
  });

  // ── 2. Empty state ─────────────────────────────────────────────

  describe('getFormattedStatus() — empty state', () => {
    it('returns empty string when all agents are idle', () => {
      const provider = createMockProvider(); // all agents idle
      const service = new TeamStatusService(provider);

      const result = service.getFormattedStatus('leela');

      expect(result).toBe('');
    });

    it('returns empty string when the only active agent is excluded', () => {
      const provider = createMockProvider({
        leela: { activeTask: 'task-100', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('leela', 'task-100', 'Solo task');

      // Exclude the only active agent
      const result = service.getFormattedStatus('leela');

      expect(result).toBe('');
    });

    it('returns empty string when no excludeAgentId is given but no agents are active', () => {
      const provider = createMockProvider();
      const service = new TeamStatusService(provider);

      const result = service.getFormattedStatus();

      expect(result).toBe('');
    });
  });

  // ── 3. Staleness ───────────────────────────────────────────────

  describe('getFormattedStatus() — staleness', () => {
    it('excludes agents whose working event is older than 30 minutes', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
        fry: { activeTask: 'task-102', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);

      // Record bender's event, then advance time past the threshold
      service.recordWorkingEvent('bender', 'task-101', 'Old task');

      // Advance 31 minutes
      vi.advanceTimersByTime(31 * 60 * 1000);

      // Record fry's event NOW (after time advance, so it's fresh)
      service.recordWorkingEvent('fry', 'task-102', 'Fresh task');

      const result = service.getFormattedStatus('leela');

      // Fry's event is fresh — should appear
      expect(result).toContain('**Fry** (Frontend Engineer)');
      expect(result).toContain('Working on "Fresh task"');

      // Bender's event is stale (31 min ago) — should NOT appear
      expect(result).not.toContain('Bender');
    });

    it('includes agents at exactly 30 minutes (boundary)', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('bender', 'task-101', 'Boundary task');

      // Advance exactly 30 minutes — should still be included (not > threshold)
      vi.advanceTimersByTime(30 * 60 * 1000);

      const result = service.getFormattedStatus('leela');

      expect(result).toContain('**Bender** (Backend Engineer)');
    });

    it('excludes agents at 30 minutes + 1ms (just past threshold)', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('bender', 'task-101', 'Expired task');

      // Advance 30 min + 1ms — just past threshold
      vi.advanceTimersByTime(30 * 60 * 1000 + 1);

      const result = service.getFormattedStatus('leela');

      expect(result).toBe('');
    });

    it('respects custom stale threshold', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
      });

      // 10 minute threshold
      const service = new TeamStatusService(provider, 10 * 60 * 1000);
      service.recordWorkingEvent('bender', 'task-101', 'Short-lived task');

      // Advance 11 minutes — stale with 10 min threshold
      vi.advanceTimersByTime(11 * 60 * 1000);

      const result = service.getFormattedStatus('leela');

      expect(result).toBe('');
    });

    it('re-records a working event to reset staleness', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('bender', 'task-101', 'Old title');

      // Advance 25 minutes
      vi.advanceTimersByTime(25 * 60 * 1000);

      // Re-record refreshes the timestamp
      service.recordWorkingEvent('bender', 'task-101', 'Refreshed title');

      // Advance another 10 minutes (total 35 min since first, 10 since refresh)
      vi.advanceTimersByTime(10 * 60 * 1000);

      const result = service.getFormattedStatus('leela');

      expect(result).toContain('**Bender** (Backend Engineer)');
      expect(result).toContain('Refreshed title');
    });
  });

  // ── 4. clearWorkingEvent ───────────────────────────────────────

  describe('clearWorkingEvent()', () => {
    it('removes an agent from tracked working events', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('bender', 'task-101', 'Active task');
      service.clearWorkingEvent('bender');

      // Agent still shows as active via getStatus(), but without a working event
      // it falls back to task ID display
      const result = service.getFormattedStatus('leela');
      expect(result).toContain('**Bender**');
      expect(result).toContain('Working on "task-101"');
    });
  });

  // ── 5. Integration — system prompt construction ────────────────

  describe('system prompt integration', () => {
    const currentAgent = { name: 'Zoidberg', role: 'Tester', personality: 'Methodical, thorough' };

    it('includes "## Team Status" in system prompt when other agents are active', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
        fry: { activeTask: 'task-102', queueLength: 1 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('bender', 'task-101', 'Implement API endpoints');
      service.recordWorkingEvent('fry', 'task-102', 'Build login page');

      // Simulate prompt construction (as AgentWorkerService does)
      const teamStatus = service.getFormattedStatus('zoidberg');
      const prompt = buildSystemPrompt(currentAgent, teamStatus);

      // Prompt should contain the team status section
      expect(prompt).toContain('## Team Status');
      expect(prompt).toContain(
        '**Bender** (Backend Engineer): Working on "Implement API endpoints"',
      );
      expect(prompt).toContain('**Fry** (Frontend Engineer): Working on "Build login page"');

      // Team status section should NOT mention Zoidberg (the excluded agent)
      const teamSection = prompt.slice(prompt.indexOf('## Team Status'));
      expect(teamSection).not.toContain('Zoidberg');

      // Core prompt structure should still be intact
      expect(prompt).toContain('You are Zoidberg, the Tester');
      expect(prompt).toContain('RULES:');
      expect(prompt).toContain('When done, provide a brief summary');
    });

    it('omits "## Team Status" from system prompt when agent is alone', () => {
      // Only zoidberg is active, no other agents working
      const provider = createMockProvider({
        zoidberg: { activeTask: 'task-200', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('zoidberg', 'task-200', 'Write tests');

      // Zoidberg asks for status excluding itself — no teammates active
      const teamStatus = service.getFormattedStatus('zoidberg');
      const prompt = buildSystemPrompt(currentAgent, teamStatus);

      // No team status section
      expect(prompt).not.toContain('## Team Status');

      // Prompt should still have core content
      expect(prompt).toContain('You are Zoidberg, the Tester');
      expect(prompt).toContain('RULES:');
    });

    it('omits stale agents from system prompt', () => {
      const provider = createMockProvider({
        bender: { activeTask: 'task-101', queueLength: 0 },
        fry: { activeTask: 'task-102', queueLength: 0 },
      });

      const service = new TeamStatusService(provider);
      service.recordWorkingEvent('bender', 'task-101', 'Stale work');
      service.recordWorkingEvent('fry', 'task-102', 'Stale work too');

      // Both events go stale
      vi.advanceTimersByTime(31 * 60 * 1000);

      const teamStatus = service.getFormattedStatus('zoidberg');
      const prompt = buildSystemPrompt(currentAgent, teamStatus);

      expect(prompt).not.toContain('## Team Status');
      expect(prompt).not.toContain('Bender');
      expect(prompt).not.toContain('Fry');
    });

    it('updates system prompt dynamically as agents start/stop tasks', () => {
      const statusMap: Record<string, { activeTask: string | null; queueLength: number }> = {
        leela: { activeTask: null, queueLength: 0 },
        bender: { activeTask: null, queueLength: 0 },
        fry: { activeTask: null, queueLength: 0 },
        zoidberg: { activeTask: null, queueLength: 0 },
      };

      const provider: AgentStatusProvider = {
        getStatus: vi.fn(() => ({ ...statusMap })),
        getAgents: vi.fn(() => [...AGENTS]),
      };

      const service = new TeamStatusService(provider);

      // Initially: no active agents → no team status
      let teamStatus = service.getFormattedStatus('zoidberg');
      expect(teamStatus).toBe('');

      // Bender starts a task
      statusMap.bender = { activeTask: 'task-101', queueLength: 0 };
      service.recordWorkingEvent('bender', 'task-101', 'Build API');

      teamStatus = service.getFormattedStatus('zoidberg');
      expect(teamStatus).toContain('## Team Status');
      expect(teamStatus).toContain('Bender');

      // Bender finishes → goes idle
      statusMap.bender = { activeTask: null, queueLength: 0 };
      service.clearWorkingEvent('bender');

      teamStatus = service.getFormattedStatus('zoidberg');
      expect(teamStatus).toBe('');
    });
  });
});

/**
 * Tests for TeamStatusService and its integration into the agent worker pipeline.
 *
 * Verifies: formatted markdown output, requesting-agent exclusion,
 * stale-agent filtering, empty-list handling, edge cases (long titles,
 * single agent, no branch, all idle), and system prompt injection.
 */

import { describe, expect, it } from 'vitest';

import { type AgentProfile, type AgentStatus, TeamStatusService } from '../team-status.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeAgents(count: number): AgentProfile[] {
  const roles = ['Lead', 'Frontend Dev', 'Backend Dev', 'Tester', 'DevOps'];
  const names = ['Leela', 'Fry', 'Bender', 'Zoidberg', 'Hermes'];
  return Array.from({ length: count }, (_, i) => ({
    id: `agent-${i}`,
    name: names[i % names.length],
    role: roles[i % roles.length],
    personality: 'Helpful',
  }));
}

const NOW = new Date('2026-03-31T21:00:00.000Z');

// ── Unit Tests ───────────────────────────────────────────────────

describe('TeamStatusService', () => {
  const service = new TeamStatusService();

  // ── buildTeamStatusBlock ──────────────────────────────────────

  describe('buildTeamStatusBlock', () => {
    it('returns formatted markdown with multiple agent statuses', () => {
      const agents = makeAgents(3);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': {
          activeTask: 'task-1',
          queueLength: 0,
          taskTitle: 'Implement auth module',
          branch: 'feature/auth',
        },
        'agent-1': {
          activeTask: 'task-2',
          queueLength: 2,
          taskTitle: 'Fix CSS layout',
        },
        'agent-2': {
          activeTask: null,
          queueLength: 1,
        },
      };

      // Request from agent-2 — it should be excluded
      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-2', NOW);

      expect(block).not.toBeNull();
      expect(block).toContain('## Team Status');
      expect(block).toContain('Your teammates are currently working on');

      // agent-0 with branch
      expect(block).toContain('**Leela** (Lead)');
      expect(block).toContain('"Implement auth module"');
      expect(block).toContain('(branch: `feature/auth`)');

      // agent-1 with queued items
      expect(block).toContain('**Fry** (Frontend Dev)');
      expect(block).toContain('"Fix CSS layout"');
      expect(block).toContain('[+2 queued]');

      // agent-2 (requesting agent) should NOT appear
      expect(block).not.toContain('**Bender**');

      // Footer
      expect(block).toContain('Coordinate with your team');
    });

    it('excludes the requesting agent from the output', () => {
      const agents = makeAgents(3);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': { activeTask: 'task-1', queueLength: 0, taskTitle: 'Task A' },
        'agent-1': { activeTask: 'task-2', queueLength: 0, taskTitle: 'Task B' },
        'agent-2': { activeTask: 'task-3', queueLength: 0, taskTitle: 'Task C' },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-1', NOW);

      expect(block).toContain('**Leela**');
      expect(block).toContain('**Bender**');
      expect(block).not.toContain('**Fry**');
    });

    it('returns null when no agents remain after exclusions', () => {
      const agents = makeAgents(1);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': { activeTask: 'task-1', queueLength: 0, taskTitle: 'Solo task' },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).toBeNull();
    });

    it('returns null when statuses map is empty', () => {
      const agents = makeAgents(3);
      const block = service.buildTeamStatusBlock({}, agents, 'agent-0', NOW);
      expect(block).toBeNull();
    });

    it('returns null when agents list is empty', () => {
      const block = service.buildTeamStatusBlock({}, [], 'agent-0', NOW);
      expect(block).toBeNull();
    });

    it('filters out stale agents (>30 min idle)', () => {
      const agents = makeAgents(3);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': {
          activeTask: 'task-1',
          queueLength: 0,
          taskTitle: 'Active task',
        },
        'agent-1': {
          activeTask: null,
          queueLength: 0,
          lastActiveAt: new Date(NOW.getTime() - 31 * 60 * 1000), // 31 min ago
        },
        'agent-2': {
          activeTask: null,
          queueLength: 0,
          lastActiveAt: new Date(NOW.getTime() - 60 * 60 * 1000), // 1 hour ago
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);

      // Only agent-0 is active but it's the requester, so the stale agents
      // are filtered out → should return null
      expect(block).toBeNull();
    });

    it('keeps agents that are idle but recently active (<30 min)', () => {
      const agents = makeAgents(3);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': {
          activeTask: 'task-1',
          queueLength: 0,
          taskTitle: 'Active task',
        },
        'agent-1': {
          activeTask: null,
          queueLength: 0,
          lastActiveAt: new Date(NOW.getTime() - 5 * 60 * 1000), // 5 min ago
        },
        'agent-2': {
          activeTask: null,
          queueLength: 0,
          lastActiveAt: new Date(NOW.getTime() - 29 * 60 * 1000), // 29 min ago — just under threshold
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);

      expect(block).not.toBeNull();
      expect(block).toContain('**Fry**');
      expect(block).toContain('**Bender**');
    });

    it('never filters active agents regardless of lastActiveAt', () => {
      const agents = makeAgents(2);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': {
          activeTask: null,
          queueLength: 0,
        },
        'agent-1': {
          activeTask: 'task-1',
          queueLength: 0,
          taskTitle: 'Old but active',
          lastActiveAt: new Date(NOW.getTime() - 120 * 60 * 1000), // 2 hours ago
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);

      expect(block).not.toBeNull();
      expect(block).toContain('"Old but active"');
    });
  });

  // ── formatAgentEntry ──────────────────────────────────────────

  describe('formatAgentEntry', () => {
    const agent: AgentProfile = {
      id: 'bender',
      name: 'Bender',
      role: 'Backend Dev',
      personality: 'Sarcastic',
    };

    it('formats an active agent with title and branch', () => {
      const status: AgentStatus = {
        activeTask: 'task-42',
        queueLength: 0,
        taskTitle: 'Add user auth',
        branch: 'feature/user-auth',
      };

      const entry = service.formatAgentEntry(agent, status);
      expect(entry).toBe(
        '- **Bender** (Backend Dev): Working on "Add user auth" (branch: `feature/user-auth`)',
      );
    });

    it('formats an active agent with title but no branch', () => {
      const status: AgentStatus = {
        activeTask: 'task-42',
        queueLength: 0,
        taskTitle: 'Add user auth',
      };

      const entry = service.formatAgentEntry(agent, status);
      expect(entry).toBe('- **Bender** (Backend Dev): Working on "Add user auth"');
    });

    it('formats an active agent with queued tasks', () => {
      const status: AgentStatus = {
        activeTask: 'task-42',
        queueLength: 3,
        taskTitle: 'Fix bug',
      };

      const entry = service.formatAgentEntry(agent, status);
      expect(entry).toContain('"Fix bug"');
      expect(entry).toContain('[+3 queued]');
    });

    it('formats an active agent without a title as "Busy"', () => {
      const status: AgentStatus = {
        activeTask: 'task-42',
        queueLength: 0,
      };

      const entry = service.formatAgentEntry(agent, status);
      expect(entry).toBe('- **Bender** (Backend Dev): Busy (task in progress)');
    });

    it('formats an idle agent with queued tasks', () => {
      const status: AgentStatus = {
        activeTask: null,
        queueLength: 5,
      };

      const entry = service.formatAgentEntry(agent, status);
      expect(entry).toBe('- **Bender** (Backend Dev): Idle — 5 task(s) queued');
    });

    it('formats a fully idle agent', () => {
      const status: AgentStatus = {
        activeTask: null,
        queueLength: 0,
      };

      const entry = service.formatAgentEntry(agent, status);
      expect(entry).toBe('- **Bender** (Backend Dev): Idle');
    });
  });

  // ── isStale ───────────────────────────────────────────────────

  describe('isStale', () => {
    it('returns false for agents with an active task', () => {
      const status: AgentStatus = {
        activeTask: 'task-1',
        queueLength: 0,
        lastActiveAt: new Date(NOW.getTime() - 60 * 60 * 1000), // 1 hour ago
      };
      expect(service.isStale(status, NOW)).toBe(false);
    });

    it('returns false for agents with queued tasks', () => {
      const status: AgentStatus = {
        activeTask: null,
        queueLength: 2,
        lastActiveAt: new Date(NOW.getTime() - 60 * 60 * 1000), // 1 hour ago
      };
      expect(service.isStale(status, NOW)).toBe(false);
    });

    it('returns false when lastActiveAt is not set', () => {
      const status: AgentStatus = {
        activeTask: null,
        queueLength: 0,
      };
      expect(service.isStale(status, NOW)).toBe(false);
    });

    it('returns false when idle for exactly 30 minutes', () => {
      const status: AgentStatus = {
        activeTask: null,
        queueLength: 0,
        lastActiveAt: new Date(NOW.getTime() - 30 * 60 * 1000), // exactly 30 min
      };
      expect(service.isStale(status, NOW)).toBe(false);
    });

    it('returns true when idle for 31 minutes', () => {
      const status: AgentStatus = {
        activeTask: null,
        queueLength: 0,
        lastActiveAt: new Date(NOW.getTime() - 31 * 60 * 1000),
      };
      expect(service.isStale(status, NOW)).toBe(true);
    });

    it('returns true when idle for several hours', () => {
      const status: AgentStatus = {
        activeTask: null,
        queueLength: 0,
        lastActiveAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
      };
      expect(service.isStale(status, NOW)).toBe(true);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('truncates very long task titles at 80 characters', () => {
      const agents = makeAgents(2);
      const longTitle =
        'Implement the comprehensive end-to-end authentication and authorization module with OAuth2 PKCE flow support';
      expect(longTitle.length).toBeGreaterThan(80);

      const statuses: Record<string, AgentStatus> = {
        'agent-0': { activeTask: null, queueLength: 0 },
        'agent-1': {
          activeTask: 'task-long',
          queueLength: 0,
          taskTitle: longTitle,
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).not.toBeNull();

      // Should contain truncated title with ellipsis
      expect(block).not.toContain(longTitle);
      expect(block).toContain('…');
      // The truncated portion should be at most MAX_TITLE_LENGTH chars
      const match = block!.match(/"([^"]+)"/);
      expect(match).not.toBeNull();
      expect(match![1].length).toBeLessThanOrEqual(TeamStatusService.MAX_TITLE_LENGTH);
    });

    it('does not truncate titles at exactly MAX_TITLE_LENGTH', () => {
      const agents = makeAgents(2);
      const exactTitle = 'A'.repeat(TeamStatusService.MAX_TITLE_LENGTH);

      const statuses: Record<string, AgentStatus> = {
        'agent-0': { activeTask: null, queueLength: 0 },
        'agent-1': {
          activeTask: 'task-exact',
          queueLength: 0,
          taskTitle: exactTitle,
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).toContain(exactTitle);
      expect(block).not.toContain('…');
    });

    it('handles all agents idle', () => {
      const agents = makeAgents(3);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': { activeTask: null, queueLength: 0 },
        'agent-1': { activeTask: null, queueLength: 0 },
        'agent-2': { activeTask: null, queueLength: 0 },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).not.toBeNull();
      expect(block).toContain('**Fry** (Frontend Dev): Idle');
      expect(block).toContain('**Bender** (Backend Dev): Idle');
    });

    it('single agent running sees empty team status (only itself)', () => {
      const agents = makeAgents(1);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': {
          activeTask: 'task-solo',
          queueLength: 0,
          taskTitle: 'Solo work',
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).toBeNull();
    });

    it('handles agent with no branch yet', () => {
      const agents = makeAgents(2);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': { activeTask: null, queueLength: 0 },
        'agent-1': {
          activeTask: 'task-no-branch',
          queueLength: 0,
          taskTitle: 'Setup project',
          branch: undefined,
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).not.toBeNull();
      expect(block).not.toContain('branch:');
      expect(block).toContain('"Setup project"');
    });

    it('handles agent with empty string title', () => {
      const agents = makeAgents(2);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': { activeTask: null, queueLength: 0 },
        'agent-1': {
          activeTask: 'task-empty-title',
          queueLength: 0,
          taskTitle: '',
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).not.toBeNull();
      // Empty string is falsy, so should show "Busy" fallback
      expect(block).toContain('Busy (task in progress)');
    });

    it('handles mixed: some stale, some active, some idle fresh', () => {
      const agents = makeAgents(5);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': {
          activeTask: 'task-1',
          queueLength: 0,
          taskTitle: 'Active task',
        },
        'agent-1': {
          activeTask: null,
          queueLength: 0,
          lastActiveAt: new Date(NOW.getTime() - 60 * 60 * 1000), // stale
        },
        'agent-2': {
          activeTask: null,
          queueLength: 0,
          lastActiveAt: new Date(NOW.getTime() - 10 * 60 * 1000), // fresh idle
        },
        'agent-3': {
          activeTask: 'task-2',
          queueLength: 1,
          taskTitle: 'Another task',
          branch: 'feat/stuff',
        },
        'agent-4': {
          activeTask: null,
          queueLength: 0,
          lastActiveAt: new Date(NOW.getTime() - 45 * 60 * 1000), // stale
        },
      };

      // Request as agent-0
      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).not.toBeNull();

      // agent-1 (stale) — filtered
      expect(block).not.toContain('**Fry**');
      // agent-2 (fresh idle) — included
      expect(block).toContain('**Bender**');
      // agent-3 (active) — included
      expect(block).toContain('**Zoidberg**');
      expect(block).toContain('"Another task"');
      // agent-4 (stale) — filtered
      expect(block).not.toContain('**Hermes**');
    });

    it('handles agents missing from statuses map', () => {
      const agents = makeAgents(3);
      // Only agent-1 has a status
      const statuses: Record<string, AgentStatus> = {
        'agent-1': {
          activeTask: 'task-1',
          queueLength: 0,
          taskTitle: 'Working hard',
        },
      };

      const block = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);
      expect(block).not.toBeNull();
      // Only agent-1 should appear (agent-0 is requester, agent-2 has no status)
      expect(block).toContain('**Fry**');
      expect(block).not.toContain('**Leela**');
      expect(block).not.toContain('**Bender**');
    });
  });

  // ── Integration: system prompt injection ──────────────────────

  describe('integration — system prompt injection', () => {
    it('produces a team status block that integrates into a system prompt', () => {
      const agents = makeAgents(4);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': {
          activeTask: 'task-lead',
          queueLength: 0,
          taskTitle: 'Architecture review',
          branch: 'feature/arch',
        },
        'agent-1': {
          activeTask: 'task-fe',
          queueLength: 1,
          taskTitle: 'Build dashboard UI',
          branch: 'feature/dashboard',
        },
        'agent-2': {
          activeTask: null,
          queueLength: 0,
        },
        'agent-3': {
          activeTask: 'task-test',
          queueLength: 0,
          taskTitle: 'Write integration tests',
        },
      };

      const requestingAgent = agents[2]; // Bender (Backend Dev)
      const teamStatusBlock = service.buildTeamStatusBlock(
        statuses,
        agents,
        requestingAgent.id,
        NOW,
      );

      // Build the system prompt the same way AgentWorkerService does
      const memoriesPrompt = '## Your Memories & Learnings\n\nSome memories here.\n\n';
      const skillsPrompt = '## Your Skills\n\nSome skills here.';

      const systemPrompt =
        `You are ${requestingAgent.name}, the ${requestingAgent.role} of the openspace.ai squad. ` +
        `Personality: ${requestingAgent.personality}\n\n` +
        `You have been assigned a task. Execute it fully.\n\n` +
        `RULES:\n- Do NOT create or modify files in .squad/\n\n` +
        (memoriesPrompt ? `${memoriesPrompt}\n` : '') +
        (teamStatusBlock ? `${teamStatusBlock}\n\n` : '') +
        (skillsPrompt ? `${skillsPrompt}\n\n` : '') +
        `When done, provide a brief summary of what you did.`;

      // Verify structure
      expect(systemPrompt).toContain('You are Bender');
      expect(systemPrompt).toContain('## Your Memories & Learnings');
      expect(systemPrompt).toContain('## Team Status');
      expect(systemPrompt).toContain('## Your Skills');

      // Verify team status section content
      expect(systemPrompt).toContain('**Leela** (Lead)');
      expect(systemPrompt).toContain('"Architecture review"');
      expect(systemPrompt).toContain('**Fry** (Frontend Dev)');
      expect(systemPrompt).toContain('"Build dashboard UI"');
      expect(systemPrompt).toContain('**Zoidberg** (Tester)');
      expect(systemPrompt).toContain('"Write integration tests"');

      // Requesting agent (Bender) should not appear in team status
      expect(systemPrompt).not.toMatch(/\*\*Bender\*\* \(Backend Dev\): (Working|Busy|Idle)/);
    });

    it('system prompt is valid when team status returns null', () => {
      const agents = makeAgents(1);
      const statuses: Record<string, AgentStatus> = {
        'agent-0': { activeTask: 'task-1', queueLength: 0, taskTitle: 'Solo' },
      };

      const teamStatusBlock = service.buildTeamStatusBlock(statuses, agents, 'agent-0', NOW);

      expect(teamStatusBlock).toBeNull();

      const systemPrompt =
        `You are Leela, the Lead.\n\n` +
        (teamStatusBlock ? `${teamStatusBlock}\n\n` : '') +
        `When done, provide a brief summary.`;

      expect(systemPrompt).not.toContain('## Team Status');
      expect(systemPrompt).toContain('You are Leela');
      expect(systemPrompt).toContain('When done');
    });

    it('simulates multiple mock agent workers with different statuses', () => {
      // Simulate what would happen in a real multi-agent scenario:
      // 5 agents, various states, one starts a new task
      const agents: AgentProfile[] = [
        { id: 'leela', name: 'Leela', role: 'Lead', personality: 'Decisive' },
        { id: 'fry', name: 'Fry', role: 'Frontend Dev', personality: 'Eager' },
        { id: 'bender', name: 'Bender', role: 'Backend Dev', personality: 'Sarcastic' },
        { id: 'zoidberg', name: 'Zoidberg', role: 'Tester', personality: 'Thorough' },
        { id: 'hermes', name: 'Hermes', role: 'DevOps', personality: 'Organized' },
      ];

      const statuses: Record<string, AgentStatus> = {
        leela: {
          activeTask: 'task-arch',
          queueLength: 2,
          taskTitle: 'System architecture review',
          branch: 'feature/task-arch',
        },
        fry: {
          activeTask: 'task-ui',
          queueLength: 0,
          taskTitle: 'Build responsive nav component',
          branch: 'feature/task-ui',
        },
        bender: {
          activeTask: null,
          queueLength: 0,
          lastActiveAt: new Date(NOW.getTime() - 45 * 60 * 1000), // stale
        },
        zoidberg: {
          activeTask: null,
          queueLength: 0,
        },
        hermes: {
          activeTask: 'task-ci',
          queueLength: 0,
          taskTitle: 'Configure CI/CD pipeline',
        },
      };

      // Zoidberg starts a new task — verify the system prompt
      const block = service.buildTeamStatusBlock(statuses, agents, 'zoidberg', NOW);

      expect(block).not.toBeNull();

      // Leela — active with queued
      expect(block).toContain('**Leela** (Lead): Working on "System architecture review"');
      expect(block).toContain('(branch: `feature/task-arch`)');
      expect(block).toContain('[+2 queued]');

      // Fry — active on branch
      expect(block).toContain(
        '**Fry** (Frontend Dev): Working on "Build responsive nav component"',
      );
      expect(block).toContain('(branch: `feature/task-ui`)');

      // Bender — stale idle, should be filtered
      expect(block).not.toContain('**Bender**');

      // Zoidberg — requesting agent, should be excluded
      expect(block).not.toContain('**Zoidberg**');

      // Hermes — active, no branch
      expect(block).toContain('**Hermes** (DevOps): Working on "Configure CI/CD pipeline"');
      expect(block).not.toMatch(/Hermes.*branch/);
    });
  });

  // ── Constants ─────────────────────────────────────────────────

  describe('constants', () => {
    it('STALE_THRESHOLD_MS is 30 minutes', () => {
      expect(TeamStatusService.STALE_THRESHOLD_MS).toBe(30 * 60 * 1000);
    });

    it('MAX_TITLE_LENGTH is 80', () => {
      expect(TeamStatusService.MAX_TITLE_LENGTH).toBe(80);
    });
  });
});

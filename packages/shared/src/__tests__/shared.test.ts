import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_EVENT_TYPE_LABELS,
  ACTIVITY_EVENT_TYPES,
  AGENT_ROLES,
  AGENT_STATUS_LABELS,
  AGENT_STATUSES,
  CHAT_TEAM_RECIPIENT,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
} from '../constants/index.js';
import type {
  ActivityEvent,
  Agent,
  ChatMessage,
  Decision,
  SquadConfig,
  SquadOverview,
  Task,
  VoiceMessage,
  VoiceProfile,
  VoiceSession,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Constants tests
// ---------------------------------------------------------------------------

describe('TASK_STATUSES', () => {
  it('contains exactly seven statuses in kanban order', () => {
    expect(TASK_STATUSES).toEqual(['pending-approval', 'backlog', 'in-progress', 'in-review', 'done', 'blocked', 'delegated']);
  });

  it('has a label for every status', () => {
    for (const s of TASK_STATUSES) {
      expect(TASK_STATUS_LABELS[s]).toBeDefined();
      expect(typeof TASK_STATUS_LABELS[s]).toBe('string');
    }
  });
});

describe('TASK_PRIORITIES', () => {
  it('contains P0 through P3', () => {
    expect(TASK_PRIORITIES).toEqual(['P0', 'P1', 'P2', 'P3']);
  });

  it('has a label for every priority', () => {
    for (const p of TASK_PRIORITIES) {
      expect(TASK_PRIORITY_LABELS[p]).toBeDefined();
    }
  });
});

describe('AGENT_STATUSES', () => {
  it('contains all four agent states', () => {
    expect(AGENT_STATUSES).toEqual(['idle', 'active', 'spawned', 'failed']);
  });

  it('has a label for every status', () => {
    for (const s of AGENT_STATUSES) {
      expect(AGENT_STATUS_LABELS[s]).toBeDefined();
    }
  });
});

describe('ACTIVITY_EVENT_TYPES', () => {
  it('contains all six event types', () => {
    expect(ACTIVITY_EVENT_TYPES).toEqual([
      'spawned',
      'started',
      'completed',
      'failed',
      'decision',
      'error',
    ]);
  });

  it('has a label for every event type', () => {
    for (const t of ACTIVITY_EVENT_TYPES) {
      expect(ACTIVITY_EVENT_TYPE_LABELS[t]).toBeDefined();
    }
  });
});

describe('AGENT_ROLES', () => {
  it('contains the default squad roles', () => {
    expect(AGENT_ROLES).toEqual(['Lead', 'Backend', 'Frontend', 'QA']);
  });
});

describe('CHAT_TEAM_RECIPIENT', () => {
  it("equals 'team'", () => {
    expect(CHAT_TEAM_RECIPIENT).toBe('team');
  });
});

// ---------------------------------------------------------------------------
// Type-level compile tests — these verify that interfaces are structurally
// correct by assigning valid object literals. If a field name or type is
// wrong, this file won't compile.
// ---------------------------------------------------------------------------

describe('Type structures (compile-time + runtime shape checks)', () => {
  it('Agent has the expected fields', () => {
    const agent: Agent = {
      id: 'leela',
      name: 'Leela',
      role: 'Lead',
      status: 'active',
      currentTask: 'P0-4',
      expertise: ['architecture', 'planning'],
      voiceProfile: {
        agentId: 'leela',
        displayName: 'Leela',
        voiceId: 'alloy',
        personality: 'Confident and direct',
      },
    };
    expect(agent.id).toBe('leela');
    expect(agent.expertise).toHaveLength(2);
    expect(agent.voiceProfile.voiceId).toBe('alloy');
  });

  it('Task has the expected fields', () => {
    const task: Task = {
      id: 'P0-4',
      title: 'Shared types package',
      description: 'Create @openspace/shared',
      status: 'in-progress',
      priority: 'P0',
      assignee: 'leela',
      assigneeType: 'agent',
      labels: ['foundation'],
      createdAt: '2026-03-23T00:00:00Z',
      updatedAt: '2026-03-23T01:00:00Z',
      sortIndex: 0,
    };
    expect(task.status).toBe('in-progress');
    expect(task.priority).toBe('P0');
    expect(task.sortIndex).toBe(0);
  });

  it('Decision has the expected fields', () => {
    const decision: Decision = {
      id: 'd1',
      title: 'Use monorepo',
      author: 'leela',
      date: '2026-03-23T00:00:00Z',
      rationale: 'Shared types, single CI',
      status: 'active',
      affectedFiles: ['package.json'],
    };
    expect(decision.status).toBe('active');
    expect(decision.affectedFiles).toContain('package.json');
  });

  it('ChatMessage has the expected fields', () => {
    const msg: ChatMessage = {
      id: 'msg-1',
      sender: 'user-1',
      recipient: 'team',
      content: 'Hello squad!',
      timestamp: '2026-03-23T00:00:00Z',
      threadId: null,
    };
    expect(msg.recipient).toBe('team');
    expect(msg.threadId).toBeNull();
  });

  it('ActivityEvent has the expected fields', () => {
    const event: ActivityEvent = {
      id: 'evt-1',
      type: 'completed',
      agentId: 'bender',
      description: 'Finished backend scaffolding',
      timestamp: '2026-03-23T00:00:00Z',
      relatedEntityId: 'P0-3',
    };
    expect(event.type).toBe('completed');
    expect(event.relatedEntityId).toBe('P0-3');
  });

  it('VoiceProfile has the expected fields', () => {
    const profile: VoiceProfile = {
      agentId: 'fry',
      displayName: 'Fry',
      voiceId: 'echo',
      personality: 'Enthusiastic and friendly',
    };
    expect(profile.voiceId).toBe('echo');
  });

  it('VoiceMessage has the expected fields', () => {
    const vmsg: VoiceMessage = {
      id: 'vmsg-1',
      sessionId: 'vs-1',
      role: 'agent',
      agentId: 'leela',
      content: 'Good morning team',
      timestamp: '2026-03-23T09:00:00Z',
      durationMs: 2500,
    };
    expect(vmsg.role).toBe('agent');
    expect(vmsg.durationMs).toBe(2500);
  });

  it('VoiceSession has the expected fields', () => {
    const session: VoiceSession = {
      id: 'vs-1',
      title: 'Morning standup',
      status: 'active',
      participantAgentIds: ['leela', 'bender', 'fry'],
      startedAt: '2026-03-23T09:00:00Z',
      endedAt: null,
      messages: [],
    };
    expect(session.status).toBe('active');
    expect(session.participantAgentIds).toHaveLength(3);
    expect(session.endedAt).toBeNull();
  });

  it('SquadConfig has the expected fields', () => {
    const config: SquadConfig = {
      id: 'squad-1',
      name: 'openspace.ai',
      description: 'Human-AI squad management',
      squadDir: '/project/.squad',
      agents: [],
    };
    expect(config.squadDir).toContain('.squad');
  });

  it('SquadOverview has the expected fields', () => {
    const overview: SquadOverview = {
      config: {
        id: 'squad-1',
        name: 'openspace.ai',
        description: 'Human-AI squad management',
        squadDir: '/project/.squad',
        agents: [],
      },
      agents: [],
      recentTasks: [],
      taskCounts: {
        byStatus: {
          'pending-approval': 0,
          backlog: 0,
          'in-progress': 0,
          'in-review': 0,
          done: 0,
          blocked: 0,
          delegated: 0,
        },
        total: 0,
      },
      recentDecisions: [],
    };
    expect(overview.taskCounts.total).toBe(0);
    expect(Object.keys(overview.taskCounts.byStatus)).toHaveLength(6);
  });
});

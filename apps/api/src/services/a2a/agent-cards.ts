/**
 * A2A AgentCard definitions for each squad agent.
 */

import type { AgentCard, AgentSkill } from '@a2a-js/sdk';

import type { AgentProfile } from '../agent-registry.js';

/** Skill sets keyed by well-known agent roles. */
const SKILLS_BY_ROLE: Record<string, AgentSkill[]> = {
  Lead: [
    {
      id: 'project-planning',
      name: 'Project Planning',
      description: 'Break down projects into tasks, set priorities, and create execution plans.',
      tags: ['planning', 'management', 'strategy'],
      examples: ['Plan the next sprint', 'Break this feature into tasks'],
    },
    {
      id: 'team-coordination',
      name: 'Team Coordination',
      description: 'Coordinate work across team members, resolve blockers, and track progress.',
      tags: ['coordination', 'leadership', 'tracking'],
      examples: ['Who should work on this?', 'What is blocking the team?'],
    },
  ],
  'Frontend Dev': [
    {
      id: 'ui-development',
      name: 'UI Development',
      description: 'Build and review React/Next.js components, layouts, and user interfaces.',
      tags: ['react', 'nextjs', 'css', 'ui', 'frontend'],
      examples: ['Create a dashboard component', 'Review this React component'],
    },
    {
      id: 'frontend-architecture',
      name: 'Frontend Architecture',
      description: 'Design frontend architecture, state management, and client-side patterns.',
      tags: ['architecture', 'state-management', 'patterns'],
      examples: ['How should we structure the state?', 'Suggest a component hierarchy'],
    },
  ],
  'Backend Dev': [
    {
      id: 'api-development',
      name: 'API Development',
      description: 'Build and review REST APIs, database schemas, and server-side logic.',
      tags: ['api', 'rest', 'database', 'backend'],
      examples: ['Create an endpoint for users', 'Review this database schema'],
    },
    {
      id: 'backend-architecture',
      name: 'Backend Architecture',
      description: 'Design backend systems, services, and infrastructure patterns.',
      tags: ['architecture', 'infrastructure', 'scalability'],
      examples: ['How should we structure the services?', 'Design the data model'],
    },
  ],
  Tester: [
    {
      id: 'test-planning',
      name: 'Test Planning',
      description: 'Create test plans, identify edge cases, and define test strategies.',
      tags: ['testing', 'qa', 'test-planning'],
      examples: ['Write test cases for the login flow', 'What edge cases should we cover?'],
    },
    {
      id: 'bug-analysis',
      name: 'Bug Analysis',
      description: 'Analyze bugs, identify root causes, and suggest fixes.',
      tags: ['debugging', 'bug-analysis', 'qa'],
      examples: ['Why is this test failing?', 'Find the root cause of this bug'],
    },
  ],
};

/**
 * Infer reasonable skills for any role, falling back to a generic
 * "task execution" skill for unknown roles.
 */
export function inferSkillsFromRole(role: string): AgentSkill[] {
  const known = SKILLS_BY_ROLE[role];
  if (known) return known;

  const slug = role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return [
    {
      id: `${slug}-work`,
      name: `${role} Tasks`,
      description: `Handle tasks related to the ${role} role.`,
      tags: [slug, 'general'],
      examples: [`Do ${role.toLowerCase()} work`, `Help with ${role.toLowerCase()} tasks`],
    },
  ];
}

/**
 * Build a single AgentCard for one agent profile.
 */
export function buildAgentCard(agent: AgentProfile, baseUrl: string): AgentCard {
  return {
    name: agent.name,
    description: `${agent.name} — ${agent.role}. ${agent.personality}`,
    url: `${baseUrl}/a2a/${agent.id}`,
    protocolVersion: '0.3.0',
    version: '0.1.0',
    capabilities: {
      pushNotifications: false,
      streaming: true,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    skills: inferSkillsFromRole(agent.role),
  };
}

/**
 * Build AgentCard objects for the given agent profiles.
 */
export function buildAgentCards(agents: AgentProfile[], baseUrl: string): AgentCard[] {
  return agents.map((agent) => buildAgentCard(agent, baseUrl));
}

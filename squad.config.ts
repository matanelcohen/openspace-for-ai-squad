import {
  defineAgent,
  defineHooks,
  defineRouting,
  defineSquad,
  defineTeam,
  defineTelemetry,
} from '@matanelcohen/openspace-shared';

export default defineSquad({
  version: '1.0.0',

  team: defineTeam({
    name: 'openspace.ai',
    description: 'Human-AI squad management tool',
    members: ['@leela', '@fry', '@bender', '@zoidberg'],
    projectContext: 'TypeScript monorepo: Next.js frontend, Fastify API, SQLite cache',
  }),

  agents: [
    defineAgent({
      name: 'leela',
      role: 'Lead',
      model: 'claude-opus-4.6',
      tools: ['route', 'decide', 'delegate'],
      capabilities: [
        { name: 'project-planning', level: 'expert' },
        { name: 'team-coordination', level: 'expert' },
      ],
    }),
    defineAgent({
      name: 'fry',
      role: 'Frontend Dev',
      model: 'claude-opus-4.6',
      tools: ['edit', 'bash', 'view'],
      capabilities: [
        { name: 'react', level: 'expert' },
        { name: 'css', level: 'expert' },
        { name: 'typescript', level: 'proficient' },
      ],
    }),
    defineAgent({
      name: 'bender',
      role: 'Backend Dev',
      model: 'claude-opus-4.6',
      tools: ['edit', 'bash', 'db'],
      capabilities: [
        { name: 'api-design', level: 'expert' },
        { name: 'database', level: 'expert' },
        { name: 'typescript', level: 'expert' },
      ],
    }),
    defineAgent({
      name: 'zoidberg',
      role: 'Tester',
      model: 'claude-opus-4.6',
      tools: ['bash', 'test', 'view'],
      capabilities: [
        { name: 'testing', level: 'expert' },
        { name: 'quality-assurance', level: 'expert' },
      ],
    }),
  ],

  routing: defineRouting({
    rules: [
      { pattern: 'frontend|ui|css|component|page|layout', agents: ['@fry'], tier: 'standard' },
      {
        pattern: 'api|backend|database|server|route|endpoint',
        agents: ['@bender'],
        tier: 'standard',
      },
      { pattern: 'test|bug|quality|e2e|coverage', agents: ['@zoidberg'], tier: 'standard' },
    ],
    defaultAgent: '@leela',
    fallback: 'coordinator',
  }),

  hooks: defineHooks({
    allowedWritePaths: ['apps/**', 'packages/**', '.squad/**'],
    blockedCommands: ['rm -rf /', 'DROP TABLE'],
    maxAskUser: 3,
  }),

  models: {
    default: 'claude-opus-4.6',
    fallbackChains: {
      premium: ['claude-opus-4.6', 'gpt-5.4'],
      standard: ['claude-sonnet-4.5', 'gpt-5.1'],
      fast: ['claude-haiku-4.5', 'gpt-5-mini'],
    },
  },

  telemetry: defineTelemetry({
    enabled: true,
    endpoint: 'http://localhost:3001',
    serviceName: 'openspace-api',
  }),
});

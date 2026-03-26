/**
 * Seed built-in skills into the SkillRegistry on startup.
 * These represent the core capabilities available to squad agents.
 */

import type { SkillRegistryImpl } from './skill-registry/index.js';

interface BuiltinSkill {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  icon: string;
}

const BUILTIN_SKILLS: BuiltinSkill[] = [
  {
    id: 'file-operations',
    name: 'File Operations',
    version: '1.0.0',
    description: 'Read, write, create, and modify files in the project. Supports all text formats.',
    author: 'openspace.ai',
    tags: ['core', 'filesystem', 'code'],
    icon: '📁',
  },
  {
    id: 'bash-execution',
    name: 'Bash Execution',
    version: '1.0.0',
    description: 'Run shell commands, install packages, build projects, and execute scripts.',
    author: 'openspace.ai',
    tags: ['core', 'shell', 'devops'],
    icon: '💻',
  },
  {
    id: 'code-review',
    name: 'Code Review',
    version: '1.0.0',
    description: 'Analyze code for bugs, security issues, performance problems, and style violations.',
    author: 'openspace.ai',
    tags: ['quality', 'review', 'code'],
    icon: '🔍',
  },
  {
    id: 'web-search',
    name: 'Web Search',
    version: '1.0.0',
    description: 'Search the web for documentation, APIs, libraries, and best practices.',
    author: 'openspace.ai',
    tags: ['research', 'web', 'docs'],
    icon: '🌐',
  },
  {
    id: 'test-runner',
    name: 'Test Runner',
    version: '1.0.0',
    description: 'Run unit tests, integration tests, and E2E tests. Report results and coverage.',
    author: 'openspace.ai',
    tags: ['testing', 'quality', 'ci'],
    icon: '🧪',
  },
  {
    id: 'git-operations',
    name: 'Git Operations',
    version: '1.0.0',
    description: 'Stage, commit, branch, merge, and manage git repositories.',
    author: 'openspace.ai',
    tags: ['core', 'git', 'vcs'],
    icon: '🔀',
  },
  {
    id: 'database-query',
    name: 'Database Query',
    version: '1.0.0',
    description: 'Query SQLite databases, inspect schemas, run migrations, and analyze data.',
    author: 'openspace.ai',
    tags: ['data', 'sql', 'database'],
    icon: '🗄️',
  },
  {
    id: 'task-delegation',
    name: 'Task Delegation',
    version: '1.0.0',
    description: 'Break down tasks, assign to team members, track progress, and coordinate work via A2A protocol.',
    author: 'openspace.ai',
    tags: ['management', 'a2a', 'coordination'],
    icon: '📋',
  },
];

/**
 * Register built-in skills into the registry.
 * Uses the registry's internal discover-like flow to add entries.
 */
export function seedBuiltinSkills(registry: SkillRegistryImpl): void {
  // Access the internal entries map via discover simulation
  // We call discover with empty dirs then manually add entries
  const entries = (registry as unknown as { entries: Map<string, unknown> }).entries;

  for (const skill of BUILTIN_SKILLS) {
    if (entries.has(skill.id)) continue;

    entries.set(skill.id, {
      manifest: {
        manifestVersion: '1.0' as const,
        id: skill.id,
        name: skill.name,
        version: skill.version,
        description: skill.description,
        author: skill.author,
        tags: skill.tags,
        icon: skill.icon,
        permissions: [],
        agentMatch: { roles: ['*'] },
      },
      phase: 'loaded' as const,
      hooks: null,
      activeAgents: new Set<string>(),
      lastTransition: Date.now(),
      error: null,
      sourcePath: 'builtin',
      retryState: null,
      circuitBreaker: null,
    });
  }

  console.log(`[Skills] Seeded ${BUILTIN_SKILLS.length} built-in skills`);
}

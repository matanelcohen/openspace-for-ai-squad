/**
 * E2E test: agent receives a git-related task → router selects
 * git-expert skill → skill tools and prompts are injected →
 * agent produces correct output.
 *
 * Uses real skill manifests from @openspace/skills-core.
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SkillTaskContext } from '@openspace/shared/src/types/skill.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillRegistryImpl } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the real skills-core skill directories
const SKILLS_CORE_SRC = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'skills-core',
  'src',
);

// ── Helpers ──────────────────────────────────────────────────────

let tempDir: string;

function copySkillToTemp(skillId: string) {
  const srcDir = join(SKILLS_CORE_SRC, skillId);
  const destDir = join(tempDir, skillId);
  cpSync(srcDir, destDir, { recursive: true });
}

// ── E2E Test Suite ───────────────────────────────────────────────

describe('E2E: git-related task → git-expert skill', () => {
  let registry: SkillRegistryImpl;

  beforeEach(() => {
    registry = new SkillRegistryImpl();
    tempDir = join(tmpdir(), `skill-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('full pipeline: discover → validate → load all core skills', async () => {
    copySkillToTemp('git-expert');
    copySkillToTemp('code-reviewer');
    copySkillToTemp('test-runner');

    const summary = await registry.discoverAndLoadAll([tempDir]);

    expect(summary.discovered).toBe(3);
    expect(summary.validated).toBe(3);
    expect(summary.loaded).toBe(3);
    expect(summary.errors).toHaveLength(0);
  });

  it('router selects git-expert for a git-analysis task', async () => {
    copySkillToTemp('git-expert');
    copySkillToTemp('code-reviewer');
    copySkillToTemp('test-runner');

    await registry.discoverAndLoadAll([tempDir]);

    const task: SkillTaskContext = {
      id: 'task-git-1',
      title: 'Analyze recent commits for regressions',
      description: 'Check the last 10 commits on main for any breaking changes',
      labels: ['git-analysis'],
      priority: 'high',
      metadata: { taskType: 'git-analysis' },
    };

    const matches = await registry.matchTask(task);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].skillId).toBe('git-expert');
    expect(matches[0].confidence).toBe(0.9);
  });

  it('router selects git-expert via pattern trigger for commit-related title', async () => {
    copySkillToTemp('git-expert');
    copySkillToTemp('code-reviewer');
    copySkillToTemp('test-runner');

    await registry.discoverAndLoadAll([tempDir]);

    const task: SkillTaskContext = {
      id: 'task-git-2',
      title: 'Review the latest commit on feature branch',
      description: 'Need to understand what changed',
      labels: [],
      priority: 'medium',
    };

    const matches = await registry.matchTask(task);
    const gitMatch = matches.find((m) => m.skillId === 'git-expert');

    expect(gitMatch).toBeDefined();
    expect(gitMatch!.confidence).toBe(0.7); // pattern match confidence
  });

  it('router selects code-reviewer for code-review task type', async () => {
    copySkillToTemp('git-expert');
    copySkillToTemp('code-reviewer');
    copySkillToTemp('test-runner');

    await registry.discoverAndLoadAll([tempDir]);

    const task: SkillTaskContext = {
      id: 'task-cr-1',
      title: 'Review authentication module',
      description: 'Security-focused code review',
      labels: ['code-review'],
      priority: 'high',
      metadata: { taskType: 'code-review' },
    };

    const matches = await registry.matchTask(task);
    expect(matches[0].skillId).toBe('code-reviewer');
  });

  it('router selects test-runner for test-related task type', async () => {
    copySkillToTemp('git-expert');
    copySkillToTemp('code-reviewer');
    copySkillToTemp('test-runner');

    await registry.discoverAndLoadAll([tempDir]);

    const task: SkillTaskContext = {
      id: 'task-tr-1',
      title: 'Fix broken tests',
      description: 'Several tests are failing after refactor',
      labels: ['test-fix'],
      priority: 'high',
      metadata: { taskType: 'test-fix' },
    };

    const matches = await registry.matchTask(task);
    const testMatch = matches.find((m) => m.skillId === 'test-runner');
    expect(testMatch).toBeDefined();
    expect(testMatch!.confidence).toBe(0.9); // task-type match
  });

  it('git-expert skill provides correct tools and prompts when activated', async () => {
    copySkillToTemp('git-expert');
    await registry.discoverAndLoadAll([tempDir]);

    const ctx = await registry.activate('git-expert', 'agent-007', {
      id: 'task-1',
      title: 'Analyze commits',
      description: 'desc',
      labels: ['git-analysis'],
      priority: 'high',
    });

    // Verify tools are scoped correctly
    expect(ctx.tools.isAvailable('git:diff')).toBe(true);
    expect(ctx.tools.isAvailable('git:log')).toBe(true);
    expect(ctx.tools.isAvailable('git:blame')).toBe(true);
    expect(ctx.tools.isAvailable('git:show')).toBe(true);
    expect(ctx.tools.isAvailable('file:read')).toBe(true);
    expect(ctx.tools.isAvailable('shell:exec')).toBe(false);

    // Verify tool invocation rejects undeclared tools
    const result = await ctx.tools.invoke('shell:exec', { command: 'rm -rf /' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not declared');

    // Verify declared tool invocation succeeds (stub)
    const diffResult = await ctx.tools.invoke('git:diff', {});
    expect(diffResult.success).toBe(true);

    // Verify prompts are injected
    const systemPrompts = await registry.getActivePrompts('agent-007', 'system');
    expect(systemPrompts).toHaveLength(1);
    expect(systemPrompts[0].skillId).toBe('git-expert');
    expect(systemPrompts[0].content).toContain('{{agent.name}}');

    // Verify execution prompts
    const execPrompts = await registry.getActivePrompts('agent-007', 'execution');
    expect(execPrompts.length).toBeGreaterThan(0);

    // Verify review prompts
    const reviewPrompts = await registry.getActivePrompts('agent-007', 'review');
    expect(reviewPrompts.length).toBeGreaterThan(0);

    // Verify config defaults
    expect(ctx.config.maxDiffLines).toBe(500);
    expect(ctx.config.includeStats).toBe(true);

    // Clean up
    await registry.deactivate('git-expert', 'agent-007');
    expect(registry.get('git-expert')!.phase).toBe('deactivated');
  });

  it('full lifecycle: load → activate → match → execute → deactivate → unload', async () => {
    copySkillToTemp('git-expert');

    // 1. Discover and load
    const summary = await registry.discoverAndLoadAll([tempDir]);
    expect(summary.loaded).toBe(1);

    // 2. Match task
    const task: SkillTaskContext = {
      id: 'e2e-task',
      title: 'Review git blame for auth.ts',
      description: 'Check who changed the authentication logic recently',
      labels: ['git-analysis'],
      priority: 'high',
      metadata: { taskType: 'git-analysis' },
    };
    const matches = await registry.matchTask(task);
    expect(matches[0].skillId).toBe('git-expert');

    // 3. Activate for agent
    const ctx = await registry.activate('git-expert', 'agent-alpha', task);
    expect(ctx.taskContext).toBe(task);
    expect(ctx.agent.id).toBe('agent-alpha');

    // 4. Simulate tool invocation
    const blameResult = await ctx.tools.invoke('git:blame', { path: 'src/auth.ts' });
    expect(blameResult.success).toBe(true);

    // 5. Get prompts for the agent
    const prompts = await registry.getActivePrompts('agent-alpha', 'system');
    expect(prompts).toHaveLength(1);

    // 6. Deactivate
    await registry.deactivate('git-expert', 'agent-alpha');
    expect(registry.get('git-expert')!.phase).toBe('deactivated');

    // 7. Unload
    await registry.unload('git-expert');
    expect(registry.get('git-expert')).toBeUndefined();
  });

  it('multiple skills can be activated for the same agent', async () => {
    copySkillToTemp('git-expert');
    copySkillToTemp('code-reviewer');

    await registry.discoverAndLoadAll([tempDir]);

    const gitCtx = await registry.activate('git-expert', 'agent-multi');
    const crCtx = await registry.activate('code-reviewer', 'agent-multi');

    // Both contexts are valid
    expect(gitCtx.skill.id).toBe('git-expert');
    expect(crCtx.skill.id).toBe('code-reviewer');

    // Both have system prompts
    const prompts = await registry.getActivePrompts('agent-multi', 'system');
    expect(prompts).toHaveLength(2);

    // Clean up both
    await registry.deactivate('git-expert', 'agent-multi');
    await registry.deactivate('code-reviewer', 'agent-multi');
  });
});

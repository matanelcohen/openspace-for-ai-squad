/**
 * Integration tests for SkillRegistryImpl
 *
 * Covers the full lifecycle: discover → validate → load → activate
 *   → getActivePrompts → deactivate → unload
 * Plus events, filtering, error transitions, multi-agent.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SkillManifest, SkillRegistryEvent } from '@openspace/shared/src/types/skill.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillRegistryImpl } from '../index.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    manifestVersion: 1,
    id: 'test-skill',
    name: 'Test Skill',
    version: '1.0.0',
    description: 'A test skill',
    author: 'openspace',
    license: 'MIT',
    tags: ['code-analysis'],
    icon: 'test',
    tools: [{ toolId: 'file:read', reason: 'Read files' }],
    prompts: [
      {
        id: 'system',
        name: 'System',
        role: 'system',
        content: 'You are {{agent.name}}, a test assistant.',
      },
      {
        id: 'execution',
        name: 'Execute',
        role: 'execution',
        content: 'Execute the task at hand.',
      },
    ],
    triggers: [{ type: 'task-type', taskTypes: ['test-task'] }],
    config: [{ key: 'verbose', type: 'boolean', description: 'Verbose output', default: true }],
    permissions: ['fs:read'],
    ...overrides,
  } as SkillManifest;
}

let tempDir: string;

function createSkillOnDisk(parentDir: string, manifest: SkillManifest): void {
  const skillDir = join(parentDir, manifest.id);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

// ── Test Suite ───────────────────────────────────────────────────

describe('SkillRegistryImpl', () => {
  let registry: SkillRegistryImpl;

  beforeEach(() => {
    registry = new SkillRegistryImpl();
    tempDir = join(
      tmpdir(),
      `skill-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── Discovery ──────────────────────────────────────────────

  describe('discover', () => {
    it('discovers skills from directory and returns IDs', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'alpha-skill' }));
      createSkillOnDisk(tempDir, makeManifest({ id: 'beta-skill' }));

      const ids = await registry.discover([tempDir]);
      expect(ids).toContain('alpha-skill');
      expect(ids).toContain('beta-skill');
    });

    it('does not rediscover already-registered skills', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'repeat-skill' }));

      const first = await registry.discover([tempDir]);
      expect(first).toContain('repeat-skill');

      const second = await registry.discover([tempDir]);
      expect(second).not.toContain('repeat-skill');
    });

    it('puts skills in discovered phase', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'disco-skill' }));
      await registry.discover([tempDir]);

      const entry = registry.get('disco-skill');
      expect(entry).toBeDefined();
      expect(entry!.phase).toBe('discovered');
    });
  });

  // ── Validation ─────────────────────────────────────────────

  describe('validate', () => {
    it('validates a correctly discovered skill', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'valid-skill' }));
      await registry.discover([tempDir]);

      const result = await registry.validate('valid-skill');
      expect(result.valid).toBe(true);
      expect(registry.get('valid-skill')!.phase).toBe('validated');
    });

    it('returns error for unknown skill', async () => {
      const result = await registry.validate('nonexistent');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('NOT_FOUND');
    });

    it('transitions to error phase on validation failure', async () => {
      // Create skill with invalid manifest (empty description)
      const bad = makeManifest({ id: 'bad-skill', description: '' });
      createSkillOnDisk(tempDir, bad);
      await registry.discover([tempDir]);

      const result = await registry.validate('bad-skill');
      expect(result.valid).toBe(false);
      expect(registry.get('bad-skill')!.phase).toBe('error');
    });
  });

  // ── Loading ────────────────────────────────────────────────

  describe('load', () => {
    it('loads a validated skill', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'load-skill' }));
      await registry.discover([tempDir]);
      await registry.validate('load-skill');
      await registry.load('load-skill');

      expect(registry.get('load-skill')!.phase).toBe('loaded');
    });

    it('throws when loading unvalidated skill', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'unval-skill' }));
      await registry.discover([tempDir]);

      await expect(registry.load('unval-skill')).rejects.toThrow('must be validated');
    });

    it('throws for unknown skill', async () => {
      await expect(registry.load('ghost')).rejects.toThrow('not found');
    });

    it('detects missing required dependencies', async () => {
      const m = makeManifest({
        id: 'needs-dep',
        dependencies: [{ skillId: 'missing-dep', optional: false }],
      });
      createSkillOnDisk(tempDir, m);
      await registry.discover([tempDir]);
      await registry.validate('needs-dep');

      await expect(registry.load('needs-dep')).rejects.toThrow('missing-dep');
      expect(registry.get('needs-dep')!.phase).toBe('error');
    });

    it('allows optional missing dependencies', async () => {
      const m = makeManifest({
        id: 'opt-dep',
        dependencies: [{ skillId: 'missing-dep', optional: true }],
      });
      createSkillOnDisk(tempDir, m);
      await registry.discover([tempDir]);
      await registry.validate('opt-dep');
      await registry.load('opt-dep');

      expect(registry.get('opt-dep')!.phase).toBe('loaded');
    });
  });

  // ── Activation ─────────────────────────────────────────────

  describe('activate / deactivate', () => {
    async function setupLoadedSkill(id: string) {
      createSkillOnDisk(tempDir, makeManifest({ id }));
      await registry.discover([tempDir]);
      await registry.validate(id);
      await registry.load(id);
    }

    it('activates a loaded skill and returns a context', async () => {
      await setupLoadedSkill('act-skill');

      const ctx = await registry.activate('act-skill', 'agent-1');
      expect(ctx).toBeDefined();
      expect(ctx.skill.id).toBe('act-skill');
      expect(ctx.agent.id).toBe('agent-1');
      expect(registry.get('act-skill')!.phase).toBe('active');
    });

    it('populates config defaults in context', async () => {
      await setupLoadedSkill('cfg-skill');
      const ctx = await registry.activate('cfg-skill', 'agent-1');
      expect(ctx.config.verbose).toBe(true);
    });

    it('provides scoped tool toolkit', async () => {
      await setupLoadedSkill('tool-skill');
      const ctx = await registry.activate('tool-skill', 'agent-1');

      expect(ctx.tools.isAvailable('file:read')).toBe(true);
      expect(ctx.tools.isAvailable('unknown:tool')).toBe(false);
      expect(ctx.tools.list()).toHaveLength(1);
    });

    it('allows multiple agents on same skill', async () => {
      await setupLoadedSkill('multi-agent');
      await registry.activate('multi-agent', 'agent-1');
      await registry.activate('multi-agent', 'agent-2');

      const entry = registry.get('multi-agent')!;
      expect(entry.activeAgents.size).toBe(2);
      expect(entry.phase).toBe('active');
    });

    it('deactivates and transitions to deactivated when last agent leaves', async () => {
      await setupLoadedSkill('deact-skill');
      await registry.activate('deact-skill', 'agent-1');
      await registry.deactivate('deact-skill', 'agent-1');

      expect(registry.get('deact-skill')!.phase).toBe('deactivated');
      expect(registry.get('deact-skill')!.activeAgents.size).toBe(0);
    });

    it('stays active when one of multiple agents deactivates', async () => {
      await setupLoadedSkill('partial-deact');
      await registry.activate('partial-deact', 'agent-1');
      await registry.activate('partial-deact', 'agent-2');
      await registry.deactivate('partial-deact', 'agent-1');

      expect(registry.get('partial-deact')!.phase).toBe('active');
      expect(registry.get('partial-deact')!.activeAgents.size).toBe(1);
    });

    it('can reactivate after deactivation', async () => {
      await setupLoadedSkill('react-skill');
      await registry.activate('react-skill', 'agent-1');
      await registry.deactivate('react-skill', 'agent-1');
      expect(registry.get('react-skill')!.phase).toBe('deactivated');

      const ctx = await registry.activate('react-skill', 'agent-1');
      expect(ctx).toBeDefined();
      expect(registry.get('react-skill')!.phase).toBe('active');
    });

    it('throws when activating non-loaded skill', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'not-loaded' }));
      await registry.discover([tempDir]);

      await expect(registry.activate('not-loaded', 'agent-1')).rejects.toThrow('must be loaded');
    });
  });

  // ── getActivePrompts ───────────────────────────────────────

  describe('getActivePrompts', () => {
    it('returns prompts for active skills by role', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'prompt-skill' }));
      await registry.discover([tempDir]);
      await registry.validate('prompt-skill');
      await registry.load('prompt-skill');
      await registry.activate('prompt-skill', 'agent-1');

      const systemPrompts = await registry.getActivePrompts('agent-1', 'system');
      expect(systemPrompts).toHaveLength(1);
      expect(systemPrompts[0].skillId).toBe('prompt-skill');
      expect(systemPrompts[0].role).toBe('system');
      expect(systemPrompts[0].tokenEstimate).toBeGreaterThan(0);

      const execPrompts = await registry.getActivePrompts('agent-1', 'execution');
      expect(execPrompts).toHaveLength(1);
    });

    it('returns empty when no active skills for agent', async () => {
      const prompts = await registry.getActivePrompts('agent-unknown', 'system');
      expect(prompts).toEqual([]);
    });
  });

  // ── Task Matching ──────────────────────────────────────────

  describe('matchTask', () => {
    it('matches tasks to loaded skills via triggers', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'match-skill' }));
      await registry.discover([tempDir]);
      await registry.validate('match-skill');
      await registry.load('match-skill');

      const results = await registry.matchTask({
        id: 'task-1',
        title: 'Do a test-task',
        description: 'desc',
        labels: ['test-task'],
        priority: 'high',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].skillId).toBe('match-skill');
    });
  });

  // ── Querying ───────────────────────────────────────────────

  describe('list / get / getContext', () => {
    it('lists all registered skills', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'list-a' }));
      createSkillOnDisk(tempDir, makeManifest({ id: 'list-b' }));
      await registry.discover([tempDir]);

      expect(registry.list()).toHaveLength(2);
    });

    it('filters by phase', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'phase-test' }));
      await registry.discover([tempDir]);

      expect(registry.list({ phase: 'discovered' })).toHaveLength(1);
      expect(registry.list({ phase: 'loaded' })).toHaveLength(0);
    });

    it('filters by tags', async () => {
      createSkillOnDisk(
        tempDir,
        makeManifest({ id: 'tagged', tags: ['testing'] as SkillManifest['tags'] }),
      );
      createSkillOnDisk(
        tempDir,
        makeManifest({ id: 'nottagged', tags: ['code-analysis'] as SkillManifest['tags'] }),
      );
      await registry.discover([tempDir]);

      const results = registry.list({ tags: ['testing'] as SkillManifest['tags'] });
      expect(results).toHaveLength(1);
      expect(results[0].manifest.id).toBe('tagged');
    });

    it('filters by agentId', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'agent-filter' }));
      await registry.discover([tempDir]);
      await registry.validate('agent-filter');
      await registry.load('agent-filter');
      await registry.activate('agent-filter', 'agent-x');

      expect(registry.list({ agentId: 'agent-x' })).toHaveLength(1);
      expect(registry.list({ agentId: 'agent-y' })).toHaveLength(0);
    });

    it('getContext returns the activation context', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'ctx-skill' }));
      await registry.discover([tempDir]);
      await registry.validate('ctx-skill');
      await registry.load('ctx-skill');
      await registry.activate('ctx-skill', 'agent-1');

      const ctx = registry.getContext('ctx-skill', 'agent-1');
      expect(ctx).toBeDefined();
      expect(ctx!.skill.id).toBe('ctx-skill');
    });

    it('getContext returns undefined for inactive pair', () => {
      expect(registry.getContext('nope', 'nope')).toBeUndefined();
    });
  });

  // ── Unload ─────────────────────────────────────────────────

  describe('unload', () => {
    it('unloads a deactivated skill', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'unload-me' }));
      await registry.discover([tempDir]);
      await registry.validate('unload-me');
      await registry.load('unload-me');
      await registry.activate('unload-me', 'agent-1');
      await registry.deactivate('unload-me', 'agent-1');
      await registry.unload('unload-me');

      expect(registry.get('unload-me')).toBeUndefined();
    });

    it('throws when unloading an active skill', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'active-unload' }));
      await registry.discover([tempDir]);
      await registry.validate('active-unload');
      await registry.load('active-unload');
      await registry.activate('active-unload', 'agent-1');

      await expect(registry.unload('active-unload')).rejects.toThrow('still active');
    });
  });

  // ── Events ─────────────────────────────────────────────────

  describe('events', () => {
    it('emits skill:discovered on discovery', async () => {
      const events: SkillRegistryEvent[] = [];
      registry.on('skill:discovered', (e) => events.push(e));

      createSkillOnDisk(tempDir, makeManifest({ id: 'evt-skill' }));
      await registry.discover([tempDir]);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('skill:discovered');
      expect(events[0].skillId).toBe('evt-skill');
    });

    it('emits skill:activated and skill:deactivated', async () => {
      const events: SkillRegistryEvent[] = [];
      registry.on('skill:activated', (e) => events.push(e));
      registry.on('skill:deactivated', (e) => events.push(e));

      createSkillOnDisk(tempDir, makeManifest({ id: 'evt-act' }));
      await registry.discover([tempDir]);
      await registry.validate('evt-act');
      await registry.load('evt-act');
      await registry.activate('evt-act', 'agent-1');
      await registry.deactivate('evt-act', 'agent-1');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('skill:activated');
      expect(events[0].agentId).toBe('agent-1');
      expect(events[1].type).toBe('skill:deactivated');
    });

    it('emits skill:unloaded', async () => {
      const events: SkillRegistryEvent[] = [];
      registry.on('skill:unloaded', (e) => events.push(e));

      createSkillOnDisk(tempDir, makeManifest({ id: 'evt-unload' }));
      await registry.discover([tempDir]);
      await registry.validate('evt-unload');
      await registry.load('evt-unload');
      await registry.unload('evt-unload');

      expect(events).toHaveLength(1);
      expect(events[0].skillId).toBe('evt-unload');
    });

    it('emits skill:error on validation failure', async () => {
      const events: SkillRegistryEvent[] = [];
      registry.on('skill:error', (e) => events.push(e));

      createSkillOnDisk(tempDir, makeManifest({ id: 'err-skill', description: '' }));
      await registry.discover([tempDir]);
      await registry.validate('err-skill');

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('skill:error');
    });

    it('supports removing event listeners', async () => {
      const events: SkillRegistryEvent[] = [];
      const listener = (e: SkillRegistryEvent) => events.push(e);
      registry.on('skill:discovered', listener);
      registry.off('skill:discovered', listener);

      createSkillOnDisk(tempDir, makeManifest({ id: 'off-skill' }));
      await registry.discover([tempDir]);

      expect(events).toHaveLength(0);
    });

    it('listener errors do not propagate', async () => {
      registry.on('skill:discovered', () => {
        throw new Error('listener crash');
      });

      createSkillOnDisk(tempDir, makeManifest({ id: 'crash-skill' }));
      // Should not throw
      await expect(registry.discover([tempDir])).resolves.toBeDefined();
    });
  });

  // ── discoverAndLoadAll ─────────────────────────────────────

  describe('discoverAndLoadAll', () => {
    it('discovers, validates, and loads all skills', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'auto-a' }));
      createSkillOnDisk(tempDir, makeManifest({ id: 'auto-b' }));

      const summary = await registry.discoverAndLoadAll([tempDir]);
      expect(summary.discovered).toBe(2);
      expect(summary.validated).toBe(2);
      expect(summary.loaded).toBe(2);
      expect(summary.errors).toHaveLength(0);
    });

    it('reports errors for invalid skills', async () => {
      createSkillOnDisk(tempDir, makeManifest({ id: 'good-skill' }));
      createSkillOnDisk(tempDir, makeManifest({ id: 'bad-skill', description: '' }));

      const summary = await registry.discoverAndLoadAll([tempDir]);
      expect(summary.discovered).toBe(2);
      expect(summary.validated).toBe(1);
      expect(summary.loaded).toBe(1);
    });

    it('loads skills in dependency order', async () => {
      const lib = makeManifest({ id: 'lib-skill' });
      const app = makeManifest({
        id: 'app-skill',
        dependencies: [{ skillId: 'lib-skill', optional: true }],
      });
      createSkillOnDisk(tempDir, lib);
      createSkillOnDisk(tempDir, app);

      const summary = await registry.discoverAndLoadAll([tempDir]);
      expect(summary.loaded).toBe(2);

      // Both should be loaded
      expect(registry.get('lib-skill')!.phase).toBe('loaded');
      expect(registry.get('app-skill')!.phase).toBe('loaded');
    });
  });

  // ── register (programmatic) ────────────────────────────────

  describe('register', () => {
    it('registers a skill directly from a manifest', async () => {
      const manifest = makeManifest({ id: 'api-skill' });
      const result = await registry.register(manifest);
      expect(result.valid).toBe(true);

      const entry = registry.get('api-skill');
      expect(entry).toBeDefined();
      expect(entry!.phase).toBe('loaded');
      expect(entry!.activeAgents.size).toBe(0);
    });

    it('rejects duplicate skill ID', async () => {
      const manifest = makeManifest({ id: 'dup-skill' });
      await registry.register(manifest);

      const result = await registry.register(makeManifest({ id: 'dup-skill' }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('DUPLICATE_ID');
    });

    it('rejects invalid manifest', async () => {
      const bad = makeManifest({ id: 'bad', description: '' });
      const result = await registry.register(bad);
      expect(result.valid).toBe(false);
    });

    it('allows activation after register', async () => {
      await registry.register(makeManifest({ id: 'activatable' }));
      const ctx = await registry.activate('activatable', 'agent-1');
      expect(ctx).toBeDefined();
      expect(registry.get('activatable')!.phase).toBe('active');
    });
  });

  // ── updateManifest ─────────────────────────────────────────

  describe('updateManifest', () => {
    it('updates a registered skill manifest', async () => {
      await registry.register(makeManifest({ id: 'updatable', name: 'Old Name' }));
      const result = await registry.updateManifest('updatable', { name: 'New Name' });
      expect(result.valid).toBe(true);

      const entry = registry.get('updatable');
      expect(entry!.manifest.name).toBe('New Name');
      expect(entry!.phase).toBe('loaded');
    });

    it('rejects update on non-existent skill', async () => {
      const result = await registry.updateManifest('ghost', { name: 'nope' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('NOT_FOUND');
    });

    it('rejects update while skill is active', async () => {
      await registry.register(makeManifest({ id: 'busy-skill' }));
      await registry.activate('busy-skill', 'agent-1');

      const result = await registry.updateManifest('busy-skill', { name: 'Updated' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('SKILL_ACTIVE');
    });

    it('preserves skill ID even if patch tries to change it', async () => {
      await registry.register(makeManifest({ id: 'pinned-id' }));
      await registry.updateManifest('pinned-id', { id: 'hacked' } as any);

      expect(registry.get('pinned-id')).toBeDefined();
      expect(registry.get('hacked')).toBeUndefined();
    });
  });
});

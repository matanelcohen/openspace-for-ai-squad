/**
 * Edge case tests for the skill plugin system.
 *
 * Covers: malformed manifests, duplicate skill names, skill hot-reload,
 *         concurrent skill loading, error recovery.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SkillManifest } from '@openspace/shared/src/types/skill.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillRegistryImpl } from '../index.js';
import { discoverManifests, validateSkillManifest } from '../skill-loader.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    manifestVersion: 1,
    id: 'edge-skill',
    name: 'Edge Skill',
    version: '1.0.0',
    description: 'An edge case test skill',
    author: 'openspace',
    license: 'MIT',
    tags: ['code-analysis'],
    icon: 'test',
    tools: [{ toolId: 'file:read', reason: 'Read files' }],
    prompts: [{ id: 'system', name: 'System', role: 'system', content: 'You are {{agent.name}}.' }],
    triggers: [{ type: 'task-type', taskTypes: ['edge-task'] }],
    permissions: ['fs:read'],
    ...overrides,
  } as SkillManifest;
}

let tempDir: string;

function createTempDir(): string {
  const dir = join(tmpdir(), `skill-edge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createSkillOnDisk(parentDir: string, manifest: SkillManifest): void {
  const skillDir = join(parentDir, manifest.id);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

// ── Malformed Manifests ──────────────────────────────────────────

describe('malformed manifests', () => {
  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('handles completely empty JSON object', () => {
    const result = validateSkillManifest({} as SkillManifest, '/fake/path');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles null-like values in required fields', () => {
    const result = validateSkillManifest(
      {
        manifestVersion: 1,
        id: null,
        name: null,
        version: null,
        description: null,
        tools: null,
        prompts: null,
        triggers: null,
      } as unknown as SkillManifest,
      '/fake/path',
    );
    expect(result.valid).toBe(false);
  });

  it('handles numeric values where strings expected', () => {
    const result = validateSkillManifest(
      makeManifest({ name: 123 as unknown as string, description: 456 as unknown as string }),
      '/fake/path',
    );
    expect(result.valid).toBe(false);
  });

  it('handles array where object expected in tools', () => {
    const result = validateSkillManifest(
      makeManifest({ tools: ['not-an-object'] as unknown as SkillManifest['tools'] }),
      '/fake/path',
    );
    expect(result.valid).toBe(false);
  });

  it('handles deeply nested invalid config', () => {
    const result = validateSkillManifest(
      makeManifest({
        config: [{ key: 123, type: 'invalid' }] as unknown as SkillManifest['config'],
      }),
      '/fake/path',
    );
    expect(result.valid).toBe(false);
  });

  it('discovers but fails to validate corrupt JSON on disk', async () => {
    const skillDir = join(tempDir, 'corrupt-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'manifest.json'), '{"manifestVersion": 1, "id": "corrupt-skill"');

    const discovered = discoverManifests([tempDir]);
    expect(discovered).toHaveLength(1);
    // Stub manifest has ID but is incomplete
    expect(discovered[0].manifest.id).toBe('corrupt-skill');

    // Direct validation should fail
    const result = validateSkillManifest(discovered[0].manifest, discovered[0].sourcePath);
    expect(result.valid).toBe(false);
  });

  it('handles manifest with no tools entry (missing required)', () => {
    const m = makeManifest();

    delete (m as Record<string, unknown>).tools;
    const result = validateSkillManifest(m, '/fake/path');
    expect(result.valid).toBe(false);
  });

  it('handles manifest with extra unexpected fields', () => {
    const m = makeManifest();
    (m as Record<string, unknown>).secretField = 'hidden';
    (m as Record<string, unknown>).anotherField = [1, 2, 3];
    const result = validateSkillManifest(m, '/fake/path');
    expect(result.valid).toBe(false);
  });
});

// ── Duplicate Skill Names ────────────────────────────────────────

describe('duplicate skill names', () => {
  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('registry ignores duplicate skill IDs on second discovery', async () => {
    const dir2 = createTempDir();
    try {
      createSkillOnDisk(tempDir, makeManifest({ id: 'dupe-skill' }));
      createSkillOnDisk(dir2, makeManifest({ id: 'dupe-skill', name: 'Different Name' }));

      const registry = new SkillRegistryImpl();
      const first = await registry.discover([tempDir]);
      expect(first).toContain('dupe-skill');

      const second = await registry.discover([dir2]);
      expect(second).not.toContain('dupe-skill');

      // The original stays
      expect(registry.get('dupe-skill')!.manifest.name).toBe('Edge Skill');
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it('validation catches duplicate IDs via knownIds', () => {
    const known = new Set(['existing-skill']);
    const result = validateSkillManifest(makeManifest({ id: 'existing-skill' }), '/path', known);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
  });
});

// ── Skill Hot-Reload ─────────────────────────────────────────────

describe('skill hot-reload', () => {
  let registry: SkillRegistryImpl;

  beforeEach(() => {
    registry = new SkillRegistryImpl();
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reload unloads and rediscovers a skill', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'reload-skill', description: 'Version 1' }));

    await registry.discoverAndLoadAll([tempDir]);
    expect(registry.get('reload-skill')!.manifest.description).toBe('Version 1');

    // Update skill on disk
    writeFileSync(
      join(tempDir, 'reload-skill', 'manifest.json'),
      JSON.stringify(makeManifest({ id: 'reload-skill', description: 'Version 2' }), null, 2),
    );

    await registry.reload('reload-skill');

    const entry = registry.get('reload-skill');
    expect(entry).toBeDefined();
    expect(entry!.manifest.description).toBe('Version 2');
    expect(entry!.phase).toBe('loaded');
  });

  it('reload deactivates all agents before unloading', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'hot-skill' }));
    await registry.discoverAndLoadAll([tempDir]);

    await registry.activate('hot-skill', 'agent-1');
    await registry.activate('hot-skill', 'agent-2');

    expect(registry.get('hot-skill')!.activeAgents.size).toBe(2);

    await registry.reload('hot-skill');

    // Should be reloaded with no active agents
    const entry = registry.get('hot-skill');
    expect(entry).toBeDefined();
    expect(entry!.phase).toBe('loaded');
    expect(entry!.activeAgents.size).toBe(0);
  });

  it('reload throws for unknown skill', async () => {
    await expect(registry.reload('ghost-skill')).rejects.toThrow('not found');
  });
});

// ── Concurrent Skill Loading ─────────────────────────────────────

describe('concurrent skill loading', () => {
  let registry: SkillRegistryImpl;

  beforeEach(() => {
    registry = new SkillRegistryImpl();
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('handles concurrent discover calls', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'conc-a' }));
    createSkillOnDisk(tempDir, makeManifest({ id: 'conc-b' }));

    const [first, second] = await Promise.all([
      registry.discover([tempDir]),
      registry.discover([tempDir]),
    ]);

    // At least one call gets both, the other may get none (already discovered)
    const allIds = [...new Set([...first, ...second])];
    expect(allIds).toContain('conc-a');
    expect(allIds).toContain('conc-b');
  });

  it('handles concurrent discoverAndLoadAll', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'load-a' }));
    createSkillOnDisk(tempDir, makeManifest({ id: 'load-b' }));

    const results = await Promise.all([
      registry.discoverAndLoadAll([tempDir]),
      registry.discoverAndLoadAll([tempDir]),
    ]);

    // Total discovered across both calls should be 2
    const totalDiscovered = results[0].discovered + results[1].discovered;
    expect(totalDiscovered).toBe(2);

    // Both should exist and be loaded
    expect(registry.get('load-a')).toBeDefined();
    expect(registry.get('load-b')).toBeDefined();
  });

  it('handles concurrent activation from multiple agents', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'multi-skill' }));
    await registry.discoverAndLoadAll([tempDir]);

    const agents = Array.from({ length: 10 }, (_, i) => `agent-${i}`);
    const ctxs = await Promise.all(
      agents.map((agentId) => registry.activate('multi-skill', agentId)),
    );

    expect(ctxs).toHaveLength(10);
    expect(registry.get('multi-skill')!.activeAgents.size).toBe(10);

    // Deactivate all concurrently
    await Promise.all(agents.map((agentId) => registry.deactivate('multi-skill', agentId)));

    expect(registry.get('multi-skill')!.activeAgents.size).toBe(0);
    expect(registry.get('multi-skill')!.phase).toBe('deactivated');
  });
});

// ── Error Recovery ───────────────────────────────────────────────

describe('error recovery', () => {
  let registry: SkillRegistryImpl;

  beforeEach(() => {
    registry = new SkillRegistryImpl();
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('error phase records error details', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'err-detail', description: '' }));
    await registry.discover([tempDir]);
    await registry.validate('err-detail');

    const entry = registry.get('err-detail')!;
    expect(entry.phase).toBe('error');
    expect(entry.error).toBeDefined();
    expect(entry.error!.code).toBe('MANIFEST_VALIDATION_ERROR');
  });

  it('cannot load a skill in error phase', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'err-load', description: '' }));
    await registry.discover([tempDir]);
    await registry.validate('err-load');

    await expect(registry.load('err-load')).rejects.toThrow('must be validated');
  });

  it('cannot activate a skill in error phase', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'err-act', description: '' }));
    await registry.discover([tempDir]);
    await registry.validate('err-act');

    await expect(registry.activate('err-act', 'agent-1')).rejects.toThrow('must be loaded');
  });

  it('circular dependency sets error phase', async () => {
    const skillA = makeManifest({
      id: 'circ-a',
      dependencies: [{ skillId: 'circ-b' }],
    });
    const skillB = makeManifest({
      id: 'circ-b',
      dependencies: [{ skillId: 'circ-a' }],
    });
    createSkillOnDisk(tempDir, skillA);
    createSkillOnDisk(tempDir, skillB);

    await registry.discover([tempDir]);
    await registry.validate('circ-a');
    await registry.validate('circ-b');

    // At least one will fail with circular dependency
    let circularFound = false;
    try {
      await registry.load('circ-a');
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Circular dependency')) circularFound = true;
    }
    try {
      await registry.load('circ-b');
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Circular dependency')) circularFound = true;
    }
    expect(circularFound).toBe(true);
  });
});

// ── Boundary Conditions ──────────────────────────────────────────

describe('boundary conditions', () => {
  it('handles skill ID at max length (64 chars)', () => {
    const longId = 'a' + 'b'.repeat(62) + 'z'; // 64 chars
    const result = validateSkillManifest(makeManifest({ id: longId }), '/path');
    expect(result.valid).toBe(true);
  });

  it('rejects skill ID exceeding max length (65 chars)', () => {
    const tooLong = 'a' + 'b'.repeat(63) + 'z'; // 65 chars
    const result = validateSkillManifest(makeManifest({ id: tooLong }), '/path');
    expect(result.valid).toBe(false);
  });

  it('handles skill ID at min length (3 chars)', () => {
    const result = validateSkillManifest(makeManifest({ id: 'abc' }), '/path');
    expect(result.valid).toBe(true);
  });

  it('handles manifest with maximum valid prompt roles', () => {
    const allRoles = ['system', 'planning', 'execution', 'review', 'error', 'handoff'] as const;
    const prompts = allRoles.map((role) => ({
      id: role,
      name: role,
      role,
      content: `Content for ${role}`,
    }));
    const result = validateSkillManifest(makeManifest({ prompts }), '/path');
    expect(result.valid).toBe(true);
  });

  it('handles manifest with all permission types', () => {
    const result = validateSkillManifest(
      makeManifest({
        permissions: [
          'fs:read',
          'fs:write',
          'net:outbound',
          'exec:shell',
          'agent:delegate',
          'secret:read',
        ],
      }),
      '/path',
    );
    expect(result.valid).toBe(true);
  });
});

// ── 4+ Node Circular Dependencies ───────────────────────────────

describe('complex circular dependencies', () => {
  let registry: SkillRegistryImpl;

  beforeEach(() => {
    registry = new SkillRegistryImpl();
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects 4-node circular dependency (A → B → C → D → A)', async () => {
    const ids = ['circ-4a', 'circ-4b', 'circ-4c', 'circ-4d'];
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: ids[0], dependencies: [{ skillId: ids[1] }] }),
    );
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: ids[1], dependencies: [{ skillId: ids[2] }] }),
    );
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: ids[2], dependencies: [{ skillId: ids[3] }] }),
    );
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: ids[3], dependencies: [{ skillId: ids[0] }] }),
    );

    await registry.discover([tempDir]);
    for (const id of ids) {
      await registry.validate(id);
    }

    let circularFound = false;
    for (const id of ids) {
      try {
        await registry.load(id);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('Circular dependency')) {
          circularFound = true;
        }
      }
    }
    expect(circularFound).toBe(true);
  });

  it('detects 5-node circular dependency with branching', async () => {
    // A → B → C → D → E → B (cycle B→C→D→E→B, A enters from outside)
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: 'branch-a', dependencies: [{ skillId: 'branch-b' }] }),
    );
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: 'branch-b', dependencies: [{ skillId: 'branch-c' }] }),
    );
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: 'branch-c', dependencies: [{ skillId: 'branch-d' }] }),
    );
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: 'branch-d', dependencies: [{ skillId: 'branch-e' }] }),
    );
    createSkillOnDisk(
      tempDir,
      makeManifest({ id: 'branch-e', dependencies: [{ skillId: 'branch-b' }] }),
    );

    await registry.discover([tempDir]);
    for (const id of ['branch-a', 'branch-b', 'branch-c', 'branch-d', 'branch-e']) {
      await registry.validate(id);
    }

    let circularFound = false;
    for (const id of ['branch-a', 'branch-b', 'branch-c', 'branch-d', 'branch-e']) {
      try {
        await registry.load(id);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('Circular dependency')) {
          circularFound = true;
        }
      }
    }
    expect(circularFound).toBe(true);
  });
});

// ── Concurrent Reload During Active Use ──────────────────────────

describe('concurrent reload during active use', () => {
  let registry: SkillRegistryImpl;

  beforeEach(() => {
    registry = new SkillRegistryImpl();
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reload properly deactivates all agents before reloading', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'busy-skill', description: 'v1' }));
    await registry.discoverAndLoadAll([tempDir]);

    // Activate for multiple agents
    await registry.activate('busy-skill', 'agent-1');
    await registry.activate('busy-skill', 'agent-2');
    await registry.activate('busy-skill', 'agent-3');

    expect(registry.get('busy-skill')!.activeAgents.size).toBe(3);

    // Update on disk
    writeFileSync(
      join(tempDir, 'busy-skill', 'manifest.json'),
      JSON.stringify(makeManifest({ id: 'busy-skill', description: 'v2' }), null, 2),
    );

    await registry.reload('busy-skill');

    const entry = registry.get('busy-skill');
    expect(entry).toBeDefined();
    expect(entry!.manifest.description).toBe('v2');
    expect(entry!.activeAgents.size).toBe(0);
    expect(entry!.phase).toBe('loaded');
  });

  it('concurrent reloads do not corrupt state', async () => {
    createSkillOnDisk(tempDir, makeManifest({ id: 'reload-race' }));
    await registry.discoverAndLoadAll([tempDir]);

    // Multiple concurrent reloads — one should succeed, others may fail
    const results = await Promise.allSettled([
      registry.reload('reload-race'),
      registry.reload('reload-race'),
    ]);

    // At least one should succeed
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    // Skill should still exist in some valid state
    const entry = registry.get('reload-race');
    // It either exists and is loaded, or was unloaded by the race
    if (entry) {
      expect(['loaded', 'active', 'deactivated', 'validated', 'discovered']).toContain(
        entry.phase,
      );
    }
  });
});

// ── Manifest with Maximum Field Lengths ──────────────────────────

describe('manifest with maximum field lengths', () => {
  it('accepts manifest with long but valid description', () => {
    const longDesc = 'A'.repeat(1000);
    const result = validateSkillManifest(makeManifest({ description: longDesc }), '/path');
    expect(result.valid).toBe(true);
  });

  it('accepts manifest with many tools', () => {
    const tools = Array.from({ length: 50 }, (_, i) => ({
      toolId: `tool:item-${i}`,
      reason: `Tool ${i}`,
    }));
    const result = validateSkillManifest(makeManifest({ tools }), '/path');
    expect(result.valid).toBe(true);
  });

  it('accepts manifest with many triggers', () => {
    const triggers = Array.from({ length: 20 }, (_, i) => ({
      type: 'task-type' as const,
      taskTypes: [`task-${i}`],
    }));
    const result = validateSkillManifest(makeManifest({ triggers }), '/path');
    expect(result.valid).toBe(true);
  });

  it('accepts manifest with many tags', () => {
    const tags = Array.from({ length: 30 }, (_, i) => `tag-${i}`);
    const result = validateSkillManifest(makeManifest({ tags }), '/path');
    expect(result.valid).toBe(true);
  });

  it('accepts manifest with many config entries', () => {
    const config = Array.from({ length: 25 }, (_, i) => ({
      key: `config-${i}`,
      type: 'string' as const,
      default: `default-${i}`,
    }));
    const result = validateSkillManifest(makeManifest({ config }), '/path');
    expect(result.valid).toBe(true);
  });
});

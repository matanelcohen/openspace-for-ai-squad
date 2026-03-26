/**
 * Unit tests for skill-loader.ts
 *
 * Covers: discoverManifests, validateSkillManifest,
 *         detectCircularDependencies, topologicalSortSkills, resolveManifest
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SkillDependency, SkillManifest } from '@openspace/shared/src/types/skill.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectCircularDependencies,
  discoverManifests,
  resolveManifest,
  topologicalSortSkills,
  validateSkillManifest,
} from '../skill-loader.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    manifestVersion: 1,
    id: 'test-skill',
    name: 'Test Skill',
    version: '1.0.0',
    description: 'A test skill for validation',
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
        content: 'You are {{agent.name}}, a test skill.',
      },
    ],
    triggers: [{ type: 'task-type', taskTypes: ['test-task'] }],
    permissions: ['fs:read'],
    ...overrides,
  } as SkillManifest;
}

let tempDir: string;

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `skill-loader-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeSkillManifest(
  parentDir: string,
  skillId: string,
  manifest: SkillManifest,
  filename = 'manifest.json',
) {
  const skillDir = join(parentDir, skillId);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, filename), JSON.stringify(manifest, null, 2));
}

// ── discoverManifests ────────────────────────────────────────────

describe('discoverManifests', () => {
  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('discovers manifest.json files in subdirectories', () => {
    const m = makeManifest({ id: 'my-skill' });
    writeSkillManifest(tempDir, 'my-skill', m);

    const results = discoverManifests([tempDir]);
    expect(results).toHaveLength(1);
    expect(results[0].manifest.id).toBe('my-skill');
    expect(results[0].sourcePath).toContain('my-skill');
  });

  it('discovers skill.json files', () => {
    const m = makeManifest({ id: 'json-skill' });
    writeSkillManifest(tempDir, 'json-skill', m, 'skill.json');

    const results = discoverManifests([tempDir]);
    expect(results).toHaveLength(1);
    expect(results[0].manifest.id).toBe('json-skill');
  });

  it('discovers skill.yaml files', () => {
    const skillDir = join(tempDir, 'yaml-skill');
    mkdirSync(skillDir, { recursive: true });
    // YAML format
    writeFileSync(
      join(skillDir, 'skill.yaml'),
      `manifestVersion: 1
id: yaml-skill
name: YAML Skill
version: "1.0.0"
description: A YAML skill
tools:
  - toolId: "file:read"
    reason: Read files
prompts:
  - id: system
    name: System
    role: system
    content: "You are {{agent.name}}"
triggers:
  - type: task-type
    taskTypes:
      - yaml-task`,
    );

    const results = discoverManifests([tempDir]);
    expect(results).toHaveLength(1);
    expect(results[0].manifest.id).toBe('yaml-skill');
  });

  it('discovers multiple skills across multiple directories', () => {
    const dir2 = createTempDir();
    try {
      writeSkillManifest(tempDir, 'skill-a', makeManifest({ id: 'skill-a' }));
      writeSkillManifest(dir2, 'skill-b', makeManifest({ id: 'skill-b' }));

      const results = discoverManifests([tempDir, dir2]);
      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.manifest.id).sort();
      expect(ids).toEqual(['skill-a', 'skill-b']);
    } finally {
      rmSync(dir2, { recursive: true, force: true });
    }
  });

  it('returns empty array for nonexistent directories', () => {
    const results = discoverManifests(['/nonexistent/path/12345']);
    expect(results).toEqual([]);
  });

  it('returns empty array for empty directories', () => {
    const results = discoverManifests([tempDir]);
    expect(results).toEqual([]);
  });

  it('skips regular files at directory level', () => {
    writeFileSync(join(tempDir, 'not-a-dir.json'), '{}');
    const results = discoverManifests([tempDir]);
    expect(results).toEqual([]);
  });

  it('handles malformed JSON by creating stub manifest', () => {
    const skillDir = join(tempDir, 'bad-json');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'manifest.json'), '{not valid json!!!');

    const results = discoverManifests([tempDir]);
    expect(results).toHaveLength(1);
    // Stub manifest with just the directory name as ID
    expect(results[0].manifest.id).toBe('bad-json');
  });

  it('takes only the first manifest file per skill directory', () => {
    const skillDir = join(tempDir, 'multi-manifest');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'skill.json'),
      JSON.stringify(makeManifest({ id: 'from-skill-json' })),
    );
    writeFileSync(
      join(skillDir, 'manifest.json'),
      JSON.stringify(makeManifest({ id: 'from-manifest-json' })),
    );

    const results = discoverManifests([tempDir]);
    expect(results).toHaveLength(1);
    // skill.json comes first in MANIFEST_FILENAMES
    expect(results[0].manifest.id).toBe('from-skill-json');
  });
});

// ── validateSkillManifest ────────────────────────────────────────

describe('validateSkillManifest', () => {
  it('validates a correct manifest', () => {
    const result = validateSkillManifest(makeManifest(), '/fake/path');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects manifest missing required fields', () => {
    const badManifest = { id: 'incomplete' } as SkillManifest;
    const result = validateSkillManifest(badManifest, '/fake/path');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === 'SCHEMA_ERROR')).toBe(true);
  });

  it('rejects invalid manifest ID format', () => {
    const result = validateSkillManifest(makeManifest({ id: 'INVALID_ID!!!' }), '/fake/path');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SCHEMA_ERROR')).toBe(true);
  });

  it('rejects manifest ID that is too short', () => {
    const result = validateSkillManifest(makeManifest({ id: 'ab' }), '/fake/path');
    expect(result.valid).toBe(false);
  });

  it('rejects invalid version format', () => {
    const result = validateSkillManifest(makeManifest({ version: 'not-a-version' }), '/fake/path');
    expect(result.valid).toBe(false);
  });

  it('rejects empty name', () => {
    const result = validateSkillManifest(makeManifest({ name: '' }), '/fake/path');
    expect(result.valid).toBe(false);
  });

  it('rejects empty tools array', () => {
    const result = validateSkillManifest(makeManifest({ tools: [] }), '/fake/path');
    expect(result.valid).toBe(false);
  });

  it('rejects empty prompts array', () => {
    const result = validateSkillManifest(makeManifest({ prompts: [] }), '/fake/path');
    expect(result.valid).toBe(false);
  });

  it('rejects empty triggers array', () => {
    const result = validateSkillManifest(makeManifest({ triggers: [] }), '/fake/path');
    expect(result.valid).toBe(false);
  });

  it('rejects wrong manifestVersion', () => {
    const result = validateSkillManifest(
      makeManifest({ manifestVersion: 2 as unknown as 1 }),
      '/fake/path',
    );
    expect(result.valid).toBe(false);
  });

  it('detects duplicate skill IDs', () => {
    const knownIds = new Set(['test-skill']);
    const result = validateSkillManifest(
      makeManifest({ id: 'test-skill' }),
      '/fake/path',
      knownIds,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('detects duplicate prompt IDs within a skill', () => {
    const result = validateSkillManifest(
      makeManifest({
        prompts: [
          { id: 'dupe', name: 'First', role: 'system', content: 'content1' },
          { id: 'dupe', name: 'Second', role: 'execution', content: 'content2' },
        ],
      }),
      '/fake/path',
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_PROMPT_ID')).toBe(true);
  });

  it('rejects path traversal in entryPoint', () => {
    const result = validateSkillManifest(
      makeManifest({ entryPoint: '../../../etc/passwd' }),
      '/fake/path',
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNSAFE_ENTRY_POINT')).toBe(true);
  });

  it('allows safe entryPoint', () => {
    const result = validateSkillManifest(makeManifest({ entryPoint: './hooks.js' }), '/fake/path');
    expect(result.valid).toBe(true);
  });

  it('warns about missing author', () => {
    const m = makeManifest();
    delete (m as Record<string, unknown>).author;
    const result = validateSkillManifest(m, '/fake/path');
    expect(result.warnings.some((w) => w.path === '/author')).toBe(true);
  });

  it('warns about missing tags', () => {
    const m = makeManifest({ tags: [] });
    const result = validateSkillManifest(m, '/fake/path');
    expect(result.warnings.some((w) => w.path === '/tags')).toBe(true);
  });

  it('rejects invalid trigger type', () => {
    const result = validateSkillManifest(
      makeManifest({
        triggers: [{ type: 'invalid-type' } as unknown as SkillManifest['triggers'][number]],
      }),
      '/fake/path',
    );
    expect(result.valid).toBe(false);
  });

  it('rejects invalid permission format', () => {
    const result = validateSkillManifest(
      makeManifest({
        permissions: [
          'INVALID!!!' as unknown as SkillManifest['permissions'] extends (infer T)[] | undefined
            ? T
            : never,
        ],
      }),
      '/fake/path',
    );
    expect(result.valid).toBe(false);
  });

  it('rejects additional properties', () => {
    const m = makeManifest();
    (m as Record<string, unknown>).unknownField = 'unexpected';
    const result = validateSkillManifest(m, '/fake/path');
    expect(result.valid).toBe(false);
  });
});

// ── detectCircularDependencies ───────────────────────────────────

describe('detectCircularDependencies', () => {
  it('returns null when there are no dependencies', () => {
    const deps = new Map<string, SkillDependency[]>();
    expect(detectCircularDependencies('skill-a', deps)).toBeNull();
  });

  it('returns null for a linear dependency chain', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['skill-a', [{ skillId: 'skill-b' }]],
      ['skill-b', [{ skillId: 'skill-c' }]],
    ]);
    expect(detectCircularDependencies('skill-a', deps)).toBeNull();
  });

  it('detects a direct circular dependency (A → B → A)', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['skill-a', [{ skillId: 'skill-b' }]],
      ['skill-b', [{ skillId: 'skill-a' }]],
    ]);
    const cycle = detectCircularDependencies('skill-a', deps);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('skill-a');
    expect(cycle).toContain('skill-b');
  });

  it('detects a transitive circular dependency (A → B → C → A)', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['skill-a', [{ skillId: 'skill-b' }]],
      ['skill-b', [{ skillId: 'skill-c' }]],
      ['skill-c', [{ skillId: 'skill-a' }]],
    ]);
    const cycle = detectCircularDependencies('skill-a', deps);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(3);
  });

  it('detects a self-referential dependency', () => {
    const deps = new Map<string, SkillDependency[]>([['skill-a', [{ skillId: 'skill-a' }]]]);
    const cycle = detectCircularDependencies('skill-a', deps);
    expect(cycle).not.toBeNull();
  });

  it('does not false-positive on diamond dependencies', () => {
    // A → B, A → C, B → D, C → D (no cycle)
    const deps = new Map<string, SkillDependency[]>([
      ['skill-a', [{ skillId: 'skill-b' }, { skillId: 'skill-c' }]],
      ['skill-b', [{ skillId: 'skill-d' }]],
      ['skill-c', [{ skillId: 'skill-d' }]],
    ]);
    expect(detectCircularDependencies('skill-a', deps)).toBeNull();
  });
});

// ── topologicalSortSkills ────────────────────────────────────────

describe('topologicalSortSkills', () => {
  it('returns skills in dependency order', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['app', [{ skillId: 'lib' }]],
      ['lib', [{ skillId: 'core' }]],
    ]);
    const sorted = topologicalSortSkills(['app', 'lib', 'core'], deps);
    expect(sorted.indexOf('core')).toBeLessThan(sorted.indexOf('lib'));
    expect(sorted.indexOf('lib')).toBeLessThan(sorted.indexOf('app'));
  });

  it('returns input order when no dependencies', () => {
    const deps = new Map<string, SkillDependency[]>();
    const sorted = topologicalSortSkills(['skill-a', 'skill-b', 'skill-c'], deps);
    expect(sorted).toEqual(['skill-a', 'skill-b', 'skill-c']);
  });

  it('handles diamond dependencies', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['app', [{ skillId: 'ui' }, { skillId: 'api' }]],
      ['ui', [{ skillId: 'core' }]],
      ['api', [{ skillId: 'core' }]],
    ]);
    const sorted = topologicalSortSkills(['app', 'ui', 'api', 'core'], deps);
    expect(sorted.indexOf('core')).toBeLessThan(sorted.indexOf('ui'));
    expect(sorted.indexOf('core')).toBeLessThan(sorted.indexOf('api'));
    expect(sorted.indexOf('ui')).toBeLessThan(sorted.indexOf('app'));
    expect(sorted.indexOf('api')).toBeLessThan(sorted.indexOf('app'));
  });

  it('ignores dependencies not in the skill list', () => {
    const deps = new Map<string, SkillDependency[]>([['skill-a', [{ skillId: 'external-skill' }]]]);
    const sorted = topologicalSortSkills(['skill-a'], deps);
    expect(sorted).toEqual(['skill-a']);
  });

  it('handles single skill', () => {
    expect(topologicalSortSkills(['solo'], new Map())).toEqual(['solo']);
  });

  it('handles empty input', () => {
    expect(topologicalSortSkills([], new Map())).toEqual([]);
  });
});

// ── resolveManifest ──────────────────────────────────────────────

describe('resolveManifest', () => {
  it('creates a resolved manifest with tool availability', () => {
    const manifest = makeManifest({
      tools: [
        { toolId: 'file:read', reason: 'Read files' },
        { toolId: 'git:diff', reason: 'View diffs' },
      ],
    });
    const resolved = resolveManifest(manifest, '/test/path/manifest.json', new Map());

    expect(resolved.sourcePath).toBe('/test/path/manifest.json');
    expect(resolved.toolAvailability['file:read']).toBe(true);
    expect(resolved.toolAvailability['git:diff']).toBe(true);
    expect(resolved.resolvedDependencies).toEqual({});
  });

  it('resolves dependencies from loaded manifests', () => {
    const depManifest = makeManifest({ id: 'dep-skill', version: '2.0.0' });
    const manifest = makeManifest({
      dependencies: [{ skillId: 'dep-skill', versionRange: '^2.0.0' }],
    });
    const loaded = new Map<string, SkillManifest>([['dep-skill', depManifest]]);

    const resolved = resolveManifest(manifest, '/test/manifest.json', loaded);
    expect(resolved.resolvedDependencies['dep-skill']).toBe('2.0.0');
  });

  it('does not include unloaded dependencies', () => {
    const manifest = makeManifest({
      dependencies: [{ skillId: 'missing-skill' }],
    });
    const resolved = resolveManifest(manifest, '/test/manifest.json', new Map());
    expect(resolved.resolvedDependencies).toEqual({});
  });

  it('spreads original manifest properties', () => {
    const manifest = makeManifest({ id: 'spread-test', name: 'Spread Test' });
    const resolved = resolveManifest(manifest, '/path', new Map());
    expect(resolved.id).toBe('spread-test');
    expect(resolved.name).toBe('Spread Test');
    expect(resolved.manifestVersion).toBe(1);
  });
});

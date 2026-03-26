/**
 * Unit tests for skill-loader.ts
 *
 * Covers: discoverManifests, validateSkillManifest,
 *         detectCircularDependencies, topologicalSortSkills, resolveManifest
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SkillDependency, SkillManifest } from '@openspace/shared/src/types/skill.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectCircularDependencies,
  discoverManifests,
  resolveManifest,
  topologicalSortSkills,
  validateSkillManifest,
} from '../skill-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

// ── Reference Skill Manifests ────────────────────────────────────

describe('reference skill manifest validation', () => {
  const SKILLS_CORE_DIR = join(
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

  function loadRealManifest(skillId: string): SkillManifest {
    const manifestPath = join(SKILLS_CORE_DIR, skillId, 'manifest.json');
    const raw = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw) as SkillManifest;
  }

  it('git-expert manifest passes schema validation', () => {
    const manifest = loadRealManifest('git-expert');
    const result = validateSkillManifest(manifest, '/ref/git-expert/manifest.json');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('code-reviewer manifest passes schema validation', () => {
    const manifest = loadRealManifest('code-reviewer');
    const result = validateSkillManifest(manifest, '/ref/code-reviewer/manifest.json');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('test-runner manifest passes schema validation', () => {
    const manifest = loadRealManifest('test-runner');
    const result = validateSkillManifest(manifest, '/ref/test-runner/manifest.json');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('all 3 reference manifests have unique IDs', () => {
    const ids = ['git-expert', 'code-reviewer', 'test-runner'].map(
      (id) => loadRealManifest(id).id,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('code-reviewer optional dependency on git-expert resolves correctly', () => {
    const crManifest = loadRealManifest('code-reviewer');
    const geManifest = loadRealManifest('git-expert');

    expect(crManifest.dependencies).toBeDefined();
    const gitDep = crManifest.dependencies!.find((d) => d.skillId === 'git-expert');
    expect(gitDep).toBeDefined();
    expect(gitDep!.optional).toBe(true);

    const loaded = new Map<string, SkillManifest>([['git-expert', geManifest]]);
    const resolved = resolveManifest(crManifest, '/ref/code-reviewer/manifest.json', loaded);
    expect(resolved.resolvedDependencies['git-expert']).toBe(geManifest.version);
  });

  it('code-reviewer resolves without git-expert (optional dep missing)', () => {
    const crManifest = loadRealManifest('code-reviewer');
    const resolved = resolveManifest(crManifest, '/ref/code-reviewer/manifest.json', new Map());
    expect(resolved.resolvedDependencies).toEqual({});
  });

  it('reference manifests all have semver versions', () => {
    for (const id of ['git-expert', 'code-reviewer', 'test-runner']) {
      const manifest = loadRealManifest(id);
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('reference manifests all have system prompts', () => {
    for (const id of ['git-expert', 'code-reviewer', 'test-runner']) {
      const manifest = loadRealManifest(id);
      const system = manifest.prompts.find((p) => p.role === 'system');
      expect(system).toBeDefined();
      expect(system!.content).toContain('{{agent.name}}');
    }
  });

  it('all reference manifests are discoverable from skills-core/src', () => {
    const discovered = discoverManifests([SKILLS_CORE_DIR]);
    const ids = discovered.map((d) => d.manifest.id).sort();
    expect(ids).toContain('git-expert');
    expect(ids).toContain('code-reviewer');
    expect(ids).toContain('test-runner');
  });
});

// ── Manifest ID Validation Edge Cases ────────────────────────────

describe('manifest ID validation edge cases', () => {
  it('rejects ID starting with a digit', () => {
    const result = validateSkillManifest(makeManifest({ id: '1bad-id' }), '/path');
    expect(result.valid).toBe(false);
  });

  it('rejects ID containing uppercase letters', () => {
    const result = validateSkillManifest(makeManifest({ id: 'Bad-Id' }), '/path');
    expect(result.valid).toBe(false);
  });

  it('rejects ID with underscores', () => {
    const result = validateSkillManifest(makeManifest({ id: 'bad_id_here' }), '/path');
    expect(result.valid).toBe(false);
  });

  it('rejects ID with spaces', () => {
    const result = validateSkillManifest(makeManifest({ id: 'bad id' }), '/path');
    expect(result.valid).toBe(false);
  });

  it('rejects ID with special characters', () => {
    const result = validateSkillManifest(makeManifest({ id: 'bad@id!' }), '/path');
    expect(result.valid).toBe(false);
  });

  it('accepts ID with only lowercase and hyphens', () => {
    const result = validateSkillManifest(makeManifest({ id: 'good-skill-id' }), '/path');
    expect(result.valid).toBe(true);
  });

  it('accepts ID with digits after first char', () => {
    const result = validateSkillManifest(makeManifest({ id: 'skill-v2-beta' }), '/path');
    expect(result.valid).toBe(true);
  });

  it('rejects empty ID', () => {
    const result = validateSkillManifest(makeManifest({ id: '' }), '/path');
    expect(result.valid).toBe(false);
  });
});

// ── Prompt Role Enum Validation ──────────────────────────────────

describe('prompt role validation', () => {
  const validRoles = ['system', 'planning', 'execution', 'review', 'error', 'handoff'] as const;

  it.each(validRoles)('accepts prompt with role "%s"', (role) => {
    const result = validateSkillManifest(
      makeManifest({
        prompts: [{ id: `${role}-prompt`, name: `${role} Prompt`, role, content: 'test' }],
      }),
      '/path',
    );
    expect(result.valid).toBe(true);
  });

  it('rejects prompt with invalid role', () => {
    const result = validateSkillManifest(
      makeManifest({
        prompts: [
          {
            id: 'bad-role',
            name: 'Bad Role',
            role: 'invalid-role' as 'system',
            content: 'test',
          },
        ],
      }),
      '/path',
    );
    expect(result.valid).toBe(false);
  });
});

// ── YAML Discovery Edge Cases ────────────────────────────────────

describe('YAML manifest edge cases', () => {
  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('discovers .yml extension', () => {
    const skillDir = join(tempDir, 'yml-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'skill.yml'),
      `manifestVersion: 1
id: yml-skill
name: YML Skill
version: "1.0.0"
description: A YML skill
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
      - yml-task`,
    );

    const results = discoverManifests([tempDir]);
    expect(results).toHaveLength(1);
    expect(results[0].manifest.id).toBe('yml-skill');
  });

  it('handles YAML with multi-line strings', () => {
    const skillDir = join(tempDir, 'multiline-yaml');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'skill.yaml'),
      `manifestVersion: 1
id: multiline-yaml
name: Multiline YAML
version: "1.0.0"
description: >
  A skill with a very long
  description that spans
  multiple lines
tools:
  - toolId: "file:read"
    reason: Read files
prompts:
  - id: system
    name: System
    role: system
    content: |
      You are {{agent.name}}.
      You are a multiline prompt test.
triggers:
  - type: task-type
    taskTypes:
      - multiline-task`,
    );

    const results = discoverManifests([tempDir]);
    expect(results).toHaveLength(1);
    expect(results[0].manifest.id).toBe('multiline-yaml');
    expect(results[0].manifest.description).toContain('multiple lines');
  });

  it('handles malformed YAML gracefully', () => {
    const skillDir = join(tempDir, 'bad-yaml');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'skill.yaml'), 'this: is: not: valid: yaml: [[[');

    const results = discoverManifests([tempDir]);
    expect(results).toHaveLength(1);
    // Stub manifest
    expect(results[0].manifest.id).toBe('bad-yaml');
  });
});

// ── Manifest with All Optional Fields ────────────────────────────

describe('manifest with all optional fields', () => {
  it('validates a manifest with every optional field populated', () => {
    const fullManifest = makeManifest({
      id: 'full-manifest',
      author: 'test-author',
      license: 'Apache-2.0',
      homepage: 'https://example.com/skill',
      tags: ['code-analysis', 'security', 'testing'],
      icon: 'shield',
      dependencies: [
        { skillId: 'git-expert', versionRange: '^1.0.0', optional: true },
      ],
      config: [
        { key: 'timeout', type: 'number', default: 30 },
        { key: 'verbose', type: 'boolean', default: false },
        { key: 'mode', type: 'string', default: 'standard' },
      ],
      entryPoint: './hooks.js',
      permissions: ['fs:read', 'fs:write', 'net:outbound', 'exec:shell'],
    });

    const result = validateSkillManifest(fullManifest, '/path');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

// ── Topological Sort Edge Cases ──────────────────────────────────

describe('topologicalSortSkills edge cases', () => {
  it('handles deep linear chain (10 levels)', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `skill-${i}`);
    const deps = new Map<string, SkillDependency[]>();
    for (let i = 0; i < ids.length - 1; i++) {
      deps.set(ids[i], [{ skillId: ids[i + 1] }]);
    }

    const sorted = topologicalSortSkills(ids, deps);
    // The deepest dependency should come first
    expect(sorted[0]).toBe('skill-9');
    expect(sorted[sorted.length - 1]).toBe('skill-0');
  });

  it('handles multiple independent subgraphs', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['app-a', [{ skillId: 'lib-a' }]],
      ['app-b', [{ skillId: 'lib-b' }]],
    ]);
    const sorted = topologicalSortSkills(['app-a', 'lib-a', 'app-b', 'lib-b'], deps);
    expect(sorted.indexOf('lib-a')).toBeLessThan(sorted.indexOf('app-a'));
    expect(sorted.indexOf('lib-b')).toBeLessThan(sorted.indexOf('app-b'));
  });

  it('handles skill with multiple dependencies', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['top', [{ skillId: 'mid-a' }, { skillId: 'mid-b' }, { skillId: 'mid-c' }]],
    ]);
    const sorted = topologicalSortSkills(['top', 'mid-a', 'mid-b', 'mid-c'], deps);
    expect(sorted.indexOf('top')).toBe(sorted.length - 1);
  });
});

// ── Circular Dependency Edge Cases ───────────────────────────────

describe('detectCircularDependencies edge cases', () => {
  it('detects 4-node cycle (A → B → C → D → A)', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['a', [{ skillId: 'b' }]],
      ['b', [{ skillId: 'c' }]],
      ['c', [{ skillId: 'd' }]],
      ['d', [{ skillId: 'a' }]],
    ]);
    const cycle = detectCircularDependencies('a', deps);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('a');
    expect(cycle).toContain('d');
  });

  it('detects cycle in one branch but not another', () => {
    const deps = new Map<string, SkillDependency[]>([
      ['root', [{ skillId: 'safe' }, { skillId: 'cycle-start' }]],
      ['cycle-start', [{ skillId: 'cycle-end' }]],
      ['cycle-end', [{ skillId: 'cycle-start' }]],
    ]);
    const cycle = detectCircularDependencies('root', deps);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('cycle-start');
    expect(cycle).toContain('cycle-end');
  });

  it('handles empty dependency map', () => {
    expect(detectCircularDependencies('solo', new Map())).toBeNull();
  });

  it('handles skill not in dependency map', () => {
    const deps = new Map<string, SkillDependency[]>([['other', [{ skillId: 'another' }]]]);
    expect(detectCircularDependencies('missing', deps)).toBeNull();
  });
});

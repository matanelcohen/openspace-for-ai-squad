/**
 * Unit tests for skill-router.ts
 *
 * Covers: matchTaskToSkills with all trigger types, confidence scoring,
 *         sorting, composite triggers, edge cases.
 */
import type {
  ResolvedSkillManifest,
  SkillRegistryEntry,
  SkillTaskContext,
  SkillTrigger,
} from '@openspace/shared/src/types/skill.js';
import { describe, expect, it } from 'vitest';

import { matchTaskToSkills } from '../skill-router.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeEntry(
  id: string,
  triggers: SkillTrigger[],
  phase: SkillRegistryEntry['phase'] = 'loaded',
): SkillRegistryEntry {
  return {
    manifest: {
      manifestVersion: 1,
      id,
      name: id,
      version: '1.0.0',
      description: `Skill ${id}`,
      tools: [{ toolId: 'file:read', reason: 'test' }],
      prompts: [{ id: 'system', name: 'System', role: 'system', content: 'test' }],
      triggers,
      sourcePath: `/fake/${id}/manifest.json`,
      resolvedDependencies: {},
      toolAvailability: {},
    } as ResolvedSkillManifest,
    phase,
    hooks: null,
    activeAgents: new Set(),
    lastTransition: Date.now(),
  };
}

function makeTask(overrides: Partial<SkillTaskContext> = {}): SkillTaskContext {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task description',
    labels: [],
    priority: 'medium',
    ...overrides,
  };
}

// ── Task-Type Trigger ────────────────────────────────────────────

describe('task-type trigger', () => {
  it('matches when task metadata has matching taskType', () => {
    const entries = [makeEntry('git-expert', [{ type: 'task-type', taskTypes: ['git-analysis'] }])];
    const task = makeTask({ metadata: { taskType: 'git-analysis' }, labels: [] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].skillId).toBe('git-expert');
    expect(results[0].confidence).toBe(0.9);
  });

  it('matches when labels include the task type', () => {
    const entries = [makeEntry('git-expert', [{ type: 'task-type', taskTypes: ['git-analysis'] }])];
    const task = makeTask({ labels: ['git-analysis'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.9);
  });

  it('matches case-insensitively', () => {
    const entries = [makeEntry('git-expert', [{ type: 'task-type', taskTypes: ['Git-Analysis'] }])];
    const task = makeTask({ labels: ['GIT-ANALYSIS'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
  });

  it('does not match when no task types align', () => {
    const entries = [makeEntry('git-expert', [{ type: 'task-type', taskTypes: ['git-analysis'] }])];
    const task = makeTask({ labels: ['code-review'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });
});

// ── Label Trigger ────────────────────────────────────────────────

describe('label trigger', () => {
  it('matches when all required labels are present', () => {
    const entries = [
      makeEntry('reviewer', [{ type: 'label', labels: ['needs-review', 'security'] }]),
    ];
    const task = makeTask({ labels: ['needs-review', 'security', 'extra-label'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.8);
  });

  it('does not match when some labels are missing', () => {
    const entries = [
      makeEntry('reviewer', [{ type: 'label', labels: ['needs-review', 'security'] }]),
    ];
    const task = makeTask({ labels: ['needs-review'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });

  it('matches case-insensitively', () => {
    const entries = [makeEntry('reviewer', [{ type: 'label', labels: ['NEEDS-REVIEW'] }])];
    const task = makeTask({ labels: ['needs-review'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
  });
});

// ── Pattern Trigger ──────────────────────────────────────────────

describe('pattern trigger', () => {
  it('matches title pattern', () => {
    const entries = [
      makeEntry('git-expert', [
        {
          type: 'pattern',
          titlePattern: '\\b(commit|diff|blame)\\b',
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'Review the latest commit' });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.7);
  });

  it('matches description pattern', () => {
    const entries = [
      makeEntry('git-expert', [
        {
          type: 'pattern',
          descriptionPattern: 'git\\s+history',
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ description: 'Analyze the git history for regressions' });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
  });

  it('matches field+pattern form from manifests', () => {
    const entries = [
      makeEntry('git-expert', [
        {
          type: 'pattern',
          field: 'title',
          pattern: '\\bcommit\\b',
          flags: 'i',
        } as unknown as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'Analyze this COMMIT message' });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
  });

  it('does not match when patterns do not match', () => {
    const entries = [
      makeEntry('git-expert', [
        {
          type: 'pattern',
          titlePattern: '\\bcommit\\b',
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'Fix the CSS styling issue' });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });

  it('handles invalid regex gracefully', () => {
    const entries = [
      makeEntry('bad-regex', [
        {
          type: 'pattern',
          titlePattern: '[invalid(regex',
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'anything' });

    // Should not throw, just not match
    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });
});

// ── File Trigger ─────────────────────────────────────────────────

describe('file trigger', () => {
  it('matches when task files match glob patterns', () => {
    const entries = [
      makeEntry('test-runner', [{ type: 'file', globs: ['**/*.test.ts', '**/*.spec.ts'] }]),
    ];
    const task = makeTask({ files: ['src/utils/parser.test.ts'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.6);
  });

  it('does not match when no files match', () => {
    const entries = [makeEntry('test-runner', [{ type: 'file', globs: ['**/*.test.ts'] }])];
    const task = makeTask({ files: ['src/main.ts'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });

  it('does not match when task has no files', () => {
    const entries = [makeEntry('test-runner', [{ type: 'file', globs: ['**/*.test.ts'] }])];
    const task = makeTask({ files: [] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });

  it('does not match when files is undefined', () => {
    const entries = [makeEntry('test-runner', [{ type: 'file', globs: ['**/*.test.ts'] }])];
    const task = makeTask();
    delete task.files;

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });
});

// ── Composite Trigger ────────────────────────────────────────────

describe('composite trigger', () => {
  it('AND: matches when all sub-triggers match', () => {
    const entries = [
      makeEntry('composite-and', [
        {
          type: 'composite',
          operator: 'and',
          triggers: [
            { type: 'task-type', taskTypes: ['code-review'] },
            { type: 'label', labels: ['security'] },
          ],
        },
      ]),
    ];
    const task = makeTask({
      labels: ['code-review', 'security'],
      metadata: { taskType: 'code-review' },
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    // AND uses min confidence: min(0.9, 0.8) = 0.8
    expect(results[0].confidence).toBe(0.8);
  });

  it('AND: does not match when one sub-trigger fails', () => {
    const entries = [
      makeEntry('composite-and', [
        {
          type: 'composite',
          operator: 'and',
          triggers: [
            { type: 'task-type', taskTypes: ['code-review'] },
            { type: 'label', labels: ['security'] },
          ],
        },
      ]),
    ];
    const task = makeTask({
      metadata: { taskType: 'code-review' },
      labels: [], // missing security label
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });

  it('OR: matches when any sub-trigger matches', () => {
    const entries = [
      makeEntry('composite-or', [
        {
          type: 'composite',
          operator: 'or',
          triggers: [
            { type: 'task-type', taskTypes: ['code-review'] },
            { type: 'label', labels: ['security'] },
          ],
        },
      ]),
    ];
    const task = makeTask({ labels: ['security'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    // OR uses max confidence of matching triggers
    expect(results[0].confidence).toBe(0.8);
  });

  it('OR: does not match when no sub-triggers match', () => {
    const entries = [
      makeEntry('composite-or', [
        {
          type: 'composite',
          operator: 'or',
          triggers: [
            { type: 'task-type', taskTypes: ['code-review'] },
            { type: 'label', labels: ['security'] },
          ],
        },
      ]),
    ];
    const task = makeTask({ labels: ['unrelated'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });
});

// ── Sorting & Multiple Skills ────────────────────────────────────

describe('sorting and multi-skill matching', () => {
  it('sorts results by confidence descending', () => {
    const entries = [
      makeEntry('file-matcher', [{ type: 'file', globs: ['**/*.ts'] }]),
      makeEntry('type-matcher', [{ type: 'task-type', taskTypes: ['analysis'] }]),
      makeEntry('pattern-matcher', [
        {
          type: 'pattern',
          titlePattern: 'analyze',
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({
      title: 'Analyze TypeScript files',
      labels: ['analysis'],
      files: ['src/index.ts'],
    });

    const results = matchTaskToSkills(entries, task);
    expect(results.length).toBeGreaterThanOrEqual(3);

    // Verify sorted: task-type (0.9) > pattern (0.7) > file (0.6)
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].confidence).toBeGreaterThanOrEqual(results[i + 1].confidence);
    }
  });

  it('returns empty array when no skills match', () => {
    const entries = [makeEntry('git-expert', [{ type: 'task-type', taskTypes: ['git-analysis'] }])];
    const task = makeTask({ labels: ['unrelated'] });

    expect(matchTaskToSkills(entries, task)).toEqual([]);
  });

  it('uses OR semantics for multiple triggers on the same skill', () => {
    const entries = [
      makeEntry('git-expert', [
        { type: 'task-type', taskTypes: ['git-analysis'] },
        { type: 'pattern', titlePattern: '\\bcommit\\b' } as SkillTrigger,
      ]),
    ];
    // Only the pattern trigger matches
    const task = makeTask({ title: 'Review this commit', labels: [] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].skillId).toBe('git-expert');
  });

  it('takes the best confidence when multiple triggers match the same skill', () => {
    const entries = [
      makeEntry('git-expert', [
        { type: 'task-type', taskTypes: ['git-analysis'] },
        { type: 'pattern', titlePattern: '\\bcommit\\b' } as SkillTrigger,
      ]),
    ];
    const task = makeTask({
      title: 'Review this commit',
      labels: ['git-analysis'],
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    // Should use the highest confidence (task-type = 0.9)
    expect(results[0].confidence).toBe(0.9);
  });
});

// ── Phase Filtering ──────────────────────────────────────────────

describe('phase filtering', () => {
  it('only matches skills in loaded/active/deactivated phases', () => {
    const entries = [
      makeEntry('loaded-skill', [{ type: 'task-type', taskTypes: ['test'] }], 'loaded'),
      makeEntry('active-skill', [{ type: 'task-type', taskTypes: ['test'] }], 'active'),
      makeEntry('deactivated-skill', [{ type: 'task-type', taskTypes: ['test'] }], 'deactivated'),
      makeEntry('discovered-skill', [{ type: 'task-type', taskTypes: ['test'] }], 'discovered'),
      makeEntry('validated-skill', [{ type: 'task-type', taskTypes: ['test'] }], 'validated'),
      makeEntry('error-skill', [{ type: 'task-type', taskTypes: ['test'] }], 'error'),
    ];
    const task = makeTask({ labels: ['test'] });

    const results = matchTaskToSkills(entries, task);
    const matchedIds = results.map((r) => r.skillId);
    expect(matchedIds).toContain('loaded-skill');
    expect(matchedIds).toContain('active-skill');
    expect(matchedIds).toContain('deactivated-skill');
    expect(matchedIds).not.toContain('discovered-skill');
    expect(matchedIds).not.toContain('validated-skill');
    expect(matchedIds).not.toContain('error-skill');
  });
});

// ── Unknown Trigger Type ─────────────────────────────────────────

describe('unknown trigger type', () => {
  it('ignores unknown trigger types', () => {
    const entries = [
      makeEntry('unknown-trigger', [{ type: 'future-trigger' } as unknown as SkillTrigger]),
    ];
    const task = makeTask({ labels: ['anything'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });
});

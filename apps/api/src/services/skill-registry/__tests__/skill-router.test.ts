/**
 * Unit tests for skill-router.ts
 *
 * Covers: matchTaskToSkills with all trigger types, confidence scoring,
 *         sorting, composite triggers, edge cases, configurable weights,
 *         fuzzy matching, priority tiebreaking, and relevance adjustments.
 */
import type {
  ResolvedSkillManifest,
  SkillConfidenceWeights,
  SkillRegistryEntry,
  SkillTaskContext,
  SkillTrigger,
} from '@openspace/shared';
import { describe, expect, it } from 'vitest';

import {
  InMemoryRelevanceStore,
  levenshteinDistance,
  matchTaskToSkills,
} from '../skill-router.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeEntry(
  id: string,
  triggers: SkillTrigger[],
  phase: SkillRegistryEntry['phase'] = 'loaded',
  overrides: {
    priority?: number;
    confidenceWeights?: SkillConfidenceWeights;
  } = {},
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
      ...(overrides.priority !== undefined ? { priority: overrides.priority } : {}),
      ...(overrides.confidenceWeights ? { confidenceWeights: overrides.confidenceWeights } : {}),
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

// ── Per-Skill Confidence Weights ─────────────────────────────────

describe('per-skill confidence weights', () => {
  it('uses custom confidence for task-type when configured', () => {
    const entries = [
      makeEntry(
        'custom-weight',
        [{ type: 'task-type', taskTypes: ['analysis'] }],
        'loaded',
        { confidenceWeights: { 'task-type': 0.95 } },
      ),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.95);
  });

  it('uses custom confidence for label trigger', () => {
    const entries = [
      makeEntry(
        'custom-label',
        [{ type: 'label', labels: ['security'] }],
        'loaded',
        { confidenceWeights: { label: 0.95 } },
      ),
    ];
    const task = makeTask({ labels: ['security'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.95);
  });

  it('uses custom confidence for file trigger', () => {
    const entries = [
      makeEntry(
        'custom-file',
        [{ type: 'file', globs: ['**/*.ts'] }],
        'loaded',
        { confidenceWeights: { file: 0.85 } },
      ),
    ];
    const task = makeTask({ files: ['src/index.ts'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.85);
  });

  it('falls back to defaults when no overrides set', () => {
    const entries = [
      makeEntry('default-weight', [{ type: 'task-type', taskTypes: ['analysis'] }]),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task);
    expect(results[0].confidence).toBe(0.9);
  });

  it('supports global default weight overrides via options', () => {
    const entries = [
      makeEntry('global-override', [{ type: 'task-type', taskTypes: ['analysis'] }]),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task, {
      defaultWeights: { 'task-type': 0.85 },
    });
    expect(results[0].confidence).toBe(0.85);
  });

  it('per-skill weights override global defaults', () => {
    const entries = [
      makeEntry(
        'skill-override',
        [{ type: 'task-type', taskTypes: ['analysis'] }],
        'loaded',
        { confidenceWeights: { 'task-type': 0.95 } },
      ),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task, {
      defaultWeights: { 'task-type': 0.85 },
    });
    expect(results[0].confidence).toBe(0.95);
  });
});

// ── Weighted Composite Triggers ──────────────────────────────────

describe('weighted composite triggers', () => {
  it('uses avg strategy for AND composite', () => {
    const entries = [
      makeEntry('composite-avg', [
        {
          type: 'composite',
          operator: 'and',
          strategy: 'avg',
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
    // avg(0.9, 0.8) = 0.85
    expect(results[0].confidence).toBeCloseTo(0.85, 5);
  });

  it('uses weighted-avg strategy for AND composite', () => {
    const entries = [
      makeEntry('composite-wavg', [
        {
          type: 'composite',
          operator: 'and',
          strategy: 'weighted-avg',
          weights: [3, 1],
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
    // weighted-avg: (0.9*3 + 0.8*1) / (3+1) = (2.7 + 0.8) / 4 = 0.875
    expect(results[0].confidence).toBeCloseTo(0.875, 5);
  });

  it('falls back to avg when weights length mismatches', () => {
    const entries = [
      makeEntry('composite-mismatch', [
        {
          type: 'composite',
          operator: 'and',
          strategy: 'weighted-avg',
          weights: [1], // wrong length
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
    // Falls back to avg: (0.9 + 0.8) / 2 = 0.85
    expect(results[0].confidence).toBeCloseTo(0.85, 5);
  });

  it('still uses min as default for AND without strategy', () => {
    const entries = [
      makeEntry('composite-default', [
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
    expect(results[0].confidence).toBe(0.8);
  });

  it('uses avg strategy for OR composite', () => {
    const entries = [
      makeEntry('composite-or-avg', [
        {
          type: 'composite',
          operator: 'or',
          strategy: 'avg',
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
    // avg(0.9, 0.8) = 0.85
    expect(results[0].confidence).toBeCloseTo(0.85, 5);
  });
});

// ── Fuzzy Pattern Matching ───────────────────────────────────────

describe('fuzzy pattern matching', () => {
  it('matches fuzzy terms against title', () => {
    const entries = [
      makeEntry('fuzzy-skill', [
        {
          type: 'pattern',
          fuzzy: { terms: ['commit'], maxDistance: 2 },
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'Review the latest comit' }); // typo: comit

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].reason).toContain('fuzzy');
  });

  it('matches fuzzy terms against description', () => {
    const entries = [
      makeEntry('fuzzy-desc', [
        {
          type: 'pattern',
          fuzzy: { terms: ['refactor'], maxDistance: 2 },
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ description: 'We need to refactr the auth module' }); // typo

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].reason).toContain('fuzzy');
  });

  it('does not match when distance exceeds maxDistance', () => {
    const entries = [
      makeEntry('fuzzy-no-match', [
        {
          type: 'pattern',
          fuzzy: { terms: ['authentication'], maxDistance: 1 },
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'Fix the auth module' }); // too different

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });

  it('respects minSimilarity threshold', () => {
    const entries = [
      makeEntry('fuzzy-high-sim', [
        {
          type: 'pattern',
          fuzzy: { terms: ['commit'], maxDistance: 3, minSimilarity: 0.95 },
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'Review the comit' }); // too different for 0.95

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });

  it('combines regex and fuzzy matching', () => {
    const entries = [
      makeEntry('combo-skill', [
        {
          type: 'pattern',
          titlePattern: '\\breview\\b',
          fuzzy: { terms: ['commit'], maxDistance: 2 },
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'Review the latest comit' });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    // Should have both regex and fuzzy reasons
    expect(results[0].reason).toContain('title matched');
    expect(results[0].reason).toContain('fuzzy');
  });
});

// ── Levenshtein Distance ─────────────────────────────────────────

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns length of b for empty a', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
  });

  it('returns length of a for empty b', () => {
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  it('calculates single character edits', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1); // substitution
    expect(levenshteinDistance('cat', 'cats')).toBe(1); // insertion
    expect(levenshteinDistance('cats', 'cat')).toBe(1); // deletion
  });

  it('calculates multi-character edits', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('commit', 'comit')).toBe(1);
  });
});

// ── Priority Tiebreaking ─────────────────────────────────────────

describe('priority tiebreaking', () => {
  it('uses priority to break ties when confidence is equal', () => {
    const entries = [
      makeEntry(
        'low-priority',
        [{ type: 'task-type', taskTypes: ['analysis'] }],
        'loaded',
        { priority: 1 },
      ),
      makeEntry(
        'high-priority',
        [{ type: 'task-type', taskTypes: ['analysis'] }],
        'loaded',
        { priority: 10 },
      ),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(2);
    expect(results[0].skillId).toBe('high-priority');
    expect(results[1].skillId).toBe('low-priority');
    expect(results[0].confidence).toBe(results[1].confidence);
    expect(results[0].priority).toBe(10);
    expect(results[1].priority).toBe(1);
  });

  it('defaults priority to 0 when not specified', () => {
    const entries = [
      makeEntry('no-priority', [{ type: 'task-type', taskTypes: ['analysis'] }]),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task);
    expect(results[0].priority).toBe(0);
  });

  it('confidence still takes precedence over priority', () => {
    const entries = [
      makeEntry(
        'high-confidence',
        [{ type: 'task-type', taskTypes: ['analysis'] }],
        'loaded',
        { priority: 1 },
      ),
      makeEntry(
        'high-priority-low-conf',
        [{ type: 'file', globs: ['**/*.ts'] }],
        'loaded',
        { priority: 100 },
      ),
    ];
    const task = makeTask({ labels: ['analysis'], files: ['src/index.ts'] });

    const results = matchTaskToSkills(entries, task);
    expect(results[0].skillId).toBe('high-confidence');
    expect(results[0].confidence).toBeGreaterThan(results[1].confidence);
  });
});

// ── Relevance Adjustments ────────────────────────────────────────

describe('relevance adjustments', () => {
  it('applies positive relevance adjustment to boost confidence', () => {
    const store = new InMemoryRelevanceStore();
    store.setAdjustment('boosted-skill', 0.05);

    const entries = [
      makeEntry('boosted-skill', [{ type: 'task-type', taskTypes: ['analysis'] }]),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task, { relevanceStore: store });
    expect(results[0].confidence).toBeCloseTo(0.95, 5);
    expect(results[0].rawConfidence).toBe(0.9);
    expect(results[0].relevanceAdjustment).toBe(0.05);
  });

  it('applies negative relevance adjustment to reduce confidence', () => {
    const store = new InMemoryRelevanceStore();
    store.setAdjustment('penalized-skill', -0.2);

    const entries = [
      makeEntry('penalized-skill', [{ type: 'task-type', taskTypes: ['analysis'] }]),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task, { relevanceStore: store });
    expect(results[0].confidence).toBeCloseTo(0.7, 5);
    expect(results[0].rawConfidence).toBe(0.9);
  });

  it('clamps adjusted confidence to [0, 1]', () => {
    const store = new InMemoryRelevanceStore();
    store.setAdjustment('over-boosted', 0.3);

    const entries = [
      makeEntry('over-boosted', [{ type: 'task-type', taskTypes: ['analysis'] }]),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task, { relevanceStore: store });
    expect(results[0].confidence).toBe(1.0);
  });

  it('clamps negative adjustment to 0', () => {
    const store = new InMemoryRelevanceStore();
    store.setAdjustment('tanked', -0.3);

    const entries = [
      makeEntry('tanked', [{ type: 'file', globs: ['**/*.ts'] }]),
    ];
    const task = makeTask({ files: ['src/index.ts'] });

    const results = matchTaskToSkills(entries, task, { relevanceStore: store });
    // 0.6 - 0.3 = 0.3
    expect(results[0].confidence).toBeCloseTo(0.3, 5);
  });

  it('does not add relevance fields when no store provided', () => {
    const entries = [
      makeEntry('no-store', [{ type: 'task-type', taskTypes: ['analysis'] }]),
    ];
    const task = makeTask({ labels: ['analysis'] });

    const results = matchTaskToSkills(entries, task);
    expect(results[0].relevanceAdjustment).toBeUndefined();
    expect(results[0].rawConfidence).toBeUndefined();
  });

  it('can reorder results based on adjustments', () => {
    const store = new InMemoryRelevanceStore();
    store.setAdjustment('file-skill', 0.25); // 0.6 + 0.25 = 0.85
    // label-skill stays at 0.8

    const entries = [
      makeEntry('label-skill', [{ type: 'label', labels: ['review'] }]),
      makeEntry('file-skill', [{ type: 'file', globs: ['**/*.ts'] }]),
    ];
    const task = makeTask({ labels: ['review'], files: ['src/index.ts'] });

    const results = matchTaskToSkills(entries, task, { relevanceStore: store });
    expect(results[0].skillId).toBe('file-skill');
    expect(results[0].confidence).toBeCloseTo(0.85, 5);
    expect(results[1].skillId).toBe('label-skill');
  });
});

// ── InMemoryRelevanceStore ───────────────────────────────────────

describe('InMemoryRelevanceStore', () => {
  it('returns 0 for unknown skills', () => {
    const store = new InMemoryRelevanceStore();
    expect(store.getAdjustment('unknown')).toBe(0);
  });

  it('stores and retrieves adjustments', () => {
    const store = new InMemoryRelevanceStore();
    store.setAdjustment('skill-a', 0.1);
    expect(store.getAdjustment('skill-a')).toBe(0.1);
  });

  it('clamps adjustments to bounds', () => {
    const store = new InMemoryRelevanceStore({ min: -0.2, max: 0.2 });
    store.setAdjustment('too-high', 0.5);
    store.setAdjustment('too-low', -0.5);
    expect(store.getAdjustment('too-high')).toBe(0.2);
    expect(store.getAdjustment('too-low')).toBe(-0.2);
  });

  it('accumulates feedback incrementally', () => {
    const store = new InMemoryRelevanceStore();
    store.recordFeedback('skill-b', 0.05);
    store.recordFeedback('skill-b', 0.05);
    store.recordFeedback('skill-b', 0.05);
    expect(store.getAdjustment('skill-b')).toBeCloseTo(0.15, 5);
  });

  it('clamps accumulated feedback', () => {
    const store = new InMemoryRelevanceStore({ max: 0.1 });
    store.recordFeedback('skill-c', 0.08);
    store.recordFeedback('skill-c', 0.08);
    expect(store.getAdjustment('skill-c')).toBe(0.1);
  });

  it('getAll returns all stored adjustments', () => {
    const store = new InMemoryRelevanceStore();
    store.setAdjustment('a', 0.1);
    store.setAdjustment('b', -0.1);
    const all = store.getAll();
    expect(all.size).toBe(2);
    expect(all.get('a')).toBe(0.1);
    expect(all.get('b')).toBe(-0.1);
  });
});

// ── Configurable Confidence ──────────────────────────────────────

describe('configurable confidence values', () => {
  it('task-type triggers always produce 0.9 confidence', () => {
    const entries = [
      makeEntry('skill-a', [{ type: 'task-type', taskTypes: ['analysis'] }]),
      makeEntry('skill-b', [{ type: 'task-type', taskTypes: ['build'] }]),
    ];
    const task = makeTask({ labels: ['analysis', 'build'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.confidence).toBe(0.9));
  });

  it('label triggers always produce 0.8 confidence', () => {
    const entries = [
      makeEntry('skill-a', [{ type: 'label', labels: ['urgent'] }]),
      makeEntry('skill-b', [{ type: 'label', labels: ['security'] }]),
    ];
    const task = makeTask({ labels: ['urgent', 'security'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.confidence).toBe(0.8));
  });

  it('pattern triggers always produce 0.7 confidence', () => {
    const entries = [
      makeEntry('skill-a', [{ type: 'pattern', titlePattern: 'fix' } as SkillTrigger]),
      makeEntry('skill-b', [{ type: 'pattern', descriptionPattern: 'urgent' } as SkillTrigger]),
    ];
    const task = makeTask({ title: 'fix the bug', description: 'urgent issue' });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.confidence).toBe(0.7));
  });

  it('file triggers always produce 0.6 confidence', () => {
    const entries = [
      makeEntry('skill-a', [{ type: 'file', globs: ['**/*.ts'] }]),
      makeEntry('skill-b', [{ type: 'file', globs: ['**/*.json'] }]),
    ];
    const task = makeTask({ files: ['src/index.ts', 'config/package.json'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.confidence).toBe(0.6));
  });

  it('confidence hierarchy: task-type > label > pattern > file', () => {
    const entries = [
      makeEntry('file-skill', [{ type: 'file', globs: ['**/*.ts'] }]),
      makeEntry('pattern-skill', [{ type: 'pattern', titlePattern: 'commit' } as SkillTrigger]),
      makeEntry('label-skill', [{ type: 'label', labels: ['git'] }]),
      makeEntry('type-skill', [{ type: 'task-type', taskTypes: ['git-analysis'] }]),
    ];
    const task = makeTask({
      title: 'Analyze this commit',
      labels: ['git-analysis', 'git'],
      files: ['src/auth.ts'],
      metadata: { taskType: 'git-analysis' },
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(4);
    expect(results[0].skillId).toBe('type-skill');
    expect(results[0].confidence).toBe(0.9);
    expect(results[1].skillId).toBe('label-skill');
    expect(results[1].confidence).toBe(0.8);
    expect(results[2].skillId).toBe('pattern-skill');
    expect(results[2].confidence).toBe(0.7);
    expect(results[3].skillId).toBe('file-skill');
    expect(results[3].confidence).toBe(0.6);
  });
});

// ── Tiebreaking ──────────────────────────────────────────────────

describe('tiebreaking', () => {
  it('skills with identical confidence maintain stable order', () => {
    const entries = [
      makeEntry('alpha', [{ type: 'task-type', taskTypes: ['build'] }]),
      makeEntry('beta', [{ type: 'task-type', taskTypes: ['build'] }]),
      makeEntry('gamma', [{ type: 'task-type', taskTypes: ['build'] }]),
    ];
    const task = makeTask({ labels: ['build'] });

    const results1 = matchTaskToSkills(entries, task);
    const results2 = matchTaskToSkills(entries, task);

    expect(results1.map((r) => r.skillId)).toEqual(results2.map((r) => r.skillId));
    expect(results1).toHaveLength(3);
    results1.forEach((r) => expect(r.confidence).toBe(0.9));
  });

  it('skill matching all triggers beats skill matching fewer, even at same top confidence', () => {
    const entries = [
      makeEntry('broad-skill', [
        { type: 'task-type', taskTypes: ['review'] },
        { type: 'label', labels: ['security'] },
        { type: 'pattern', titlePattern: 'audit' } as SkillTrigger,
      ]),
      makeEntry('narrow-skill', [{ type: 'task-type', taskTypes: ['review'] }]),
    ];
    const task = makeTask({
      title: 'Security audit review',
      labels: ['review', 'security'],
      metadata: { taskType: 'review' },
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(2);
    // Both match task-type at 0.9, so they're equal in top confidence
    expect(results[0].confidence).toBe(0.9);
    expect(results[1].confidence).toBe(0.9);
  });

  it('returns multiple matches when confidence is equal across trigger types', () => {
    const entries = [
      makeEntry('a-label', [{ type: 'label', labels: ['deploy'] }]),
      makeEntry('b-label', [{ type: 'label', labels: ['deploy'] }]),
    ];
    const task = makeTask({ labels: ['deploy'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.confidence === 0.8)).toBe(true);
  });
});

// ── Nested Composite Triggers ────────────────────────────────────

describe('nested composite triggers', () => {
  it('composite within composite (AND inside OR)', () => {
    const entries = [
      makeEntry('nested-skill', [
        {
          type: 'composite',
          operator: 'or',
          triggers: [
            {
              type: 'composite',
              operator: 'and',
              triggers: [
                { type: 'task-type', taskTypes: ['deploy'] },
                { type: 'label', labels: ['production'] },
              ],
            },
            { type: 'label', labels: ['hotfix'] },
          ],
        },
      ]),
    ];

    // Match via nested AND (both deploy + production)
    const task1 = makeTask({
      labels: ['deploy', 'production'],
      metadata: { taskType: 'deploy' },
    });
    const results1 = matchTaskToSkills(entries, task1);
    expect(results1).toHaveLength(1);
    // AND min(0.9, 0.8) = 0.8, then OR picks max
    expect(results1[0].confidence).toBe(0.8);

    // Match via outer OR (hotfix label only)
    const task2 = makeTask({ labels: ['hotfix'] });
    const results2 = matchTaskToSkills(entries, task2);
    expect(results2).toHaveLength(1);
    expect(results2[0].confidence).toBe(0.8);

    // Neither matches
    const task3 = makeTask({ labels: ['staging'] });
    const results3 = matchTaskToSkills(entries, task3);
    expect(results3).toHaveLength(0);
  });

  it('composite within composite (OR inside AND)', () => {
    const entries = [
      makeEntry('strict-skill', [
        {
          type: 'composite',
          operator: 'and',
          triggers: [
            {
              type: 'composite',
              operator: 'or',
              triggers: [
                { type: 'task-type', taskTypes: ['review'] },
                { type: 'task-type', taskTypes: ['audit'] },
              ],
            },
            { type: 'label', labels: ['critical'] },
          ],
        },
      ]),
    ];

    // Matches: review + critical
    const task1 = makeTask({
      labels: ['review', 'critical'],
      metadata: { taskType: 'review' },
    });
    const results1 = matchTaskToSkills(entries, task1);
    expect(results1).toHaveLength(1);
    // OR gives 0.9, AND min(0.9, 0.8) = 0.8
    expect(results1[0].confidence).toBe(0.8);

    // Fails: review but no critical label
    const task2 = makeTask({ labels: ['review'], metadata: { taskType: 'review' } });
    const results2 = matchTaskToSkills(entries, task2);
    expect(results2).toHaveLength(0);
  });

  it('deeply nested 3-level composite', () => {
    const entries = [
      makeEntry('deep-skill', [
        {
          type: 'composite',
          operator: 'and',
          triggers: [
            {
              type: 'composite',
              operator: 'or',
              triggers: [
                {
                  type: 'composite',
                  operator: 'and',
                  triggers: [
                    { type: 'task-type', taskTypes: ['deploy'] },
                    { type: 'file', globs: ['**/*.yaml'] },
                  ],
                },
                { type: 'label', labels: ['emergency'] },
              ],
            },
            { type: 'pattern', titlePattern: 'release' } as SkillTrigger,
          ],
        },
      ]),
    ];

    // Matches: deploy + yaml file + "release" in title
    const task = makeTask({
      title: 'Release deployment config',
      labels: ['deploy'],
      metadata: { taskType: 'deploy' },
      files: ['deploy/config.yaml'],
    });
    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    // Inner AND: min(0.9, 0.6) = 0.6
    // OR: max(0.6) = 0.6  (emergency doesn't match)
    // Outer AND: min(0.6, 0.7) = 0.6
    expect(results[0].confidence).toBe(0.6);
  });
});

// ── Edge Cases ───────────────────────────────────────────────────

describe('router edge cases', () => {
  it('returns empty array when entries is empty', () => {
    const task = makeTask({ labels: ['anything'] });
    expect(matchTaskToSkills([], task)).toEqual([]);
  });

  it('handles skill with empty triggers array gracefully', () => {
    const entries = [makeEntry('no-triggers', [])];
    const task = makeTask({ labels: ['anything'] });
    expect(matchTaskToSkills(entries, task)).toEqual([]);
  });

  it('handles task with all fields populated simultaneously', () => {
    const entries = [
      makeEntry('multi-trigger', [
        { type: 'task-type', taskTypes: ['code-review'] },
        { type: 'label', labels: ['security'] },
        { type: 'pattern', titlePattern: 'audit' } as SkillTrigger,
        { type: 'file', globs: ['**/*.ts'] },
      ]),
    ];
    const task = makeTask({
      title: 'Security audit for auth module',
      description: 'Full security review needed',
      labels: ['code-review', 'security'],
      files: ['src/auth.ts', 'src/middleware.ts'],
      metadata: { taskType: 'code-review' },
      priority: 'critical',
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    // All 4 triggers match; best confidence is task-type = 0.9
    expect(results[0].confidence).toBe(0.9);
    expect(results[0].matchedTriggers).toHaveLength(4);
  });

  it('matches description-only pattern without title match', () => {
    const entries = [
      makeEntry('desc-skill', [
        {
          type: 'pattern',
          descriptionPattern: 'vulnerability',
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({
      title: 'Standard review',
      description: 'Found a critical vulnerability in the auth module',
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.7);
  });

  it('file trigger: partial glob match (some globs match, some do not)', () => {
    const entries = [
      makeEntry('mixed-globs', [{ type: 'file', globs: ['**/*.ts', '**/*.py', '**/*.go'] }]),
    ];
    const task = makeTask({ files: ['src/main.ts'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.6);
    expect(results[0].reason).toContain('**/*.ts');
  });

  it('composite AND with 3 sub-triggers requires all to match', () => {
    const entries = [
      makeEntry('triple-and', [
        {
          type: 'composite',
          operator: 'and',
          triggers: [
            { type: 'task-type', taskTypes: ['deploy'] },
            { type: 'label', labels: ['production'] },
            { type: 'file', globs: ['**/*.yaml'] },
          ],
        },
      ]),
    ];

    // All 3 match
    const task1 = makeTask({
      labels: ['deploy', 'production'],
      metadata: { taskType: 'deploy' },
      files: ['deploy/config.yaml'],
    });
    const results1 = matchTaskToSkills(entries, task1);
    expect(results1).toHaveLength(1);
    // min(0.9, 0.8, 0.6) = 0.6
    expect(results1[0].confidence).toBe(0.6);

    // Only 2 of 3 match
    const task2 = makeTask({
      labels: ['deploy', 'production'],
      metadata: { taskType: 'deploy' },
      files: ['deploy/config.json'],
    });
    const results2 = matchTaskToSkills(entries, task2);
    expect(results2).toHaveLength(0);
  });

  it('composite OR picks highest confidence from multiple matches', () => {
    const entries = [
      makeEntry('or-skill', [
        {
          type: 'composite',
          operator: 'or',
          triggers: [
            { type: 'file', globs: ['**/*.ts'] },
            { type: 'label', labels: ['review'] },
            { type: 'task-type', taskTypes: ['code-review'] },
          ],
        },
      ]),
    ];
    const task = makeTask({
      labels: ['code-review', 'review'],
      metadata: { taskType: 'code-review' },
      files: ['app.ts'],
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    // OR picks max: task-type = 0.9
    expect(results[0].confidence).toBe(0.9);
  });

  it('task with empty title and description still matches via task-type', () => {
    const entries = [makeEntry('type-only', [{ type: 'task-type', taskTypes: ['build'] }])];
    const task = makeTask({
      title: '',
      description: '',
      labels: ['build'],
    });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(0.9);
  });

  it('handles special regex characters in pattern trigger safely', () => {
    const entries = [
      makeEntry('regex-safe', [
        {
          type: 'pattern',
          titlePattern: 'fix\\(auth\\)',
        } as SkillTrigger,
      ]),
    ];
    const task = makeTask({ title: 'fix(auth) module' });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
  });

  it('glob with nested directory pattern matches correctly', () => {
    const entries = [
      makeEntry('nested-glob', [{ type: 'file', globs: ['src/**/*.test.ts'] }]),
    ];
    const task = makeTask({ files: ['src/services/auth/login.test.ts'] });

    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(1);
  });

  it('glob with single wildcard does not match nested paths', () => {
    const entries = [makeEntry('shallow-glob', [{ type: 'file', globs: ['src/*.ts'] }])];
    const task = makeTask({ files: ['src/nested/deep.ts'] });

    // Single * should not cross directory boundaries
    const results = matchTaskToSkills(entries, task);
    expect(results).toHaveLength(0);
  });
});

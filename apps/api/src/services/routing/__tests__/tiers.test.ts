import { describe, expect, it } from 'vitest';

import { getTierDefinition, selectTier, TIERS } from '../tiers.js';

// ── TIERS constant ──────────────────────────────────────────────

describe('TIERS', () => {
  it('has exactly four tiers', () => {
    expect(Object.keys(TIERS)).toHaveLength(4);
  });

  it('contains direct, lightweight, standard, full', () => {
    expect(TIERS).toHaveProperty('direct');
    expect(TIERS).toHaveProperty('lightweight');
    expect(TIERS).toHaveProperty('standard');
    expect(TIERS).toHaveProperty('full');
  });

  it('direct tier has 1 agent, sequential, fast model', () => {
    expect(TIERS.direct).toEqual({
      maxAgents: 1,
      parallel: false,
      defaultModel: 'fast',
      description: expect.any(String),
    });
  });

  it('lightweight tier has 1 agent, sequential, standard model', () => {
    expect(TIERS.lightweight.maxAgents).toBe(1);
    expect(TIERS.lightweight.parallel).toBe(false);
    expect(TIERS.lightweight.defaultModel).toBe('standard');
  });

  it('standard tier has 2 agents, parallel, standard model', () => {
    expect(TIERS.standard.maxAgents).toBe(2);
    expect(TIERS.standard.parallel).toBe(true);
    expect(TIERS.standard.defaultModel).toBe('standard');
  });

  it('full tier has 4 agents, parallel, premium model', () => {
    expect(TIERS.full.maxAgents).toBe(4);
    expect(TIERS.full.parallel).toBe(true);
    expect(TIERS.full.defaultModel).toBe('premium');
  });
});

// ── getTierDefinition ───────────────────────────────────────────

describe('getTierDefinition', () => {
  it('returns correct definition for each tier', () => {
    expect(getTierDefinition('direct')).toBe(TIERS.direct);
    expect(getTierDefinition('lightweight')).toBe(TIERS.lightweight);
    expect(getTierDefinition('standard')).toBe(TIERS.standard);
    expect(getTierDefinition('full')).toBe(TIERS.full);
  });
});

// ── selectTier ──────────────────────────────────────────────────

describe('selectTier', () => {
  describe('P0 priority override', () => {
    it('P0 always maps to full', () => {
      expect(selectTier({ title: 'fix typo', priority: 'P0' })).toBe('full');
    });

    it('P0 overrides even lightweight keywords', () => {
      expect(selectTier({ title: 'fix a typo', priority: 'P0' })).toBe('full');
    });
  });

  describe('full tier keywords', () => {
    const fullKeywords = [
      'refactor',
      'redesign',
      'architecture',
      'migration',
      'overhaul',
      'full-stack',
      'cross-cutting',
      'all agents',
      'entire',
    ];

    for (const keyword of fullKeywords) {
      it(`"${keyword}" in title → full`, () => {
        expect(selectTier({ title: `${keyword} the system` })).toBe('full');
      });
    }

    it('matches keyword in description too', () => {
      expect(
        selectTier({
          title: 'Make changes',
          description: 'This requires a full architecture overhaul',
        }),
      ).toBe('full');
    });
  });

  describe('standard tier keywords', () => {
    const standardKeywords = [
      'feature',
      'implement',
      'build',
      'create',
      'integrate',
      'add',
      'update',
      'change',
      'modify',
    ];

    for (const keyword of standardKeywords) {
      it(`"${keyword}" in title → standard`, () => {
        expect(selectTier({ title: `${keyword} new component` })).toBe('standard');
      });
    }
  });

  describe('lightweight tier keywords', () => {
    const lightweightKeywords = [
      'fix',
      'patch',
      'tweak',
      'adjust',
      'rename',
      'typo',
      'lint',
      'format',
      'style',
    ];

    for (const keyword of lightweightKeywords) {
      it(`"${keyword}" in title → lightweight`, () => {
        expect(selectTier({ title: `${keyword} something minor` })).toBe('lightweight');
      });
    }
  });

  describe('default behavior', () => {
    it('defaults to standard for unknown keywords', () => {
      expect(selectTier({ title: 'do something vague' })).toBe('standard');
    });

    it('defaults to standard for empty title', () => {
      expect(selectTier({ title: '' })).toBe('standard');
    });
  });

  describe('case insensitivity', () => {
    it('matches REFACTOR (uppercase)', () => {
      expect(selectTier({ title: 'REFACTOR the core' })).toBe('full');
    });

    it('matches Fix (capitalized)', () => {
      expect(selectTier({ title: 'Fix the bug' })).toBe('lightweight');
    });

    it('matches Build (capitalized)', () => {
      expect(selectTier({ title: 'Build the dashboard' })).toBe('standard');
    });
  });

  describe('keyword precedence', () => {
    it('full keywords take precedence over standard', () => {
      expect(selectTier({ title: 'implement architecture refactor' })).toBe('full');
    });

    it('standard keywords take precedence over lightweight', () => {
      expect(selectTier({ title: 'fix and implement the feature' })).toBe('standard');
    });
  });

  describe('edge cases', () => {
    it('handles undefined description', () => {
      expect(selectTier({ title: 'fix bug' })).toBe('lightweight');
    });

    it('handles non-P0 priorities normally', () => {
      expect(selectTier({ title: 'fix a bug', priority: 'P1' })).toBe('lightweight');
      expect(selectTier({ title: 'fix a bug', priority: 'P2' })).toBe('lightweight');
    });
  });
});

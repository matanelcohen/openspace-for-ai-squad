import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SquadParser } from '../index.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', '.squad');
const EMPTY_DIR = join(import.meta.dirname, 'fixtures', 'empty');

describe('SquadParser', () => {
  describe('constructor', () => {
    it('accepts a custom squad directory', () => {
      const parser = new SquadParser(FIXTURES_DIR);
      expect(parser.getSquadDir()).toBe(FIXTURES_DIR);
    });

    it('defaults to SQUAD_DIR env var or CWD/.squad', () => {
      const parser = new SquadParser();
      // Should not throw and should resolve to some path
      expect(typeof parser.getSquadDir()).toBe('string');
    });
  });

  describe('getAgents', () => {
    it('returns all agents from team.md', async () => {
      const parser = new SquadParser(FIXTURES_DIR);
      const agents = await parser.getAgents();

      expect(agents).toHaveLength(5);
      expect(agents.map(a => a.id)).toEqual([
        'leela',
        'bender',
        'fry',
        'zoidberg',
        'ralph',
      ]);
    });

    it('returns empty array for empty directory', async () => {
      const parser = new SquadParser(EMPTY_DIR);
      const agents = await parser.getAgents();
      expect(agents).toEqual([]);
    });
  });

  describe('getAgent', () => {
    it('returns detailed agent data for existing agent', async () => {
      const parser = new SquadParser(FIXTURES_DIR);
      const detail = await parser.getAgent('bender');

      expect(detail).not.toBeNull();
      expect(detail!.id).toBe('bender');
      expect(detail!.charterPath).toBe('agents/bender/charter.md');
      expect(detail!.identity.expertise).toContain('API design');
      expect(detail!.learnings.length).toBeGreaterThan(0);
    });

    it('returns null for non-existent agent', async () => {
      const parser = new SquadParser(FIXTURES_DIR);
      const detail = await parser.getAgent('nonexistent');
      expect(detail).toBeNull();
    });

    it('returns null for empty directory', async () => {
      const parser = new SquadParser(EMPTY_DIR);
      const detail = await parser.getAgent('bender');
      expect(detail).toBeNull();
    });
  });

  describe('getDecisions', () => {
    it('returns all decisions', async () => {
      const parser = new SquadParser(FIXTURES_DIR);
      const decisions = await parser.getDecisions();

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0]!.title).toContain('PRD created');
      expect(decisions[0]!.status).toBe('active');
    });

    it('returns empty for empty directory', async () => {
      const parser = new SquadParser(EMPTY_DIR);
      const decisions = await parser.getDecisions();
      expect(decisions).toEqual([]);
    });
  });

  describe('getConfig', () => {
    it('returns composed SquadConfig', async () => {
      const parser = new SquadParser(FIXTURES_DIR);
      const config = await parser.getConfig();

      expect(config.squadDir).toBe(FIXTURES_DIR);
      expect(config.agents).toHaveLength(5);
      expect(config.id).toBe('default');
    });

    it('returns defaults for empty directory', async () => {
      const parser = new SquadParser(EMPTY_DIR);
      const config = await parser.getConfig();

      expect(config.squadDir).toBe(EMPTY_DIR);
      expect(config.agents).toEqual([]);
    });
  });

  describe('getSquadOverview', () => {
    it('returns a composite overview', async () => {
      const parser = new SquadParser(FIXTURES_DIR);
      const overview = await parser.getSquadOverview();

      expect(overview.config.squadDir).toBe(FIXTURES_DIR);
      expect(overview.agents).toHaveLength(5);
      expect(overview.recentDecisions.length).toBeGreaterThan(0);
      expect(overview.recentTasks).toEqual([]);
      expect(overview.taskCounts.total).toBe(0);
    });

    it('caps recentDecisions at 10', async () => {
      const parser = new SquadParser(FIXTURES_DIR);
      const overview = await parser.getSquadOverview();
      expect(overview.recentDecisions.length).toBeLessThanOrEqual(10);
    });

    it('returns zero task counts', async () => {
      const parser = new SquadParser(FIXTURES_DIR);
      const overview = await parser.getSquadOverview();

      expect(overview.taskCounts).toEqual({
        byStatus: {
          'pending': 0,
          'backlog': 0,
          'in-progress': 0,
          'in-review': 0,
          'done': 0,
          'merged': 0,
          'blocked': 0,
          'delegated': 0,
        },
        total: 0,
      });
    });

    it('handles empty directory gracefully', async () => {
      const parser = new SquadParser(EMPTY_DIR);
      const overview = await parser.getSquadOverview();

      expect(overview.agents).toEqual([]);
      expect(overview.recentDecisions).toEqual([]);
    });
  });
});

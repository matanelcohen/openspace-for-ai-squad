import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDecisionsContent, parseDecisionsFile } from '../decision-parser.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', '.squad');
const MALFORMED_DIR = join(import.meta.dirname, 'fixtures', 'malformed', '.squad');
const EMPTY_DIR = join(import.meta.dirname, 'fixtures', 'empty');

describe('decision-parser', () => {
  describe('parseDecisionsFile', () => {
    it('parses decisions from a valid decisions.md', async () => {
      const decisions = await parseDecisionsFile(FIXTURES_DIR);

      expect(decisions).toHaveLength(3);
      expect(decisions[0]).toMatchObject({
        title: 'PRD created for test project',
        author: 'Leela (Lead)',
        date: '2026-03-23T20:42:00Z',
        status: 'active',
      });
    });

    it('extracts rationale from Why field', async () => {
      const decisions = await parseDecisionsFile(FIXTURES_DIR);
      expect(decisions[0]!.rationale).toBe(
        'The team needed a shared source of truth.',
      );
    });

    it('extracts affected files from Impact', async () => {
      const decisions = await parseDecisionsFile(FIXTURES_DIR);
      // First decision mentions docs/prd.md in Impact
      expect(decisions[0]!.affectedFiles).toContain('docs/prd.md');
    });

    it('generates stable IDs from date + title', async () => {
      const decisions = await parseDecisionsFile(FIXTURES_DIR);
      expect(decisions[0]!.id).toMatch(/^2026-03-23/);
      expect(decisions[0]!.id).toContain('prd-created');
    });

    it('returns empty array for missing file', async () => {
      const decisions = await parseDecisionsFile(EMPTY_DIR);
      expect(decisions).toEqual([]);
    });

    it('handles malformed file gracefully', async () => {
      const decisions = await parseDecisionsFile(MALFORMED_DIR);
      // Should not crash, may return partial or empty results
      expect(Array.isArray(decisions)).toBe(true);
    });
  });

  describe('parseDecisionsContent', () => {
    it('parses a single decision', () => {
      const content = `## Active Decisions\n\n### 2026-01-01T00:00:00Z: Test decision\n**By:** Alice\n**What:** Did something.\n**Why:** Because reasons.\n**Impact:** Updated \`src/main.ts\`.\n`;
      const decisions = parseDecisionsContent(content);

      expect(decisions).toHaveLength(1);
      expect(decisions[0]!).toMatchObject({
        title: 'Test decision',
        author: 'Alice',
        date: '2026-01-01T00:00:00Z',
        rationale: 'Because reasons.',
        status: 'active',
      });
      expect(decisions[0]!.affectedFiles).toContain('src/main.ts');
    });

    it('handles decisions without Impact', () => {
      const content = `## Active Decisions\n\n### 2026-01-01T00:00:00Z: No impact\n**By:** Bob\n**What:** Something.\n**Why:** Just because.\n`;
      const decisions = parseDecisionsContent(content);

      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.affectedFiles).toEqual([]);
    });

    it('handles empty content', () => {
      expect(parseDecisionsContent('')).toEqual([]);
    });

    it('handles content with no decisions', () => {
      expect(parseDecisionsContent('# Some doc\n\nNo decisions here.')).toEqual([]);
    });

    it('parses multiple decisions', () => {
      const content = `## Active Decisions\n\n### 2026-01-01T00:00:00Z: First\n**By:** A\n**What:** X.\n**Why:** Y.\n\n### 2026-01-02T00:00:00Z: Second\n**By:** B\n**What:** X2.\n**Why:** Y2.\n`;
      const decisions = parseDecisionsContent(content);
      expect(decisions).toHaveLength(2);
      expect(decisions[0]!.title).toBe('First');
      expect(decisions[1]!.title).toBe('Second');
    });

    it('maps superseded section to status', () => {
      const content = `## Superseded Decisions\n\n### 2026-01-01T00:00:00Z: Old choice\n**By:** Alice\n**What:** X.\n**Why:** Y.\n`;
      const decisions = parseDecisionsContent(content);
      expect(decisions[0]!.status).toBe('superseded');
    });
  });
});

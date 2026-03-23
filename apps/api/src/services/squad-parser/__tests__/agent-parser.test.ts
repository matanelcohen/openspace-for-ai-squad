import { join } from 'node:path';

import type { Agent } from '@openspace/shared';
import { describe, expect, it } from 'vitest';

import {
  parseAgentCharter,
  parseAgentHistory,
  parseCharterContent,
  parseHistoryContent,
} from '../agent-parser.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', '.squad');
const EMPTY_DIR = join(import.meta.dirname, 'fixtures', 'empty');

const makeAgent = (id: string, name: string): Agent => ({
  id,
  name,
  role: 'Test',
  status: 'active',
  currentTask: null,
  expertise: [],
  voiceProfile: { agentId: id, displayName: name, voiceId: '', personality: '' },
});

describe('agent-parser', () => {
  describe('parseAgentCharter', () => {
    it('parses charter for an existing agent', async () => {
      const agent = makeAgent('bender', 'Bender');
      const detail = await parseAgentCharter(FIXTURES_DIR, agent);

      expect(detail.id).toBe('bender');
      expect(detail.charterPath).toBe('agents/bender/charter.md');
      expect(detail.identity.expertise).toContain('API design');
      expect(detail.identity.style).toContain('Systems-minded');
    });

    it('parses boundaries section', async () => {
      const agent = makeAgent('bender', 'Bender');
      const detail = await parseAgentCharter(FIXTURES_DIR, agent);

      expect(detail.boundaries.handles).toContain('Backend code');
      expect(detail.boundaries.doesNotHandle).toContain('Frontend UI');
      expect(detail.boundaries.whenUnsure).toContain('say so');
    });

    it('includes learnings from history', async () => {
      const agent = makeAgent('bender', 'Bender');
      const detail = await parseAgentCharter(FIXTURES_DIR, agent);

      expect(detail.learnings).toHaveLength(2);
      expect(detail.learnings[0]).toContain('Monorepo initialized');
    });

    it('returns defaults for non-existent agent', async () => {
      const agent = makeAgent('ghost', 'Ghost');
      const detail = await parseAgentCharter(FIXTURES_DIR, agent);

      expect(detail.charterPath).toBeNull();
      expect(detail.identity).toEqual({ expertise: '', style: '' });
      expect(detail.boundaries).toEqual({
        handles: '',
        doesNotHandle: '',
        whenUnsure: '',
      });
      expect(detail.learnings).toEqual([]);
    });

    it('returns defaults for empty directory', async () => {
      const agent = makeAgent('bender', 'Bender');
      const detail = await parseAgentCharter(EMPTY_DIR, agent);

      expect(detail.charterPath).toBeNull();
      expect(detail.learnings).toEqual([]);
    });

    it('enriches expertise from charter when agent has empty expertise', async () => {
      const agent = makeAgent('bender', 'Bender');
      const detail = await parseAgentCharter(FIXTURES_DIR, agent);

      expect(detail.expertise.length).toBeGreaterThan(0);
      expect(detail.expertise).toContain('API design');
    });

    it('preserves existing expertise over charter', async () => {
      const agent = makeAgent('bender', 'Bender');
      agent.expertise = ['custom-skill'];
      const detail = await parseAgentCharter(FIXTURES_DIR, agent);

      expect(detail.expertise).toEqual(['custom-skill']);
    });
  });

  describe('parseAgentHistory', () => {
    it('parses learnings from history.md', async () => {
      const learnings = await parseAgentHistory(FIXTURES_DIR, 'bender');

      expect(learnings).toHaveLength(2);
      expect(learnings[0]).toContain('Monorepo initialized');
      expect(learnings[1]).toContain('Backend scaffolding');
    });

    it('returns empty array for missing file', async () => {
      const learnings = await parseAgentHistory(EMPTY_DIR, 'nobody');
      expect(learnings).toEqual([]);
    });
  });

  describe('parseCharterContent', () => {
    it('extracts identity from charter', () => {
      const content = `## Identity\n\n- **Name:** Test\n- **Expertise:** Coding, testing\n- **Style:** Fast and furious.\n\n## Boundaries\n\n**I handle:** Code\n`;
      const { identity } = parseCharterContent(content);

      expect(identity.expertise).toBe('Coding, testing');
      expect(identity.style).toBe('Fast and furious.');
    });

    it('extracts boundaries from charter', () => {
      const content = `## Boundaries\n\n**I handle:** Backend\n\n**I don't handle:** Frontend\n\n**When I'm unsure:** I ask.\n`;
      const { boundaries } = parseCharterContent(content);

      expect(boundaries.handles).toBe('Backend');
      expect(boundaries.doesNotHandle).toBe('Frontend');
      expect(boundaries.whenUnsure).toBe('I ask.');
    });

    it('returns defaults for empty content', () => {
      const { identity, boundaries, expertise } = parseCharterContent('');
      expect(identity).toEqual({ expertise: '', style: '' });
      expect(boundaries).toEqual({
        handles: '',
        doesNotHandle: '',
        whenUnsure: '',
      });
      expect(expertise).toEqual([]);
    });

    it('extracts expertise tags as array', () => {
      const content = `## Identity\n\n- **Expertise:** API design, database, testing\n`;
      const { expertise } = parseCharterContent(content);
      expect(expertise).toEqual(['API design', 'database', 'testing']);
    });
  });

  describe('parseHistoryContent', () => {
    it('parses bullet-point learnings', () => {
      const content = `## Learnings\n\n- First learning.\n- Second learning.\n`;
      const learnings = parseHistoryContent(content);
      expect(learnings).toEqual(['First learning.', 'Second learning.']);
    });

    it('skips HTML comments', () => {
      const content = `## Learnings\n\n<!-- comment -->\n\n- Real learning.\n`;
      const learnings = parseHistoryContent(content);
      expect(learnings).toEqual(['Real learning.']);
    });

    it('handles empty Learnings section', () => {
      const content = `## Learnings\n\n<!-- nothing here -->\n`;
      const learnings = parseHistoryContent(content);
      expect(learnings).toEqual([]);
    });

    it('returns empty for no Learnings heading', () => {
      const content = `# Some file\n\nNo learnings here.`;
      const learnings = parseHistoryContent(content);
      expect(learnings).toEqual([]);
    });

    it('handles multi-line learnings', () => {
      const content = `## Learnings\n\n- **Date — Title.** This is a long\n  learning that wraps to the next line.\n- Short one.\n`;
      const learnings = parseHistoryContent(content);
      expect(learnings).toHaveLength(2);
      expect(learnings[0]).toContain('wraps to the next line');
    });
  });
});

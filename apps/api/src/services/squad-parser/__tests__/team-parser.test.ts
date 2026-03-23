import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTeamContent, parseTeamFile } from '../team-parser.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', '.squad');
const MALFORMED_DIR = join(import.meta.dirname, 'fixtures', 'malformed', '.squad');
const EMPTY_DIR = join(import.meta.dirname, 'fixtures', 'empty');

describe('team-parser', () => {
  describe('parseTeamFile', () => {
    it('parses agents from a valid team.md', async () => {
      const agents = await parseTeamFile(FIXTURES_DIR);

      expect(agents).toHaveLength(5);
      expect(agents[0]).toMatchObject({
        id: 'leela',
        name: 'Leela',
        role: 'Lead',
        status: 'active',
      });
      expect(agents[1]).toMatchObject({
        id: 'bender',
        name: 'Bender',
        role: 'Backend Dev',
        status: 'active',
      });
    });

    it('maps Monitor status to idle', async () => {
      const agents = await parseTeamFile(FIXTURES_DIR);
      const ralph = agents.find(a => a.id === 'ralph');

      expect(ralph).toBeDefined();
      expect(ralph!.status).toBe('idle');
    });

    it('returns empty array for missing file', async () => {
      const agents = await parseTeamFile(EMPTY_DIR);
      expect(agents).toEqual([]);
    });

    it('returns empty array for malformed file', async () => {
      const agents = await parseTeamFile(MALFORMED_DIR);
      expect(agents).toEqual([]);
    });

    it('populates default voice profile', async () => {
      const agents = await parseTeamFile(FIXTURES_DIR);
      expect(agents[0]!.voiceProfile).toEqual({
        agentId: 'leela',
        displayName: 'Leela',
        voiceId: '',
        personality: '',
      });
    });

    it('sets currentTask to null', async () => {
      const agents = await parseTeamFile(FIXTURES_DIR);
      agents.forEach(a => {
        expect(a.currentTask).toBeNull();
      });
    });
  });

  describe('parseTeamContent', () => {
    it('parses a minimal Members table', () => {
      const content = `# Team\n\n## Members\n\n| Name | Role | Charter | Status |\n|------|------|---------|--------|\n| Alice | Dev | path | 🔧 Active |\n`;
      const agents = parseTeamContent(content);

      expect(agents).toHaveLength(1);
      expect(agents[0]).toMatchObject({
        id: 'alice',
        name: 'Alice',
        role: 'Dev',
        status: 'active',
      });
    });

    it('handles empty content', () => {
      expect(parseTeamContent('')).toEqual([]);
    });

    it('handles content with no Members section', () => {
      expect(parseTeamContent('# Team\n\nSome text.')).toEqual([]);
    });

    it('stops parsing at the next section', () => {
      const content = `## Members\n\n| Name | Role | Charter | Status |\n|------|------|---------|--------|\n| A | R | p | Active |\n\n## Other\n\n| Name | Role | Charter | Status |\n|------|------|---------|--------|\n| B | R2 | p2 | Active |\n`;
      const agents = parseTeamContent(content);
      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe('A');
    });

    it('handles various status emojis', () => {
      const content = `## Members\n\n| Name | Role | Charter | Status |\n|------|------|---------|--------|\n| A | R | p | 🏗️ Active |\n| B | R | p | 🧪 Active |\n| C | R | p | ⚛️ Active |\n| D | R | p | 🔄 Monitor |\n| E | R | p | 💥 Failed |\n| F | R | p | 🚀 Spawned |\n`;
      const agents = parseTeamContent(content);

      expect(agents[0]!.status).toBe('active');
      expect(agents[1]!.status).toBe('active');
      expect(agents[2]!.status).toBe('active');
      expect(agents[3]!.status).toBe('idle');
      expect(agents[4]!.status).toBe('failed');
      expect(agents[5]!.status).toBe('spawned');
    });
  });
});

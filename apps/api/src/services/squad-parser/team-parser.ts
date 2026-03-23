/**
 * team-parser.ts — Parses .squad/team.md into Agent[] objects.
 *
 * Extracts agent data from the Members table in team.md.
 * Maps markdown table rows to structured Agent objects.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Agent, AgentStatus } from '@openspace/shared';

/** Map status text from team.md to AgentStatus. */
function parseStatus(raw: string): AgentStatus {
  const text = raw.replace(/[^\w\s]/g, '').trim().toLowerCase();
  if (text.includes('active')) return 'active';
  if (text.includes('spawned')) return 'spawned';
  if (text.includes('failed')) return 'failed';
  // "Monitor", "Idle", or anything else
  return 'idle';
}

/** Default voice profile for an agent (placeholder until voice is configured). */
function defaultVoiceProfile(id: string, name: string) {
  return {
    agentId: id,
    displayName: name,
    voiceId: '',
    personality: '',
  };
}

/**
 * Parse team.md and return an array of Agent objects.
 * Returns an empty array if the file is missing or unparseable.
 */
export async function parseTeamFile(squadDir: string): Promise<Agent[]> {
  const filePath = join(squadDir, 'team.md');
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  return parseTeamContent(content);
}

/**
 * Parse team.md content string into Agent[].
 * Exported for testing without filesystem access.
 */
export function parseTeamContent(content: string): Agent[] {
  const agents: Agent[] = [];
  const lines = content.split('\n');

  // Find the Members table (starts after "## Members" heading)
  let inMembersSection = false;
  let headerParsed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect the Members section
    if (/^##\s+Members/i.test(trimmed)) {
      inMembersSection = true;
      continue;
    }

    // Exit on next section heading
    if (inMembersSection && /^##\s+/.test(trimmed) && !/^##\s+Members/i.test(trimmed)) {
      break;
    }

    if (!inMembersSection) continue;

    // Skip header row and separator
    if (trimmed.startsWith('|') && trimmed.includes('Name') && trimmed.includes('Role')) {
      headerParsed = true;
      continue;
    }
    if (trimmed.startsWith('|') && /^[\s|:-]+$/.test(trimmed)) {
      continue;
    }

    // Parse data rows
    if (headerParsed && trimmed.startsWith('|')) {
      const cells = trimmed
        .split('|')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      if (cells.length >= 4) {
        const [name, role, _charterPath, statusRaw] = cells as [string, string, string, string];
        const id = name.toLowerCase();
        agents.push({
          id,
          name,
          role,
          status: parseStatus(statusRaw),
          currentTask: null,
          expertise: [],
          voiceProfile: defaultVoiceProfile(id, name),
        });
      }
    }
  }

  return agents;
}


/**
 * agent-parser.ts — Parses agent charter and history files.
 *
 * Charter: agents/{name}/charter.md → AgentDetail enrichment
 * History: agents/{name}/history.md → learnings array
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Agent, AgentBoundaries, AgentDetail, AgentIdentity } from '@openspace/shared';

/** Default identity when charter is missing or unparseable. */
function defaultIdentity(): AgentIdentity {
  return { expertise: '', style: '' };
}

/** Default boundaries when charter is missing or unparseable. */
function defaultBoundaries(): AgentBoundaries {
  return { handles: '', doesNotHandle: '', whenUnsure: '' };
}

/**
 * Parse a charter.md file and merge into an existing Agent to produce an AgentDetail.
 * If the charter file is missing, returns the agent with empty charter fields.
 */
export async function parseAgentCharter(
  squadDir: string,
  agent: Agent,
): Promise<AgentDetail> {
  const charterPath = join(squadDir, 'agents', agent.id, 'charter.md');
  let content: string;
  try {
    content = await readFile(charterPath, 'utf-8');
  } catch {
    return {
      ...agent,
      charterPath: null,
      identity: defaultIdentity(),
      boundaries: defaultBoundaries(),
      learnings: [],
    };
  }

  const { identity, boundaries, expertise } = parseCharterContent(content);
  const learnings = await parseAgentHistory(squadDir, agent.id);

  return {
    ...agent,
    // Enrich expertise from charter if not already populated
    expertise: agent.expertise.length > 0 ? agent.expertise : expertise,
    charterPath: `agents/${agent.id}/charter.md`,
    identity,
    boundaries,
    learnings,
  };
}

/**
 * Parse charter.md content into structured sections.
 * Supports both SDK-generated charters (## Identity, ## Boundaries)
 * and simple charters (## Character, ## Role, ## Responsibilities).
 * Exported for testing.
 */
export function parseCharterContent(content: string): {
  identity: AgentIdentity;
  boundaries: AgentBoundaries;
  expertise: string[];
} {
  const identity = extractIdentity(content);
  const boundaries = extractBoundaries(content);
  const expertise = extractExpertise(content);

  // If SDK sections are empty, try extracting from simpler charter formats
  if (!identity.expertise && !identity.style) {
    // Try ## Character for personality info
    const charSection = extractSection(content, 'Character');
    if (charSection) {
      identity.style = extractBoldField(charSection, 'Personality') ?? '';
    }
    // Try extracting from ## Role or description line
    const roleSection = extractSection(content, 'Role');
    if (roleSection) {
      identity.expertise = roleSection.split('\n')[0]?.trim() ?? '';
    }
    // Try ## What I Own as expertise source
    const ownsSection = extractSection(content, 'What I Own');
    if (ownsSection) {
      identity.expertise = ownsSection.split('\n')
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.trim().slice(2).trim())
        .join(', ');
    }
  }

  if (!boundaries.handles) {
    // Try ## Responsibilities as a fallback
    const respSection = extractSection(content, 'Responsibilities');
    if (respSection) {
      boundaries.handles = respSection.split('\n')
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.trim().slice(2).trim())
        .join(', ');
    }
    // Try ## How I Work
    const howSection = extractSection(content, 'How I Work');
    if (howSection) {
      boundaries.whenUnsure = howSection.split('\n')
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.trim().slice(2).trim())
        .slice(0, 2)
        .join('; ');
    }
  }

  // Extract expertise from Technical Expertise section too
  if (expertise.length === 0) {
    const techSection = extractSection(content, 'Technical Expertise');
    if (techSection) {
      const items = techSection.split('\n')
        .filter((l) => l.trim().startsWith('-'))
        .map((l) => l.trim().slice(2).trim())
        .filter((l) => l.length > 0);
      if (items.length > 0) return { identity, boundaries, expertise: items };
    }
  }

  return { identity, boundaries, expertise };
}

/** Extract Identity section fields. */
function extractIdentity(content: string): AgentIdentity {
  const section = extractSection(content, 'Identity');
  if (!section) return defaultIdentity();

  const expertise = extractBoldField(section, 'Expertise') ?? '';
  const style = extractBoldField(section, 'Style') ?? '';

  return { expertise, style };
}

/** Extract Boundaries section fields. */
function extractBoundaries(content: string): AgentBoundaries {
  const section = extractSection(content, 'Boundaries');
  if (!section) return defaultBoundaries();

  const handles = extractBoldField(section, 'I handle') ?? '';
  const doesNotHandle = extractBoldField(section, "I don't handle") ?? extractBoldField(section, 'I don\'t handle') ?? '';
  const whenUnsure = extractBoldField(section, "When I'm unsure") ?? extractBoldField(section, 'When I\'m unsure') ?? '';

  return { handles, doesNotHandle, whenUnsure };
}

/** Extract expertise tags from the Identity section. */
function extractExpertise(content: string): string[] {
  const section = extractSection(content, 'Identity');
  if (!section) return [];

  const expertiseRaw = extractBoldField(section, 'Expertise');
  if (!expertiseRaw) return [];

  return expertiseRaw
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0);
}

/**
 * Extract a markdown section by heading name (## level).
 * Returns the content between the heading and the next heading of same or higher level.
 */
function extractSection(content: string, heading: string): string | null {
  const pattern = new RegExp(`^##\\s+${escapeRegex(heading)}\\b`, 'im');
  const match = content.match(pattern);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  const rest = content.slice(start);

  // Find next ## heading
  const nextHeading = rest.match(/^##\s+/m);
  const end = nextHeading?.index ?? rest.length;

  return rest.slice(0, end).trim();
}

/** Extract a bold field value: **Label:** Value */
function extractBoldField(section: string, label: string): string | null {
  const pattern = new RegExp(
    `\\*\\*${escapeRegex(label)}:?\\*\\*:?\\s*(.+)`,
    'i',
  );
  const match = section.match(pattern);
  return match?.[1]?.trim() ?? null;
}

/** Escape special regex characters. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse an agent's history.md file and return the learnings array.
 * Returns an empty array if the file is missing.
 */
export async function parseAgentHistory(
  squadDir: string,
  agentId: string,
): Promise<string[]> {
  const filePath = join(squadDir, 'agents', agentId, 'history.md');
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  return parseHistoryContent(content);
}

/**
 * Parse history.md content and extract learnings.
 * Exported for testing.
 */
export function parseHistoryContent(content: string): string[] {
  const learnings: string[] = [];
  const section = extractSection(content, 'Learnings');
  if (!section) return learnings;

  const lines = section.split('\n');
  let currentLearning = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip HTML comments
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) continue;
    if (trimmed.length === 0) {
      if (currentLearning) {
        learnings.push(currentLearning.trim());
        currentLearning = '';
      }
      continue;
    }

    // New bullet point
    if (trimmed.startsWith('- ')) {
      if (currentLearning) {
        learnings.push(currentLearning.trim());
      }
      currentLearning = trimmed.slice(2).trim();
    } else if (currentLearning) {
      // Continuation line
      currentLearning += ' ' + trimmed;
    }
  }

  if (currentLearning) {
    learnings.push(currentLearning.trim());
  }

  return learnings;
}

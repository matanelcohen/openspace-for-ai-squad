/**
 * decision-parser.ts — Parses .squad/decisions.md into Decision[] objects.
 *
 * Each decision is an H3 section under an H2 status heading.
 * Format:
 *   ### {date}: {title}
 *   **By:** {author}
 *   **What:** {description}
 *   **Why:** {rationale}
 *   **Impact:** {impact} (optional)
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Decision, DecisionStatus } from '@matanelcohen/openspace-shared';

/** Map H2 section names to DecisionStatus. */
function sectionToStatus(heading: string): DecisionStatus {
  const lower = heading.toLowerCase();
  if (lower.includes('superseded')) return 'superseded';
  if (lower.includes('reversed')) return 'reversed';
  return 'active';
}

/** Create a slug-based ID from a date and title. */
function makeId(date: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
  // Use the date portion (no colons for ID safety)
  const dateSlug = date.replace(/[:T]/g, '-').replace(/Z$/, '');
  return `${dateSlug}-${slug}`;
}

/** Extract file paths (backtick-enclosed paths) from text. */
function extractAffectedFiles(text: string): string[] {
  const matches = text.match(/`([^`]+\.[a-z]+[^`]*)`/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/`/g, ''));
}

/**
 * Parse decisions.md and return an array of Decision objects.
 * Returns an empty array if the file is missing or unparseable.
 */
export async function parseDecisionsFile(squadDir: string): Promise<Decision[]> {
  const filePath = join(squadDir, 'decisions.md');
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  return parseDecisionsContent(content);
}

/**
 * Parse decisions.md content string into Decision[].
 * Exported for testing without filesystem access.
 */
export function parseDecisionsContent(content: string): Decision[] {
  const decisions: Decision[] = [];
  const lines = content.split('\n');

  let currentStatus: DecisionStatus = 'active';
  let currentDecision: Partial<Decision> | null = null;
  let currentField: 'what' | 'why' | 'impact' | null = null;
  let fieldBuffer = '';

  const flushField = () => {
    if (currentDecision && currentField && fieldBuffer) {
      const text = fieldBuffer.trim();
      switch (currentField) {
        case 'what':
          // 'What' content maps to the title's companion description — use it for rationale context
          break;
        case 'why':
          currentDecision.rationale = text;
          break;
        case 'impact':
          currentDecision.affectedFiles = [
            ...(currentDecision.affectedFiles ?? []),
            ...extractAffectedFiles(text),
          ];
          break;
      }
    }
    currentField = null;
    fieldBuffer = '';
  };

  const flushDecision = () => {
    flushField();
    if (currentDecision?.id && currentDecision.title) {
      decisions.push({
        id: currentDecision.id,
        title: currentDecision.title,
        author: currentDecision.author ?? 'Unknown',
        date: currentDecision.date ?? '',
        rationale: currentDecision.rationale ?? '',
        status: currentDecision.status ?? 'active',
        affectedFiles: currentDecision.affectedFiles ?? [],
      });
    }
    currentDecision = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // H2 section — determines status context
    const h2Match = trimmed.match(/^##\s+(.+)/);
    if (h2Match && !trimmed.startsWith('###')) {
      flushDecision();
      currentStatus = sectionToStatus(h2Match[1]!);
      continue;
    }

    // H3 — new decision entry
    const h3Match = trimmed.match(/^###\s+(\S+):\s+(.+)/);
    if (h3Match) {
      flushDecision();
      const dateRaw = h3Match[1]!;
      const title = h3Match[2]!;
      currentDecision = {
        id: makeId(dateRaw, title),
        title,
        date: dateRaw,
        status: currentStatus,
        affectedFiles: [],
      };
      continue;
    }

    if (!currentDecision) continue;

    // Field lines
    const byMatch = trimmed.match(/^\*\*By:\*\*\s*(.+)/);
    if (byMatch) {
      flushField();
      currentDecision.author = byMatch[1]!.trim();
      continue;
    }

    const whatMatch = trimmed.match(/^\*\*What:\*\*\s*(.*)/);
    if (whatMatch) {
      flushField();
      currentField = 'what';
      fieldBuffer = whatMatch[1]!;
      continue;
    }

    const whyMatch = trimmed.match(/^\*\*Why:\*\*\s*(.*)/);
    if (whyMatch) {
      flushField();
      currentField = 'why';
      fieldBuffer = whyMatch[1]!;
      continue;
    }

    const impactMatch = trimmed.match(/^\*\*Impact:\*\*\s*(.*)/);
    if (impactMatch) {
      flushField();
      currentField = 'impact';
      fieldBuffer = impactMatch[1]!;
      continue;
    }

    // Continuation lines for multi-line fields
    if (currentField && trimmed.length > 0) {
      fieldBuffer += ' ' + trimmed;
    }
  }

  // Flush the last decision
  flushDecision();

  return decisions;
}

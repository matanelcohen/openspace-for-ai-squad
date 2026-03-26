/**
 * Seed / sync team_members from `.squad/team.md` and agent charter files.
 *
 * Parses the Members markdown table, enriches each entry with skills from
 * the agent's charter file, and upserts into the team_members SQLite table.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

// ── Types ──────────────────────────────────────────────────────────

interface ParsedAgent {
  name: string;
  role: string;
  charterPath: string | null;
  status: string;
}

interface SeedTeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  skills: string;
  rank: string;
  status: string;
  joined_at: string;
  updated_at: string;
}

export interface SeedResult {
  inserted: number;
  skipped: number;
  total: number;
}

// ── Parsing ────────────────────────────────────────────────────────

const ROLE_TO_DEPARTMENT: Record<string, string> = {
  lead: 'Leadership',
  coordinator: 'Leadership',
  'frontend dev': 'Engineering',
  'backend dev': 'Engineering',
  tester: 'Quality Assurance',
  '(silent)': 'Documentation',
  scribe: 'Documentation',
  'work monitor': 'Operations',
};

function inferDepartment(role: string): string {
  return ROLE_TO_DEPARTMENT[role.toLowerCase()] ?? 'General';
}

/**
 * Parse the Members table from team.md content.
 * Expects a markdown table under `## Members` with columns: Name | Role | Charter | Status
 */
function parseMembersTable(content: string): ParsedAgent[] {
  const agents: ParsedAgent[] = [];
  const lines = content.split('\n');

  let inMembersSection = false;
  let headerParsed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^##\s+Members/i.test(trimmed)) {
      inMembersSection = true;
      continue;
    }

    // Stop at next section
    if (inMembersSection && /^##\s+/.test(trimmed) && !/^##\s+Members/i.test(trimmed)) {
      break;
    }

    if (!inMembersSection) continue;

    // Skip empty lines
    if (!trimmed) continue;

    // Skip separator row (|---|---|...)
    if (/^\|[\s-|]+\|$/.test(trimmed)) {
      headerParsed = true;
      continue;
    }

    // Skip header row
    if (!headerParsed && trimmed.startsWith('|')) {
      continue;
    }

    // Parse data rows
    if (headerParsed && trimmed.startsWith('|')) {
      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length >= 4) {
        agents.push({
          name: cells[0]!,
          role: cells[1]!,
          charterPath: cells[2] === '—' ? null : cells[2]!,
          status: cells[3]!,
        });
      }
    }
  }

  // Also parse Coordinator table
  let inCoordinatorSection = false;
  headerParsed = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^##\s+Coordinator/i.test(trimmed)) {
      inCoordinatorSection = true;
      continue;
    }

    if (inCoordinatorSection && /^##\s+/.test(trimmed) && !/^##\s+Coordinator/i.test(trimmed)) {
      break;
    }

    if (!inCoordinatorSection) continue;
    if (!trimmed) continue;

    if (/^\|[\s-|]+\|$/.test(trimmed)) {
      headerParsed = true;
      continue;
    }

    if (!headerParsed && trimmed.startsWith('|')) {
      continue;
    }

    if (headerParsed && trimmed.startsWith('|')) {
      const cells = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length >= 2) {
        agents.push({
          name: cells[0]!,
          role: cells[1]!,
          charterPath: null,
          status: 'Active',
        });
      }
    }
  }

  return agents;
}

/**
 * Extract expertise/skills from a charter file.
 * Looks for `**Expertise:**` line and parses comma-separated values.
 */
function parseSkillsFromCharter(charterContent: string): string[] {
  const match = charterContent.match(/\*\*Expertise:\*\*\s*(.+)/i);
  if (!match?.[1]) return [];

  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normalize status emoji strings from team.md to 'active' | 'inactive'.
 */
function normalizeStatus(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('active') || lower.includes('monitor')) return 'active';
  return 'inactive';
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Seed team_members from `.squad/team.md` if the table is empty.
 * Returns the number of inserted rows.
 */
export function seedTeamMembers(db: Database.Database, squadDir: string): SeedResult {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM team_members').get() as { cnt: number })
    .cnt;

  if (count > 0) {
    return { inserted: 0, skipped: count, total: count };
  }

  return syncTeamMembers(db, squadDir);
}

/**
 * Force-sync team_members from `.squad/team.md`.
 * Clears existing rows and re-inserts from the file.
 */
export function syncTeamMembers(db: Database.Database, squadDir: string): SeedResult {
  const teamMdPath = resolve(squadDir, 'team.md');
  if (!existsSync(teamMdPath)) {
    return { inserted: 0, skipped: 0, total: 0 };
  }

  const content = readFileSync(teamMdPath, 'utf-8');
  const agents = parseMembersTable(content);

  const projectRoot = resolve(squadDir, '..');
  const now = new Date().toISOString();

  const rows: SeedTeamMemberRow[] = agents.map((agent) => {
    let skills: string[] = [];

    if (agent.charterPath) {
      const fullPath = resolve(projectRoot, agent.charterPath);
      if (existsSync(fullPath)) {
        const charterContent = readFileSync(fullPath, 'utf-8');
        skills = parseSkillsFromCharter(charterContent);
      }
    }

    return {
      id: `tm-${agent.name.toLowerCase()}-${nanoid(6)}`,
      name: agent.name,
      email: `${agent.name.toLowerCase()}@openspace.ai`,
      role: agent.role,
      department: inferDepartment(agent.role),
      skills: JSON.stringify(skills),
      rank: 'mid',
      status: normalizeStatus(agent.status),
      joined_at: now,
      updated_at: now,
    };
  });

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM team_members').run();

    const insert = db.prepare(`
      INSERT INTO team_members (id, name, email, role, department, skills, rank, status, joined_at, updated_at)
      VALUES (@id, @name, @email, @role, @department, @skills, @rank, @status, @joined_at, @updated_at)
    `);

    for (const row of rows) {
      insert.run(row);
    }

    db.prepare(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_team_seed', @ts)`,
    ).run({ ts: now });
  });

  transaction();

  return { inserted: rows.length, skipped: 0, total: rows.length };
}

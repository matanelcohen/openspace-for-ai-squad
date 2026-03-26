/**
 * Squad File Writer — writes team member data to .squad/ files.
 *
 * .squad/ is the source of truth; SQLite is a read cache.
 * When hiring/firing, we write files first then re-sync SQLite.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type Database from 'better-sqlite3';

import { syncTeamMembers } from './db/seed-team.js';

// ── Charter template ────────────────────────────────────────────

function generateCharter(name: string, role: string, skills: string[]): string {
  const expertiseList = skills.length > 0 ? skills.join(', ') : 'General';

  return `# ${name} — ${role}

> Dedicated squad member contributing ${role.toLowerCase()} expertise.

## Identity

- **Name:** ${name}
- **Role:** ${role}
- **Expertise:** ${expertiseList}
- **Style:** Professional and collaborative.

## What I Own

- Tasks assigned to me matching my role and expertise
- Quality of deliverables in my domain

## How I Work

- Focus on the task at hand and deliver results
- Communicate progress and blockers clearly
- Collaborate with other squad members when needed

## Boundaries

**I handle:** Work matching my role as ${role}

**I don't handle:** Work outside my expertise — I'll flag it for the right person

**When I'm unsure:** I ask for help or escalate to the lead.

## Model

- **Preferred:** auto
- **Rationale:** Coordinator selects the best model based on task type

## Collaboration

Before starting work, run \`git rev-parse --show-toplevel\` to find the repo root.
Before starting work, read \`.squad/decisions.md\` for team decisions that affect me.
After making a decision others should know, write it to \`.squad/decisions/inbox/${name.toLowerCase()}-{brief-slug}.md\`.
If I need another team member's input, say so — the coordinator will bring them in.
`;
}

// ── Public API ──────────────────────────────────────────────────

export interface HireMemberInput {
  name: string;
  role: string;
  skills?: string[];
  status?: string;
}

/**
 * Write a new team member to .squad/ files then sync SQLite.
 * Creates charter file and appends to team.md.
 */
export function hireToSquadFiles(
  db: Database.Database,
  squadDir: string,
  input: HireMemberInput,
): void {
  const absSquadDir = resolve(squadDir);
  const agentSlug = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // 1. Create charter file
  const agentDir = join(absSquadDir, 'agents', agentSlug);
  if (!existsSync(agentDir)) {
    mkdirSync(agentDir, { recursive: true });
  }

  const charterPath = join(agentDir, 'charter.md');
  if (!existsSync(charterPath)) {
    const charter = generateCharter(input.name, input.role, input.skills ?? []);
    writeFileSync(charterPath, charter, 'utf-8');
  }

  // 2. Append to team.md
  const teamMdPath = join(absSquadDir, 'team.md');
  if (existsSync(teamMdPath)) {
    const content = readFileSync(teamMdPath, 'utf-8');

    // Check if already listed
    const nameLower = input.name.toLowerCase();
    if (!content.toLowerCase().includes(`| ${nameLower} `)) {
      const statusEmoji = input.status === 'inactive' ? '⏸️ Inactive' : '🟢 Active';
      const charterRef = `.squad/agents/${agentSlug}/charter.md`;
      const newRow = `| ${input.name} | ${input.role} | ${charterRef} | ${statusEmoji} |`;

      // Insert before the last section (## Project Context) or at end of Members table
      const projectCtxIdx = content.indexOf('## Project Context');
      if (projectCtxIdx > 0) {
        const updated =
          content.slice(0, projectCtxIdx).trimEnd() + '\n' + newRow + '\n\n' + content.slice(projectCtxIdx);
        writeFileSync(teamMdPath, updated, 'utf-8');
      } else {
        writeFileSync(teamMdPath, content.trimEnd() + '\n' + newRow + '\n', 'utf-8');
      }
    }
  }

  // 3. Re-sync SQLite from files
  syncTeamMembers(db, absSquadDir);
}

/**
 * Remove a team member from .squad/team.md then sync SQLite.
 * Does NOT delete the charter directory (preserves history).
 */
export function fireFromSquadFiles(
  db: Database.Database,
  squadDir: string,
  name: string,
): void {
  const absSquadDir = resolve(squadDir);
  const teamMdPath = join(absSquadDir, 'team.md');

  if (existsSync(teamMdPath)) {
    const content = readFileSync(teamMdPath, 'utf-8');
    const lines = content.split('\n');

    // Remove the row containing this member's name
    const filtered = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) return true;
      const cells = trimmed.split('|').map((c) => c.trim()).filter(Boolean);
      return cells[0]?.toLowerCase() !== name.toLowerCase();
    });

    writeFileSync(teamMdPath, filtered.join('\n'), 'utf-8');
  }

  // Re-sync SQLite from files
  syncTeamMembers(db, absSquadDir);
}

/**
 * TeamMember service — CRUD operations backed directly by SQLite.
 *
 * Unlike tasks/decisions which use .squad/ markdown files as source-of-truth,
 * team members are stored exclusively in the SQLite database.
 */

import type { TeamMember, TeamMemberRank, TeamMemberStatus } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

// ── Types ─────────────────────────────────────────────────────────

export interface CreateTeamMemberInput {
  name: string;
  email: string;
  role: string;
  department: string;
  skills?: string[];
  rank?: TeamMemberRank;
  status?: TeamMemberStatus;
}

export interface UpdateTeamMemberInput {
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  skills?: string[];
  rank?: TeamMemberRank;
  status?: TeamMemberStatus;
}

export interface ListTeamMembersOptions {
  department?: string;
  status?: TeamMemberStatus;
  rank?: TeamMemberRank;
  search?: string;
}

// ── Row mapping ───────────────────────────────────────────────────

interface TeamMemberRow {
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

function rowToTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    skills: JSON.parse(row.skills) as string[],
    rank: row.rank as TeamMemberRank,
    status: row.status as TeamMemberStatus,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  };
}

// ── Service ───────────────────────────────────────────────────────

export class TeamMemberService {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** List team members with optional filtering. */
  list(opts: ListTeamMembersOptions = {}): TeamMember[] {
    const conditions: string[] = [];
    const params: Record<string, string> = {};

    if (opts.department) {
      conditions.push('department = @department');
      params.department = opts.department;
    }
    if (opts.status) {
      conditions.push('status = @status');
      params.status = opts.status;
    }
    if (opts.rank) {
      conditions.push('rank = @rank');
      params.rank = opts.rank;
    }

    if (opts.search) {
      // Use FTS5 for search — get matching IDs then join
      const safeQuery = opts.search
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => `"${term.replace(/"/g, '""')}"`)
        .join(' ');

      conditions.push(
        'id IN (SELECT id FROM team_members_fts WHERE team_members_fts MATCH @search)',
      );
      params.search = safeQuery || '""';
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM team_members ${where} ORDER BY name ASC`;

    const rows = this.db.prepare(sql).all(params) as TeamMemberRow[];
    return rows.map(rowToTeamMember);
  }

  /** Get a single team member by ID. Returns null if not found. */
  get(id: string): TeamMember | null {
    const row = this.db.prepare('SELECT * FROM team_members WHERE id = @id').get({ id }) as
      | TeamMemberRow
      | undefined;
    return row ? rowToTeamMember(row) : null;
  }

  /** Create a new team member. Returns the created record. */
  create(input: CreateTeamMemberInput): TeamMember {
    const now = new Date().toISOString();
    const id = `tm-${nanoid(12)}`;

    const row: TeamMemberRow = {
      id,
      name: input.name,
      email: input.email,
      role: input.role,
      department: input.department,
      skills: JSON.stringify(input.skills ?? []),
      rank: input.rank ?? 'mid',
      status: input.status ?? 'active',
      joined_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO team_members (id, name, email, role, department, skills, rank, status, joined_at, updated_at)
         VALUES (@id, @name, @email, @role, @department, @skills, @rank, @status, @joined_at, @updated_at)`,
      )
      .run(row);

    return rowToTeamMember(row);
  }

  /** Update an existing team member. Returns the updated record, or null if not found. */
  update(id: string, input: UpdateTeamMemberInput): TeamMember | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = @updated_at'];
    const params: Record<string, string> = { id, updated_at: now };

    if (input.name !== undefined) {
      updates.push('name = @name');
      params.name = input.name;
    }
    if (input.email !== undefined) {
      updates.push('email = @email');
      params.email = input.email;
    }
    if (input.role !== undefined) {
      updates.push('role = @role');
      params.role = input.role;
    }
    if (input.department !== undefined) {
      updates.push('department = @department');
      params.department = input.department;
    }
    if (input.skills !== undefined) {
      updates.push('skills = @skills');
      params.skills = JSON.stringify(input.skills);
    }
    if (input.rank !== undefined) {
      updates.push('rank = @rank');
      params.rank = input.rank;
    }
    if (input.status !== undefined) {
      updates.push('status = @status');
      params.status = input.status;
    }

    this.db.prepare(`UPDATE team_members SET ${updates.join(', ')} WHERE id = @id`).run(params);

    return this.get(id);
  }

  /** Delete a team member. Returns true if deleted, false if not found. */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM team_members WHERE id = @id').run({ id });
    return result.changes > 0;
  }

  /** Check if an email is already in use (optionally excluding a specific ID). */
  emailExists(email: string, excludeId?: string): boolean {
    const sql = excludeId
      ? 'SELECT 1 FROM team_members WHERE email = @email AND id != @excludeId'
      : 'SELECT 1 FROM team_members WHERE email = @email';
    const params = excludeId ? { email, excludeId } : { email };
    return !!this.db.prepare(sql).get(params);
  }
}

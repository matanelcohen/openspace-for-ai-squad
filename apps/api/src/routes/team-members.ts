/**
 * Team Members API — HR Department
 *
 * GET    /api/team-members              — List with filters: ?department=, ?status=, ?rank=, ?search=
 * GET    /api/team-members/:id          — Member detail
 * POST   /api/team-members              — Create member
 * PUT    /api/team-members/:id          — Full update
 * PATCH  /api/team-members/:id/rank     — Change rank only
 * PATCH  /api/team-members/:id/status   — Change status only
 * DELETE /api/team-members/:id          — Delete member
 */

import type { TeamMember, TeamMemberRank, TeamMemberStatus } from '@matanelcohen/openspace-shared';
import { TEAM_MEMBER_RANKS, TEAM_MEMBER_STATUSES } from '@matanelcohen/openspace-shared';
import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidStatus(v: unknown): v is TeamMemberStatus {
  return typeof v === 'string' && (TEAM_MEMBER_STATUSES as readonly string[]).includes(v);
}

function isValidRank(v: unknown): v is TeamMemberRank {
  return typeof v === 'string' && (TEAM_MEMBER_RANKS as readonly string[]).includes(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// ---------------------------------------------------------------------------
// DB row ↔ TeamMember mapping
// ---------------------------------------------------------------------------

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

function rowToMember(row: TeamMemberRow): TeamMember {
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

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface TeamMembersQuerystring {
  department?: string;
  status?: string;
  rank?: string;
  search?: string;
}

interface CreateTeamMemberBody {
  name: string;
  email: string;
  role: string;
  department: string;
  skills?: string[];
  rank?: TeamMemberRank;
  status?: TeamMemberStatus;
}

interface UpdateTeamMemberBody {
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  skills?: string[];
  rank?: TeamMemberRank;
  status?: TeamMemberStatus;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

const teamMembersRoute: FastifyPluginAsync = async (app) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = () => (app as any).db;

  // GET /api/team-members — list with optional filters
  app.get<{ Querystring: TeamMembersQuerystring }>('/team-members', async (request, reply) => {
    const { department, status, rank, search } = request.query;

    if (status && !isValidStatus(status)) {
      return reply.status(400).send({ error: `Invalid status filter: ${status}` });
    }
    if (rank && !isValidRank(rank)) {
      return reply.status(400).send({ error: `Invalid rank filter: ${rank}` });
    }

    const conditions: string[] = [];
    const params: Record<string, string> = {};

    if (department) {
      conditions.push('department = $department');
      params.$department = department;
    }
    if (status) {
      conditions.push('status = $status');
      params.$status = status;
    }
    if (rank) {
      conditions.push('rank = $rank');
      params.$rank = rank;
    }
    if (search) {
      conditions.push('(name LIKE $search OR role LIKE $search OR email LIKE $search)');
      params.$search = `%${search}%`;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM team_members ${where} ORDER BY name ASC`;

    const rows = db().prepare(sql).all(params) as TeamMemberRow[];
    return reply.send(rows.map(rowToMember));
  });

  // GET /api/team-members/:id — detail
  app.get<{ Params: { id: string } }>('/team-members/:id', async (request, reply) => {
    const row = db().prepare('SELECT * FROM team_members WHERE id = ?').get(request.params.id) as
      | TeamMemberRow
      | undefined;

    if (!row) {
      return reply.status(404).send({ error: `Team member not found: ${request.params.id}` });
    }
    return reply.send(rowToMember(row));
  });

  // POST /api/team-members — create
  app.post<{ Body: CreateTeamMemberBody }>('/team-members', async (request, reply) => {
    const body = request.body;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }
    if (!isNonEmptyString(body.name)) {
      return reply
        .status(400)
        .send({ error: 'Field "name" is required and must be a non-empty string' });
    }
    if (!isValidEmail(body.email)) {
      return reply
        .status(400)
        .send({ error: 'Field "email" is required and must be a valid email address' });
    }
    if (!isNonEmptyString(body.role)) {
      return reply
        .status(400)
        .send({ error: 'Field "role" is required and must be a non-empty string' });
    }
    if (!isNonEmptyString(body.department)) {
      return reply
        .status(400)
        .send({ error: 'Field "department" is required and must be a non-empty string' });
    }
    if (body.rank !== undefined && !isValidRank(body.rank)) {
      return reply.status(400).send({ error: `Invalid rank: ${body.rank}` });
    }
    if (body.status !== undefined && !isValidStatus(body.status)) {
      return reply.status(400).send({ error: `Invalid status: ${body.status}` });
    }

    // Check for duplicate email
    const existing = db().prepare('SELECT id FROM team_members WHERE email = ?').get(body.email) as
      | { id: string }
      | undefined;
    if (existing) {
      return reply
        .status(409)
        .send({ error: `A team member with email "${body.email}" already exists` });
    }

    const id = `member-${nanoid(10)}`;
    const now = new Date().toISOString();
    const skills = body.skills ?? [];
    const rank = body.rank ?? 'mid';
    const status = body.status ?? 'active';

    db()
      .prepare(
        `INSERT INTO team_members (id, name, email, role, department, skills, rank, status, joined_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        body.name.trim(),
        body.email.trim(),
        body.role.trim(),
        body.department.trim(),
        JSON.stringify(skills),
        rank,
        status,
        now,
        now,
      );

    const row = db().prepare('SELECT * FROM team_members WHERE id = ?').get(id) as TeamMemberRow;
    return reply.status(201).send(rowToMember(row));
  });

  // PUT /api/team-members/:id — full update
  app.put<{ Params: { id: string }; Body: UpdateTeamMemberBody }>(
    '/team-members/:id',
    async (request, reply) => {
      const body = request.body;
      if (!body || typeof body !== 'object') {
        return reply.status(400).send({ error: 'Request body is required' });
      }
      if (body.name !== undefined && !isNonEmptyString(body.name)) {
        return reply.status(400).send({ error: 'Field "name" must be a non-empty string' });
      }
      if (body.email !== undefined && !isValidEmail(body.email)) {
        return reply.status(400).send({ error: 'Field "email" must be a valid email address' });
      }
      if (body.rank !== undefined && !isValidRank(body.rank)) {
        return reply.status(400).send({ error: `Invalid rank: ${body.rank}` });
      }
      if (body.status !== undefined && !isValidStatus(body.status)) {
        return reply.status(400).send({ error: `Invalid status: ${body.status}` });
      }

      const existing = db()
        .prepare('SELECT * FROM team_members WHERE id = ?')
        .get(request.params.id) as TeamMemberRow | undefined;

      if (!existing) {
        return reply.status(404).send({ error: `Team member not found: ${request.params.id}` });
      }

      // Check email uniqueness if changing email
      if (body.email && body.email !== existing.email) {
        const dup = db()
          .prepare('SELECT id FROM team_members WHERE email = ? AND id != ?')
          .get(body.email, request.params.id) as { id: string } | undefined;
        if (dup) {
          return reply
            .status(409)
            .send({ error: `A team member with email "${body.email}" already exists` });
        }
      }

      const now = new Date().toISOString();
      const updates: string[] = ['updated_at = ?'];
      const values: unknown[] = [now];

      if (body.name !== undefined) {
        updates.push('name = ?');
        values.push(body.name.trim());
      }
      if (body.email !== undefined) {
        updates.push('email = ?');
        values.push(body.email.trim());
      }
      if (body.role !== undefined) {
        updates.push('role = ?');
        values.push(body.role);
      }
      if (body.department !== undefined) {
        updates.push('department = ?');
        values.push(body.department);
      }
      if (body.skills !== undefined) {
        updates.push('skills = ?');
        values.push(JSON.stringify(body.skills));
      }
      if (body.rank !== undefined) {
        updates.push('rank = ?');
        values.push(body.rank);
      }
      if (body.status !== undefined) {
        updates.push('status = ?');
        values.push(body.status);
      }

      values.push(request.params.id);
      db()
        .prepare(`UPDATE team_members SET ${updates.join(', ')} WHERE id = ?`)
        .run(...values);

      const row = db()
        .prepare('SELECT * FROM team_members WHERE id = ?')
        .get(request.params.id) as TeamMemberRow;
      return reply.send(rowToMember(row));
    },
  );

  // PATCH /api/team-members/:id/rank — change rank only
  app.patch<{ Params: { id: string }; Body: { rank: TeamMemberRank } }>(
    '/team-members/:id/rank',
    async (request, reply) => {
      const { rank } = request.body ?? {};
      if (!isValidRank(rank)) {
        return reply.status(400).send({ error: `Invalid or missing rank: ${rank}` });
      }

      const existing = db()
        .prepare('SELECT id FROM team_members WHERE id = ?')
        .get(request.params.id) as { id: string } | undefined;

      if (!existing) {
        return reply.status(404).send({ error: `Team member not found: ${request.params.id}` });
      }

      const now = new Date().toISOString();
      db()
        .prepare('UPDATE team_members SET rank = ?, updated_at = ? WHERE id = ?')
        .run(rank, now, request.params.id);

      const row = db()
        .prepare('SELECT * FROM team_members WHERE id = ?')
        .get(request.params.id) as TeamMemberRow;
      return reply.send(rowToMember(row));
    },
  );

  // PATCH /api/team-members/:id/status — change status only
  app.patch<{ Params: { id: string }; Body: { status: TeamMemberStatus } }>(
    '/team-members/:id/status',
    async (request, reply) => {
      const { status } = request.body ?? {};
      if (!isValidStatus(status)) {
        return reply.status(400).send({ error: `Invalid or missing status: ${status}` });
      }

      const existing = db()
        .prepare('SELECT id FROM team_members WHERE id = ?')
        .get(request.params.id) as { id: string } | undefined;

      if (!existing) {
        return reply.status(404).send({ error: `Team member not found: ${request.params.id}` });
      }

      const now = new Date().toISOString();
      db()
        .prepare('UPDATE team_members SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, now, request.params.id);

      const row = db()
        .prepare('SELECT * FROM team_members WHERE id = ?')
        .get(request.params.id) as TeamMemberRow;
      return reply.send(rowToMember(row));
    },
  );

  // DELETE /api/team-members/:id
  app.delete<{ Params: { id: string } }>('/team-members/:id', async (request, reply) => {
    const existing = db()
      .prepare('SELECT id FROM team_members WHERE id = ?')
      .get(request.params.id) as { id: string } | undefined;

    if (!existing) {
      return reply.status(404).send({ error: `Team member not found: ${request.params.id}` });
    }

    db().prepare('DELETE FROM team_members WHERE id = ?').run(request.params.id);
    return reply.status(204).send();
  });

  // GET /api/team-members/:id/tasks — get tasks assigned to this member
  app.get<{ Params: { id: string } }>('/team-members/:id/tasks', async (request, reply) => {
    // First verify the team member exists
    const member = db()
      .prepare('SELECT id FROM team_members WHERE id = ?')
      .get(request.params.id) as { id: string } | undefined;

    if (!member) {
      return reply.status(404).send({ error: `Team member not found: ${request.params.id}` });
    }

    // Get all tasks assigned to this team member
    const tasks = db()
      .prepare(
        `
        SELECT 
          id, title, description, status, priority, assignee, 
          labels, created_at, updated_at, sort_index
        FROM tasks 
        WHERE assignee = ?
        ORDER BY status = 'in-progress' DESC, priority, sort_index, created_at
      `,
      )
      .all(request.params.id) as Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority: string;
      assignee: string;
      labels: string;
      created_at: string;
      updated_at: string;
      sort_index: number;
    }>;

    // Format the response to match Task interface
    const formattedTasks = tasks.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assignee: row.assignee,
      assigneeType: 'member' as const,
      labels: JSON.parse(row.labels || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sortIndex: row.sort_index,
    }));

    return reply.send(formattedTasks);
  });
};

export default teamMembersRoute;

/**
 * Integration tests — Channel CRUD lifecycle
 *
 * Tests the full channel API through Fastify inject() with a real
 * in-memory SQLite database:
 *   GET    /api/channels       — list all channels
 *   GET    /api/channels/:id   — get a single channel
 *   POST   /api/channels       — create a channel
 *   PUT    /api/channels/:id   — update a channel
 *   DELETE /api/channels/:id   — delete a channel
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ChatChannel } from '@openspace/shared';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import channelsRoute from '../../routes/channels.js';
import { ChatService } from '../../services/chat/index.js';
import { initializeSchema } from '../../services/db/schema.js';
import type { WebSocketManager } from '../../services/websocket/index.js';

// ── Mock WebSocket Manager ────────────────────────────────────────

class MockWsManager {
  broadcasts: unknown[] = [];
  broadcast(envelope: unknown) {
    this.broadcasts.push(envelope);
  }
}

// ── Test lifecycle ────────────────────────────────────────────────

let app: FastifyInstance;
let db: Database.Database;
let tmpDir: string;

beforeEach(async () => {
  db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);

  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'channel-integ-test-'));

  const chatService = new ChatService({ db, sessionsDir: tmpDir });
  const mockWs = new MockWsManager();
  chatService.setWebSocketManager(mockWs as unknown as WebSocketManager);

  app = Fastify({ logger: false });
  app.decorate('chatService', chatService);
  app.register(channelsRoute, { prefix: '/api' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

// ── Helpers ───────────────────────────────────────────────────────

async function createChannel(
  payload: Record<string, unknown>,
): Promise<{ statusCode: number; body: ChatChannel }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/channels',
    payload,
  });
  return { statusCode: res.statusCode, body: res.json() as ChatChannel };
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/channels — List
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/channels', () => {
  it('returns 200 with an empty array when no channels exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns all channels after creating multiple', async () => {
    await createChannel({ name: 'Frontend', memberAgentIds: ['fry'] });
    await createChannel({ name: 'Backend', memberAgentIds: ['bender'] });

    const res = await app.inject({ method: 'GET', url: '/api/channels' });

    expect(res.statusCode).toBe(200);
    const channels = res.json() as ChatChannel[];
    expect(channels).toHaveLength(2);
    const names = channels.map((c) => c.name);
    expect(names).toContain('Frontend');
    expect(names).toContain('Backend');
  });

  it('each channel in the list has the correct shape', async () => {
    await createChannel({ name: 'Shape Test', memberAgentIds: ['leela'] });

    const res = await app.inject({ method: 'GET', url: '/api/channels' });
    const channels = res.json() as ChatChannel[];

    for (const channel of channels) {
      expect(channel).toHaveProperty('id');
      expect(channel).toHaveProperty('name');
      expect(channel).toHaveProperty('description');
      expect(channel).toHaveProperty('memberAgentIds');
      expect(channel).toHaveProperty('createdAt');
      expect(channel).toHaveProperty('updatedAt');
      expect(typeof channel.id).toBe('string');
      expect(typeof channel.name).toBe('string');
      expect(Array.isArray(channel.memberAgentIds)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/channels/:id — Read
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/channels/:id', () => {
  it('returns 200 with the channel when found', async () => {
    const { body: created } = await createChannel({
      name: 'Readable',
      description: 'Read me',
      memberAgentIds: ['bender'],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${created.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as ChatChannel;
    expect(body.id).toBe(created.id);
    expect(body.name).toBe('Readable');
    expect(body.description).toBe('Read me');
    expect(body.memberAgentIds).toEqual(['bender']);
  });

  it('returns 404 for a non-existent channel ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/chan-does-not-exist',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty('error');
    expect(res.json().error).toContain('Channel not found');
  });

  it('returns 404 for an empty ID', async () => {
    // Fastify may interpret `/api/channels/` as the list endpoint
    // but let's test a truly invalid-looking ID
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/---',
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for a UUID-format ID that does not exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/channels — Create
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/channels', () => {
  it('creates a channel and returns 201 with the channel', async () => {
    const { statusCode, body } = await createChannel({
      name: 'New Channel',
      description: 'Testing creation',
      memberAgentIds: ['bender', 'fry'],
    });

    expect(statusCode).toBe(201);
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe('string');
    expect(body.name).toBe('New Channel');
    expect(body.description).toBe('Testing creation');
    expect(body.memberAgentIds).toEqual(['bender', 'fry']);
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('applies defaults for optional fields', async () => {
    const { body } = await createChannel({
      name: 'Minimal',
      memberAgentIds: ['fry'],
    });

    expect(body.description).toBe('');
    expect(body.name).toBe('Minimal');
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { description: 'No name here' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('name');
  });

  it('returns 400 when name is empty string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name is whitespace only', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: '   ' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name is not a string (number)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 123 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name is null', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: null },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns error when creating a channel with duplicate name', async () => {
    await createChannel({ name: 'Unique', memberAgentIds: ['fry'] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Unique', memberAgentIds: ['bender'] },
    });

    // ChannelValidationError(DUPLICATE_NAME) bubbles to error handler
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.json().error).toBeDefined();
  });

  it('returns error when memberAgentIds is an explicit empty array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Empty members', memberAgentIds: [] },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.json().error).toBeDefined();
  });

  it('trims whitespace from name', async () => {
    const { body } = await createChannel({
      name: '  Padded  ',
      memberAgentIds: ['fry'],
    });

    expect(body.name).toBe('Padded');
  });

  it('persists the channel so it appears in the list', async () => {
    const { body: created } = await createChannel({
      name: 'Persist Check',
      memberAgentIds: ['leela'],
    });

    const res = await app.inject({ method: 'GET', url: '/api/channels' });
    const channels = res.json() as ChatChannel[];

    expect(channels.some((c) => c.id === created.id)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PUT /api/channels/:id — Update
// ═══════════════════════════════════════════════════════════════════

describe('PUT /api/channels/:id', () => {
  it('updates channel name and returns 200', async () => {
    const { body: created } = await createChannel({
      name: 'Original',
      memberAgentIds: ['bender'],
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${created.id}`,
      payload: { name: 'Renamed' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as ChatChannel;
    expect(body.name).toBe('Renamed');
    expect(body.id).toBe(created.id);
  });

  it('updates description', async () => {
    const { body: created } = await createChannel({
      name: 'Desc Test',
      memberAgentIds: ['fry'],
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${created.id}`,
      payload: { description: 'Updated description' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().description).toBe('Updated description');
  });

  it('updates memberAgentIds', async () => {
    const { body: created } = await createChannel({
      name: 'Members Test',
      memberAgentIds: ['bender'],
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${created.id}`,
      payload: { memberAgentIds: ['bender', 'fry', 'leela'] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().memberAgentIds).toEqual(['bender', 'fry', 'leela']);
  });

  it('preserves fields not included in the update', async () => {
    const { body: created } = await createChannel({
      name: 'Preserve',
      description: 'Keep this',
      memberAgentIds: ['zoidberg'],
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${created.id}`,
      payload: { name: 'New name only' },
    });

    const body = res.json() as ChatChannel;
    expect(body.name).toBe('New name only');
    expect(body.description).toBe('Keep this');
    expect(body.memberAgentIds).toEqual(['zoidberg']);
  });

  it('bumps updatedAt on update', async () => {
    const { body: created } = await createChannel({
      name: 'Timestamp',
      memberAgentIds: ['fry'],
    });
    const beforeUpdate = new Date(created.updatedAt).getTime();

    // Small delay to ensure timestamp advances
    await new Promise((r) => setTimeout(r, 10));

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${created.id}`,
      payload: { name: 'Timestamp Updated' },
    });

    const after = res.json() as ChatChannel;
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(beforeUpdate);
  });

  it('returns 404 for non-existent channel', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/nonexistent',
      payload: { name: 'Ghost update' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('Channel not found');
  });

  it('returns error for duplicate name on rename', async () => {
    await createChannel({ name: 'Alpha', memberAgentIds: ['fry'] });
    const { body: beta } = await createChannel({ name: 'Beta', memberAgentIds: ['bender'] });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${beta.id}`,
      payload: { name: 'Alpha' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.json().error).toBeDefined();
  });

  it('returns error when setting memberAgentIds to empty array', async () => {
    const { body: created } = await createChannel({
      name: 'Empty Members',
      memberAgentIds: ['fry'],
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${created.id}`,
      payload: { memberAgentIds: [] },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/channels/:id — Delete
// ═══════════════════════════════════════════════════════════════════

describe('DELETE /api/channels/:id', () => {
  it('deletes a channel and returns 204', async () => {
    const { body: created } = await createChannel({
      name: 'Delete Me',
      memberAgentIds: ['bender'],
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/channels/${created.id}`,
    });

    expect(res.statusCode).toBe(204);
  });

  it('channel is gone after deletion', async () => {
    const { body: created } = await createChannel({
      name: 'Gone',
      memberAgentIds: ['fry'],
    });

    await app.inject({
      method: 'DELETE',
      url: `/api/channels/${created.id}`,
    });

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/channels/${created.id}`,
    });

    expect(getRes.statusCode).toBe(404);
  });

  it('returns 404 for non-existent channel', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/channels/nonexistent',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('Channel not found');
  });

  it('does not affect other channels', async () => {
    const { body: keep } = await createChannel({ name: 'Keep', memberAgentIds: ['fry'] });
    const { body: remove } = await createChannel({ name: 'Remove', memberAgentIds: ['bender'] });

    await app.inject({
      method: 'DELETE',
      url: `/api/channels/${remove.id}`,
    });

    const listRes = await app.inject({ method: 'GET', url: '/api/channels' });
    const channels = listRes.json() as ChatChannel[];

    expect(channels).toHaveLength(1);
    expect(channels[0]!.id).toBe(keep.id);
  });

  it('double-delete returns 404 on the second attempt', async () => {
    const { body: created } = await createChannel({
      name: 'Double Delete',
      memberAgentIds: ['leela'],
    });

    const first = await app.inject({
      method: 'DELETE',
      url: `/api/channels/${created.id}`,
    });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({
      method: 'DELETE',
      url: `/api/channels/${created.id}`,
    });
    expect(second.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Full CRUD lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('Full CRUD lifecycle', () => {
  it('create → read → list → update → read → delete → verify gone', async () => {
    // 1. Create
    const { statusCode: createStatus, body: created } = await createChannel({
      name: 'Lifecycle Channel',
      description: 'Testing full lifecycle',
      memberAgentIds: ['bender', 'fry'],
    });
    expect(createStatus).toBe(201);
    expect(created.id).toBeDefined();

    // 2. Read
    const readRes = await app.inject({
      method: 'GET',
      url: `/api/channels/${created.id}`,
    });
    expect(readRes.statusCode).toBe(200);
    expect(readRes.json().name).toBe('Lifecycle Channel');

    // 3. List — should contain the channel
    const listRes = await app.inject({ method: 'GET', url: '/api/channels' });
    expect(listRes.statusCode).toBe(200);
    const channels = listRes.json() as ChatChannel[];
    expect(channels.some((c) => c.id === created.id)).toBe(true);

    // 4. Update
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/channels/${created.id}`,
      payload: {
        name: 'Lifecycle Updated',
        description: 'Updated description',
        memberAgentIds: ['leela', 'zoidberg'],
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json() as ChatChannel;
    expect(updated.name).toBe('Lifecycle Updated');
    expect(updated.memberAgentIds).toEqual(['leela', 'zoidberg']);

    // 5. Read again to confirm persistence
    const rereadRes = await app.inject({
      method: 'GET',
      url: `/api/channels/${created.id}`,
    });
    expect(rereadRes.json().name).toBe('Lifecycle Updated');
    expect(rereadRes.json().description).toBe('Updated description');

    // 6. Delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/channels/${created.id}`,
    });
    expect(deleteRes.statusCode).toBe(204);

    // 7. Verify deletion
    const goneRes = await app.inject({
      method: 'GET',
      url: `/api/channels/${created.id}`,
    });
    expect(goneRes.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('channel name with special characters', async () => {
    const { statusCode, body } = await createChannel({
      name: 'Team (α) — "special" & <tags>',
      memberAgentIds: ['fry'],
    });

    expect(statusCode).toBe(201);
    expect(body.name).toBe('Team (α) — "special" & <tags>');
  });

  it('rejects channel name exceeding 100 characters', async () => {
    const longName = 'A'.repeat(101);
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: longName, memberAgentIds: ['bender'] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('accepts channel name at exactly 100 characters', async () => {
    const maxName = 'B'.repeat(100);
    const { statusCode, body } = await createChannel({
      name: maxName,
      memberAgentIds: ['bender'],
    });

    expect(statusCode).toBe(201);
    expect(body.name).toBe(maxName);
  });

  it('channel with many members', async () => {
    const manyMembers = Array.from({ length: 50 }, (_, i) => `agent-${i}`);
    const { statusCode, body } = await createChannel({
      name: 'Crowd',
      memberAgentIds: manyMembers,
    });

    expect(statusCode).toBe(201);
    expect(body.memberAgentIds).toHaveLength(50);
  });

  it('channel description can be an empty string', async () => {
    const { body } = await createChannel({
      name: 'No Desc',
      description: '',
      memberAgentIds: ['leela'],
    });

    expect(body.description).toBe('');
  });

  it('creating multiple channels and listing preserves all', async () => {
    const count = 10;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const { body } = await createChannel({
        name: `Channel ${i}`,
        memberAgentIds: ['fry'],
      });
      ids.push(body.id);
    }

    const res = await app.inject({ method: 'GET', url: '/api/channels' });
    const channels = res.json() as ChatChannel[];
    expect(channels).toHaveLength(count);

    for (const id of ids) {
      expect(channels.some((c) => c.id === id)).toBe(true);
    }
  });

  it('timestamps are valid ISO-8601', async () => {
    const { body } = await createChannel({
      name: 'Timestamps',
      memberAgentIds: ['zoidberg'],
    });

    expect(() => new Date(body.createdAt)).not.toThrow();
    expect(() => new Date(body.updatedAt)).not.toThrow();
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /api/channels/:id — Partial Update
// ═══════════════════════════════════════════════════════════════════

describe('PATCH /api/channels/:id', () => {
  it('updates channel name via PATCH and returns 200', async () => {
    const { body: created } = await createChannel({
      name: 'PatchMe',
      description: 'original',
      memberAgentIds: ['bender'],
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/channels/${created.id}`,
      payload: { name: 'Patched' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as ChatChannel;
    expect(body.name).toBe('Patched');
    expect(body.description).toBe('original');
    expect(body.memberAgentIds).toEqual(['bender']);
  });

  it('updates only description via PATCH, preserving other fields', async () => {
    const { body: created } = await createChannel({
      name: 'PatchDesc',
      description: 'old desc',
      memberAgentIds: ['fry', 'leela'],
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/channels/${created.id}`,
      payload: { description: 'new desc' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as ChatChannel;
    expect(body.name).toBe('PatchDesc');
    expect(body.description).toBe('new desc');
    expect(body.memberAgentIds).toEqual(['fry', 'leela']);
  });

  it('updates memberAgentIds via PATCH', async () => {
    const { body: created } = await createChannel({
      name: 'PatchMembers',
      memberAgentIds: ['bender'],
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/channels/${created.id}`,
      payload: { memberAgentIds: ['fry', 'leela', 'zoidberg'] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().memberAgentIds).toEqual(['fry', 'leela', 'zoidberg']);
  });

  it('returns 404 for non-existent channel via PATCH', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/channels/nonexistent',
      payload: { name: 'Ghost' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('Channel not found');
  });

  it('returns error for duplicate name via PATCH', async () => {
    await createChannel({ name: 'Alpha', memberAgentIds: ['fry'] });
    const { body: beta } = await createChannel({ name: 'Beta', memberAgentIds: ['bender'] });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/channels/${beta.id}`,
      payload: { name: 'Alpha' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.json().error).toBeDefined();
  });

  it('PATCH and PUT produce equivalent results', async () => {
    const { body: ch1 } = await createChannel({ name: 'Via PUT', memberAgentIds: ['fry'] });
    const { body: ch2 } = await createChannel({ name: 'Via PATCH', memberAgentIds: ['fry'] });

    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/channels/${ch1.id}`,
      payload: { description: 'updated' },
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/channels/${ch2.id}`,
      payload: { description: 'updated' },
    });

    expect(putRes.statusCode).toBe(200);
    expect(patchRes.statusCode).toBe(200);
    expect(putRes.json().description).toBe('updated');
    expect(patchRes.json().description).toBe('updated');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Error handler edge cases
// ═══════════════════════════════════════════════════════════════════

describe('Error handler edge cases', () => {
  it('returns 409 for DUPLICATE_NAME via POST', async () => {
    await createChannel({ name: 'Conflict', memberAgentIds: ['fry'] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Conflict', memberAgentIds: ['bender'] },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('CONFLICT');
  });

  it('returns 409 for DUPLICATE_NAME via PUT', async () => {
    await createChannel({ name: 'Taken', memberAgentIds: ['fry'] });
    const { body: other } = await createChannel({ name: 'Other', memberAgentIds: ['bender'] });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/channels/${other.id}`,
      payload: { name: 'Taken' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('CONFLICT');
  });

  it('returns structured error body on validation failures', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { description: 'missing name' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('statusCode');
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.statusCode).toBe(400);
  });

  it('returns structured error body on 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/does-not-exist',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
    expect(body.code).toBe('NOT_FOUND');
    expect(body.statusCode).toBe(404);
  });

  it('returns 400 for EMPTY_MEMBER_LIST with correct error code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'BadMembers', memberAgentIds: [] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

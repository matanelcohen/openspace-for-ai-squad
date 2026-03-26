/**
 * Unit tests — Channel CRUD endpoints (routes/channels.ts)
 *
 * Tests the 5 channel endpoints with a mocked ChatService:
 *   GET    /api/channels       — list all channels
 *   GET    /api/channels/:id   — get a single channel
 *   POST   /api/channels       — create a channel
 *   PUT    /api/channels/:id   — update a channel
 *   DELETE /api/channels/:id   — delete a channel
 *
 * Uses a standalone Fastify instance with channelsRoute registered directly
 * and a mock ChatService so we can test route-layer validation in isolation.
 */

import type { ChatChannel } from '@openspace/shared';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ChannelValidationCode,
  ChannelValidationError,
  type ChatService,
  type DeleteChannelResult,
} from '../services/chat/index.js';
import channelsRoute from './channels.js';

// ── Test helpers ──────────────────────────────────────────────────

function makeChannel(overrides: Partial<ChatChannel> = {}): ChatChannel {
  return {
    id: 'chan-test1234',
    name: 'Test Channel',
    description: 'A test channel',
    memberAgentIds: ['bender', 'fry'],
    createdAt: '2026-03-25T10:00:00.000Z',
    updatedAt: '2026-03-25T10:00:00.000Z',
    ...overrides,
  };
}

type MockChatService = {
  [K in keyof ChatService]: ChatService[K] extends (...args: infer A) => infer R
    ? ReturnType<typeof vi.fn<(...args: A) => R>>
    : ChatService[K];
};

function createMockChatService(): MockChatService {
  return {
    listChannels: vi.fn(() => []),
    getChannel: vi.fn(() => null),
    createChannel: vi.fn(() => makeChannel()),
    updateChannel: vi.fn(() => null),
    deleteChannel: vi.fn(() => ({ deleted: false, deletedMessages: 0 }) as DeleteChannelResult),
    // Stubs for non-channel methods required by type compatibility
    send: vi.fn(),
    sendStream: vi.fn(),
    getMessages: vi.fn(() => ({ messages: [], total: 0 })),
    clearMessages: vi.fn(() => ({ deleted: 0 })),
    setWebSocketManager: vi.fn(),
    setAIProvider: vi.fn(),
    setActivityFeed: vi.fn(),
  } as unknown as MockChatService;
}

// ── Fixture ───────────────────────────────────────────────────────

let app: FastifyInstance;
let mockService: MockChatService;

beforeEach(async () => {
  mockService = createMockChatService();

  app = Fastify({ logger: false });
  app.decorate('chatService', mockService as unknown as ChatService);
  app.register(channelsRoute, { prefix: '/api' });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/channels
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/channels', () => {
  it('returns 200 with an empty array when no channels exist', async () => {
    mockService.listChannels.mockReturnValue([]);

    const res = await app.inject({ method: 'GET', url: '/api/channels' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect(mockService.listChannels).toHaveBeenCalledOnce();
  });

  it('returns 200 with a list of channels', async () => {
    const channels = [
      makeChannel({ id: 'chan-aaaa1111', name: 'Frontend' }),
      makeChannel({ id: 'chan-bbbb2222', name: 'Backend' }),
    ];
    mockService.listChannels.mockReturnValue(channels);

    const res = await app.inject({ method: 'GET', url: '/api/channels' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe('chan-aaaa1111');
    expect(body[1].name).toBe('Backend');
  });

  it('returns JSON content-type', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ── GET /api/channels — query parameter validation ───────────────

describe('GET /api/channels — query validation', () => {
  it('returns 400 when limit is 0', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?limit=0' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when limit exceeds maximum (200)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?limit=201' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when limit is negative', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?limit=-1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when offset is negative', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?offset=-1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when unknown query parameter is sent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels?foo=bar' });
    expect(res.statusCode).toBe(400);
  });

  it('accepts valid limit and offset', async () => {
    mockService.listChannels.mockReturnValue([]);
    const res = await app.inject({ method: 'GET', url: '/api/channels?limit=10&offset=5' });
    expect(res.statusCode).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/channels/:id
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/channels/:id', () => {
  it('returns 200 with the channel when found', async () => {
    const channel = makeChannel({ id: 'chan-found123' });
    mockService.getChannel.mockReturnValue(channel);

    const res = await app.inject({ method: 'GET', url: '/api/channels/chan-found123' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe('chan-found123');
    expect(body.name).toBe('Test Channel');
    expect(body.memberAgentIds).toEqual(['bender', 'fry']);
    expect(mockService.getChannel).toHaveBeenCalledWith('chan-found123');
  });

  it('returns 404 when channel not found', async () => {
    mockService.getChannel.mockReturnValue(null);

    const res = await app.inject({ method: 'GET', url: '/api/channels/nonexistent' });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('Channel not found');
  });

  it('returns correct body shape on 404', async () => {
    mockService.getChannel.mockReturnValue(null);

    const res = await app.inject({ method: 'GET', url: '/api/channels/ghost' });

    expect(res.json()).toHaveProperty('error');
    expect(typeof res.json().error).toBe('string');
  });

  it('returns full ChatChannel shape on success', async () => {
    const channel = makeChannel();
    mockService.getChannel.mockReturnValue(channel);

    const res = await app.inject({ method: 'GET', url: '/api/channels/chan-test1234' });
    const body = res.json();

    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('description');
    expect(body).toHaveProperty('memberAgentIds');
    expect(body).toHaveProperty('createdAt');
    expect(body).toHaveProperty('updatedAt');
    expect(Array.isArray(body.memberAgentIds)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/channels
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/channels', () => {
  it('returns 201 with created channel', async () => {
    const channel = makeChannel({ name: 'New Channel' });
    mockService.createChannel.mockReturnValue(channel);

    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'New Channel', memberAgentIds: ['bender', 'fry'] },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('New Channel');
    expect(mockService.createChannel).toHaveBeenCalledWith({
      name: 'New Channel',
      description: undefined,
      memberAgentIds: ['bender', 'fry'],
    });
  });

  it('trims the name before passing to service', async () => {
    mockService.createChannel.mockReturnValue(makeChannel());

    await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: '  Padded Name  ' },
    });

    expect(mockService.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Padded Name' }),
    );
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { description: 'No name provided' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBeDefined();
    expect(mockService.createChannel).not.toHaveBeenCalled();
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

  it('returns 400 when name is not a string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 42 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when body is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });

  it('passes optional description and memberAgentIds to service', async () => {
    mockService.createChannel.mockReturnValue(makeChannel());

    await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: {
        name: 'Full channel',
        description: 'A full description',
        memberAgentIds: ['leela', 'zoidberg'],
      },
    });

    expect(mockService.createChannel).toHaveBeenCalledWith({
      name: 'Full channel',
      description: 'A full description',
      memberAgentIds: ['leela', 'zoidberg'],
    });
  });

  it('trims description when provided', async () => {
    mockService.createChannel.mockReturnValue(makeChannel());

    await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Trimmed', description: '  padded  ' },
    });

    expect(mockService.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'padded' }),
    );
  });

  it('sets Location header on 201 response', async () => {
    const channel = makeChannel({ id: 'chan-loc12345' });
    mockService.createChannel.mockReturnValue(channel);

    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Location Test' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.headers['location']).toBe('/api/channels/chan-loc12345');
  });

  it('propagates ChannelValidationError as error response', async () => {
    mockService.createChannel.mockImplementation(() => {
      throw new ChannelValidationError('DUPLICATE_NAME', 'A channel named "X" already exists');
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'X' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.json().error).toBeDefined();
  });

  it('propagates EMPTY_MEMBER_LIST error', async () => {
    mockService.createChannel.mockImplementation(() => {
      throw new ChannelValidationError(
        'EMPTY_MEMBER_LIST',
        'memberAgentIds must not be an empty array when provided',
      );
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Empty Members', memberAgentIds: [] },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.json().error).toBeDefined();
  });
});

// ── POST /api/channels — body schema validation ─────────────────

describe('POST /api/channels — body validation', () => {
  it('returns 400 when name exceeds 100 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'A'.repeat(101) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('accepts name at exactly 100 characters', async () => {
    mockService.createChannel.mockReturnValue(makeChannel());

    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'A'.repeat(100) },
    });

    expect(res.statusCode).toBe(201);
  });

  it('returns 400 when description exceeds 500 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Valid', description: 'D'.repeat(501) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when memberAgentIds contains empty strings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Valid', memberAgentIds: [''] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when memberAgentIds is not an array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Valid', memberAgentIds: 'not-an-array' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when additional properties are sent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/channels',
      payload: { name: 'Valid', extraField: true },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PUT /api/channels/:id
// ═══════════════════════════════════════════════════════════════════

describe('PUT /api/channels/:id', () => {
  it('returns 200 with updated channel', async () => {
    const updated = makeChannel({ name: 'Renamed' });
    mockService.updateChannel.mockReturnValue(updated);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { name: 'Renamed' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Renamed');
    expect(mockService.updateChannel).toHaveBeenCalledWith('chan-test1234', {
      name: 'Renamed',
      description: undefined,
      memberAgentIds: undefined,
    });
  });

  it('returns 404 when channel not found', async () => {
    mockService.updateChannel.mockReturnValue(null);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/nonexistent',
      payload: { name: 'Updated' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('Channel not found');
  });

  it('trims name when provided', async () => {
    mockService.updateChannel.mockReturnValue(makeChannel());

    await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { name: '  Trimmed  ' },
    });

    expect(mockService.updateChannel).toHaveBeenCalledWith(
      'chan-test1234',
      expect.objectContaining({ name: 'Trimmed' }),
    );
  });

  it('trims description when provided', async () => {
    mockService.updateChannel.mockReturnValue(makeChannel());

    await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { description: '  padded desc  ' },
    });

    expect(mockService.updateChannel).toHaveBeenCalledWith(
      'chan-test1234',
      expect.objectContaining({ description: 'padded desc' }),
    );
  });

  it('passes memberAgentIds when provided', async () => {
    mockService.updateChannel.mockReturnValue(makeChannel());

    await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { memberAgentIds: ['leela'] },
    });

    expect(mockService.updateChannel).toHaveBeenCalledWith(
      'chan-test1234',
      expect.objectContaining({ memberAgentIds: ['leela'] }),
    );
  });

  it('propagates ChannelValidationError from service', async () => {
    mockService.updateChannel.mockImplementation(() => {
      throw new ChannelValidationError('DUPLICATE_NAME', 'duplicate');
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { name: 'Duplicate' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('can update with empty payload (no-op update)', async () => {
    mockService.updateChannel.mockReturnValue(makeChannel());

    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
  });
});

// ── PUT /api/channels/:id — body schema validation ──────────────

describe('PUT /api/channels/:id — body validation', () => {
  it('returns 400 when name exceeds 100 characters', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { name: 'A'.repeat(101) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when description exceeds 500 characters', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { description: 'D'.repeat(501) },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when additional properties are sent', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { name: 'Valid', unknownField: 123 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name is whitespace only', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/channels/chan-test1234',
      payload: { name: '   ' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /api/channels/:id
// ═══════════════════════════════════════════════════════════════════

describe('PATCH /api/channels/:id', () => {
  it('returns 200 with updated channel', async () => {
    const updated = makeChannel({ name: 'Patched' });
    mockService.updateChannel.mockReturnValue(updated);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/channels/chan-test1234',
      payload: { name: 'Patched' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Patched');
    expect(mockService.updateChannel).toHaveBeenCalledWith('chan-test1234', {
      name: 'Patched',
      description: undefined,
      memberAgentIds: undefined,
    });
  });

  it('returns 404 when channel not found', async () => {
    mockService.updateChannel.mockReturnValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/channels/nonexistent',
      payload: { description: 'New desc' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('accepts partial body with only description', async () => {
    mockService.updateChannel.mockReturnValue(makeChannel({ description: 'Updated desc' }));

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/channels/chan-test1234',
      payload: { description: 'Updated desc' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockService.updateChannel).toHaveBeenCalledWith(
      'chan-test1234',
      expect.objectContaining({ description: 'Updated desc' }),
    );
  });

  it('returns 400 when additional properties are sent', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/channels/chan-test1234',
      payload: { name: 'Valid', unknownField: 123 },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/channels/:id
// ═══════════════════════════════════════════════════════════════════

describe('DELETE /api/channels/:id', () => {
  it('returns 204 No Content on successful delete', async () => {
    mockService.deleteChannel.mockReturnValue({ deleted: true, deletedMessages: 3 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/channels/chan-test1234',
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(mockService.deleteChannel).toHaveBeenCalledWith('chan-test1234');
  });

  it('returns 404 when channel not found', async () => {
    mockService.deleteChannel.mockReturnValue({ deleted: false, deletedMessages: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/channels/nonexistent',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('Channel not found');
  });

  it('returns correct body shape on 404', async () => {
    mockService.deleteChannel.mockReturnValue({ deleted: false, deletedMessages: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/channels/ghost',
    });

    expect(res.json()).toHaveProperty('error');
    expect(typeof res.json().error).toBe('string');
  });
});

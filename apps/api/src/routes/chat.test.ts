/**
 * Tests for Chat routes — P3-4
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatService } from '../services/chat/index.js';
import { initializeSchema } from '../services/db/schema.js';
import type { WebSocketManager } from '../services/websocket/index.js';
import chatRoute from './chat.js';

// ── Mock WebSocket Manager ────────────────────────────────────────

class MockWsManager {
  broadcasts: unknown[] = [];
  broadcast(envelope: unknown) {
    this.broadcasts.push(envelope);
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Chat Routes', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(async () => {
    db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-route-test-'));

    const chatService = new ChatService({ db, sessionsDir: tmpDir });
    const mockWs = new MockWsManager();
    chatService.setWebSocketManager(mockWs as unknown as WebSocketManager);

    app = Fastify({ logger: false });
    app.decorate('chatService', chatService);
    app.register(chatRoute, { prefix: '/api' });
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

  describe('POST /api/chat/messages', () => {
    it('should create a message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/messages',
        payload: {
          sender: 'user',
          recipient: 'bender',
          content: 'Hello from the test',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeTypeOf('string');
      expect(body.sender).toBe('user');
      expect(body.recipient).toBe('bender');
      expect(body.content).toBe('Hello from the test');
    });

    it('should return 400 for missing sender', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/messages',
        payload: { recipient: 'bender', content: 'test' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for missing recipient', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/messages',
        payload: { sender: 'user', content: 'test' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for empty content', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/messages',
        payload: { sender: 'user', recipient: 'bender', content: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should accept optional threadId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/messages',
        payload: {
          sender: 'user',
          recipient: 'bender',
          content: 'threaded',
          threadId: 'thread-abc',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().threadId).toBe('thread-abc');
    });
  });

  describe('GET /api/chat/messages', () => {
    beforeEach(async () => {
      // Seed messages
      for (const [sender, recipient, content] of [
        ['user', 'bender', 'msg-1'],
        ['bender', 'user', 'msg-2'],
        ['user', 'fry', 'msg-3'],
      ] as const) {
        await app.inject({
          method: 'POST',
          url: '/api/chat/messages',
          payload: { sender, recipient, content },
        });
      }
    });

    it('should return all messages', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/chat/messages' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.messages).toHaveLength(3);
      expect(body.total).toBe(3);
    });

    it('should paginate', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chat/messages?limit=2&offset=0',
      });

      const body = res.json();
      expect(body.messages).toHaveLength(2);
      expect(body.total).toBe(3);
    });

    it('should filter by agent', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chat/messages?agent=bender',
      });

      const body = res.json();
      expect(body.messages).toHaveLength(2); // sent to bender + sent by bender
    });
  });
});

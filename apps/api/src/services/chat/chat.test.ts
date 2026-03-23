/**
 * Tests for ChatService — P3-4
 *
 * Tests message CRUD, SQLite persistence, markdown dual-write,
 * WebSocket emission, and coordinator echo.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initializeSchema } from '../db/schema.js';
import type { WebSocketManager } from '../websocket/index.js';
import { ChatService } from './index.js';

// ── Mock WebSocket Manager ────────────────────────────────────────

class MockWsManager {
  broadcasts: Array<{ type: string; payload: Record<string, unknown>; timestamp: string }> = [];

  broadcast(envelope: { type: string; payload: Record<string, unknown>; timestamp: string }) {
    this.broadcasts.push(envelope);
  }
}

// ── Test helpers ──────────────────────────────────────────────────

let db: Database.Database;
let tmpDir: string;
let chatService: ChatService;
let mockWs: MockWsManager;

async function setupChatService(): Promise<void> {
  db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);

  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-test-'));
  mockWs = new MockWsManager();

  chatService = new ChatService({
    db,
    sessionsDir: tmpDir,
  });
  chatService.setWebSocketManager(mockWs as unknown as WebSocketManager);
}

// ── Tests ─────────────────────────────────────────────────────────

describe('ChatService', () => {
  beforeEach(async () => {
    await setupChatService();
  });

  afterEach(async () => {
    db.close();
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('send message', () => {
    it('should create a message with all fields', async () => {
      const msg = await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'Hello Bender!',
      });

      expect(msg.id).toBeTypeOf('string');
      expect(msg.sender).toBe('user');
      expect(msg.recipient).toBe('bender');
      expect(msg.content).toBe('Hello Bender!');
      expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(msg.threadId).toBeNull();
    });

    it('should persist to SQLite', async () => {
      await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'SQLite test',
      });

      const row = db.prepare('SELECT * FROM chat_messages').get() as Record<string, unknown>;
      expect(row).toBeTruthy();
      expect(row.sender).toBe('user');
      expect(row.content).toBe('SQLite test');
    });

    it('should persist to markdown file', async () => {
      await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'Markdown test',
      });

      const files = await fs.readdir(tmpDir);
      expect(files.length).toBeGreaterThanOrEqual(1);
      expect(files.some((f) => f.startsWith('chat-') && f.endsWith('.md'))).toBe(true);

      const content = await fs.readFile(path.join(tmpDir, files[0]!), 'utf-8');
      expect(content).toContain('Markdown test');
      expect(content).toContain('user → bender');
    });

    it('should emit chat:message via WebSocket', async () => {
      await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'WS test',
      });

      // Direct message → 1 broadcast for the user message
      expect(mockWs.broadcasts.length).toBeGreaterThanOrEqual(1);
      expect(mockWs.broadcasts[0]!.type).toBe('chat:message');
    });

    it('should support thread IDs', async () => {
      const msg = await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'Thread test',
        threadId: 'thread-123',
      });

      expect(msg.threadId).toBe('thread-123');
    });
  });

  describe('team messages (coordinator echo)', () => {
    it('should generate a coordinator echo for team messages', async () => {
      const response = await chatService.send({
        sender: 'user',
        recipient: 'team',
        content: 'Hello team!',
      });

      // The returned message is the coordinator's echo
      expect(response.sender).toBe('coordinator');
      expect(response.content).toContain('Hello team!');
    });

    it('should persist both user message and echo', async () => {
      await chatService.send({
        sender: 'user',
        recipient: 'team',
        content: 'Team message',
      });

      const rows = db.prepare('SELECT * FROM chat_messages ORDER BY timestamp').all();
      expect(rows).toHaveLength(2); // original + echo
    });

    it('should emit WebSocket events for both messages', async () => {
      await chatService.send({
        sender: 'user',
        recipient: 'team',
        content: 'Team broadcast test',
      });

      // 2 broadcasts: original + echo
      expect(mockWs.broadcasts).toHaveLength(2);
      expect(mockWs.broadcasts.every((b) => b.type === 'chat:message')).toBe(true);
    });
  });

  describe('get messages', () => {
    beforeEach(async () => {
      // Seed some messages
      await chatService.send({ sender: 'user', recipient: 'bender', content: 'msg-1' });
      await chatService.send({ sender: 'bender', recipient: 'user', content: 'msg-2' });
      await chatService.send({ sender: 'user', recipient: 'fry', content: 'msg-3' });
      await chatService.send({ sender: 'leela', recipient: 'user', content: 'msg-4' });
    });

    it('should return all messages with pagination', () => {
      const { messages, total } = chatService.getMessages({ limit: 10 });
      expect(messages).toHaveLength(4);
      expect(total).toBe(4);
    });

    it('should paginate results', () => {
      const page1 = chatService.getMessages({ limit: 2, offset: 0 });
      const page2 = chatService.getMessages({ limit: 2, offset: 2 });

      expect(page1.messages).toHaveLength(2);
      expect(page2.messages).toHaveLength(2);
      expect(page1.total).toBe(4);
    });

    it('should filter by agent (sender or recipient)', () => {
      const { messages } = chatService.getMessages({ agent: 'bender' });
      expect(messages).toHaveLength(2); // msg-1 (to bender) + msg-2 (from bender)
    });

    it('should filter by thread ID', async () => {
      await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'threaded',
        threadId: 'thread-1',
      });

      const { messages } = chatService.getMessages({ threadId: 'thread-1' });
      expect(messages).toHaveLength(1);
      expect(messages[0]!.content).toBe('threaded');
    });

    it('should return newest first', () => {
      const { messages } = chatService.getMessages();
      // Last message should come first
      expect(messages[0]!.content).toBe('msg-4');
    });
  });

  describe('get single message', () => {
    it('should return a message by ID', async () => {
      const sent = await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'find me',
      });

      const found = chatService.getMessage(sent.id);
      expect(found).toBeTruthy();
      expect(found!.content).toBe('find me');
    });

    it('should return null for missing message', () => {
      const found = chatService.getMessage('does-not-exist');
      expect(found).toBeNull();
    });
  });

  describe('no database', () => {
    it('should return empty results when no db is configured', () => {
      const service = new ChatService({ db: null, sessionsDir: null });
      const { messages, total } = service.getMessages();
      expect(messages).toEqual([]);
      expect(total).toBe(0);
    });
  });
});

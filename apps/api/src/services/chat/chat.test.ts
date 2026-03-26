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
import { ChannelValidationError, ChatService } from './index.js';
import type { DeleteChannelResult } from './index.js';

// ── Mock WebSocket Manager ────────────────────────────────────────

class MockWsManager {
  broadcasts: Array<{ type: string; payload: Record<string, unknown>; timestamp: string }> = [];

  broadcast(envelope: { type: string; payload: Record<string, unknown>; timestamp: string }) {
    this.broadcasts.push(envelope);
  }

  broadcastToChannel(
    _channelId: string,
    envelope: { type: string; payload: Record<string, unknown>; timestamp: string },
  ) {
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

  // ── Channel CRUD ─────────────────────────────────────────────────

  describe('channels', () => {
    describe('createChannel', () => {
      it('should create a channel with all fields', () => {
        const channel = chatService.createChannel({
          name: 'Backend',
          description: 'Backend team channel',
          memberAgentIds: ['bender', 'leela'],
        });

        expect(channel.id).toBeTypeOf('string');
        expect(channel.id.length).toBeGreaterThan(0);
        expect(channel.name).toBe('Backend');
        expect(channel.description).toBe('Backend team channel');
        expect(channel.memberAgentIds).toEqual(['bender', 'leela']);
        expect(channel.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(channel.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });

      it('should apply defaults for optional fields', () => {
        const channel = chatService.createChannel({ name: 'General' });

        expect(channel.description).toBe('');
        expect(channel.memberAgentIds).toEqual([]);
      });

      it('should persist to SQLite', () => {
        const channel = chatService.createChannel({ name: 'Persisted' });

        const row = db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(channel.id) as Record<string, unknown>;
        expect(row).toBeTruthy();
        expect(row.name).toBe('Persisted');
        expect(row.member_agent_ids).toBe('[]');
      });

      it('should store memberAgentIds as JSON in SQLite', () => {
        const channel = chatService.createChannel({
          name: 'Team',
          memberAgentIds: ['fry', 'bender'],
        });

        const row = db.prepare('SELECT member_agent_ids FROM chat_channels WHERE id = ?').get(channel.id) as Record<string, unknown>;
        expect(JSON.parse(row.member_agent_ids as string)).toEqual(['fry', 'bender']);
      });

      it('should broadcast channel:created via WebSocket', () => {
        chatService.createChannel({ name: 'WS Test' });

        const broadcast = mockWs.broadcasts.find(
          (b) => b.type === 'channel:created',
        );
        expect(broadcast).toBeTruthy();
        expect((broadcast!.payload as Record<string, unknown>).name).toBe('WS Test');
      });

      it('should generate unique IDs', () => {
        const ids = new Set(
          Array.from({ length: 20 }, (_, i) => chatService.createChannel({ name: `ch-${i}` }).id),
        );
        expect(ids.size).toBe(20);
      });
    });

    describe('getChannel', () => {
      it('should return an existing channel', () => {
        const created = chatService.createChannel({ name: 'Findable' });
        const found = chatService.getChannel(created.id);

        expect(found).toBeTruthy();
        expect(found!.id).toBe(created.id);
        expect(found!.name).toBe('Findable');
      });

      it('should return null for non-existent channel', () => {
        expect(chatService.getChannel('does-not-exist')).toBeNull();
      });

      it('should deserialize memberAgentIds from JSON', () => {
        const created = chatService.createChannel({
          name: 'Members',
          memberAgentIds: ['leela', 'fry', 'bender'],
        });
        const found = chatService.getChannel(created.id);

        expect(found!.memberAgentIds).toEqual(['leela', 'fry', 'bender']);
      });
    });

    describe('listChannels', () => {
      it('should return empty array when no channels exist', () => {
        expect(chatService.listChannels()).toEqual([]);
      });

      it('should return all channels', () => {
        chatService.createChannel({ name: 'Alpha' });
        chatService.createChannel({ name: 'Beta' });
        chatService.createChannel({ name: 'Gamma' });

        const channels = chatService.listChannels();
        expect(channels).toHaveLength(3);
      });

      it('should order by created_at ascending', () => {
        chatService.createChannel({ name: 'First' });
        chatService.createChannel({ name: 'Second' });
        chatService.createChannel({ name: 'Third' });

        const channels = chatService.listChannels();
        for (let i = 1; i < channels.length; i++) {
          expect(channels[i]!.createdAt >= channels[i - 1]!.createdAt).toBe(true);
        }
      });
    });

    describe('updateChannel', () => {
      it('should update channel name', () => {
        const created = chatService.createChannel({ name: 'Original' });
        const updated = chatService.updateChannel(created.id, { name: 'Renamed' });

        expect(updated).toBeTruthy();
        expect(updated!.name).toBe('Renamed');
        expect(updated!.id).toBe(created.id);
      });

      it('should update description', () => {
        const created = chatService.createChannel({ name: 'Ch', description: 'old' });
        const updated = chatService.updateChannel(created.id, { description: 'new desc' });

        expect(updated!.description).toBe('new desc');
      });

      it('should update memberAgentIds', () => {
        const created = chatService.createChannel({
          name: 'Members',
          memberAgentIds: ['fry'],
        });
        const updated = chatService.updateChannel(created.id, {
          memberAgentIds: ['fry', 'leela', 'bender'],
        });

        expect(updated!.memberAgentIds).toEqual(['fry', 'leela', 'bender']);
      });

      it('should preserve fields not included in updates', () => {
        const created = chatService.createChannel({
          name: 'Keep',
          description: 'important',
          memberAgentIds: ['leela'],
        });
        const updated = chatService.updateChannel(created.id, { name: 'New Name' });

        expect(updated!.description).toBe('important');
        expect(updated!.memberAgentIds).toEqual(['leela']);
      });

      it('should bump updatedAt', () => {
        const created = chatService.createChannel({ name: 'Time' });
        const updated = chatService.updateChannel(created.id, { name: 'Time v2' });

        expect(updated!.updatedAt >= created.updatedAt).toBe(true);
      });

      it('should persist update to SQLite', () => {
        const created = chatService.createChannel({ name: 'SQLite' });
        chatService.updateChannel(created.id, { name: 'SQLite Updated' });

        const row = db.prepare('SELECT name FROM chat_channels WHERE id = ?').get(created.id) as Record<string, unknown>;
        expect(row.name).toBe('SQLite Updated');
      });

      it('should return null for non-existent channel', () => {
        expect(chatService.updateChannel('ghost', { name: 'Nope' })).toBeNull();
      });

      it('should broadcast channel:updated via WebSocket', () => {
        const created = chatService.createChannel({ name: 'WS Update' });
        mockWs.broadcasts = []; // clear creation broadcast
        chatService.updateChannel(created.id, { name: 'Updated' });

        const broadcast = mockWs.broadcasts.find(
          (b) => b.type === 'channel:updated',
        );
        expect(broadcast).toBeTruthy();
        expect((broadcast!.payload as Record<string, unknown>).name).toBe('Updated');
      });
    });

    describe('deleteChannel', () => {
      it('should delete an existing channel', () => {
        const created = chatService.createChannel({ name: 'Delete Me' });
        const result = chatService.deleteChannel(created.id);

        expect(result.deleted).toBe(true);
        expect(result.deletedMessages).toBe(0);
        expect(chatService.getChannel(created.id)).toBeNull();
      });

      it('should remove from SQLite', () => {
        const created = chatService.createChannel({ name: 'Gone' });
        chatService.deleteChannel(created.id);

        const row = db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(created.id);
        expect(row).toBeUndefined();
      });

      it('should return deleted:false for non-existent channel', () => {
        const result = chatService.deleteChannel('ghost');
        expect(result.deleted).toBe(false);
        expect(result.deletedMessages).toBe(0);
      });

      it('should not affect other channels', () => {
        const keep = chatService.createChannel({ name: 'Keep' });
        const remove = chatService.createChannel({ name: 'Remove' });

        chatService.deleteChannel(remove.id);

        expect(chatService.getChannel(keep.id)).toBeTruthy();
        expect(chatService.listChannels()).toHaveLength(1);
      });

      it('should broadcast channel:deleted via WebSocket', () => {
        const created = chatService.createChannel({ name: 'WS Delete' });
        mockWs.broadcasts = [];
        chatService.deleteChannel(created.id);

        const broadcast = mockWs.broadcasts.find(
          (b) => b.type === 'channel:deleted',
        );
        expect(broadcast).toBeTruthy();
        expect((broadcast!.payload as Record<string, unknown>).id).toBe(created.id);
      });
    });

    describe('no database fallback', () => {
      let noDB: ChatService;

      beforeEach(() => {
        noDB = new ChatService({ db: null, sessionsDir: null });
      });

      it('listChannels returns empty array', () => {
        expect(noDB.listChannels()).toEqual([]);
      });

      it('getChannel returns null', () => {
        expect(noDB.getChannel('anything')).toBeNull();
      });

      it('deleteChannel returns deleted:false', () => {
        const result = noDB.deleteChannel('anything');
        expect(result).toEqual({ deleted: false, deletedMessages: 0 });
      });

      it('createChannel still returns a channel object', () => {
        const channel = noDB.createChannel({ name: 'No DB' });
        expect(channel.name).toBe('No DB');
        expect(channel.id).toBeTypeOf('string');
      });

      it('updateChannel returns null (cannot read existing)', () => {
        expect(noDB.updateChannel('x', { name: 'y' })).toBeNull();
      });
    });

    describe('concurrent access', () => {
      it('should handle rapid sequential creates', () => {
        const channels = Array.from({ length: 50 }, (_, i) =>
          chatService.createChannel({ name: `Channel ${i}` }),
        );

        expect(new Set(channels.map((c) => c.id)).size).toBe(50);
        expect(chatService.listChannels()).toHaveLength(50);
      });

      it('should handle create-then-immediate-read', () => {
        const created = chatService.createChannel({
          name: 'Immediate',
          memberAgentIds: ['fry'],
        });
        const read = chatService.getChannel(created.id);

        expect(read).toBeTruthy();
        expect(read!.name).toBe('Immediate');
        expect(read!.memberAgentIds).toEqual(['fry']);
      });

      it('should handle create-update-delete-list cycle', () => {
        const ch = chatService.createChannel({ name: 'Lifecycle' });
        chatService.updateChannel(ch.id, { name: 'Updated' });
        expect(chatService.getChannel(ch.id)!.name).toBe('Updated');

        chatService.deleteChannel(ch.id);
        expect(chatService.getChannel(ch.id)).toBeNull();
        expect(chatService.listChannels()).toHaveLength(0);
      });

      it('should handle double delete gracefully', () => {
        const ch = chatService.createChannel({ name: 'Double Delete' });
        expect(chatService.deleteChannel(ch.id).deleted).toBe(true);
        expect(chatService.deleteChannel(ch.id).deleted).toBe(false);
      });

      it('should handle update after delete gracefully', () => {
        const ch = chatService.createChannel({ name: 'Update After Delete' });
        expect(chatService.deleteChannel(ch.id).deleted).toBe(true);
        expect(chatService.updateChannel(ch.id, { name: 'Too Late' })).toBeNull();
      });
    });
  });
});

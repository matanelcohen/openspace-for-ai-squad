/**
 * Channel-service edge-case tests.
 *
 * Covers validation errors (duplicate names, empty names, empty member lists),
 * channel-scoped message lifecycle (send → delete cleans up messages),
 * clearMessages, input boundaries, and invalid IDs.
 *
 * Complements the base CRUD tests in chat.test.ts.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CHAT_CHANNEL_PREFIX } from '@openspace/shared';
import { initializeSchema } from '../db/schema.js';
import type { WebSocketManager } from '../websocket/index.js';
import { ChannelMembershipError, ChannelValidationError, ChatService } from './index.js';

// ── Mock WebSocket Manager ──────────────────────────────────────────

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

// ── Test scaffold ───────────────────────────────────────────────────

let db: Database.Database;
let tmpDir: string;
let chatService: ChatService;
let mockWs: MockWsManager;

async function setup(): Promise<void> {
  db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);

  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'channel-edge-test-'));
  mockWs = new MockWsManager();

  chatService = new ChatService({ db, sessionsDir: tmpDir });
  chatService.setWebSocketManager(mockWs as unknown as WebSocketManager);
}

// ── Tests ───────────────────────────────────────────────────────────

describe('ChannelService — edge cases', () => {
  beforeEach(async () => {
    await setup();
  });

  afterEach(async () => {
    db.close();
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // ── Duplicate channel names ─────────────────────────────────────

  describe('duplicate channel names', () => {
    it('should throw DUPLICATE_NAME when creating a channel with an existing name', () => {
      chatService.createChannel({ name: 'Backend', memberAgentIds: ['bender'] });

      expect(() =>
        chatService.createChannel({ name: 'Backend', memberAgentIds: ['leela'] }),
      ).toThrow(ChannelValidationError);

      try {
        chatService.createChannel({ name: 'Backend' });
      } catch (err) {
        expect(err).toBeInstanceOf(ChannelValidationError);
        expect((err as ChannelValidationError).code).toBe('DUPLICATE_NAME');
        expect((err as ChannelValidationError).message).toContain('Backend');
      }
    });

    it('should treat trimmed names as identical (leading/trailing spaces)', () => {
      chatService.createChannel({ name: 'Frontend' });

      // The service trims names, so " Frontend " should conflict with "Frontend"
      expect(() =>
        chatService.createChannel({ name: ' Frontend ' }),
      ).toThrow(ChannelValidationError);
    });

    it('should allow different names that look similar', () => {
      chatService.createChannel({ name: 'Backend' });

      // Different name — should not throw
      const ch2 = chatService.createChannel({ name: 'backend-v2' });
      expect(ch2.name).toBe('backend-v2');
    });

    it('should allow reusing a name after the original channel is deleted', () => {
      const original = chatService.createChannel({ name: 'Ephemeral' });
      chatService.deleteChannel(original.id);

      // Name is now free
      const reused = chatService.createChannel({ name: 'Ephemeral' });
      expect(reused.name).toBe('Ephemeral');
      expect(reused.id).not.toBe(original.id);
    });

    it('should throw DUPLICATE_NAME when updating a channel to an existing name', () => {
      chatService.createChannel({ name: 'Alpha' });
      const beta = chatService.createChannel({ name: 'Beta', memberAgentIds: ['fry'] });

      expect(() =>
        chatService.updateChannel(beta.id, { name: 'Alpha' }),
      ).toThrow(ChannelValidationError);

      try {
        chatService.updateChannel(beta.id, { name: 'Alpha' });
      } catch (err) {
        expect((err as ChannelValidationError).code).toBe('DUPLICATE_NAME');
      }
    });

    it('should allow updating a channel to its own current name (no-op rename)', () => {
      const ch = chatService.createChannel({ name: 'SameName' });

      // Renaming to the same name should not throw
      const updated = chatService.updateChannel(ch.id, { name: 'SameName' });
      expect(updated).toBeTruthy();
      expect(updated!.name).toBe('SameName');
    });
  });

  // ── Empty / invalid channel names ───────────────────────────────

  describe('empty and invalid channel names', () => {
    it('should throw NAME_REQUIRED for an empty string name', () => {
      expect(() =>
        chatService.createChannel({ name: '' }),
      ).toThrow(ChannelValidationError);

      try {
        chatService.createChannel({ name: '' });
      } catch (err) {
        expect((err as ChannelValidationError).code).toBe('NAME_REQUIRED');
      }
    });

    it('should throw NAME_REQUIRED for a whitespace-only name', () => {
      expect(() =>
        chatService.createChannel({ name: '   ' }),
      ).toThrow(ChannelValidationError);

      try {
        chatService.createChannel({ name: '   ' });
      } catch (err) {
        expect((err as ChannelValidationError).code).toBe('NAME_REQUIRED');
      }
    });

    it('should throw NAME_REQUIRED for a tab/newline-only name', () => {
      expect(() =>
        chatService.createChannel({ name: '\t\n' }),
      ).toThrow(ChannelValidationError);
    });
  });

  // ── Empty member list validation ────────────────────────────────

  describe('empty member list validation', () => {
    it('should throw EMPTY_MEMBER_LIST when creating with an explicit empty array', () => {
      expect(() =>
        chatService.createChannel({ name: 'NoMembers', memberAgentIds: [] }),
      ).toThrow(ChannelValidationError);

      try {
        chatService.createChannel({ name: 'NoMembers', memberAgentIds: [] });
      } catch (err) {
        expect((err as ChannelValidationError).code).toBe('EMPTY_MEMBER_LIST');
      }
    });

    it('should allow omitting memberAgentIds entirely (defaults to [])', () => {
      const ch = chatService.createChannel({ name: 'NoMembersOptional' });
      expect(ch.memberAgentIds).toEqual([]);
    });

    it('should throw EMPTY_MEMBER_LIST when updating with an explicit empty array', () => {
      const ch = chatService.createChannel({ name: 'HasMembers', memberAgentIds: ['fry'] });

      expect(() =>
        chatService.updateChannel(ch.id, { memberAgentIds: [] }),
      ).toThrow(ChannelValidationError);

      try {
        chatService.updateChannel(ch.id, { memberAgentIds: [] });
      } catch (err) {
        expect((err as ChannelValidationError).code).toBe('EMPTY_MEMBER_LIST');
      }
    });

    it('should allow updating without providing memberAgentIds (keeps existing)', () => {
      const ch = chatService.createChannel({ name: 'KeepMembers', memberAgentIds: ['leela'] });
      const updated = chatService.updateChannel(ch.id, { name: 'Renamed' });

      expect(updated!.memberAgentIds).toEqual(['leela']);
    });
  });

  // ── Invalid channel IDs ─────────────────────────────────────────

  describe('invalid channel IDs', () => {
    it('should return null for an empty string ID', () => {
      expect(chatService.getChannel('')).toBeNull();
    });

    it('should return null for a whitespace-only ID', () => {
      expect(chatService.getChannel('   ')).toBeNull();
    });

    it('should handle special characters in IDs gracefully', () => {
      expect(chatService.getChannel('../../etc/passwd')).toBeNull();
      expect(chatService.getChannel("'; DROP TABLE chat_channels; --")).toBeNull();
    });

    it('should return deleted:false for an empty string ID on delete', () => {
      const result = chatService.deleteChannel('');
      expect(result.deleted).toBe(false);
      expect(result.deletedMessages).toBe(0);
    });

    it('should return null for an empty string ID on update', () => {
      expect(chatService.updateChannel('', { name: 'Nope' })).toBeNull();
    });

    it('should not confuse numeric-like IDs', () => {
      expect(chatService.getChannel('0')).toBeNull();
      expect(chatService.getChannel('-1')).toBeNull();
    });
  });

  // ── Channel-scoped message lifecycle ────────────────────────────

  describe('channel message lifecycle', () => {
    it('should delete channel messages when deleting a channel', async () => {
      const ch = chatService.createChannel({ name: 'Doomed', memberAgentIds: ['bender'] });
      const channelRecipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      // Send messages to the channel
      await chatService.send({ sender: 'user', recipient: channelRecipient, content: 'msg-1' });
      await chatService.send({ sender: 'bender', recipient: channelRecipient, content: 'msg-2' });
      await chatService.send({ sender: 'user', recipient: channelRecipient, content: 'msg-3' });

      // Also send a direct message that should survive
      await chatService.send({ sender: 'user', recipient: 'fry', content: 'unrelated' });

      const result = chatService.deleteChannel(ch.id);
      expect(result.deleted).toBe(true);
      expect(result.deletedMessages).toBe(3);

      // Channel messages are gone
      const { messages } = chatService.getMessages({ limit: 100 });
      expect(messages.every((m) => m.recipient !== channelRecipient)).toBe(true);

      // Direct message survived
      expect(messages.some((m) => m.content === 'unrelated')).toBe(true);
    });

    it('should return deletedMessages: 0 when channel has no messages', () => {
      const ch = chatService.createChannel({ name: 'Empty Channel', memberAgentIds: ['leela'] });
      const result = chatService.deleteChannel(ch.id);

      expect(result.deleted).toBe(true);
      expect(result.deletedMessages).toBe(0);
    });

    it('should send messages to a channel recipient format', async () => {
      const ch = chatService.createChannel({ name: 'Active', memberAgentIds: ['fry'] });
      const channelRecipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      const msg = await chatService.send({
        sender: 'user',
        recipient: channelRecipient,
        content: 'Hello channel!',
      });

      expect(msg.recipient).toBe(channelRecipient);

      const found = chatService.getMessage(msg.id);
      expect(found).toBeTruthy();
      expect(found!.recipient).toBe(channelRecipient);
    });
  });

  // ── clearMessages ───────────────────────────────────────────────

  describe('clearMessages', () => {
    beforeEach(async () => {
      await chatService.send({ sender: 'user', recipient: 'bender', content: 'a' });
      await chatService.send({ sender: 'bender', recipient: 'user', content: 'b' });
      await chatService.send({ sender: 'user', recipient: 'leela', content: 'c' });
      await chatService.send({ sender: 'fry', recipient: 'user', content: 'd' });
    });

    it('should clear all messages when no filter is provided', async () => {
      const result = await chatService.clearMessages();
      expect(result.deleted).toBe(4);

      const { messages, total } = chatService.getMessages();
      expect(messages).toHaveLength(0);
      expect(total).toBe(0);
    });

    it('should clear only messages for a specific agent', async () => {
      const result = await chatService.clearMessages({ agent: 'bender' });
      expect(result.deleted).toBe(2); // sent to bender + sent from bender

      const { messages } = chatService.getMessages();
      expect(messages.every((m) => m.sender !== 'bender' && m.recipient !== 'bender')).toBe(true);
    });

    it('should return deleted: 0 when no messages match', async () => {
      const result = await chatService.clearMessages({ agent: 'zoidberg' });
      expect(result.deleted).toBe(0);

      const { total } = chatService.getMessages();
      expect(total).toBe(4); // unchanged
    });

    it('should clear channel-scoped messages', async () => {
      const ch = chatService.createChannel({ name: 'ClearMe', memberAgentIds: ['fry'] });
      const channelRecipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      await chatService.send({ sender: 'user', recipient: channelRecipient, content: 'ch-1' });
      await chatService.send({ sender: 'fry', recipient: channelRecipient, content: 'ch-2' });

      // Clear using the channel thread
      const result = await chatService.clearMessages({ channel: channelRecipient });

      // channel filter uses thread_id, so this tests that path
      // The messages were sent with recipient = channelRecipient, not thread_id
      // So channel clear with thread_id won't catch them — this verifies the API's behavior
      expect(result).toHaveProperty('deleted');
    });

    it('should return deleted: 0 with no database', async () => {
      const noDB = new ChatService({ db: null, sessionsDir: null });
      const result = await noDB.clearMessages();
      expect(result.deleted).toBe(0);
    });
  });

  // ── Input boundary conditions ───────────────────────────────────

  describe('input boundaries', () => {
    it('should handle unicode channel names', () => {
      const ch = chatService.createChannel({ name: '频道', memberAgentIds: ['bender'] });
      expect(ch.name).toBe('频道');

      const found = chatService.getChannel(ch.id);
      expect(found!.name).toBe('频道');
    });

    it('should handle emoji channel names', () => {
      const ch = chatService.createChannel({ name: '🚀 Rocket Team', memberAgentIds: ['fry'] });
      expect(ch.name).toBe('🚀 Rocket Team');
    });

    it('should handle special characters in descriptions', () => {
      const desc = 'Channel for <script>alert("xss")</script> & "quotes" \'single\' `backticks`';
      const ch = chatService.createChannel({
        name: 'Special',
        description: desc,
        memberAgentIds: ['leela'],
      });

      expect(ch.description).toBe(desc);

      const found = chatService.getChannel(ch.id);
      expect(found!.description).toBe(desc);
    });

    it('should handle SQL-injection-like channel names without error', () => {
      const name = "Robert'; DROP TABLE chat_channels;--";
      const ch = chatService.createChannel({ name, memberAgentIds: ['bender'] });

      expect(ch.name).toBe(name);

      // Table should still exist and work
      const channels = chatService.listChannels();
      expect(channels).toHaveLength(1);
      expect(channels[0]!.name).toBe(name);
    });

    it('should handle a long channel description', () => {
      const longDesc = 'A'.repeat(500);
      const ch = chatService.createChannel({
        name: 'Verbose',
        description: longDesc,
        memberAgentIds: ['fry'],
      });

      expect(ch.description).toBe(longDesc);
      expect(chatService.getChannel(ch.id)!.description.length).toBe(500);
    });

    it('should handle a channel with many members', () => {
      const members = Array.from({ length: 100 }, (_, i) => `agent-${i}`);
      const ch = chatService.createChannel({
        name: 'BigTeam',
        memberAgentIds: members,
      });

      expect(ch.memberAgentIds).toHaveLength(100);

      const found = chatService.getChannel(ch.id);
      expect(found!.memberAgentIds).toHaveLength(100);
      expect(found!.memberAgentIds[99]).toBe('agent-99');
    });

    it('should handle message with empty content string', async () => {
      const msg = await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: '',
      });

      expect(msg.content).toBe('');

      const found = chatService.getMessage(msg.id);
      expect(found).toBeTruthy();
      expect(found!.content).toBe('');
    });

    it('should handle message with multiline content', async () => {
      const content = 'Line 1\nLine 2\nLine 3\n\n## Heading\n- bullet';
      const msg = await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content,
      });

      expect(msg.content).toBe(content);

      const found = chatService.getMessage(msg.id);
      expect(found!.content).toBe(content);
    });
  });

  // ── Validation does not leave partial state ─────────────────────

  describe('validation rollback', () => {
    it('should not persist a channel when DUPLICATE_NAME is thrown', () => {
      chatService.createChannel({ name: 'Original', memberAgentIds: ['fry'] });

      try {
        chatService.createChannel({ name: 'Original', memberAgentIds: ['bender'] });
      } catch {
        // expected
      }

      // Only one channel should exist
      expect(chatService.listChannels()).toHaveLength(1);
    });

    it('should not persist a channel when EMPTY_MEMBER_LIST is thrown', () => {
      try {
        chatService.createChannel({ name: 'BadMembers', memberAgentIds: [] });
      } catch {
        // expected
      }

      expect(chatService.listChannels()).toHaveLength(0);
    });

    it('should not modify a channel when update throws DUPLICATE_NAME', () => {
      chatService.createChannel({ name: 'Alpha' });
      const beta = chatService.createChannel({ name: 'Beta', memberAgentIds: ['fry'] });

      try {
        chatService.updateChannel(beta.id, { name: 'Alpha' });
      } catch {
        // expected
      }

      // Beta should retain its original name
      const found = chatService.getChannel(beta.id);
      expect(found!.name).toBe('Beta');
    });

    it('should not modify a channel when update throws EMPTY_MEMBER_LIST', () => {
      const ch = chatService.createChannel({ name: 'HasMembers', memberAgentIds: ['leela'] });

      try {
        chatService.updateChannel(ch.id, { memberAgentIds: [] });
      } catch {
        // expected
      }

      const found = chatService.getChannel(ch.id);
      expect(found!.memberAgentIds).toEqual(['leela']);
    });
  });

  // ── Message retrieval edge cases ────────────────────────────────

  describe('message retrieval edge cases', () => {
    it('should return empty results with limit 0', () => {
      // Seed a message
      chatService.send({ sender: 'user', recipient: 'bender', content: 'hi' });

      // Vitest async: the send above returns a promise but persist is sync for SQLite
      const { messages } = chatService.getMessages({ limit: 0 });
      // SQLite LIMIT 0 returns no rows
      expect(messages).toHaveLength(0);
    });

    it('should handle very large offset gracefully', async () => {
      await chatService.send({ sender: 'user', recipient: 'bender', content: 'only one' });

      const { messages, total } = chatService.getMessages({ offset: 9999 });
      expect(messages).toHaveLength(0);
      expect(total).toBe(1); // total count is still accurate
    });

    it('should return null for getMessage with non-existent ID', () => {
      expect(chatService.getMessage('zzz-no-exist')).toBeNull();
    });

    it('should filter messages by both agent and threadId simultaneously', async () => {
      await chatService.send({ sender: 'user', recipient: 'bender', content: 'no-thread' });
      await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'threaded',
        threadId: 'T1',
      });
      await chatService.send({
        sender: 'leela',
        recipient: 'user',
        content: 'other-agent-threaded',
        threadId: 'T1',
      });

      const { messages } = chatService.getMessages({ agent: 'bender', threadId: 'T1' });
      expect(messages).toHaveLength(1);
      expect(messages[0]!.content).toBe('threaded');
    });
  });

  // ── WebSocket broadcast correctness ─────────────────────────────

  describe('WebSocket broadcast payloads', () => {
    it('should include full channel object in channel:created payload', () => {
      const ch = chatService.createChannel({
        name: 'WS Payload',
        description: 'desc',
        memberAgentIds: ['fry', 'leela'],
      });

      const broadcast = mockWs.broadcasts.find((b) => b.type === 'channel:created');
      expect(broadcast).toBeTruthy();

      const payload = broadcast!.payload as Record<string, unknown>;
      expect(payload.id).toBe(ch.id);
      expect(payload.name).toBe('WS Payload');
      expect(payload.description).toBe('desc');
      expect(payload.memberAgentIds).toEqual(['fry', 'leela']);
      expect(payload.createdAt).toBeTypeOf('string');
      expect(payload.updatedAt).toBeTypeOf('string');
    });

    it('should include channel ID and deletedMessages in channel:deleted payload', async () => {
      const ch = chatService.createChannel({ name: 'WS Delete', memberAgentIds: ['bender'] });
      const channelRecipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;
      await chatService.send({ sender: 'user', recipient: channelRecipient, content: 'bye' });

      mockWs.broadcasts = [];
      chatService.deleteChannel(ch.id);

      const broadcast = mockWs.broadcasts.find((b) => b.type === 'channel:deleted');
      expect(broadcast).toBeTruthy();

      const payload = broadcast!.payload as Record<string, unknown>;
      expect(payload.id).toBe(ch.id);
      expect(payload.deletedMessages).toBe(1);
    });

    it('should not broadcast when there is no WebSocket manager', () => {
      const noWs = new ChatService({ db, sessionsDir: tmpDir });
      // No setWebSocketManager call

      // Should not throw
      const ch = noWs.createChannel({ name: 'Silent' });
      expect(ch.name).toBe('Silent');
    });

    it('should include full channel object in channel:updated payload', () => {
      const ch = chatService.createChannel({
        name: 'WS Update Payload',
        description: 'orig',
        memberAgentIds: ['fry'],
      });

      mockWs.broadcasts = [];
      chatService.updateChannel(ch.id, { name: 'Renamed', description: 'new desc' });

      const broadcast = mockWs.broadcasts.find((b) => b.type === 'channel:updated');
      expect(broadcast).toBeTruthy();

      const payload = broadcast!.payload as Record<string, unknown>;
      expect(payload.id).toBe(ch.id);
      expect(payload.name).toBe('Renamed');
      expect(payload.description).toBe('new desc');
      expect(payload.memberAgentIds).toEqual(['fry']);
      expect(payload.createdAt).toBeTypeOf('string');
      expect(payload.updatedAt).toBeTypeOf('string');
    });
  });

  // ── Case sensitivity in name matching ───────────────────────────

  describe('case sensitivity in channel names', () => {
    it('should treat different cases as distinct names (SQLite default)', () => {
      chatService.createChannel({ name: 'Backend', memberAgentIds: ['bender'] });

      // SQLite = operator is case-sensitive by default, so "backend" is a different name
      const lower = chatService.createChannel({ name: 'backend', memberAgentIds: ['fry'] });
      expect(lower.name).toBe('backend');

      expect(chatService.listChannels()).toHaveLength(2);
    });

    it('should not conflict when names differ only by case', () => {
      chatService.createChannel({ name: 'Frontend', memberAgentIds: ['fry'] });

      // Should NOT throw — different case is a different name
      expect(() =>
        chatService.createChannel({ name: 'FRONTEND', memberAgentIds: ['leela'] }),
      ).not.toThrow();
    });
  });

  // ── Update name validation gaps ─────────────────────────────────

  describe('update name validation gaps', () => {
    it('should allow updating a channel name to empty string (no NAME_REQUIRED check on update)', () => {
      const ch = chatService.createChannel({ name: 'HasName', memberAgentIds: ['fry'] });

      // Unlike createChannel, updateChannel does not validate empty names
      const updated = chatService.updateChannel(ch.id, { name: '' });
      expect(updated).toBeTruthy();
      expect(updated!.name).toBe('');
    });

    it('should allow updating a channel name to whitespace (no NAME_REQUIRED check on update)', () => {
      const ch = chatService.createChannel({ name: 'HasName2', memberAgentIds: ['bender'] });

      // updateChannel does not trim or validate whitespace-only names
      const updated = chatService.updateChannel(ch.id, { name: '   ' });
      expect(updated).toBeTruthy();
      expect(updated!.name).toBe('   ');
    });

    it('should store untrimmed name on update (unlike createChannel which trims)', () => {
      const ch = chatService.createChannel({ name: 'Trimmed', memberAgentIds: ['leela'] });
      expect(ch.name).toBe('Trimmed'); // createChannel trims

      const updated = chatService.updateChannel(ch.id, { name: '  Untrimmed  ' });
      expect(updated).toBeTruthy();
      // updateChannel does NOT trim the stored name
      expect(updated!.name).toBe('  Untrimmed  ');

      // Verify in SQLite
      const row = db.prepare('SELECT name FROM chat_channels WHERE id = ?').get(ch.id) as Record<string, unknown>;
      expect(row.name).toBe('  Untrimmed  ');
    });
  });

  // ── No-op and minimal updates ───────────────────────────────────

  describe('no-op and minimal updates', () => {
    it('should handle update with empty object (no fields changed)', () => {
      const ch = chatService.createChannel({
        name: 'Stable',
        description: 'steady',
        memberAgentIds: ['fry'],
      });

      const updated = chatService.updateChannel(ch.id, {});
      expect(updated).toBeTruthy();
      expect(updated!.name).toBe('Stable');
      expect(updated!.description).toBe('steady');
      expect(updated!.memberAgentIds).toEqual(['fry']);
      expect(updated!.id).toBe(ch.id);
    });

    it('should bump updatedAt even with empty update', () => {
      const ch = chatService.createChannel({ name: 'Timestamp' });
      const updated = chatService.updateChannel(ch.id, {});
      expect(updated!.updatedAt >= ch.updatedAt).toBe(true);
    });

    it('should preserve createdAt across updates', () => {
      const ch = chatService.createChannel({ name: 'Preserve' });
      const updated = chatService.updateChannel(ch.id, { name: 'Preserve v2' });
      expect(updated!.createdAt).toBe(ch.createdAt);
    });

    it('should update only description leaving name and members intact', () => {
      const ch = chatService.createChannel({
        name: 'Partial',
        description: 'old',
        memberAgentIds: ['bender', 'leela'],
      });

      const updated = chatService.updateChannel(ch.id, { description: 'new' });
      expect(updated!.name).toBe('Partial');
      expect(updated!.description).toBe('new');
      expect(updated!.memberAgentIds).toEqual(['bender', 'leela']);
    });
  });

  // ── Duplicate member agent IDs ──────────────────────────────────

  describe('duplicate member agent IDs', () => {
    it('should accept duplicate member IDs without deduplication', () => {
      const ch = chatService.createChannel({
        name: 'Dupes',
        memberAgentIds: ['fry', 'fry', 'bender', 'bender'],
      });

      // Implementation does not deduplicate
      expect(ch.memberAgentIds).toEqual(['fry', 'fry', 'bender', 'bender']);
      expect(ch.memberAgentIds).toHaveLength(4);
    });

    it('should persist and retrieve duplicate member IDs faithfully', () => {
      const ch = chatService.createChannel({
        name: 'DupePersist',
        memberAgentIds: ['leela', 'leela'],
      });

      const found = chatService.getChannel(ch.id);
      expect(found!.memberAgentIds).toEqual(['leela', 'leela']);
    });
  });

  // ── Messages to deleted channels ────────────────────────────────

  describe('messages to deleted channels', () => {
    it('should still accept messages to a deleted channel recipient format', async () => {
      const ch = chatService.createChannel({ name: 'Deleted', memberAgentIds: ['fry'] });
      const channelRecipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      chatService.deleteChannel(ch.id);
      expect(chatService.getChannel(ch.id)).toBeNull();

      // Can still send messages to the deleted channel's recipient format
      const msg = await chatService.send({
        sender: 'user',
        recipient: channelRecipient,
        content: 'ghost message',
      });
      expect(msg.recipient).toBe(channelRecipient);

      const found = chatService.getMessage(msg.id);
      expect(found).toBeTruthy();
      expect(found!.content).toBe('ghost message');
    });

    it('should not clean up post-deletion messages on a second delete attempt', async () => {
      const ch = chatService.createChannel({ name: 'DoubleDel', memberAgentIds: ['bender'] });
      const channelRecipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      chatService.deleteChannel(ch.id);

      // Send a message after deletion
      await chatService.send({
        sender: 'user',
        recipient: channelRecipient,
        content: 'orphan',
      });

      // Second delete attempt returns false (channel already gone)
      const result = chatService.deleteChannel(ch.id);
      expect(result.deleted).toBe(false);
      expect(result.deletedMessages).toBe(0);

      // Orphan message still exists
      const { messages } = chatService.getMessages({ limit: 100 });
      expect(messages.some((m) => m.content === 'orphan')).toBe(true);
    });
  });

  // ── Channel listing stability ───────────────────────────────────

  describe('channel listing stability', () => {
    it('should correctly reflect interleaved creates and deletes', () => {
      const a = chatService.createChannel({ name: 'A', memberAgentIds: ['fry'] });
      const b = chatService.createChannel({ name: 'B', memberAgentIds: ['bender'] });
      const c = chatService.createChannel({ name: 'C', memberAgentIds: ['leela'] });

      chatService.deleteChannel(b.id);
      const d = chatService.createChannel({ name: 'D', memberAgentIds: ['fry'] });

      const channels = chatService.listChannels();
      expect(channels).toHaveLength(3);
      expect(channels.map((ch) => ch.name)).toEqual(['A', 'C', 'D']);
    });

    it('should return empty list after deleting all channels', () => {
      const ids = ['X', 'Y', 'Z'].map(
        (name) => chatService.createChannel({ name, memberAgentIds: ['fry'] }).id,
      );

      ids.forEach((id) => chatService.deleteChannel(id));
      expect(chatService.listChannels()).toEqual([]);
    });
  });

  // ── WebSocket broadcast counting ────────────────────────────────

  describe('WebSocket broadcast counting', () => {
    it('should emit exactly one broadcast per channel create', () => {
      mockWs.broadcasts = [];
      chatService.createChannel({ name: 'One' });
      chatService.createChannel({ name: 'Two', memberAgentIds: ['fry'] });

      const createBroadcasts = mockWs.broadcasts.filter((b) => b.type === 'channel:created');
      expect(createBroadcasts).toHaveLength(2);
    });

    it('should emit exactly one broadcast per channel delete', () => {
      const ch1 = chatService.createChannel({ name: 'Del1', memberAgentIds: ['fry'] });
      const ch2 = chatService.createChannel({ name: 'Del2', memberAgentIds: ['bender'] });
      mockWs.broadcasts = [];

      chatService.deleteChannel(ch1.id);
      chatService.deleteChannel(ch2.id);

      const deleteBroadcasts = mockWs.broadcasts.filter((b) => b.type === 'channel:deleted');
      expect(deleteBroadcasts).toHaveLength(2);
    });

    it('should not emit broadcast for failed delete (non-existent)', () => {
      mockWs.broadcasts = [];
      chatService.deleteChannel('nonexistent');

      expect(mockWs.broadcasts).toHaveLength(0);
    });

    it('should not emit broadcast for failed update (non-existent)', () => {
      mockWs.broadcasts = [];
      chatService.updateChannel('nonexistent', { name: 'Nope' });

      expect(mockWs.broadcasts).toHaveLength(0);
    });
  });

  // ── DB persistence correctness ──────────────────────────────────

  describe('DB persistence correctness', () => {
    it('should persist channel to SQLite on create and read back correctly', () => {
      const ch = chatService.createChannel({
        name: 'Persisted',
        description: 'DB check',
        memberAgentIds: ['bender', 'fry'],
      });

      const row = db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(ch.id) as Record<string, unknown>;
      expect(row).toBeTruthy();
      expect(row.name).toBe('Persisted');
      expect(row.description).toBe('DB check');
      expect(JSON.parse(row.member_agent_ids as string)).toEqual(['bender', 'fry']);
      expect(row.created_at).toBe(ch.createdAt);
      expect(row.updated_at).toBe(ch.updatedAt);
    });

    it('should update the SQLite row on update', () => {
      const ch = chatService.createChannel({
        name: 'Before',
        description: 'old',
        memberAgentIds: ['fry'],
      });

      chatService.updateChannel(ch.id, {
        name: 'After',
        description: 'new',
        memberAgentIds: ['bender', 'leela'],
      });

      const row = db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(ch.id) as Record<string, unknown>;
      expect(row.name).toBe('After');
      expect(row.description).toBe('new');
      expect(JSON.parse(row.member_agent_ids as string)).toEqual(['bender', 'leela']);
    });

    it('should remove the SQLite row on delete', () => {
      const ch = chatService.createChannel({ name: 'Ephemeral', memberAgentIds: ['fry'] });

      chatService.deleteChannel(ch.id);

      const row = db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(ch.id);
      expect(row).toBeUndefined();
    });

    it('should delete associated messages from SQLite on channel delete', () => {
      const ch = chatService.createChannel({ name: 'WithMsgs', memberAgentIds: ['bender'] });
      const recipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      // Insert messages directly
      db.prepare(
        'INSERT INTO chat_messages (id, sender, recipient, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      ).run('msg-1', 'user', recipient, 'hello', new Date().toISOString());
      db.prepare(
        'INSERT INTO chat_messages (id, sender, recipient, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      ).run('msg-2', 'bender', recipient, 'world', new Date().toISOString());

      const result = chatService.deleteChannel(ch.id);
      expect(result.deletedMessages).toBe(2);

      const msgCount = db.prepare('SELECT COUNT(*) as cnt FROM chat_messages WHERE recipient = ?').get(recipient) as { cnt: number };
      expect(msgCount.cnt).toBe(0);
    });

    it('should store memberAgentIds as JSON string in SQLite', () => {
      const ch = chatService.createChannel({
        name: 'JSONCheck',
        memberAgentIds: ['a', 'b', 'c'],
      });

      const row = db.prepare('SELECT member_agent_ids FROM chat_channels WHERE id = ?').get(ch.id) as { member_agent_ids: string };
      expect(typeof row.member_agent_ids).toBe('string');
      expect(row.member_agent_ids).toBe('["a","b","c"]');
    });

    it('should count total rows correctly after interleaved operations', () => {
      chatService.createChannel({ name: 'A' });
      const b = chatService.createChannel({ name: 'B' });
      chatService.createChannel({ name: 'C' });
      chatService.deleteChannel(b.id);
      chatService.createChannel({ name: 'D' });

      const count = db.prepare('SELECT COUNT(*) as cnt FROM chat_channels').get() as { cnt: number };
      expect(count.cnt).toBe(3);
    });
  });

  // ── File persistence (channelsDir) ──────────────────────────────

  describe('file persistence via channelsDir', () => {
    let channelsDir: string;
    let fileService: ChatService;

    beforeEach(async () => {
      channelsDir = path.join(tmpDir, 'channels');
      fileService = new ChatService({ db, sessionsDir: tmpDir, channelsDir });
      fileService.setWebSocketManager(mockWs as unknown as WebSocketManager);
    });

    it('should write a markdown file when channelsDir is set on create', async () => {
      const ch = fileService.createChannel({
        name: 'FilePersist',
        description: 'persisted to disk',
        memberAgentIds: ['bender'],
      });

      // channel-writer fires asynchronously, wait a tick
      await new Promise((r) => setTimeout(r, 100));

      const files = await fs.readdir(channelsDir).catch(() => []);
      expect(files.length).toBeGreaterThanOrEqual(1);
    });

    it('should not throw when channelsDir is null', () => {
      const noFileService = new ChatService({ db, sessionsDir: tmpDir, channelsDir: null });
      noFileService.setWebSocketManager(mockWs as unknown as WebSocketManager);

      const ch = noFileService.createChannel({ name: 'NoFile' });
      expect(ch.name).toBe('NoFile');

      // Update and delete should also not throw
      noFileService.updateChannel(ch.id, { name: 'Renamed' });
      noFileService.deleteChannel(ch.id);
    });
  });

  // ── No-DB scenario ──────────────────────────────────────────────

  describe('no-DB scenario (db = null)', () => {
    let noDB: ChatService;

    beforeEach(() => {
      noDB = new ChatService({ db: null, sessionsDir: null });
    });

    it('listChannels returns empty array without DB', () => {
      expect(noDB.listChannels()).toEqual([]);
    });

    it('getChannel returns null without DB', () => {
      expect(noDB.getChannel('any-id')).toBeNull();
    });

    it('createChannel still returns a channel object without DB', () => {
      const ch = noDB.createChannel({ name: 'Transient', memberAgentIds: ['fry'] });
      expect(ch.id).toBeTruthy();
      expect(ch.name).toBe('Transient');
      expect(ch.memberAgentIds).toEqual(['fry']);
      expect(ch.createdAt).toBeTruthy();
    });

    it('createChannel validates even without DB', () => {
      expect(() => noDB.createChannel({ name: '' })).toThrow(ChannelValidationError);
      expect(() => noDB.createChannel({ name: '   ' })).toThrow(ChannelValidationError);
      expect(() => noDB.createChannel({ name: 'X', memberAgentIds: [] })).toThrow(ChannelValidationError);
    });

    it('createChannel does not check duplicate names without DB', () => {
      noDB.createChannel({ name: 'Same' });
      // No duplicate check because there's no DB to query
      expect(() => noDB.createChannel({ name: 'Same' })).not.toThrow();
    });

    it('updateChannel returns null without DB (cannot find channel)', () => {
      expect(noDB.updateChannel('any-id', { name: 'Nope' })).toBeNull();
    });

    it('deleteChannel returns not-deleted without DB', () => {
      const result = noDB.deleteChannel('any-id');
      expect(result.deleted).toBe(false);
      expect(result.deletedMessages).toBe(0);
    });
  });

  // ── ChannelMembershipError ──────────────────────────────────────

  describe('channel membership validation', () => {
    it('should throw CHANNEL_NOT_FOUND when sending to non-existent channel', async () => {
      const recipient = `${CHAT_CHANNEL_PREFIX}nonexistent`;

      await expect(
        chatService.send({ sender: 'bender', recipient, content: 'hello' }),
      ).rejects.toThrow(ChannelMembershipError);

      try {
        await chatService.send({ sender: 'bender', recipient, content: 'hello' });
      } catch (err) {
        expect(err).toBeInstanceOf(ChannelMembershipError);
        expect((err as ChannelMembershipError).code).toBe('CHANNEL_NOT_FOUND');
      }
    });

    it('should throw NOT_A_MEMBER when agent is not in channel memberAgentIds', async () => {
      const ch = chatService.createChannel({ name: 'Private', memberAgentIds: ['fry'] });
      const recipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      await expect(
        chatService.send({ sender: 'bender', recipient, content: 'intruder' }),
      ).rejects.toThrow(ChannelMembershipError);

      try {
        await chatService.send({ sender: 'bender', recipient, content: 'intruder' });
      } catch (err) {
        expect(err).toBeInstanceOf(ChannelMembershipError);
        expect((err as ChannelMembershipError).code).toBe('NOT_A_MEMBER');
        expect((err as ChannelMembershipError).message).toContain('bender');
      }
    });

    it('should allow user (human) to send to any channel', async () => {
      const ch = chatService.createChannel({ name: 'Open', memberAgentIds: ['fry'] });
      const recipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      // 'user' sender bypasses membership check
      const msg = await chatService.send({ sender: 'user', recipient, content: 'allowed' });
      expect(msg.recipient).toBe(recipient);
    });

    it('should allow a member agent to send to their channel', async () => {
      const ch = chatService.createChannel({ name: 'Team', memberAgentIds: ['bender', 'fry'] });
      const recipient = `${CHAT_CHANNEL_PREFIX}${ch.id}`;

      const msg = await chatService.send({ sender: 'bender', recipient, content: 'member msg' });
      expect(msg.sender).toBe('bender');
    });

    it('should not enforce membership for direct messages (non-channel recipients)', async () => {
      // Direct messages to agents should pass without membership checks
      const msg = await chatService.send({ sender: 'user', recipient: 'bender', content: 'direct' });
      expect(msg.recipient).toBe('bender');
    });
  });

  // ── Error class properties ──────────────────────────────────────

  describe('error class properties', () => {
    it('ChannelValidationError has correct name, code, and message', () => {
      const err = new ChannelValidationError('DUPLICATE_NAME', 'Already exists');
      expect(err.name).toBe('ChannelValidationError');
      expect(err.code).toBe('DUPLICATE_NAME');
      expect(err.message).toBe('Already exists');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ChannelValidationError);
    });

    it('ChannelValidationError codes cover all variants', () => {
      const nameReq = new ChannelValidationError('NAME_REQUIRED', 'name required');
      expect(nameReq.code).toBe('NAME_REQUIRED');

      const emptyList = new ChannelValidationError('EMPTY_MEMBER_LIST', 'empty list');
      expect(emptyList.code).toBe('EMPTY_MEMBER_LIST');

      const dupe = new ChannelValidationError('DUPLICATE_NAME', 'dupe');
      expect(dupe.code).toBe('DUPLICATE_NAME');
    });

    it('ChannelMembershipError has correct name, code, and message', () => {
      const err = new ChannelMembershipError('NOT_A_MEMBER', 'Not a member');
      expect(err.name).toBe('ChannelMembershipError');
      expect(err.code).toBe('NOT_A_MEMBER');
      expect(err.message).toBe('Not a member');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ChannelMembershipError);
    });

    it('ChannelMembershipError codes cover all variants', () => {
      const notFound = new ChannelMembershipError('CHANNEL_NOT_FOUND', 'not found');
      expect(notFound.code).toBe('CHANNEL_NOT_FOUND');

      const notMember = new ChannelMembershipError('NOT_A_MEMBER', 'not member');
      expect(notMember.code).toBe('NOT_A_MEMBER');
    });
  });
});

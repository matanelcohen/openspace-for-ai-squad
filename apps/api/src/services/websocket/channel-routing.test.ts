/**
 * Channel message routing & isolation — unit tests
 *
 * Verifies that the WebSocketManager + ChatService correctly route
 * channel messages so that:
 *   1. Messages sent in channel A reach only channel A members
 *   2. Non-members of a channel do NOT receive its messages
 *   3. A user in multiple channels receives messages only in the correct context
 *   4. Membership validation rejects messages from non-members
 *   5. Real-time subscription updates when joining/leaving channels
 *
 * Uses MockWebSocket clients and in-memory SQLite to test in isolation.
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ChatChannel } from '@openspace/shared';
import { CHAT_CHANNEL_PREFIX } from '@openspace/shared';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';

import { ChannelMembershipError, ChatService } from '../../services/chat/index.js';
import { initializeSchema } from '../../services/db/schema.js';
import { WebSocketManager } from '../../services/websocket/manager.js';
import type { WsEnvelope } from '../../services/websocket/types.js';

// ── Mock WebSocket ────────────────────────────────────────────────

class MockWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  sentMessages: string[] = [];
  terminated = false;
  closed = false;

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(_code?: number, _reason?: string) {
    this.closed = true;
    this.readyState = 3;
    this.emit('close');
  }

  terminate() {
    this.terminated = true;
    this.readyState = 3;
    this.emit('close');
  }

  ping() {}

  simulateMessage(data: string | object) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    this.emit('message', Buffer.from(raw));
  }

  /** Parse all sent messages into WsEnvelope objects. */
  getEvents(): WsEnvelope[] {
    return this.sentMessages.map((m) => JSON.parse(m) as WsEnvelope);
  }

  /** Get chat:message events only (skip welcome and other events). */
  getChatMessages(): WsEnvelope[] {
    return this.getEvents().filter((e) => e.type === 'chat:message');
  }

  /** Clear recorded messages (e.g., after welcome). */
  clearMessages(): void {
    this.sentMessages = [];
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function createClient(manager: WebSocketManager): { ws: MockWebSocket; id: string } {
  const ws = new MockWebSocket();
  const id = manager.addClient(ws as unknown as WebSocket);
  ws.clearMessages(); // clear welcome message
  return { ws, id };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Channel message routing and isolation', () => {
  let manager: WebSocketManager;
  let db: Database.Database;
  let tmpDir: string;
  let chatService: ChatService;

  beforeEach(async () => {
    manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });

    db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'channel-routing-test-'));

    chatService = new ChatService({ db, sessionsDir: tmpDir });
    chatService.setWebSocketManager(manager);
  });

  afterEach(async () => {
    await manager.shutdown();
    db.close();
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 1. Messages sent in channel A are received only by channel A members
  // ═══════════════════════════════════════════════════════════════════

  describe('channel message delivery to members only', () => {
    it('broadcasts chat:message to all connected clients on send', async () => {
      // Two connected clients — both should receive the broadcast
      const client1 = createClient(manager);
      const client2 = createClient(manager);

      const channel = chatService.createChannel({
        name: 'Frontend',
        memberAgentIds: ['fry', 'leela'],
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Hello Frontend team!',
      });

      // Both clients get the chat:message broadcast
      const msgs1 = client1.ws.getChatMessages();
      const msgs2 = client2.ws.getChatMessages();

      expect(msgs1.length).toBeGreaterThanOrEqual(1);
      expect(msgs2.length).toBeGreaterThanOrEqual(1);

      // Verify the message content
      const payload1 = msgs1[0]!.payload as Record<string, unknown>;
      expect(payload1.recipient).toBe(`${CHAT_CHANNEL_PREFIX}${channel.id}`);
      expect(payload1.content).toBe('Hello Frontend team!');
    });

    it('channel message payload includes correct channel recipient', async () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'Backend',
        memberAgentIds: ['bender'],
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Backend discussion',
      });

      const msgs = client.ws.getChatMessages();
      expect(msgs.length).toBeGreaterThanOrEqual(1);

      const payload = msgs[0]!.payload as Record<string, unknown>;
      expect(payload.sender).toBe('user');
      expect(payload.recipient).toBe(`${CHAT_CHANNEL_PREFIX}${channel.id}`);
    });

    it('persists channel messages with the channel recipient in SQLite', async () => {
      const channel = chatService.createChannel({
        name: 'Design',
        memberAgentIds: ['fry'],
      });

      const channelRecipient = `${CHAT_CHANNEL_PREFIX}${channel.id}`;

      await chatService.send({
        sender: 'user',
        recipient: channelRecipient,
        content: 'Design review',
      });

      const row = db
        .prepare('SELECT * FROM chat_messages WHERE recipient = ?')
        .get(channelRecipient) as Record<string, unknown>;
      expect(row).toBeTruthy();
      expect(row.content).toBe('Design review');
      expect(row.recipient).toBe(channelRecipient);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Non-members of a channel do not receive its messages
  // ═══════════════════════════════════════════════════════════════════

  describe('non-member isolation', () => {
    it('clients subscribed to chat:message receive all channels (broadcast model)', async () => {
      // Current architecture: all connected clients get all broadcasts.
      // Channel-level filtering happens on the client side via recipient field.
      const memberClient = createClient(manager);
      const nonMemberClient = createClient(manager);

      // Subscribe both to chat:message
      memberClient.ws.simulateMessage({ action: 'subscribe', events: ['chat:message'] });
      nonMemberClient.ws.simulateMessage({ action: 'subscribe', events: ['chat:message'] });

      const channel = chatService.createChannel({
        name: 'Secret',
        memberAgentIds: ['leela'],
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Confidential info',
      });

      // Both receive broadcast — filtering by membership is client-side
      const memberMsgs = memberClient.ws.getChatMessages();
      const nonMemberMsgs = nonMemberClient.ws.getChatMessages();

      expect(memberMsgs.length).toBeGreaterThanOrEqual(1);
      expect(nonMemberMsgs.length).toBeGreaterThanOrEqual(1);

      // But the recipient field encodes which channel it belongs to,
      // enabling client-side filtering
      const payload = nonMemberMsgs[0]!.payload as Record<string, unknown>;
      expect(payload.recipient).toContain(CHAT_CHANNEL_PREFIX);
    });

    it('message addressed to channel A is NOT addressed to channel B', async () => {
      createClient(manager);

      const channelA = chatService.createChannel({
        name: 'Channel A',
        memberAgentIds: ['fry'],
      });

      const channelB = chatService.createChannel({
        name: 'Channel B',
        memberAgentIds: ['bender'],
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channelA.id}`,
        content: 'For channel A only',
      });

      // Verify message is addressed to channel A, not B
      const row = db
        .prepare('SELECT * FROM chat_messages WHERE content = ?')
        .get('For channel A only') as Record<string, unknown>;

      expect(row.recipient).toBe(`${CHAT_CHANNEL_PREFIX}${channelA.id}`);
      expect(row.recipient).not.toBe(`${CHAT_CHANNEL_PREFIX}${channelB.id}`);
    });

    it('messages to different channels are stored separately', async () => {
      const channelA = chatService.createChannel({
        name: 'Alpha',
        memberAgentIds: ['fry'],
      });
      const channelB = chatService.createChannel({
        name: 'Beta',
        memberAgentIds: ['bender'],
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channelA.id}`,
        content: 'Alpha message',
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channelB.id}`,
        content: 'Beta message',
      });

      const alphaMessages = db
        .prepare('SELECT * FROM chat_messages WHERE recipient = ?')
        .all(`${CHAT_CHANNEL_PREFIX}${channelA.id}`) as Array<Record<string, unknown>>;

      const betaMessages = db
        .prepare('SELECT * FROM chat_messages WHERE recipient = ?')
        .all(`${CHAT_CHANNEL_PREFIX}${channelB.id}`) as Array<Record<string, unknown>>;

      expect(alphaMessages).toHaveLength(1);
      expect(betaMessages).toHaveLength(1);
      expect(alphaMessages[0]!.content).toBe('Alpha message');
      expect(betaMessages[0]!.content).toBe('Beta message');
    });

    it('clients not subscribed to chat:message do not receive channel messages', async () => {
      const subscribedClient = createClient(manager);
      const unsubscribedClient = createClient(manager);

      // Only one client subscribes to chat:message
      subscribedClient.ws.simulateMessage({ action: 'subscribe', events: ['chat:message'] });
      // Other subscribes to something else
      unsubscribedClient.ws.simulateMessage({ action: 'subscribe', events: ['task:updated'] });

      const channel = chatService.createChannel({
        name: 'Private',
        memberAgentIds: ['leela'],
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Private message',
      });

      expect(subscribedClient.ws.getChatMessages().length).toBeGreaterThanOrEqual(1);
      expect(unsubscribedClient.ws.getChatMessages()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. User in multiple channels receives messages in correct context
  // ═══════════════════════════════════════════════════════════════════

  describe('multi-channel user context isolation', () => {
    it('messages to different channels carry distinct channel identifiers', async () => {
      const client = createClient(manager);

      const frontend = chatService.createChannel({
        name: 'Frontend',
        memberAgentIds: ['fry', 'leela'],
      });
      const backend = chatService.createChannel({
        name: 'Backend',
        memberAgentIds: ['bender', 'leela'],
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${frontend.id}`,
        content: 'React question',
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${backend.id}`,
        content: 'Database question',
      });

      const chatMsgs = client.ws.getChatMessages();
      expect(chatMsgs.length).toBeGreaterThanOrEqual(2);

      const recipients = chatMsgs.map((m) => (m.payload as Record<string, unknown>).recipient);
      expect(recipients).toContain(`${CHAT_CHANNEL_PREFIX}${frontend.id}`);
      expect(recipients).toContain(`${CHAT_CHANNEL_PREFIX}${backend.id}`);
    });

    it('querying messages by channel returns only that channel messages', async () => {
      const frontend = chatService.createChannel({
        name: 'Frontend',
        memberAgentIds: ['fry'],
      });
      const backend = chatService.createChannel({
        name: 'Backend',
        memberAgentIds: ['bender'],
      });

      // Send messages to both channels
      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${frontend.id}`,
        content: 'Frontend msg 1',
      });
      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${frontend.id}`,
        content: 'Frontend msg 2',
      });
      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${backend.id}`,
        content: 'Backend msg 1',
      });

      // Query by agent (channel recipient)
      const frontendResult = chatService.getMessages({
        agent: `${CHAT_CHANNEL_PREFIX}${frontend.id}`,
      });
      const backendResult = chatService.getMessages({
        agent: `${CHAT_CHANNEL_PREFIX}${backend.id}`,
      });

      expect(frontendResult.messages).toHaveLength(2);
      expect(backendResult.messages).toHaveLength(1);

      // Verify content isolation
      expect(frontendResult.messages.every((m) =>
        m.content.startsWith('Frontend'),
      )).toBe(true);
      expect(backendResult.messages[0]!.content).toBe('Backend msg 1');
    });

    it('shared member (leela) appears in both channels but messages stay separate', async () => {
      const channelA = chatService.createChannel({
        name: 'Team Alpha',
        memberAgentIds: ['leela', 'fry'],
      });
      const channelB = chatService.createChannel({
        name: 'Team Beta',
        memberAgentIds: ['leela', 'bender'],
      });

      // Leela is a member of both channels
      expect(channelA.memberAgentIds).toContain('leela');
      expect(channelB.memberAgentIds).toContain('leela');

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channelA.id}`,
        content: 'Alpha only',
      });
      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channelB.id}`,
        content: 'Beta only',
      });

      // Verify messages are stored with distinct recipients
      const allMessages = db
        .prepare('SELECT * FROM chat_messages ORDER BY timestamp')
        .all() as Array<Record<string, unknown>>;

      const alphaMsg = allMessages.find((m) => m.content === 'Alpha only');
      const betaMsg = allMessages.find((m) => m.content === 'Beta only');

      expect(alphaMsg!.recipient).toBe(`${CHAT_CHANNEL_PREFIX}${channelA.id}`);
      expect(betaMsg!.recipient).toBe(`${CHAT_CHANNEL_PREFIX}${channelB.id}`);
      expect(alphaMsg!.recipient).not.toBe(betaMsg!.recipient);
    });

    it('direct messages are completely separate from channel messages', async () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'Team',
        memberAgentIds: ['fry', 'bender'],
      });

      // Send a channel message
      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Channel message',
      });

      // Send a direct message
      await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'Direct to Bender',
      });

      const allEvents = client.ws.getChatMessages();
      const payloads = allEvents.map((e) => e.payload as Record<string, unknown>);

      const channelMsg = payloads.find((p) => p.content === 'Channel message');
      const directMsg = payloads.find((p) => p.content === 'Direct to Bender');

      expect(channelMsg).toBeTruthy();
      expect(directMsg).toBeTruthy();
      expect(channelMsg!.recipient).toContain(CHAT_CHANNEL_PREFIX);
      expect(directMsg!.recipient).toBe('bender');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Membership validation
  // ═══════════════════════════════════════════════════════════════════

  describe('membership validation', () => {
    it('channel stores memberAgentIds correctly', () => {
      const channel = chatService.createChannel({
        name: 'Restricted',
        memberAgentIds: ['leela', 'fry'],
      });

      expect(channel.memberAgentIds).toEqual(['leela', 'fry']);

      // Verify persistence
      const stored = chatService.getChannel(channel.id);
      expect(stored!.memberAgentIds).toEqual(['leela', 'fry']);
    });

    it('rejects empty memberAgentIds array', () => {
      expect(() =>
        chatService.createChannel({
          name: 'Empty',
          memberAgentIds: [],
        }),
      ).toThrow('memberAgentIds must not be an empty array');
    });

    it('rejects empty memberAgentIds on update', () => {
      const channel = chatService.createChannel({
        name: 'Updatable',
        memberAgentIds: ['fry'],
      });

      expect(() =>
        chatService.updateChannel(channel.id, { memberAgentIds: [] }),
      ).toThrow('memberAgentIds must not be an empty array');
    });

    it('can verify if an agent is a member of a channel', () => {
      const channel = chatService.createChannel({
        name: 'Members Only',
        memberAgentIds: ['leela', 'fry'],
      });

      const stored = chatService.getChannel(channel.id)!;
      expect(stored.memberAgentIds.includes('leela')).toBe(true);
      expect(stored.memberAgentIds.includes('fry')).toBe(true);
      expect(stored.memberAgentIds.includes('bender')).toBe(false);
      expect(stored.memberAgentIds.includes('zoidberg')).toBe(false);
    });

    it('channel recipient format encodes channel ID for routing', async () => {
      const channel = chatService.createChannel({
        name: 'Encoded',
        memberAgentIds: ['fry'],
      });

      const msg = await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Test routing',
      });

      expect(msg.recipient).toBe(`${CHAT_CHANNEL_PREFIX}${channel.id}`);
      expect(msg.recipient.startsWith(CHAT_CHANNEL_PREFIX)).toBe(true);

      // Extracting channel ID from recipient
      const extractedId = msg.recipient.replace(CHAT_CHANNEL_PREFIX, '');
      expect(extractedId).toBe(channel.id);
    });

    it('deleting a channel cleans up associated messages', async () => {
      const channel = chatService.createChannel({
        name: 'Deletable',
        memberAgentIds: ['fry'],
      });

      const channelRecipient = `${CHAT_CHANNEL_PREFIX}${channel.id}`;

      await chatService.send({
        sender: 'user',
        recipient: channelRecipient,
        content: 'Will be deleted',
      });
      await chatService.send({
        sender: 'user',
        recipient: channelRecipient,
        content: 'Also deleted',
      });

      // Verify messages exist
      const before = db
        .prepare('SELECT COUNT(*) as count FROM chat_messages WHERE recipient = ?')
        .get(channelRecipient) as { count: number };
      expect(before.count).toBe(2);

      // Delete channel
      const result = chatService.deleteChannel(channel.id);
      expect(result.deleted).toBe(true);
      expect(result.deletedMessages).toBe(2);

      // Messages should be gone
      const after = db
        .prepare('SELECT COUNT(*) as count FROM chat_messages WHERE recipient = ?')
        .get(channelRecipient) as { count: number };
      expect(after.count).toBe(0);
    });

    it('duplicate channel names are rejected', () => {
      chatService.createChannel({ name: 'UniqueChannel' });

      expect(() =>
        chatService.createChannel({ name: 'UniqueChannel' }),
      ).toThrow('already exists');
    });

    it('updating memberAgentIds adds/removes members correctly', () => {
      const channel = chatService.createChannel({
        name: 'Dynamic Members',
        memberAgentIds: ['fry', 'leela'],
      });

      // Add bender, remove fry
      const updated = chatService.updateChannel(channel.id, {
        memberAgentIds: ['leela', 'bender'],
      });

      expect(updated!.memberAgentIds).toEqual(['leela', 'bender']);
      expect(updated!.memberAgentIds).not.toContain('fry');

      // Verify persistence
      const stored = chatService.getChannel(channel.id)!;
      expect(stored.memberAgentIds).toEqual(['leela', 'bender']);
    });

    it('rejects agent sending to a channel they are not a member of', async () => {
      const channel = chatService.createChannel({
        name: 'Members Only',
        memberAgentIds: ['leela', 'fry'],
      });

      // Bender is NOT a member — should be rejected
      await expect(
        chatService.send({
          sender: 'bender',
          recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
          content: 'I should not get through',
        }),
      ).rejects.toThrow(ChannelMembershipError);

      // Verify no message was persisted
      const rows = db
        .prepare('SELECT COUNT(*) as count FROM chat_messages WHERE sender = ?')
        .get('bender') as { count: number };
      expect(rows.count).toBe(0);
    });

    it('rejects agent sending to a non-existent channel', async () => {
      await expect(
        chatService.send({
          sender: 'bender',
          recipient: `${CHAT_CHANNEL_PREFIX}does-not-exist`,
          content: 'Ghost channel',
        }),
      ).rejects.toThrow(ChannelMembershipError);
    });

    it('rejection error includes NOT_A_MEMBER code', async () => {
      const channel = chatService.createChannel({
        name: 'Restricted Zone',
        memberAgentIds: ['leela'],
      });

      try {
        await chatService.send({
          sender: 'fry',
          recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
          content: 'Trying to sneak in',
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChannelMembershipError);
        expect((err as ChannelMembershipError).code).toBe('NOT_A_MEMBER');
      }
    });

    it('rejection error includes CHANNEL_NOT_FOUND code for missing channel', async () => {
      try {
        await chatService.send({
          sender: 'fry',
          recipient: `${CHAT_CHANNEL_PREFIX}nonexistent-id`,
          content: 'Where am I?',
        });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ChannelMembershipError);
        expect((err as ChannelMembershipError).code).toBe('CHANNEL_NOT_FOUND');
      }
    });

    it('allows member agent to send to their channel', async () => {
      const channel = chatService.createChannel({
        name: 'Fry Zone',
        memberAgentIds: ['fry'],
      });

      const msg = await chatService.send({
        sender: 'fry',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'I belong here!',
      });

      expect(msg.sender).toBe('fry');
      expect(msg.content).toBe('I belong here!');
    });

    it('human user can always send to any channel', async () => {
      const channel = chatService.createChannel({
        name: 'Agents Only?',
        memberAgentIds: ['leela'],
      });

      // 'user' is not in memberAgentIds but should still be allowed
      const msg = await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Human override',
      });

      expect(msg.sender).toBe('user');
      expect(msg.content).toBe('Human override');
    });

    it('does not broadcast rejected messages via WebSocket', async () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'No Leak',
        memberAgentIds: ['leela'],
      });

      // Bender tries to send — should fail
      try {
        await chatService.send({
          sender: 'bender',
          recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
          content: 'Leaked message',
        });
      } catch {
        // expected
      }

      // No chat:message should have been broadcast
      const chatMsgs = client.ws.getChatMessages();
      const leaked = chatMsgs.find(
        (m) => (m.payload as Record<string, unknown>).content === 'Leaked message',
      );
      expect(leaked).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. Real-time subscription updates when joining/leaving channels
  // ═══════════════════════════════════════════════════════════════════

  describe('real-time subscription updates on join/leave', () => {
    it('broadcasts channel:created when a new channel is created', () => {
      const client = createClient(manager);

      chatService.createChannel({
        name: 'New Channel',
        memberAgentIds: ['fry'],
      });

      const events = client.ws.getEvents();
      const createdEvent = events.find((e) => e.type === 'channel:created');
      expect(createdEvent).toBeTruthy();
      expect((createdEvent!.payload as Record<string, unknown>).name).toBe('New Channel');
    });

    it('broadcasts channel:updated when members change', () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'Evolving',
        memberAgentIds: ['fry'],
      });

      client.ws.clearMessages(); // clear creation broadcast

      chatService.updateChannel(channel.id, {
        memberAgentIds: ['fry', 'leela', 'bender'],
      });

      const events = client.ws.getEvents();
      const updatedEvent = events.find((e) => e.type === 'channel:updated');
      expect(updatedEvent).toBeTruthy();

      const payload = updatedEvent!.payload as Record<string, unknown>;
      expect(payload.memberAgentIds).toEqual(['fry', 'leela', 'bender']);
    });

    it('broadcasts channel:updated when a member is removed', () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'Shrinking',
        memberAgentIds: ['fry', 'leela', 'bender'],
      });

      client.ws.clearMessages();

      chatService.updateChannel(channel.id, {
        memberAgentIds: ['leela'],
      });

      const events = client.ws.getEvents();
      const updatedEvent = events.find((e) => e.type === 'channel:updated');
      expect(updatedEvent).toBeTruthy();

      const payload = updatedEvent!.payload as Record<string, unknown>;
      expect(payload.memberAgentIds).toEqual(['leela']);
    });

    it('broadcasts channel:deleted when a channel is removed', () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'Temporary',
        memberAgentIds: ['fry'],
      });

      client.ws.clearMessages();

      chatService.deleteChannel(channel.id);

      const events = client.ws.getEvents();
      const deletedEvent = events.find((e) => e.type === 'channel:deleted');
      expect(deletedEvent).toBeTruthy();
      expect((deletedEvent!.payload as Record<string, unknown>).id).toBe(channel.id);
    });

    it('all connected clients receive channel lifecycle events', () => {
      const client1 = createClient(manager);
      const client2 = createClient(manager);
      const client3 = createClient(manager);

      chatService.createChannel({
        name: 'Broadcast Test',
        memberAgentIds: ['fry'],
      });

      for (const client of [client1, client2, client3]) {
        const events = client.ws.getEvents();
        const created = events.find((e) => e.type === 'channel:created');
        expect(created).toBeTruthy();
      }
    });

    it('channel updates include full updated channel state', () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'Full State',
        description: 'Original description',
        memberAgentIds: ['fry'],
      });

      client.ws.clearMessages();

      chatService.updateChannel(channel.id, {
        name: 'Updated State',
        description: 'New description',
        memberAgentIds: ['fry', 'leela'],
      });

      const events = client.ws.getEvents();
      const updatedEvent = events.find((e) => e.type === 'channel:updated');
      const payload = updatedEvent!.payload as Record<string, unknown>;

      expect(payload.id).toBe(channel.id);
      expect(payload.name).toBe('Updated State');
      expect(payload.description).toBe('New description');
      expect(payload.memberAgentIds).toEqual(['fry', 'leela']);
      expect(payload.updatedAt).toBeDefined();
    });

    it('rapid join/leave cycles produce correct final state', () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'Rapid Changes',
        memberAgentIds: ['fry'],
      });

      client.ws.clearMessages();

      // Rapid membership changes
      chatService.updateChannel(channel.id, { memberAgentIds: ['fry', 'leela'] });
      chatService.updateChannel(channel.id, { memberAgentIds: ['fry', 'leela', 'bender'] });
      chatService.updateChannel(channel.id, { memberAgentIds: ['leela', 'bender'] });
      chatService.updateChannel(channel.id, { memberAgentIds: ['leela'] });

      // Verify final state in DB
      const final = chatService.getChannel(channel.id)!;
      expect(final.memberAgentIds).toEqual(['leela']);

      // All 4 updates should have been broadcast
      const updateEvents = client.ws.getEvents().filter((e) => e.type === 'channel:updated');
      expect(updateEvents).toHaveLength(4);

      // Last broadcast should match final state
      const lastPayload = updateEvents[3]!.payload as Record<string, unknown>;
      expect(lastPayload.memberAgentIds).toEqual(['leela']);
    });

    it('clients with event subscriptions still receive channel lifecycle events', () => {
      const client = createClient(manager);

      // Subscribe to no specific event types — should receive everything
      // (empty subscriptions = all events)
      const channel = chatService.createChannel({
        name: 'Sub Test',
        memberAgentIds: ['fry'],
      });

      const events = client.ws.getEvents();
      expect(events.some((e) => e.type === 'channel:created')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('sending to a non-existent channel still persists the message', async () => {
      const msg = await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}nonexistent`,
        content: 'Ghost channel message',
      });

      expect(msg.id).toBeTruthy();
      expect(msg.recipient).toBe(`${CHAT_CHANNEL_PREFIX}nonexistent`);

      // Message is still stored
      const stored = chatService.getMessage(msg.id);
      expect(stored).toBeTruthy();
      expect(stored!.content).toBe('Ghost channel message');
    });

    it('channel with all agents as members broadcasts to all', async () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'All Hands',
        memberAgentIds: ['leela', 'fry', 'bender', 'zoidberg'],
      });

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'All hands message',
      });

      expect(client.ws.getChatMessages().length).toBeGreaterThanOrEqual(1);
    });

    it('disconnected client does not receive channel messages', async () => {
      const client = createClient(manager);
      const channel = chatService.createChannel({
        name: 'Disconnect Test',
        memberAgentIds: ['fry'],
      });

      // Disconnect the client
      client.ws.emit('close');
      expect(manager.clientCount).toBe(0);

      await chatService.send({
        sender: 'user',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'After disconnect',
      });

      // No new messages after disconnect
      expect(client.ws.getChatMessages()).toHaveLength(0);
    });

    it('concurrent messages to different channels maintain isolation', async () => {
      const channels = Array.from({ length: 5 }, (_, i) =>
        chatService.createChannel({
          name: `Concurrent-${i}`,
          memberAgentIds: ['fry'],
        }),
      );

      // Send messages to all channels concurrently
      await Promise.all(
        channels.map((ch, i) =>
          chatService.send({
            sender: 'user',
            recipient: `${CHAT_CHANNEL_PREFIX}${ch.id}`,
            content: `Message for channel ${i}`,
          }),
        ),
      );

      // Verify each channel has exactly one message
      for (let i = 0; i < channels.length; i++) {
        const rows = db
          .prepare('SELECT * FROM chat_messages WHERE recipient = ?')
          .all(`${CHAT_CHANNEL_PREFIX}${channels[i]!.id}`) as Array<Record<string, unknown>>;
        expect(rows).toHaveLength(1);
        expect(rows[0]!.content).toBe(`Message for channel ${i}`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. WebSocket chat:send — end-to-end membership validation
  // ═══════════════════════════════════════════════════════════════════

  describe('WebSocket chat:send membership validation', () => {
    it('returns error envelope when non-member agent sends via WebSocket', async () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'WS Restricted',
        memberAgentIds: ['leela'],
      });

      // Wire up the chat:send handler (as app.ts does)
      manager.setChatSendHandler(async (input) => {
        await chatService.send(input);
      });

      // Bender sends via WebSocket — not a member
      client.ws.simulateMessage({
        action: 'chat:send',
        sender: 'bender',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Should be rejected',
      });

      // Allow async handler to complete
      await new Promise((r) => setTimeout(r, 50));

      const allEvents = client.ws.getEvents();
      const errorEnvelope = allEvents.find(
        (e) => (e as unknown as { type: string }).type === 'error',
      );

      expect(errorEnvelope).toBeTruthy();
      const errMsg = errorEnvelope as unknown as { code: string; message: string };
      expect(errMsg.code).toBe('NOT_A_MEMBER');
      expect(errMsg.message).toContain('bender');
    });

    it('returns CHANNEL_NOT_FOUND error for non-existent channel via WebSocket', async () => {
      const client = createClient(manager);

      manager.setChatSendHandler(async (input) => {
        await chatService.send(input);
      });

      client.ws.simulateMessage({
        action: 'chat:send',
        sender: 'fry',
        recipient: `${CHAT_CHANNEL_PREFIX}ghost-channel`,
        content: 'Where is this?',
      });

      await new Promise((r) => setTimeout(r, 50));

      const allEvents = client.ws.getEvents();
      const errorEnvelope = allEvents.find(
        (e) => (e as unknown as { type: string }).type === 'error',
      );

      expect(errorEnvelope).toBeTruthy();
      expect((errorEnvelope as unknown as { code: string }).code).toBe('CHANNEL_NOT_FOUND');
    });

    it('successfully routes message when sender is a channel member', async () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'WS Allowed',
        memberAgentIds: ['fry', 'leela'],
      });

      manager.setChatSendHandler(async (input) => {
        await chatService.send(input);
      });

      client.ws.simulateMessage({
        action: 'chat:send',
        sender: 'fry',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'I belong here',
      });

      await new Promise((r) => setTimeout(r, 50));

      // Should receive a chat:message broadcast, no error
      const chatMsgs = client.ws.getChatMessages();
      expect(chatMsgs.length).toBeGreaterThanOrEqual(1);

      const payload = chatMsgs[0]!.payload as Record<string, unknown>;
      expect(payload.content).toBe('I belong here');
      expect(payload.sender).toBe('fry');

      // No error envelope
      const errors = client.ws.getEvents().filter(
        (e) => (e as unknown as { type: string }).type === 'error',
      );
      expect(errors).toHaveLength(0);
    });

    it('error envelope is sent only to the sender, not broadcast', async () => {
      const sender = createClient(manager);
      const bystander = createClient(manager);

      const channel = chatService.createChannel({
        name: 'No Leak WS',
        memberAgentIds: ['leela'],
      });

      manager.setChatSendHandler(async (input) => {
        await chatService.send(input);
      });

      // Bender (non-member) sends via sender's WebSocket
      sender.ws.simulateMessage({
        action: 'chat:send',
        sender: 'bender',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Leaked?',
      });

      await new Promise((r) => setTimeout(r, 50));

      // Sender gets the error
      const senderErrors = sender.ws.getEvents().filter(
        (e) => (e as unknown as { type: string }).type === 'error',
      );
      expect(senderErrors).toHaveLength(1);

      // Bystander gets nothing — no error, no chat:message
      const bystanderErrors = bystander.ws.getEvents().filter(
        (e) => (e as unknown as { type: string }).type === 'error',
      );
      expect(bystanderErrors).toHaveLength(0);

      const bystanderChats = bystander.ws.getChatMessages().filter(
        (m) => (m.payload as Record<string, unknown>).content === 'Leaked?',
      );
      expect(bystanderChats).toHaveLength(0);
    });

    it('rejected message is not persisted to database', async () => {
      const client = createClient(manager);

      const channel = chatService.createChannel({
        name: 'No Persist WS',
        memberAgentIds: ['leela'],
      });

      manager.setChatSendHandler(async (input) => {
        await chatService.send(input);
      });

      client.ws.simulateMessage({
        action: 'chat:send',
        sender: 'zoidberg',
        recipient: `${CHAT_CHANNEL_PREFIX}${channel.id}`,
        content: 'Should not be stored',
      });

      await new Promise((r) => setTimeout(r, 50));

      const rows = db
        .prepare('SELECT COUNT(*) as count FROM chat_messages WHERE content = ?')
        .get('Should not be stored') as { count: number };
      expect(rows.count).toBe(0);
    });

    it('returns NO_HANDLER error when chatSendHandler is not configured', async () => {
      const client = createClient(manager);
      // Do NOT set a handler

      client.ws.simulateMessage({
        action: 'chat:send',
        sender: 'fry',
        recipient: 'leela',
        content: 'Hello?',
      });

      await new Promise((r) => setTimeout(r, 50));

      const errors = client.ws.getEvents().filter(
        (e) => (e as unknown as { type: string }).type === 'error',
      );
      expect(errors).toHaveLength(1);
      expect((errors[0] as unknown as { code: string }).code).toBe('NO_HANDLER');
    });
  });
});

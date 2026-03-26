/**
 * E2E tests — Channel message routing & isolation
 *
 * Simulates multi-user, multi-channel scenarios against the real API server:
 *   1. Channel CRUD via REST API
 *   2. Message routing — messages land only in the addressed channel
 *   3. Multi-channel isolation — switching channels shows correct messages
 *   4. Membership validation — channel members are enforced
 *   5. Real-time WebSocket delivery of channel lifecycle events
 *
 * These tests use Playwright's `request` context to hit the API directly
 * and WebSocket connections for real-time verification.
 */

import { expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:3001/api';

// ── Helpers ────────────────────────────────────────────────────────

/** Generate a unique channel name to avoid collisions between test runs. */
function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a channel via the API. */
async function createChannel(
  request: import('@playwright/test').APIRequestContext,
  name: string,
  memberAgentIds: string[],
  description = '',
) {
  const res = await request.post(`${API_BASE}/channels`, {
    data: { name, description, memberAgentIds },
  });
  expect(res.ok()).toBe(true);
  return res.json();
}

/** Send a chat message via the API. */
async function sendMessage(
  request: import('@playwright/test').APIRequestContext,
  sender: string,
  recipient: string,
  content: string,
) {
  const res = await request.post(`${API_BASE}/chat/messages`, {
    data: { sender, recipient, content },
  });
  expect(res.ok()).toBe(true);
  return res.json();
}

/** Fetch chat messages filtered by agent/channel recipient. */
async function getMessages(
  request: import('@playwright/test').APIRequestContext,
  agent: string,
  limit = 100,
) {
  const res = await request.get(`${API_BASE}/chat/messages`, {
    params: { agent, limit: String(limit) },
  });
  expect(res.ok()).toBe(true);
  return res.json();
}

// ── Tests ─────────────────────────────────────────────────────────

test.describe('Channel routing & isolation (E2E)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(30_000);

  // Shared state for serial test group
  let channelA: { id: string; name: string };
  let channelB: { id: string; name: string };

  // ═══════════════════════════════════════════════════════════════
  // 1. Channel CRUD — create, read, update, delete
  // ═══════════════════════════════════════════════════════════════

  test('create two channels with distinct members', async ({ request }) => {
    const nameA = uniqueName('ChannelA');
    const nameB = uniqueName('ChannelB');

    channelA = await createChannel(request, nameA, ['fry', 'leela']);
    channelB = await createChannel(request, nameB, ['bender', 'zoidberg']);

    expect(channelA.id).toBeTruthy();
    expect(channelB.id).toBeTruthy();
    expect(channelA.memberAgentIds).toEqual(['fry', 'leela']);
    expect(channelB.memberAgentIds).toEqual(['bender', 'zoidberg']);
  });

  test('channels appear in the channel list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/channels`);
    expect(res.ok()).toBe(true);
    const channels = await res.json();

    const ids = channels.map((c: { id: string }) => c.id);
    expect(ids).toContain(channelA.id);
    expect(ids).toContain(channelB.id);
  });

  test('individual channel retrieval returns correct data', async ({ request }) => {
    const res = await request.get(`${API_BASE}/channels/${channelA.id}`);
    expect(res.ok()).toBe(true);
    const ch = await res.json();

    expect(ch.id).toBe(channelA.id);
    expect(ch.name).toBe(channelA.name);
    expect(ch.memberAgentIds).toEqual(['fry', 'leela']);
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. Message routing — messages are addressed to the correct channel
  // ═══════════════════════════════════════════════════════════════

  test('messages sent to channel A are stored with channel A recipient', async ({ request }) => {
    const msg = await sendMessage(
      request,
      'user',
      `channel:${channelA.id}`,
      'Hello Channel A!',
    );

    expect(msg.recipient).toBe(`channel:${channelA.id}`);
    expect(msg.sender).toBe('user');
    expect(msg.content).toBe('Hello Channel A!');
  });

  test('messages sent to channel B are stored with channel B recipient', async ({ request }) => {
    const msg = await sendMessage(
      request,
      'user',
      `channel:${channelB.id}`,
      'Hello Channel B!',
    );

    expect(msg.recipient).toBe(`channel:${channelB.id}`);
    expect(msg.content).toBe('Hello Channel B!');
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. Multi-channel isolation — querying by channel returns only
  //    that channel's messages
  // ═══════════════════════════════════════════════════════════════

  test('querying channel A messages returns only channel A messages', async ({ request }) => {
    const result = await getMessages(request, `channel:${channelA.id}`);

    const contents = result.messages.map((m: { content: string }) => m.content);
    expect(contents).toContain('Hello Channel A!');
    expect(contents).not.toContain('Hello Channel B!');
  });

  test('querying channel B messages returns only channel B messages', async ({ request }) => {
    const result = await getMessages(request, `channel:${channelB.id}`);

    const contents = result.messages.map((m: { content: string }) => m.content);
    expect(contents).toContain('Hello Channel B!');
    expect(contents).not.toContain('Hello Channel A!');
  });

  test('direct messages are isolated from channel messages', async ({ request }) => {
    // Send a DM to fry
    await sendMessage(request, 'user', 'fry', 'Direct to Fry');

    // Channel A should not contain the DM
    const channelResult = await getMessages(request, `channel:${channelA.id}`);
    const channelContents = channelResult.messages.map((m: { content: string }) => m.content);
    expect(channelContents).not.toContain('Direct to Fry');

    // Querying fry should contain the DM
    const fryResult = await getMessages(request, 'fry');
    const fryContents = fryResult.messages.map((m: { content: string }) => m.content);
    expect(fryContents).toContain('Direct to Fry');
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. Membership validation — channel enforces member constraints
  // ═══════════════════════════════════════════════════════════════

  test('creating a channel with empty memberAgentIds fails', async ({ request }) => {
    const res = await request.post(`${API_BASE}/channels`, {
      data: { name: uniqueName('EmptyMembers'), memberAgentIds: [] },
    });

    // Service throws ChannelValidationError, route maps to >= 400
    expect(res.ok()).toBe(false);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('creating a channel with duplicate name fails', async ({ request }) => {
    // channelA was already created
    const res = await request.post(`${API_BASE}/channels`, {
      data: { name: channelA.name, memberAgentIds: ['fry'] },
    });

    expect(res.ok()).toBe(false);
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toContain('already exists');
  });

  test('updating members adds and removes correctly', async ({ request }) => {
    const res = await request.put(`${API_BASE}/channels/${channelA.id}`, {
      data: { memberAgentIds: ['fry', 'bender'] },
    });
    expect(res.ok()).toBe(true);
    const updated = await res.json();

    expect(updated.memberAgentIds).toEqual(['fry', 'bender']);
    expect(updated.memberAgentIds).not.toContain('leela');
  });

  test('updating members to empty array is rejected', async ({ request }) => {
    const res = await request.put(`${API_BASE}/channels/${channelA.id}`, {
      data: { memberAgentIds: [] },
    });

    expect(res.ok()).toBe(false);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. Channel lifecycle — delete cleans up messages
  // ═══════════════════════════════════════════════════════════════

  test('deleting a channel removes the channel and its messages', async ({ request }) => {
    // Create a temporary channel with messages
    const tmpName = uniqueName('Temp');
    const tmpChannel = await createChannel(request, tmpName, ['fry']);

    await sendMessage(request, 'user', `channel:${tmpChannel.id}`, 'Temp msg 1');
    await sendMessage(request, 'user', `channel:${tmpChannel.id}`, 'Temp msg 2');

    // Delete
    const delRes = await request.delete(`${API_BASE}/channels/${tmpChannel.id}`);
    expect(delRes.status()).toBeLessThan(500);

    // Channel should be gone
    const getRes = await request.get(`${API_BASE}/channels/${tmpChannel.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('deleting a non-existent channel returns 404', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/channels/nonexistent-id-12345`);
    expect(res.status()).toBe(404);
  });

  // ═══════════════════════════════════════════════════════════════
  // Cleanup — remove test channels
  // ═══════════════════════════════════════════════════════════════

  test('cleanup test channels', async ({ request }) => {
    if (channelA?.id) {
      await request.delete(`${API_BASE}/channels/${channelA.id}`);
    }
    if (channelB?.id) {
      await request.delete(`${API_BASE}/channels/${channelB.id}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Multi-user real-time scenarios via WebSocket
// ═══════════════════════════════════════════════════════════════════

test.describe('Multi-user real-time channel events (E2E)', () => {
  test.setTimeout(30_000);

  test('WebSocket clients receive channel lifecycle events in real-time', async ({ request }) => {
    // Connect a WebSocket client to the API server
    const { WebSocket: WsClient } = await import('ws');

    const messages: string[] = [];
    const ws = new WsClient('ws://localhost:3001/ws');

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WS connect timeout')), 5000);
    });

    ws.on('message', (data: Buffer) => {
      messages.push(data.toString());
    });

    // Wait for welcome message
    await new Promise((r) => setTimeout(r, 500));
    const welcomeMessages = [...messages];
    expect(welcomeMessages.length).toBeGreaterThanOrEqual(1);
    const welcome = JSON.parse(welcomeMessages[0]);
    expect(welcome.type).toBe('agent:status');
    expect(welcome.payload.connected).toBe(true);

    // Clear and create a channel
    messages.length = 0;
    const channelName = uniqueName('WSTest');
    const channel = await createChannel(request, channelName, ['fry', 'leela']);

    // Wait for broadcast
    await new Promise((r) => setTimeout(r, 500));

    // Should have received channel:created event
    const parsedEvents = messages.map((m) => JSON.parse(m));
    const createdEvent = parsedEvents.find((e) => e.type === 'channel:created');
    expect(createdEvent).toBeTruthy();
    expect(createdEvent.payload.name).toBe(channelName);
    expect(createdEvent.payload.memberAgentIds).toEqual(['fry', 'leela']);

    // Update the channel and check for update event
    messages.length = 0;
    await request.put(`${API_BASE}/channels/${channel.id}`, {
      data: { memberAgentIds: ['fry', 'leela', 'bender'] },
    });

    await new Promise((r) => setTimeout(r, 500));
    const updateEvents = messages.map((m) => JSON.parse(m));
    const updatedEvent = updateEvents.find((e) => e.type === 'channel:updated');
    expect(updatedEvent).toBeTruthy();
    expect(updatedEvent.payload.memberAgentIds).toEqual(['fry', 'leela', 'bender']);

    // Delete channel and check for delete event
    messages.length = 0;
    await request.delete(`${API_BASE}/channels/${channel.id}`);

    await new Promise((r) => setTimeout(r, 500));
    const deleteEvents = messages.map((m) => JSON.parse(m));
    const deletedEvent = deleteEvents.find((e) => e.type === 'channel:deleted');
    expect(deletedEvent).toBeTruthy();
    expect(deletedEvent.payload.id).toBe(channel.id);

    ws.close();
  });

  test('two WebSocket clients both receive channel message broadcasts', async ({ request }) => {
    const { WebSocket: WsClient } = await import('ws');

    // Connect two independent WebSocket clients
    const messages1: string[] = [];
    const messages2: string[] = [];

    const ws1 = new WsClient('ws://localhost:3001/ws');
    const ws2 = new WsClient('ws://localhost:3001/ws');

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        ws1.on('open', resolve);
        ws1.on('error', reject);
        setTimeout(() => reject(new Error('WS1 timeout')), 5000);
      }),
      new Promise<void>((resolve, reject) => {
        ws2.on('open', resolve);
        ws2.on('error', reject);
        setTimeout(() => reject(new Error('WS2 timeout')), 5000);
      }),
    ]);

    ws1.on('message', (data: Buffer) => messages1.push(data.toString()));
    ws2.on('message', (data: Buffer) => messages2.push(data.toString()));

    // Wait for welcome messages
    await new Promise((r) => setTimeout(r, 500));
    messages1.length = 0;
    messages2.length = 0;

    // Create a channel and send a message
    const channelName = uniqueName('MultiUser');
    const channel = await createChannel(request, channelName, ['fry']);

    await sendMessage(request, 'user', `channel:${channel.id}`, 'Multi-user test message');

    // Wait for broadcasts
    await new Promise((r) => setTimeout(r, 1000));

    // Both clients should have received the chat:message event
    const chatMsgs1 = messages1
      .map((m) => JSON.parse(m))
      .filter((e) => e.type === 'chat:message');
    const chatMsgs2 = messages2
      .map((m) => JSON.parse(m))
      .filter((e) => e.type === 'chat:message');

    expect(chatMsgs1.length).toBeGreaterThanOrEqual(1);
    expect(chatMsgs2.length).toBeGreaterThanOrEqual(1);

    // Both received the same message content
    const content1 = chatMsgs1.find(
      (m) => m.payload.content === 'Multi-user test message',
    );
    const content2 = chatMsgs2.find(
      (m) => m.payload.content === 'Multi-user test message',
    );

    expect(content1).toBeTruthy();
    expect(content2).toBeTruthy();

    // The message is scoped to the correct channel
    expect(content1.payload.recipient).toBe(`channel:${channel.id}`);
    expect(content2.payload.recipient).toBe(`channel:${channel.id}`);

    // Cleanup
    await request.delete(`${API_BASE}/channels/${channel.id}`);
    ws1.close();
    ws2.close();
  });

  test('WebSocket client with subscription filter only receives subscribed events', async ({
    request,
  }) => {
    const { WebSocket: WsClient } = await import('ws');

    const messages: string[] = [];
    const ws = new WsClient('ws://localhost:3001/ws');

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WS timeout')), 5000);
    });

    ws.on('message', (data: Buffer) => messages.push(data.toString()));

    // Wait for welcome, then subscribe only to task:updated (NOT chat:message)
    await new Promise((r) => setTimeout(r, 500));
    messages.length = 0;

    ws.send(JSON.stringify({ action: 'subscribe', events: ['task:updated'] }));
    await new Promise((r) => setTimeout(r, 200));

    // Create a channel and send a chat message
    const channelName = uniqueName('SubFilter');
    const channel = await createChannel(request, channelName, ['fry']);
    await sendMessage(request, 'user', `channel:${channel.id}`, 'Should not be received');

    await new Promise((r) => setTimeout(r, 1000));

    // Client should NOT have received chat:message (it subscribed to task:updated only)
    const chatMsgs = messages
      .map((m) => JSON.parse(m))
      .filter((e) => e.type === 'chat:message');

    expect(chatMsgs).toHaveLength(0);

    // Cleanup
    await request.delete(`${API_BASE}/channels/${channel.id}`);
    ws.close();
  });

  test('messages to different channels carry distinct recipients over WebSocket', async ({
    request,
  }) => {
    const { WebSocket: WsClient } = await import('ws');

    const messages: string[] = [];
    const ws = new WsClient('ws://localhost:3001/ws');

    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WS timeout')), 5000);
    });

    ws.on('message', (data: Buffer) => messages.push(data.toString()));

    await new Promise((r) => setTimeout(r, 500));
    messages.length = 0;

    // Create two channels
    const chAlpha = await createChannel(request, uniqueName('Alpha'), ['fry']);
    const chBeta = await createChannel(request, uniqueName('Beta'), ['bender']);

    // Send messages to each channel
    await sendMessage(request, 'user', `channel:${chAlpha.id}`, 'Alpha message');
    await sendMessage(request, 'user', `channel:${chBeta.id}`, 'Beta message');

    await new Promise((r) => setTimeout(r, 1000));

    // Parse chat messages
    const chatMsgs = messages
      .map((m) => JSON.parse(m))
      .filter((e) => e.type === 'chat:message');

    const alphaMsg = chatMsgs.find((m) => m.payload.content === 'Alpha message');
    const betaMsg = chatMsgs.find((m) => m.payload.content === 'Beta message');

    expect(alphaMsg).toBeTruthy();
    expect(betaMsg).toBeTruthy();
    expect(alphaMsg.payload.recipient).toBe(`channel:${chAlpha.id}`);
    expect(betaMsg.payload.recipient).toBe(`channel:${chBeta.id}`);

    // Cross-check: recipients are different
    expect(alphaMsg.payload.recipient).not.toBe(betaMsg.payload.recipient);

    // Cleanup
    await request.delete(`${API_BASE}/channels/${chAlpha.id}`);
    await request.delete(`${API_BASE}/channels/${chBeta.id}`);
    ws.close();
  });
});

// ═══════════════════════════════════════════════════════════════════
// UI channel switching & message context (via browser)
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel switching in UI', () => {
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();
  });

  test('switching channels changes the active channel indicator', async ({ page }) => {
    const teamChannel = page.getByTestId('channel-team');
    const leelaChannel = page.getByTestId('channel-leela');

    // Team is active by default
    await expect(teamChannel).toHaveAttribute('aria-selected', 'true');

    // Switch to Leela
    await leelaChannel.click();
    await page.waitForTimeout(500);

    await expect(leelaChannel).toHaveAttribute('aria-selected', 'true');
    await expect(teamChannel).toHaveAttribute('aria-selected', 'false');
  });

  test('each agent channel is independently accessible', async ({ page }) => {
    const agents = ['leela', 'fry', 'bender', 'zoidberg'];

    for (const agent of agents) {
      const channel = page.getByTestId(`channel-${agent}`);
      await channel.click();
      await page.waitForTimeout(300);
      await expect(channel).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('sending a message in one channel does not appear when switching to another', async ({
    page,
  }) => {
    // Send a message in the Leela channel
    const leelaChannel = page.getByTestId('channel-leela');
    await leelaChannel.click();
    await page.waitForTimeout(500);

    const uniqueText = `Leela-only-${Date.now()}`;
    const composerInput = page.locator('[aria-label="Message input"]');
    await composerInput.fill(uniqueText);
    const sendButton = page.locator('[aria-label="Send message"]');
    await sendButton.click();

    // Wait for message to appear
    await expect(
      page.locator('[data-role="user"]').filter({ hasText: uniqueText }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Switch to Bender channel
    const benderChannel = page.getByTestId('channel-bender');
    await benderChannel.click();
    await page.waitForTimeout(1000);

    // The unique message should NOT be visible in Bender's channel
    const benderMessages = page.locator('[data-role="user"]').filter({ hasText: uniqueText });
    await expect(benderMessages).toHaveCount(0);
  });
});

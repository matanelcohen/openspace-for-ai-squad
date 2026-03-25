/**
 * E2E tests — Full channel workflow
 *
 * Covers the complete channel lifecycle through the UI and API:
 *   1. Create channel via UI dialog → navigate → send message → verify delivery
 *   2. Empty channel state after creation
 *   3. Multiple messages display and ordering
 *   4. Channel deletion via UI
 *   5. Permission boundaries (non-member agent rejected, human always allowed)
 *   6. Cross-channel message isolation
 *
 * Each test is isolated and cleans up after itself via try/finally.
 */

import { type APIRequestContext, expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:3001/api';

// ── Helpers ────────────────────────────────────────────────────────

/** Generate a unique channel name to avoid collisions between test runs. */
function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a channel via the REST API (fast setup). */
async function createChannelViaAPI(
  request: APIRequestContext,
  name: string,
  memberAgentIds: string[],
  description = '',
) {
  const res = await request.post(`${API_BASE}/channels`, {
    data: { name, description, memberAgentIds },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string; memberAgentIds: string[] };
}

/** Delete a channel via the REST API (fast cleanup). */
async function deleteChannelViaAPI(request: APIRequestContext, channelId: string) {
  await request.delete(`${API_BASE}/channels/${channelId}`);
}

/** Send a chat message via the REST API and return the raw response. */
async function sendMessageViaAPI(
  request: APIRequestContext,
  sender: string,
  recipient: string,
  content: string,
) {
  return request.post(`${API_BASE}/chat/messages`, {
    data: { sender, recipient, content },
  });
}

// ═══════════════════════════════════════════════════════════════════
// Full channel workflow via UI
// ═══════════════════════════════════════════════════════════════════

test.describe('Full channel workflow (E2E)', () => {
  test.setTimeout(60_000);

  test('create channel via UI, navigate, send message, and verify delivery', async ({
    page,
    request,
  }) => {
    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();

    const channelName = uniqueName('Workflow');

    // Intercept channel creation response to capture the generated ID
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/channels') &&
        res.request().method() === 'POST' &&
        res.status() === 201,
    );

    // Step 1: Open create channel dialog
    await page.getByTestId('create-channel-btn').click();
    await expect(page.getByTestId('channel-dialog')).toBeVisible();

    // Step 2: Fill channel details
    await page.getByTestId('channel-name-input').fill(channelName);
    await page.getByTestId('channel-description-input').fill('E2E workflow test');

    // Step 3: Select agent members
    await page.getByTestId('member-toggle-fry').click();
    await page.getByTestId('member-toggle-leela').click();

    // Step 4: Save
    await page.getByTestId('channel-dialog-save').click();

    // Capture the channel ID from the API response
    const createResponse = await responsePromise;
    const created = await createResponse.json();
    const channelId: string = created.id;

    try {
      // Dialog should close after save
      await expect(page.getByTestId('channel-dialog')).not.toBeVisible({ timeout: 5_000 });

      // Step 5: Channel appears in sidebar
      const channelBtn = page.getByTestId(`channel-custom-${channelId}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });

      // Step 6: Navigate to the new channel
      await channelBtn.click();
      await page.waitForTimeout(500);

      // Step 7: Send a message
      const testMessage = `Workflow test ${Date.now()}`;
      const composerInput = page.locator('[aria-label="Message input"]');
      await expect(composerInput).toBeVisible();
      await composerInput.fill(testMessage);
      await page.locator('[aria-label="Send message"]').click();

      // Step 8: Verify message delivery and display
      const userMsg = page.locator('[data-role="user"]').filter({ hasText: testMessage });
      await expect(userMsg.first()).toBeVisible({ timeout: 10_000 });

      // Verify no duplicate messages (WebSocket dedup)
      await page.waitForTimeout(2_000);
      await expect(userMsg).toHaveCount(1);
    } finally {
      await deleteChannelViaAPI(request, channelId);
    }
  });

  test('newly created channel starts with empty message state', async ({ page, request }) => {
    const channelName = uniqueName('Empty');
    const channel = await createChannelViaAPI(request, channelName, ['fry']);

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      // Navigate to the empty channel
      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(1_000);

      // No user or assistant messages should exist
      const messages = page.locator('[data-role="user"], [data-role="assistant"]');
      await expect(messages).toHaveCount(0);

      // Composer should still be available for sending
      await expect(page.locator('[aria-label="Message input"]')).toBeVisible();
      await expect(page.locator('[aria-label="Send message"]')).toBeVisible();
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('multiple messages display in correct order', async ({ page, request }) => {
    const channelName = uniqueName('MultiMsg');
    const channel = await createChannelViaAPI(request, channelName, ['fry']);
    const channelRecipient = `channel:${channel.id}`;

    // Pre-seed messages via API for speed (avoids waiting for AI responses)
    const msgTexts = [`First-${Date.now()}`, `Second-${Date.now() + 1}`, `Third-${Date.now() + 2}`];

    try {
      for (const text of msgTexts) {
        const res = await sendMessageViaAPI(request, 'user', channelRecipient, text);
        expect(res.status()).toBe(201);
      }

      // Load the chat page and navigate to the channel
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(1_500);

      // Verify all three messages are visible
      for (const text of msgTexts) {
        await expect(
          page.locator('[data-role="user"]').filter({ hasText: text }).first(),
        ).toBeVisible({ timeout: 5_000 });
      }

      // Verify ordering: messages should appear in chronological order
      const allUserMessages = page.locator('[data-role="user"]');
      const count = await allUserMessages.count();
      expect(count).toBeGreaterThanOrEqual(3);

      const displayedTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await allUserMessages.nth(i).textContent();
        displayedTexts.push(text ?? '');
      }

      // Find indices of our test messages
      const indices = msgTexts.map((msg) => displayedTexts.findIndex((t) => t.includes(msg)));

      // All found
      for (const idx of indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
      }

      // In ascending order (first before second before third)
      expect(indices[0]).toBeLessThan(indices[1]);
      expect(indices[1]).toBeLessThan(indices[2]);
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('delete channel via UI removes it from sidebar', async ({ page, request }) => {
    const channelName = uniqueName('ToDelete');
    const channel = await createChannelViaAPI(request, channelName, ['bender']);

    // No try/finally needed — deletion IS the test action
    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();

    const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
    await expect(channelBtn).toBeVisible({ timeout: 5_000 });

    // Open channel context menu and click delete
    await page.getByTestId(`channel-menu-${channel.id}`).click();
    await page.getByTestId(`delete-channel-${channel.id}`).click();

    // Confirm deletion in dialog
    await expect(page.getByTestId('delete-channel-dialog')).toBeVisible();
    await page.getByTestId('delete-channel-confirm').click();

    // Channel should disappear from sidebar
    await expect(channelBtn).not.toBeVisible({ timeout: 5_000 });

    // Verify via API that the channel is truly gone
    const res = await request.get(`${API_BASE}/channels/${channel.id}`);
    expect(res.status()).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Permission boundaries
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel permission boundaries (E2E)', () => {
  test.setTimeout(30_000);

  test('non-member agent cannot send message to channel', async ({ request }) => {
    const channelName = uniqueName('Restricted');
    const channel = await createChannelViaAPI(request, channelName, ['fry', 'leela']);

    try {
      // bender is NOT a member of this channel — should be rejected
      const res = await sendMessageViaAPI(
        request,
        'bender',
        `channel:${channel.id}`,
        'Should be rejected',
      );

      expect(res.ok()).toBe(false);
      expect(res.status()).toBeGreaterThanOrEqual(400);
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('member agent can send message to channel', async ({ request }) => {
    const channelName = uniqueName('Allowed');
    const channel = await createChannelViaAPI(request, channelName, ['fry']);

    try {
      // fry IS a member — should succeed
      const res = await sendMessageViaAPI(
        request,
        'fry',
        `channel:${channel.id}`,
        'Fry says hello!',
      );

      expect(res.status()).toBe(201);
      const msg = await res.json();
      expect(msg.sender).toBe('fry');
      expect(msg.recipient).toBe(`channel:${channel.id}`);
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('sending to non-existent channel fails', async ({ request }) => {
    // No channel with this ID exists
    const res = await sendMessageViaAPI(
      request,
      'fry',
      'channel:nonexistent-channel-99999',
      'Should fail',
    );

    expect(res.ok()).toBe(false);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('human user can always send to any channel regardless of membership', async ({
    request,
  }) => {
    // Channel with only fry as member
    const channelName = uniqueName('UserAccess');
    const channel = await createChannelViaAPI(request, channelName, ['fry']);

    try {
      // 'user' sender bypasses membership validation
      const res = await sendMessageViaAPI(
        request,
        'user',
        `channel:${channel.id}`,
        'User can always send',
      );

      expect(res.status()).toBe(201);
      const msg = await res.json();
      expect(msg.sender).toBe('user');
      expect(msg.content).toBe('User can always send');
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('channel messages are isolated — not visible in other channels', async ({
    page,
    request,
  }) => {
    const channelA = await createChannelViaAPI(request, uniqueName('IsoA'), ['fry']);
    const channelB = await createChannelViaAPI(request, uniqueName('IsoB'), ['bender']);

    const uniqueContent = `Isolation-test-${Date.now()}`;

    try {
      // Send a message to channel A via API
      const sendRes = await sendMessageViaAPI(
        request,
        'user',
        `channel:${channelA.id}`,
        uniqueContent,
      );
      expect(sendRes.status()).toBe(201);

      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      // Navigate to channel B — message from A should NOT appear
      const channelBBtn = page.getByTestId(`channel-custom-${channelB.id}`);
      await expect(channelBBtn).toBeVisible({ timeout: 5_000 });
      await channelBBtn.click();
      await page.waitForTimeout(1_000);

      const leakedMsg = page.locator('[data-role="user"]').filter({ hasText: uniqueContent });
      await expect(leakedMsg).toHaveCount(0);

      // Navigate to channel A — message SHOULD be visible
      const channelABtn = page.getByTestId(`channel-custom-${channelA.id}`);
      await channelABtn.click();
      await page.waitForTimeout(1_000);

      await expect(
        page.locator('[data-role="user"]').filter({ hasText: uniqueContent }).first(),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await deleteChannelViaAPI(request, channelA.id);
      await deleteChannelViaAPI(request, channelB.id);
    }
  });
});

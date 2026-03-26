/**
 * E2E tests — Channel edit workflow & header UI
 *
 * Covers gaps not addressed by existing tests:
 *   1. Edit channel via settings dropdown → dialog pre-populated
 *   2. Update name / description / members through UI
 *   3. Channel header displays correct info (name, description, members)
 *   4. Member avatar overflow badge
 *   5. Channel dialog validation (empty name blocks save)
 *   6. Real-time cache sync — channel created via API appears in sidebar
 */

import { type APIRequestContext, expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:3001/api';

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

async function deleteChannelViaAPI(request: APIRequestContext, channelId: string) {
  await request.delete(`${API_BASE}/channels/${channelId}`);
}

// ═══════════════════════════════════════════════════════════════════
// Channel header UI
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel header UI', () => {
  test.setTimeout(30_000);

  test('header displays channel name, description, and member avatars', async ({
    page,
    request,
  }) => {
    const name = uniqueName('Header');
    const description = 'A descriptive channel header test';
    const channel = await createChannelViaAPI(request, name, ['fry', 'leela'], description);

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      // Navigate to the channel
      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(500);

      // Verify header shows channel name
      const headerName = page.getByTestId('channel-header-name');
      await expect(headerName).toBeVisible();
      await expect(headerName).toContainText(name);

      // Verify header shows description
      const headerDesc = page.getByTestId('channel-header-description');
      await expect(headerDesc).toBeVisible();
      await expect(headerDesc).toContainText(description);

      // Verify member avatars are shown
      await expect(page.getByTestId('channel-member-avatar-fry')).toBeVisible();
      await expect(page.getByTestId('channel-member-avatar-leela')).toBeVisible();

      // Verify member count
      const memberCount = page.getByTestId('channel-header-member-count');
      await expect(memberCount).toBeVisible();
      await expect(memberCount).toContainText('2');
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('header settings dropdown has edit and delete actions', async ({ page, request }) => {
    const channel = await createChannelViaAPI(request, uniqueName('Settings'), ['fry']);

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(500);

      // Open settings dropdown
      const settingsBtn = page.getByTestId('channel-header-settings');
      await expect(settingsBtn).toBeVisible();
      await settingsBtn.click();

      // Verify edit and delete actions exist
      await expect(page.getByTestId('channel-header-edit')).toBeVisible();
      await expect(page.getByTestId('channel-header-delete')).toBeVisible();
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Edit channel workflow
// ═══════════════════════════════════════════════════════════════════

test.describe('Edit channel via UI', () => {
  test.setTimeout(45_000);

  test('edit dialog is pre-populated with current channel data', async ({ page, request }) => {
    const name = uniqueName('PreFill');
    const description = 'Pre-fill test description';
    const channel = await createChannelViaAPI(request, name, ['fry', 'leela'], description);

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      // Navigate to channel
      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(500);

      // Open settings → edit
      await page.getByTestId('channel-header-settings').click();
      await page.getByTestId('channel-header-edit').click();

      // Dialog should open
      await expect(page.getByTestId('channel-dialog')).toBeVisible();

      // Verify fields are pre-populated
      const nameInput = page.getByTestId('channel-name-input');
      await expect(nameInput).toHaveValue(name);

      const descInput = page.getByTestId('channel-description-input');
      await expect(descInput).toHaveValue(description);
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('update channel name via UI and verify sidebar reflects change', async ({
    page,
    request,
  }) => {
    const originalName = uniqueName('EditName');
    const channel = await createChannelViaAPI(request, originalName, ['fry']);
    const newName = uniqueName('Renamed');

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      // Navigate to channel
      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(500);

      // Open edit dialog
      await page.getByTestId('channel-header-settings').click();
      await page.getByTestId('channel-header-edit').click();
      await expect(page.getByTestId('channel-dialog')).toBeVisible();

      // Clear and type new name
      const nameInput = page.getByTestId('channel-name-input');
      await nameInput.clear();
      await nameInput.fill(newName);

      // Save
      await page.getByTestId('channel-dialog-save').click();
      await expect(page.getByTestId('channel-dialog')).not.toBeVisible({ timeout: 5_000 });

      // Verify header updated
      await expect(page.getByTestId('channel-header-name')).toContainText(newName, {
        timeout: 5_000,
      });

      // Verify sidebar reflects updated name
      const sidebarBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(sidebarBtn).toContainText(newName, { timeout: 5_000 });

      // Verify via API
      const res = await request.get(`${API_BASE}/channels/${channel.id}`);
      const updated = await res.json();
      expect(updated.name).toBe(newName);
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('update channel description via UI', async ({ page, request }) => {
    const channel = await createChannelViaAPI(
      request,
      uniqueName('EditDesc'),
      ['fry'],
      'Original description',
    );
    const newDescription = 'Updated description via E2E test';

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(500);

      // Open edit dialog
      await page.getByTestId('channel-header-settings').click();
      await page.getByTestId('channel-header-edit').click();
      await expect(page.getByTestId('channel-dialog')).toBeVisible();

      // Update description
      const descInput = page.getByTestId('channel-description-input');
      await descInput.clear();
      await descInput.fill(newDescription);

      // Save
      await page.getByTestId('channel-dialog-save').click();
      await expect(page.getByTestId('channel-dialog')).not.toBeVisible({ timeout: 5_000 });

      // Verify header updated
      await expect(page.getByTestId('channel-header-description')).toContainText(newDescription, {
        timeout: 5_000,
      });
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('add member via edit dialog and verify header avatars update', async ({
    page,
    request,
  }) => {
    const channel = await createChannelViaAPI(request, uniqueName('AddMember'), ['fry']);

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(500);

      // Initially only fry should be shown
      await expect(page.getByTestId('channel-member-avatar-fry')).toBeVisible();

      // Open edit dialog
      await page.getByTestId('channel-header-settings').click();
      await page.getByTestId('channel-header-edit').click();
      await expect(page.getByTestId('channel-dialog')).toBeVisible();

      // Toggle leela as member
      await page.getByTestId('member-toggle-leela').click();

      // Save
      await page.getByTestId('channel-dialog-save').click();
      await expect(page.getByTestId('channel-dialog')).not.toBeVisible({ timeout: 5_000 });

      // Verify both avatars now visible
      await expect(page.getByTestId('channel-member-avatar-fry')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByTestId('channel-member-avatar-leela')).toBeVisible({
        timeout: 5_000,
      });

      // Verify member count updated
      await expect(page.getByTestId('channel-header-member-count')).toContainText('2');
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('cancel edit dialog does not persist changes', async ({ page, request }) => {
    const originalName = uniqueName('CancelEdit');
    const channel = await createChannelViaAPI(request, originalName, ['fry']);

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await channelBtn.click();
      await page.waitForTimeout(500);

      // Open edit dialog
      await page.getByTestId('channel-header-settings').click();
      await page.getByTestId('channel-header-edit').click();
      await expect(page.getByTestId('channel-dialog')).toBeVisible();

      // Modify the name
      const nameInput = page.getByTestId('channel-name-input');
      await nameInput.clear();
      await nameInput.fill('This should NOT be saved');

      // Cancel
      await page.getByTestId('channel-dialog-cancel').click();
      await expect(page.getByTestId('channel-dialog')).not.toBeVisible({ timeout: 5_000 });

      // Header should still show original name
      await expect(page.getByTestId('channel-header-name')).toContainText(originalName);

      // Verify via API that nothing changed
      const res = await request.get(`${API_BASE}/channels/${channel.id}`);
      const data = await res.json();
      expect(data.name).toBe(originalName);
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Channel dialog validation
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel dialog validation', () => {
  test.setTimeout(30_000);

  test('create dialog: save button is disabled when name is empty', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();

    // Open create dialog
    await page.getByTestId('create-channel-btn').click();
    await expect(page.getByTestId('channel-dialog')).toBeVisible();

    // Name is empty by default — save should be disabled
    const saveBtn = page.getByTestId('channel-dialog-save');
    await expect(saveBtn).toBeDisabled();

    // Type a name → save should become enabled
    await page.getByTestId('channel-name-input').fill('Test');
    await expect(saveBtn).toBeEnabled();

    // Clear name → save should become disabled again
    await page.getByTestId('channel-name-input').clear();
    await expect(saveBtn).toBeDisabled();

    // Close without saving
    await page.getByTestId('channel-dialog-cancel').click();
  });

  test('create dialog: whitespace-only name keeps save disabled', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();

    await page.getByTestId('create-channel-btn').click();
    await expect(page.getByTestId('channel-dialog')).toBeVisible();

    // Type whitespace only
    await page.getByTestId('channel-name-input').fill('   ');

    const saveBtn = page.getByTestId('channel-dialog-save');
    await expect(saveBtn).toBeDisabled();

    await page.getByTestId('channel-dialog-cancel').click();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Real-time cache sync
// ═══════════════════════════════════════════════════════════════════

test.describe('Channel cache sync via WebSocket', () => {
  test.setTimeout(30_000);

  test('channel created via API appears in sidebar without page refresh', async ({
    page,
    request,
  }) => {
    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();

    // Create a channel via API (simulating another user or tab)
    const name = uniqueName('WsSync');
    const channel = await createChannelViaAPI(request, name, ['fry']);

    try {
      // Channel should appear in sidebar via WebSocket sync (no refresh)
      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 10_000 });
      await expect(channelBtn).toContainText(name);
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });

  test('channel deleted via API disappears from sidebar without page refresh', async ({
    page,
    request,
  }) => {
    const name = uniqueName('WsDelete');
    const channel = await createChannelViaAPI(request, name, ['fry']);

    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();

    // Verify it appears first
    const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
    await expect(channelBtn).toBeVisible({ timeout: 5_000 });

    // Delete via API
    await deleteChannelViaAPI(request, channel.id);

    // Should disappear from sidebar via WebSocket sync
    await expect(channelBtn).not.toBeVisible({ timeout: 10_000 });
  });

  test('channel updated via API reflects new name in sidebar without refresh', async ({
    page,
    request,
  }) => {
    const originalName = uniqueName('WsUpdate');
    const channel = await createChannelViaAPI(request, originalName, ['fry']);
    const newName = uniqueName('WsUpdated');

    try {
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      // Verify original name
      const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
      await expect(channelBtn).toBeVisible({ timeout: 5_000 });
      await expect(channelBtn).toContainText(originalName);

      // Update via API
      const res = await request.put(`${API_BASE}/channels/${channel.id}`, {
        data: { name: newName },
      });
      expect(res.ok()).toBe(true);

      // Sidebar should reflect new name via WebSocket sync
      await expect(channelBtn).toContainText(newName, { timeout: 10_000 });
    } finally {
      await deleteChannelViaAPI(request, channel.id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Delete via header (not context menu)
// ═══════════════════════════════════════════════════════════════════

test.describe('Delete channel via header', () => {
  test.setTimeout(30_000);

  test('delete from header settings removes channel and redirects', async ({ page, request }) => {
    const channel = await createChannelViaAPI(request, uniqueName('HeaderDel'), ['fry']);

    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();

    // Navigate to the channel
    const channelBtn = page.getByTestId(`channel-custom-${channel.id}`);
    await expect(channelBtn).toBeVisible({ timeout: 5_000 });
    await channelBtn.click();
    await page.waitForTimeout(500);

    // Delete via header settings
    await page.getByTestId('channel-header-settings').click();
    await page.getByTestId('channel-header-delete').click();

    // Confirm deletion
    await expect(page.getByTestId('delete-channel-dialog')).toBeVisible();
    await page.getByTestId('delete-channel-confirm').click();

    // Channel should disappear from sidebar
    await expect(channelBtn).not.toBeVisible({ timeout: 5_000 });

    // Verify via API
    const res = await request.get(`${API_BASE}/channels/${channel.id}`);
    expect(res.status()).toBe(404);
  });
});

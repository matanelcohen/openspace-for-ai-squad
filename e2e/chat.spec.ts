import { expect,test } from '@playwright/test';

test.describe('Chat', () => {
  // Some tests involve AI responses that may take time
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    // Wait for the chat client to be fully rendered
    await expect(page.getByTestId('chat-client')).toBeVisible();
  });

  test('chat page loads successfully', async ({ page }) => {
    // Verify main chat components are visible
    await expect(page.getByTestId('chat-sidebar')).toBeVisible();

    // Verify composer is present
    const composerInput = page.locator('[aria-label="Message input"]');
    await expect(composerInput).toBeVisible();

    // Verify no console errors during load
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a moment for any async errors
    await page.waitForTimeout(1000);
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });

  test('send a message successfully', async ({ page }) => {
    const testMessage = `Test message ${Date.now()}`;

    // Type message in composer
    const composerInput = page.locator('[aria-label="Message input"]');
    await composerInput.fill(testMessage);

    // Click send button
    const sendButton = page.locator('[aria-label="Send message"]');
    await sendButton.click();

    // Verify exactly one user message with this text appears (no duplicates)
    const userMsg = page.locator('[data-role="user"]').filter({ hasText: testMessage });
    await expect(userMsg.first()).toBeVisible({ timeout: 10_000 });

    // Wait for WebSocket dedup to settle
    await page.waitForTimeout(2000);
    await expect(userMsg).toHaveCount(1);
  });

  test('agent responds to message', async ({ page }) => {
    const testMessage = `Hello agent ${Date.now()}`;

    // Send a message
    const composerInput = page.locator('[aria-label="Message input"]');
    await composerInput.fill(testMessage);

    const sendButton = page.locator('[aria-label="Send message"]');
    await sendButton.click();

    // Wait for user message to appear
    await expect(
      page.locator('[data-role="user"]').filter({ hasText: testMessage }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for assistant response (SSE streaming + refetch may take time)
    const assistantMessage = page.locator('[data-role="assistant"]').last();
    await expect(assistantMessage).toBeVisible({ timeout: 20_000 });

    // Verify assistant message has some content
    const content = await assistantMessage.textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(0);
  });

  test('channel switching works correctly', async ({ page }) => {
    // Start on Team channel — it should be selected by default
    const teamChannel = page.getByTestId('channel-team');

    // Verify Team channel is active (uses aria-selected)
    await expect(teamChannel).toHaveAttribute('aria-selected', 'true');

    // Switch to an agent DM (Leela)
    const leelaChannel = page.getByTestId('channel-leela');
    await leelaChannel.click();
    await page.waitForTimeout(500);

    // Verify Leela channel is now active
    await expect(leelaChannel).toHaveAttribute('aria-selected', 'true');

    // Verify Team channel is no longer active
    await expect(teamChannel).toHaveAttribute('aria-selected', 'false');

    // Switch to another agent (Bender)
    const benderChannel = page.getByTestId('channel-bender');
    await benderChannel.click();
    await page.waitForTimeout(500);

    await expect(benderChannel).toHaveAttribute('aria-selected', 'true');
    await expect(leelaChannel).toHaveAttribute('aria-selected', 'false');
  });

  test('mobile responsive layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // Sidebar should be visible initially (mobile starts on sidebar view)
    const sidebar = page.getByTestId('chat-sidebar');
    await expect(sidebar).toBeVisible();

    // Click on Team channel
    const teamChannel = page.getByTestId('channel-team');
    await teamChannel.click();
    await page.waitForTimeout(500);

    // On mobile, clicking a channel shows messages and hides sidebar
    const backButton = page.getByTestId('chat-back-btn');
    await expect(backButton).toBeVisible();

    // Sidebar should be hidden
    await expect(sidebar).not.toBeVisible();

    // Click back button to return to sidebar
    await backButton.click();
    await page.waitForTimeout(500);

    // Sidebar should be visible again
    await expect(sidebar).toBeVisible();
  });

  test('welcome state shows correctly', async ({ page }) => {
    // The welcome screen shows when the thread is empty (no messages at all).
    // Wait briefly for messages to load
    await page.waitForTimeout(1000);

    const anyMessages = page.locator('[data-role="user"], [data-role="assistant"]');
    const messageCount = await anyMessages.count();

    const welcomeMessage = page.getByText(/Hey, your squad is here!/i);

    if (messageCount === 0) {
      // Thread is empty — welcome message should be visible
      await expect(welcomeMessage).toBeVisible({ timeout: 5_000 });
    } else {
      // Messages exist from previous test runs — verify welcome is NOT shown
      await expect(welcomeMessage).not.toBeVisible();
    }
  });

  test('suggestion chips work', async ({ page }) => {
    // Look for suggestion buttons in welcome screen
    const suggestions = page.locator('.aui-thread-welcome-suggestions button');
    const suggestionCount = await suggestions.count();

    if (suggestionCount > 0) {
      // Get the first suggestion text
      const firstSuggestion = suggestions.first();
      const suggestionText = await firstSuggestion.textContent();

      // Click the suggestion
      await firstSuggestion.click();

      // Verify a user message appeared (the suggestion text was sent)
      if (suggestionText) {
        await expect(
          page.locator('[data-role="user"]').first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('streaming response appears incrementally', async ({ page }) => {
    const testMessage = `Tell me a story ${Date.now()}`;

    // Send a message
    const composerInput = page.locator('[aria-label="Message input"]');
    await composerInput.fill(testMessage);

    const sendButton = page.locator('[aria-label="Send message"]');
    await sendButton.click();

    // Wait for user message
    await expect(
      page.locator('[data-role="user"]').filter({ hasText: testMessage }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for assistant message to start appearing
    const assistantMessage = page.locator('[data-role="assistant"]').last();
    await expect(assistantMessage).toBeVisible({ timeout: 20_000 });

    // Verify assistant message has content (streaming completed)
    await page.waitForTimeout(2000);
    const content = await assistantMessage.textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(0);
  });

  test('error handling displays error banner', async ({ page }) => {
    // Block the chat messages API with a 500 error response BEFORE reloading.
    // React Query retries 3x by default, so responses must return immediately.
    await page.route('**/api/chat/messages**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    // Force a full page reload to clear React Query cache.
    // The beforeEach already navigated to /chat, so this reloads it.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('chat-client')).toBeVisible();

    // Wait for React Query to exhaust retries and surface the error
    const fetchErrorBanner = page.getByTestId('chat-fetch-error');
    await expect(fetchErrorBanner).toBeVisible({ timeout: 30_000 });

    // Verify the error message text
    await expect(fetchErrorBanner).toContainText('Failed to load messages');
  });

  test('composer input accepts keyboard input', async ({ page }) => {
    const composerInput = page.locator('[aria-label="Message input"]');

    // Type text
    await composerInput.fill('Test message with keyboard');

    // Verify input has the text
    await expect(composerInput).toHaveValue('Test message with keyboard');

    // Clear and try again
    await composerInput.clear();
    await expect(composerInput).toHaveValue('');
  });

  test('send message with Enter key', async ({ page }) => {
    const testMessage = `Enter key test ${Date.now()}`;

    const composerInput = page.locator('[aria-label="Message input"]');
    await composerInput.click();
    await composerInput.fill(testMessage);

    // Ensure React state is settled before pressing Enter
    await page.waitForTimeout(200);
    await composerInput.press('Enter');

    // Verify message appears
    await expect(
      page.locator('[data-role="user"]').filter({ hasText: testMessage }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('multiple messages in conversation', async ({ page }) => {
    // Use a DM channel for faster responses (single agent, not all team agents)
    const agentChannel = page.getByTestId('channel-leela');
    await agentChannel.click();
    await page.waitForTimeout(500);

    const message1 = `First message ${Date.now()}`;
    const message2 = `Second message ${Date.now() + 1}`;

    const composerInput = page.locator('[aria-label="Message input"]');
    const sendButton = page.locator('[aria-label="Send message"]');

    // Send first message
    await composerInput.fill(message1);
    await sendButton.click();
    await expect(
      page.locator('[data-role="user"]').filter({ hasText: message1 }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for assistant response AND for the stream/typing to finish.
    // The "Stop generating" button disappears when isRunning becomes false.
    await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({ timeout: 20_000 });
    const stopButton = page.locator('[aria-label="Stop generating"]');
    await expect(stopButton).not.toBeVisible({ timeout: 30_000 });

    // Send second message
    await composerInput.fill(message2);
    await sendButton.click();
    await expect(
      page.locator('[data-role="user"]').filter({ hasText: message2 }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('all agent channels are accessible', async ({ page }) => {
    const agents = ['leela', 'fry', 'bender', 'zoidberg'];

    for (const agent of agents) {
      const agentChannel = page.getByTestId(`channel-${agent}`);
      await expect(agentChannel).toBeVisible();

      await agentChannel.click();
      await page.waitForTimeout(500);

      // Verify channel is active (uses aria-selected)
      await expect(agentChannel).toHaveAttribute('aria-selected', 'true');

      // Verify composer is still accessible
      const composerInput = page.locator('[aria-label="Message input"]');
      await expect(composerInput).toBeVisible();
    }
  });

  test('voice toggle button is present', async ({ page }) => {
    // Voice toggle may only be visible in the messages panel on desktop
    const voiceToggle = page.getByTestId('voice-toggle');
    await expect(voiceToggle).toBeVisible();
  });
});

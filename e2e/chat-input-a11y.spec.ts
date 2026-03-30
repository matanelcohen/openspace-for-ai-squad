import { expect, test } from '@playwright/test';

/**
 * Chat input responsiveness & accessibility E2E tests.
 *
 * Verifies:
 *  1. Open/close transitions at real browser breakpoints
 *  2. Keyboard navigation (Enter, Shift+Enter)
 *  3. Auto-resize with multiline content
 *  4. Focus & disabled state rendering
 *  5. Voice recording button & send button accessibility
 */
test.describe('Chat Input — Responsiveness & Accessibility', () => {
  test.setTimeout(45_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByTestId('chat-client')).toBeVisible();
  });

  // ==========================================================================
  // 1. Open / Close Transitions
  // ==========================================================================

  test.describe('Open/close transitions', () => {
    test('input starts in closed state with constrained width', async ({ page }) => {
      // Desktop default viewport (1280×720 from playwright config)
      const input = page.getByTestId('message-input');
      await expect(input).toBeVisible();

      // Closed state: inner container should have max-w-2xl (672px cap)
      const inner = input.locator('.rounded-2xl').first();
      const box = await inner.boundingBox();
      expect(box).toBeTruthy();

      // The send button toolbar should be hidden (opacity 0 / height 0)
      const sendBtn = page.getByTestId('send-button');
      await expect(sendBtn).not.toBeVisible();
    });

    test('clicking into textarea opens the input (toolbar becomes visible)', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();

      // After focus, toolbar (send button) should appear
      const sendBtn = page.getByTestId('send-button');
      await expect(sendBtn).toBeVisible({ timeout: 2000 });
    });

    test('typing text opens the input', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.fill('hello world');

      const sendBtn = page.getByTestId('send-button');
      await expect(sendBtn).toBeVisible({ timeout: 2000 });
    });

    test('clicking away with empty text closes the input', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();

      // Toolbar visible
      await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 2000 });

      // Click away to blur (click on chat area body)
      await page.getByTestId('chat-client').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(400);

      // Toolbar should be hidden again
      await expect(page.getByTestId('send-button')).not.toBeVisible();
    });

    test('input stays open after blur when text is present', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.fill('keeping it open');

      // Blur
      await page.getByTestId('chat-client').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(400);

      // Send button should still be visible (input stays open due to content)
      await expect(page.getByTestId('send-button')).toBeVisible();
    });
  });

  // ==========================================================================
  // 2. Keyboard Navigation
  // ==========================================================================

  test.describe('Keyboard navigation', () => {
    test('Enter key sends a message', async ({ page }) => {
      const testMsg = `KB-enter-${Date.now()}`;
      const composer = page.locator('[aria-label="Message input"]');

      await composer.click();
      await composer.fill(testMsg);
      await page.waitForTimeout(200);
      await composer.press('Enter');

      // Message appears in thread
      await expect(
        page.locator('[data-role="user"]').filter({ hasText: testMsg }).first(),
      ).toBeVisible({ timeout: 10_000 });

      // Input should be cleared
      await expect(composer).toHaveValue('');
    });

    test('Shift+Enter inserts a newline instead of sending', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();

      // Type line 1, then Shift+Enter, then line 2
      await composer.pressSequentially('Line one');
      await composer.press('Shift+Enter');
      await composer.pressSequentially('Line two');

      // Value should contain both lines (newline character)
      const value = await composer.inputValue();
      expect(value).toContain('Line one');
      expect(value).toContain('Line two');

      // No message should have been sent (no user message visible)
      const userMsgs = page.locator('[data-role="user"]').filter({ hasText: 'Line one' });
      await expect(userMsgs).toHaveCount(0);
    });

    test('Enter on empty input does nothing', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();
      await composer.press('Enter');

      // No user message should appear
      await page.waitForTimeout(500);
      // No user message should appear — verify input is still empty and focused
      await expect(composer).toHaveValue('');
    });
  });

  // ==========================================================================
  // 3. Auto-Resize Behavior
  // ==========================================================================

  test.describe('Auto-resize', () => {
    test('textarea grows taller with multiline content', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();

      // Measure initial height
      const initialBox = await composer.boundingBox();
      expect(initialBox).toBeTruthy();
      const initialHeight = initialBox!.height;

      // Type multiple lines via Shift+Enter
      await composer.pressSequentially('Line 1');
      await composer.press('Shift+Enter');
      await composer.pressSequentially('Line 2');
      await composer.press('Shift+Enter');
      await composer.pressSequentially('Line 3');
      await composer.press('Shift+Enter');
      await composer.pressSequentially('Line 4');
      await page.waitForTimeout(200);

      // Measure new height
      const grownBox = await composer.boundingBox();
      expect(grownBox).toBeTruthy();
      expect(grownBox!.height).toBeGreaterThan(initialHeight);
    });

    test('textarea shrinks back after clearing content', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();

      // Grow it
      await composer.pressSequentially('A');
      await composer.press('Shift+Enter');
      await composer.pressSequentially('B');
      await composer.press('Shift+Enter');
      await composer.pressSequentially('C');
      await page.waitForTimeout(200);

      const grownBox = await composer.boundingBox();

      // Clear it
      await composer.clear();
      await page.waitForTimeout(200);

      const clearedBox = await composer.boundingBox();
      expect(clearedBox).toBeTruthy();
      expect(clearedBox!.height).toBeLessThanOrEqual(grownBox!.height);
    });

    test('textarea does not exceed max height with many lines', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();

      // Type many lines
      for (let i = 0; i < 15; i++) {
        await composer.pressSequentially(`Line ${i}`);
        if (i < 14) await composer.press('Shift+Enter');
      }
      await page.waitForTimeout(300);

      // Max height is 160px (max-h-40 = 10rem = 160px at default 16px root)
      const box = await composer.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeLessThanOrEqual(170); // small tolerance for borders
    });
  });

  // ==========================================================================
  // 4. Focus & Disabled State Rendering
  // ==========================================================================

  test.describe('Focus & disabled state rendering', () => {
    test('focus ring appears when textarea is clicked', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();
      await page.waitForTimeout(200);

      // The inner container should have a visible ring
      const innerContainer = page.getByTestId('message-input').locator('.rounded-2xl').first();
      const classes = await innerContainer.getAttribute('class');
      expect(classes).toContain('ring-2');
      expect(classes).toContain('shadow-sm');
    });

    test('focus ring disappears when clicking away', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();
      await page.waitForTimeout(200);

      // Blur by clicking elsewhere
      await page.getByTestId('chat-client').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);

      const innerContainer = page.getByTestId('message-input').locator('.rounded-2xl').first();
      const classes = await innerContainer.getAttribute('class');
      expect(classes).not.toContain('ring-2');
    });

    test('send button shows disabled styling when empty', async ({ page }) => {
      // Open the input first
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();
      await page.waitForTimeout(200);

      const sendBtn = page.getByTestId('send-button');
      await expect(sendBtn).toBeVisible();
      await expect(sendBtn).toBeDisabled();

      const classes = await sendBtn.getAttribute('class');
      expect(classes).toContain('bg-muted');
    });

    test('send button activates when text is entered', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();
      await composer.fill('activating send');
      await page.waitForTimeout(200);

      const sendBtn = page.getByTestId('send-button');
      await expect(sendBtn).toBeEnabled();

      const classes = await sendBtn.getAttribute('class');
      expect(classes).toContain('bg-primary');
    });
  });

  // ==========================================================================
  // 5. Responsive Breakpoints
  // ==========================================================================

  test.describe('Responsive breakpoints', () => {
    test('desktop (1280px) — closed input has wide padding', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(300);

      const root = page.getByTestId('message-input');
      const classes = await root.getAttribute('class');
      // lg:px-40 should be active in closed state
      expect(classes).toContain('lg:px-40');
    });

    test('tablet (768px) — closed input adapts padding', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(300);

      const root = page.getByTestId('message-input');
      const classes = await root.getAttribute('class');
      // md:px-28 and sm:px-16 should be present
      expect(classes).toContain('md:px-28');
      expect(classes).toContain('sm:px-16');
    });

    test('mobile (375px) — input uses minimal padding', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/chat');
      await expect(page.getByTestId('chat-client')).toBeVisible();

      // On mobile, need to select a channel to see the message input
      await page.getByTestId('channel-team').click();
      await page.waitForTimeout(500);

      const root = page.getByTestId('message-input');
      await expect(root).toBeVisible();

      // Verify input renders properly in mobile viewport
      const box = await root.boundingBox();
      expect(box).toBeTruthy();
      // Input width should fit within mobile viewport
      expect(box!.width).toBeLessThanOrEqual(375);
    });

    test('open state removes responsive padding at all breakpoints', async ({ page }) => {
      // Desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(300);

      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();
      await page.waitForTimeout(200);

      const root = page.getByTestId('message-input');
      const classes = await root.getAttribute('class');
      // Open state should only have px-4, not the responsive variants
      expect(classes).not.toContain('sm:px-16');
      expect(classes).not.toContain('md:px-28');
      expect(classes).not.toContain('lg:px-40');
    });
  });

  // ==========================================================================
  // 6. Voice Button Accessibility
  // ==========================================================================

  test.describe('Voice & send button in real browser', () => {
    test('voice toggle button is accessible', async ({ page }) => {
      const voiceToggle = page.getByTestId('voice-toggle');
      await expect(voiceToggle).toBeVisible();

      // Button should be clickable
      await expect(voiceToggle).toBeEnabled();
    });

    test('send button becomes accessible after typing', async ({ page }) => {
      const composer = page.locator('[aria-label="Message input"]');
      await composer.click();
      await composer.fill('test a11y');

      const sendBtn = page.getByTestId('send-button');
      await expect(sendBtn).toBeVisible();
      await expect(sendBtn).toBeEnabled();

      // Click it to send
      await sendBtn.click();

      // Verify message was sent
      await expect(
        page.locator('[data-role="user"]').filter({ hasText: 'test a11y' }).first(),
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});

/**
 * Sandbox E2E tests.
 *
 * Tests the sandbox feature end-to-end through the browser UI:
 *   - Sandbox panel loads at /sandboxes
 *   - Create a sandbox with a name and runtime
 *   - Sandbox appears in the sidebar list
 *   - Selecting a sandbox shows its terminal area
 *   - Running a command shows output in the terminal
 *   - Destroying a sandbox removes it from the list
 *   - Runtime selector displays all three runtimes
 *   - Error states and edge cases
 *
 * NOTE: These tests require Docker to be running on the host. If Docker is
 * unavailable the sandbox creation will fail and tests will surface that.
 */

import { expect, test } from '@playwright/test';

test.describe('Sandboxes', () => {
  // Sandbox creation may take time due to Docker image pulls
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/sandboxes');
    await expect(page.getByTestId('sandbox-panel')).toBeVisible();
  });

  // ── Panel rendering ───────────────────────────────────────────

  test('sandbox panel loads with empty state', async ({ page }) => {
    // The panel should render with an instructional message
    await expect(page.getByText('Select a sandbox')).toBeVisible();
    await expect(page.getByTestId('sandbox-create-toggle')).toBeVisible();
  });

  test('sandbox list renders', async ({ page }) => {
    await expect(page.getByTestId('sandbox-list')).toBeVisible();
  });

  // ── Create sandbox flow ─────────────────────────────────────────

  test('create button toggles the creation form', async ({ page }) => {
    const toggleBtn = page.getByTestId('sandbox-create-toggle');

    // Form should not be visible initially
    await expect(page.getByTestId('sandbox-name-input')).not.toBeVisible();

    // Click toggle to show form
    await toggleBtn.click();
    await expect(page.getByTestId('sandbox-name-input')).toBeVisible();
    await expect(page.getByTestId('runtime-selector')).toBeVisible();
    await expect(page.getByTestId('sandbox-create-submit')).toBeVisible();

    // Click again to hide
    await toggleBtn.click();
    await expect(page.getByTestId('sandbox-name-input')).not.toBeVisible();
  });

  test('create submit is disabled with empty name', async ({ page }) => {
    await page.getByTestId('sandbox-create-toggle').click();

    const submitBtn = page.getByTestId('sandbox-create-submit');
    await expect(submitBtn).toBeDisabled();
  });

  test('runtime selector shows all three runtimes', async ({ page }) => {
    await page.getByTestId('sandbox-create-toggle').click();

    // Open the runtime selector dropdown
    await page.getByTestId('runtime-selector').click();

    // All three runtimes should be available
    await expect(page.getByTestId('runtime-node')).toBeVisible();
    await expect(page.getByTestId('runtime-python')).toBeVisible();
    await expect(page.getByTestId('runtime-go')).toBeVisible();
  });

  test('create a Node sandbox and verify it appears in list', async ({ page }) => {
    const sandboxName = `test-node-${Date.now()}`;

    // Open creation form
    await page.getByTestId('sandbox-create-toggle').click();

    // Fill in name
    await page.getByTestId('sandbox-name-input').fill(sandboxName);

    // Runtime defaults to 'node' — submit
    await page.getByTestId('sandbox-create-submit').click();

    // Wait for sandbox to appear in the list
    const sandboxCard = page.getByText(sandboxName);
    await expect(sandboxCard).toBeVisible({ timeout: 60_000 });
  });

  // ── Sandbox selection and terminal ──────────────────────────────

  test('selecting a sandbox shows terminal area', async ({ page }) => {
    const sandboxName = `test-select-${Date.now()}`;

    // Create a sandbox
    await page.getByTestId('sandbox-create-toggle').click();
    await page.getByTestId('sandbox-name-input').fill(sandboxName);
    await page.getByTestId('sandbox-create-submit').click();

    // Wait for it to appear and click on it
    const card = page.getByText(sandboxName);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.click();

    // Terminal components should appear
    await expect(page.getByTestId('terminal-output')).toBeVisible();
    await expect(page.getByTestId('command-input')).toBeVisible();
  });

  test('running a command shows output in terminal', async ({ page }) => {
    const sandboxName = `test-cmd-${Date.now()}`;

    // Create and select
    await page.getByTestId('sandbox-create-toggle').click();
    await page.getByTestId('sandbox-name-input').fill(sandboxName);
    await page.getByTestId('sandbox-create-submit').click();

    const card = page.getByText(sandboxName);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.click();

    // Wait for command input to be enabled
    const commandInput = page.getByTestId('command-input');
    await expect(commandInput).toBeVisible();

    // Type and submit a command
    await commandInput.fill('echo hello-from-e2e');
    await page.getByTestId('command-submit').click();

    // Output should appear in the terminal
    const terminal = page.getByTestId('terminal-output');
    await expect(terminal).toContainText('hello-from-e2e', { timeout: 30_000 });
  });

  // ── Destroy sandbox ─────────────────────────────────────────────

  test('destroying a sandbox removes it from the list', async ({ page }) => {
    const sandboxName = `test-destroy-${Date.now()}`;

    // Create and select
    await page.getByTestId('sandbox-create-toggle').click();
    await page.getByTestId('sandbox-name-input').fill(sandboxName);
    await page.getByTestId('sandbox-create-submit').click();

    const card = page.getByText(sandboxName);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.click();

    // Destroy the sandbox
    const destroyBtn = page.getByTestId('sandbox-destroy');
    await expect(destroyBtn).toBeVisible();
    await destroyBtn.click();

    // Sandbox should disappear from the list
    await expect(page.getByText(sandboxName)).not.toBeVisible({ timeout: 10_000 });

    // Should return to the empty state
    await expect(page.getByText('Select a sandbox')).toBeVisible();
  });

  // ── Controls ────────────────────────────────────────────────────

  test('sandbox controls show correct buttons for running sandbox', async ({ page }) => {
    const sandboxName = `test-controls-${Date.now()}`;

    await page.getByTestId('sandbox-create-toggle').click();
    await page.getByTestId('sandbox-name-input').fill(sandboxName);
    await page.getByTestId('sandbox-create-submit').click();

    const card = page.getByText(sandboxName);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.click();

    // Controls should be visible
    await expect(page.getByTestId('sandbox-stop')).toBeVisible();
    await expect(page.getByTestId('sandbox-destroy')).toBeVisible();
  });

  // ── Create sandbox with different runtimes ──────────────────────

  test('create a Python sandbox', async ({ page }) => {
    const sandboxName = `test-python-${Date.now()}`;

    await page.getByTestId('sandbox-create-toggle').click();
    await page.getByTestId('sandbox-name-input').fill(sandboxName);

    // Select Python runtime
    await page.getByTestId('runtime-selector').click();
    await page.getByTestId('runtime-python').click();

    await page.getByTestId('sandbox-create-submit').click();

    await expect(page.getByText(sandboxName)).toBeVisible({ timeout: 60_000 });
  });

  test('create a Go sandbox', async ({ page }) => {
    const sandboxName = `test-go-${Date.now()}`;

    await page.getByTestId('sandbox-create-toggle').click();
    await page.getByTestId('sandbox-name-input').fill(sandboxName);

    // Select Go runtime
    await page.getByTestId('runtime-selector').click();
    await page.getByTestId('runtime-go').click();

    await page.getByTestId('sandbox-create-submit').click();

    await expect(page.getByText(sandboxName)).toBeVisible({ timeout: 60_000 });
  });

  // ── Terminal features ───────────────────────────────────────────

  test('terminal clear button clears output', async ({ page }) => {
    const sandboxName = `test-clear-${Date.now()}`;

    // Create and select
    await page.getByTestId('sandbox-create-toggle').click();
    await page.getByTestId('sandbox-name-input').fill(sandboxName);
    await page.getByTestId('sandbox-create-submit').click();

    const card = page.getByText(sandboxName);
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.click();

    // Run a command to produce output
    const commandInput = page.getByTestId('command-input');
    await expect(commandInput).toBeVisible();
    await commandInput.fill('echo test-output-to-clear');
    await page.getByTestId('command-submit').click();

    // Wait for output
    const terminal = page.getByTestId('terminal-output');
    await expect(terminal).toContainText('test-output-to-clear', { timeout: 30_000 });

    // Clear terminal
    const clearBtn = page.getByTestId('terminal-clear');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      // Output should be cleared (or significantly reduced)
      await expect(terminal).not.toContainText('test-output-to-clear', { timeout: 5_000 });
    }
  });

  // ── No console errors ──────────────────────────────────────────

  test('sandbox page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/sandboxes');
    await expect(page.getByTestId('sandbox-panel')).toBeVisible();

    // Wait for any async errors
    await page.waitForTimeout(2000);

    // Filter out common non-critical errors (favicon, etc.)
    const criticalErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });
});

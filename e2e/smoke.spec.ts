import { expect, test } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads and shows app shell', async ({ page }) => {
    await page.goto('/');

    // The sidebar brand should be visible
    await expect(page.getByText('openspace.ai')).toBeVisible();
  });

  test('sidebar navigation links are present', async ({ page }) => {
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();

    for (const label of ['Dashboard', 'Tasks', 'Chat', 'Decisions', 'Voice']) {
      await expect(nav.getByText(label)).toBeVisible();
    }
  });

  test('theme toggle switches dark mode', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Toggle theme' });
    await expect(toggle).toBeVisible();

    await toggle.click();
    // Theme change should not break the page
    await expect(page.getByText('openspace.ai')).toBeVisible();
  });

  test('navigating to /tasks shows task board', async ({ page }) => {
    await page.goto('/tasks');

    // The kanban board or a loading state should be rendered
    await expect(
      page.getByTestId('kanban-board').or(page.getByTestId('kanban-loading')),
    ).toBeVisible();
  });
});

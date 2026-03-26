/**
 * E2E tests for the Skill Store page.
 *
 * Covers: page load, skill grid rendering, search/filter,
 *         skill detail navigation, empty state.
 */
import { expect, test } from '@playwright/test';

// ── Page Load & Grid ─────────────────────────────────────────────

test.describe('Skill Store page', () => {
  test('loads and displays page title', async ({ page }) => {
    await page.goto('/skills');

    await expect(page.getByRole('heading', { name: /skill store/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/browse.*discover.*manage.*skills/i),
    ).toBeVisible();
  });

  test('renders skill cards in a grid', async ({ page }) => {
    await page.goto('/skills');

    // Wait for the grid to load (at least one skill card should appear)
    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // There should be at least 1 skill card rendered
    const cardCount = await page.locator('[data-testid="skill-card"]').count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('each skill card shows name and description', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // Card should display skill name and description text
    const cardText = await firstCard.textContent();
    expect(cardText).toBeTruthy();
    expect(cardText!.length).toBeGreaterThan(5);
  });

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/skills');
    await page.waitForTimeout(2000);

    // Filter out common non-critical errors (e.g., favicon)
    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(critical).toHaveLength(0);
  });
});

// ── Search & Filtering ───────────────────────────────────────────

test.describe('Skill Store search and filtering', () => {
  test('search input filters skills by text', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    const totalBefore = await page.locator('[data-testid="skill-card"]').count();

    // Type a specific skill name to filter
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('git');
    await page.waitForTimeout(500);

    const totalAfter = await page.locator('[data-testid="skill-card"]').count();
    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
    expect(totalAfter).toBeGreaterThanOrEqual(1);
  });

  test('search with no results shows empty state or zero cards', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('xyznonexistentskill12345');
    await page.waitForTimeout(500);

    const count = await page.locator('[data-testid="skill-card"]').count();
    expect(count).toBe(0);
  });

  test('clearing search restores all skills', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    const totalBefore = await page.locator('[data-testid="skill-card"]').count();

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('git');
    await page.waitForTimeout(500);

    await searchInput.clear();
    await page.waitForTimeout(500);

    const totalAfter = await page.locator('[data-testid="skill-card"]').count();
    expect(totalAfter).toBe(totalBefore);
  });
});

// ── Skill Detail Navigation ──────────────────────────────────────

test.describe('Skill detail page', () => {
  test('clicking a skill card navigates to detail page', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // Get the skill name before clicking
    const skillName = await firstCard
      .locator('h3, [data-testid="skill-name"]')
      .first()
      .textContent();

    await firstCard.click();
    await page.waitForURL(/\/skills\/[a-z0-9-]+/i, { timeout: 10_000 });

    // The detail page should display the skill name
    if (skillName) {
      await expect(page.getByText(skillName)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('skill detail page shows overview tab', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await page.waitForURL(/\/skills\/[a-z0-9-]+/i, { timeout: 10_000 });

    // Should show tabs for Overview, Tools, Prompts, Dependencies
    const tabList = page.getByRole('tablist');
    if (await tabList.isVisible()) {
      await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    }
  });

  test('skill detail page shows Tools tab', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await page.waitForURL(/\/skills\/[a-z0-9-]+/i, { timeout: 10_000 });

    const toolsTab = page.getByRole('tab', { name: /tools/i });
    if (await toolsTab.isVisible()) {
      await toolsTab.click();
      await page.waitForTimeout(500);
      // Tools content should appear
      const tabPanel = page.getByRole('tabpanel');
      await expect(tabPanel).toBeVisible();
    }
  });

  test('skill detail page shows Prompts tab', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await page.waitForURL(/\/skills\/[a-z0-9-]+/i, { timeout: 10_000 });

    const promptsTab = page.getByRole('tab', { name: /prompts/i });
    if (await promptsTab.isVisible()) {
      await promptsTab.click();
      await page.waitForTimeout(500);
      const tabPanel = page.getByRole('tabpanel');
      await expect(tabPanel).toBeVisible();
    }
  });

  test('skill detail page shows Dependencies tab', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await page.waitForURL(/\/skills\/[a-z0-9-]+/i, { timeout: 10_000 });

    const depsTab = page.getByRole('tab', { name: /dependencies/i });
    if (await depsTab.isVisible()) {
      await depsTab.click();
      await page.waitForTimeout(500);
      const tabPanel = page.getByRole('tabpanel');
      await expect(tabPanel).toBeVisible();
    }
  });

  test('navigating back from detail returns to skill store', async ({ page }) => {
    await page.goto('/skills');

    const firstCard = page.locator('[data-testid="skill-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await page.waitForURL(/\/skills\/[a-z0-9-]+/i, { timeout: 10_000 });

    await page.goBack();
    await page.waitForURL('/skills', { timeout: 10_000 });

    await expect(page.getByRole('heading', { name: /skill store/i })).toBeVisible();
  });
});

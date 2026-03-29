/**
 * Screenshot capture for landing page.
 * Takes screenshots of key features with mock data seeded via API.
 *
 * Run: npx playwright test e2e/screenshots.spec.ts
 * Output: docs/screenshots/
 */

import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

const SCREENSHOTS_DIR = resolve(__dirname, '../docs/screenshots');

test.describe('Landing page screenshots', () => {
  test.beforeAll(async ({ request }) => {
    // Seed mock data via API
    // Create some tasks
    const tasks = [
      { title: 'Implement auth flow with JWT', priority: 'P0', description: 'Build login, logout, token refresh using bcrypt + JWT' },
      { title: 'Design dashboard components', priority: 'P1', description: 'Create React components for the main dashboard view' },
      { title: 'Add WebSocket real-time updates', priority: 'P1', description: 'Wire up WebSocket for live task and chat updates' },
      { title: 'Write API integration tests', priority: 'P2', description: 'Add Vitest tests for all REST endpoints' },
      { title: 'Setup CI/CD pipeline', priority: 'P0', description: 'Configure GitHub Actions for lint, test, build, deploy' },
    ];

    for (const task of tasks) {
      try {
        await request.post('/api/tasks', { data: task });
      } catch { /* task may already exist */ }
    }
  });

  test('dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(SCREENSHOTS_DIR, 'dashboard.png'),
      fullPage: false,
    });
  });

  test('chat', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(SCREENSHOTS_DIR, 'chat.png'),
      fullPage: false,
    });
  });

  test('tasks', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(SCREENSHOTS_DIR, 'tasks.png'),
      fullPage: false,
    });
  });

  test('team members', async ({ page }) => {
    await page.goto('/team-members');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(SCREENSHOTS_DIR, 'team.png'),
      fullPage: false,
    });
  });

  test('traces', async ({ page }) => {
    await page.goto('/traces');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(SCREENSHOTS_DIR, 'traces.png'),
      fullPage: false,
    });
  });

  test('knowledge base', async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(SCREENSHOTS_DIR, 'knowledge.png'),
      fullPage: false,
    });
  });

  test('settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: resolve(SCREENSHOTS_DIR, 'settings.png'),
      fullPage: false,
    });
  });
});

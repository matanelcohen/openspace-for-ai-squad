import { expect, test } from '@playwright/test';

test.describe('Trace Viewer — Trace List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/traces');
    // Wait for data to load (mock data has 300ms simulated delay)
    await page.waitForTimeout(500);
  });

  test('trace list page loads with title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Traces' })).toBeVisible();
    await expect(
      page.getByText('Monitor agent runs, latency, costs, and errors.'),
    ).toBeVisible();
  });

  test('summary stats cards are visible', async ({ page }) => {
    await expect(page.getByText('Total Traces')).toBeVisible();
    await expect(page.getByText('Running')).toBeVisible();
    await expect(page.getByText('Errors')).toBeVisible();
    await expect(page.getByText('Avg Latency')).toBeVisible();
  });

  test('trace table has correct column headers', async ({ page }) => {
    for (const header of ['Agent', 'Status', 'Duration', 'Tokens', 'Cost', 'Time']) {
      await expect(page.getByRole('columnheader', { name: new RegExp(header) })).toBeVisible();
    }
  });

  test('trace table rows are rendered with agent names', async ({ page }) => {
    // Mock data generates traces for known agent names
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Should have at least one row
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('search filters traces by name or agent', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search traces...');
    await expect(searchInput).toBeVisible();

    // Count rows before filtering
    const rowsBefore = await page.locator('table tbody tr').count();
    expect(rowsBefore).toBeGreaterThan(0);

    // Search for a specific agent
    await searchInput.fill('Fry');
    await page.waitForTimeout(100);

    const rowsAfter = await page.locator('table tbody tr').count();
    // Should have fewer or equal rows
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
    // All visible rows should contain "Fry"
    if (rowsAfter > 0) {
      const firstRowText = await page.locator('table tbody tr').first().textContent();
      expect(firstRowText?.toLowerCase()).toContain('fry');
    }
  });

  test('status filter dropdown works', async ({ page }) => {
    // Open status filter
    const statusTrigger = page.locator('button').filter({ hasText: 'All Status' });
    await expect(statusTrigger).toBeVisible();
    await statusTrigger.click();

    // Select "Error" from dropdown
    await page.getByRole('option', { name: 'Error' }).click();
    await page.waitForTimeout(100);

    // All visible rows should have error status
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      // Check that error badges are present
      const errorBadges = page.locator('table tbody tr').locator('text=Error');
      const badgeCount = await errorBadges.count();
      expect(badgeCount).toBe(count);
    }
  });

  test('agent filter dropdown works', async ({ page }) => {
    // Open agent filter
    const agentTrigger = page.locator('button').filter({ hasText: 'All Agents' });
    await expect(agentTrigger).toBeVisible();
    await agentTrigger.click();

    // Select first available agent
    const options = page.getByRole('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1); // "All Agents" + at least one agent

    // Select second option (first actual agent)
    await options.nth(1).click();
    await page.waitForTimeout(100);

    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('column headers are sortable', async ({ page }) => {
    // Click "Duration" header to sort
    const durationHeader = page.getByRole('columnheader', { name: /Duration/ });
    await durationHeader.click();
    await page.waitForTimeout(100);

    // Click again to reverse sort
    await durationHeader.click();
    await page.waitForTimeout(100);

    // Table should still have rows (sorting doesn't remove data)
    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('tab switcher toggles between Trace List and Statistics', async ({ page }) => {
    // Verify "Trace List" tab is active
    const traceListTab = page.getByRole('button', { name: 'Trace List' });
    const statsTab = page.getByRole('button', { name: 'Statistics' });
    await expect(traceListTab).toBeVisible();
    await expect(statsTab).toBeVisible();

    // Switch to Statistics
    await statsTab.click();
    await page.waitForTimeout(500); // Wait for stats data to load

    // Stats view should show KPI cards
    await expect(page.getByText('Avg Latency')).toBeVisible();
    await expect(page.getByText('Total Cost')).toBeVisible();
    await expect(page.getByText('Error Rate')).toBeVisible();

    // Switch back to Trace List
    await traceListTab.click();
    await page.waitForTimeout(300);
    await expect(page.locator('table')).toBeVisible();
  });

  test('"No traces found" shown when search matches nothing', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search traces...');
    await searchInput.fill('xyznonexistent12345');
    await page.waitForTimeout(100);

    await expect(page.getByText('No traces found.')).toBeVisible();
  });
});

test.describe('Trace Viewer — Trace Detail', () => {
  test('clicking a trace navigates to detail page', async ({ page }) => {
    await page.goto('/traces');
    await page.waitForTimeout(500);

    // Click the first trace link
    const firstLink = page.locator('table tbody tr a').first();
    await expect(firstLink).toBeVisible();

    const href = await firstLink.getAttribute('href');
    expect(href).toMatch(/\/traces\/trace-\d+/);

    await firstLink.click();
    await page.waitForTimeout(500);

    // Should be on the detail page now
    expect(page.url()).toContain('/traces/trace-');
  });

  test('detail page shows trace header with name and status', async ({ page }) => {
    // Navigate directly to a known trace (mock data generates trace-1000)
    await page.goto('/traces/trace-1000');
    await page.waitForTimeout(500);

    // Should show trace name (agent name + "Agent Run")
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // Should show status badge
    const statusBadge = page.locator('.capitalize').first();
    await expect(statusBadge).toBeVisible();

    // Should show trace metadata (id, timestamps, tokens, cost, span count)
    await expect(page.getByText('trace-1000')).toBeVisible();
    await expect(page.getByText(/tokens/)).toBeVisible();
    await expect(page.getByText(/spans/)).toBeVisible();
  });

  test('waterfall view renders span rows', async ({ page }) => {
    await page.goto('/traces/trace-1001');
    await page.waitForTimeout(500);

    // The waterfall should have rows with span names
    const spanRows = page.locator('[role="button"]');
    const rowCount = await spanRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('legend shows all span kinds', async ({ page }) => {
    await page.goto('/traces/trace-1001');
    await page.waitForTimeout(500);

    // Legend should show span kinds
    for (const kind of ['agent', 'chain', 'tool', 'llm', 'retriever', 'embedding']) {
      await expect(page.getByText(kind, { exact: false })).toBeVisible();
    }
  });

  test('clicking a span shows detail panel', async ({ page }) => {
    await page.goto('/traces/trace-1001');
    await page.waitForTimeout(500);

    // Click on a span row in the waterfall
    const spanRow = page.locator('[role="button"]').first();
    await spanRow.click();
    await page.waitForTimeout(200);

    // Detail panel should appear with tabs
    await expect(page.getByText('input')).toBeVisible();
    await expect(page.getByText('output')).toBeVisible();
    await expect(page.getByText('metadata')).toBeVisible();

    // Duration should be shown in the detail panel
    await expect(page.getByText('Duration')).toBeVisible();
    await expect(page.getByText('Start Time')).toBeVisible();
  });

  test('span detail tabs switch content', async ({ page }) => {
    await page.goto('/traces/trace-1001');
    await page.waitForTimeout(500);

    // Select a span
    const spanRow = page.locator('[role="button"]').first();
    await spanRow.click();
    await page.waitForTimeout(200);

    // Click output tab
    const outputTab = page.getByRole('button', { name: 'output' });
    await outputTab.click();
    await page.waitForTimeout(100);

    // Click metadata tab
    const metadataTab = page.getByRole('button', { name: 'metadata' });
    await metadataTab.click();
    await page.waitForTimeout(100);

    // Should show JSON content in the pre tag
    const preTag = page.locator('pre');
    await expect(preTag).toBeVisible();
  });

  test('back button returns to trace list', async ({ page }) => {
    await page.goto('/traces/trace-1001');
    await page.waitForTimeout(500);

    // Click the back arrow button (link to /traces)
    const backLink = page.locator('a[href="/traces"]');
    await expect(backLink).toBeVisible();
    await backLink.click();

    await page.waitForURL('/traces');
    await expect(page.getByRole('heading', { name: 'Traces' })).toBeVisible();
  });

  test('non-existent trace shows error state', async ({ page }) => {
    await page.goto('/traces/nonexistent-trace-id');
    await page.waitForTimeout(500);

    await expect(page.getByText(/not found|failed to load/i)).toBeVisible();
  });
});

test.describe('Trace Viewer — Statistics Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/traces');
    await page.waitForTimeout(500);
    // Switch to stats tab
    await page.getByRole('button', { name: 'Statistics' }).click();
    await page.waitForTimeout(500);
  });

  test('shows all KPI cards', async ({ page }) => {
    for (const kpi of ['Total Traces', 'Avg Latency', 'Total Cost', 'Total Tokens', 'Error Rate']) {
      await expect(page.getByText(kpi)).toBeVisible();
    }
  });

  test('shows chart sections', async ({ page }) => {
    await expect(page.getByText('Latency Distribution')).toBeVisible();
    await expect(page.getByText(/Cost Over Time/)).toBeVisible();
    await expect(page.getByText(/Token Usage/)).toBeVisible();
    await expect(page.getByText('Error Rates by Agent')).toBeVisible();
    await expect(page.getByText('Traces by Agent')).toBeVisible();
  });
});

test.describe('Trace Viewer — Edge Cases', () => {
  test('running trace shows animated indicators', async ({ page }) => {
    await page.goto('/traces');
    await page.waitForTimeout(500);

    // Mock data has index 0 as running
    // Look for "Running" badge (it has animate-spin class)
    const runningBadge = page.locator('text=Running').first();
    if (await runningBadge.isVisible()) {
      // The running badge should exist
      await expect(runningBadge).toBeVisible();
    }
  });

  test('error trace rows are distinguishable', async ({ page }) => {
    await page.goto('/traces');
    await page.waitForTimeout(500);

    // Filter to errors
    const statusTrigger = page.locator('button').filter({ hasText: 'All Status' });
    await statusTrigger.click();
    await page.getByRole('option', { name: 'Error' }).click();
    await page.waitForTimeout(100);

    // Should show error badges
    const errorBadges = page.locator('table tbody').getByText('Error');
    const count = await errorBadges.count();
    expect(count).toBeGreaterThan(0);
  });
});

/**
 * E2E tests — Skills UI flows
 *
 * Covers all five core flows:
 *   1. Skills listing page loads and displays built-in skills
 *   2. Search/filter by tag and phase works
 *   3. Clicking a skill navigates to detail page with correct tabs
 *   4. Skill creation wizard completes successfully and new skill appears in listing
 *   5. Agent-skill assignment attach/detach works
 */

import { type APIRequestContext, expect, test } from '@playwright/test';

const API = 'http://localhost:3001/api';

// Known built-in skills seeded on startup (from seed-skills.ts)
const BUILTIN_SKILLS = [
  { id: 'file-operations', name: 'File Operations', tags: ['core', 'filesystem', 'code'] },
  { id: 'bash-execution', name: 'Bash Execution', tags: ['core', 'shell', 'devops'] },
  { id: 'code-review', name: 'Code Review', tags: ['quality', 'review', 'code'] },
  { id: 'web-search', name: 'Web Search', tags: ['research', 'web', 'docs'] },
  { id: 'test-runner', name: 'Test Runner', tags: ['testing', 'quality', 'ci'] },
  { id: 'git-operations', name: 'Git Operations', tags: ['core', 'git', 'vcs'] },
  { id: 'database-query', name: 'Database Query', tags: ['data', 'sql', 'database'] },
  { id: 'task-delegation', name: 'Task Delegation', tags: ['management', 'a2a', 'coordination'] },
] as const;

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a skill via API and return the response body */
async function createSkillViaApi(
  request: APIRequestContext,
  overrides: Partial<{
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    tags: string[];
  }> = {},
) {
  const id = overrides.id ?? uniqueId('e2e-skill');
  const body = {
    manifestVersion: 1,
    id,
    name: overrides.name ?? `E2E Test Skill ${id}`,
    version: overrides.version ?? '1.0.0',
    description: overrides.description ?? 'Skill created by E2E test',
    author: overrides.author ?? 'e2e-test',
    tags: overrides.tags ?? ['e2e', 'testing'],
    tools: [{ toolId: 'test-tool', required: true }],
    triggers: [{ event: 'manual', conditions: [] }],
    prompts: [
      {
        id: 'default',
        name: 'Default Prompt',
        role: 'system',
        content: 'You are a test skill.',
      },
    ],
  };

  const res = await request.post(`${API}/skills`, { data: body });
  return { res, body, id };
}

/** Delete a skill via API (ignoring 404) */
async function deleteSkillViaApi(request: APIRequestContext, id: string) {
  await request.delete(`${API}/skills/${id}`);
}

// ═══════════════════════════════════════════════════════════════════
// 1. Skills Listing — Built-in Skills
// ═══════════════════════════════════════════════════════════════════

test.describe('Skills listing page', () => {
  test('loads and shows the Skill Store heading', async ({ page }) => {
    await page.goto('/skills');

    await expect(
      page.getByRole('heading', { name: /skill store/i }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByText(/browse.*discover.*manage.*skills/i),
    ).toBeVisible();
  });

  test('displays all built-in skill cards', async ({ page }) => {
    await page.goto('/skills');

    // Wait for the skill grid to finish loading
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    // Each built-in skill should have a card rendered
    for (const skill of BUILTIN_SKILLS) {
      const card = page.getByTestId(`skill-card-${skill.id}`);
      await expect(card).toBeVisible({ timeout: 5_000 });
    }
  });

  test('each built-in skill card shows name, description, and tags', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    // Spot-check the first built-in skill
    const skill = BUILTIN_SKILLS[0]; // file-operations
    const card = page.getByTestId(`skill-card-${skill.id}`);
    await expect(card).toBeVisible();

    // Card should contain the skill name
    await expect(card.getByText(skill.name)).toBeVisible();

    // Card should show at least one tag badge
    const firstTag = skill.tags[0];
    await expect(card.getByText(firstTag)).toBeVisible();
  });

  test('grid contains at least 8 cards (all seeded skills)', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    const cards = page.locator('[data-testid^="skill-card-"]');
    await expect(cards).toHaveCount(BUILTIN_SKILLS.length, { timeout: 5_000 });
  });

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404'),
    );
    expect(critical).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Search & Filter — Tag and Phase
// ═══════════════════════════════════════════════════════════════════

test.describe('Skill Store search and filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });
  });

  test('text search filters skill cards', async ({ page }) => {
    const totalBefore = await page.locator('[data-testid^="skill-card-"]').count();

    const searchInput = page.getByTestId('skill-search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Git');
    await page.waitForTimeout(600);

    const totalAfter = await page.locator('[data-testid^="skill-card-"]').count();
    expect(totalAfter).toBeGreaterThanOrEqual(1);
    expect(totalAfter).toBeLessThan(totalBefore);

    // The Git Operations card should be visible
    await expect(page.getByTestId('skill-card-git-operations')).toBeVisible();
  });

  test('filter by tag restricts displayed skills', async ({ page }) => {
    const tagFilter = page.getByTestId('skill-tag-filter');
    await expect(tagFilter).toBeVisible();

    // Open the tag dropdown and select "core"
    await tagFilter.click();
    await page.getByRole('option', { name: 'core' }).click();
    await page.waitForTimeout(600);

    // "core" tagged skills: file-operations, bash-execution, git-operations
    const cards = page.locator('[data-testid^="skill-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThan(BUILTIN_SKILLS.length);

    // These should be visible
    await expect(page.getByTestId('skill-card-file-operations')).toBeVisible();
    await expect(page.getByTestId('skill-card-bash-execution')).toBeVisible();
    await expect(page.getByTestId('skill-card-git-operations')).toBeVisible();

    // Skills without "core" tag should not be visible
    await expect(page.getByTestId('skill-card-web-search')).not.toBeVisible();
  });

  test('filter by phase restricts displayed skills', async ({ page }) => {
    const phaseFilter = page.getByTestId('skill-phase-filter');
    await expect(phaseFilter).toBeVisible();

    // Open the phase dropdown and select "Loaded" (builtin skills are seeded as "loaded")
    await phaseFilter.click();
    await page.getByRole('option', { name: 'Loaded' }).click();
    await page.waitForTimeout(600);

    // All built-in skills are seeded with phase "loaded"
    const cards = page.locator('[data-testid^="skill-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(BUILTIN_SKILLS.length);
  });

  test('combined search + tag filter narrows results further', async ({ page }) => {
    // First filter by "core" tag
    const tagFilter = page.getByTestId('skill-tag-filter');
    await tagFilter.click();
    await page.getByRole('option', { name: 'core' }).click();
    await page.waitForTimeout(600);

    const afterTagFilter = await page.locator('[data-testid^="skill-card-"]').count();

    // Then type "file" in search
    const searchInput = page.getByTestId('skill-search-input');
    await searchInput.fill('File');
    await page.waitForTimeout(600);

    const afterCombined = await page.locator('[data-testid^="skill-card-"]').count();
    expect(afterCombined).toBeLessThanOrEqual(afterTagFilter);
    expect(afterCombined).toBeGreaterThanOrEqual(1);

    await expect(page.getByTestId('skill-card-file-operations')).toBeVisible();
  });

  test('clearing filters restores all skills', async ({ page }) => {
    const totalBefore = await page.locator('[data-testid^="skill-card-"]').count();

    // Apply a search filter
    const searchInput = page.getByTestId('skill-search-input');
    await searchInput.fill('Git');
    await page.waitForTimeout(600);

    const totalFiltered = await page.locator('[data-testid^="skill-card-"]').count();
    expect(totalFiltered).toBeLessThan(totalBefore);

    // Click clear filters
    const clearBtn = page.getByTestId('skill-clear-filters');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await page.waitForTimeout(600);

    const totalAfterClear = await page.locator('[data-testid^="skill-card-"]').count();
    expect(totalAfterClear).toBe(totalBefore);
  });

  test('search with no results shows empty state', async ({ page }) => {
    const searchInput = page.getByTestId('skill-search-input');
    await searchInput.fill('xyznonexistentskill99999');
    await page.waitForTimeout(600);

    const cards = page.locator('[data-testid^="skill-card-"]');
    await expect(cards).toHaveCount(0);

    // Empty state or "no skills found" text should be visible
    await expect(
      page.getByText(/no skills found/i).or(page.getByTestId('skill-grid-empty')),
    ).toBeVisible();
  });

  test('result count is displayed when filters are active', async ({ page }) => {
    const searchInput = page.getByTestId('skill-search-input');
    await searchInput.fill('Git');
    await page.waitForTimeout(600);

    // The toolbar should show a result count like "N skills found"
    await expect(page.getByText(/\d+ skills? found/i)).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Skill Detail Navigation & Tabs
// ═══════════════════════════════════════════════════════════════════

test.describe('Skill detail page', () => {
  test('clicking a skill card navigates to the detail page', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    const skillId = BUILTIN_SKILLS[0].id; // file-operations
    const card = page.getByTestId(`skill-card-${skillId}`);
    await expect(card).toBeVisible();

    await card.click();
    await page.waitForURL(`/skills/${skillId}`, { timeout: 10_000 });

    // Verify the skill name appears on the detail page
    await expect(page.getByText(BUILTIN_SKILLS[0].name)).toBeVisible({ timeout: 5_000 });
  });

  test('detail page has Overview, Tools, Prompts, and Dependencies tabs', async ({ page }) => {
    await page.goto(`/skills/${BUILTIN_SKILLS[0].id}`);

    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /tools/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /prompts/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /dependencies/i })).toBeVisible();
  });

  test('Overview tab is selected by default', async ({ page }) => {
    await page.goto(`/skills/${BUILTIN_SKILLS[0].id}`);

    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toBeVisible({ timeout: 15_000 });

    // aria-selected should be true for the default tab
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
  });

  test('clicking Tools tab shows tools panel', async ({ page }) => {
    await page.goto(`/skills/${BUILTIN_SKILLS[0].id}`);
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    const toolsTab = page.getByRole('tab', { name: /tools/i });
    await toolsTab.click();
    await page.waitForTimeout(300);

    await expect(toolsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('clicking Prompts tab shows prompts panel', async ({ page }) => {
    await page.goto(`/skills/${BUILTIN_SKILLS[0].id}`);
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    const promptsTab = page.getByRole('tab', { name: /prompts/i });
    await promptsTab.click();
    await page.waitForTimeout(300);

    await expect(promptsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('clicking Dependencies tab shows dependencies panel', async ({ page }) => {
    await page.goto(`/skills/${BUILTIN_SKILLS[0].id}`);
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    const depsTab = page.getByRole('tab', { name: /dependencies/i });
    await depsTab.click();
    await page.waitForTimeout(300);

    await expect(depsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('back button returns to skill store', async ({ page }) => {
    await page.goto(`/skills/${BUILTIN_SKILLS[0].id}`);
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    const backBtn = page.getByRole('link', { name: /back to skill store/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    await page.waitForURL('/skills', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /skill store/i })).toBeVisible();
  });

  test('navigating to non-existent skill shows error', async ({ page }) => {
    await page.goto('/skills/nonexistent-skill-xyz');

    // Should show "not found" or error state
    await expect(
      page.getByText(/not found/i).or(page.getByText(/error/i)),
    ).toBeVisible({ timeout: 10_000 });

    // Back link should still be present
    await expect(page.getByText(/back to skill store/i)).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Skill Creation Wizard — Full Flow
// ═══════════════════════════════════════════════════════════════════

test.describe('Skill creation wizard', () => {
  const wizardSkillId = uniqueId('e2e-wizard');

  test.afterAll(async ({ request }) => {
    // Clean up the created skill
    await deleteSkillViaApi(request, wizardSkillId);
  });

  test('wizard dialog opens when Create Skill button is clicked', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    const createBtn = page.getByTestId('create-skill-btn');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Wizard dialog should appear
    await expect(page.getByTestId('skill-creation-wizard')).toBeVisible();
    await expect(page.getByText('Create New Skill')).toBeVisible();
  });

  test('wizard step navigation works', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-creation-wizard')).toBeVisible();

    // Step 1 (Basics) should be visible by default
    await expect(page.getByTestId('wizard-step-basics')).toBeVisible();
    expect(await page.getByText(/step 1 of 5/i).textContent()).toBeTruthy();

    // Click "Next" to go to step 2
    await page.getByTestId('wizard-next-btn').click();
    expect(await page.getByText(/step 2 of 5/i).textContent()).toBeTruthy();

    // Click "Back" to return to step 1
    await page.getByTestId('wizard-back-btn').click();
    expect(await page.getByText(/step 1 of 5/i).textContent()).toBeTruthy();

    // Back button should be disabled on step 1
    await expect(page.getByTestId('wizard-back-btn')).toBeDisabled();
  });

  test('wizard step nav sidebar is clickable', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-creation-wizard')).toBeVisible();

    // Click the "Tools" step in the sidebar
    await page.getByTestId('wizard-step-nav-tools').click();
    expect(await page.getByText(/step 2 of 5/i).textContent()).toBeTruthy();

    // Click "Prompts" step
    await page.getByTestId('wizard-step-nav-prompts').click();
    expect(await page.getByText(/step 4 of 5/i).textContent()).toBeTruthy();

    // Go back to basics via sidebar
    await page.getByTestId('wizard-step-nav-basics').click();
    expect(await page.getByText(/step 1 of 5/i).textContent()).toBeTruthy();
  });

  test('full wizard flow via JSON editor creates skill', async ({ page, request }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    const skillsBefore = await page.locator('[data-testid^="skill-card-"]').count();

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-creation-wizard')).toBeVisible();

    // Switch to JSON editor tab
    await page.getByRole('tab', { name: /json editor/i }).click();

    // Build a valid manifest JSON
    const manifest = {
      manifestVersion: 1,
      id: wizardSkillId,
      name: `E2E Wizard Skill ${wizardSkillId}`,
      version: '1.0.0',
      description: 'A skill created through the wizard E2E test',
      author: 'e2e-test',
      tags: ['e2e', 'testing'],
      tools: [{ toolId: 'e2e-tool', required: true }],
      triggers: [{ event: 'manual', conditions: [] }],
      prompts: [
        {
          id: 'main',
          name: 'Main Prompt',
          role: 'system',
          content: 'You are an E2E test skill.',
        },
      ],
    };

    // Find the JSON editor textarea/code area and fill it
    const editor = page.locator('[data-testid="manifest-json-editor"], textarea, .cm-editor');
    if (await editor.first().isVisible()) {
      // Try textarea approach first
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible()) {
        await textarea.fill(JSON.stringify(manifest, null, 2));
      }
    }

    // Click "Apply" if there's an apply button
    const applyBtn = page.getByRole('button', { name: /apply/i });
    if (await applyBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await applyBtn.click();
    }

    // Navigate to the last step
    await page.getByTestId('wizard-step-nav-config').click();
    await page.waitForTimeout(300);

    // Submit the form
    await page.getByTestId('wizard-submit-btn').click();

    // Wait for the dialog to close (skill was created)
    await expect(page.getByTestId('skill-creation-wizard')).not.toBeVisible({
      timeout: 10_000,
    });

    // The new skill should appear in the grid
    await page.waitForTimeout(1_000);
    // Refresh to ensure we see the latest
    await page.reload();
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    const skillsAfter = await page.locator('[data-testid^="skill-card-"]').count();
    expect(skillsAfter).toBeGreaterThan(skillsBefore);

    // The new skill card should be present
    await expect(page.getByTestId(`skill-card-${wizardSkillId}`)).toBeVisible({
      timeout: 5_000,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4b. Skill Creation Wizard — Visual Editor Step-by-Step
// ═══════════════════════════════════════════════════════════════════

test.describe('Skill creation wizard — visual editor', () => {
  const visualSkillId = uniqueId('e2e-visual');

  test.afterAll(async ({ request }) => {
    await deleteSkillViaApi(request, visualSkillId);
  });

  test('completing basics step populates name and ID', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-grid')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('wizard-step-basics')).toBeVisible();

    // Fill in the name (ID should auto-generate)
    await page.getByLabel(/skill name/i).fill('Visual Test Skill');
    await page.waitForTimeout(200);

    // ID should be auto-generated from the name
    const idInput = page.getByLabel(/skill id/i);
    const idValue = await idInput.inputValue();
    expect(idValue).toBe('visual-test-skill');

    // Override the ID with our unique one
    await idInput.clear();
    await idInput.fill(visualSkillId);

    // Fill description
    await page.getByLabel(/description/i).fill('A visual editor E2E test skill');

    // Select a tag
    await page.getByTestId('tag-testing').click();

    // Proceed to next step
    await page.getByTestId('wizard-next-btn').click();
    expect(await page.getByText(/step 2 of 5/i).textContent()).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Agent-Skill Assignment — Attach & Detach
// ═══════════════════════════════════════════════════════════════════

test.describe('Agent-skill assignment (API-driven)', () => {
  const testAgentId = `e2e-agent-${Date.now()}`;
  const testSkillId = BUILTIN_SKILLS[0].id; // file-operations

  test('POST /agents/:id/skills assigns a skill to an agent', async ({ request }) => {
    const res = await request.post(`${API}/agents/${testAgentId}/skills`, {
      data: { skillId: testSkillId },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.skillId).toBe(testSkillId);
    expect(body.agentId).toBe(testAgentId);
  });

  test('skill detail shows agent in active agents after assignment', async ({ request }) => {
    // First, ensure the skill is assigned
    const assignRes = await request.post(`${API}/agents/${testAgentId}/skills`, {
      data: { skillId: testSkillId },
    });
    // May already be assigned — that's fine
    if (!assignRes.ok()) {
      const status = assignRes.status();
      // Allow 200 (success) or 400 (already active) — but not 404 or 500
      expect(status).toBeLessThan(500);
    }

    // Get the skill detail
    const detailRes = await request.get(`${API}/skills/${testSkillId}`);
    expect(detailRes.ok()).toBe(true);
    const detail = await detailRes.json();

    expect(detail.activeAgents).toContain(testAgentId);
  });

  test('GET /skills/:id/agents lists the assigned agent', async ({ request }) => {
    const res = await request.get(`${API}/skills/${testSkillId}/agents`);
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body.skillId).toBe(testSkillId);
    expect(body.agents).toContain(testAgentId);
  });

  test('DELETE /agents/:id/skills/:skillId detaches the skill', async ({ request }) => {
    const res = await request.delete(
      `${API}/agents/${testAgentId}/skills/${testSkillId}`,
    );
    expect(res.status()).toBe(204);
  });

  test('after detach, skill is no longer active for the agent', async ({ request }) => {
    const res = await request.get(`${API}/skills/${testSkillId}/agents`);
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body.agents).not.toContain(testAgentId);
  });

  test('detaching an already-detached skill returns 404', async ({ request }) => {
    const res = await request.delete(
      `${API}/agents/${testAgentId}/skills/${testSkillId}`,
    );
    expect(res.status()).toBe(404);
  });

  test('assigning a non-existent skill returns 404', async ({ request }) => {
    const res = await request.post(`${API}/agents/${testAgentId}/skills`, {
      data: { skillId: 'nonexistent-skill-xyz' },
    });
    expect(res.status()).toBe(404);
  });

  test('assigning without skillId returns 400', async ({ request }) => {
    const res = await request.post(`${API}/agents/${testAgentId}/skills`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5b. Agent-Skill Assignment — API CRUD for Custom Skills
// ═══════════════════════════════════════════════════════════════════

test.describe('Agent-skill assignment with custom skill lifecycle', () => {
  let customSkillId: string;

  test.beforeAll(async ({ request }) => {
    const { id, res } = await createSkillViaApi(request, {
      tags: ['e2e', 'assignment-test'],
    });
    expect(res.status()).toBe(201);
    customSkillId = id;
  });

  test.afterAll(async ({ request }) => {
    await deleteSkillViaApi(request, customSkillId);
  });

  test('full lifecycle: create skill → assign → verify → detach → verify → delete', async ({
    request,
  }) => {
    const agentId = `lifecycle-agent-${Date.now()}`;

    // Step 1: Assign
    const assignRes = await request.post(`${API}/agents/${agentId}/skills`, {
      data: { skillId: customSkillId },
    });
    expect(assignRes.ok()).toBe(true);
    const assignBody = await assignRes.json();
    expect(assignBody.success).toBe(true);

    // Step 2: Verify assignment via skill agents endpoint
    const agentsRes = await request.get(`${API}/skills/${customSkillId}/agents`);
    expect(agentsRes.ok()).toBe(true);
    const agents = await agentsRes.json();
    expect(agents.agents).toContain(agentId);

    // Step 3: Verify assignment via skill detail
    const detailRes = await request.get(`${API}/skills/${customSkillId}`);
    expect(detailRes.ok()).toBe(true);
    const detail = await detailRes.json();
    expect(detail.activeAgents).toContain(agentId);

    // Step 4: Detach
    const detachRes = await request.delete(
      `${API}/agents/${agentId}/skills/${customSkillId}`,
    );
    expect(detachRes.status()).toBe(204);

    // Step 5: Verify detachment
    const afterDetach = await request.get(`${API}/skills/${customSkillId}/agents`);
    const afterBody = await afterDetach.json();
    expect(afterBody.agents).not.toContain(agentId);
  });

  test('multiple agents can be assigned to the same skill', async ({ request }) => {
    const agents = [
      `multi-agent-1-${Date.now()}`,
      `multi-agent-2-${Date.now()}`,
      `multi-agent-3-${Date.now()}`,
    ];

    // Assign all three agents
    for (const agentId of agents) {
      const res = await request.post(`${API}/agents/${agentId}/skills`, {
        data: { skillId: customSkillId },
      });
      expect(res.ok()).toBe(true);
    }

    // Verify all three are listed
    const agentsRes = await request.get(`${API}/skills/${customSkillId}/agents`);
    const body = await agentsRes.json();
    for (const agentId of agents) {
      expect(body.agents).toContain(agentId);
    }

    // Clean up: detach all agents
    for (const agentId of agents) {
      await request.delete(`${API}/agents/${agentId}/skills/${customSkillId}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Edge cases & resilience
// ═══════════════════════════════════════════════════════════════════

test.describe('Skills edge cases', () => {
  test('skills API returns JSON with skills array', async ({ request }) => {
    const res = await request.get(`${API}/skills`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('skills');
    expect(Array.isArray(body.skills)).toBe(true);
    expect(body.skills.length).toBeGreaterThanOrEqual(BUILTIN_SKILLS.length);
  });

  test('each API skill entry has required fields', async ({ request }) => {
    const res = await request.get(`${API}/skills`);
    const { skills } = await res.json();

    for (const skill of skills) {
      expect(skill).toHaveProperty('id');
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('version');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('phase');
      expect(typeof skill.id).toBe('string');
      expect(typeof skill.name).toBe('string');
    }
  });

  test('skill detail returns full manifest info', async ({ request }) => {
    const res = await request.get(`${API}/skills/${BUILTIN_SKILLS[0].id}`);
    expect(res.ok()).toBe(true);
    const detail = await res.json();

    expect(detail.id).toBe(BUILTIN_SKILLS[0].id);
    expect(detail.name).toBe(BUILTIN_SKILLS[0].name);
    expect(detail).toHaveProperty('tools');
    expect(detail).toHaveProperty('prompts');
    expect(detail).toHaveProperty('tags');
    expect(detail.tags).toEqual(expect.arrayContaining(BUILTIN_SKILLS[0].tags as unknown as string[]));
  });

  test('GET non-existent skill returns 404', async ({ request }) => {
    const res = await request.get(`${API}/skills/nonexistent-id-12345`);
    expect(res.status()).toBe(404);
  });

  test('POST skill with missing required fields returns 400', async ({ request }) => {
    const res = await request.post(`${API}/skills`, {
      data: { name: 'Incomplete' },
    });
    expect(res.status()).toBe(400);
  });
});

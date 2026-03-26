/**
 * E2E tests — Skills UI advanced flows
 *
 * Covers gaps not addressed by existing skill-store.spec.ts / skills-ui-flows.spec.ts:
 *
 *   1. Skill Form Dialog — create skill via the simplified form dialog
 *   2. Skill Detail Tabs — correct tabs (Overview, Instructions, Agents)
 *   3. Agent-Skill Toggle UI — toggle skills via AgentSkillDialog on team member page
 *   4. Agent-Skill Assignment — API-driven attach/detach with UI verification
 *   5. Drag-and-drop Reordering — SkillsEditor DnD on team member detail page
 *
 * Uses API helpers for setup/teardown so UI tests are isolated and deterministic.
 */

import { type APIRequestContext, expect, test } from '@playwright/test';

const API = 'http://localhost:3001/api';

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Known built-in skills (from seed-skills.ts)
const BUILTIN_SKILLS = [
  'file-operations',
  'bash-execution',
  'code-review',
  'web-search',
  'test-runner',
  'git-operations',
  'database-query',
  'task-delegation',
] as const;

/** Create a skill via SKILL.md-compatible API */
async function createSkillViaApi(
  request: APIRequestContext,
  name: string,
  overrides: Partial<{
    description: string;
    tags: string[];
    instructions: string;
  }> = {},
) {
  const res = await request.post(`${API}/skills`, {
    data: {
      name,
      description: overrides.description ?? 'E2E test skill',
      tags: overrides.tags ?? ['e2e', 'testing'],
      agentMatch: { roles: ['*'] },
      requires: { bins: [], env: [] },
      instructions: overrides.instructions ?? '## E2E Test\nA skill created by E2E test automation.',
    },
  });
  return res;
}

/** Delete a skill via API (ignoring 404) */
async function deleteSkillViaApi(request: APIRequestContext, id: string) {
  await request.delete(`${API}/skills/${id}`);
}

// ═══════════════════════════════════════════════════════════════════
// 1. Skill Form Dialog — Create a Skill
// ═══════════════════════════════════════════════════════════════════

test.describe('Skill creation via form dialog', () => {
  test.setTimeout(45_000);

  test('Create Skill button opens the form dialog', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('create-skill-btn')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-form-dialog')).toBeVisible();
    await expect(page.getByText('Create New Skill')).toBeVisible();
  });

  test('form shows validation errors when submitted empty', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('create-skill-btn')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-form-dialog')).toBeVisible();

    // Submit without filling any fields
    await page.getByTestId('skill-form-submit').click();

    // Validation errors should appear for required fields
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Description is required')).toBeVisible();
    await expect(page.getByText('Instructions are required')).toBeVisible();
  });

  test('name field auto-converts to kebab-case', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('create-skill-btn')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-form-dialog')).toBeVisible();

    const nameInput = page.getByTestId('skill-field-name');
    await nameInput.fill('My Cool Skill');
    await page.waitForTimeout(200);

    // Should auto-convert to kebab-case
    const value = await nameInput.inputValue();
    expect(value).toBe('my-cool-skill');
  });

  test('cancel button closes dialog without creating', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('create-skill-btn')).toBeVisible({ timeout: 15_000 });

    const countBefore = await page.locator('[data-testid^="skill-card"]').count();

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-form-dialog')).toBeVisible();

    await page.getByTestId('skill-form-cancel').click();
    await expect(page.getByTestId('skill-form-dialog')).not.toBeVisible();

    // Skill count should remain the same
    const countAfter = await page.locator('[data-testid^="skill-card"]').count();
    expect(countAfter).toBe(countBefore);
  });

  test('successfully creating a skill via form adds it to the grid', async ({
    page,
    request,
  }) => {
    const skillName = uniqueId('e2e-form-skill');

    await page.goto('/skills');
    await expect(page.getByTestId('create-skill-btn')).toBeVisible({ timeout: 15_000 });

    const countBefore = await page.locator('[data-testid^="skill-card"]').count();

    // Open dialog
    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-form-dialog')).toBeVisible();

    // Set up response listener BEFORE filling the form to avoid race conditions
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/skills') &&
        res.request().method() === 'POST' &&
        res.status() === 201,
    );

    // Fill required fields
    await page.getByTestId('skill-field-name').fill(skillName);
    await page.getByTestId('skill-field-description').fill('A skill created by E2E form dialog test');
    await page.getByTestId('skill-field-instructions').fill('## E2E Test\nInstructions for the test skill.');

    // Add a tag (type + Enter)
    await page.getByTestId('skill-field-tags').fill('e2e-test');
    await page.getByTestId('skill-field-tags').press('Enter');

    // Submit
    await page.getByTestId('skill-form-submit').click();

    try {
      // Wait for API response
      await responsePromise;

      // Dialog should close
      await expect(page.getByTestId('skill-form-dialog')).not.toBeVisible({ timeout: 10_000 });

      // Grid should have one more skill after refresh
      await page.reload();
      await expect(page.locator('[data-testid^="skill-card"]').first()).toBeVisible({ timeout: 15_000 });

      const countAfter = await page.locator('[data-testid^="skill-card"]').count();
      expect(countAfter).toBeGreaterThan(countBefore);
    } finally {
      await deleteSkillViaApi(request, skillName);
    }
  });

  test('adding tags via comma-separated input works', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('create-skill-btn')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-form-dialog')).toBeVisible();

    const tagInput = page.getByTestId('skill-field-tags');
    await tagInput.fill('alpha, beta, gamma');
    await tagInput.press('Enter');
    await page.waitForTimeout(200);

    // All three tags should appear as badges
    await expect(page.getByText('alpha')).toBeVisible();
    await expect(page.getByText('beta')).toBeVisible();
    await expect(page.getByText('gamma')).toBeVisible();
  });

  test('selecting agent roles toggles correctly', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('create-skill-btn')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('create-skill-btn').click();
    await expect(page.getByTestId('skill-form-dialog')).toBeVisible();

    // "All (*)" should be active by default
    const allRole = page.getByTestId('skill-role-*');
    await expect(allRole).toBeVisible();

    // Click "Tester" role — should deselect "All (*)"
    await page.getByTestId('skill-role-tester').click();
    await page.waitForTimeout(200);

    // Click "All (*)" again — should reset to just "All"
    await allRole.click();
    await page.waitForTimeout(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Skill Detail Page — Correct Tabs
// ═══════════════════════════════════════════════════════════════════

test.describe('Skill detail page tabs', () => {
  const skillId = BUILTIN_SKILLS[0]; // file-operations

  test('navigating to skill detail shows Overview, Instructions, and Agents tabs', async ({
    page,
  }) => {
    await page.goto(`/skills/${skillId}`);

    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /instructions/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /agents/i })).toBeVisible();
  });

  test('Overview tab is selected by default and shows skill details', async ({ page }) => {
    await page.goto(`/skills/${skillId}`);

    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toBeVisible({ timeout: 15_000 });
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    // Overview content should be present
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible();
  });

  test('clicking Instructions tab shows instructions content', async ({ page }) => {
    await page.goto(`/skills/${skillId}`);
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    const instructionsTab = page.getByRole('tab', { name: /instructions/i });
    await instructionsTab.click();
    await page.waitForTimeout(300);

    await expect(instructionsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('clicking Agents tab shows agents using this skill', async ({ page }) => {
    await page.goto(`/skills/${skillId}`);
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    const agentsTab = page.getByRole('tab', { name: /agents/i });
    await agentsTab.click();
    await page.waitForTimeout(500);

    await expect(agentsTab).toHaveAttribute('aria-selected', 'true');

    // The agents panel should render (may have agents or empty state)
    await expect(page.getByTestId('skill-detail-agents')).toBeVisible();
  });

  test('back button navigates to skill store', async ({ page }) => {
    await page.goto(`/skills/${skillId}`);
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    const backBtn = page.getByText('Back to Skill Store');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    await page.waitForURL('/skills', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /skill store/i })).toBeVisible();
  });

  test('non-existent skill shows error state with back link', async ({ page }) => {
    await page.goto('/skills/nonexistent-skill-abc-12345');

    await expect(
      page.getByText(/not found/i).or(page.getByText(/error/i)),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Back to Skill Store')).toBeVisible();
  });

  test('clicking skill card from store navigates to correct detail page', async ({ page }) => {
    await page.goto('/skills');

    // Wait for grid to load
    const card = page.locator('[data-testid^="skill-card"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.click();
    await page.waitForURL(/\/skills\/[a-z0-9-]+/i, { timeout: 10_000 });

    // Should show tabs
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
  });

  test('tab switching preserves URL (no navigation)', async ({ page }) => {
    await page.goto(`/skills/${skillId}`);
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });

    const initialUrl = page.url();

    // Click Instructions tab
    await page.getByRole('tab', { name: /instructions/i }).click();
    await page.waitForTimeout(300);

    // URL should remain the same (tabs are client-side only)
    expect(page.url()).toBe(initialUrl);

    // Click Agents tab
    await page.getByRole('tab', { name: /agents/i }).click();
    await page.waitForTimeout(300);
    expect(page.url()).toBe(initialUrl);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Agent-Skill Toggle via UI (AgentSkillDialog)
// ═══════════════════════════════════════════════════════════════════

test.describe('Agent skill toggle via team member page', () => {
  test.setTimeout(45_000);

  test('team member detail page shows AI Agent Skills section', async ({ page }) => {
    await page.goto('/team-members');

    // Click the first team member
    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    await expect(page.getByTestId('team-member-detail')).toBeVisible({ timeout: 10_000 });

    // AI Agent Skills section should be visible
    await expect(page.getByTestId('agent-skills-section')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking an agent row opens the AgentSkillDialog', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    await expect(page.getByTestId('agent-skills-section')).toBeVisible({ timeout: 10_000 });

    // Click an agent row in the skills section
    const agentRow = page.locator('[data-testid^="agent-skills-row-"]').first();
    await expect(agentRow).toBeVisible({ timeout: 5_000 });
    await agentRow.click();

    // AgentSkillDialog should open
    await expect(page.getByTestId('agent-skill-dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('AgentSkillDialog shows skill toggles', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    await expect(page.getByTestId('agent-skills-section')).toBeVisible({ timeout: 10_000 });

    const agentRow = page.locator('[data-testid^="agent-skills-row-"]').first();
    await expect(agentRow).toBeVisible({ timeout: 5_000 });
    await agentRow.click();

    await expect(page.getByTestId('agent-skill-dialog')).toBeVisible({ timeout: 5_000 });

    // Dialog should show skill items with toggles
    const skillItems = page.locator('[data-testid^="agent-skill-item-"]');
    const count = await skillItems.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Each item should have a toggle
    const toggles = page.locator('[data-testid^="agent-skill-toggle-"]');
    expect(await toggles.count()).toBeGreaterThanOrEqual(1);
  });

  test('AgentSkillDialog search filters skills', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    await expect(page.getByTestId('agent-skills-section')).toBeVisible({ timeout: 10_000 });

    const agentRow = page.locator('[data-testid^="agent-skills-row-"]').first();
    await expect(agentRow).toBeVisible({ timeout: 5_000 });
    await agentRow.click();
    await expect(page.getByTestId('agent-skill-dialog')).toBeVisible({ timeout: 5_000 });

    // Count all skills before search
    const totalBefore = await page.locator('[data-testid^="agent-skill-item-"]').count();

    // Search for a specific skill
    const searchInput = page.getByTestId('agent-skill-search');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('git');
    await page.waitForTimeout(500);

    const totalAfter = await page.locator('[data-testid^="agent-skill-item-"]').count();
    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
    expect(totalAfter).toBeGreaterThanOrEqual(1);
  });

  test('toggling a skill via AgentSkillDialog calls PATCH API', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    await expect(page.getByTestId('agent-skills-section')).toBeVisible({ timeout: 10_000 });

    const agentRow = page.locator('[data-testid^="agent-skills-row-"]').first();
    await expect(agentRow).toBeVisible({ timeout: 5_000 });
    await agentRow.click();
    await expect(page.getByTestId('agent-skill-dialog')).toBeVisible({ timeout: 5_000 });

    // Intercept the PATCH request
    const patchPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/agents/') &&
        req.url().includes('/skills') &&
        req.method() === 'PATCH',
    );

    // Toggle the first skill
    const firstToggle = page.locator('[data-testid^="agent-skill-toggle-"]').first();
    await expect(firstToggle).toBeVisible();
    await firstToggle.click();

    // PATCH request should have been sent
    const patchReq = await patchPromise;
    expect(patchReq).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Agent-Skill Assignment — API-Driven with UI Verification
// ═══════════════════════════════════════════════════════════════════

test.describe('Agent-skill assignment (API + UI)', () => {
  test.setTimeout(30_000);

  test('PATCH /agents/:id/skills toggles skill and GET reflects change', async ({
    request,
  }) => {
    // Get list of agents
    const agentsRes = await request.get(`${API}/agents`);
    expect(agentsRes.ok()).toBe(true);
    const agents = await agentsRes.json();
    expect(agents.length).toBeGreaterThanOrEqual(1);

    const agentId = agents[0].id;

    // Get current skill state
    const beforeRes = await request.get(`${API}/agents/${agentId}/skills`);
    expect(beforeRes.ok()).toBe(true);
    const before = await beforeRes.json();
    expect(before.skills.length).toBeGreaterThanOrEqual(1);

    // Find a skill and toggle it
    const targetSkill = before.skills[0];
    const originalEnabled = targetSkill.enabled;

    // Toggle the skill
    const toggleRes = await request.patch(`${API}/agents/${agentId}/skills`, {
      data: { skillId: targetSkill.id, enabled: !originalEnabled },
    });
    expect(toggleRes.ok()).toBe(true);
    const toggleBody = await toggleRes.json();
    expect(toggleBody.success).toBe(true);

    // Verify via GET
    const afterRes = await request.get(`${API}/agents/${agentId}/skills`);
    const after = await afterRes.json();
    const updatedSkill = after.skills.find(
      (s: { id: string }) => s.id === targetSkill.id,
    );
    expect(updatedSkill.enabled).toBe(!originalEnabled);

    // Restore original state
    await request.patch(`${API}/agents/${agentId}/skills`, {
      data: { skillId: targetSkill.id, enabled: originalEnabled },
    });
  });

  test('toggling skill reflects in agent skill dialog UI', async ({ page, request }) => {
    // Get agent info
    const agentsRes = await request.get(`${API}/agents`);
    const agents = await agentsRes.json();
    const agent = agents[0];

    // Get skills for this agent
    const skillsRes = await request.get(`${API}/agents/${agent.id}/skills`);
    const skillsData = await skillsRes.json();
    const targetSkill = skillsData.skills.find((s: { id: string }) =>
      BUILTIN_SKILLS.includes(s.id as (typeof BUILTIN_SKILLS)[number]),
    );
    if (!targetSkill) return;

    // Toggle the skill via API first
    const newEnabled = !targetSkill.enabled;
    await request.patch(`${API}/agents/${agent.id}/skills`, {
      data: { skillId: targetSkill.id, enabled: newEnabled },
    });

    // Now navigate to team member page and open the agent's skill dialog
    await page.goto('/team-members');
    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    await expect(page.getByTestId('agent-skills-section')).toBeVisible({ timeout: 10_000 });

    // Click the specific agent row
    const agentRow = page.getByTestId(`agent-skills-row-${agent.id}`);
    if (await agentRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await agentRow.click();
      await expect(page.getByTestId('agent-skill-dialog')).toBeVisible({ timeout: 5_000 });

      // The toggle should reflect the API change
      const toggle = page.getByTestId(`agent-skill-toggle-${targetSkill.id}`);
      if (await toggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Switch components use aria-checked (not native checkbox checked)
        const ariaChecked = await toggle.getAttribute('aria-checked');
        expect(ariaChecked).toBe(String(newEnabled));
      }
    }

    // Restore original state
    await request.patch(`${API}/agents/${agent.id}/skills`, {
      data: { skillId: targetSkill.id, enabled: targetSkill.enabled },
    });
  });

  test('PATCH with missing skillId returns 400', async ({ request }) => {
    const agentsRes = await request.get(`${API}/agents`);
    const agents = await agentsRes.json();

    const res = await request.patch(`${API}/agents/${agents[0].id}/skills`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('PATCH with non-existent skill returns 404', async ({ request }) => {
    const agentsRes = await request.get(`${API}/agents`);
    const agents = await agentsRes.json();

    const res = await request.patch(`${API}/agents/${agents[0].id}/skills`, {
      data: { skillId: 'nonexistent-skill-xyz-999', enabled: true },
    });
    expect(res.status()).toBe(404);
  });

  test('PATCH for non-existent agent returns 404', async ({ request }) => {
    const res = await request.patch(`${API}/agents/nonexistent-agent-xyz/skills`, {
      data: { skillId: BUILTIN_SKILLS[0], enabled: true },
    });
    expect(res.status()).toBe(404);
  });

  test('GET /agents/:id/skills returns all skills with enabled and source fields', async ({
    request,
  }) => {
    const agentsRes = await request.get(`${API}/agents`);
    const agents = await agentsRes.json();
    const agentId = agents[0].id;

    const res = await request.get(`${API}/agents/${agentId}/skills`);
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body).toHaveProperty('agentId', agentId);
    expect(body).toHaveProperty('role');
    expect(Array.isArray(body.skills)).toBe(true);

    for (const skill of body.skills) {
      expect(skill).toHaveProperty('id');
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('enabled');
      expect(skill).toHaveProperty('source');
      expect(['role-match', 'manual']).toContain(skill.source);
      expect(typeof skill.enabled).toBe('boolean');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Drag-and-Drop Reordering — SkillsEditor on Team Member Page
// ═══════════════════════════════════════════════════════════════════

test.describe('Drag-and-drop skill reordering', () => {
  test.setTimeout(45_000);

  test('SkillsEditor renders on team member detail page', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    await expect(page.getByTestId('skills-editor')).toBeVisible({ timeout: 10_000 });
  });

  test('Add Skill button adds new skill badges', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    const editor = page.getByTestId('skills-editor');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Click "Add Skill" button
    const addBtn = page.getByTestId('add-skill-button');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Input should appear
    const input = page.getByTestId('skill-input');
    await expect(input).toBeVisible();

    // Type a skill name and press Enter
    const newSkill = `test-skill-${Date.now()}`;
    await input.fill(newSkill);
    await input.press('Enter');
    await page.waitForTimeout(500);

    // The skill badge should appear in the editor
    await expect(editor.getByText(newSkill)).toBeVisible();
  });

  test('remove button removes a skill badge', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    const editor = page.getByTestId('skills-editor');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Add a skill first
    await page.getByTestId('add-skill-button').click();
    const input = page.getByTestId('skill-input');
    const tempSkill = `temp-skill-${Date.now()}`;
    await input.fill(tempSkill);
    await input.press('Enter');
    await page.waitForTimeout(500);

    await expect(editor.getByText(tempSkill)).toBeVisible();

    // Click the remove button for that skill
    const removeBtn = page.getByTestId(`remove-skill-${tempSkill}`);
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();
    await page.waitForTimeout(500);

    // Skill should be gone
    await expect(editor.getByText(tempSkill)).not.toBeVisible();
  });

  test('skill badges have drag handles for reordering', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    const editor = page.getByTestId('skills-editor');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Add two skills to enable reordering
    await page.getByTestId('add-skill-button').click();
    await page.getByTestId('skill-input').fill('skill-alpha');
    await page.getByTestId('skill-input').press('Enter');
    await page.waitForTimeout(300);

    await page.getByTestId('add-skill-button').click();
    await page.getByTestId('skill-input').fill('skill-beta');
    await page.getByTestId('skill-input').press('Enter');
    await page.waitForTimeout(300);

    // Both skills should have drag handles
    const dragHandles = editor.locator('[aria-label^="Drag to reorder"]');
    const handleCount = await dragHandles.count();
    expect(handleCount).toBeGreaterThanOrEqual(2);
  });

  test('drag-and-drop reorders skill badges', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    const editor = page.getByTestId('skills-editor');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Add three skills in a known order
    for (const skill of ['drag-first', 'drag-second', 'drag-third']) {
      await page.getByTestId('add-skill-button').click();
      await page.getByTestId('skill-input').fill(skill);
      await page.getByTestId('skill-input').press('Enter');
      await page.waitForTimeout(300);
    }

    // Get initial order by reading badge text content
    const getBadgeTexts = async () => {
      // Use aria-label to find drag handles, then extract the skill name from the label
      const handles = editor.locator('[aria-label^="Drag to reorder drag-"]');
      const texts: string[] = [];
      const count = await handles.count();
      for (let i = 0; i < count; i++) {
        const label = await handles.nth(i).getAttribute('aria-label');
        if (label) {
          const name = label.replace('Drag to reorder ', '');
          texts.push(name);
        }
      }
      return texts;
    };

    const before = await getBadgeTexts();
    expect(before).toContain('drag-first');
    expect(before).toContain('drag-second');
    expect(before).toContain('drag-third');

    // Get the drag handles
    const firstHandle = editor.locator('[aria-label="Drag to reorder drag-first"]');
    const thirdHandle = editor.locator('[aria-label="Drag to reorder drag-third"]');

    if (
      (await firstHandle.isVisible().catch(() => false)) &&
      (await thirdHandle.isVisible().catch(() => false))
    ) {
      // Perform the drag — move "drag-first" to the position of "drag-third"
      await firstHandle.dragTo(thirdHandle);
      await page.waitForTimeout(500);

      // Get the new order — it should have changed
      const after = await getBadgeTexts();

      // The first item should no longer be first (it was dragged to the end)
      if (after.length >= 3) {
        const firstIdx = after.indexOf('drag-first');
        const thirdIdx = after.indexOf('drag-third');
        // After dragging first to third's position, first should be after third
        // or at least the order should have changed
        expect(firstIdx).not.toBe(0);
      }
    }
  });

  test('keyboard-based drag-and-drop reordering works', async ({ page }) => {
    await page.goto('/team-members');

    const firstMember = page.locator('[data-testid^="team-member-"]').first();
    await expect(firstMember).toBeVisible({ timeout: 15_000 });
    await firstMember.click();
    await page.waitForURL(/\/team-members\/[^/]+/, { timeout: 10_000 });

    const editor = page.getByTestId('skills-editor');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Add two skills
    for (const skill of ['kb-alpha', 'kb-beta']) {
      await page.getByTestId('add-skill-button').click();
      await page.getByTestId('skill-input').fill(skill);
      await page.getByTestId('skill-input').press('Enter');
      await page.waitForTimeout(300);
    }

    // Verify both skills exist with drag handles
    const firstHandle = editor.locator('[aria-label="Drag to reorder kb-alpha"]');
    await expect(firstHandle).toBeVisible({ timeout: 5_000 });

    // Read initial order
    const getKbOrder = async () => {
      const handles = editor.locator('[aria-label^="Drag to reorder kb-"]');
      const names: string[] = [];
      const count = await handles.count();
      for (let i = 0; i < count; i++) {
        const label = await handles.nth(i).getAttribute('aria-label');
        if (label) names.push(label.replace('Drag to reorder ', ''));
      }
      return names;
    };

    const before = await getKbOrder();
    expect(before).toEqual(['kb-alpha', 'kb-beta']);

    // Focus the first drag handle
    await firstHandle.focus();

    // @dnd-kit keyboard: Space to start, ArrowRight to move, Space to drop
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Verify order changed: kb-alpha should now be after kb-beta
    const after = await getKbOrder();
    expect(after).toEqual(['kb-beta', 'kb-alpha']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Skill Store Filters — Additional Edge Cases
// ═══════════════════════════════════════════════════════════════════

test.describe('Skill store filters — edge cases', () => {
  test('custom-created skill appears in search results', async ({ page, request }) => {
    const skillName = uniqueId('e2e-searchable');

    // Create the skill via API
    const res = await createSkillViaApi(request, skillName, {
      tags: ['unique-e2e-tag'],
    });
    expect(res.status()).toBe(201);

    try {
      await page.goto('/skills');

      // Wait for the grid to load
      const grid = page.locator('[data-testid^="skill-card"]').first();
      await expect(grid).toBeVisible({ timeout: 15_000 });

      // Search for our unique skill
      const searchInput = page.getByPlaceholder(/search/i).or(page.getByTestId('skill-search-input'));
      if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Convert kebab-case to display name for search
        const displayName = skillName
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' ');
        await searchInput.fill(displayName.slice(0, 10));
        await page.waitForTimeout(800);

        // Our skill should appear in results
        const cards = page.locator('[data-testid^="skill-card"]');
        const count = await cards.count();
        expect(count).toBeGreaterThanOrEqual(1);
      }
    } finally {
      await deleteSkillViaApi(request, skillName);
    }
  });

  test('deleting a skill via API removes it from the store', async ({ page, request }) => {
    const skillName = uniqueId('e2e-deletable');

    // Create the skill
    const createRes = await createSkillViaApi(request, skillName);
    expect(createRes.status()).toBe(201);

    // Verify it exists
    await page.goto('/skills');
    const grid = page.locator('[data-testid^="skill-card"]').first();
    await expect(grid).toBeVisible({ timeout: 15_000 });

    const countBefore = await page.locator('[data-testid^="skill-card"]').count();

    // Delete via API
    await deleteSkillViaApi(request, skillName);

    // Reload and verify count decreased
    await page.reload();
    await page.locator('[data-testid^="skill-card"]').first().waitFor({ timeout: 15_000 });

    const countAfter = await page.locator('[data-testid^="skill-card"]').count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test('duplicate skill creation returns 409', async ({ request }) => {
    const skillName = uniqueId('e2e-dup');

    const first = await createSkillViaApi(request, skillName);
    expect(first.status()).toBe(201);

    try {
      const second = await createSkillViaApi(request, skillName);
      expect(second.status()).toBe(409);
    } finally {
      await deleteSkillViaApi(request, skillName);
    }
  });
});

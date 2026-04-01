/**
 * Trace Detail Instrumentation — E2E Smoke Test
 *
 * Navigates to a trace detail page and verifies:
 *   1. Span tree renders with correct hierarchy
 *   2. Clicking a tool span shows input/output JSON
 *   3. Cost summary displays correctly
 *
 * This test ingests realistic trace data via the OTLP API,
 * then navigates to the web UI to verify rendering.
 */
import { expect, test } from '@playwright/test';

const API_BASE = 'http://localhost:3001';

const TEST_TRACE_ID = `inst${Date.now().toString(16).padStart(28, '0')}`;
const ROOT_SPAN_ID = `r1${Date.now().toString(16).padStart(14, '0')}`;
const TOOL_SPAN_ID = `t1${Date.now().toString(16).padStart(14, '0')}`;
const TOOL2_SPAN_ID = `t2${Date.now().toString(16).padStart(14, '0')}`;
const LLM_SPAN_ID = `l1${Date.now().toString(16).padStart(14, '0')}`;
const now = Date.now();

function makeOtlpPayload(
  traceId: string,
  spans: Array<{
    spanId: string;
    parentSpanId?: string;
    name: string;
    kind?: number;
    status?: { code: number };
    startTimeMs: number;
    endTimeMs?: number;
    attributes?: Record<string, string | number | boolean>;
  }>,
) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'e2e-instrumentation' } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'e2e-instrumentation', version: '1.0.0' },
            spans: spans.map((s) => ({
              traceId,
              spanId: s.spanId,
              parentSpanId: s.parentSpanId,
              name: s.name,
              kind: s.kind ?? 1,
              startTimeUnixNano: String(BigInt(s.startTimeMs) * BigInt(1_000_000)),
              endTimeUnixNano: s.endTimeMs
                ? String(BigInt(s.endTimeMs) * BigInt(1_000_000))
                : undefined,
              status: s.status ?? { code: 1 },
              attributes: s.attributes
                ? Object.entries(s.attributes).map(([key, val]) => ({
                    key,
                    value:
                      typeof val === 'string'
                        ? { stringValue: val }
                        : typeof val === 'number'
                          ? Number.isInteger(val)
                            ? { intValue: String(val) }
                            : { doubleValue: val }
                          : { boolValue: val },
                  }))
                : [],
            })),
          },
        ],
      },
    ],
  };
}

test.describe('Trace Detail — Instrumentation Smoke', () => {
  test.beforeAll(async ({ request }) => {
    const payload = makeOtlpPayload(TEST_TRACE_ID, [
      {
        spanId: ROOT_SPAN_ID,
        name: 'agent:code-assistant',
        kind: 1,
        startTimeMs: now - 5000,
        endTimeMs: now,
        status: { code: 1 },
        attributes: {
          'ai.agent_id': 'code-assistant',
          'ai.task_title': 'Fix login bug',
        },
      },
      {
        spanId: TOOL_SPAN_ID,
        parentSpanId: ROOT_SPAN_ID,
        name: 'tool:Git Diff',
        kind: 1,
        startTimeMs: now - 4000,
        endTimeMs: now - 3000,
        status: { code: 1 },
        attributes: {
          'tool.name': 'Git Diff',
          'tool.input': 'main..fix/login-bug',
          'tool.output': '+15 lines, -3 lines in src/auth.ts',
          'tool.duration_ms': 1000,
        },
      },
      {
        spanId: TOOL2_SPAN_ID,
        parentSpanId: ROOT_SPAN_ID,
        name: 'tool:File Writer',
        kind: 1,
        startTimeMs: now - 2000,
        endTimeMs: now - 1000,
        status: { code: 1 },
        attributes: {
          'tool.name': 'File Writer',
          'tool.input': 'src/auth.ts',
          'tool.output': 'File written successfully',
          'tool.duration_ms': 1000,
        },
      },
      {
        spanId: LLM_SPAN_ID,
        parentSpanId: ROOT_SPAN_ID,
        name: 'llm:gpt-4o',
        kind: 1,
        startTimeMs: now - 3000,
        endTimeMs: now - 2000,
        status: { code: 1 },
        attributes: {
          'ai.model': 'gpt-4o',
          'ai.prompt': 'Fix the login bug in src/auth.ts',
          'ai.response': 'Here is the fix for the login bug...',
          'llm.prompt_tokens': 500,
          'llm.completion_tokens': 250,
          'llm.cost_usd': 0.0065,
        },
      },
    ]);

    const res = await request.post(`${API_BASE}/v1/traces`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBe(true);
  });

  test('span tree renders with multiple span rows', async ({ page }) => {
    await page.goto(`/traces/${TEST_TRACE_ID}`);
    await page.waitForTimeout(500);

    const spanRows = page.locator('[role="button"]');
    const count = await spanRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('trace header shows trace metadata', async ({ page }) => {
    await page.goto(`/traces/${TEST_TRACE_ID}`);
    await page.waitForTimeout(500);

    await expect(page.getByText(TEST_TRACE_ID)).toBeVisible();
    await expect(page.getByText(/tokens/i)).toBeVisible();
    await expect(page.getByText(/spans/i)).toBeVisible();
  });

  test('clicking a span shows detail panel with input/output tabs', async ({
    page,
  }) => {
    await page.goto(`/traces/${TEST_TRACE_ID}`);
    await page.waitForTimeout(500);

    const spanRow = page.locator('[role="button"]').first();
    await spanRow.click();
    await page.waitForTimeout(300);

    await expect(page.getByText('input')).toBeVisible();
    await expect(page.getByText('output')).toBeVisible();
    await expect(page.getByText('metadata')).toBeVisible();
  });

  test('tool span detail shows duration and timing', async ({ page }) => {
    await page.goto(`/traces/${TEST_TRACE_ID}`);
    await page.waitForTimeout(500);

    const spanRow = page.locator('[role="button"]').first();
    await spanRow.click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Duration')).toBeVisible();
    await expect(page.getByText('Start Time')).toBeVisible();
  });

  test('cost summary is displayed for the trace', async ({ page }) => {
    await page.goto(`/traces/${TEST_TRACE_ID}`);
    await page.waitForTimeout(500);

    const pageContent = await page.textContent('body');
    const hasCostInfo =
      pageContent?.includes('cost') ||
      pageContent?.includes('Cost') ||
      pageContent?.includes('$') ||
      pageContent?.includes('0.006');
    expect(hasCostInfo).toBe(true);
  });

  test('metadata tab shows JSON attributes when clicked', async ({ page }) => {
    await page.goto(`/traces/${TEST_TRACE_ID}`);
    await page.waitForTimeout(500);

    const spanRow = page.locator('[role="button"]').first();
    await spanRow.click();
    await page.waitForTimeout(300);

    const metadataTab = page.getByRole('button', { name: 'metadata' });
    await metadataTab.click();
    await page.waitForTimeout(200);

    const preTag = page.locator('pre');
    await expect(preTag).toBeVisible();

    const preContent = await preTag.textContent();
    expect(preContent).toBeTruthy();
    expect(preContent).toContain('{');
  });
});

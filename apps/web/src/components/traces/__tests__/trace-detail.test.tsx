/**
 * Tests for TraceDetail component.
 *
 * Covers:
 * - Loading and error states
 * - Waterfall rendering (span rows, depth, selection)
 * - Span detail panel (header, metrics, tabs, input/output/metadata)
 * - Tool spans displaying kind badge and name
 * - Empty states for input/output
 * - Error span display
 * - Collapse/expand behaviour
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Span, Trace } from '@/lib/trace-types';

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the useTrace hook
vi.mock('@/hooks/use-traces', () => ({
  useTrace: vi.fn(),
}));

import { useTrace } from '@/hooks/use-traces';

import { TraceDetail } from '../trace-detail';

const mockedUseTrace = vi.mocked(useTrace);

// ── Helpers ───────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    parentId: null,
    name: 'Test Span',
    kind: 'llm',
    status: 'success',
    startTime: 1000,
    endTime: 2000,
    duration: 1000,
    input: { prompt: 'Hello' },
    output: { response: 'World' },
    error: null,
    tokens: { prompt: 100, completion: 50, total: 150 },
    cost: 0.005,
    model: 'gpt-5.4',
    metadata: { 'ai.model': 'gpt-5.4' },
    children: [],
    toolName: null,
    toolId: null,
    events: [],
    toolInfo: null,
    llmInfo: null,
    ...overrides,
  };
}

function makeTrace(overrides: Partial<Trace> = {}, rootOverrides: Partial<Span> = {}): Trace {
  return {
    id: 'trace-1',
    name: 'Test Agent Run',
    agentName: 'bender',
    status: 'success',
    startTime: 1000,
    endTime: 3000,
    duration: 2000,
    totalTokens: 500,
    totalCost: 0.05,
    spanCount: 3,
    errorCount: 0,
    rootSpan: makeSpan(rootOverrides),
    ...overrides,
  };
}

function renderTraceDetail(traceId = 'trace-1') {
  return render(<TraceDetail traceId={traceId} />, { wrapper });
}

// ── Tests ─────────────────────────────────────────────────────────

describe('TraceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ────────────────────────────────────────────

  describe('loading state', () => {
    it('renders skeleton placeholders while loading', () => {
      mockedUseTrace.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as ReturnType<typeof useTrace>);

      const { container } = renderTraceDetail();

      // Should show animated pulse placeholders
      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });
  });

  // ── Error state ──────────────────────────────────────────────

  describe('error state', () => {
    it('renders error message when trace fails to load', () => {
      mockedUseTrace.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      expect(screen.getByText('Trace not found or failed to load.')).toBeInTheDocument();
    });

    it('renders error message when trace data is undefined', () => {
      mockedUseTrace.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      expect(screen.getByText('Trace not found or failed to load.')).toBeInTheDocument();
    });
  });

  // ── Header ───────────────────────────────────────────────────

  describe('header', () => {
    it('displays trace name and status', () => {
      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Agent Run');
      expect(screen.getByText('success')).toBeInTheDocument();
    });

    it('displays trace metadata (id, tokens, cost, span count)', () => {
      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      expect(screen.getByText('trace-1')).toBeInTheDocument();
      expect(screen.getByText('500 tokens')).toBeInTheDocument();
      expect(screen.getByText('$0.0500')).toBeInTheDocument();
      expect(screen.getByText('3 spans')).toBeInTheDocument();
    });

    it('renders back button linking to /traces', () => {
      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const backLink = screen.getByRole('link', { name: '' });
      expect(backLink).toHaveAttribute('href', '/traces');
    });
  });

  // ── Waterfall ────────────────────────────────────────────────

  describe('waterfall', () => {
    it('renders span rows in the waterfall', () => {
      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const rows = screen.getAllByRole('button');
      // At least 1 span row + possibly tab buttons (input/output/metadata are not visible until selection)
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Test Span')).toBeInTheDocument();
    });

    it('renders child spans under parent', () => {
      const rootSpan = makeSpan({
        id: 'root',
        name: 'Agent Run',
        kind: 'agent',
        children: [
          makeSpan({ id: 'child-1', parentId: 'root', name: 'LLM Call', kind: 'llm' }),
          makeSpan({ id: 'child-2', parentId: 'root', name: 'Tool Call', kind: 'tool' }),
        ],
      });

      mockedUseTrace.mockReturnValue({
        data: makeTrace({ spanCount: 3 }, { ...rootSpan }),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      expect(screen.getByText('Agent Run')).toBeInTheDocument();
      expect(screen.getByText('LLM Call')).toBeInTheDocument();
      expect(screen.getByText('Tool Call')).toBeInTheDocument();
    });

    it('shows duration in waterfall rows', () => {
      mockedUseTrace.mockReturnValue({
        data: makeTrace({}, { duration: 1500, name: 'Slow Span' }),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      // 1500ms should show as "1.50s"
      expect(screen.getByText('1.50s')).toBeInTheDocument();
    });
  });

  // ── Span selection & detail panel ────────────────────────────

  describe('span detail panel', () => {
    it('shows detail panel when a span is clicked', async () => {
      const user = userEvent.setup();

      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      // Click on the span row (it has role="button")
      const spanRow = screen.getByText('Test Span').closest('[role="button"]')!;
      await user.click(spanRow);

      // Detail panel should appear with span name and kind badge
      const detailHeading = screen.getByRole('heading', { level: 3 });
      expect(detailHeading).toHaveTextContent('Test Span');
      // The kind badge renders inside the detail panel header alongside the span name
      const allLlmTexts = screen.getAllByText('llm');
      expect(allLlmTexts.length).toBeGreaterThanOrEqual(2); // legend + badge
    });

    it('shows Duration and Start Time in detail metrics', async () => {
      const user = userEvent.setup();

      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const spanRow = screen.getByText('Test Span').closest('[role="button"]')!;
      await user.click(spanRow);

      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Start Time')).toBeInTheDocument();
    });

    it('shows token metrics when span has tokens', async () => {
      const user = userEvent.setup();

      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const spanRow = screen.getByText('Test Span').closest('[role="button"]')!;
      await user.click(spanRow);

      expect(screen.getByText('Prompt Tokens')).toBeInTheDocument();
      expect(screen.getByText('Completion Tokens')).toBeInTheDocument();
      expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    });

    it('shows model name when available', async () => {
      const user = userEvent.setup();

      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const spanRow = screen.getByText('Test Span').closest('[role="button"]')!;
      await user.click(spanRow);

      expect(screen.getByText('Model')).toBeInTheDocument();
      expect(screen.getByText('gpt-5.4')).toBeInTheDocument();
    });

    it('shows cost when available', async () => {
      const user = userEvent.setup();

      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const spanRow = screen.getByText('Test Span').closest('[role="button"]')!;
      await user.click(spanRow);

      expect(screen.getByText('Cost')).toBeInTheDocument();
      expect(screen.getByText('$0.0050')).toBeInTheDocument();
    });
  });

  // ── Tabs: input/output/metadata ──────────────────────────────

  describe('detail panel tabs', () => {
    async function setupWithSelectedSpan(spanOverrides: Partial<Span> = {}) {
      const user = userEvent.setup();

      mockedUseTrace.mockReturnValue({
        data: makeTrace({}, spanOverrides),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const spanRow = screen
        .getByText(spanOverrides.name ?? 'Test Span')
        .closest('[role="button"]')!;
      await user.click(spanRow);

      return { user };
    }

    it('renders input tab by default with JSON content', async () => {
      await setupWithSelectedSpan({ input: { prompt: 'What is 2+2?' } });

      const pre = screen.getByText(/"prompt": "What is 2\+2\?"/);
      expect(pre).toBeInTheDocument();
    });

    it('switches to output tab', async () => {
      const { user } = await setupWithSelectedSpan({
        output: { response: 'The answer is 4' },
      });

      const outputTab = screen.getByRole('button', { name: 'output' });
      await user.click(outputTab);

      expect(screen.getByText(/"response": "The answer is 4"/)).toBeInTheDocument();
    });

    it('shows "No output" when output is null and no error', async () => {
      const { user } = await setupWithSelectedSpan({
        output: null,
        error: null,
      });

      const outputTab = screen.getByRole('button', { name: 'output' });
      await user.click(outputTab);

      expect(screen.getByText('No output')).toBeInTheDocument();
    });

    it('shows error message in output tab when output is null but error exists', async () => {
      const { user } = await setupWithSelectedSpan({
        output: null,
        error: 'Connection timeout',
        name: 'Timeout Span',
      });

      const outputTab = screen.getByRole('button', { name: 'output' });
      await user.click(outputTab);

      // The error text appears both in the header and in the output tab
      const errorTexts = screen.getAllByText('Connection timeout');
      expect(errorTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('switches to metadata tab', async () => {
      const { user } = await setupWithSelectedSpan({
        metadata: { 'ai.model': 'gpt-5.4', 'custom.field': 42 },
      });

      const metadataTab = screen.getByRole('button', { name: 'metadata' });
      await user.click(metadataTab);

      expect(screen.getByText(/"ai\.model": "gpt-5\.4"/)).toBeInTheDocument();
    });

    it('renders null input as "null" text', async () => {
      await setupWithSelectedSpan({ input: null });

      // JSON.stringify(null) = "null"
      expect(screen.getByText('null')).toBeInTheDocument();
    });
  });

  // ── Error spans ──────────────────────────────────────────────

  describe('error spans', () => {
    it('displays error text in span detail header', async () => {
      const user = userEvent.setup();

      const errorSpan = makeSpan({
        status: 'error',
        error: 'Rate limit exceeded',
        name: 'Failed LLM Call',
      });

      mockedUseTrace.mockReturnValue({
        data: makeTrace({ status: 'error', errorCount: 1 }, errorSpan),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const spanRow = screen.getByText('Failed LLM Call').closest('[role="button"]')!;
      await user.click(spanRow);

      // Error text appears in the span detail header
      const errorTexts = screen.getAllByText('Rate limit exceeded');
      expect(errorTexts.length).toBeGreaterThanOrEqual(1);
      // Status "error" appears in both the trace header badge and detail panel
      const errorStatuses = screen.getAllByText('error');
      expect(errorStatuses.length).toBeGreaterThanOrEqual(1);
    });

    it('renders error overlay on waterfall bar', () => {
      const errorSpan = makeSpan({
        status: 'error',
        name: 'Error Span',
      });

      mockedUseTrace.mockReturnValue({
        data: makeTrace({ status: 'error' }, errorSpan),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      const { container } = renderTraceDetail();

      // Error spans render a ring-1 ring-red-500 overlay
      const errorOverlay = container.querySelector('.ring-red-500');
      expect(errorOverlay).toBeInTheDocument();
    });
  });

  // ── Collapse/expand ──────────────────────────────────────────

  describe('collapse/expand', () => {
    function setupWithChildren() {
      const rootSpan = makeSpan({
        id: 'root',
        name: 'Root Agent',
        kind: 'agent',
        children: [
          makeSpan({
            id: 'child-1',
            parentId: 'root',
            name: 'Child LLM',
            kind: 'llm',
            startTime: 1100,
          }),
          makeSpan({
            id: 'child-2',
            parentId: 'root',
            name: 'Child Tool',
            kind: 'tool',
            startTime: 1500,
          }),
        ],
      });

      mockedUseTrace.mockReturnValue({
        data: makeTrace({ spanCount: 3 }, { ...rootSpan }),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      return renderTraceDetail();
    }

    it('shows expand/collapse toggle for spans with children', () => {
      setupWithChildren();

      // The root span should have a toggle button (chevron)
      // Children should be visible initially
      expect(screen.getByText('Root Agent')).toBeInTheDocument();
      expect(screen.getByText('Child LLM')).toBeInTheDocument();
      expect(screen.getByText('Child Tool')).toBeInTheDocument();
    });

    it('hides children when parent is collapsed', async () => {
      const user = userEvent.setup();
      setupWithChildren();

      // Find and click the collapse toggle button within the root span row
      // The toggle button is the first button inside the span label column
      const rootRow = screen.getByText('Root Agent').closest('[role="button"]')!;
      const toggleButton = within(rootRow).getAllByRole('button')[0];
      await user.click(toggleButton);

      // Children should be hidden
      expect(screen.queryByText('Child LLM')).not.toBeInTheDocument();
      expect(screen.queryByText('Child Tool')).not.toBeInTheDocument();
      // Root should still be visible
      expect(screen.getByText('Root Agent')).toBeInTheDocument();
    });

    it('re-expands children when toggle is clicked again', async () => {
      const user = userEvent.setup();
      setupWithChildren();

      const rootRow = screen.getByText('Root Agent').closest('[role="button"]')!;
      const toggleButton = within(rootRow).getAllByRole('button')[0];

      // Collapse
      await user.click(toggleButton);
      expect(screen.queryByText('Child LLM')).not.toBeInTheDocument();

      // Expand
      await user.click(toggleButton);
      expect(screen.getByText('Child LLM')).toBeInTheDocument();
      expect(screen.getByText('Child Tool')).toBeInTheDocument();
    });
  });

  // ── Legend ───────────────────────────────────────────────────

  describe('legend', () => {
    it('renders span kind legend entries', () => {
      mockedUseTrace.mockReturnValue({
        data: makeTrace(),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      // The legend renders all span kinds
      for (const kind of ['agent', 'chain', 'tool', 'llm', 'retriever', 'embedding']) {
        expect(screen.getByText(kind)).toBeInTheDocument();
      }
    });
  });

  // ── Tool span kind badge in waterfall ────────────────────────

  describe('tool span display', () => {
    it('renders tool span with wrench icon and name', () => {
      const toolSpan = makeSpan({
        kind: 'tool',
        name: 'search_web',
        toolName: 'search_web',
        toolId: 'tool-1',
      });

      mockedUseTrace.mockReturnValue({
        data: makeTrace({}, toolSpan),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      expect(screen.getByText('search_web')).toBeInTheDocument();
    });

    it('shows tool kind badge when span is selected', async () => {
      const user = userEvent.setup();

      const toolSpan = makeSpan({
        kind: 'tool',
        name: 'calculator',
        toolName: 'calculator',
      });

      mockedUseTrace.mockReturnValue({
        data: makeTrace({}, toolSpan),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      renderTraceDetail();

      const spanRow = screen.getByText('calculator').closest('[role="button"]')!;
      await user.click(spanRow);

      // Kind badge renders in detail panel; "tool" also in legend — check multiple
      const toolTexts = screen.getAllByText('tool');
      expect(toolTexts.length).toBeGreaterThanOrEqual(2); // legend + badge
    });
  });

  // ── Running state ────────────────────────────────────────────

  describe('running state', () => {
    it('renders running indicator for running spans', () => {
      const runningSpan = makeSpan({
        status: 'running',
        name: 'Running Span',
        endTime: null,
        duration: null,
      });

      mockedUseTrace.mockReturnValue({
        data: makeTrace({ status: 'running', duration: null, endTime: null }, runningSpan),
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useTrace>);

      const { container } = renderTraceDetail();

      // Running spans have animate-pulse on the timing bar
      const pulseBar = container.querySelector('.animate-pulse');
      expect(pulseBar).toBeInTheDocument();
    });
  });
});

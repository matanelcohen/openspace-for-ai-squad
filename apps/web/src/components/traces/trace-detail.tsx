'use client';

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Download,
  FileText,
  Loader2,
  Radio,
  Search as SearchIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useTrace } from '@/hooks/use-traces';
import type { Span, SpanEvent, SpanKind, TraceStatus } from '@/lib/trace-types';
import { cn } from '@/lib/utils';

import { CollapsibleJson } from './collapsible-json';
import { ToolCallTable } from './tool-call-table';
import { TraceSummaryBar } from './trace-summary-bar';

// --- Helpers ---

const SPAN_EMOJI: Record<string, string> = {
  agent: '🧠',
  chain: '🔗',
  tool: '🔧',
  llm: '🤖',
  retriever: '🔍',
  embedding: '📐',
  internal: '⚙️',
  reasoning: '💭',
  server: '🖥️',
  client: '📱',
  unspecified: '❓',
};

const SPAN_COLORS: Record<string, string> = {
  agent: 'bg-purple-500',
  chain: 'bg-blue-500',
  tool: 'bg-amber-500',
  llm: 'bg-green-500',
  retriever: 'bg-cyan-500',
  embedding: 'bg-pink-500',
  internal: 'bg-slate-500',
  reasoning: 'bg-violet-500',
  server: 'bg-green-500',
  client: 'bg-green-500',
  producer: 'bg-blue-500',
  consumer: 'bg-blue-500',
  unspecified: 'bg-gray-500',
};

const SPAN_BG_COLORS: Record<string, string> = {
  agent: 'bg-purple-500/20 border-purple-500/40',
  chain: 'bg-blue-500/20 border-blue-500/40',
  tool: 'bg-amber-500/20 border-amber-500/40',
  llm: 'bg-green-500/20 border-green-500/40',
  retriever: 'bg-cyan-500/20 border-cyan-500/40',
  embedding: 'bg-pink-500/20 border-pink-500/40',
  internal: 'bg-slate-500/20 border-slate-500/40',
  reasoning: 'bg-violet-500/20 border-violet-500/40',
  server: 'bg-green-500/20 border-green-500/40',
  client: 'bg-green-500/20 border-green-500/40',
  producer: 'bg-blue-500/20 border-blue-500/40',
  consumer: 'bg-blue-500/20 border-blue-500/40',
  unspecified: 'bg-gray-500/20 border-gray-500/40',
};

const STATUS_COLORS: Record<TraceStatus, string> = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  running: 'text-blue-600 dark:text-blue-400',
  pending: 'text-yellow-600 dark:text-yellow-400',
};

/** Status-based bar outline for waterfall visualization */
const STATUS_BAR_RING: Record<TraceStatus, string> = {
  success: '',
  error: 'ring-1 ring-red-500',
  running: 'ring-1 ring-blue-500/50',
  pending: 'ring-1 ring-yellow-500/50',
};

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTokenCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Derive a rich display label: tool_name for tools, model_name for LLM spans */
function getSpanDisplayName(span: Span): string {
  if (span.kind === 'tool') {
    return span.toolName ?? span.name;
  }
  if (span.kind === 'llm' && span.model) {
    return span.model;
  }
  return span.name;
}

function StatusIcon({ status }: { status: TraceStatus }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'error':
      return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
  }
}

// --- Flatten span tree for waterfall ---

interface FlatSpan {
  span: Span;
  depth: number;
}

function flattenSpans(span: Span, depth: number = 0): FlatSpan[] {
  const result: FlatSpan[] = [{ span, depth }];
  span.children
    .sort((a, b) => a.startTime - b.startTime)
    .forEach((child) => {
      result.push(...flattenSpans(child, depth + 1));
    });
  return result;
}

// --- Span Subtitle ---

export function SpanSubtitle({ span }: { span: Span }) {
  let content: React.ReactNode = null;

  switch (span.kind) {
    case 'tool': {
      if (span.inputPreview || span.outputPreview) {
        content = (
          <>
            {span.inputPreview && <span className="truncate">{span.inputPreview}</span>}
            {span.inputPreview && span.outputPreview && (
              <span className="mx-1 text-muted-foreground/50">→</span>
            )}
            {span.outputPreview && <span className="truncate">{span.outputPreview}</span>}
          </>
        );
      }
      break;
    }
    case 'llm': {
      const parts: string[] = [];
      if (span.model) parts.push(span.model);
      if (span.tokens) parts.push(`${formatTokenCount(span.tokens.total)} tokens`);
      if (span.cost != null) parts.push(`$${span.cost.toFixed(4)}`);
      if (parts.length > 0) content = parts.join(' · ');
      break;
    }
    case 'agent': {
      if (span.inputPreview) content = span.inputPreview;
      break;
    }
    case 'chain': {
      const childCount = span.children.length;
      if (childCount > 0) content = `${childCount} step${childCount !== 1 ? 's' : ''}`;
      break;
    }
    default: {
      if (span.inputPreview) content = span.inputPreview;
      break;
    }
  }

  if (!content) return null;

  return <div className="truncate text-[10px] font-mono text-muted-foreground">{content}</div>;
}

// --- JSON Syntax Highlighting ---

function SyntaxHighlightedJson({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2) ?? 'null';
  const highlighted = json
    .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="text-blue-400">$1</span>:')
    .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="text-green-400">$1</span>')
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="text-amber-400">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="text-purple-400">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="text-red-400">$1</span>');

  return (
    <pre
      className="whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

// --- Error Detail Section ---

function ErrorDetail({ error, errorStack }: { error: string; errorStack: string | null }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate font-medium">{error}</span>
          <ChevronDown
            className={cn('h-4 w-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-md border border-red-500/30 bg-red-950/20 p-3">
          <p className="mb-2 text-sm font-medium text-red-500">{error}</p>
          {errorStack && (
            <pre className="whitespace-pre-wrap break-words text-xs font-mono text-red-400/80">
              {errorStack}
            </pre>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Span Events Tab ---

function SpanEventsTab({ events }: { events: SpanEvent[] }) {
  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <FileText className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-xs">No events recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, i) => {
        const isException = event.name === 'exception' || event.name === 'error';
        return (
          <div
            key={`${event.name}-${event.timestamp}-${i}`}
            className={cn(
              'rounded-md border p-3',
              isException ? 'border-red-500/40 bg-red-500/5' : 'border-border/50 bg-muted/20',
            )}
          >
            <div className="flex items-center gap-2">
              {isException ? (
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <Radio className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  'text-xs font-semibold',
                  isException ? 'text-red-500' : 'text-foreground',
                )}
              >
                {event.name}
              </span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
            {event.attributes && Object.keys(event.attributes).length > 0 && (
              <div className="mt-2">
                {isException && event.attributes['exception.stacktrace'] ? (
                  <pre className="whitespace-pre-wrap break-words text-xs font-mono text-red-400/80">
                    {String(event.attributes['exception.stacktrace'])}
                  </pre>
                ) : (
                  <SyntaxHighlightedJson data={event.attributes} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Waterfall Row ---

interface WaterfallRowProps {
  span: Span;
  depth: number;
  traceStart: number;
  traceDuration: number;
  isSelected: boolean;
  isCollapsed: boolean;
  hasChildren: boolean;
  onSelect: (span: Span) => void;
  onToggle: (spanId: string) => void;
}

function WaterfallRow({
  span,
  depth,
  traceStart,
  traceDuration,
  isSelected,
  isCollapsed,
  hasChildren,
  onSelect,
  onToggle,
}: WaterfallRowProps) {
  const barColor = SPAN_COLORS[span.kind] ?? 'bg-blue-500';
  const barRing = STATUS_BAR_RING[span.status] ?? '';
  const emoji = SPAN_EMOJI[span.kind] ?? '';
  const displayName = getSpanDisplayName(span);

  const offsetPct = traceDuration > 0 ? ((span.startTime - traceStart) / traceDuration) * 100 : 0;
  const widthPct =
    traceDuration > 0 && span.duration != null
      ? Math.max((span.duration / traceDuration) * 100, 0.5)
      : span.status === 'running'
        ? 100 - offsetPct
        : 0.5;

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center border-b border-border/50 transition-colors hover:bg-muted/50',
        isSelected && 'bg-accent/50',
      )}
      onClick={() => onSelect(span)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(span);
      }}
    >
      {/* Span label column */}
      <div className="flex w-[400px] min-w-[400px] items-start gap-1 border-r border-border/50 px-2 py-2">
        <div style={{ width: depth * 20 }} className="flex-shrink-0" />
        {hasChildren ? (
          <button
            className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(span.id);
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <div className="mt-0.5 w-5 flex-shrink-0" />
        )}
        <div className="mt-0.5 flex-shrink-0">
          <StatusIcon status={span.status} />
        </div>
        <span className="mt-0.5 flex-shrink-0 text-xs" title={span.kind}>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-xs font-medium">{displayName}</span>
            {/* Token & cost badges for LLM spans */}
            {span.kind === 'llm' && span.tokens && (
              <Badge
                variant="outline"
                className="ml-0.5 flex-shrink-0 gap-0.5 px-1 py-0 text-[9px] font-mono"
              >
                <Coins className="h-2.5 w-2.5" />
                {formatTokenCount(span.tokens.total)}
              </Badge>
            )}
            {span.kind === 'llm' && span.cost != null && (
              <Badge
                variant="outline"
                className="flex-shrink-0 px-1 py-0 text-[9px] font-mono text-green-600 dark:text-green-400"
              >
                ${span.cost.toFixed(4)}
              </Badge>
            )}
            <span className="ml-auto flex-shrink-0 text-[10px] font-mono text-muted-foreground">
              {formatDuration(span.duration)}
            </span>
          </div>
          <SpanSubtitle span={span} />
        </div>
      </div>

      {/* Timing bar column */}
      <div className="relative flex-1 py-1.5 px-2">
        <div className="relative h-5 w-full">
          <div
            className={cn(
              'absolute top-0 h-full rounded-sm',
              span.status === 'error' ? 'bg-red-500/70' : barColor,
              span.status === 'running' && 'animate-pulse',
              barRing,
            )}
            style={{
              left: `${offsetPct}%`,
              width: `${widthPct}%`,
              minWidth: '2px',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// --- Span Detail Panel ---

interface SpanDetailProps {
  span: Span;
}

function SpanDetail({ span }: SpanDetailProps) {
  const emoji = SPAN_EMOJI[span.kind] ?? '';
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'events' | 'attributes'>('input');
  const displayName = getSpanDisplayName(span);

  const tabs = ['input', 'output', 'events', 'attributes'] as const;
  const eventCount = span.events?.length ?? 0;
  const attrCount = Object.keys(span.metadata ?? {}).length;

  // Collect all displayable attributes into a flat key-value list
  const allAttributes = useMemo(() => {
    const attrs: { key: string; value: string }[] = [];
    // Add span core info
    attrs.push({ key: 'span.id', value: span.id });
    attrs.push({ key: 'span.traceId', value: span.traceId });
    if (span.parentId) attrs.push({ key: 'span.parentId', value: span.parentId });
    attrs.push({ key: 'span.kind', value: span.kind });
    attrs.push({ key: 'span.status', value: span.status });
    // Tool attributes
    if (span.toolName) attrs.push({ key: 'tool.name', value: span.toolName });
    if (span.toolId) attrs.push({ key: 'tool.id', value: span.toolId });
    // LLM attributes
    if (span.model) attrs.push({ key: 'llm.model', value: span.model });
    if (span.provider) attrs.push({ key: 'llm.provider', value: span.provider });
    if (span.streaming != null) attrs.push({ key: 'llm.streaming', value: String(span.streaming) });
    if (span.timeToFirstToken != null)
      attrs.push({ key: 'llm.time_to_first_token_ms', value: `${span.timeToFirstToken}ms` });
    // Tokens
    if (span.tokens) {
      attrs.push({ key: 'llm.prompt_tokens', value: span.tokens.prompt.toLocaleString() });
      attrs.push({ key: 'llm.completion_tokens', value: span.tokens.completion.toLocaleString() });
      attrs.push({ key: 'llm.total_tokens', value: span.tokens.total.toLocaleString() });
    }
    if (span.cost != null) attrs.push({ key: 'llm.cost_usd', value: `$${span.cost.toFixed(6)}` });
    // Bytes
    if (span.inputBytes != null)
      attrs.push({ key: 'input.bytes', value: formatBytes(span.inputBytes) });
    if (span.outputBytes != null)
      attrs.push({ key: 'output.bytes', value: formatBytes(span.outputBytes) });
    // Custom metadata
    for (const [k, v] of Object.entries(span.metadata ?? {})) {
      attrs.push({ key: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
    }
    return attrs;
  }, [span]);

  // Performance metrics for this span
  const perfMetrics = useMemo(() => {
    const metrics: { label: string; value: string }[] = [];
    if (span.timeToFirstToken != null) {
      metrics.push({ label: 'Time to First Token', value: formatDuration(span.timeToFirstToken) });
    }
    if (span.duration != null && span.tokens?.total) {
      const tokensPerSec = (span.tokens.total / (span.duration / 1000)).toFixed(1);
      metrics.push({ label: 'Throughput', value: `${tokensPerSec} tokens/s` });
    }
    // Queue wait: gap between this span's start and its first child
    if (span.children.length > 0) {
      const firstChildStart = Math.min(...span.children.map((c) => c.startTime));
      const queueWait = firstChildStart - span.startTime;
      if (queueWait > 5) {
        metrics.push({ label: 'Queue Wait', value: formatDuration(queueWait) });
      }
    }
    return metrics;
  }, [span]);

  // Check for retry child spans
  const retrySpans = useMemo(() => {
    return span.children.filter(
      (c) =>
        c.name.toLowerCase().includes('retry') ||
        c.metadata?.['retry.attempt'] != null ||
        c.metadata?.['retry'] != null,
    );
  }, [span]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'border-b p-4',
          SPAN_BG_COLORS[span.kind] ?? 'bg-blue-500/20 border-blue-500/40',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <h3 className="font-semibold">{displayName}</h3>
          {span.kind === 'tool' && span.toolName && (
            <Badge variant="secondary" className="text-xs font-bold">
              🔧 {span.toolName}
            </Badge>
          )}
          {span.kind === 'llm' && span.provider && (
            <Badge variant="outline" className="text-xs">
              {span.provider}
            </Badge>
          )}
          {span.kind === 'llm' && span.model && (
            <Badge variant="secondary" className="text-xs">
              {span.model}
            </Badge>
          )}
          <Badge variant="outline" className="ml-auto text-xs capitalize">
            {span.kind}
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <StatusIcon status={span.status} />
          <span className={cn('font-medium capitalize', STATUS_COLORS[span.status])}>
            {span.status}
          </span>
          <span className="text-xs text-muted-foreground">· {formatDuration(span.duration)}</span>
        </div>
      </div>

      {/* Error section — prominent expandable red-tinted block */}
      {span.status === 'error' && span.error && (
        <div className="border-b p-3">
          <ErrorDetail error={span.error} errorStack={span.errorStack} />
          {/* Show retry attempts as child spans */}
          {retrySpans.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Retry attempts ({retrySpans.length})
              </div>
              {retrySpans.map((retry) => (
                <div
                  key={retry.id}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                    retry.status === 'error'
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-green-500/30 bg-green-500/5',
                  )}
                >
                  <StatusIcon status={retry.status} />
                  <span className="font-medium">{retry.name}</span>
                  <span className="ml-auto font-mono text-muted-foreground">
                    {formatDuration(retry.duration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Performance metrics bar — shown when we have latency data */}
      {perfMetrics.length > 0 && (
        <div className="flex flex-wrap gap-3 border-b px-4 py-2.5">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          {perfMetrics.map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{m.label}:</span>
              <span className="font-mono font-medium">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 border-b p-4">
        <div>
          <div className="text-xs text-muted-foreground">Duration</div>
          <div className="flex items-center gap-1 font-mono text-sm font-medium">
            <Clock className="h-3 w-3" />
            {formatDuration(span.duration)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Start Time</div>
          <div className="font-mono text-sm">{formatTimestamp(span.startTime)}</div>
        </div>

        {/* LLM-specific metrics */}
        {span.kind === 'llm' && (
          <>
            {span.model && (
              <div>
                <div className="text-xs text-muted-foreground">Model</div>
                <div className="text-sm font-medium">{span.model}</div>
              </div>
            )}
            {span.provider && (
              <div>
                <div className="text-xs text-muted-foreground">Provider</div>
                <div className="text-sm font-medium capitalize">{span.provider}</div>
              </div>
            )}
            {span.timeToFirstToken != null && (
              <div>
                <div className="text-xs text-muted-foreground">Time to First Token</div>
                <div className="font-mono text-sm font-medium">
                  {formatDuration(span.timeToFirstToken)}
                </div>
              </div>
            )}
            {span.streaming != null && (
              <div>
                <div className="text-xs text-muted-foreground">Streaming</div>
                <div className="flex items-center gap-1 text-sm font-medium">
                  {span.streaming ? (
                    <>
                      <Radio className="h-3 w-3 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">Yes</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tool-specific metrics */}
        {span.kind === 'tool' && (
          <>
            {span.toolName && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Tool Name</div>
                <div className="text-sm font-bold">🔧 {span.toolName}</div>
              </div>
            )}
            {span.toolId && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Tool ID</div>
                <div className="font-mono text-sm font-medium">{span.toolId}</div>
              </div>
            )}
          </>
        )}

        {/* Tokens */}
        {span.tokens && (
          <>
            <div>
              <div className="text-xs text-muted-foreground">Prompt Tokens</div>
              <div className="flex items-center gap-1 font-mono text-sm font-medium">
                <Coins className="h-3 w-3" />
                {span.tokens.prompt.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Completion Tokens</div>
              <div className="font-mono text-sm font-medium">
                {span.tokens.completion.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Tokens</div>
              <div className="font-mono text-sm font-bold">
                {span.tokens.total.toLocaleString()}
              </div>
            </div>
          </>
        )}
        {span.cost != null && (
          <div>
            <div className="text-xs text-muted-foreground">Cost</div>
            <div className="font-mono text-sm font-medium text-green-600 dark:text-green-400">
              ${span.cost.toFixed(4)}
            </div>
          </div>
        )}
        {/* Model for non-LLM spans */}
        {span.kind !== 'llm' && span.model && (
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground">Model</div>
            <div className="text-sm font-medium">{span.model}</div>
          </div>
        )}

        {/* Input/output byte sizes */}
        {span.inputBytes != null && (
          <div>
            <div className="text-xs text-muted-foreground">Input Size</div>
            <div className="font-mono text-sm">{formatBytes(span.inputBytes)}</div>
          </div>
        )}
        {span.outputBytes != null && (
          <div>
            <div className="text-xs text-muted-foreground">Output Size</div>
            <div className="font-mono text-sm">{formatBytes(span.outputBytes)}</div>
          </div>
        )}
      </div>

      {/* Tabs: input / output / events / attributes */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs font-medium capitalize transition-colors',
              activeTab === tab
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'events' && eventCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] px-1 text-[9px]">
                {eventCount}
              </Badge>
            )}
            {tab === 'attributes' && attrCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] px-1 text-[9px]">
                {allAttributes.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'input' && (
          <CollapsibleJson data={span.input} label="Input JSON" maxHeight={500} />
        )}
        {activeTab === 'output' && (
          <div>
            {span.output ? (
              <CollapsibleJson data={span.output} label="Output JSON" maxHeight={500} />
            ) : (
              <div className="rounded-md border border-border/50 bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">
                  {span.error ?? 'No output'}
                </pre>
              </div>
            )}
          </div>
        )}
        {activeTab === 'events' && <SpanEventsTab events={span.events ?? []} />}
        {activeTab === 'attributes' && (
          <div className="space-y-3">
            {/* Key-value attribute table */}
            <div className="rounded-md border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Key</th>
                    <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allAttributes.map((attr, i) => (
                    <tr
                      key={`${attr.key}-${i}`}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="px-3 py-1.5 font-mono text-blue-500 dark:text-blue-400">
                        {attr.key}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground break-all">
                        {attr.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Trace Detail Component ---

interface TraceDetailProps {
  traceId: string;
}

export function TraceDetail({ traceId }: TraceDetailProps) {
  const { data: trace, isLoading, isError } = useTrace(traceId);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledKinds, setEnabledKinds] = useState<Set<SpanKind> | null>(null);
  const [activeView, setActiveView] = useState<'timeline' | 'tools'>('timeline');
  const waterfallRef = useRef<HTMLDivElement>(null);

  const toggleCollapsed = useCallback((spanId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  }, []);

  const toggleKind = useCallback((kind: SpanKind) => {
    setEnabledKinds((prev) => {
      const next = new Set(prev ?? (Object.keys(SPAN_COLORS) as SpanKind[]));
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const allFlatSpans = useMemo(() => {
    if (!trace) return [];
    return flattenSpans(trace.rootSpan);
  }, [trace]);

  const flatSpans = useMemo(() => {
    let spans = allFlatSpans;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchingIds = new Set<string>();

      for (const { span } of spans) {
        if (
          span.name.toLowerCase().includes(query) ||
          span.toolName?.toLowerCase().includes(query) ||
          span.model?.toLowerCase().includes(query) ||
          span.inputPreview?.toLowerCase().includes(query) ||
          span.outputPreview?.toLowerCase().includes(query)
        ) {
          matchingIds.add(span.id);
        }
      }

      // Include ancestors of matching spans to preserve hierarchy
      const visibleIds = new Set(matchingIds);
      for (const { span } of spans) {
        if (matchingIds.has(span.id)) {
          let current = span;
          while (current.parentId) {
            visibleIds.add(current.parentId);
            const parent = spans.find((s) => s.span.id === current.parentId);
            if (parent) current = parent.span;
            else break;
          }
        }
      }

      spans = spans.filter(({ span }) => visibleIds.has(span.id));
    }

    // Apply kind filter
    if (enabledKinds) {
      spans = spans.filter(({ span }) => enabledKinds.has(span.kind));
    }

    // Filter out children of collapsed spans
    const visible: FlatSpan[] = [];
    const collapsedAncestors = new Set<string>();
    for (const item of spans) {
      if (item.span.parentId && collapsedAncestors.has(item.span.parentId)) {
        collapsedAncestors.add(item.span.id);
        continue;
      }
      if (collapsed.has(item.span.id)) {
        collapsedAncestors.add(item.span.id);
      }
      visible.push(item);
    }
    return visible;
  }, [allFlatSpans, collapsed, searchQuery, enabledKinds]);

  const kindSummary = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const { span } of allFlatSpans) {
      counts[span.kind] = (counts[span.kind] ?? 0) + 1;
    }
    return counts;
  }, [allFlatSpans]);

  const traceStart = trace?.startTime ?? 0;
  const traceDuration = trace?.duration ?? (trace ? Date.now() - trace.startTime : 1);

  // Select a span from the tool table and optionally switch to timeline view
  const handleSelectFromTable = useCallback(
    (span: Span) => {
      setSelectedSpan(span);
      setActiveView('timeline');
      // Expand parents so the span is visible
      setCollapsed((prev) => {
        const next = new Set(prev);
        // Remove the selected span and its ancestors from collapsed set
        let current: string | null = span.parentId;
        const allFlat = allFlatSpans;
        while (current) {
          next.delete(current);
          const parent = allFlat.find((s) => s.span.id === current);
          current = parent?.span.parentId ?? null;
        }
        return next;
      });
    },
    [allFlatSpans],
  );

  // Time scale markers
  const timeMarkers = useMemo(() => {
    if (!traceDuration) return [];
    const count = 5;
    return Array.from({ length: count + 1 }, (_, i) => ({
      label: formatDuration(Math.round((traceDuration / count) * i)),
      pct: (i / count) * 100,
    }));
  }, [traceDuration]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (isError || !trace) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center text-destructive">
          Trace not found or failed to load.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/traces">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{trace.name}</h2>
            <Badge variant="outline" className="capitalize">
              {trace.status}
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{trace.id}</span>
            <span>{formatTimestamp(trace.startTime)}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const a = document.createElement('a');
            a.href = `/api/traces/${traceId}/export`;
            a.download = `trace-${traceId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Cost & token summary bar */}
      <TraceSummaryBar
        rootSpan={trace.rootSpan}
        totalDuration={trace.duration}
        totalTokens={trace.totalTokens}
        totalCost={trace.totalCost}
        spanCount={trace.spanCount}
        errorCount={trace.errorCount}
      />

      {/* View tab switcher: Timeline | Tools */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { key: 'timeline' as const, label: 'Timeline', icon: '📊' },
              { key: 'tools' as const, label: 'Tools', icon: '🔧' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeView === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveView(tab.key)}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Kind filter/legend — only show in timeline view */}
        {activeView === 'timeline' && (
          <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Filter:</span>
            {(Object.entries(SPAN_COLORS) as [SpanKind, string][]).map(([kind, color]) => {
              const isActive = !enabledKinds || enabledKinds.has(kind);
              const count = kindSummary[kind] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={kind}
                  onClick={() => toggleKind(kind)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all',
                    isActive
                      ? 'border-border bg-card shadow-sm'
                      : 'border-transparent bg-muted/50 opacity-50',
                  )}
                >
                  <div className={cn('h-2.5 w-2.5 rounded-sm', color)} />
                  <span className="text-[10px]">{SPAN_EMOJI[kind] ?? ''}</span>
                  <span className="capitalize text-muted-foreground">{kind}</span>
                  <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[9px]">
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Search — shown in timeline view */}
      {activeView === 'timeline' && (
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search spans by name, tool, model, input, output…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      )}

      {/* Main content */}
      {activeView === 'timeline' ? (
        <div className="flex flex-1 gap-0 overflow-hidden rounded-lg border" ref={waterfallRef}>
          {/* Waterfall */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Time scale header */}
            <div className="flex border-b bg-muted/30">
              <div className="w-[400px] min-w-[400px] border-r border-border/50 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Span
              </div>
              <div className="relative flex-1 px-2 py-1.5">
                {timeMarkers.map((m) => (
                  <span
                    key={m.pct}
                    className="absolute top-1.5 text-[10px] font-mono text-muted-foreground"
                    style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Time grid lines */}
            <div className="relative flex-1 overflow-auto">
              {/* Vertical grid lines */}
              <div className="pointer-events-none absolute inset-0 flex">
                <div className="w-[400px] min-w-[400px]" />
                <div className="relative flex-1">
                  {timeMarkers.map((m) => (
                    <div
                      key={m.pct}
                      className="absolute top-0 h-full w-px bg-border/30"
                      style={{ left: `${m.pct}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Rows */}
              {flatSpans.map(({ span, depth }) => (
                <WaterfallRow
                  key={span.id}
                  span={span}
                  depth={depth}
                  traceStart={traceStart}
                  traceDuration={traceDuration}
                  isSelected={selectedSpan?.id === span.id}
                  isCollapsed={collapsed.has(span.id)}
                  hasChildren={span.children.length > 0}
                  onSelect={setSelectedSpan}
                  onToggle={toggleCollapsed}
                />
              ))}
            </div>
          </div>

          {/* Detail panel */}
          {selectedSpan && (
            <div className="w-[420px] min-w-[420px] border-l bg-card">
              <SpanDetail span={selectedSpan} />
            </div>
          )}
        </div>
      ) : (
        /* Tools tab view */
        <div className="flex flex-1 gap-0 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <ToolCallTable
              rootSpan={trace.rootSpan}
              onSelectSpan={handleSelectFromTable}
              selectedSpanId={selectedSpan?.id}
            />
          </div>
          {/* Detail panel also available in tools view */}
          {selectedSpan && (
            <div className="w-[420px] min-w-[420px] border-l bg-card rounded-lg border overflow-hidden">
              <SpanDetail span={selectedSpan} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

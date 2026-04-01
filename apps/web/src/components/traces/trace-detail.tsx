'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Filter,
  Globe,
  Loader2,
  Search as SearchIcon,
  Timer,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTrace } from '@/hooks/use-traces';
import type { Span, SpanKind, TraceStatus } from '@/lib/trace-types';
import { cn } from '@/lib/utils';

// --- Helpers ---

const SPAN_ICONS: Record<string, React.ElementType> = {
  agent: Bot,
  chain: Zap,
  tool: Wrench,
  llm: Cpu,
  retriever: SearchIcon,
  embedding: Brain,
  http: Globe,
  internal: Zap,
  server: Cpu,
  client: Cpu,
  producer: Zap,
  consumer: Zap,
};

const SPAN_COLORS: Record<string, string> = {
  agent: 'bg-purple-500',
  chain: 'bg-indigo-500',
  tool: 'bg-green-500',
  llm: 'bg-blue-500',
  retriever: 'bg-cyan-500',
  embedding: 'bg-pink-500',
  http: 'bg-gray-500',
  internal: 'bg-slate-500',
  server: 'bg-gray-500',
  client: 'bg-gray-500',
  producer: 'bg-slate-500',
  consumer: 'bg-slate-500',
};

const SPAN_BG_COLORS: Record<string, string> = {
  agent: 'bg-purple-500/20 border-purple-500/40',
  chain: 'bg-indigo-500/20 border-indigo-500/40',
  tool: 'bg-green-500/20 border-green-500/40',
  llm: 'bg-blue-500/20 border-blue-500/40',
  retriever: 'bg-cyan-500/20 border-cyan-500/40',
  embedding: 'bg-pink-500/20 border-pink-500/40',
  http: 'bg-gray-500/20 border-gray-500/40',
  internal: 'bg-slate-500/20 border-slate-500/40',
  server: 'bg-gray-500/20 border-gray-500/40',
  client: 'bg-gray-500/20 border-gray-500/40',
  producer: 'bg-slate-500/20 border-slate-500/40',
  consumer: 'bg-slate-500/20 border-slate-500/40',
};

// Filterable span kinds shown in the legend and filter bar
const FILTERABLE_KINDS: SpanKind[] = [
  'agent',
  'chain',
  'llm',
  'tool',
  'http',
  'retriever',
  'embedding',
];

const STATUS_COLORS: Record<TraceStatus, string> = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  running: 'text-blue-600 dark:text-blue-400',
  pending: 'text-yellow-600 dark:text-yellow-400',
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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
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

/** Get the display label for a span — uses tool/HTTP metadata when available. */
function getSpanLabel(span: Span): string {
  if (span.kind === 'tool') {
    const toolName = span.metadata?.['tool.name'];
    if (typeof toolName === 'string') return toolName;
    return span.name;
  }
  if (span.kind === 'http') {
    const method = span.metadata?.['http.method'] ?? '';
    const route = span.metadata?.['http.route'] ?? '';
    if (method || route) return `${method} ${route}`.trim();
    return span.name;
  }
  return span.name;
}

/** Collect all spans in a tree into a flat array. */
function collectAllSpans(span: Span): Span[] {
  const result: Span[] = [span];
  for (const child of span.children) {
    result.push(...collectAllSpans(child));
  }
  return result;
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

// --- Expandable JSON block ---

function ExpandableContent({ label, content }: { label: string; content: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const isLong = text != null && text.length > 300;
  const displayText = !expanded && isLong ? text.slice(0, 300) + '…' : text;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {isLong && (
          <button
            className="text-[10px] font-medium text-primary hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-xs font-mono text-muted-foreground">
        {displayText ?? 'null'}
      </pre>
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
  const Icon = SPAN_ICONS[span.kind] ?? Zap;
  const isError = span.status === 'error';
  const barColor = isError ? 'bg-red-500' : (SPAN_COLORS[span.kind] ?? 'bg-blue-500');

  const offsetPct = traceDuration > 0 ? ((span.startTime - traceStart) / traceDuration) * 100 : 0;
  const widthPct =
    traceDuration > 0 && span.duration != null
      ? Math.max((span.duration / traceDuration) * 100, 0.5)
      : span.status === 'running'
        ? 100 - offsetPct
        : 0.5;

  const label = getSpanLabel(span);

  // HTTP status badge
  const httpStatus =
    span.kind === 'http' ? (span.metadata?.['http.status_code'] as number | undefined) : undefined;

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-center border-b border-border/50 transition-colors hover:bg-muted/50',
        isSelected && 'bg-accent/50',
        isError && 'border-l-2 border-l-red-500 bg-red-500/5',
      )}
      onClick={() => onSelect(span)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(span);
      }}
    >
      {/* Span label column */}
      <div className="flex w-[320px] min-w-[320px] items-center gap-1 border-r border-border/50 px-2 py-1.5">
        <div style={{ width: depth * 20 }} className="flex-shrink-0" />
        {hasChildren ? (
          <button
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-muted"
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
          <div className="w-5 flex-shrink-0" />
        )}
        {isError ? (
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
        ) : (
          <StatusIcon status={span.status} />
        )}
        <Icon
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0',
            isError ? 'text-red-500' : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'truncate text-xs font-medium',
            isError && 'text-red-600 dark:text-red-400',
          )}
        >
          {label}
        </span>

        {/* Kind badge */}
        <Badge
          variant="outline"
          className={cn(
            'ml-1 flex-shrink-0 px-1 py-0 text-[9px] capitalize leading-tight',
            isError && 'border-red-500/40 text-red-500',
          )}
        >
          {span.kind}
        </Badge>

        {/* HTTP status code badge */}
        {httpStatus != null && (
          <Badge
            variant="outline"
            className={cn(
              'flex-shrink-0 px-1 py-0 text-[9px] leading-tight',
              httpStatus >= 400
                ? 'border-red-500/40 text-red-500'
                : 'border-green-500/40 text-green-600',
            )}
          >
            {httpStatus}
          </Badge>
        )}

        {/* Duration badge */}
        <span className="ml-auto flex-shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
          {formatDuration(span.duration)}
        </span>
      </div>

      {/* Timing bar column */}
      <div className="relative flex-1 py-1.5 px-2">
        <div className="relative h-5 w-full">
          <div
            className={cn(
              'absolute top-0 h-full rounded-sm',
              barColor,
              span.status === 'running' && 'animate-pulse',
            )}
            style={{
              left: `${offsetPct}%`,
              width: `${widthPct}%`,
              minWidth: '2px',
            }}
          />
          {isError && (
            <div
              className="absolute top-0 h-full rounded-sm bg-red-500/30 ring-1 ring-red-500"
              style={{
                left: `${offsetPct}%`,
                width: `${widthPct}%`,
                minWidth: '2px',
              }}
            />
          )}
        </div>

        {/* Inline error preview */}
        {isError && span.error && (
          <div className="mt-0.5 truncate text-[10px] text-red-500">⚠ {span.error}</div>
        )}
      </div>
    </div>
  );
}

// --- Tool Span Detail Panel ---

function ToolSpanDetail({ span }: { span: Span }) {
  const toolName = (span.metadata?.['tool.name'] as string | undefined) ?? span.name;
  const toolInput = span.metadata?.['tool.input'] ?? span.input;
  const toolOutput = span.metadata?.['tool.output'] ?? span.output;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={cn('border-b p-4', SPAN_BG_COLORS.tool)}>
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-bold">{toolName}</h3>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <StatusIcon status={span.status} />
          <span className={cn('font-medium capitalize', STATUS_COLORS[span.status])}>
            {span.status}
          </span>
          <Badge variant="outline" className="text-xs">
            tool
          </Badge>
        </div>
        {span.error && (
          <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {span.error}
          </div>
        )}
      </div>

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
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        <ExpandableContent label="Input Arguments" content={toolInput} />
        <ExpandableContent
          label="Output / Result"
          content={span.status === 'error' ? (span.error ?? 'Error — no output') : toolOutput}
        />
        {Object.keys(span.metadata).length > 0 && (
          <ExpandableContent label="Metadata" content={span.metadata} />
        )}
      </div>
    </div>
  );
}

// --- LLM Span Detail Panel ---

function LLMSpanDetail({ span }: { span: Span }) {
  const model = (span.metadata?.['llm.model'] as string | undefined) ?? span.model ?? 'Unknown';
  const ttft = span.metadata?.['llm.time_to_first_token'] as number | undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={cn('border-b p-4', SPAN_BG_COLORS.llm)}>
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold">{span.name}</h3>
          <Badge variant="outline" className="ml-auto text-xs">
            llm
          </Badge>
        </div>
        <div className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">{model}</div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <StatusIcon status={span.status} />
          <span className={cn('font-medium capitalize', STATUS_COLORS[span.status])}>
            {span.status}
          </span>
        </div>
        {span.error && (
          <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {span.error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-b p-4">
        <div>
          <div className="text-xs text-muted-foreground">Duration</div>
          <div className="flex items-center gap-1 font-mono text-sm font-medium">
            <Clock className="h-3 w-3" />
            {formatDuration(span.duration)}
          </div>
        </div>
        {ttft != null && (
          <div>
            <div className="text-xs text-muted-foreground">Time to First Token</div>
            <div className="flex items-center gap-1 font-mono text-sm font-medium">
              <Timer className="h-3 w-3" />
              {formatDuration(ttft)}
            </div>
          </div>
        )}
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
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        <ExpandableContent label="Prompt / Input" content={span.input} />
        <ExpandableContent
          label="Response / Output"
          content={span.status === 'error' ? (span.error ?? 'Error — no output') : span.output}
        />
        {Object.keys(span.metadata).length > 0 && (
          <ExpandableContent label="Metadata" content={span.metadata} />
        )}
      </div>
    </div>
  );
}

// --- HTTP Span Detail Panel ---

function HTTPSpanDetail({ span }: { span: Span }) {
  const method = (span.metadata?.['http.method'] as string | undefined) ?? 'GET';
  const route = (span.metadata?.['http.route'] as string | undefined) ?? span.name;
  const statusCode = span.metadata?.['http.status_code'] as number | undefined;
  const isErrorCode = statusCode != null && statusCode >= 400;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={cn('border-b p-4', SPAN_BG_COLORS.http)}>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">{method}</h3>
          <span className="truncate text-sm text-muted-foreground">{route}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            http
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          {statusCode != null && (
            <Badge
              variant="outline"
              className={cn(
                'font-mono text-xs',
                isErrorCode
                  ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400',
              )}
            >
              {statusCode}
            </Badge>
          )}
          <StatusIcon status={span.status} />
          <span className={cn('font-medium capitalize', STATUS_COLORS[span.status])}>
            {span.status}
          </span>
        </div>
        {span.error && (
          <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {span.error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-b p-4">
        <div>
          <div className="text-xs text-muted-foreground">Method</div>
          <div className="font-mono text-sm font-bold">{method}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Status Code</div>
          <div
            className={cn(
              'font-mono text-sm font-bold',
              isErrorCode ? 'text-red-500' : 'text-green-600',
            )}
          >
            {statusCode ?? '—'}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-muted-foreground">Route</div>
          <div className="font-mono text-sm">{route}</div>
        </div>
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
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {span.input != null ? <ExpandableContent label="Request" content={span.input} /> : null}
        {span.output != null ? <ExpandableContent label="Response" content={span.output} /> : null}
        {Object.keys(span.metadata).length > 0 && (
          <ExpandableContent label="Metadata" content={span.metadata} />
        )}
      </div>
    </div>
  );
}

// --- Generic Span Detail Panel ---

function GenericSpanDetail({ span }: { span: Span }) {
  const Icon = SPAN_ICONS[span.kind] ?? Zap;
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'metadata'>('input');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={cn(
          'border-b p-4',
          SPAN_BG_COLORS[span.kind] ?? 'bg-blue-500/20 border-blue-500/40',
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <h3 className="font-semibold">{span.name}</h3>
          <Badge variant="outline" className="ml-auto text-xs capitalize">
            {span.kind}
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <StatusIcon status={span.status} />
          <span className={cn('font-medium capitalize', STATUS_COLORS[span.status])}>
            {span.status}
          </span>
        </div>
        {span.error && (
          <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {span.error}
          </div>
        )}
      </div>

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
        {span.model && (
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground">Model</div>
            <div className="text-sm font-medium">{span.model}</div>
          </div>
        )}
      </div>

      <div className="flex border-b">
        {(['input', 'output', 'metadata'] as const).map((tab) => (
          <button
            key={tab}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors',
              activeTab === tab
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <pre className="whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">
          {activeTab === 'input' && JSON.stringify(span.input, null, 2)}
          {activeTab === 'output' &&
            (span.output ? JSON.stringify(span.output, null, 2) : (span.error ?? 'No output'))}
          {activeTab === 'metadata' && JSON.stringify(span.metadata, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// --- Span Detail Router ---

function SpanDetail({ span }: { span: Span }) {
  switch (span.kind) {
    case 'tool':
      return <ToolSpanDetail span={span} />;
    case 'llm':
      return <LLMSpanDetail span={span} />;
    case 'http':
      return <HTTPSpanDetail span={span} />;
    default:
      return <GenericSpanDetail span={span} />;
  }
}

// --- Summary Badges ---

function TraceSummaryBadges({ allSpans }: { allSpans: Span[] }) {
  const totalCost = allSpans.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  const totalTokens = allSpans.reduce((sum, s) => sum + (s.tokens?.total ?? 0), 0);
  const toolCalls = allSpans.filter((s) => s.kind === 'tool').length;
  const llmCalls = allSpans.filter((s) => s.kind === 'llm').length;
  const errors = allSpans.filter((s) => s.status === 'error').length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400">
        <Coins className="h-3 w-3" />${totalCost.toFixed(4)}
      </Badge>
      <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-400">
        <Zap className="h-3 w-3" />
        {formatTokens(totalTokens)} tokens
      </Badge>
      <Badge
        variant="outline"
        className="gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-400"
      >
        <Cpu className="h-3 w-3" />
        {llmCalls} LLM calls
      </Badge>
      <Badge
        variant="outline"
        className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      >
        <Wrench className="h-3 w-3" />
        {toolCalls} tool calls
      </Badge>
      {errors > 0 && (
        <Badge variant="outline" className="gap-1 bg-red-500/10 text-red-700 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          {errors} errors
        </Badge>
      )}
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
  const [spanSearch, setSpanSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set());

  const toggleCollapsed = useCallback((spanId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  }, []);

  const toggleKindFilter = useCallback((kind: string) => {
    setKindFilter((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const allSpans = useMemo(() => {
    if (!trace) return [];
    return collectAllSpans(trace.rootSpan);
  }, [trace]);

  const flatSpans = useMemo(() => {
    if (!trace) return [];
    const all = flattenSpans(trace.rootSpan);

    // Filter out children of collapsed spans
    const visible: FlatSpan[] = [];
    const collapsedAncestors = new Set<string>();
    for (const item of all) {
      if (item.span.parentId && collapsedAncestors.has(item.span.parentId)) {
        collapsedAncestors.add(item.span.id);
        continue;
      }
      if (collapsed.has(item.span.id)) {
        collapsedAncestors.add(item.span.id);
      }
      visible.push(item);
    }

    // Apply kind filter
    const hasKindFilter = kindFilter.size > 0;
    // Apply search filter
    const hasSearch = spanSearch.trim().length > 0;

    if (!hasKindFilter && !hasSearch) return visible;

    const query = spanSearch.toLowerCase().trim();

    return visible.filter(({ span }) => {
      if (hasKindFilter && !kindFilter.has(span.kind)) return false;
      if (hasSearch) {
        const label = getSpanLabel(span).toLowerCase();
        const name = span.name.toLowerCase();
        if (!label.includes(query) && !name.includes(query)) return false;
      }
      return true;
    });
  }, [trace, collapsed, kindFilter, spanSearch]);

  const traceStart = trace?.startTime ?? 0;
  const traceDuration = trace?.duration ?? (trace ? Date.now() - trace.startTime : 1);

  // Time scale markers
  const timeMarkers = useMemo(() => {
    if (!traceDuration) return [];
    const count = 5;
    return Array.from({ length: count + 1 }, (_, i) => ({
      label: formatDuration(Math.round((traceDuration / count) * i)),
      pct: (i / count) * 100,
    }));
  }, [traceDuration]);

  const hasActiveFilters = kindFilter.size > 0 || spanSearch.trim().length > 0;

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
            <span>{trace.id}</span>
            <span>{formatTimestamp(trace.startTime)}</span>
            <span>{formatDuration(trace.duration)}</span>
            <span>{trace.spanCount} spans</span>
          </div>
        </div>
      </div>

      {/* Cost & Token Summary Badges */}
      <TraceSummaryBadges allSpans={allSpans} />

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search spans by name..."
            value={spanSearch}
            onChange={(e) => setSpanSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {FILTERABLE_KINDS.map((kind) => {
            const active = kindFilter.has(kind);
            return (
              <button
                key={kind}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
                onClick={() => toggleKindFilter(kind)}
              >
                <div className={cn('h-2 w-2 rounded-full', SPAN_COLORS[kind])} />
                {kind}
              </button>
            );
          })}
          {hasActiveFilters && (
            <button
              className="ml-1 flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => {
                setKindFilter(new Set());
                setSpanSearch('');
              }}
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {FILTERABLE_KINDS.map((kind) => {
          const Icon = SPAN_ICONS[kind] ?? Zap;
          const color = SPAN_COLORS[kind] ?? 'bg-gray-500';
          return (
            <div key={kind} className="flex items-center gap-1.5">
              <div className={cn('h-2.5 w-2.5 rounded-sm', color)} />
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="capitalize text-muted-foreground">{kind}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-red-500" />
          <AlertTriangle className="h-3 w-3 text-red-500" />
          <span className="text-muted-foreground">error</span>
        </div>
      </div>

      {/* Main content: waterfall + detail panel */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-lg border">
        {/* Waterfall */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Time scale header */}
          <div className="flex border-b bg-muted/30">
            <div className="w-[320px] min-w-[320px] border-r border-border/50 px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Span
              {hasActiveFilters && (
                <span className="ml-1 text-primary">({flatSpans.length} shown)</span>
              )}
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

          {/* Time grid lines + rows */}
          <div className="relative flex-1 overflow-auto">
            {/* Vertical grid lines */}
            <div className="pointer-events-none absolute inset-0 flex">
              <div className="w-[320px] min-w-[320px]" />
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
            {flatSpans.length === 0 && hasActiveFilters ? (
              <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
                No spans match the current filters.
              </div>
            ) : (
              flatSpans.map(({ span, depth }) => (
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
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedSpan && (
          <div className="w-[400px] min-w-[400px] border-l bg-card">
            <SpanDetail span={selectedSpan} />
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Copy,
  Cpu,
  Download,
  Loader2,
  Search as SearchIcon,
  Wrench,
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
  internal: Zap,
  reasoning: Brain,
  server: Cpu,
  client: Cpu,
  producer: Zap,
  consumer: Zap,
  unspecified: Zap,
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

function formatTokenCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

const KIND_EMOJI: Record<string, string> = {
  tool: '🔧',
  llm: '🤖',
  chain: '⛓',
  agent: '🧠',
  retriever: '🔍',
  embedding: '📊',
  reasoning: '💭',
  internal: '⚙️',
  server: '🖥️',
  client: '📱',
  producer: '📤',
  consumer: '📥',
  unspecified: '❓',
};

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

function SpanSubtitle({ span }: { span: Span }) {
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
  const barColor = SPAN_COLORS[span.kind] ?? 'bg-blue-500';

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
        <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-xs font-medium">{span.toolName ?? span.name}</span>
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
              barColor,
              span.status === 'running' && 'animate-pulse',
            )}
            style={{
              left: `${offsetPct}%`,
              width: `${widthPct}%`,
              minWidth: '2px',
            }}
          />
          {span.status === 'error' && (
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
      </div>
    </div>
  );
}

// --- Span Detail Panel ---

interface SpanDetailProps {
  span: Span;
}

function SpanDetail({ span }: SpanDetailProps) {
  const Icon = SPAN_ICONS[span.kind] ?? Zap;
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'metadata'>('input');
  const [copied, setCopied] = useState(false);

  const tabContent = useMemo(() => {
    if (activeTab === 'input') return JSON.stringify(span.input, null, 2);
    if (activeTab === 'output')
      return span.output ? JSON.stringify(span.output, null, 2) : (span.error ?? 'No output');
    return JSON.stringify(span.metadata, null, 2);
  }, [activeTab, span]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(tabContent ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [tabContent]);

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
          <Icon className="h-5 w-5" />
          <h3 className="font-semibold">{span.name}</h3>
          {span.kind === 'tool' && span.toolName && (
            <Badge variant="secondary" className="text-xs">
              {span.toolName}
            </Badge>
          )}
          {span.kind === 'llm' && span.model && (
            <Badge variant="secondary" className="text-xs">
              {span.model}
            </Badge>
          )}
          {span.kind === 'llm' && span.provider && (
            <Badge variant="outline" className="text-xs">
              {span.provider}
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
          {span.error && <span className="text-xs text-red-500 truncate">{span.error}</span>}
        </div>
      </div>

      {/* Metrics */}
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

      {/* Tabs for input/output/metadata */}
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

      {/* Tab content */}
      <div className="relative flex-1 overflow-auto p-4">
        <button
          onClick={handleCopy}
          className="absolute right-4 top-4 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        <pre className="whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">
          {tabContent}
        </pre>
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

  const toggleCollapsed = useCallback((spanId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
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
  }, [allFlatSpans, collapsed, searchQuery]);

  const kindSummary = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const { span } of allFlatSpans) {
      counts[span.kind] = (counts[span.kind] ?? 0) + 1;
    }
    return counts;
  }, [allFlatSpans]);

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
            <span>{trace.totalTokens.toLocaleString()} tokens</span>
            <span>${trace.totalCost.toFixed(4)}</span>
            <span>{trace.spanCount} spans</span>
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {(Object.entries(SPAN_COLORS) as [SpanKind, string][]).map(([kind, color]) => {
          const Icon = SPAN_ICONS[kind] ?? Zap;
          return (
            <div key={kind} className="flex items-center gap-1.5">
              <div className={cn('h-2.5 w-2.5 rounded-sm', color)} />
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="capitalize text-muted-foreground">{kind}</span>
            </div>
          );
        })}
      </div>

      {/* Span kind summary */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {Object.entries(kindSummary).map(([kind, count]) => (
          <Badge
            key={kind}
            variant="secondary"
            className={cn('gap-1 border text-xs', SPAN_BG_COLORS[kind])}
          >
            <span>{KIND_EMOJI[kind] ?? '❓'}</span>
            <span>
              {count} {kind}
            </span>
          </Badge>
        ))}
        {trace.totalCost > 0 && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Coins className="h-3 w-3" />${trace.totalCost.toFixed(4)}
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search spans by name, tool, model, input, output…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Main content: waterfall + detail panel */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-lg border">
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
          <div className="w-[380px] min-w-[380px] border-l bg-card">
            <SpanDetail span={selectedSpan} />
          </div>
        )}
      </div>
    </div>
  );
}

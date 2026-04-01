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
  FileText,
  Hash,
  Loader2,
  Radio,
  Search as SearchIcon,
  Timer,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTrace } from '@/hooks/use-traces';
import type { Span, SpanEvent, SpanKind, TraceStatus } from '@/lib/trace-types';
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

// Color scheme: tool=blue, llm=purple, agent=green, internal=gray
const SPAN_COLORS: Record<string, string> = {
  agent: 'bg-emerald-500',
  chain: 'bg-sky-500',
  tool: 'bg-blue-500',
  llm: 'bg-purple-500',
  retriever: 'bg-cyan-500',
  embedding: 'bg-pink-500',
  internal: 'bg-gray-400 dark:bg-gray-500',
  reasoning: 'bg-violet-500',
  server: 'bg-teal-500',
  client: 'bg-teal-500',
  producer: 'bg-sky-500',
  consumer: 'bg-sky-500',
  unspecified: 'bg-gray-400 dark:bg-gray-500',
};

const SPAN_BG_COLORS: Record<string, string> = {
  agent: 'bg-emerald-500/20 border-emerald-500/40',
  chain: 'bg-sky-500/20 border-sky-500/40',
  tool: 'bg-blue-500/20 border-blue-500/40',
  llm: 'bg-purple-500/20 border-purple-500/40',
  retriever: 'bg-cyan-500/20 border-cyan-500/40',
  embedding: 'bg-pink-500/20 border-pink-500/40',
  internal: 'bg-gray-500/20 border-gray-500/40',
  reasoning: 'bg-violet-500/20 border-violet-500/40',
  server: 'bg-teal-500/20 border-teal-500/40',
  client: 'bg-teal-500/20 border-teal-500/40',
  producer: 'bg-sky-500/20 border-sky-500/40',
  consumer: 'bg-sky-500/20 border-sky-500/40',
  unspecified: 'bg-gray-500/20 border-gray-500/40',
};

const SPAN_TEXT_COLORS: Record<string, string> = {
  agent: 'text-emerald-700 dark:text-emerald-400',
  chain: 'text-sky-700 dark:text-sky-400',
  tool: 'text-blue-700 dark:text-blue-400',
  llm: 'text-purple-700 dark:text-purple-400',
  retriever: 'text-cyan-700 dark:text-cyan-400',
  embedding: 'text-pink-700 dark:text-pink-400',
  internal: 'text-gray-600 dark:text-gray-400',
  reasoning: 'text-violet-700 dark:text-violet-400',
  server: 'text-teal-700 dark:text-teal-400',
  client: 'text-teal-700 dark:text-teal-400',
  producer: 'text-sky-700 dark:text-sky-400',
  consumer: 'text-sky-700 dark:text-sky-400',
  unspecified: 'text-gray-600 dark:text-gray-400',
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

function formatCostUsd(cost: number | null): string {
  if (cost == null) return '—';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
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

function StatusIcon({ status, className }: { status: TraceStatus; className?: string }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className={cn('h-3.5 w-3.5 text-green-500', className)} />;
    case 'error':
      return <AlertTriangle className={cn('h-3.5 w-3.5 text-red-500', className)} />;
    case 'running':
      return <Loader2 className={cn('h-3.5 w-3.5 animate-spin text-blue-500', className)} />;
    default:
      return <Clock className={cn('h-3.5 w-3.5 text-yellow-500', className)} />;
  }
}

// --- Count spans by kind recursively ---

function countSpansByKind(span: Span): { toolCalls: number; llmCalls: number } {
  let toolCalls = span.kind === 'tool' ? 1 : 0;
  let llmCalls = span.kind === 'llm' ? 1 : 0;
  for (const child of span.children) {
    const childCounts = countSpansByKind(child);
    toolCalls += childCounts.toolCalls;
    llmCalls += childCounts.llmCalls;
  }
  return { toolCalls, llmCalls };
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

// --- Copy Button ---

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [text]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6', className)}
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          {isCopied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isCopied ? 'Copied!' : 'Copy to clipboard'}</TooltipContent>
    </Tooltip>
  );
}

// --- Collapsible JSON Section ---

function CollapsibleJsonSection({
  label,
  data,
  defaultOpen = false,
}: {
  label: string;
  data: unknown;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const json = JSON.stringify(data, null, 2) ?? 'null';
  const byteSize = new TextEncoder().encode(json).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50">
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform',
              !isOpen && '-rotate-90',
            )}
          />
          <span className="font-medium text-foreground">{label}</span>
          <span className="ml-auto font-mono text-muted-foreground">{formatBytes(byteSize)}</span>
          <CopyButton text={json} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 max-h-64 overflow-auto rounded-md border border-border/40 bg-muted/10 p-3">
          <SyntaxHighlightedJson data={data} />
        </div>
      </CollapsibleContent>
    </Collapsible>
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
  const barColor = SPAN_COLORS[span.kind] ?? 'bg-blue-500';
  const textColor = SPAN_TEXT_COLORS[span.kind] ?? 'text-blue-700 dark:text-blue-400';
  const displayName = getSpanDisplayName(span);
  const isError = span.status === 'error';

  const offsetPct = traceDuration > 0 ? ((span.startTime - traceStart) / traceDuration) * 100 : 0;
  const widthPct =
    traceDuration > 0 && span.duration != null
      ? Math.max((span.duration / traceDuration) * 100, 0.5)
      : span.status === 'running'
        ? 100 - offsetPct
        : 0.5;

  // Build tooltip content
  const tooltipLines: string[] = [
    `${span.kind}: ${span.name}`,
    `Status: ${span.status}`,
    `Duration: ${formatDuration(span.duration)}`,
  ];
  if (span.toolName) tooltipLines.push(`Tool: ${span.toolName}`);
  if (span.model) tooltipLines.push(`Model: ${span.model}`);
  if (span.tokens) tooltipLines.push(`Tokens: ${span.tokens.total.toLocaleString()}`);
  if (span.cost != null) tooltipLines.push(`Cost: ${formatCostUsd(span.cost)}`);
  if (span.error) tooltipLines.push(`Error: ${span.error}`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'group flex cursor-pointer items-center border-b transition-colors hover:bg-muted/50',
            isSelected && 'bg-accent/50',
            isError
              ? 'border-b-red-300 bg-red-50/50 dark:border-b-red-900 dark:bg-red-950/20'
              : 'border-b-border/50',
          )}
          onClick={() => onSelect(span)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelect(span);
          }}
        >
          {/* Span label column */}
          <div className="flex w-[420px] min-w-[420px] items-start gap-1 border-r border-border/50 px-2 py-2">
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                {/* Kind badge with icon for tool/llm spans */}
                {span.kind === 'tool' && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'flex-shrink-0 gap-0.5 rounded-md px-1.5 py-0 text-[10px] font-semibold',
                      'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
                    )}
                  >
                    <Wrench className="h-2.5 w-2.5" />
                    {span.toolName ?? span.name}
                  </Badge>
                )}
                {span.kind === 'llm' && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'flex-shrink-0 gap-0.5 rounded-md px-1.5 py-0 text-[10px] font-semibold',
                      'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
                    )}
                  >
                    <Cpu className="h-2.5 w-2.5" />
                    {span.model ?? 'LLM'}
                  </Badge>
                )}
                {span.kind !== 'tool' && span.kind !== 'llm' && (
                  <>
                    <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', textColor)} />
                    <span className="truncate text-xs font-medium">{displayName}</span>
                  </>
                )}

                {/* LLM token/cost badges */}
                {span.kind === 'llm' && span.tokens && (
                  <Badge
                    variant="outline"
                    className="ml-0.5 flex-shrink-0 gap-0.5 px-1 py-0 text-[9px] font-mono"
                  >
                    <Coins className="h-2.5 w-2.5" />
                    {formatTokenCount(span.tokens.prompt)}/
                    {formatTokenCount(span.tokens.completion)}
                  </Badge>
                )}
                {span.kind === 'llm' && span.cost != null && (
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 px-1 py-0 text-[9px] font-mono text-emerald-600 dark:text-emerald-400"
                  >
                    {formatCostUsd(span.cost)}
                  </Badge>
                )}

                {/* Tool payload size */}
                {span.kind === 'tool' && (span.inputBytes != null || span.outputBytes != null) && (
                  <span className="flex-shrink-0 text-[9px] font-mono text-muted-foreground">
                    {formatBytes(span.inputBytes ?? span.outputBytes)}
                  </span>
                )}

                {/* Duration */}
                <span className="ml-auto flex-shrink-0 text-[10px] font-mono text-muted-foreground">
                  {formatDuration(span.duration)}
                </span>
              </div>
              <SpanSubtitle span={span} />
              {/* Inline error message for error spans */}
              {isError && span.error && (
                <div className="mt-0.5 truncate text-[10px] font-medium text-red-500">
                  ⚠ {span.error}
                </div>
              )}
            </div>
          </div>

          {/* Timing bar column */}
          <div className="relative flex-1 py-1.5 px-2">
            <div className="relative h-5 w-full">
              <div
                className={cn(
                  'absolute top-0 h-full rounded-sm transition-opacity',
                  isError ? 'bg-red-500' : barColor,
                  span.status === 'running' && 'animate-pulse',
                )}
                style={{
                  left: `${offsetPct}%`,
                  width: `${widthPct}%`,
                  minWidth: '2px',
                  opacity: isError ? 0.7 : 0.85,
                }}
              />
              {isError && (
                <div
                  className="absolute top-0 h-full rounded-sm ring-1 ring-red-500"
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
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-xs whitespace-pre-line bg-popover text-popover-foreground"
      >
        {tooltipLines.map((line, i) => (
          <div key={i} className={cn('text-xs', i === 0 && 'font-semibold')}>
            {line}
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

// --- Span Detail Panel ---

interface SpanDetailProps {
  span: Span;
}

function SpanDetail({ span }: SpanDetailProps) {
  const Icon = SPAN_ICONS[span.kind] ?? Zap;
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'events' | 'metadata'>('input');
  const displayName = getSpanDisplayName(span);
  const isError = span.status === 'error';

  const inputJson = JSON.stringify(span.input, null, 2) ?? 'null';
  const outputJson = span.output
    ? JSON.stringify(span.output, null, 2)
    : (span.error ?? 'No output');

  const tabs = ['input', 'output', 'events', 'metadata'] as const;
  const eventCount = span.events?.length ?? 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'border-b p-4',
          isError
            ? 'border-red-500/40 bg-red-500/10'
            : (SPAN_BG_COLORS[span.kind] ?? 'bg-blue-500/20 border-blue-500/40'),
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <h3 className="font-semibold">{displayName}</h3>
          {span.kind === 'tool' && span.toolName && (
            <Badge
              variant="secondary"
              className="gap-0.5 border-blue-300 bg-blue-100 text-xs text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              <Wrench className="h-3 w-3" />
              {span.toolName}
            </Badge>
          )}
          {span.kind === 'llm' && span.model && (
            <Badge
              variant="secondary"
              className="gap-0.5 border-purple-300 bg-purple-100 text-xs text-purple-800 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300"
            >
              <Cpu className="h-3 w-3" />
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
        </div>
      </div>

      {/* Error section — prominent expandable red-tinted block */}
      {isError && span.error && (
        <div className="border-b border-red-300 bg-red-50/30 p-3 dark:border-red-900 dark:bg-red-950/30">
          <ErrorDetail error={span.error} errorStack={span.errorStack} />
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
            {span.duration != null && (
              <div>
                <div className="text-xs text-muted-foreground">Latency</div>
                <div className="font-mono text-sm font-bold text-purple-600 dark:text-purple-400">
                  {formatDuration(span.duration)}
                </div>
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
            {span.toolId && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Tool ID</div>
                <div className="font-mono text-sm font-medium">{span.toolId}</div>
              </div>
            )}
            {span.inputBytes != null && (
              <div>
                <div className="text-xs text-muted-foreground">Input Payload</div>
                <div className="font-mono text-sm font-medium">{formatBytes(span.inputBytes)}</div>
              </div>
            )}
            {span.outputBytes != null && (
              <div>
                <div className="text-xs text-muted-foreground">Output Payload</div>
                <div className="font-mono text-sm font-medium">{formatBytes(span.outputBytes)}</div>
              </div>
            )}
          </>
        )}

        {/* Tokens with prompt/completion/total */}
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
            <div className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {formatCostUsd(span.cost)}
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

        {/* Input/output byte sizes for non-tool spans */}
        {span.kind !== 'tool' && span.inputBytes != null && (
          <div>
            <div className="text-xs text-muted-foreground">Input Size</div>
            <div className="font-mono text-sm">{formatBytes(span.inputBytes)}</div>
          </div>
        )}
        {span.kind !== 'tool' && span.outputBytes != null && (
          <div>
            <div className="text-xs text-muted-foreground">Output Size</div>
            <div className="font-mono text-sm">{formatBytes(span.outputBytes)}</div>
          </div>
        )}
      </div>

      {/* Collapsible Input/Output for tool & llm spans */}
      {(span.kind === 'tool' || span.kind === 'llm') &&
        (span.input != null || span.output != null) && (
          <div className="space-y-2 border-b p-3">
            {span.input != null && (
              <CollapsibleJsonSection
                label={span.kind === 'llm' ? 'Prompt / Input' : 'Input'}
                data={span.input}
              />
            )}
            {span.output != null && (
              <CollapsibleJsonSection
                label={span.kind === 'llm' ? 'Response / Output' : 'Output'}
                data={span.output}
              />
            )}
          </div>
        )}

      {/* Tabs: input / output / events / metadata */}
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
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'input' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Input JSON</span>
              <CopyButton text={inputJson} />
            </div>
            <SyntaxHighlightedJson data={span.input} />
          </div>
        )}
        {activeTab === 'output' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Output JSON</span>
              <CopyButton text={outputJson} />
            </div>
            {span.output ? (
              <SyntaxHighlightedJson data={span.output} />
            ) : (
              <pre className="whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">
                {span.error ?? 'No output'}
              </pre>
            )}
          </div>
        )}
        {activeTab === 'events' && <SpanEventsTab events={span.events ?? []} />}
        {activeTab === 'metadata' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Metadata</span>
              <CopyButton text={JSON.stringify(span.metadata, null, 2)} />
            </div>
            <SyntaxHighlightedJson data={span.metadata} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Trace Summary Header ---

function TraceSummaryHeader({
  trace,
  toolCalls,
  llmCalls,
}: {
  trace: {
    name: string;
    agentName: string;
    status: TraceStatus;
    duration: number | null;
    totalTokens: number;
    totalCost: number;
    spanCount: number;
    errorCount: number;
  };
  toolCalls: number;
  llmCalls: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-2 p-3">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              trace.status === 'error'
                ? 'bg-red-100 dark:bg-red-950/50'
                : 'bg-emerald-100 dark:bg-emerald-950/50',
            )}
          >
            <StatusIcon status={trace.status} className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
            <div className={cn('text-sm font-bold capitalize', STATUS_COLORS[trace.status])}>
              {trace.status}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-2 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/50">
            <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Duration
            </div>
            <div className="font-mono text-sm font-bold">{formatDuration(trace.duration)}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-2 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
            <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Cost
            </div>
            <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {formatCostUsd(trace.totalCost)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-2 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50">
            <Hash className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tokens</div>
            <div className="font-mono text-sm font-bold">{trace.totalTokens.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-2 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/50">
            <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Tool Calls
            </div>
            <div className="font-mono text-sm font-bold">{toolCalls}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-2 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950/50">
            <Cpu className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              LLM Calls
            </div>
            <div className="font-mono text-sm font-bold">{llmCalls}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-2 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/50">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Errors</div>
            <div
              className={cn(
                'font-mono text-sm font-bold',
                trace.errorCount > 0 && 'text-red-600 dark:text-red-400',
              )}
            >
              {trace.errorCount}
            </div>
          </div>
        </CardContent>
      </Card>
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

  const spanCounts = useMemo(() => {
    if (!trace) return { toolCalls: 0, llmCalls: 0 };
    return countSpansByKind(trace.rootSpan);
  }, [trace]);

  const flatSpans = useMemo(() => {
    let spans = allFlatSpans;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchingIds = new Set<string>();

      for (const { span } of spans) {
        const inputStr = span.input != null ? JSON.stringify(span.input).toLowerCase() : '';
        const outputStr = span.output != null ? JSON.stringify(span.output).toLowerCase() : '';

        if (
          span.name.toLowerCase().includes(query) ||
          span.toolName?.toLowerCase().includes(query) ||
          span.model?.toLowerCase().includes(query) ||
          span.inputPreview?.toLowerCase().includes(query) ||
          span.outputPreview?.toLowerCase().includes(query) ||
          inputStr.includes(query) ||
          outputStr.includes(query)
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
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
      {/* Header with back button and trace name */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/traces">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{trace.name}</h2>
            <Badge
              variant="outline"
              className={cn(
                'capitalize',
                trace.status === 'error' &&
                  'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-400',
                trace.status === 'success' &&
                  'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/50 dark:text-green-400',
                trace.status === 'running' &&
                  'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
              )}
            >
              <StatusIcon status={trace.status} className="mr-1 h-3 w-3" />
              {trace.status}
            </Badge>
            {trace.agentName && (
              <Badge variant="secondary" className="gap-1">
                <Bot className="h-3 w-3" />
                {trace.agentName}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span>{trace.id}</span>
            <span>·</span>
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

      {/* Trace Summary Header Cards */}
      <TraceSummaryHeader
        trace={trace}
        toolCalls={spanCounts.toolCalls}
        llmCalls={spanCounts.llmCalls}
      />

      {/* Kind filter/legend — toggleable badges + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Filter:</span>
          {(Object.entries(SPAN_COLORS) as [SpanKind, string][]).map(([kind, color]) => {
            const KindIcon = SPAN_ICONS[kind] ?? Zap;
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
                <KindIcon className="h-3 w-3 text-muted-foreground" />
                <span className="capitalize text-muted-foreground">{kind}</span>
                <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[9px]">
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search spans…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Main content: waterfall + detail panel */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-lg border">
        {/* Waterfall */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Time scale header */}
          <div className="flex border-b bg-muted/30">
            <div className="w-[420px] min-w-[420px] border-r border-border/50 px-2 py-1.5 text-xs font-medium text-muted-foreground">
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
              <div className="w-[420px] min-w-[420px]" />
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
          <div className="w-[440px] min-w-[440px] border-l bg-card">
            <SpanDetail span={selectedSpan} />
          </div>
        )}
      </div>
    </div>
  );
}

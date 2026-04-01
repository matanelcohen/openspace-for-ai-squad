'use client';

import { Activity, AlertTriangle, Clock, Coins, DollarSign, Layers } from 'lucide-react';
import { useMemo } from 'react';

import type { Span, SpanKind } from '@/lib/trace-types';
import { cn } from '@/lib/utils';

// Emoji indicators for each span kind
const KIND_EMOJI: Record<string, string> = {
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

const KIND_BG: Record<string, string> = {
  agent: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  chain: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  tool: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  llm: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  retriever: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  embedding: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30',
  internal: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
  reasoning: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30',
};

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

/** Collect all spans into a flat array by traversing the tree. */
function collectAllSpans(span: Span): Span[] {
  const result: Span[] = [span];
  for (const child of span.children) {
    result.push(...collectAllSpans(child));
  }
  return result;
}

interface KindBreakdown {
  kind: SpanKind;
  count: number;
  tokens: number;
  cost: number;
  avgDuration: number;
}

interface TraceSummaryBarProps {
  rootSpan: Span;
  totalDuration: number | null;
  totalTokens: number;
  totalCost: number;
  spanCount: number;
  errorCount: number;
}

export function TraceSummaryBar({
  rootSpan,
  totalDuration,
  totalTokens,
  totalCost,
  spanCount,
  errorCount,
}: TraceSummaryBarProps) {
  const allSpans = useMemo(() => collectAllSpans(rootSpan), [rootSpan]);

  const breakdown = useMemo(() => {
    const map = new Map<
      SpanKind,
      { count: number; tokens: number; cost: number; durations: number[] }
    >();
    for (const span of allSpans) {
      const entry = map.get(span.kind) ?? { count: 0, tokens: 0, cost: 0, durations: [] };
      entry.count++;
      entry.tokens += span.tokens?.total ?? 0;
      entry.cost += span.cost ?? 0;
      if (span.duration != null) entry.durations.push(span.duration);
      map.set(span.kind, entry);
    }
    const result: KindBreakdown[] = [];
    for (const [kind, entry] of map) {
      result.push({
        kind,
        count: entry.count,
        tokens: entry.tokens,
        cost: entry.cost,
        avgDuration:
          entry.durations.length > 0
            ? entry.durations.reduce((a, b) => a + b, 0) / entry.durations.length
            : 0,
      });
    }
    return result.sort((a, b) => b.cost - a.cost || b.count - a.count);
  }, [allSpans]);

  const perfMetrics = useMemo(() => {
    const metrics: { label: string; value: string; icon: React.ElementType }[] = [];
    // Find first LLM span with TTFT
    const llmSpans = allSpans.filter((s) => s.kind === 'llm');
    const firstLlmWithTtft = llmSpans.find((s) => s.timeToFirstToken != null);
    if (firstLlmWithTtft?.timeToFirstToken != null) {
      metrics.push({
        label: 'Time to First Token',
        value: formatDuration(firstLlmWithTtft.timeToFirstToken),
        icon: Activity,
      });
    }
    // Queue wait: time between trace start and first child starting
    if (rootSpan.children.length > 0) {
      const firstChildStart = Math.min(...rootSpan.children.map((c) => c.startTime));
      const queueWait = firstChildStart - rootSpan.startTime;
      if (queueWait > 10) {
        metrics.push({
          label: 'Queue Wait',
          value: formatDuration(queueWait),
          icon: Clock,
        });
      }
    }
    return metrics;
  }, [allSpans, rootSpan]);

  return (
    <div className="space-y-3">
      {/* Top-level stat cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Clock} label="Duration" value={formatDuration(totalDuration)} />
        <StatCard
          icon={Coins}
          label="Tokens"
          value={formatTokenCount(totalTokens)}
          subtitle={`${allSpans.filter((s) => s.tokens).length} LLM calls`}
        />
        <StatCard
          icon={DollarSign}
          label="Cost"
          value={`$${totalCost.toFixed(4)}`}
          className={totalCost > 0.1 ? 'text-amber-600 dark:text-amber-400' : ''}
        />
        <StatCard icon={Layers} label="Spans" value={spanCount.toString()} />
        <StatCard
          icon={AlertTriangle}
          label="Errors"
          value={errorCount.toString()}
          className={errorCount > 0 ? 'text-red-600 dark:text-red-400' : ''}
        />
        {perfMetrics.map((m) => (
          <StatCard key={m.label} icon={m.icon} label={m.label} value={m.value} />
        ))}
      </div>

      {/* Kind breakdown pills */}
      {breakdown.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            By kind:
          </span>
          {breakdown.map((b) => (
            <div
              key={b.kind}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
                KIND_BG[b.kind] ?? 'bg-muted text-muted-foreground border-border',
              )}
            >
              <span>{KIND_EMOJI[b.kind] ?? '❓'}</span>
              <span className="font-medium capitalize">{b.kind}</span>
              <span className="opacity-70">×{b.count}</span>
              {b.tokens > 0 && <span className="opacity-70">· {formatTokenCount(b.tokens)}t</span>}
              {b.cost > 0 && <span className="opacity-70">· ${b.cost.toFixed(4)}</span>}
              <span className="opacity-70">· avg {formatDuration(b.avgDuration)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Stat Card ---

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
  className?: string;
}

function StatCard({ icon: Icon, label, value, subtitle, className }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn('mt-0.5 text-lg font-bold tabular-nums', className)}>{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

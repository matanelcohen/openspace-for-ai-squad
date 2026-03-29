'use client';

import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCosts } from '@/hooks/use-costs';
import { cn } from '@/lib/utils';

type Period = '' | 'today' | 'week' | 'month';

const PERIODS: { key: Period; label: string }[] = [
  { key: '', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 Days' },
  { key: 'month', label: 'Last 30 Days' },
];

function fmt(n: number): string {
  return n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Simple horizontal bar scaled to the maximum value in the set
function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-3 w-full rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all', className ?? 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4.6': 'bg-violet-500',
  'claude-sonnet-4.6': 'bg-indigo-500',
  'claude-haiku-4.5': 'bg-sky-500',
  'gpt-5.4': 'bg-emerald-500',
  'gpt-5.1': 'bg-teal-500',
  'gpt-4.1': 'bg-cyan-500',
};

function modelColor(model: string): string {
  return MODEL_COLORS[model] ?? 'bg-primary';
}

export default function CostsPage() {
  const [period, setPeriod] = useState<Period>('');
  const { data, isLoading, error } = useCosts(period || undefined);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Costs</h1>
        <p className="text-muted-foreground">Track AI spend across agents and models.</p>
      </div>

      {/* Period switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              period === p.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading cost data…</p>}
      {error && <p className="text-destructive">Failed to load cost data.</p>}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{fmt(data.totalCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Prompt Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{fmtTokens(data.totalTokens.prompt)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completion Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{fmtTokens(data.totalTokens.completion)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Cost by Agent — bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cost by Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(data.byAgent).length === 0 && (
                <p className="text-sm text-muted-foreground">No agent data yet.</p>
              )}
              {(() => {
                const entries = Object.entries(data.byAgent).sort((a, b) => b[1].cost - a[1].cost);
                const max = entries[0]?.[1]?.cost ?? 0;
                return entries.map(([name, v]) => (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{name}</span>
                      <span className="text-muted-foreground">{fmt(v.cost)}</span>
                    </div>
                    <Bar value={v.cost} max={max} className="bg-primary" />
                  </div>
                ));
              })()}
            </CardContent>
          </Card>

          {/* Cost by Model — bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cost by Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(data.byModel).length === 0 && (
                <p className="text-sm text-muted-foreground">No model data yet.</p>
              )}
              {(() => {
                const entries = Object.entries(data.byModel).sort((a, b) => b[1].cost - a[1].cost);
                const max = entries[0]?.[1]?.cost ?? 0;
                return entries.map(([name, v]) => (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">
                        {fmt(v.cost)} · {fmtTokens(v.tokens)} tokens · {v.calls} calls
                      </span>
                    </div>
                    <Bar value={v.cost} max={max} className={modelColor(name)} />
                  </div>
                ));
              })()}
            </CardContent>
          </Card>

          {/* Daily cost trend */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Cost Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {data.byDay.length === 0 && (
                <p className="text-sm text-muted-foreground">No daily data yet.</p>
              )}
              <div className="flex items-end gap-2" style={{ minHeight: 120 }}>
                {(() => {
                  const days = data.byDay.slice(-14);
                  const max = Math.max(...days.map((d) => d.cost), 0.001);
                  return days.map((d) => {
                    const pct = (d.cost / max) * 100;
                    return (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">{fmt(d.cost)}</span>
                        <div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(pct, 4)}%` }} />
                        <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Per-agent table */}
          <Card>
            <CardHeader>
              <CardTitle>Per-Agent Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Agent</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                      <th className="pb-2 font-medium text-right">Tokens</th>
                      <th className="pb-2 font-medium text-right">Tasks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.byAgent)
                      .sort((a, b) => b[1].cost - a[1].cost)
                      .map(([name, v]) => (
                        <tr key={name} className="border-b last:border-0">
                          <td className="py-2 font-medium capitalize">{name}</td>
                          <td className="py-2 text-right">{fmt(v.cost)}</td>
                          <td className="py-2 text-right">{fmtTokens(v.tokens)}</td>
                          <td className="py-2 text-right">{v.tasks}</td>
                        </tr>
                      ))}
                    {Object.keys(data.byAgent).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-muted-foreground">
                          No data yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

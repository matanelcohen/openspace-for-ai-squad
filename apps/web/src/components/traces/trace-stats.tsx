'use client';

import { Activity, AlertTriangle, Coins, TrendingUp, Zap } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTraceStats } from '@/hooks/use-traces';
import { cn } from '@/lib/utils';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Simple horizontal bar chart built with CSS */
function BarChart({
  data,
  labelKey,
  valueKey,
  color = 'bg-primary',
  formatValue,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = (val / maxVal) * 100;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 flex-shrink-0 text-right text-xs text-muted-foreground">
              {String(item[labelKey])}
            </span>
            <div className="flex-1">
              <div className="relative h-6 w-full overflow-hidden rounded-sm bg-muted/50">
                <div
                  className={cn('h-full rounded-sm transition-all duration-500', color)}
                  style={{ width: `${Math.max(pct, 1)}%` }}
                />
                <span className="absolute right-2 top-0.5 text-xs font-mono font-medium">
                  {formatValue ? formatValue(val) : val.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Stacked bar chart for token usage (prompt vs completion) */
function StackedBarChart({
  data,
}: {
  data: { date: string; prompt: number; completion: number }[];
}) {
  const maxVal = Math.max(...data.map((d) => d.prompt + d.completion), 1);

  return (
    <div className="flex items-end gap-1.5" style={{ height: '160px' }}>
      {data.map((item, i) => {
        const total = item.prompt + item.completion;
        const totalPct = (total / maxVal) * 100;
        const promptPct = total > 0 ? (item.prompt / total) * 100 : 50;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full flex-1 flex flex-col justify-end">
              <div
                className="w-full rounded-t-sm overflow-hidden"
                style={{ height: `${Math.max(totalPct, 2)}%` }}
              >
                <div className="w-full bg-blue-500" style={{ height: `${promptPct}%` }} />
                <div className="w-full bg-green-500" style={{ height: `${100 - promptPct}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {item.date.split(' ')[1] ?? item.date}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Simple line chart approximation using CSS */
function MiniLineChart({
  data,
  labelKey,
  valueKey,
  color = 'bg-primary',
  formatValue,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 0.001);

  return (
    <div className="space-y-0">
      <div className="flex items-end gap-1.5" style={{ height: '120px' }}>
        {data.map((item, i) => {
          const val = Number(item[valueKey]) || 0;
          const pct = (val / maxVal) * 100;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full flex-1 flex flex-col justify-end">
                <div
                  className={cn('w-full rounded-t-sm', color)}
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {String(item[labelKey]).split(' ')[1] ?? String(item[labelKey])}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>
          {formatValue
            ? formatValue(Number(data[0]?.[valueKey]) || 0)
            : String(data[0]?.[valueKey] ?? '')}
        </span>
        <span>
          {formatValue
            ? formatValue(Number(data[data.length - 1]?.[valueKey]) || 0)
            : String(data[data.length - 1]?.[valueKey] ?? '')}
        </span>
      </div>
    </div>
  );
}

export function TraceStatsView() {
  const { data: stats, isLoading, isError } = useTraceStats();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center text-destructive">
          Failed to load trace statistics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top-level stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Traces</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTraces}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(stats.avgLatency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <Coins className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {(stats.errorRate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Latency Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Latency Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={stats.latencyDistribution}
              labelKey="bucket"
              valueKey="count"
              color="bg-yellow-500"
            />
          </CardContent>
        </Card>

        {/* Cost Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cost Over Time (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniLineChart
              data={stats.costOverTime}
              labelKey="date"
              valueKey="cost"
              color="bg-green-500"
              formatValue={(v) => `$${v.toFixed(4)}`}
            />
          </CardContent>
        </Card>

        {/* Token Usage Trends */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Token Usage (7 days)</CardTitle>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                  <span className="text-muted-foreground">Prompt</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2.5 w-2.5 rounded-sm bg-green-500" />
                  <span className="text-muted-foreground">Completion</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <StackedBarChart data={stats.tokenUsage} />
          </CardContent>
        </Card>

        {/* Error Rates by Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Error Rates by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.errorsByAgent.map((item) => {
                const errorPct = item.total > 0 ? (item.errors / item.total) * 100 : 0;
                return (
                  <div key={item.agent} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.agent}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.errors}/{item.total} ({errorPct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all duration-500"
                        style={{ width: `${Math.max(errorPct, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Traces by Agent */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Traces by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={stats.tracesByAgent}
              labelKey="agent"
              valueKey="count"
              color="bg-purple-500"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

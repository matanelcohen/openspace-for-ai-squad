'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Loader2,
  Search,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTraces } from '@/hooks/use-traces';
import type { TraceStatus } from '@/lib/trace-types';
import { cn } from '@/lib/utils';

type SortField = 'agentName' | 'status' | 'duration' | 'totalTokens' | 'totalCost' | 'startTime';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

const STATUS_CONFIG: Record<
  TraceStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  success: {
    label: 'Success',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertTriangle,
  },
  running: {
    label: 'Running',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Loader2,
  },
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock,
  },
};

function StatusBadge({ status }: { status: TraceStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('gap-1', config.className)}>
      <Icon className={cn('h-3 w-3', status === 'running' && 'animate-spin')} />
      {config.label}
    </Badge>
  );
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (field !== current) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

export function TraceList() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('startTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const {
    data: response,
    isLoading,
    isError,
    isFetching,
  } = useTraces({
    page,
    limit: PAGE_SIZE,
    status: statusFilter,
    agent: agentFilter,
    search,
    sort: sortField,
    sortDir,
  });

  const traces = response?.data ?? [];
  const total = response?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const agents = useMemo(() => {
    if (!traces.length) return [];
    return [...new Set(traces.map((t) => t.agentName))].sort();
  }, [traces]);

  const resetPage = () => setPage(0);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    resetPage();
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    resetPage();
  };

  const handleAgentChange = (value: string) => {
    setAgentFilter(value);
    resetPage();
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    resetPage();
  };

  const summaryStats = useMemo(() => {
    const running = traces.filter((t) => t.status === 'running').length;
    const errors = traces.filter((t) => t.status === 'error').length;
    const withDuration = traces.filter((t) => t.duration != null);
    const avgDuration =
      withDuration.reduce((s, t) => s + (t.duration ?? 0), 0) / (withDuration.length || 1);
    return { total, errors, running, avgDuration };
  }, [traces, total]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center text-destructive">
          Failed to load traces. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Traces</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summaryStats.running}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summaryStats.errors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(summaryStats.avgDuration)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search traces..."
            value={search}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="running">Running</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={handleAgentChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className={cn(isFetching && !isLoading && 'opacity-75 transition-opacity')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('agentName')}
              >
                Agent <SortIcon field="agentName" current={sortField} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('status')}
              >
                Status <SortIcon field="status" current={sortField} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('duration')}
              >
                Duration <SortIcon field="duration" current={sortField} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('totalTokens')}
              >
                Tokens <SortIcon field="totalTokens" current={sortField} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('totalCost')}
              >
                Cost <SortIcon field="totalCost" current={sortField} dir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('startTime')}
              >
                Time <SortIcon field="startTime" current={sortField} dir={sortDir} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No traces found.
                </TableCell>
              </TableRow>
            ) : (
              traces.map((trace) => (
                <TableRow key={trace.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/traces/${trace.id}`}
                      className="flex flex-col gap-0.5 hover:underline"
                    >
                      <span className="font-medium">{trace.agentName}</span>
                      <span className="text-xs text-muted-foreground">{trace.id}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={trace.status} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDuration(trace.duration)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Coins className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-sm">{formatTokens(trace.totalTokens)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatCost(trace.totalCost)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTime(trace.startTime)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} trace{total !== 1 ? 's' : ''} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

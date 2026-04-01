'use client';

import { AlertTriangle, ArrowUpDown, CheckCircle2, Clock, Loader2, Wrench } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import type { Span } from '@/lib/trace-types';
import { cn } from '@/lib/utils';

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Collect all spans into a flat array by traversing the tree. */
function collectAllSpans(span: Span): Span[] {
  const result: Span[] = [span];
  for (const child of span.children) {
    result.push(...collectAllSpans(child));
  }
  return result;
}

type SortField = 'toolName' | 'duration' | 'status';
type SortDirection = 'asc' | 'desc';

interface ToolCallTableProps {
  rootSpan: Span;
  onSelectSpan: (span: Span) => void;
  selectedSpanId?: string;
}

export function ToolCallTable({ rootSpan, onSelectSpan, selectedSpanId }: ToolCallTableProps) {
  const [sortField, setSortField] = useState<SortField>('duration');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const toolSpans = useMemo(() => {
    return collectAllSpans(rootSpan).filter((s) => s.kind === 'tool');
  }, [rootSpan]);

  const sorted = useMemo(() => {
    return [...toolSpans].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'toolName':
          cmp = (a.toolName ?? a.name).localeCompare(b.toolName ?? b.name);
          break;
        case 'duration':
          cmp = (a.duration ?? 0) - (b.duration ?? 0);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [toolSpans, sortField, sortDir]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField],
  );

  if (toolSpans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Wrench className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No tool calls in this trace</p>
        <p className="mt-1 text-xs">Tool spans will appear here when agents invoke tools.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Summary */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {toolSpans.length} tool call{toolSpans.length !== 1 ? 's' : ''}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          Total: {formatDuration(toolSpans.reduce((sum, s) => sum + (s.duration ?? 0), 0))}
        </Badge>
        {toolSpans.some((s) => s.status === 'error') && (
          <Badge variant="destructive" className="text-[10px]">
            {toolSpans.filter((s) => s.status === 'error').length} failed
          </Badge>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                #
              </th>
              <SortableHeader
                label="Tool Name"
                field="toolName"
                activeField={sortField}
                direction={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Input
              </th>
              <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Output
              </th>
              <SortableHeader
                label="Duration"
                field="duration"
                activeField={sortField}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortableHeader
                label="Status"
                field="status"
                activeField={sortField}
                direction={sortDir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((span, idx) => (
              <tr
                key={span.id}
                className={cn(
                  'cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50',
                  selectedSpanId === span.id && 'bg-accent/50',
                )}
                onClick={() => onSelectSpan(span)}
              >
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{idx + 1}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔧</span>
                    <span className="font-medium">{span.toolName ?? span.name}</span>
                    {span.toolId && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {span.toolId}
                      </span>
                    )}
                  </div>
                </td>
                <td className="max-w-[200px] px-4 py-2">
                  {span.inputPreview ? (
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {span.inputPreview}
                    </span>
                  ) : span.input ? (
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {typeof span.input === 'string'
                        ? span.input.slice(0, 80)
                        : JSON.stringify(span.input).slice(0, 80)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="max-w-[200px] px-4 py-2">
                  {span.outputPreview ? (
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {span.outputPreview}
                    </span>
                  ) : span.output ? (
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {typeof span.output === 'string'
                        ? span.output.slice(0, 80)
                        : JSON.stringify(span.output).slice(0, 80)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs tabular-nums">
                  {formatDuration(span.duration)}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={span.status} error={span.error} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Sortable Header ---

function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onSort,
}: {
  label: string;
  field: SortField;
  activeField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = activeField === field;
  return (
    <th
      className="cursor-pointer select-none px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn('h-3 w-3', isActive ? 'text-foreground' : 'text-muted-foreground/50')}
        />
        {isActive && <span className="text-[8px]">{direction === 'asc' ? '↑' : '↓'}</span>}
      </div>
    </th>
  );
}

// --- Status Badge ---

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  switch (status) {
    case 'success':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
        >
          <CheckCircle2 className="h-3 w-3" />
          OK
        </Badge>
      );
    case 'error':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
          title={error ?? undefined}
        >
          <AlertTriangle className="h-3 w-3" />
          Error
        </Badge>
      );
    case 'running':
      return (
        <Badge
          variant="outline"
          className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {status}
        </Badge>
      );
  }
}

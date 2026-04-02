'use client';

import type {
  EscalationItem,
  EscalationPriority,
  EscalationStatus,
} from '@matanelcohen/openspace-shared';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare, Square } from 'lucide-react';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, type ListImperativeAPI } from 'react-window';

import { ConfidenceBadge } from '@/components/escalations/confidence-badge';
import { EscalationStatusBadge } from '@/components/escalations/escalation-status-badge';
import { PriorityIndicator } from '@/components/escalations/priority-indicator';
import { SlaCountdown } from '@/components/escalations/sla-countdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortField = 'priority' | 'createdAt' | 'timeoutAt' | 'confidence';
type SortDirection = 'asc' | 'desc';

interface ReviewQueueTableProps {
  escalations: EscalationItem[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

const priorityOrder: Record<EscalationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const ROW_HEIGHT = 52;
const MAX_TABLE_HEIGHT = 600;

const COL_GRID = 'grid grid-cols-[40px_1fr_1fr_100px_120px_100px_100px_140px] items-center';

interface VirtualRowProps {
  items: EscalationItem[];
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
}

const VirtualRow = function VirtualRow({
  index,
  style,
  items,
  selectedIds,
  toggleOne,
}: {
  index: number;
  style: CSSProperties;
} & VirtualRowProps) {
  const esc = items[index];
  if (!esc) return null;

  return (
    <div
      style={style}
      className={`${COL_GRID} border-b transition-colors hover:bg-muted/50 cursor-pointer`}
      data-testid={`escalation-row-${esc.id}`}
      role="row"
    >
      <div className="px-4 flex items-center" role="cell">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            toggleOne(esc.id);
          }}
          aria-label={selectedIds.has(esc.id) ? `Deselect ${esc.id}` : `Select ${esc.id}`}
        >
          {selectedIds.has(esc.id) ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="px-4 truncate" role="cell">
        <Link
          href={`/escalations/${esc.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {esc.context.agentId}
        </Link>
      </div>
      <div className="px-4 capitalize text-sm text-muted-foreground truncate" role="cell">
        {esc.reason.replace(/_/g, ' ')}
      </div>
      <div className="px-4" role="cell">
        <PriorityIndicator priority={esc.priority} />
      </div>
      <div className="px-4" role="cell">
        <EscalationStatusBadge status={esc.status} />
      </div>
      <div className="px-4" role="cell">
        <ConfidenceBadge score={esc.context.confidenceScore} />
      </div>
      <div className="px-4" role="cell">
        {esc.status === 'pending' || esc.status === 'claimed' ? (
          <SlaCountdown timeoutAt={esc.timeoutAt} />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
      <div className="px-4 text-sm text-muted-foreground whitespace-nowrap" role="cell">
        {new Date(esc.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
};

export function ReviewQueueTable({
  escalations,
  selectedIds,
  onSelectionChange,
}: ReviewQueueTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<EscalationPriority | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const listRef = useRef<ListImperativeAPI>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let items = escalations;

    if (statusFilter !== 'all') {
      items = items.filter((e) => e.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      items = items.filter((e) => e.priority === priorityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.context.agentId.toLowerCase().includes(q) ||
          e.context.proposedAction.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q),
      );
    }

    return [...items].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'priority':
          return (priorityOrder[a.priority] - priorityOrder[b.priority]) * mul;
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mul;
        case 'timeoutAt':
          return (new Date(a.timeoutAt).getTime() - new Date(b.timeoutAt).getTime()) * mul;
        case 'confidence':
          return (a.context.confidenceScore - b.context.confidenceScore) * mul;
        default:
          return 0;
      }
    });
  }, [escalations, statusFilter, priorityFilter, searchQuery, sortField, sortDir]);

  // Reset scroll position when filters or sort change
  useEffect(() => {
    if (filtered.length > 0) {
      listRef.current?.scrollToRow({ index: 0 });
    }
  }, [searchQuery, statusFilter, priorityFilter, sortField, sortDir, filtered.length, listRef]);

  const allSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filtered.map((e) => e.id)));
    }
  };

  const toggleOne = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange],
  );

  const rowProps = useMemo<VirtualRowProps>(
    () => ({ items: filtered, selectedIds, toggleOne }),
    [filtered, selectedIds, toggleOne],
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const listHeight = Math.min(MAX_TABLE_HEIGHT, filtered.length * ROW_HEIGHT);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3" data-testid="escalation-filters">
        <Input
          placeholder="Search escalations…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
          data-testid="escalation-search"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as EscalationStatus | 'all')}
        >
          <SelectTrigger className="w-[160px]" data-testid="status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="claimed">In Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="timed_out">Timed Out</SelectItem>
            <SelectItem value="auto_escalated">Auto-Escalated</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter}
          onValueChange={(v) => setPriorityFilter(v as EscalationPriority | 'all')}
        >
          <SelectTrigger className="w-[140px]" data-testid="priority-filter">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border text-sm" role="table">
        {/* Sticky Header */}
        <div className={`${COL_GRID} h-12 border-b bg-background sticky top-0 z-10`} role="row">
          <div className="px-4 flex items-center" role="columnheader">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={toggleAll}
              aria-label={allSelected ? 'Deselect all' : 'Select all'}
              data-testid="select-all"
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </Button>
          </div>
          <div className="px-4 font-medium text-muted-foreground" role="columnheader">
            Agent
          </div>
          <div className="px-4 font-medium text-muted-foreground" role="columnheader">
            Reason
          </div>
          <div className="px-4" role="columnheader">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 font-medium"
              onClick={() => handleSort('priority')}
            >
              Priority
              <SortIcon field="priority" />
            </Button>
          </div>
          <div className="px-4 font-medium text-muted-foreground" role="columnheader">
            Status
          </div>
          <div className="px-4" role="columnheader">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 font-medium"
              onClick={() => handleSort('confidence')}
            >
              Confidence
              <SortIcon field="confidence" />
            </Button>
          </div>
          <div className="px-4" role="columnheader">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 font-medium"
              onClick={() => handleSort('timeoutAt')}
            >
              SLA
              <SortIcon field="timeoutAt" />
            </Button>
          </div>
          <div className="px-4" role="columnheader">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 font-medium"
              onClick={() => handleSort('createdAt')}
            >
              Created
              <SortIcon field="createdAt" />
            </Button>
          </div>
        </div>

        {/* Virtualized Body */}
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">No escalations found.</div>
        ) : (
          <List<VirtualRowProps>
            listRef={listRef}
            rowComponent={VirtualRow}
            rowCount={filtered.length}
            rowHeight={ROW_HEIGHT}
            rowProps={rowProps}
            defaultHeight={MAX_TABLE_HEIGHT}
            style={{ height: listHeight, overflow: 'auto' }}
            overscanCount={5}
          />
        )}
      </div>
    </div>
  );
}

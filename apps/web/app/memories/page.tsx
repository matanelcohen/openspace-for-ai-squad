'use client';

import type { MemoryType } from '@matanelcohen/openspace-shared';
import { useMemo, useState } from 'react';

import { MemoryList } from '@/components/memories/memory-list';
import { MemorySearch } from '@/components/memories/memory-search';
import { MemoryToggle } from '@/components/memories/memory-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgents } from '@/hooks/use-agents';
import {
  useDeleteMemory,
  useMemories,
  useMemorySettings,
  useToggleMemoryForAgent,
  useToggleMemoryGlobal,
  useUpdateMemory,
} from '@/hooks/use-memories';

type DateRange = 'all' | '7d' | '30d' | '90d';

const dateRangeMs: Record<Exclude<DateRange, 'all'>, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

export default function MemoriesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateRange>('all');

  const { data: memories, isLoading: isLoadingMemories } = useMemories();
  const { data: settings } = useMemorySettings();
  const { data: agents } = useAgents();

  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  const toggleGlobal = useToggleMemoryGlobal();
  const toggleAgent = useToggleMemoryForAgent();

  const availableAgents = useMemo(() => {
    if (!memories) return [];
    const agentIds = new Set(memories.map((m) => m.agentId));
    return Array.from(agentIds).sort();
  }, [memories]);

  const filteredMemories = useMemo(() => {
    if (!memories) return [];
    const now = Date.now();

    return memories.filter((memory) => {
      if (typeFilter !== 'all' && memory.type !== typeFilter) return false;
      if (agentFilter !== 'all' && memory.agentId !== agentFilter) return false;
      if (dateFilter !== 'all') {
        const age = now - new Date(memory.createdAt).getTime();
        if (age > dateRangeMs[dateFilter]) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          memory.content.toLowerCase().includes(q) ||
          memory.agentId.toLowerCase().includes(q) ||
          memory.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [memories, typeFilter, agentFilter, dateFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Memories</h1>
        <p className="text-muted-foreground">
          View and manage what your agents remember across sessions.
        </p>
      </div>

      <MemoryToggle
        globalEnabled={settings?.globalEnabled ?? true}
        agentEnabled={settings?.agentEnabled ?? {}}
        agents={agents ?? []}
        onToggleGlobal={(enabled) => toggleGlobal.mutate(enabled)}
        onToggleAgent={(agentId, enabled) => toggleAgent.mutate({ agentId, enabled })}
      />

      <MemorySearch
        onSearch={setSearchQuery}
        onFilterType={setTypeFilter}
        onFilterAgent={setAgentFilter}
        onFilterDate={setDateFilter}
        availableAgents={availableAgents}
      />

      {isLoadingMemories ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <MemoryList
          memories={filteredMemories}
          onUpdate={(id, content) => updateMemory.mutate({ id, content })}
          onDelete={(id) => deleteMemory.mutate(id)}
        />
      )}
    </div>
  );
}

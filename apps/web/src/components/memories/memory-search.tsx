'use client';

import type { MemoryType } from '@openspace/shared';
import { Search } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MemorySearchProps {
  onSearch: (query: string) => void;
  onFilterType: (type: MemoryType | 'all') => void;
  onFilterAgent: (agentId: string | 'all') => void;
  onFilterDate: (range: 'all' | '7d' | '30d' | '90d') => void;
  availableAgents: string[];
}

export function MemorySearch({
  onSearch,
  onFilterType,
  onFilterAgent,
  onFilterDate,
  availableAgents,
}: MemorySearchProps) {
  const [query, setQuery] = useState('');

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      onSearch(value);
    },
    [onSearch],
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center" data-testid="memory-search">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search memories..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
          data-testid="memory-search-input"
          aria-label="Search memories"
        />
      </div>

      <div className="flex gap-2">
        <Select onValueChange={(v) => onFilterType(v as MemoryType | 'all')} defaultValue="all">
          <SelectTrigger className="w-[140px]" data-testid="memory-type-filter" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="preference">Preference</SelectItem>
            <SelectItem value="pattern">Pattern</SelectItem>
            <SelectItem value="decision">Decision</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={(v) => onFilterAgent(v)} defaultValue="all">
          <SelectTrigger className="w-[140px]" data-testid="memory-agent-filter" aria-label="Filter by agent">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {availableAgents.map((agent) => (
              <SelectItem key={agent} value={agent}>
                <span className="capitalize">{agent}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={(v) => onFilterDate(v as 'all' | '7d' | '30d' | '90d')} defaultValue="all">
          <SelectTrigger className="w-[140px]" data-testid="memory-date-filter" aria-label="Filter by date">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

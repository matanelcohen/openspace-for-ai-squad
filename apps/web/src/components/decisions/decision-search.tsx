import type { DecisionStatus } from '@openspace/shared';
import { Search, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DecisionSearchProps {
  onSearch: (query: string) => void;
  onFilterStatus: (status: DecisionStatus | 'all') => void;
  onFilterAgent: (agent: string | 'all') => void;
  availableAgents: string[];
}

export function DecisionSearch({
  onSearch,
  onFilterStatus,
  onFilterAgent,
  availableAgents,
}: DecisionSearchProps) {
  const [query, setQuery] = useState('');

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  return (
    <div className="space-y-4" data-testid="decision-search">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search decisions..."
          className="pl-10 pr-10"
          data-testid="search-input"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
            onClick={handleClear}
            data-testid="clear-button"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select onValueChange={onFilterStatus} defaultValue="all">
          <SelectTrigger className="w-[180px]" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="superseded">Superseded</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={onFilterAgent} defaultValue="all">
          <SelectTrigger className="w-[180px]" data-testid="agent-filter">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {availableAgents.map((agent) => (
              <SelectItem key={agent} value={agent}>
                {agent.charAt(0).toUpperCase() + agent.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

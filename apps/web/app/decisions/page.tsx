'use client';

import type { DecisionStatus } from '@openspace/shared';
import { useMemo,useState } from 'react';

import { DecisionList } from '@/components/decisions/decision-list';
import { DecisionSearch } from '@/components/decisions/decision-search';
import { Skeleton } from '@/components/ui/skeleton';
import { useDecisionSearch } from '@/hooks/use-decision-search';
import { useDecisions } from '@/hooks/use-decisions';

export default function DecisionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');

  const { data: allDecisions, isLoading: isLoadingAll } = useDecisions();
  const { data: searchResults, isLoading: isSearching } = useDecisionSearch(searchQuery);

  const decisions = searchQuery.trim() ? searchResults : allDecisions;
  const isLoading = searchQuery.trim() ? isSearching : isLoadingAll;

  const availableAgents = useMemo(() => {
    if (!allDecisions) return [];
    const agents = new Set(allDecisions.map((d) => d.author));
    return Array.from(agents).sort();
  }, [allDecisions]);

  const filteredDecisions = useMemo(() => {
    if (!decisions) return [];

    return decisions.filter((decision) => {
      if (statusFilter !== 'all' && decision.status !== statusFilter) {
        return false;
      }
      if (agentFilter !== 'all' && decision.author !== agentFilter) {
        return false;
      }
      return true;
    });
  }, [decisions, statusFilter, agentFilter]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Decisions</h1>
        <p className="text-muted-foreground">
          Browse and search architectural decisions made by the team.
        </p>
      </div>

      <DecisionSearch
        onSearch={setSearchQuery}
        onFilterStatus={setStatusFilter}
        onFilterAgent={setAgentFilter}
        availableAgents={availableAgents}
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <DecisionList decisions={filteredDecisions} />
      )}
    </div>
  );
}

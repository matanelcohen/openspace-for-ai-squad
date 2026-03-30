import type { Decision } from '@matanelcohen/openspace-shared';

import { DecisionCard } from './decision-card';

interface DecisionListProps {
  decisions: Decision[];
}

export function DecisionList({ decisions }: DecisionListProps) {
  if (decisions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-state">
        No decisions found.
      </div>
    );
  }

  // Sort by date, newest first
  const sortedDecisions = [...decisions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-4" data-testid="decision-list">
      {sortedDecisions.map((decision) => (
        <DecisionCard key={decision.id} decision={decision} />
      ))}
    </div>
  );
}

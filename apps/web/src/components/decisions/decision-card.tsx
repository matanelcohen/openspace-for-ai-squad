import type { Decision } from '@openspace/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { DecisionStatusBadge } from './decision-status-badge';

interface DecisionCardProps {
  decision: Decision;
}

export function DecisionCard({ decision }: DecisionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card data-testid="decision-card" data-decision-id={decision.id}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <AgentAvatar agentId={decision.author} name={decision.author} size="sm" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{decision.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span className="capitalize">{decision.author}</span>
                <span>•</span>
                <span>{new Date(decision.date).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DecisionStatusBadge status={decision.status} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="expand-button"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4" data-testid="expanded-content">
          <div>
            <h4 className="font-semibold mb-2">Rationale</h4>
            <p className="text-sm text-muted-foreground">{decision.rationale}</p>
          </div>
          {decision.affectedFiles.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Affected Files</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {decision.affectedFiles.map((file, index) => (
                  <li key={index} className="font-mono text-xs">
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

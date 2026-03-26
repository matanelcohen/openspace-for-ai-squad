'use client';

import { Check, Wrench, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkillDetail } from '@/hooks/use-skills';

interface SkillDetailToolsProps {
  skill: SkillDetail;
}

export function SkillDetailTools({ skill }: SkillDetailToolsProps) {
  const { manifest } = skill;

  return (
    <div className="space-y-4" data-testid="skill-detail-tools">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {manifest.tools.length} tool{manifest.tools.length !== 1 ? 's' : ''} declared
        </p>
      </div>

      {manifest.tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">This skill does not declare any tool dependencies.</p>
      ) : (
        <div className="space-y-3">
          {manifest.tools.map((tool) => {
            const isAvailable = manifest.toolAvailability?.[tool.toolId];
            return (
              <Card key={tool.toolId}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span className="font-mono">{tool.toolId}</span>
                      {tool.optional && (
                        <Badge variant="outline" className="text-xs">
                          optional
                        </Badge>
                      )}
                      {isAvailable !== undefined && (
                        isAvailable ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" /> Available
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <X className="h-3 w-3" /> Unavailable
                          </span>
                        )
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                {(tool.reason || tool.versionRange) && (
                  <CardContent className="pt-0 pb-3">
                    {tool.reason && (
                      <p className="text-sm text-muted-foreground">{tool.reason}</p>
                    )}
                    {tool.versionRange && (
                      <p className="text-xs font-mono text-muted-foreground mt-1">
                        Version: {tool.versionRange}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

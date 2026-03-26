'use client';

import { AlertTriangle, Check, Link2, Package } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkillDetail } from '@/hooks/use-skills';

interface SkillDetailDependenciesProps {
  skill: SkillDetail;
}

export function SkillDetailDependencies({ skill }: SkillDetailDependenciesProps) {
  const { manifest } = skill;
  const deps = manifest.dependencies ?? [];
  const resolvedDeps = manifest.resolvedDependencies ?? {};

  return (
    <div className="space-y-4" data-testid="skill-detail-deps">
      <p className="text-sm text-muted-foreground">
        {deps.length} dependenc{deps.length !== 1 ? 'ies' : 'y'}
      </p>

      {deps.length === 0 ? (
        <p className="text-sm text-muted-foreground">This skill has no dependencies on other skills.</p>
      ) : (
        <div className="space-y-3">
          {deps.map((dep) => {
            const resolvedVersion = resolvedDeps[dep.skillId];
            const isResolved = !!resolvedVersion;

            return (
              <Card key={dep.skillId}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span className="font-mono">{dep.skillId}</span>
                      {dep.optional && (
                        <Badge variant="outline" className="text-xs">
                          optional
                        </Badge>
                      )}
                      {isResolved ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Check className="h-3 w-3" /> v{resolvedVersion}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Unresolved
                        </span>
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                {dep.versionRange && (
                  <CardContent className="pt-0 pb-3">
                    <p className="text-xs font-mono text-muted-foreground">
                      Required: {dep.versionRange}
                    </p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Source path */}
      {manifest.sourcePath && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4" />
              Source Path
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono text-muted-foreground break-all">
              {manifest.sourcePath}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

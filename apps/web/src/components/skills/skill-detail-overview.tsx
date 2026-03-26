'use client';

import { Package, Shield, Tag, Terminal, Users, Variable } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkillDetail } from '@/hooks/use-skills';

import { SkillIcon } from './skill-icon';
import { SkillPhaseBadge } from './skill-phase-badge';

interface SkillDetailOverviewProps {
  skill: SkillDetail;
}

export function SkillDetailOverview({ skill }: SkillDetailOverviewProps) {
  const { manifest } = skill;
  const manifestAny = manifest as unknown as Record<string, unknown>;
  const agentMatch = manifestAny.agentMatch as { roles?: string[] } | undefined;
  const requires = manifestAny.requires as { bins?: string[]; env?: string[] } | undefined;
  const roles = agentMatch?.roles ?? [];
  const bins = requires?.bins ?? [];
  const env = requires?.env ?? [];

  return (
    <div className="space-y-6" data-testid="skill-detail-overview">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SkillIcon icon={manifest.icon} className="h-7 w-7" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{manifest.name}</h2>
            <SkillPhaseBadge phase={skill.phase} />
          </div>
          <p className="text-muted-foreground">{manifest.description}</p>
        </div>
      </div>

      {/* Metadata Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {manifest.version && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                Version
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">v{manifest.version}</p>
            </CardContent>
          </Card>
        )}

        {roles.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Agent Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role === '*' ? 'All agents' : role}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(bins.length > 0 || env.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4" />
                Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bins.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {bins.map((bin) => (
                    <Badge key={bin} variant="outline" className="font-mono text-xs">
                      {bin}
                    </Badge>
                  ))}
                </div>
              )}
              {env.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Variable className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {env.map((e) => (
                    <Badge key={e} variant="outline" className="font-mono text-xs">
                      {e}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tags */}
      {manifest.tags && manifest.tags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Tag className="h-4 w-4" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {manifest.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

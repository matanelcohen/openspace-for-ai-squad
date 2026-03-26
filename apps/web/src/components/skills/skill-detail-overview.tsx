'use client';

import { ExternalLink, FileCode, Package, Shield, Tag, User } from 'lucide-react';

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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4" />
              Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">v{manifest.version}</p>
            {manifest.license && (
              <p className="text-sm text-muted-foreground">{manifest.license}</p>
            )}
          </CardContent>
        </Card>

        {manifest.author && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                Author
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{manifest.author}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileCode className="h-4 w-4" />
              Entry Point
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono text-muted-foreground">
              {manifest.entryPoint ?? 'Declarative (no entry point)'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tags */}
      {manifest.tags && manifest.tags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Tag className="h-4 w-4" />
              Capability Tags
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

      {/* Permissions */}
      {manifest.permissions && manifest.permissions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4" />
              Required Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {manifest.permissions.map((perm) => (
                <Badge key={perm} variant="outline" className="font-mono text-xs">
                  {perm}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Homepage link */}
      {manifest.homepage && (
        <a
          href={manifest.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Documentation
        </a>
      )}
    </div>
  );
}

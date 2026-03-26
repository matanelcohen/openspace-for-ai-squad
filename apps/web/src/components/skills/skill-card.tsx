'use client';

import { Terminal, Users } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import type { SkillSummary } from '@/hooks/use-skills';

import { SkillIcon } from './skill-icon';
import { SkillPhaseBadge } from './skill-phase-badge';

interface SkillCardProps {
  skill: SkillSummary;
}

export function SkillCard({ skill }: SkillCardProps) {
  return (
    <Link href={`/skills/${skill.id}`} data-testid={`skill-card-${skill.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SkillIcon icon={skill.icon} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold leading-none truncate">{skill.name}</h3>
              <SkillPhaseBadge phase={skill.phase} />
            </div>
            <p className="text-xs text-muted-foreground">v{skill.version}</p>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{skill.description}</p>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 pt-0">
          {(skill.matchedRoles?.length || skill.requiredBins?.length) && (
            <div className="flex flex-wrap gap-1">
              {skill.matchedRoles?.map((role) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role}
                </Badge>
              ))}
              {skill.requiredBins?.map((bin) => (
                <Badge key={bin} variant="secondary" className="gap-1 text-xs">
                  <Terminal className="h-3 w-3" />
                  {bin}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {skill.tags?.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {(skill.tags?.length ?? 0) > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{(skill.tags?.length ?? 0) - 3}
                </Badge>
              )}
            </div>
            {skill.activeAgentCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Active agents">
                <Users className="h-3 w-3" />
                <span>{skill.activeAgentCount}</span>
              </div>
            )}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

'use client';

import { Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import type { WizardFormState } from '@/hooks/use-skill-manifest-form';

import { SkillIcon } from './skill-icon';

interface SkillCardPreviewProps {
  state: WizardFormState;
}

export function SkillCardPreview({ state }: SkillCardPreviewProps) {
  return (
    <div className="space-y-3" data-testid="skill-card-preview">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Card Preview
      </p>

      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SkillIcon icon={state.icon || undefined} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold leading-none truncate">
                {state.name || 'Skill Name'}
              </h3>
              <Badge
                variant="outline"
                className="border-0 font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              >
                Draft
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              v{state.version || '0.1.0'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {state.description || 'Skill description will appear here...'}
          </p>
        </CardContent>
        <CardFooter className="flex items-center justify-between pt-0">
          <div className="flex flex-wrap gap-1">
            {state.tags.length > 0 ? (
              <>
                {state.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {state.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{state.tags.length - 3}
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">No tags</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Active agents">
            <Users className="h-3 w-3" />
            <span>0</span>
          </div>
        </CardFooter>
      </Card>

      {/* Manifest summary */}
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Summary
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-muted-foreground">ID</div>
          <div className="font-mono">{state.id || '—'}</div>
          <div className="text-muted-foreground">Tools</div>
          <div>{state.tools.length} declared</div>
          <div className="text-muted-foreground">Triggers</div>
          <div>{state.triggers.length} rules</div>
          <div className="text-muted-foreground">Prompts</div>
          <div>{state.prompts.length} templates</div>
          <div className="text-muted-foreground">Config</div>
          <div>{state.config.length} parameters</div>
          {state.author && (
            <>
              <div className="text-muted-foreground">Author</div>
              <div>{state.author}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

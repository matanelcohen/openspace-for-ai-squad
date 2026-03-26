'use client';

import { FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkillDetail } from '@/hooks/use-skills';

interface SkillDetailPromptsProps {
  skill: SkillDetail;
}

const roleBadgeColors: Record<string, string> = {
  system: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  planning: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  execution: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  handoff: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export function SkillDetailPrompts({ skill }: SkillDetailPromptsProps) {
  const { manifest } = skill;

  return (
    <div className="space-y-4" data-testid="skill-detail-prompts">
      <p className="text-sm text-muted-foreground">
        {manifest.prompts.length} prompt template{manifest.prompts.length !== 1 ? 's' : ''}
      </p>

      {manifest.prompts.length === 0 ? (
        <p className="text-sm text-muted-foreground">This skill does not define any prompt templates.</p>
      ) : (
        <div className="space-y-4">
          {manifest.prompts.map((prompt) => (
            <Card key={prompt.id}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span>{prompt.name}</span>
                    <Badge
                      variant="outline"
                      className={`border-0 text-xs ${roleBadgeColors[prompt.role] ?? ''}`}
                    >
                      {prompt.role}
                    </Badge>
                    {prompt.maxTokens && (
                      <span className="text-xs text-muted-foreground">
                        max {prompt.maxTokens} tokens
                      </span>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 pb-3">
                <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {prompt.content}
                </pre>
                {prompt.variables && prompt.variables.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {prompt.variables.map((v) => (
                        <Badge key={v.name} variant="secondary" className="text-xs font-mono">
                          {'{{'}
                          {v.name}
                          {'}}'}
                          {v.required && <span className="text-red-500 ml-0.5">*</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

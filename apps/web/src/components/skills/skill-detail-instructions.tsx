'use client';

import { FileText } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkillDetail } from '@/hooks/use-skills';

interface SkillDetailInstructionsProps {
  skill: SkillDetail;
}

export function SkillDetailInstructions({ skill }: SkillDetailInstructionsProps) {
  const instructions = (skill.manifest as unknown as Record<string, unknown>).instructions as
    | string
    | undefined;

  return (
    <div className="space-y-4" data-testid="skill-detail-instructions">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Skill Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {instructions ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm font-mono overflow-y-auto max-h-[600px]">
                {instructions}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No instructions defined for this skill.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

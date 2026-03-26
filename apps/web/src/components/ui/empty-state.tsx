'use client';

import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  'data-testid'?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  'data-testid': testId = 'empty-state',
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-8 text-center"
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} data-testid="empty-state-action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

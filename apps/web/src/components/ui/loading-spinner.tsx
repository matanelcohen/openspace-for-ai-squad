'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  'data-testid'?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function LoadingSpinner({
  size = 'md',
  message,
  'data-testid': testId = 'loading-spinner',
}: LoadingSpinnerProps) {
  return (
    <div data-testid={testId} className="flex flex-col items-center justify-center gap-2 p-4">
      <Loader2 className={`animate-spin text-muted-foreground ${sizeClasses[size]}`} />
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

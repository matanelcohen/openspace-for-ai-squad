'use client';

import { memo, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface SlaCountdownProps {
  timeoutAt: string;
  className?: string;
}

function getTimeRemaining(timeoutAt: string): number {
  return new Date(timeoutAt).getTime() - Date.now();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function getUrgencyClass(ms: number): string {
  if (ms <= 0) return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
  if (ms < 5 * 60 * 1000) return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
  if (ms < 15 * 60 * 1000)
    return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
  if (ms < 60 * 60 * 1000)
    return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
  return 'text-muted-foreground bg-muted';
}

export const SlaCountdown = memo(
  function SlaCountdown({ timeoutAt, className }: SlaCountdownProps) {
    const [remaining, setRemaining] = useState(() => getTimeRemaining(timeoutAt));
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
      setRemaining(getTimeRemaining(timeoutAt));

      // Clear any previous interval before starting a new one
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        const ms = getTimeRemaining(timeoutAt);
        setRemaining(ms);
        if (ms <= 0 && intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 1000);

      return () => {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [timeoutAt]);

    const urgencyClass = getUrgencyClass(remaining);

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
          urgencyClass,
          remaining <= 0 && 'animate-pulse',
          className,
        )}
        data-testid="sla-countdown"
        data-remaining={remaining}
      >
        {remaining > 0 ? (
          <>
            <svg
              className="h-3 w-3"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {formatCountdown(remaining)}
          </>
        ) : (
          'Expired'
        )}
      </span>
    );
  },
  (prev, next) => prev.timeoutAt === next.timeoutAt && prev.className === next.className,
);

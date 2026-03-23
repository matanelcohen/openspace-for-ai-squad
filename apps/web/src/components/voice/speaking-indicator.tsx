import { cn } from '@/lib/utils';

interface SpeakingIndicatorProps {
  isActive: boolean;
  className?: string;
}

export function SpeakingIndicator({ isActive, className }: SpeakingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-1 h-8', className)} data-testid="speaking-indicator">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'w-1 bg-primary rounded-full transition-all',
            isActive ? 'animate-wave' : 'h-2'
          )}
          style={{
            animationDelay: isActive ? `${i * 0.1}s` : '0s',
            height: isActive ? undefined : '8px',
          }}
          data-testid={`wave-bar-${i}`}
        />
      ))}
    </div>
  );
}

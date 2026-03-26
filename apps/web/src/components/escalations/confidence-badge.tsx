import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  score: number;
  className?: string;
}

function getConfidenceColor(score: number): string {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
  if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
  return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
}

export function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100);
  const colorClass = getConfidenceColor(score);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        colorClass,
        className,
      )}
      data-testid="confidence-badge"
    >
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
        <circle
          cx="8"
          cy="8"
          r="7"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={`${score * 44} 44`}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
        />
      </svg>
      {percentage}%
    </div>
  );
}

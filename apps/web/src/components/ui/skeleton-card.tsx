import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface SkeletonCardProps {
  lines?: number;
  'data-testid'?: string;
}

export function SkeletonCard({
  lines = 3,
  'data-testid': testId = 'skeleton-card',
}: SkeletonCardProps) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

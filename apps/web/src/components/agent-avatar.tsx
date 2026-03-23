import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const agentColors: Record<string, string> = {
  leela: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  bender: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  fry: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  zoidberg: 'bg-green-500/20 text-green-700 dark:text-green-400',
};

const agentEmoji: Record<string, string> = {
  leela: '👁️',
  bender: '🤖',
  fry: '🍕',
  zoidberg: '🦀',
};

interface AgentAvatarProps {
  agentId: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export function AgentAvatar({ agentId, name, size = 'md', className }: AgentAvatarProps) {
  const colorClass = agentColors[agentId.toLowerCase()] ?? 'bg-muted text-muted-foreground';
  const emoji = agentEmoji[agentId.toLowerCase()];
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback className={cn(colorClass, sizeClasses[size])}>
        {emoji ?? initials}
      </AvatarFallback>
    </Avatar>
  );
}

'use client';

import type { TaskAssigneeType } from '@matanelcohen/openspace-shared';
import Link from 'next/link';

import { AgentAvatar } from '@/components/agent-avatar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const sizeClasses = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface AssigneeAvatarProps {
  assignee: string;
  assigneeType: TaskAssigneeType;
  /** Display name (used for initials when type is 'member'). Falls back to assignee ID. */
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** When true, wraps member avatars in a link to the member detail page. */
  linked?: boolean;
}

export function AssigneeAvatar({
  assignee,
  assigneeType,
  name,
  size = 'md',
  className,
  linked,
}: AssigneeAvatarProps) {
  if (assigneeType === 'agent') {
    return <AgentAvatar agentId={assignee} name={name ?? assignee} size={size} className={className} />;
  }

  const displayName = name ?? assignee;
  const avatar = (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback className={cn('bg-teal-500/20 text-teal-700 dark:text-teal-400', sizeClasses[size])}>
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );

  if (linked) {
    return (
      <Link href={`/team-members/${assignee}`} onClick={(e) => e.stopPropagation()}>
        {avatar}
      </Link>
    );
  }

  return avatar;
}

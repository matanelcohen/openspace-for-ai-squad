import { AgentAvatar } from '@/components/agent-avatar';
import { cn } from '@/lib/utils';

import { SpeakingIndicator } from './speaking-indicator';

interface AgentCircleProps {
  agentId: string;
  isSpeaking: boolean;
  className?: string;
}

const agentColors = {
  leela: 'purple',
  bender: 'orange',
  fry: 'blue',
  zoidberg: 'green',
} as const;

export function AgentCircle({ agentId, isSpeaking, className }: AgentCircleProps) {
  const color = agentColors[agentId as keyof typeof agentColors] || 'gray';

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-lg transition-all',
        isSpeaking && 'animate-pulse ring-4 ring-primary/50',
        className,
      )}
      data-testid="agent-circle"
      data-agent-id={agentId}
      data-speaking={isSpeaking}
    >
      <div className="relative">
        <AgentAvatar agentId={agentId} name={agentId} size="lg" />
        {isSpeaking && (
          <div
            className={cn(
              'absolute -inset-2 rounded-full blur-md opacity-75',
              color === 'purple' && 'bg-purple-500',
              color === 'orange' && 'bg-orange-500',
              color === 'blue' && 'bg-blue-500',
              color === 'green' && 'bg-green-500',
            )}
            data-testid="glow-effect"
          />
        )}
      </div>
      <span className="text-sm font-medium capitalize">{agentId}</span>
      <SpeakingIndicator isActive={isSpeaking} />
    </div>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AgentSelectorProps {
  availableAgents: string[];
  selectedAgent: string | null;
  onSelectAgent: (agentId: string | null) => void;
  disabled?: boolean;
}

export function AgentSelector({
  availableAgents,
  selectedAgent,
  onSelectAgent,
  disabled = false,
}: AgentSelectorProps) {
  return (
    <Select
      value={selectedAgent || 'team'}
      onValueChange={(value) => onSelectAgent(value === 'team' ? null : value)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px]" data-testid="agent-selector">
        <SelectValue placeholder="Select agent" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="team" data-testid="agent-option-team">
          Team (All)
        </SelectItem>
        {availableAgents.map((agentId) => (
          <SelectItem
            key={agentId}
            value={agentId}
            data-testid={`agent-option-${agentId}`}
          >
            {agentId.charAt(0).toUpperCase() + agentId.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

'use client';

import type { Agent } from '@matanelcohen/openspace-shared';
import { Power } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MemoryToggleProps {
  globalEnabled: boolean;
  agentEnabled: Record<string, boolean>;
  agents: Agent[];
  onToggleGlobal: (enabled: boolean) => void;
  onToggleAgent: (agentId: string, enabled: boolean) => void;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  testId?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        checked ? 'bg-primary' : 'bg-input'
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function MemoryToggle({
  globalEnabled,
  agentEnabled,
  agents,
  onToggleGlobal,
  onToggleAgent,
}: MemoryToggleProps) {
  return (
    <Card data-testid="memory-toggle">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Memory Settings</CardTitle>
          </div>
          <ToggleSwitch
            checked={globalEnabled}
            onChange={onToggleGlobal}
            label="Toggle memory globally"
            testId="global-memory-toggle"
          />
        </div>
        <CardDescription>
          {globalEnabled
            ? 'Memory is enabled. Agents will remember context across sessions.'
            : 'Memory is disabled globally. No memories will be stored or recalled.'}
        </CardDescription>
      </CardHeader>
      {globalEnabled && agents.length > 0 && (
        <CardContent>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Per-agent settings
            </p>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
                data-testid={`agent-toggle-${agent.id}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{agent.role}</span>
                </div>
                <ToggleSwitch
                  checked={agentEnabled[agent.id] ?? true}
                  onChange={(enabled) => onToggleAgent(agent.id, enabled)}
                  label={`Toggle memory for ${agent.name}`}
                  testId={`agent-memory-toggle-${agent.id}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

'use client';

import { Loader2, Plus, Rocket, Trash2, Users } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useInitSquad } from '@/hooks/use-workspaces';

// ── Types ───────────────────────────────────────────────────────────

interface AgentEntry {
  name: string;
  role: string;
}

interface SquadInitWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

// ── Presets ──────────────────────────────────────────────────────────

const PRESETS: Record<string, AgentEntry[]> = {
  'Small Team (2)': [
    { name: 'Lead Agent', role: 'Lead' },
    { name: 'Dev Agent', role: 'Full-Stack Dev' },
  ],
  'Standard Team (4)': [
    { name: 'Lead Agent', role: 'Lead' },
    { name: 'Frontend Agent', role: 'Frontend Dev' },
    { name: 'Backend Agent', role: 'Backend Dev' },
    { name: 'Test Agent', role: 'Tester' },
  ],
  'Full Team (6)': [
    { name: 'Lead Agent', role: 'Lead' },
    { name: 'Frontend Agent', role: 'Frontend Dev' },
    { name: 'Backend Agent', role: 'Backend Dev' },
    { name: 'Test Agent', role: 'Tester' },
    { name: 'DevOps Agent', role: 'DevOps' },
    { name: 'Docs Agent', role: 'Technical Writer' },
  ],
};

const DEFAULT_AGENTS = PRESETS['Standard Team (4)']!;

// ── Component ───────────────────────────────────────────────────────

export function SquadInitWizard({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: SquadInitWizardProps) {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [teamName, setTeamName] = useState(workspaceName);
  const [description, setDescription] = useState('');
  const [stack, setStack] = useState('');

  // Step 2 state
  const [agents, setAgents] = useState<AgentEntry[]>(() =>
    DEFAULT_AGENTS.map((a) => ({ ...a })),
  );

  const initSquad = useInitSquad();

  const handleAddAgent = useCallback(() => {
    setAgents((prev) => [...prev, { name: '', role: '' }]);
  }, []);

  const handleRemoveAgent = useCallback((index: number) => {
    setAgents((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAgentChange = useCallback(
    (index: number, field: 'name' | 'role', value: string) => {
      setAgents((prev) =>
        prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
      );
    },
    [],
  );

  const handlePreset = useCallback((presetName: string) => {
    const preset = PRESETS[presetName];
    if (preset) {
      setAgents(preset.map((a) => ({ ...a })));
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const validAgents = agents.filter((a) => a.name.trim() && a.role.trim());
    if (!teamName.trim() || validAgents.length === 0) return;

    initSquad.mutate(
      {
        workspaceId,
        teamName: teamName.trim(),
        description: description.trim() || undefined,
        stack: stack.trim() || undefined,
        agents: validAgents,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          window.location.reload();
        },
      },
    );
  }, [agents, teamName, description, stack, workspaceId, initSquad, onOpenChange]);

  const canProceedStep1 = teamName.trim().length > 0;
  const validAgents = agents.filter((a) => a.name.trim() && a.role.trim());
  const canProceedStep2 = validAgents.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {/* Step 0: Team Info */}
        {step === 0 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Team Info
              </DialogTitle>
              <DialogDescription>
                Set up your squad&apos;s identity. Only the team name is required.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="team-name" className="text-sm font-medium">
                  Team Name *
                </label>
                <Input
                  id="team-name"
                  placeholder="My Project"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="description"
                  placeholder="A brief description of your project..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="stack" className="text-sm font-medium">
                  Tech Stack
                </label>
                <Input
                  id="stack"
                  placeholder="React, Node.js, TypeScript"
                  value={stack}
                  onChange={(e) => setStack(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated. Helps tailor agent expertise.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setStep(1)}
                disabled={!canProceedStep1}
              >
                Next: Team Members
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 1: Team Members */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </DialogTitle>
              <DialogDescription>
                Configure your squad agents. Each needs a name and role.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {Object.keys(PRESETS).map((presetName) => (
                  <Button
                    key={presetName}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreset(presetName)}
                  >
                    {presetName}
                  </Button>
                ))}
              </div>

              {/* Agent rows */}
              <div className="space-y-3">
                {agents.map((agent, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Name"
                      value={agent.name}
                      onChange={(e) => handleAgentChange(index, 'name', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Role"
                      value={agent.role}
                      onChange={(e) => handleAgentChange(index, 'role', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAgent(index)}
                      disabled={agents.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={handleAddAgent}>
                <Plus className="mr-1 h-4 w-4" />
                Add Agent
              </Button>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedStep2}
              >
                Next: Confirm
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Confirm */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Confirm &amp; Create
              </DialogTitle>
              <DialogDescription>
                Review your squad configuration before initializing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Team</p>
                  <p className="text-sm text-muted-foreground">{teamName}</p>
                </div>

                {description && (
                  <div>
                    <p className="text-sm font-medium">Description</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                )}

                {stack && (
                  <div>
                    <p className="text-sm font-medium">Stack</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {stack.split(',').map((s) => (
                        <Badge key={s.trim()} variant="secondary">
                          {s.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">
                    Agents ({validAgents.length})
                  </p>
                  <div className="space-y-1">
                    {validAgents.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm rounded px-2 py-1 bg-muted/50"
                      >
                        <span className="font-medium">{a.name}</span>
                        <Badge variant="outline">{a.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">What will be created:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><code>.squad/team.md</code> — team roster</li>
                  <li><code>.squad/config.json</code> — squad configuration</li>
                  <li><code>.squad/agents/*/charter.md</code> — agent charters</li>
                  <li><code>.squad/tasks/</code> — task directory</li>
                  <li><code>.squad/sessions/</code> — session logs</li>
                </ul>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={initSquad.isPending}
              >
                {initSquad.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing…
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    Initialize Squad
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

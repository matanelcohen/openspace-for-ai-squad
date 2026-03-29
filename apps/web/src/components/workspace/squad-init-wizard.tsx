'use client';

import { Loader2, Plus, Rocket, Sparkles, Trash2, Users } from 'lucide-react';
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
import { useInitSquad, useAnalyzeWorkspace } from '@/hooks/use-workspaces';

// ── Types ───────────────────────────────────────────────────────────

interface AgentEntry {
  name: string;
  role: string;
  personality?: string;
  backstory?: string;
}

interface SquadInitWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

const DEFAULT_AGENTS: AgentEntry[] = [
  { name: 'Lead Agent', role: 'Lead' },
  { name: 'Frontend Agent', role: 'Frontend Dev' },
  { name: 'Backend Agent', role: 'Backend Dev' },
  { name: 'Test Agent', role: 'Tester' },
];

// ── Component ───────────────────────────────────────────────────────

export function SquadInitWizard({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: SquadInitWizardProps) {
  const [step, setStep] = useState(0);

  // Step 0 state
  const [teamName, setTeamName] = useState(workspaceName);
  const [description, setDescription] = useState('');
  const [stack, setStack] = useState('');
  const [theme, setTheme] = useState('');

  // Step 1 state
  const [agents, setAgents] = useState<AgentEntry[]>(() =>
    DEFAULT_AGENTS.map((a) => ({ ...a })),
  );

  const initSquad = useInitSquad();
  const analyzeWorkspace = useAnalyzeWorkspace();

  const handleAutoDetect = useCallback(() => {
    analyzeWorkspace.mutate(
      {
        workspaceId,
        teamName: teamName.trim() || undefined,
        description: description.trim() || undefined,
        stack: stack.trim() || undefined,
        theme: theme.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          if (data.teamName) setTeamName(data.teamName);
          if (data.description) setDescription(data.description);
          if (data.stack) setStack(data.stack);
          if (data.agents?.length) setAgents(data.agents.map((a) => ({ ...a })));
          setStep(1);
        },
      },
    );
  }, [workspaceId, analyzeWorkspace, theme]);

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

  const handleSubmit = useCallback(() => {
    const validAgents = agents.filter((a) => a.name.trim() && a.role.trim());
    if (!teamName.trim() || validAgents.length === 0) return;

    setStep(3); // Show building step

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
          // Small delay so user sees "Done!" before reload
          setTimeout(() => {
            onOpenChange(false);
            window.location.reload();
          }, 1000);
        },
        onError: () => {
          setStep(2); // Go back to confirm on error
        },
      },
    );
  }, [agents, teamName, description, stack, workspaceId, initSquad, onOpenChange]);

  const canProceedStep1 = teamName.trim().length > 0;
  const validAgents = agents.filter((a) => a.name.trim() && a.role.trim());
  const canProceedStep2 = validAgents.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!initSquad.isPending) onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" onPointerDownOutside={(e) => { if (initSquad.isPending) e.preventDefault(); }}>
        {/* Step 3: Building */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            {initSquad.isPending ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <h2 className="text-lg font-semibold">Building your squad…</h2>
                <p className="text-sm text-muted-foreground text-center">
                  Creating agent charters, team roster, and project config via Squad SDK.
                </p>
              </>
            ) : initSquad.isSuccess ? (
              <>
                <Rocket className="h-12 w-12 text-green-500" />
                <h2 className="text-lg font-semibold">Squad ready!</h2>
                <p className="text-sm text-muted-foreground">Reloading…</p>
              </>
            ) : (
              <>
                <Rocket className="h-12 w-12 text-destructive" />
                <h2 className="text-lg font-semibold">Something went wrong</h2>
                <p className="text-sm text-destructive">{initSquad.error?.message}</p>
              </>
            )}
          </div>
        )}

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

              <div className="space-y-2">
                <label htmlFor="theme" className="text-sm font-medium">
                  🎭 Team Theme
                </label>
                <Input
                  id="theme"
                  placeholder="e.g. Marvel heroes, Star Wars, Pirates, Anime characters..."
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. The AI will name agents to match your theme.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                className="w-full"
                onClick={handleAutoDetect}
                disabled={analyzeWorkspace.isPending || !canProceedStep1}
              >
                {analyzeWorkspace.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing project…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    ✨ Analyze & Build Team
                  </>
                )}
              </Button>
            </DialogFooter>

            {analyzeWorkspace.isError && (
              <p className="text-sm text-destructive">
                Auto-detect failed. You can still fill in the fields manually.
              </p>
            )}
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
                Review and edit your squad agents. Each needs a name and role.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Agent rows */}
              <div className="space-y-3">
                {agents.map((agent, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-2">
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
                    {agent.personality && (
                      <p className="text-xs text-muted-foreground italic pl-1">
                        {agent.personality}
                      </p>
                    )}
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

                {theme && (
                  <div>
                    <p className="text-sm font-medium">Theme</p>
                    <Badge variant="outline">🎭 {theme}</Badge>
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
                        <div>
                          <span className="font-medium">{a.name}</span>
                          {a.personality && (
                            <p className="text-xs text-muted-foreground italic">{a.personality}</p>
                          )}
                        </div>
                        <Badge variant="outline">{a.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">What will be created (via Squad SDK):</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><code>.squad/team.md</code> — team roster</li>
                  <li><code>.squad/squad.agent.md</code> — squad agent config</li>
                  <li><code>.squad/agents/*/charter.md</code> — agent charters</li>
                  <li><code>.squad/tasks/</code> — task directory</li>
                  <li><code>.squad/templates/</code> — SDK templates</li>
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

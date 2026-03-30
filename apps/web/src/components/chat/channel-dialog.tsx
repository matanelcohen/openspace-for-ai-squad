'use client';

import type { Agent, ChatChannel } from '@matanelcohen/openspace-shared';
import { useEffect, useState } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
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
import { cn } from '@/lib/utils';

interface ChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing channel to enter edit mode. */
  channel?: ChatChannel | null;
  agents: Agent[];
  onSave: (data: { name: string; description: string; memberAgentIds: string[] }) => void;
  isSaving?: boolean;
}

export function ChannelDialog({
  open,
  onOpenChange,
  channel,
  agents,
  onSave,
  isSaving,
}: ChannelDialogProps) {
  const isEdit = !!channel;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // Reset form when dialog opens or channel changes
  useEffect(() => {
    if (open) {
      setName(channel?.name ?? '');
      setDescription(channel?.description ?? '');
      setMemberIds(channel?.memberAgentIds ?? []);
    }
  }, [open, channel]);

  const toggleMember = (agentId: string) => {
    setMemberIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave({ name: trimmedName, description: description.trim(), memberAgentIds: memberIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="channel-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Channel' : 'Create Channel'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update the channel details and members.'
                : 'Create a new channel for your team.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Channel name */}
            <div className="space-y-2">
              <label htmlFor="channel-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="channel-name"
                data-testid="channel-name-input"
                placeholder="e.g. Frontend, Backend, Design"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSaving}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="channel-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="channel-description"
                data-testid="channel-description-input"
                placeholder="What is this channel about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving}
                rows={2}
              />
            </div>

            {/* Member picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Members{' '}
                <Badge variant="secondary" className="ml-1">
                  {memberIds.length}
                </Badge>
              </label>
              <div
                className="max-h-48 overflow-y-auto rounded-md border p-1"
                data-testid="channel-member-picker"
              >
                {agents.map((agent) => {
                  const selected = memberIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                        selected && 'bg-accent',
                      )}
                      onClick={() => toggleMember(agent.id)}
                      data-testid={`member-toggle-${agent.id}`}
                      disabled={isSaving}
                    >
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded border',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30',
                        )}
                      >
                        {selected && (
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <AgentAvatar agentId={agent.id} name={agent.name} size="sm" />
                      <span className="flex-1 truncate">{agent.name}</span>
                      <span className="text-xs text-muted-foreground">{agent.role}</span>
                    </button>
                  );
                })}
                {agents.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    No agents available
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              data-testid="channel-dialog-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSaving}
              data-testid="channel-dialog-save"
            >
              {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

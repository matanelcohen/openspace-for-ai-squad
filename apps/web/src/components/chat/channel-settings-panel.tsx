'use client';

import type { Agent, ChatChannel } from '@matanelcohen/openspace-shared';
import { Calendar, Hash, Pencil, Save, Trash2, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────

export interface ChannelSettingsPanelProps {
  /** The channel to display settings for. */
  channel: ChatChannel;
  /** Available agents for member management. */
  agents?: Agent[];
  /** Called when the user saves changes to the channel. */
  onSave?: (data: { name: string; description: string; memberAgentIds: string[] }) => void;
  /** Called when the user requests channel deletion. */
  onDelete?: () => void;
  /** Called when the panel is closed. */
  onClose: () => void;
  /** Whether a save operation is in progress. */
  isSaving?: boolean;
  /** Extra class names on the root element. */
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Component ───────────────────────────────────────────────────────

export function ChannelSettingsPanel({
  channel,
  agents = [],
  onSave,
  onDelete,
  onClose,
  isSaving,
  className,
}: ChannelSettingsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description);
  const [memberIds, setMemberIds] = useState<string[]>(channel.memberAgentIds);

  // Sync form state when channel prop changes
  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description);
    setMemberIds(channel.memberAgentIds);
    setIsEditing(false);
  }, [channel.id, channel.name, channel.description, channel.memberAgentIds]);

  const toggleMember = useCallback((agentId: string) => {
    setMemberIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  }, []);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave?.({ name: trimmedName, description: description.trim(), memberAgentIds: memberIds });
    setIsEditing(false);
  }, [name, description, memberIds, onSave]);

  const handleCancel = useCallback(() => {
    setName(channel.name);
    setDescription(channel.description);
    setMemberIds(channel.memberAgentIds);
    setIsEditing(false);
  }, [channel]);

  const hasChanges =
    name.trim() !== channel.name ||
    description.trim() !== channel.description ||
    JSON.stringify([...memberIds].sort()) !== JSON.stringify([...channel.memberAgentIds].sort());

  const resolvedMembers = channel.memberAgentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is Agent => !!a);

  return (
    <aside
      className={cn('flex h-full w-80 flex-col border-l bg-background', className)}
      data-testid="channel-settings-panel"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold" data-testid="settings-panel-title">
          Channel Settings
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          aria-label="Close settings"
          data-testid="settings-panel-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* Channel name */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <label
                htmlFor="settings-channel-name"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Name
              </label>
            </div>
            {isEditing ? (
              <Input
                id="settings-channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSaving}
                data-testid="settings-name-input"
                autoFocus
              />
            ) : (
              <p className="text-sm font-medium" data-testid="settings-channel-name">
                {channel.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="settings-channel-description"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Description
            </label>
            {isEditing ? (
              <Textarea
                id="settings-channel-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving}
                rows={3}
                placeholder="Add a description…"
                data-testid="settings-description-input"
              />
            ) : (
              <p
                className={cn(
                  'text-sm',
                  channel.description ? 'text-foreground' : 'italic text-muted-foreground',
                )}
                data-testid="settings-channel-description"
              >
                {channel.description || 'No description'}
              </p>
            )}
          </div>

          {/* Members */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Members
              </span>
              <Badge variant="secondary" className="h-5 px-1.5" data-testid="settings-member-count">
                {isEditing ? memberIds.length : resolvedMembers.length}
              </Badge>
            </div>

            {isEditing ? (
              <div
                className="max-h-48 overflow-y-auto rounded-md border p-1"
                data-testid="settings-member-picker"
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
                      disabled={isSaving}
                      data-testid={`settings-member-toggle-${agent.id}`}
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
            ) : (
              <div className="space-y-1" data-testid="settings-member-list">
                {resolvedMembers.length > 0 ? (
                  resolvedMembers.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5"
                      data-testid={`settings-member-${agent.id}`}
                    >
                      <AgentAvatar agentId={agent.id} name={agent.name} size="sm" />
                      <span className="flex-1 truncate text-sm">{agent.name}</span>
                      <span className="text-xs text-muted-foreground">{agent.role}</span>
                    </div>
                  ))
                ) : (
                  <p
                    className="px-2 py-1.5 text-sm italic text-muted-foreground"
                    data-testid="settings-no-members"
                  >
                    No members
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Created</span>
              <span className="ml-auto" data-testid="settings-created-at">
                {formatDate(channel.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Updated</span>
              <span className="ml-auto" data-testid="settings-updated-at">
                {formatDate(channel.updatedAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 border-t pt-4">
            {isEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={isSaving}
                  data-testid="settings-cancel-btn"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={handleSave}
                  disabled={!name.trim() || isSaving || !hasChanges}
                  data-testid="settings-save-btn"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : (
              <>
                {onSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => setIsEditing(true)}
                    data-testid="settings-edit-btn"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Channel
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={onDelete}
                    data-testid="settings-delete-btn"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Channel
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

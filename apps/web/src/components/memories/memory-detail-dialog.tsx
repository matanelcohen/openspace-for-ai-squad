'use client';

import type { Memory } from '@openspace/shared';
import { Calendar, Clock, Hash, User } from 'lucide-react';
import { useState } from 'react';

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
import { Textarea } from '@/components/ui/textarea';

interface MemoryDetailDialogProps {
  memory: Memory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (content: string) => void;
}

export function MemoryDetailDialog({
  memory,
  open,
  onOpenChange,
  onSave,
}: MemoryDetailDialogProps) {
  const [content, setContent] = useState(memory.content);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onSave(content);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setContent(memory.content);
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="memory-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Memory Detail
            <Badge variant="secondary" className="text-xs">
              {memory.type}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            View and edit this memory entry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>Agent:</span>
              <span className="capitalize font-medium text-foreground">{memory.agentId}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              <span>Session:</span>
              <span className="font-mono text-xs text-foreground">
                {memory.sourceSession.slice(0, 12)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Created:</span>
              <span className="text-foreground">
                {new Date(memory.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Last used:</span>
              <span className="text-foreground">
                {memory.lastRecalledAt
                  ? new Date(memory.lastRecalledAt).toLocaleDateString()
                  : 'Never'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="memory-content" className="mb-1.5 block text-sm font-medium">
              Content
            </label>
            {isEditing ? (
              <Textarea
                id="memory-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                data-testid="memory-content-textarea"
              />
            ) : (
              <div
                className="rounded-md border bg-muted/50 p-3 text-sm leading-relaxed"
                data-testid="memory-content-display"
              >
                {memory.content}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} data-testid="cancel-edit-button">
                Cancel
              </Button>
              <Button onClick={handleSave} data-testid="save-memory-button">
                Save Changes
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              data-testid="start-edit-button"
            >
              Edit Memory
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

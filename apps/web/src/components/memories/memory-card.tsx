'use client';

import type { Memory } from '@matanelcohen/openspace-shared';
import { Calendar, Clock, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import { DeleteMemoryDialog } from './delete-memory-dialog';
import { MemoryDetailDialog } from './memory-detail-dialog';

const typeColors: Record<string, 'default' | 'secondary' | 'outline'> = {
  preference: 'default',
  pattern: 'secondary',
  decision: 'outline',
};

interface MemoryCardProps {
  memory: Memory;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export function MemoryCard({ memory, onUpdate, onDelete }: MemoryCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Card data-testid="memory-card" data-memory-id={memory.id}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant={typeColors[memory.type] ?? 'default'} data-testid="memory-type-badge">
                {memory.type}
              </Badge>
              <span className="text-sm font-medium capitalize text-muted-foreground">
                {memory.agentId}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDetailOpen(true)}
                aria-label={`Edit memory: ${memory.content.slice(0, 30)}`}
                data-testid="edit-memory-button"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label={`Delete memory: ${memory.content.slice(0, 30)}`}
                data-testid="delete-memory-button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{memory.content}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(memory.createdAt).toLocaleDateString()}
            </span>
            {memory.lastRecalledAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last used {new Date(memory.lastRecalledAt).toLocaleDateString()}
              </span>
            )}
            <span className="font-mono text-[10px] opacity-60">
              Session: {memory.sourceSession.slice(0, 8)}
            </span>
          </div>
        </CardContent>
      </Card>

      <MemoryDetailDialog
        memory={memory}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSave={(content) => {
          onUpdate(memory.id, content);
          setDetailOpen(false);
        }}
      />

      <DeleteMemoryDialog
        memory={memory}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          onDelete(memory.id);
          setDeleteOpen(false);
        }}
      />
    </>
  );
}

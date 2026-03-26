import type { Memory } from '@openspace/shared';
import { Brain } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

import { MemoryCard } from './memory-card';

interface MemoryListProps {
  memories: Memory[];
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export function MemoryList({ memories, onUpdate, onDelete }: MemoryListProps) {
  if (memories.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title="No memories found"
        description="Memories will appear here as agents learn from interactions. Try adjusting your filters."
        data-testid="empty-state"
      />
    );
  }

  const sortedMemories = [...memories].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-3" data-testid="memory-list">
      <p className="text-sm text-muted-foreground">
        {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
      </p>
      {sortedMemories.map((memory) => (
        <MemoryCard
          key={memory.id}
          memory={memory}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

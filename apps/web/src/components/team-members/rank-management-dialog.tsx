'use client';

import type { TeamMemberRank } from '@openspace/shared';
import { TEAM_MEMBER_RANK_LABELS, TEAM_MEMBER_RANKS } from '@openspace/shared';
import { ArrowUp, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const rankConfig: Record<TeamMemberRank, { color: string; bgColor: string; level: number }> = {
  junior: {
    color: 'text-slate-700 dark:text-slate-400',
    bgColor: 'bg-slate-500/15 border-slate-500/20',
    level: 1,
  },
  mid: {
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-500/15 border-blue-500/20',
    level: 2,
  },
  senior: {
    color: 'text-violet-700 dark:text-violet-400',
    bgColor: 'bg-violet-500/15 border-violet-500/20',
    level: 3,
  },
  lead: {
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-500/15 border-purple-500/20',
    level: 4,
  },
  principal: {
    color: 'text-pink-700 dark:text-pink-400',
    bgColor: 'bg-pink-500/15 border-pink-500/20',
    level: 5,
  },
};

interface RankManagementDialogProps {
  currentRank: TeamMemberRank;
  memberName: string;
  onRankChange: (rank: TeamMemberRank) => void;
  isPending?: boolean;
}

export function RankManagementDialog({
  currentRank,
  memberName,
  onRankChange,
  isPending,
}: RankManagementDialogProps) {
  const [selectedRank, setSelectedRank] = useState<TeamMemberRank>(currentRank);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    if (selectedRank !== currentRank) {
      onRankChange(selectedRank);
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setSelectedRank(currentRank);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-testid="rank-change-trigger">
          <ArrowUp className="h-3.5 w-3.5" />
          Change Rank
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="rank-management-dialog">
        <DialogHeader>
          <DialogTitle>Change Rank</DialogTitle>
          <DialogDescription>Update the seniority rank for {memberName}.</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Rank progression */}
          <div className="space-y-2">
            {TEAM_MEMBER_RANKS.map((rank, idx) => {
              const config = rankConfig[rank];
              const isSelected = rank === selectedRank;
              const isCurrent = rank === currentRank;

              return (
                <div key={rank}>
                  <button
                    type="button"
                    onClick={() => setSelectedRank(rank)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                      isSelected
                        ? `${config.bgColor} ring-2 ring-primary`
                        : 'border-border hover:bg-muted/50',
                    )}
                    data-testid={`rank-option-${rank}`}
                  >
                    {/* Level indicator */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-2 w-2 rounded-full',
                            i < config.level
                              ? isSelected
                                ? 'bg-primary'
                                : 'bg-muted-foreground/40'
                              : 'bg-muted-foreground/10',
                          )}
                        />
                      ))}
                    </div>
                    <span className={cn('font-medium text-sm flex-1', isSelected && config.color)}>
                      {TEAM_MEMBER_RANK_LABELS[rank]}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </button>
                  {idx < TEAM_MEMBER_RANKS.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ChevronRight className="h-3 w-3 rotate-90 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedRank === currentRank || isPending}
            data-testid="rank-save-button"
          >
            {isPending ? 'Saving…' : 'Update Rank'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

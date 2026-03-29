'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const EMOJI_GROUPS: Record<string, string[]> = {
  'Work': ['🚀', '💼', '🏢', '⚡', '🔧', '🛠️', '⚙️', '🔨', '📦', '📋'],
  'Code': ['💻', '🖥️', '📱', '🌐', '🔌', '🧪', '🐛', '🤖', '🧠', '🔬'],
  'Nature': ['🌍', '🌊', '🔥', '❄️', '🌙', '⭐', '☀️', '🌈', '🍀', '🌸'],
  'Fun': ['🎮', '🎯', '🎨', '🎭', '🎪', '🏆', '🎲', '🎸', '🎬', '🎧'],
  'Animals': ['🦊', '🐺', '🦁', '🐉', '🦅', '🐙', '🐋', '🦋', '🐝', '🦄'],
  'Symbols': ['💎', '🔮', '🛡️', '⚔️', '🏴‍☠️', '👑', '💡', '🔑', '🎯', '♟️'],
};

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ value, onChange, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('h-10 w-14 text-xl', className)}
          type="button"
        >
          {value || '🚀'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
            <div key={group}>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 px-1">{group}</p>
              <div className="grid grid-cols-10 gap-0.5">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { onChange(emoji); setOpen(false); }}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded text-base hover:bg-muted transition-colors',
                      value === emoji && 'bg-primary/10 ring-1 ring-primary',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

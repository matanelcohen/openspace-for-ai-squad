'use client';

import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useState } from 'react';

import { ActivityFeed } from '@/components/activity/activity-feed';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ActivitySidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed right-4 top-4 z-50"
        aria-label={isOpen ? 'Close activity feed' : 'Open activity feed'}
      >
        {isOpen ? (
          <PanelRightClose className="h-5 w-5" />
        ) : (
          <PanelRightOpen className="h-5 w-5" />
        )}
      </Button>

      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-40 w-80 border-l bg-background shadow-lg transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="h-full pt-14">
          <ActivityFeed />
        </div>
      </aside>
    </>
  );
}

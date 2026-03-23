'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';

export function TopBar() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6" role="banner">
      <h2 className="text-lg font-semibold" data-testid="squad-name">openspace.ai Squad</h2>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  );
}

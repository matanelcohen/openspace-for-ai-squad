'use client';

import { LayoutDashboard, ListTodo, MessageSquare, Mic, Scale } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/decisions', label: 'Decisions', icon: Scale },
  { href: '/voice', label: 'Voice', icon: Mic },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">🚀</span>
          <span>openspace.ai</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

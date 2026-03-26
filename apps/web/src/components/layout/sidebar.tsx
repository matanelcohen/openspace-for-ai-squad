'use client';

import {
  BookOpen,
  Brain,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Puzzle,
  Scale,
  Scan,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AgentWorkSummary } from '@/components/layout/agent-work-summary';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/traces', label: 'Traces', icon: Scan },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/decisions', label: 'Decisions', icon: Scale },
  { href: '/team-members', label: 'Team', icon: Users },
  { href: '/skills', label: 'Skills', icon: Puzzle },
  { href: '/memories', label: 'Memories', icon: Brain },
  { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold" onClick={onNavigate}>
          <span className="text-lg">🚀</span>
          <span>openspace.ai</span>
        </Link>
      </div>
      <nav
        className="flex-1 space-y-1 overflow-y-auto p-2"
        role="navigation"
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
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
      <AgentWorkSummary />
    </aside>
  );
}

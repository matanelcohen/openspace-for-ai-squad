/**
 * Sidebar navigation regression tests.
 *
 * Verifies that every sidebar route is defined, renders the correct link,
 * highlights the active route, and that sidebar structure hasn't regressed.
 * Edge cases: duplicate routes, missing icons, keyboard/a11y.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────

let currentPath = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

// Mock WebSocket and provider hooks used by AppLayout
vi.mock('@/hooks/use-websocket', () => ({
  useWebSocket: () => ({
    lastEvent: null,
    lastError: null,
    isConnected: true,
    send: vi.fn(),
    subscribe: vi.fn(),
    onEventRef: { current: null },
    onErrorRef: { current: null },
  }),
}));

vi.mock('@/components/providers/websocket-provider', () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWsEvent: vi.fn(),
  useWsConnection: () => ({ isConnected: true }),
  useWsSend: () => vi.fn(),
}));

vi.mock('@/hooks/use-workspaces', () => ({
  useWorkspaces: () => ({ data: [{ id: 'ws-1', name: 'Test', icon: '🚀' }], isLoading: false }),
  useActiveWorkspace: () => ({ data: { id: 'ws-1', name: 'Test', icon: '🚀' } }),
  useWorkspaceStatus: () => ({ data: { initialized: true }, isLoading: false }),
  useActivateWorkspace: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock agent work summary (makes HTTP calls)
vi.mock('@/components/layout/agent-work-summary', () => ({
  AgentWorkSummary: () => <div data-testid="agent-work-summary" />,
}));

// Mock workspace switcher (makes HTTP calls)
vi.mock('@/components/layout/workspace-switcher', () => ({
  WorkspaceSwitcher: () => <div data-testid="workspace-switcher" />,
}));

// Mock notification bells
vi.mock('@/components/escalations/reviewer-notification-bell', () => ({
  ReviewerNotificationBell: () => null,
}));

vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => null,
}));

import { Sidebar } from '@/components/layout/sidebar';

// ── Expected routes ───────────────────────────────────────────────

const EXPECTED_ROUTES = [
  { href: '/', label: 'Dashboard' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/chat', label: 'Chat' },
  { href: '/decisions', label: 'Decisions' },
  { href: '/escalations', label: 'Escalations' },
  { href: '/team-members', label: 'Team' },
  { href: '/skills', label: 'Skills' },
  { href: '/memories', label: 'Memories' },
  { href: '/knowledge', label: 'Knowledge' },
  { href: '/traces', label: 'Traces' },
  { href: '/costs', label: 'Costs' },
  { href: '/github', label: 'GitHub' },
  { href: '/terminal', label: 'Terminal' },
  { href: '/cron', label: 'Cron' },
  { href: '/settings', label: 'Settings' },
];

// ── Tests ─────────────────────────────────────────────────────────

describe('Sidebar navigation — regression', () => {
  beforeEach(() => {
    currentPath = '/';
  });

  // ── Route completeness ──────────────────────────────────────────

  describe('route completeness', () => {
    it('renders all 15 expected navigation links', () => {
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });

      for (const route of EXPECTED_ROUTES) {
        const link = within(nav).getByText(route.label);
        expect(link.closest('a')).toHaveAttribute('href', route.href);
      }
    });

    it('has exactly 15 navigation links (no unexpected additions)', () => {
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const links = within(nav).getAllByRole('link');
      expect(links).toHaveLength(EXPECTED_ROUTES.length);
    });

    it('has no duplicate routes', () => {
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const links = within(nav).getAllByRole('link');
      const hrefs = links.map((l) => l.getAttribute('href'));
      const unique = new Set(hrefs);
      expect(unique.size).toBe(hrefs.length);
    });
  });

  // ── Active state per route ──────────────────────────────────────

  describe('active state highlighting', () => {
    for (const route of EXPECTED_ROUTES) {
      it(`highlights "${route.label}" when pathname is "${route.href}"`, () => {
        currentPath = route.href;
        render(<Sidebar />);
        const nav = screen.getByRole('navigation', { name: 'Main navigation' });
        const link = within(nav).getByText(route.label).closest('a');
        expect(link).toHaveAttribute('aria-current', 'page');
      });
    }

    it('does not highlight any link for an unknown route', () => {
      currentPath = '/unknown-route-xyz';
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const links = within(nav).getAllByRole('link');
      for (const link of links) {
        expect(link).not.toHaveAttribute('aria-current', 'page');
      }
    });

    it('only highlights one link at a time', () => {
      currentPath = '/tasks';
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const activeLinks = within(nav)
        .getAllByRole('link')
        .filter((l) => l.getAttribute('aria-current') === 'page');
      expect(activeLinks).toHaveLength(1);
      expect(activeLinks[0]).toHaveTextContent('Tasks');
    });
  });

  // ── Icon rendering ──────────────────────────────────────────────

  describe('icon rendering', () => {
    it('renders an SVG icon for every nav item', () => {
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const links = within(nav).getAllByRole('link');

      for (const link of links) {
        const svg = link.querySelector('svg');
        expect(svg).not.toBeNull();
      }
    });
  });

  // ── Accessibility ───────────────────────────────────────────────

  describe('accessibility', () => {
    it('renders sidebar as <aside> landmark', () => {
      const { container } = render(<Sidebar />);
      expect(container.querySelector('aside')).not.toBeNull();
    });

    it('has navigation role with aria-label', () => {
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(nav).toBeInTheDocument();
    });

    it('all links have accessible text (not empty)', () => {
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const links = within(nav).getAllByRole('link');
      for (const link of links) {
        expect(link.textContent?.trim().length).toBeGreaterThan(0);
      }
    });
  });

  // ── onNavigate callback ─────────────────────────────────────────

  describe('onNavigate callback', () => {
    it('calls onNavigate when a link is clicked', () => {
      const onNavigate = vi.fn();
      render(<Sidebar onNavigate={onNavigate} />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const taskLink = within(nav).getByText('Tasks');

      fireEvent.click(taskLink);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('calls onNavigate for every navigation link click', () => {
      const onNavigate = vi.fn();
      render(<Sidebar onNavigate={onNavigate} />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const links = within(nav).getAllByRole('link');

      for (const link of links) {
        fireEvent.click(link);
      }

      expect(onNavigate).toHaveBeenCalledTimes(EXPECTED_ROUTES.length);
    });
  });

  // ── Structural components ───────────────────────────────────────

  describe('structural components', () => {
    it('renders workspace switcher', () => {
      render(<Sidebar />);
      expect(screen.getByTestId('workspace-switcher')).toBeInTheDocument();
    });

    it('renders agent work summary', () => {
      render(<Sidebar />);
      expect(screen.getByTestId('agent-work-summary')).toBeInTheDocument();
    });
  });

  // ── Terminal link regression (key for this PR) ──────────────────

  describe('terminal link regression', () => {
    it('terminal link exists and points to /terminal', () => {
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const termLink = within(nav).getByText('Terminal').closest('a');
      expect(termLink).toHaveAttribute('href', '/terminal');
    });

    it('terminal link highlights when on /terminal', () => {
      currentPath = '/terminal';
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const termLink = within(nav).getByText('Terminal').closest('a');
      expect(termLink).toHaveAttribute('aria-current', 'page');
    });

    it('terminal link does not break adjacent links', () => {
      render(<Sidebar />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      // Terminal is between GitHub and Cron
      const github = within(nav).getByText('GitHub').closest('a');
      const terminal = within(nav).getByText('Terminal').closest('a');
      const cron = within(nav).getByText('Cron').closest('a');

      expect(github).toHaveAttribute('href', '/github');
      expect(terminal).toHaveAttribute('href', '/terminal');
      expect(cron).toHaveAttribute('href', '/cron');
    });
  });
});

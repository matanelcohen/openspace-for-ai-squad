import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AppLayout } from '@/components/layout/app-layout';
import { Sidebar } from '@/components/layout/sidebar';

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Decisions')).toBeInTheDocument();
    expect(screen.getByText('Voice')).toBeInTheDocument();
  });

  it('renders the brand name', () => {
    render(<Sidebar />);
    expect(screen.getByText('openspace.ai')).toBeInTheDocument();
  });

  it('marks the active route with aria-current', () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark inactive routes', () => {
    render(<Sidebar />);
    const tasksLink = screen.getByText('Tasks').closest('a');
    expect(tasksLink).not.toHaveAttribute('aria-current');
  });

  it('has accessible navigation landmark', () => {
    render(<Sidebar />);
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });
});

describe('AppLayout', () => {
  it('renders sidebar and children', () => {
    render(
      <AppLayout>
        <div data-testid="child">Hello</div>
      </AppLayout>,
    );
    expect(screen.getByText('openspace.ai')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders children in main content area', () => {
    render(
      <AppLayout>
        <p>Test content</p>
      </AppLayout>,
    );
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent('Test content');
  });
});

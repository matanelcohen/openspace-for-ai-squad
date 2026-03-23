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

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

import { AppLayout } from '@/components/layout/app-layout';
import { TopBar } from '@/components/layout/top-bar';

describe('TopBar', () => {
  it('renders squad name', () => {
    render(<TopBar />);
    expect(screen.getByTestId('squad-name')).toHaveTextContent('openspace.ai Squad');
  });

  it('renders theme toggle button', () => {
    render(<TopBar />);
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });

  it('has banner role', () => {
    render(<TopBar />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});

describe('AppLayout (with TopBar)', () => {
  it('renders sidebar, top bar, and children', () => {
    render(
      <AppLayout>
        <div data-testid="child">Hello</div>
      </AppLayout>,
    );
    expect(screen.getByText('openspace.ai')).toBeInTheDocument();
    expect(screen.getByTestId('squad-name')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

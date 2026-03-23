import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoadingSpinner } from '@/components/ui/loading-spinner';

describe('LoadingSpinner', () => {
  it('renders with default settings', () => {
    render(<LoadingSpinner />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows message when provided', () => {
    render(<LoadingSpinner message="Creating task..." />);
    expect(screen.getByText('Creating task...')).toBeInTheDocument();
  });

  it('does not show message when not provided', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('uses custom data-testid', () => {
    render(<LoadingSpinner data-testid="task-spinner" />);
    expect(screen.getByTestId('task-spinner')).toBeInTheDocument();
  });

  it('renders with small size', () => {
    render(<LoadingSpinner size="sm" />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders with large size', () => {
    render(<LoadingSpinner size="lg" message="Loading dashboard..." />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });
});

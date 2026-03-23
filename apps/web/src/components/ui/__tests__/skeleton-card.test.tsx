import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SkeletonCard } from '@/components/ui/skeleton-card';

describe('SkeletonCard', () => {
  it('renders with default 3 skeleton lines', () => {
    render(<SkeletonCard />);
    const card = screen.getByTestId('skeleton-card');
    expect(card).toBeInTheDocument();
    // Header has 2 skeletons + content has 3 lines = 5 total
    const skeletons = card.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });

  it('renders with custom number of lines', () => {
    render(<SkeletonCard lines={5} />);
    const card = screen.getByTestId('skeleton-card');
    // Header has 2 skeletons + content has 5 lines = 7 total
    const skeletons = card.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(7);
  });

  it('renders with 0 content lines (header only)', () => {
    render(<SkeletonCard lines={0} />);
    const card = screen.getByTestId('skeleton-card');
    // Header has 2 skeletons only
    const skeletons = card.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(2);
  });

  it('uses custom data-testid', () => {
    render(<SkeletonCard data-testid="dashboard-skeleton" />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });
});

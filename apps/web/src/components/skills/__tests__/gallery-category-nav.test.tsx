import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GalleryCategoryCount } from '@/hooks/use-skill-gallery';

import { GalleryCategoryNav } from '../gallery-category-nav';

const mockCategories: GalleryCategoryCount[] = [
  { category: 'code-quality', count: 10, label: 'Code Quality' },
  { category: 'testing', count: 5, label: 'Testing' },
  { category: 'security', count: 3, label: 'Security' },
];

describe('GalleryCategoryNav', () => {
  it('renders "All" option and category pills', () => {
    render(
      <GalleryCategoryNav categories={mockCategories} onSelect={vi.fn()} />,
    );
    expect(screen.getByTestId('category-pill-all')).toHaveTextContent('All');
    expect(screen.getByTestId('category-pill-code-quality')).toBeInTheDocument();
    expect(screen.getByTestId('category-pill-testing')).toBeInTheDocument();
    expect(screen.getByTestId('category-pill-security')).toBeInTheDocument();
  });

  it('shows counts on each pill', () => {
    render(
      <GalleryCategoryNav categories={mockCategories} onSelect={vi.fn()} />,
    );
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows total count on "All" pill', () => {
    render(
      <GalleryCategoryNav categories={mockCategories} onSelect={vi.fn()} />,
    );
    // Total = 10 + 5 + 3 = 18
    expect(screen.getByTestId('category-pill-all')).toHaveTextContent('18');
  });

  it('highlights selected category', () => {
    render(
      <GalleryCategoryNav
        categories={mockCategories}
        selected="testing"
        onSelect={vi.fn()}
      />,
    );
    const testingPill = screen.getByTestId('category-pill-testing');
    // When selected, Button uses variant="default" which doesn't have the outline class
    expect(testingPill.className).not.toContain('border-input');
  });

  it('calls onSelect with category when pill clicked', async () => {
    const onSelect = vi.fn();
    render(
      <GalleryCategoryNav categories={mockCategories} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getByTestId('category-pill-testing'));
    expect(onSelect).toHaveBeenCalledWith('testing');
  });

  it('calls onSelect(undefined) when "All" clicked', async () => {
    const onSelect = vi.fn();
    render(
      <GalleryCategoryNav
        categories={mockCategories}
        selected="testing"
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByTestId('category-pill-all'));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});

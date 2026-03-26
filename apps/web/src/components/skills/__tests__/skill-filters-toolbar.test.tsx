import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SkillFiltersToolbar } from '../skill-filters-toolbar';

const defaultProps = {
  search: '',
  onSearchChange: vi.fn(),
  selectedTag: '',
  onTagChange: vi.fn(),
  selectedPhase: '',
  onPhaseChange: vi.fn(),
  availableTags: ['code', 'testing', 'deployment', 'security'],
  resultCount: undefined as number | undefined,
};

function renderToolbar(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<SkillFiltersToolbar {...props} />);
}

describe('SkillFiltersToolbar', () => {
  it('renders the search input', () => {
    renderToolbar();
    expect(screen.getByTestId('skill-search-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search skills...')).toBeInTheDocument();
  });

  it('renders tag filter select', () => {
    renderToolbar();
    expect(screen.getByTestId('skill-tag-filter')).toBeInTheDocument();
  });

  it('renders phase filter select', () => {
    renderToolbar();
    expect(screen.getByTestId('skill-phase-filter')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search input', async () => {
    const onSearchChange = vi.fn();
    renderToolbar({ onSearchChange });
    const input = screen.getByTestId('skill-search-input');
    await userEvent.type(input, 'a');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('shows search value in input', () => {
    renderToolbar({ search: 'code review' });
    const input = screen.getByTestId('skill-search-input') as HTMLInputElement;
    expect(input.value).toBe('code review');
  });

  it('does not show result count or clear button when no filters active', () => {
    renderToolbar();
    expect(screen.queryByTestId('skill-clear-filters')).not.toBeInTheDocument();
  });

  it('shows result count when filters are active and resultCount provided', () => {
    renderToolbar({ search: 'code', resultCount: 5 });
    expect(screen.getByText('5 skills found')).toBeInTheDocument();
  });

  it('shows singular "skill" for resultCount of 1', () => {
    renderToolbar({ search: 'unique', resultCount: 1 });
    expect(screen.getByText('1 skill found')).toBeInTheDocument();
  });

  it('shows clear filters button when search is active', () => {
    renderToolbar({ search: 'test' });
    expect(screen.getByTestId('skill-clear-filters')).toBeInTheDocument();
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('shows clear filters button when tag is selected', () => {
    renderToolbar({ selectedTag: 'code' });
    expect(screen.getByTestId('skill-clear-filters')).toBeInTheDocument();
  });

  it('shows clear filters button when phase is selected', () => {
    renderToolbar({ selectedPhase: 'active' });
    expect(screen.getByTestId('skill-clear-filters')).toBeInTheDocument();
  });

  it('calls all clear callbacks when clear button is clicked', async () => {
    const onSearchChange = vi.fn();
    const onTagChange = vi.fn();
    const onPhaseChange = vi.fn();
    renderToolbar({
      search: 'test',
      onSearchChange,
      onTagChange,
      onPhaseChange,
    });
    await userEvent.click(screen.getByTestId('skill-clear-filters'));
    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onTagChange).toHaveBeenCalledWith('');
    expect(onPhaseChange).toHaveBeenCalledWith('');
  });

  it('renders the filters container with testid', () => {
    renderToolbar();
    expect(screen.getByTestId('skill-filters')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MemorySearch } from '../memory-search';

describe('MemorySearch', () => {
  const defaultProps = {
    onSearch: vi.fn(),
    onFilterType: vi.fn(),
    onFilterAgent: vi.fn(),
    onFilterDate: vi.fn(),
    availableAgents: ['leela', 'bender', 'fry'],
  };

  it('renders search input and filter controls', () => {
    render(<MemorySearch {...defaultProps} />);

    expect(screen.getByTestId('memory-search')).toBeInTheDocument();
    expect(screen.getByTestId('memory-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('memory-type-filter')).toBeInTheDocument();
    expect(screen.getByTestId('memory-agent-filter')).toBeInTheDocument();
    expect(screen.getByTestId('memory-date-filter')).toBeInTheDocument();
  });

  it('calls onSearch when typing in search input', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();

    render(<MemorySearch {...defaultProps} onSearch={onSearch} />);

    await user.type(screen.getByTestId('memory-search-input'), 'typescript');

    expect(onSearch).toHaveBeenCalled();
    expect(onSearch).toHaveBeenLastCalledWith('typescript');
  });

  it('has accessible search input label', () => {
    render(<MemorySearch {...defaultProps} />);

    expect(screen.getByLabelText('Search memories')).toBeInTheDocument();
  });

  it('has accessible filter labels', () => {
    render(<MemorySearch {...defaultProps} />);

    expect(screen.getByLabelText('Filter by type')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by agent')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by date')).toBeInTheDocument();
  });
});

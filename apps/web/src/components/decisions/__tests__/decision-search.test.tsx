import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DecisionSearch } from '../decision-search';

describe('DecisionSearch', () => {
  const defaultProps = {
    onSearch: vi.fn(),
    onFilterStatus: vi.fn(),
    onFilterAgent: vi.fn(),
    availableAgents: ['leela', 'bender', 'fry'],
  };

  it('renders search input', () => {
    render(<DecisionSearch {...defaultProps} />);
    
    expect(screen.getByTestId('decision-search')).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search decisions...')).toBeInTheDocument();
  });

  it('renders filter dropdowns', () => {
    render(<DecisionSearch {...defaultProps} />);
    
    expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('agent-filter')).toBeInTheDocument();
  });

  it('calls onSearch when typing', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    
    render(<DecisionSearch {...defaultProps} onSearch={onSearch} />);
    
    await user.type(screen.getByTestId('search-input'), 'typescript');
    
    expect(onSearch).toHaveBeenCalled();
    expect(onSearch).toHaveBeenLastCalledWith('typescript');
  });

  it('shows clear button when input has value', async () => {
    const user = userEvent.setup();
    render(<DecisionSearch {...defaultProps} />);
    
    const input = screen.getByTestId('search-input');
    await user.type(input, 'test');
    
    expect(screen.getByTestId('clear-button')).toBeInTheDocument();
  });

  it('clears input when clear button clicked', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    
    render(<DecisionSearch {...defaultProps} onSearch={onSearch} />);
    
    const input = screen.getByTestId('search-input');
    await user.type(input, 'test');
    await user.click(screen.getByTestId('clear-button'));
    
    expect(input).toHaveValue('');
    expect(onSearch).toHaveBeenLastCalledWith('');
  });

  it('does not show clear button when input is empty', () => {
    render(<DecisionSearch {...defaultProps} />);
    
    expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();
  });
});

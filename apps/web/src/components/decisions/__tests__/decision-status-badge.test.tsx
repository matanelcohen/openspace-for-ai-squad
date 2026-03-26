import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DecisionStatusBadge } from '../decision-status-badge';

describe('DecisionStatusBadge', () => {
  it('renders active status', () => {
    render(<DecisionStatusBadge status="active" />);
    
    const badge = screen.getByTestId('decision-status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Active');
    expect(badge).toHaveAttribute('data-status', 'active');
    expect(badge).toHaveClass('bg-green-500');
  });

  it('renders superseded status', () => {
    render(<DecisionStatusBadge status="superseded" />);
    
    const badge = screen.getByTestId('decision-status-badge');
    expect(badge).toHaveTextContent('Superseded');
    expect(badge).toHaveAttribute('data-status', 'superseded');
    expect(badge).toHaveClass('bg-yellow-500');
  });

  it('renders reversed status', () => {
    render(<DecisionStatusBadge status="reversed" />);
    
    const badge = screen.getByTestId('decision-status-badge');
    expect(badge).toHaveTextContent('Reversed');
    expect(badge).toHaveAttribute('data-status', 'reversed');
    expect(badge).toHaveClass('bg-red-500');
  });

  it('accepts custom className', () => {
    render(<DecisionStatusBadge status="active" className="custom-class" />);
    
    const badge = screen.getByTestId('decision-status-badge');
    expect(badge).toHaveClass('custom-class');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpeakingIndicator } from '../speaking-indicator';

describe('SpeakingIndicator', () => {
  it('renders wave bars', () => {
    render(<SpeakingIndicator isActive={false} />);
    
    expect(screen.getByTestId('speaking-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('wave-bar-0')).toBeInTheDocument();
    expect(screen.getByTestId('wave-bar-1')).toBeInTheDocument();
    expect(screen.getByTestId('wave-bar-2')).toBeInTheDocument();
    expect(screen.getByTestId('wave-bar-3')).toBeInTheDocument();
  });

  it('applies animation when active', () => {
    const { container } = render(<SpeakingIndicator isActive={true} />);
    
    const bars = container.querySelectorAll('[data-testid^="wave-bar-"]');
    bars.forEach((bar) => {
      expect(bar).toHaveClass('animate-wave');
    });
  });

  it('does not animate when inactive', () => {
    const { container } = render(<SpeakingIndicator isActive={false} />);
    
    const bars = container.querySelectorAll('[data-testid^="wave-bar-"]');
    bars.forEach((bar) => {
      expect(bar).not.toHaveClass('animate-wave');
    });
  });
});

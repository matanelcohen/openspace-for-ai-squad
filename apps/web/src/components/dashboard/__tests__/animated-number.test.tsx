import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnimatedNumber } from '@/components/dashboard/animated-number';

describe('AnimatedNumber', () => {
  it('renders the initial value', () => {
    render(<AnimatedNumber value={42} />);
    expect(screen.getByTestId('animated-number')).toHaveTextContent('42');
  });

  it('renders zero correctly', () => {
    render(<AnimatedNumber value={0} />);
    expect(screen.getByTestId('animated-number')).toHaveTextContent('0');
  });

  it('applies custom className', () => {
    render(<AnimatedNumber value={5} className="text-2xl" />);
    expect(screen.getByTestId('animated-number')).toHaveClass('text-2xl');
  });
});

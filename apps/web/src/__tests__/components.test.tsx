import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

describe('Button', () => {
  it('renders with text content', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Test</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('supports disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders different variants without crashing', () => {
    const { rerender } = render(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders card with title and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Card content here</p>
        </CardContent>
      </Card>,
    );
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Card content here')).toBeInTheDocument();
  });

  it('applies custom className to card', () => {
    render(<Card className="my-card" data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveClass('my-card');
  });
});

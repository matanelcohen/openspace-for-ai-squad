import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

describe('Badge', () => {
  it('renders with text content', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Badge data-testid="badge">Test</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('bg-primary');
  });

  it('applies secondary variant', () => {
    render(
      <Badge variant="secondary" data-testid="badge">
        Tag
      </Badge>,
    );
    expect(screen.getByTestId('badge')).toHaveClass('bg-secondary');
  });

  it('applies destructive variant', () => {
    render(
      <Badge variant="destructive" data-testid="badge">
        Error
      </Badge>,
    );
    expect(screen.getByTestId('badge')).toHaveClass('bg-destructive');
  });

  it('applies outline variant', () => {
    render(
      <Badge variant="outline" data-testid="badge">
        Outline
      </Badge>,
    );
    expect(screen.getByTestId('badge')).toHaveClass('text-foreground');
  });

  it('applies custom className', () => {
    render(
      <Badge className="custom-class" data-testid="badge">
        Test
      </Badge>,
    );
    expect(screen.getByTestId('badge')).toHaveClass('custom-class');
  });
});

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('supports disabled state', () => {
    render(<Input disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled();
  });

  it('supports different types', () => {
    render(<Input type="email" placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('type', 'email');
  });

  it('applies custom className', () => {
    render(<Input className="custom" data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveClass('custom');
  });
});

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea placeholder="Write here" />);
    expect(screen.getByPlaceholderText('Write here')).toBeInTheDocument();
  });

  it('supports disabled state', () => {
    render(<Textarea disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled();
  });
});

describe('Skeleton', () => {
  it('renders with animate-pulse class', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('animate-pulse');
  });

  it('applies custom className', () => {
    render(<Skeleton className="h-10 w-10" data-testid="skeleton" />);
    const el = screen.getByTestId('skeleton');
    expect(el).toHaveClass('h-10');
    expect(el).toHaveClass('w-10');
  });
});

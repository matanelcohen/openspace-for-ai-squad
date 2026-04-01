'use client';

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary, withErrorBoundary } from '@/components/error-boundary';

// Suppress console.error from ErrorBoundary during tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});

function BombComponent(): JSX.Element {
  throw new Error('💣 Boom!');
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('shows fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('💣 Boom!')).toBeInTheDocument();
    process.env.NODE_ENV = originalEnv;
  });

  it('hides error message in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );

    expect(screen.queryByText('💣 Boom!')).not.toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    process.env.NODE_ENV = originalEnv;
  });

  it('resets error state when "Try Again" is clicked', () => {
    let shouldThrow = true;

    function ConditionalBomb() {
      if (shouldThrow) throw new Error('Temporary error');
      return <div data-testid="recovered">Recovered!</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

    // Fix the error, then click Try Again
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByTestId('recovered')).toHaveTextContent('Recovered!');
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
  });

  it('shows "Go Home" link pointing to /', () => {
    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );

    const link = screen.getByText('Go Home');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <BombComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Custom Error UI');
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
  });

  it('logs errors to console.error', () => {
    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('calls onError callback when an error is caught', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <BombComponent />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('💣 Boom!');
    // Second argument is ErrorInfo with componentStack
    expect(onError.mock.calls[0][1]).toHaveProperty('componentStack');
  });

  it('does not call onError when no error occurs', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <div>All good</div>
      </ErrorBoundary>,
    );

    expect(onError).not.toHaveBeenCalled();
  });

  it('auto-resets when resetKeys change', () => {
    let shouldThrow = true;

    function ConditionalBomb() {
      if (shouldThrow) throw new Error('Reset key error');
      return <div data-testid="reset-recovered">Back to normal</div>;
    }

    const { rerender } = render(
      <ErrorBoundary resetKeys={['key-a']}>
        <ConditionalBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

    // Fix the error and change resetKeys to trigger auto-reset
    shouldThrow = false;
    rerender(
      <ErrorBoundary resetKeys={['key-b']}>
        <ConditionalBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('reset-recovered')).toHaveTextContent('Back to normal');
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
  });

  it('does not reset when resetKeys stay the same', () => {
    function AlwaysBomb(): JSX.Element {
      throw new Error('Persistent error');
    }

    const { rerender } = render(
      <ErrorBoundary resetKeys={['same']}>
        <AlwaysBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

    // Re-render with same keys — should stay in error state
    rerender(
      <ErrorBoundary resetKeys={['same']}>
        <AlwaysBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('wraps component in error boundary', () => {
    const SafeComponent = withErrorBoundary(BombComponent);
    render(<SafeComponent />);
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
  });

  it('passes props through to wrapped component', () => {
    function Greeter({ name }: { name: string }) {
      return <div data-testid="greeter">Hello {name}</div>;
    }
    const SafeGreeter = withErrorBoundary(Greeter);
    render(<SafeGreeter name="Zoidberg" />);
    expect(screen.getByTestId('greeter')).toHaveTextContent('Hello Zoidberg');
  });

  it('renders children normally when no error', () => {
    function Normal() {
      return <div data-testid="normal">Working fine</div>;
    }
    const SafeNormal = withErrorBoundary(Normal);
    render(<SafeNormal />);
    expect(screen.getByTestId('normal')).toHaveTextContent('Working fine');
  });

  it('uses custom fallback when provided', () => {
    const customFallback = <div data-testid="hoc-fallback">HOC Custom Error</div>;
    const SafeBomb = withErrorBoundary(BombComponent, customFallback);
    render(<SafeBomb />);
    expect(screen.getByTestId('hoc-fallback')).toBeInTheDocument();
  });

  it('sets correct displayName', () => {
    function MyComponent() {
      return null;
    }
    const Wrapped = withErrorBoundary(MyComponent);
    expect(Wrapped.displayName).toBe('withErrorBoundary(MyComponent)');
  });
});

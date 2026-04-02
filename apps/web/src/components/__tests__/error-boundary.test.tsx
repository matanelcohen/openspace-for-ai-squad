'use client';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FallbackProps } from '@/components/error-boundary';
import {
  ErrorBoundary,
  useErrorBoundary,
  useRetryHandler,
  withErrorBoundary,
} from '@/components/error-boundary';

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

  it('renders fallback with role="alert" for accessibility', () => {
    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('💣 Boom!')).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = originalEnv;
  });

  it('hides error message in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <BombComponent />
      </ErrorBoundary>,
    );

    expect(screen.queryByText('💣 Boom!')).not.toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = originalEnv;
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

  it('renders custom fallback ReactNode when provided', () => {
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
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0]![0].message).toBe('💣 Boom!');
    // Second argument is ErrorInfo with componentStack
    expect(onError.mock.calls[0]![1]).toHaveProperty('componentStack');
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

  describe('render-prop fallback', () => {
    it('calls fallback function with error and resetErrorBoundary', () => {
      const fallbackFn = vi.fn(({ error, resetErrorBoundary }: FallbackProps) => (
        <div data-testid="fn-fallback">
          <span data-testid="fn-error">{error.message}</span>
          <button onClick={resetErrorBoundary}>Retry</button>
        </div>
      ));

      render(
        <ErrorBoundary fallback={fallbackFn}>
          <BombComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('fn-fallback')).toBeInTheDocument();
      expect(screen.getByTestId('fn-error')).toHaveTextContent('💣 Boom!');
      expect(fallbackFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          resetErrorBoundary: expect.any(Function),
          retryCount: 0,
        }),
      );
    });

    it('passes retryCount starting at 0 and incrementing on each retry', () => {
      let shouldThrow = true;

      function FlakeyComponent() {
        if (shouldThrow) throw new Error('Flakey!');
        return <div data-testid="flakey-ok">Working</div>;
      }

      function FallbackWithCount({ error, resetErrorBoundary, retryCount }: FallbackProps) {
        return (
          <div data-testid="retry-fallback">
            <span data-testid="retry-count">{retryCount}</span>
            <span data-testid="retry-error">{error.message}</span>
            <button onClick={resetErrorBoundary}>Retry</button>
          </div>
        );
      }

      render(
        <ErrorBoundary fallback={FallbackWithCount}>
          <FlakeyComponent />
        </ErrorBoundary>,
      );

      // First error — retryCount should be 0
      expect(screen.getByTestId('retry-count')).toHaveTextContent('0');

      // Click Retry — still throws, retryCount should be 1
      fireEvent.click(screen.getByText('Retry'));
      expect(screen.getByTestId('retry-count')).toHaveTextContent('1');

      // Fix the error and click Retry — now it succeeds
      shouldThrow = false;
      fireEvent.click(screen.getByText('Retry'));
      expect(screen.getByTestId('flakey-ok')).toHaveTextContent('Working');
    });

    it('allows retry from render-prop fallback to recover', () => {
      let shouldThrow = true;

      function ConditionalBomb() {
        if (shouldThrow) throw new Error('Render-prop error');
        return <div data-testid="rp-recovered">Back!</div>;
      }

      render(
        <ErrorBoundary
          fallback={({ resetErrorBoundary }) => (
            <button data-testid="rp-retry" onClick={resetErrorBoundary}>
              Retry Now
            </button>
          )}
        >
          <ConditionalBomb />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('rp-retry')).toBeInTheDocument();

      shouldThrow = false;
      fireEvent.click(screen.getByTestId('rp-retry'));

      expect(screen.getByTestId('rp-recovered')).toHaveTextContent('Back!');
    });
  });

  describe('onReset callback', () => {
    it('calls onReset when "Try Again" is clicked', () => {
      let shouldThrow = true;
      const onReset = vi.fn();

      function ConditionalBomb() {
        if (shouldThrow) throw new Error('Will reset');
        return <div data-testid="reset-child">OK</div>;
      }

      render(
        <ErrorBoundary onReset={onReset}>
          <ConditionalBomb />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

      shouldThrow = false;
      fireEvent.click(screen.getByText('Try Again'));

      expect(onReset).toHaveBeenCalledOnce();
      expect(screen.getByTestId('reset-child')).toBeInTheDocument();
    });

    it('calls onReset when resetKeys change', () => {
      let shouldThrow = true;
      const onReset = vi.fn();

      function ConditionalBomb() {
        if (shouldThrow) throw new Error('Key reset');
        return <div data-testid="key-reset-child">OK</div>;
      }

      const { rerender } = render(
        <ErrorBoundary onReset={onReset} resetKeys={['a']}>
          <ConditionalBomb />
        </ErrorBoundary>,
      );

      shouldThrow = false;
      rerender(
        <ErrorBoundary onReset={onReset} resetKeys={['b']}>
          <ConditionalBomb />
        </ErrorBoundary>,
      );

      expect(onReset).toHaveBeenCalledOnce();
      expect(screen.getByTestId('key-reset-child')).toBeInTheDocument();
    });

    it('calls onReset from render-prop fallback retry', () => {
      let shouldThrow = true;
      const onReset = vi.fn();

      function ConditionalBomb() {
        if (shouldThrow) throw new Error('FN reset');
        return <div data-testid="fn-reset-child">OK</div>;
      }

      render(
        <ErrorBoundary
          onReset={onReset}
          fallback={({ resetErrorBoundary }) => <button onClick={resetErrorBoundary}>Retry</button>}
        >
          <ConditionalBomb />
        </ErrorBoundary>,
      );

      shouldThrow = false;
      fireEvent.click(screen.getByText('Retry'));

      expect(onReset).toHaveBeenCalledOnce();
      expect(screen.getByTestId('fn-reset-child')).toBeInTheDocument();
    });

    it('does not call onReset when no error occurs', () => {
      const onReset = vi.fn();

      render(
        <ErrorBoundary onReset={onReset}>
          <div>All good</div>
        </ErrorBoundary>,
      );

      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe('retryCount resets on resetKeys change', () => {
    it('resets retryCount to 0 when resetKeys change', () => {
      let throwCount = 0;

      function FlakeyComponent(): JSX.Element {
        throwCount++;
        throw new Error(`Attempt ${throwCount}`);
      }

      const retryCountsSeen: number[] = [];

      function FallbackTracker({ retryCount, resetErrorBoundary }: FallbackProps) {
        retryCountsSeen.push(retryCount);
        return (
          <div>
            <span data-testid="rc">{retryCount}</span>
            <button onClick={resetErrorBoundary}>Retry</button>
          </div>
        );
      }

      const { rerender } = render(
        <ErrorBoundary fallback={FallbackTracker} resetKeys={['v1']}>
          <FlakeyComponent />
        </ErrorBoundary>,
      );

      // Initial error: retryCount = 0
      expect(screen.getByTestId('rc')).toHaveTextContent('0');

      // Retry: retryCount = 1
      fireEvent.click(screen.getByText('Retry'));
      expect(screen.getByTestId('rc')).toHaveTextContent('1');

      // Change resetKeys — retryCount resets to 0
      rerender(
        <ErrorBoundary fallback={FallbackTracker} resetKeys={['v2']}>
          <FlakeyComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId('rc')).toHaveTextContent('0');
    });
  });
});

describe('maxRetries', () => {
  it('shows retry count after first retry', () => {
    let throwCount = 0;

    function AlwaysBomb(): JSX.Element {
      throwCount++;
      throw new Error(`Error #${throwCount}`);
    }

    render(
      <ErrorBoundary maxRetries={3}>
        <AlwaysBomb />
      </ErrorBoundary>,
    );

    // First error — no retry count shown yet (retryCount is 0)
    expect(screen.queryByTestId('retry-count')).not.toBeInTheDocument();

    // Click "Try Again" → retryCount becomes 1
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByTestId('retry-count')).toHaveTextContent('Attempt 1 of 3');
  });

  it('shows exhausted state after maxRetries reached', () => {
    function AlwaysBomb(): JSX.Element {
      throw new Error('Persistent failure');
    }

    render(
      <ErrorBoundary maxRetries={2}>
        <AlwaysBomb />
      </ErrorBoundary>,
    );

    // Retry twice to exhaust
    fireEvent.click(screen.getByText('Try Again'));
    fireEvent.click(screen.getByText('Try Again'));

    // Should show exhausted UI
    expect(screen.getByText('Unable to recover')).toBeInTheDocument();
    expect(screen.getByText(/We tried 2 times/)).toBeInTheDocument();
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    expect(screen.getByText('Refresh Page')).toBeInTheDocument();
  });

  it('allows unlimited retries when maxRetries is 0', () => {
    let throwCount = 0;

    function CountingBomb(): JSX.Element {
      throwCount++;
      throw new Error(`Error #${throwCount}`);
    }

    render(
      <ErrorBoundary maxRetries={0}>
        <CountingBomb />
      </ErrorBoundary>,
    );

    // Click "Try Again" many times — should never exhaust
    for (let i = 0; i < 10; i++) {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Try Again'));
    }

    // Should still show "Try Again" and never show exhausted message
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Unable to recover')).not.toBeInTheDocument();
  });

  it('defaults maxRetries to 3', () => {
    function AlwaysBomb(): JSX.Element {
      throw new Error('fail');
    }

    render(
      <ErrorBoundary>
        <AlwaysBomb />
      </ErrorBoundary>,
    );

    // Exhaust default of 3 retries
    fireEvent.click(screen.getByText('Try Again'));
    fireEvent.click(screen.getByText('Try Again'));
    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByText('Unable to recover')).toBeInTheDocument();
    expect(screen.getByText(/We tried 3 times/)).toBeInTheDocument();
  });

  it('passes retriesExhausted to fallback render function', () => {
    function AlwaysBomb(): JSX.Element {
      throw new Error('fail');
    }

    const fallbackFn = vi.fn(
      ({ retriesExhausted, retryCount, maxRetries, resetErrorBoundary }: FallbackProps) => (
        <div>
          <span data-testid="exhausted">{String(retriesExhausted)}</span>
          <span data-testid="count">{retryCount}</span>
          <span data-testid="max">{maxRetries}</span>
          <button onClick={resetErrorBoundary}>retry</button>
        </div>
      ),
    );

    render(
      <ErrorBoundary fallback={fallbackFn} maxRetries={1}>
        <AlwaysBomb />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('exhausted')).toHaveTextContent('false');
    expect(screen.getByTestId('max')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('retry'));

    expect(screen.getByTestId('exhausted')).toHaveTextContent('true');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('uses singular "time" for maxRetries=1', () => {
    function AlwaysBomb(): JSX.Element {
      throw new Error('fail');
    }

    render(
      <ErrorBoundary maxRetries={1}>
        <AlwaysBomb />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByText(/We tried 1 time but/)).toBeInTheDocument();
  });
});

describe('useErrorBoundary', () => {
  it('showBoundary triggers error state in nearest ErrorBoundary', () => {
    function AsyncComponent() {
      const { showBoundary } = useErrorBoundary();
      return <button onClick={() => showBoundary(new Error('async error'))}>Trigger Error</button>;
    }

    render(
      <ErrorBoundary>
        <AsyncComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Trigger Error')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Trigger Error'));

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
  });

  it('throws if used outside ErrorBoundary', () => {
    function Orphan() {
      useErrorBoundary();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      'useErrorBoundary must be used within an <ErrorBoundary>',
    );
  });
});

describe('useRetryHandler', () => {
  it('routes async errors to the ErrorBoundary', async () => {
    function AsyncLoader() {
      const { execute, isLoading } = useRetryHandler();
      return (
        <button
          data-testid="load-btn"
          disabled={isLoading}
          onClick={() =>
            execute(async () => {
              throw new Error('fetch failed');
            })
          }
        >
          {isLoading ? 'Loading...' : 'Load Data'}
        </button>
      );
    }

    render(
      <ErrorBoundary>
        <AsyncLoader />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByTestId('load-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
    });
  });

  it('does not trigger error boundary on success', async () => {
    let result: string | undefined;

    function AsyncLoader() {
      const { execute } = useRetryHandler();
      return (
        <button
          data-testid="load-btn"
          onClick={async () => {
            result = await execute(async () => 'ok');
          }}
        >
          Load
        </button>
      );
    }

    render(
      <ErrorBoundary>
        <AsyncLoader />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByTestId('load-btn'));

    await waitFor(() => {
      expect(result).toBe('ok');
    });
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
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

  it('uses custom fallback ReactNode when provided', () => {
    const customFallback = <div data-testid="hoc-fallback">HOC Custom Error</div>;
    const SafeBomb = withErrorBoundary(BombComponent, { fallback: customFallback });
    render(<SafeBomb />);
    expect(screen.getByTestId('hoc-fallback')).toBeInTheDocument();
  });

  it('uses render-prop fallback via HOC', () => {
    const SafeBomb = withErrorBoundary(BombComponent, {
      fallback: ({ error }) => <div data-testid="hoc-fn-fallback">{error.message}</div>,
    });
    render(<SafeBomb />);
    expect(screen.getByTestId('hoc-fn-fallback')).toHaveTextContent('💣 Boom!');
  });

  it('passes onError and onReset via HOC', () => {
    let shouldThrow = true;
    const onError = vi.fn();
    const onReset = vi.fn();

    function ConditionalBomb() {
      if (shouldThrow) throw new Error('HOC error');
      return <div data-testid="hoc-recovered">OK</div>;
    }

    const SafeBomb = withErrorBoundary(ConditionalBomb, { onError, onReset });
    render(<SafeBomb />);

    expect(onError).toHaveBeenCalledOnce();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByTestId('hoc-recovered')).toBeInTheDocument();
  });

  it('sets correct displayName', () => {
    function MyComponent() {
      return null;
    }
    const Wrapped = withErrorBoundary(MyComponent);
    expect(Wrapped.displayName).toBe('withErrorBoundary(MyComponent)');
  });
});

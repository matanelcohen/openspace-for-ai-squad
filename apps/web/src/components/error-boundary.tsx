'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import React, {
  Component,
  createContext,
  type ErrorInfo,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const DEFAULT_MAX_RETRIES = 3;

/** Props passed to fallback render functions. */
interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  retryCount: number;
  maxRetries: number;
  /** True when retryCount >= maxRetries. */
  retriesExhausted: boolean;
}

type FallbackType = ReactNode | ((props: FallbackProps) => ReactNode);

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback: a ReactNode or a render function receiving { error, resetErrorBoundary, retryCount, maxRetries, retriesExhausted }. */
  fallback?: FallbackType;
  /** Optional callback invoked when an error is caught. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional callback invoked when the error state is reset (via retry or resetKeys). */
  onReset?: () => void;
  /** When any value in this array changes, the error state auto-resets. */
  resetKeys?: unknown[];
  /** Maximum number of retry attempts before disabling the retry button. Defaults to 3. Set to 0 for unlimited. */
  maxRetries?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

// ── useErrorBoundary hook ──────────────────────────────────────────────
// Lets functional components trigger the nearest ErrorBoundary for async errors.

interface ErrorBoundaryContextValue {
  showBoundary: (error: Error) => void;
}

const ErrorBoundaryContext = createContext<ErrorBoundaryContextValue | null>(null);

/**
 * Hook to programmatically trigger the nearest ErrorBoundary.
 * Useful for catching async errors that React can't catch automatically.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { showBoundary } = useErrorBoundary();
 *   useEffect(() => {
 *     fetchData().catch(showBoundary);
 *   }, [showBoundary]);
 * }
 * ```
 */
function useErrorBoundary(): ErrorBoundaryContextValue {
  const ctx = useContext(ErrorBoundaryContext);
  if (!ctx) {
    throw new Error('useErrorBoundary must be used within an <ErrorBoundary>');
  }
  return ctx;
}

// ── ErrorBoundary component ────────────────────────────────────────────

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) return;

    const prevKeys = prevProps.resetKeys ?? [];
    const nextKeys = this.props.resetKeys ?? [];

    const hasChanged =
      prevKeys.length !== nextKeys.length ||
      prevKeys.some((key, i) => !Object.is(key, nextKeys[i]));

    if (hasChanged) {
      this.props.onReset?.();
      this.setState({ hasError: false, error: null, retryCount: 0 });
    }
  }

  /** Trigger error state programmatically (used by useErrorBoundary). */
  showBoundary = (error: Error): void => {
    this.setState({ hasError: true, error });
  };

  handleReset = (): void => {
    this.props.onReset?.();
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  private get maxRetries(): number {
    return this.props.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  private get retriesExhausted(): boolean {
    const max = this.maxRetries;
    return max > 0 && this.state.retryCount >= max;
  }

  render(): ReactNode {
    const contextValue: ErrorBoundaryContextValue = { showBoundary: this.showBoundary };

    if (!this.state.hasError) {
      return (
        <ErrorBoundaryContext.Provider value={contextValue}>
          {this.props.children}
        </ErrorBoundaryContext.Provider>
      );
    }

    const { fallback } = this.props;
    const { error, retryCount } = this.state;
    const { maxRetries, retriesExhausted } = this;

    if (typeof fallback === 'function') {
      return fallback({
        error: error!,
        resetErrorBoundary: this.handleReset,
        retryCount,
        maxRetries,
        retriesExhausted,
      });
    }

    if (fallback != null) {
      return fallback;
    }

    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div
        data-testid="error-boundary-fallback"
        className="flex min-h-[400px] items-center justify-center p-6"
        role="alert"
      >
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>{retriesExhausted ? 'Unable to recover' : 'Something went wrong'}</CardTitle>
            {retriesExhausted && (
              <CardDescription>
                We tried {maxRetries} {maxRetries === 1 ? 'time' : 'times'} but the error persists.
                Please try refreshing the page or contact support.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {isDev && error && (
              <p className="rounded-md bg-muted p-3 text-left text-sm text-muted-foreground break-words font-mono">
                {error.message}
              </p>
            )}

            {retryCount > 0 && !retriesExhausted && maxRetries > 0 && (
              <p data-testid="retry-count" className="text-sm text-muted-foreground">
                Attempt {retryCount} of {maxRetries}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {!retriesExhausted && (
                <Button onClick={this.handleReset}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              )}
              <Button variant="outline" asChild>
                <a href="/">Go Home</a>
              </Button>
              {retriesExhausted && (
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

// ── withErrorBoundary HOC ──────────────────────────────────────────────

function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>,
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}

// ── useRetryHandler ────────────────────────────────────────────────────
// Convenience hook for async operations that should funnel errors to the boundary.

/**
 * Returns a stable `execute` function that runs an async callback and routes
 * any thrown error to the nearest ErrorBoundary. Also tracks loading state.
 *
 * @example
 * ```tsx
 * const { execute, isLoading } = useRetryHandler();
 * <button onClick={() => execute(() => fetchData())} disabled={isLoading}>Load</button>
 * ```
 */
function useRetryHandler() {
  const { showBoundary } = useErrorBoundary();
  const [isLoading, setIsLoading] = useState(false);

  const execute = useMemo(
    () =>
      async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
        setIsLoading(true);
        try {
          const result = await fn();
          return result;
        } catch (err) {
          showBoundary(err instanceof Error ? err : new Error(String(err)));
          return undefined;
        } finally {
          setIsLoading(false);
        }
      },
    [showBoundary],
  );

  return { execute, isLoading };
}

export type { ErrorBoundaryProps, FallbackProps };
export { ErrorBoundary, useErrorBoundary, useRetryHandler, withErrorBoundary };

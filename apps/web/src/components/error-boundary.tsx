'use client';

import { AlertTriangle } from 'lucide-react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI to render when an error is caught. */
  fallback?: ReactNode;
  /** Optional callback invoked when an error is caught. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** When any value in this array changes, the error state auto-resets. */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
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
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div
        data-testid="error-boundary-fallback"
        className="flex min-h-[400px] items-center justify-center p-6"
      >
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {isDev && this.state.error && (
              <p className="rounded-md bg-muted p-3 text-left text-sm text-muted-foreground break-words font-mono">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={this.handleReset}>Try Again</Button>
              <Button variant="outline" asChild>
                <a href="/">Go Home</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}

export { ErrorBoundary, withErrorBoundary };

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { QueryProvider } from '@/components/providers/query-provider';
import { useQuery, useMutation } from '@tanstack/react-query';

// Test component that exercises query retry
function TestQueryComponent({ queryFn }: { queryFn: () => Promise<string> }) {
  const { data, error, isError, isLoading } = useQuery({
    queryKey: ['test-retry'],
    queryFn,
  });

  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (isError) return <div data-testid="error">{(error as Error).message}</div>;
  return <div data-testid="data">{data}</div>;
}

function TestMutationComponent({ mutationFn }: { mutationFn: () => Promise<string> }) {
  const { mutate, error, isError, isPending } = useMutation({
    mutationFn,
  });

  return (
    <div>
      <button data-testid="mutate-btn" onClick={() => mutate()}>Mutate</button>
      {isPending && <div data-testid="pending">Pending</div>}
      {isError && <div data-testid="mutation-error">{(error as Error).message}</div>}
    </div>
  );
}

describe('QueryProvider retry logic', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on network errors (up to 3 times)', async () => {
    const queryFn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('Success');

    render(
      <QueryProvider>
        <TestQueryComponent queryFn={queryFn} />
      </QueryProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('data')).toHaveTextContent('Success');
      },
      { timeout: 15000 },
    );

    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 4xx client errors (ApiError)', async () => {
    const queryFn = vi.fn()
      .mockRejectedValue(new ApiError(404, 'Not Found'));

    render(
      <QueryProvider>
        <TestQueryComponent queryFn={queryFn} />
      </QueryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Not Found');
    });

    // Should only be called once — no retries for 4xx
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 400 validation errors', async () => {
    const queryFn = vi.fn()
      .mockRejectedValue(new ApiError(400, 'Validation failed'));

    render(
      <QueryProvider>
        <TestQueryComponent queryFn={queryFn} />
      </QueryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Validation failed');
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx server errors', async () => {
    const queryFn = vi.fn()
      .mockRejectedValueOnce(new ApiError(500, 'Internal Server Error'))
      .mockRejectedValueOnce(new ApiError(502, 'Bad Gateway'))
      .mockResolvedValueOnce('Recovered');

    render(
      <QueryProvider>
        <TestQueryComponent queryFn={queryFn} />
      </QueryProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('data')).toHaveTextContent('Recovered');
      },
      { timeout: 15000 },
    );

    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it('gives up after 3 retries for persistent network errors', async () => {
    const queryFn = vi.fn()
      .mockRejectedValue(new Error('Network failure'));

    render(
      <QueryProvider>
        <TestQueryComponent queryFn={queryFn} />
      </QueryProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      },
      { timeout: 30000 },
    );

    // Initial call + 3 retries = 4 calls
    expect(queryFn).toHaveBeenCalledTimes(4);
  });
});

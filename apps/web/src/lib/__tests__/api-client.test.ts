import { beforeEach,describe, expect, it, vi } from 'vitest';

import { apiClient,ApiError } from '@/lib/api-client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('makes a GET request to the correct URL', async () => {
    const mockData = { id: 1, name: 'test' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await apiClient('/api/test');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('throws ApiError on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    } as Response);

    await expect(apiClient('/api/missing')).rejects.toThrow(ApiError);
    await expect(apiClient('/api/missing')).rejects.toThrow();
  });

  it('passes custom request options', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    await apiClient('/api/test', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      }),
    );
  });
});

describe('ApiError', () => {
  it('has correct name and status', () => {
    const err = new ApiError(404, 'Not found');
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
  });
});

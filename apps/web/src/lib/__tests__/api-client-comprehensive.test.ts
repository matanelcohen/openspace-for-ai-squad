/**
 * P2-10 — API client comprehensive tests
 *
 * Tests all HTTP methods, error handling, edge cases.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, apiClient,ApiError } from '@/lib/api-client';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('apiClient', () => {
  it('makes GET request to correct URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: 'ok' }));
    const result = await apiClient<{ data: string }>('/api/test');
    expect(result.data).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('throws ApiError on 404', async () => {
    fetchMock.mockResolvedValue(jsonResponse('Not Found', 404));
    await expect(apiClient('/api/missing')).rejects.toThrow(ApiError);
    try {
      await apiClient('/api/missing');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
    }
  });

  it('throws ApiError on 500', async () => {
    fetchMock.mockResolvedValue(jsonResponse('Server error', 500));
    await expect(apiClient('/api/broken')).rejects.toThrow(ApiError);
  });

  it('handles non-JSON error bodies gracefully', async () => {
    fetchMock.mockResolvedValue(jsonResponse('Bad Gateway', 502));
    try {
      await apiClient('/api/bad');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(502);
      expect((e as ApiError).message).toContain('502');
    }
  });

  it('handles text() failure gracefully', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => { throw new Error('nope'); },
      text: () => Promise.reject(new Error('body unreadable')),
    });
    await expect(apiClient('/api/down')).rejects.toThrow(ApiError);
  });

  it('passes custom headers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await apiClient('/api/custom', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });
});

describe('api helper methods', () => {
  it('api.get makes GET request', async () => {
    fetchMock.mockResolvedValue(jsonResponse([1, 2, 3]));
    const result = await api.get<number[]>('/api/numbers');
    expect(result).toEqual([1, 2, 3]);
  });

  it('api.post sends POST with JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'new' }));
    await api.post('/api/items', { name: 'test' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      }),
    );
  });

  it('api.patch sends PATCH with JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ updated: true }));
    await api.patch('/api/items/1', { status: 'done' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      }),
    );
  });

  it('api.put sends PUT with JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ updated: true }));
    await api.put('/api/items/1', { title: 'Updated' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated' }),
      }),
    );
  });

  it('api.delete sends DELETE request', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null));
    await api.delete('/api/items/1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('ApiError', () => {
  it('has correct name', () => {
    const err = new ApiError(404, 'Not found');
    expect(err.name).toBe('ApiError');
  });

  it('has correct status', () => {
    const err = new ApiError(500, 'Internal');
    expect(err.status).toBe(500);
  });

  it('extends Error', () => {
    const err = new ApiError(400, 'Bad request');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Bad request');
  });
});

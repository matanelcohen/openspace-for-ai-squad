import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

import type { GallerySkillItem } from '../use-skill-gallery';
import {
  useGalleryCategories,
  useGalleryFeatured,
  useGallerySkillDetail,
  useGallerySkills,
  useInstallGallerySkill,
  useRefreshGallery,
} from '../use-skill-gallery';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  TestWrapper.displayName = 'GalleryQueryWrapper';

  return { wrapper: TestWrapper, queryClient };
};

const mockSkill: GallerySkillItem = {
  id: 'code-review',
  name: 'Code Review',
  description: 'Reviews code changes for quality.',
  category: 'code-quality',
  tags: ['code', 'review'],
  version: '1.0.0',
  author: 'openspace-team',
  installCount: 42,
  featured: true,
  addedAt: Date.now(),
  updatedAt: Date.now(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useGallerySkills', () => {
  it('calls correct API URL without filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ skills: [mockSkill], total: 1 });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGallerySkills(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledWith('/api/skills/gallery');
    expect(result.current.data).toEqual({ skills: [mockSkill], total: 1 });
  });

  it('builds correct query string with filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ skills: [], total: 0 });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useGallerySkills({
          query: 'review',
          category: 'code-quality',
          tags: ['code', 'review'],
          featured: true,
          sort: 'installCount',
          order: 'desc',
          limit: 10,
          offset: 20,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const calledUrl = vi.mocked(api.get).mock.calls[0][0];
    expect(calledUrl).toContain('/api/skills/gallery?');
    expect(calledUrl).toContain('query=review');
    expect(calledUrl).toContain('category=code-quality');
    expect(calledUrl).toContain('tags=code%2Creview');
    expect(calledUrl).toContain('featured=true');
    expect(calledUrl).toContain('sort=installCount');
    expect(calledUrl).toContain('order=desc');
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('offset=20');
  });

  it('returns typed data', async () => {
    vi.mocked(api.get).mockResolvedValue({ skills: [mockSkill], total: 1 });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGallerySkills(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.skills[0].id).toBe('code-review');
    expect(result.current.data?.total).toBe(1);
  });
});

describe('useGalleryFeatured', () => {
  it('calls /api/skills/gallery/featured', async () => {
    vi.mocked(api.get).mockResolvedValue({ skills: [mockSkill] });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGalleryFeatured(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledWith('/api/skills/gallery/featured');
    expect(result.current.data).toEqual({ skills: [mockSkill] });
  });

  it('passes limit as query param', async () => {
    vi.mocked(api.get).mockResolvedValue({ skills: [] });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGalleryFeatured(5), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledWith('/api/skills/gallery/featured?limit=5');
  });
});

describe('useGalleryCategories', () => {
  it('calls /api/skills/gallery/categories', async () => {
    const mockCategories = [
      { category: 'code-quality', count: 10, label: 'Code Quality' },
      { category: 'testing', count: 5, label: 'Testing' },
    ];
    vi.mocked(api.get).mockResolvedValue(mockCategories);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGalleryCategories(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledWith('/api/skills/gallery/categories');
    expect(result.current.data).toEqual(mockCategories);
  });
});

describe('useGallerySkillDetail', () => {
  it('calls /api/skills/gallery/:id', async () => {
    vi.mocked(api.get).mockResolvedValue(mockSkill);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGallerySkillDetail('code-review'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledWith('/api/skills/gallery/code-review');
    expect(result.current.data).toEqual(mockSkill);
  });

  it('is disabled when id is empty', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGallerySkillDetail(''), { wrapper });

    // Should not fire a fetch at all
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('useInstallGallerySkill', () => {
  it('POSTs to correct URL', async () => {
    const installResult = {
      success: true,
      skillId: 'code-review',
      name: 'Code Review',
      message: 'Installed',
      skill: { id: 'code-review', name: 'Code Review', phase: 'loaded' },
    };
    vi.mocked(api.post).mockResolvedValue(installResult);

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useInstallGallerySkill(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('code-review');
    });

    expect(api.post).toHaveBeenCalledWith('/api/skills/gallery/code-review/install', {});
  });

  it('invalidates cache on success', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useInstallGallerySkill(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('code-review');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skills'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gallery-skills'] });
  });
});

describe('useRefreshGallery', () => {
  it('POSTs to refresh endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRefreshGallery(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(api.post).toHaveBeenCalledWith('/api/skills/gallery/refresh', {});
  });

  it('invalidates all gallery keys on success', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRefreshGallery(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gallery-skills'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gallery-featured'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gallery-categories'] });
  });
});

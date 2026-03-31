import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

import type { SkillSummary } from '../use-skills';
import {
  useCreateSkill,
  useDeleteSkill,
  useSkillDetail,
  useSkills,
  useToggleAgentSkill,
  useUpdateSkill,
} from '../use-skills';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'SkillsQueryWrapper';
  return { wrapper: Wrapper, queryClient };
};

const mockSkill: SkillSummary = {
  id: 'code-review',
  name: 'Code Review',
  version: '1.0.0',
  description: 'Review code.',
  phase: 'loaded' as any,
  activeAgentCount: 3,
  tags: ['code'],
};

beforeEach(() => vi.clearAllMocks());

describe('useSkills', () => {
  it('fetches skills without filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ skills: [mockSkill] });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSkills(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/api/skills');
    expect(result.current.data).toEqual([mockSkill]);
  });

  it('builds query string from filters', async () => {
    vi.mocked(api.get).mockResolvedValue({ skills: [] });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useSkills({ search: 'review', tag: 'code', phase: 'loaded' as any }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = vi.mocked(api.get).mock.calls[0][0];
    expect(url).toContain('search=review');
    expect(url).toContain('tag=code');
    expect(url).toContain('phase=loaded');
  });

  it('handles flat array response', async () => {
    vi.mocked(api.get).mockResolvedValue([mockSkill]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSkills(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockSkill]);
  });
});

describe('useSkillDetail', () => {
  it('fetches skill detail', async () => {
    const detail = { manifest: { id: 'code-review', name: 'CR' }, phase: 'loaded' };
    vi.mocked(api.get).mockResolvedValue(detail);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSkillDetail('code-review'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/api/skills/code-review');
  });

  it('is disabled when skillId is empty', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSkillDetail(''), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(api.get).not.toHaveBeenCalled();
  });

  it('wraps flat response into manifest', async () => {
    const flat = { id: 'flat-skill', name: 'Flat', version: '1.0.0' };
    vi.mocked(api.get).mockResolvedValue(flat);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSkillDetail('flat-skill'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.manifest).toBeDefined();
  });
});

describe('useToggleAgentSkill', () => {
  it('patches correct URL', async () => {
    vi.mocked(api.patch).mockResolvedValue({});

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useToggleAgentSkill('agent-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ skillId: 'code-review', mode: 'always' });
    });

    expect(api.patch).toHaveBeenCalledWith('/api/agents/agent-1/skills', {
      skillId: 'code-review',
      mode: 'always',
    });
  });

  it('invalidates cache on success', async () => {
    vi.mocked(api.patch).mockResolvedValue({});

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useToggleAgentSkill('agent-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ skillId: 's1', mode: 'never' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['agent-skills', 'agent-1'] });
  });
});

describe('useCreateSkill', () => {
  it('posts to /api/skills', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'new-skill' });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateSkill(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'New Skill',
        description: 'A new skill',
        tags: ['test'],
        agentMatch: { roles: ['*'] },
        requires: { bins: [], env: [] },
        instructions: 'Do it',
      });
    });

    expect(api.post).toHaveBeenCalledWith('/api/skills', expect.objectContaining({ name: 'New Skill' }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skills'] });
  });
});

describe('useUpdateSkill', () => {
  it('puts to /api/skills/:id', async () => {
    vi.mocked(api.put).mockResolvedValue({});

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateSkill(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 's1',
        name: 'Updated',
        description: 'Updated desc',
        tags: [],
        agentMatch: { roles: [] },
        requires: { bins: [], env: [] },
        instructions: '',
      });
    });

    expect(api.put).toHaveBeenCalledWith('/api/skills/s1', expect.objectContaining({ name: 'Updated' }));
  });
});

describe('useDeleteSkill', () => {
  it('deletes correct URL', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteSkill(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('s1');
    });

    expect(api.delete).toHaveBeenCalledWith('/api/skills/s1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skills'] });
  });
});

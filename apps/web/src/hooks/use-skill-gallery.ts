'use client';

import type { GalleryCategory, GallerySortField } from '@matanelcohen/openspace-shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

// ── API response types ───────────────────────────────────────────

export interface GallerySkillItem {
  id: string;
  name: string;
  description: string;
  category: GalleryCategory;
  tags: string[];
  icon?: string;
  version: string;
  author?: string;
  installCount: number;
  featured?: boolean;
  addedAt: number;
  updatedAt: number;
  documentation?: string;
  homepage?: string;
}

export interface GalleryCategoryCount {
  category: GalleryCategory;
  count: number;
  label: string;
}

export interface GallerySearchFilters {
  query?: string;
  category?: GalleryCategory;
  tags?: string[];
  featured?: boolean;
  sort?: GallerySortField;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GalleryInstallResult {
  success: boolean;
  skillId: string;
  name: string;
  message: string;
  skill: { id: string; name: string; phase: string } | null;
}

// ── Hooks ────────────────────────────────────────────────────────

export function useGallerySkills(filters?: GallerySearchFilters) {
  const params = new URLSearchParams();
  if (filters?.query) params.set('query', filters.query);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters?.featured !== undefined) params.set('featured', String(filters.featured));
  if (filters?.sort) params.set('sort', filters.sort);
  if (filters?.order) params.set('order', filters.order);
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
  const query = params.toString();

  return useQuery<{ skills: GallerySkillItem[]; total: number }>({
    queryKey: ['gallery-skills', filters],
    queryFn: () =>
      api.get<{ skills: GallerySkillItem[]; total: number }>(
        `/api/skills/gallery${query ? `?${query}` : ''}`,
      ),
  });
}

export function useGalleryFeatured(limit?: number) {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', String(limit));
  const query = params.toString();

  return useQuery<{ skills: GallerySkillItem[] }>({
    queryKey: ['gallery-featured', limit],
    queryFn: () =>
      api.get<{ skills: GallerySkillItem[] }>(
        `/api/skills/gallery/featured${query ? `?${query}` : ''}`,
      ),
  });
}

export function useGalleryCategories() {
  return useQuery<GalleryCategoryCount[]>({
    queryKey: ['gallery-categories'],
    queryFn: () => api.get<GalleryCategoryCount[]>('/api/skills/gallery/categories'),
  });
}

export function useGallerySkillDetail(id: string) {
  return useQuery<GallerySkillItem>({
    queryKey: ['gallery-skills', id],
    queryFn: () => api.get<GallerySkillItem>(`/api/skills/gallery/${id}`),
    enabled: !!id,
  });
}

export function useInstallGallerySkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<GalleryInstallResult>(`/api/skills/gallery/${id}/install`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['skills'] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-skills'] });
    },
  });
}

export function useRefreshGallery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>('/api/skills/gallery/refresh', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gallery-skills'] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-featured'] });
      void queryClient.invalidateQueries({ queryKey: ['gallery-categories'] });
    },
  });
}

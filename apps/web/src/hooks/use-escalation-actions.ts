import type { EscalationItem } from '@matanelcohen/openspace-shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

interface ReviewPayload {
  id: string;
  comment: string;
}

interface BulkReviewPayload {
  ids: string[];
  comment: string;
}

export function useClaimEscalation() {
  const queryClient = useQueryClient();

  return useMutation<EscalationItem, Error, string>({
    mutationFn: (id) => api.post<EscalationItem>(`/api/escalations/${id}/claim`, {}),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalation', id] });
    },
  });
}

export function useApproveEscalation() {
  const queryClient = useQueryClient();

  return useMutation<EscalationItem, Error, ReviewPayload>({
    mutationFn: ({ id, comment }) =>
      api.post<EscalationItem>(`/api/escalations/${id}/approve`, { comment }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalation', id] });
    },
  });
}

export function useRejectEscalation() {
  const queryClient = useQueryClient();

  return useMutation<EscalationItem, Error, ReviewPayload>({
    mutationFn: ({ id, comment }) =>
      api.post<EscalationItem>(`/api/escalations/${id}/reject`, { comment }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalation', id] });
    },
  });
}

export function useRequestChangesEscalation() {
  const queryClient = useQueryClient();

  return useMutation<EscalationItem, Error, ReviewPayload>({
    mutationFn: ({ id, comment }) =>
      api.post<EscalationItem>(`/api/escalations/${id}/request-changes`, { comment }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalation', id] });
    },
  });
}

export function useBulkApproveEscalations() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, BulkReviewPayload>({
    mutationFn: ({ ids, comment }) =>
      api.post<void>('/api/escalations/bulk/approve', { ids, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
  });
}

export function useBulkRejectEscalations() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, BulkReviewPayload>({
    mutationFn: ({ ids, comment }) =>
      api.post<void>('/api/escalations/bulk/reject', { ids, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
    },
  });
}

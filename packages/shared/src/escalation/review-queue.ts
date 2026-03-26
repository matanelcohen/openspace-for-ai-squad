/**
 * ReviewQueue — Query and filter layer over escalation items.
 *
 * Provides a read-only view with filtering, sorting, and statistics
 * for building review UIs and dashboards. Delegates to HITLManager
 * for actual item storage.
 */

import type {
  EscalationChain,
  EscalationItem,
  EscalationPriority,
  EscalationStatus,
} from '../types/escalation.js';
import { isReviewerEligible } from './index.js';
import type { HITLManager } from './hitl-manager.js';

// ── Filter Options ──────────────────────────────────────────────

export interface ReviewQueueFilter {
  /** Filter by one or more statuses. */
  status?: EscalationStatus | EscalationStatus[];
  /** Filter by priority. */
  priority?: EscalationPriority | EscalationPriority[];
  /** Filter by chain ID. */
  chainId?: string;
  /** Filter items a specific reviewer is eligible to claim. */
  reviewerEligible?: { reviewerId: string; chain: EscalationChain };
  /** Only items created after this timestamp. */
  createdAfter?: string;
  /** Only items created before this timestamp. */
  createdBefore?: string;
}

export type ReviewQueueSortField = 'createdAt' | 'updatedAt' | 'priority' | 'timeoutAt';
export type ReviewQueueSortOrder = 'asc' | 'desc';

export interface ReviewQueueSort {
  field: ReviewQueueSortField;
  order?: ReviewQueueSortOrder;
}

export interface ReviewQueueStats {
  total: number;
  byStatus: Record<EscalationStatus, number>;
  byPriority: Record<EscalationPriority, number>;
  avgResolutionMs: number | null;
}

// ── Priority ordering (for sorting) ─────────────────────────────

const PRIORITY_ORDER: Record<EscalationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ── ReviewQueue ─────────────────────────────────────────────────

export class ReviewQueue {
  constructor(private manager: HITLManager) {}

  /**
   * Query items with optional filters and sorting.
   */
  query(filter?: ReviewQueueFilter, sort?: ReviewQueueSort): EscalationItem[] {
    let items = this.manager.getAllItems();

    if (filter) {
      items = this.applyFilter(items, filter);
    }

    if (sort) {
      items = this.applySort(items, sort);
    }

    return items;
  }

  /** Get all pending items (awaiting review). */
  pending(sort?: ReviewQueueSort): EscalationItem[] {
    return this.query({ status: 'pending' }, sort ?? { field: 'priority', order: 'asc' });
  }

  /** Get all claimed items, optionally filtered by reviewer. */
  claimed(reviewerId?: string): EscalationItem[] {
    const items = this.query({ status: 'claimed' });
    if (reviewerId) {
      return items.filter((i) => i.claimedBy === reviewerId);
    }
    return items;
  }

  /** Get all resolved items (approved or rejected). */
  resolved(): EscalationItem[] {
    return this.query({ status: ['approved', 'rejected'] }, { field: 'updatedAt', order: 'desc' });
  }

  /**
   * Get items eligible for a specific reviewer based on their chain level.
   */
  forReviewer(reviewerId: string, chain: EscalationChain): EscalationItem[] {
    return this.query(
      {
        status: 'pending',
        reviewerEligible: { reviewerId, chain },
      },
      { field: 'priority', order: 'asc' },
    );
  }

  /**
   * Compute aggregate statistics across all items.
   */
  stats(): ReviewQueueStats {
    const items = this.manager.getAllItems();

    const byStatus = {
      pending: 0,
      claimed: 0,
      approved: 0,
      rejected: 0,
      timed_out: 0,
      auto_escalated: 0,
    } as Record<EscalationStatus, number>;

    const byPriority = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    } as Record<EscalationPriority, number>;

    let totalResolutionMs = 0;
    let resolvedCount = 0;

    for (const item of items) {
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
      byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;

      if (item.status === 'approved' || item.status === 'rejected') {
        const created = new Date(item.createdAt).getTime();
        const updated = new Date(item.updatedAt).getTime();
        totalResolutionMs += updated - created;
        resolvedCount++;
      }
    }

    return {
      total: items.length,
      byStatus,
      byPriority,
      avgResolutionMs: resolvedCount > 0 ? totalResolutionMs / resolvedCount : null,
    };
  }

  // ── Internal ──────────────────────────────────────────────────

  private applyFilter(items: EscalationItem[], filter: ReviewQueueFilter): EscalationItem[] {
    return items.filter((item) => {
      // Status filter
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(item.status)) return false;
      }

      // Priority filter
      if (filter.priority) {
        const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
        if (!priorities.includes(item.priority)) return false;
      }

      // Chain filter
      if (filter.chainId && item.chainId !== filter.chainId) return false;

      // Reviewer eligibility filter
      if (filter.reviewerEligible) {
        const { reviewerId, chain } = filter.reviewerEligible;
        if (!isReviewerEligible(chain, item.currentLevel, reviewerId)) return false;
      }

      // Date range filters
      if (filter.createdAfter) {
        if (new Date(item.createdAt) < new Date(filter.createdAfter)) return false;
      }
      if (filter.createdBefore) {
        if (new Date(item.createdAt) > new Date(filter.createdBefore)) return false;
      }

      return true;
    });
  }

  private applySort(items: EscalationItem[], sort: ReviewQueueSort): EscalationItem[] {
    const order = sort.order === 'desc' ? -1 : 1;

    return [...items].sort((a, b) => {
      switch (sort.field) {
        case 'createdAt':
          return order * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case 'updatedAt':
          return order * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        case 'timeoutAt':
          return order * (new Date(a.timeoutAt).getTime() - new Date(b.timeoutAt).getTime());
        case 'priority':
          return order * (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        default:
          return 0;
      }
    });
  }
}

/**
 * NotificationService — reviewer notification persistence + WebSocket push.
 *
 * Sends targeted notifications to reviewers when they become eligible
 * for new escalations. Persists to SQLite for history/unread tracking.
 */

import { generateId, isReviewerEligible } from '@openspace/shared';
import type { EscalationChain, EscalationItem } from '@openspace/shared';
import type Database from 'better-sqlite3';

import type { WebSocketManager, WsEnvelope } from '../websocket/index.js';

// ── Types ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  reviewerId: string;
  type: string;
  title: string;
  message: string;
  escalationId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationFilter {
  reviewerId?: string;
  unreadOnly?: boolean;
  escalationId?: string;
  limit?: number;
  offset?: number;
}

interface NotificationRow {
  id: string;
  reviewer_id: string;
  type: string;
  title: string;
  message: string;
  escalation_id: string | null;
  is_read: number;
  created_at: string;
}

// ── Service ─────────────────────────────────────────────────────────

export class NotificationService {
  private db: Database.Database;
  private wsManager: WebSocketManager | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /**
   * Notify all eligible reviewers for an escalation item.
   * Checks reviewer eligibility via the escalation chain, creates
   * a notification for each, persists to DB, and pushes via WebSocket.
   */
  notifyEligibleReviewers(item: EscalationItem, chain: EscalationChain): Notification[] {
    const level = chain.levels.find((l) => l.level === item.currentLevel);
    if (!level) return [];

    const notifications: Notification[] = [];
    const now = new Date().toISOString();

    for (const reviewerId of level.reviewerIds) {
      if (!isReviewerEligible(chain, item.currentLevel, reviewerId)) continue;

      const notification: Notification = {
        id: generateId('notif'),
        reviewerId,
        type: 'escalation_eligible',
        title: `New ${item.priority} escalation requires review`,
        message: `Escalation ${item.id} (${item.reason}) is pending at level ${item.currentLevel}. Agent: ${item.context.agentId}`,
        escalationId: item.id,
        isRead: false,
        createdAt: now,
      };

      this.persistNotification(notification);
      this.pushToReviewer(reviewerId, notification);
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Get notifications with optional filters.
   */
  list(filter: NotificationFilter = {}): { items: Notification[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.reviewerId) {
      conditions.push('reviewer_id = ?');
      params.push(filter.reviewerId);
    }
    if (filter.unreadOnly) {
      conditions.push('is_read = 0');
    }
    if (filter.escalationId) {
      conditions.push('escalation_id = ?');
      params.push(filter.escalationId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM notifications ${where}`)
      .get(...params) as { cnt: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as NotificationRow[];

    return {
      items: rows.map(this.rowToNotification),
      total: countRow.cnt,
    };
  }

  /**
   * Mark a notification as read.
   */
  markRead(id: string): Notification | null {
    const row = this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as
      | NotificationRow
      | undefined;
    if (!row) return null;

    this.db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    return { ...this.rowToNotification(row), isRead: true };
  }

  /**
   * Mark all notifications for a reviewer as read.
   */
  markAllRead(reviewerId: string): number {
    const result = this.db
      .prepare('UPDATE notifications SET is_read = 1 WHERE reviewer_id = ? AND is_read = 0')
      .run(reviewerId);
    return result.changes;
  }

  // ── Private Helpers ───────────────────────────────────────────

  private persistNotification(notification: Notification): void {
    this.db
      .prepare(
        `INSERT INTO notifications
           (id, reviewer_id, type, title, message, escalation_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        notification.id,
        notification.reviewerId,
        notification.type,
        notification.title,
        notification.message,
        notification.escalationId,
        notification.isRead ? 1 : 0,
        notification.createdAt,
      );
  }

  private pushToReviewer(reviewerId: string, notification: Notification): void {
    if (!this.wsManager) return;

    const envelope: WsEnvelope = {
      type: 'activity:new' as WsEnvelope['type'],
      payload: {
        notificationType: 'reviewer_notification',
        ...notification,
      } as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    };

    // Try to send to the reviewer's channel; fall back to broadcast
    this.wsManager.broadcastToChannel(`reviewer:${reviewerId}`, envelope);
  }

  private rowToNotification(row: NotificationRow): Notification {
    return {
      id: row.id,
      reviewerId: row.reviewer_id,
      type: row.type,
      title: row.title,
      message: row.message,
      escalationId: row.escalation_id,
      isRead: row.is_read === 1,
      createdAt: row.created_at,
    };
  }
}

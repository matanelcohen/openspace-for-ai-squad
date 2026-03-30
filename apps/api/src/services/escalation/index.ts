/**
 * EscalationService — SQLite persistence layer for the HITL escalation framework.
 *
 * Wraps the pure escalation logic from @matanelcohen/openspace-shared with database persistence,
 * WebSocket notifications, and workflow state serialization.
 */

import type {
  AuditEntry,
  ConfidenceThreshold,
  EscalationChain,
  EscalationContext,
  EscalationItem,
  EscalationPriority,
  EscalationReason,
  EscalationStatus,
} from '@matanelcohen/openspace-shared';
import {
  approveEscalationItem,
  autoEscalate,
  claimEscalationItem,
  createEscalationItem,
  evaluateConfidence,
  generateId,
  isTimedOut,
  rejectEscalationItem,
  validateContext,
} from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

import type { WebSocketManager, WsEnvelope } from '../websocket/index.js';

// ── Types ───────────────────────────────────────────────────────────

export interface EscalationFilter {
  status?: EscalationStatus;
  priority?: EscalationPriority;
  chainId?: string;
  claimedBy?: string;
  agentId?: string;
  workflowId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditFilter {
  escalationId?: string;
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── Service ─────────────────────────────────────────────────────────

export class EscalationService {
  private db: Database.Database;
  private wsManager: WebSocketManager | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  // ── Chain Management ──────────────────────────────────────────

  createChain(chain: EscalationChain): EscalationChain {
    this.db
      .prepare('INSERT INTO escalation_chains (id, name, data) VALUES (?, ?, ?)')
      .run(chain.id, chain.name, JSON.stringify(chain.levels));
    return chain;
  }

  getChain(id: string): EscalationChain | null {
    const row = this.db.prepare('SELECT * FROM escalation_chains WHERE id = ?').get(id) as
      | { id: string; name: string; data: string }
      | undefined;
    if (!row) return null;
    return { id: row.id, name: row.name, levels: JSON.parse(row.data) };
  }

  listChains(): EscalationChain[] {
    const rows = this.db.prepare('SELECT * FROM escalation_chains ORDER BY name').all() as Array<{
      id: string;
      name: string;
      data: string;
    }>;
    return rows.map((r) => ({ id: r.id, name: r.name, levels: JSON.parse(r.data) }));
  }

  updateChain(
    id: string,
    updates: Partial<Pick<EscalationChain, 'name' | 'levels'>>,
  ): EscalationChain | null {
    const existing = this.getChain(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
    };

    this.db
      .prepare('UPDATE escalation_chains SET name = ?, data = ? WHERE id = ?')
      .run(updated.name, JSON.stringify(updated.levels), id);

    return updated;
  }

  deleteChain(id: string): boolean {
    const result = this.db.prepare('DELETE FROM escalation_chains WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Threshold Management ──────────────────────────────────────

  createThreshold(
    threshold: Omit<ConfidenceThreshold, 'id'> & { id?: number },
  ): ConfidenceThreshold & { id: number } {
    const result = this.db
      .prepare(
        'INSERT INTO escalation_thresholds (threshold, escalation_level, agent_roles) VALUES (?, ?, ?)',
      )
      .run(
        threshold.threshold,
        threshold.escalationLevel,
        JSON.stringify(threshold.agentRoles ?? []),
      );

    return {
      ...threshold,
      id: Number(result.lastInsertRowid),
      agentRoles: threshold.agentRoles ?? [],
    };
  }

  listThresholds(): Array<ConfidenceThreshold & { id: number }> {
    const rows = this.db
      .prepare('SELECT * FROM escalation_thresholds ORDER BY threshold DESC')
      .all() as Array<{
      id: number;
      threshold: number;
      escalation_level: number;
      agent_roles: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      threshold: r.threshold,
      escalationLevel: r.escalation_level,
      agentRoles: JSON.parse(r.agent_roles),
    }));
  }

  deleteThreshold(id: number): boolean {
    const result = this.db.prepare('DELETE FROM escalation_thresholds WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Escalation CRUD ───────────────────────────────────────────

  /**
   * Create an escalation item. Persists to DB and broadcasts via WebSocket.
   * Optionally accepts serialized workflow state for later resumption.
   */
  create(params: {
    reason: EscalationReason;
    priority: EscalationPriority;
    chainId: string;
    context: EscalationContext;
    workflowState?: string;
    startLevel?: number;
  }): EscalationItem {
    const chain = this.getChain(params.chainId);
    if (!chain) throw new Error(`Escalation chain not found: ${params.chainId}`);

    const contextErrors = validateContext(params.context);
    if (contextErrors.length > 0) {
      throw new Error(`Invalid escalation context: ${contextErrors.join('; ')}`);
    }

    const item = createEscalationItem({
      reason: params.reason,
      priority: params.priority,
      chain,
      context: params.context,
      startLevel: params.startLevel,
    });

    this.persistItem(item, params.workflowState ?? null);
    this.persistAuditEntries(item.auditTrail, item);

    this.broadcast('escalation:created', item);
    return item;
  }

  /**
   * Evaluate confidence and auto-create escalation if below threshold.
   * Returns the created item or null if no escalation needed.
   */
  evaluateAndEscalate(params: {
    confidenceScore: number;
    agentRole?: string;
    context: EscalationContext;
    workflowState?: string;
  }): EscalationItem | null {
    const thresholds = this.listThresholds();
    const matched = evaluateConfidence(params.confidenceScore, thresholds, params.agentRole);
    if (!matched) return null;

    // Find a chain that has the matched escalation level
    const chains = this.listChains();
    const chain = chains.find((c) => c.levels.some((l) => l.level === matched.escalationLevel));
    if (!chain) return null;

    return this.create({
      reason: 'low_confidence',
      priority:
        params.confidenceScore < 0.3
          ? 'critical'
          : params.confidenceScore < 0.5
            ? 'high'
            : 'medium',
      chainId: chain.id,
      context: params.context,
      workflowState: params.workflowState,
      startLevel: matched.escalationLevel,
    });
  }

  getById(id: string): EscalationItem | null {
    const row = this.db.prepare('SELECT * FROM escalations WHERE id = ?').get(id) as
      | EscalationRow
      | undefined;
    if (!row) return null;
    return this.rowToItem(row);
  }

  /**
   * List escalation items with filters and pagination.
   */
  list(filter: EscalationFilter = {}): PaginatedResult<EscalationItem> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      conditions.push('e.status = ?');
      params.push(filter.status);
    }
    if (filter.priority) {
      conditions.push('e.priority = ?');
      params.push(filter.priority);
    }
    if (filter.chainId) {
      conditions.push('e.chain_id = ?');
      params.push(filter.chainId);
    }
    if (filter.claimedBy) {
      conditions.push('e.claimed_by = ?');
      params.push(filter.claimedBy);
    }
    if (filter.agentId) {
      conditions.push("json_extract(e.context, '$.agentId') = ?");
      params.push(filter.agentId);
    }
    if (filter.workflowId) {
      conditions.push("json_extract(e.context, '$.workflowId') = ?");
      params.push(filter.workflowId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM escalations e ${where}`)
      .get(...params) as { cnt: number };

    const rows = this.db
      .prepare(
        `SELECT e.* FROM escalations e ${where} ORDER BY
          CASE e.priority
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
          END,
          e.created_at DESC
        LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as EscalationRow[];

    return {
      items: rows.map((r) => this.rowToItem(r)),
      total: countRow.cnt,
      limit,
      offset,
    };
  }

  // ── Review Actions ────────────────────────────────────────────

  claim(id: string, reviewerId: string): EscalationItem {
    const row = this.db.prepare('SELECT * FROM escalations WHERE id = ?').get(id) as
      | EscalationRow
      | undefined;
    if (!row) throw new Error(`Escalation not found: ${id}`);

    const chain = this.getChain(row.chain_id);
    if (!chain) throw new Error(`Escalation chain not found: ${row.chain_id}`);

    const before = this.rowToItem(row);
    const after = claimEscalationItem(before, reviewerId, chain);

    this.updateItem(after);
    this.persistNewAuditEntries(before, after);

    this.broadcast('escalation:claimed', after);
    return after;
  }

  approve(id: string, reviewerId: string, comment?: string): EscalationItem {
    const row = this.db.prepare('SELECT * FROM escalations WHERE id = ?').get(id) as
      | EscalationRow
      | undefined;
    if (!row) throw new Error(`Escalation not found: ${id}`);

    const before = this.rowToItem(row);
    const after = approveEscalationItem(before, reviewerId, comment);

    this.updateItem(after);
    this.persistNewAuditEntries(before, after);

    this.broadcast('escalation:approved', after);
    return after;
  }

  reject(id: string, reviewerId: string, comment?: string): EscalationItem {
    const row = this.db.prepare('SELECT * FROM escalations WHERE id = ?').get(id) as
      | EscalationRow
      | undefined;
    if (!row) throw new Error(`Escalation not found: ${id}`);

    const before = this.rowToItem(row);
    const after = rejectEscalationItem(before, reviewerId, comment);

    this.updateItem(after);
    this.persistNewAuditEntries(before, after);

    this.broadcast('escalation:rejected', after);
    return after;
  }

  /**
   * Request changes on a claimed escalation. Returns it to pending
   * at the same level so the agent can revise.
   */
  requestChanges(id: string, reviewerId: string, comment: string): EscalationItem {
    const row = this.db.prepare('SELECT * FROM escalations WHERE id = ?').get(id) as
      | EscalationRow
      | undefined;
    if (!row) throw new Error(`Escalation not found: ${id}`);

    const before = this.rowToItem(row);
    if (before.status !== 'claimed') {
      throw new Error(
        `Cannot request changes on item in status "${before.status}". Must be "claimed".`,
      );
    }
    if (before.claimedBy !== reviewerId) {
      throw new Error(
        `Reviewer "${reviewerId}" cannot request changes — item is claimed by "${before.claimedBy}".`,
      );
    }

    const now = new Date().toISOString();
    const auditEntry: AuditEntry = {
      id: generateId('audit'),
      escalationId: id,
      action: 'context_updated',
      actor: reviewerId,
      timestamp: now,
      details: `Changes requested: ${comment}`,
      previousStatus: 'claimed',
      newStatus: 'pending',
    };

    const after: EscalationItem = {
      ...before,
      status: 'pending',
      claimedBy: null,
      claimedAt: null,
      reviewComment: comment,
      updatedAt: now,
      auditTrail: [...before.auditTrail, auditEntry],
    };

    this.updateItem(after);
    this.persistAuditEntry(auditEntry, before, after);

    this.broadcast('escalation:changes_requested', after);
    return after;
  }

  // ── Timeout Processing ────────────────────────────────────────

  /**
   * Check all pending escalations for timeouts. Auto-escalates to
   * the next chain level or marks as timed_out if no next level.
   * Returns all items that were processed.
   */
  processTimeouts(): EscalationItem[] {
    const now = new Date().toISOString();
    const rows = this.db
      .prepare("SELECT * FROM escalations WHERE status = 'pending' AND timeout_at <= ?")
      .all(now) as EscalationRow[];

    const processed: EscalationItem[] = [];

    for (const row of rows) {
      const before = this.rowToItem(row);
      const chain = this.getChain(row.chain_id);
      if (!chain) continue;

      if (!isTimedOut(before, now)) continue;

      const escalated = autoEscalate(before, chain, now);

      if (escalated) {
        this.updateItem(escalated);
        this.persistNewAuditEntries(before, escalated);
        this.broadcast('escalation:auto_escalated', escalated);
        processed.push(escalated);
      } else {
        // No next level — mark as timed_out
        const timedOutEntry: AuditEntry = {
          id: generateId('audit'),
          escalationId: before.id,
          action: 'timed_out',
          actor: 'system',
          timestamp: now,
          details: `Final level ${before.currentLevel} timed out — no further escalation levels`,
          previousStatus: before.status,
          newStatus: 'timed_out',
        };

        const timedOut: EscalationItem = {
          ...before,
          status: 'timed_out',
          updatedAt: now,
          auditTrail: [...before.auditTrail, timedOutEntry],
        };

        this.updateItem(timedOut);
        this.persistAuditEntry(timedOutEntry, before, timedOut);
        this.broadcast('escalation:timed_out', timedOut);
        processed.push(timedOut);
      }
    }

    return processed;
  }

  // ── Workflow State ────────────────────────────────────────────

  getWorkflowState(escalationId: string): string | null {
    const row = this.db
      .prepare('SELECT workflow_state FROM escalations WHERE id = ?')
      .get(escalationId) as { workflow_state: string | null } | undefined;
    return row?.workflow_state ?? null;
  }

  // ── Audit Trail ───────────────────────────────────────────────

  getAuditTrail(escalationId: string): AuditEntry[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM escalation_audit_trail WHERE escalation_id = ? ORDER BY timestamp ASC',
      )
      .all(escalationId) as AuditRow[];
    return rows.map(this.auditRowToEntry);
  }

  queryAuditTrail(
    filter: AuditFilter = {},
  ): PaginatedResult<AuditEntry & { snapshotBefore?: unknown; snapshotAfter?: unknown }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.escalationId) {
      conditions.push('escalation_id = ?');
      params.push(filter.escalationId);
    }
    if (filter.action) {
      conditions.push('action = ?');
      params.push(filter.action);
    }
    if (filter.actor) {
      conditions.push('actor = ?');
      params.push(filter.actor);
    }
    if (filter.from) {
      conditions.push('timestamp >= ?');
      params.push(filter.from);
    }
    if (filter.to) {
      conditions.push('timestamp <= ?');
      params.push(filter.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM escalation_audit_trail ${where}`)
      .get(...params) as { cnt: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM escalation_audit_trail ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as AuditRow[];

    return {
      items: rows.map((r) => ({
        ...this.auditRowToEntry(r),
        snapshotBefore: r.snapshot_before ? JSON.parse(r.snapshot_before) : undefined,
        snapshotAfter: r.snapshot_after ? JSON.parse(r.snapshot_after) : undefined,
      })),
      total: countRow.cnt,
      limit,
      offset,
    };
  }

  // ── Private Helpers ───────────────────────────────────────────

  private persistItem(item: EscalationItem, workflowState: string | null): void {
    this.db
      .prepare(
        `INSERT INTO escalations
          (id, status, reason, priority, chain_id, current_level, context,
           workflow_state, claimed_by, claimed_at, created_at, updated_at,
           timeout_at, review_comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        item.id,
        item.status,
        item.reason,
        item.priority,
        item.chainId,
        item.currentLevel,
        JSON.stringify(item.context),
        workflowState,
        item.claimedBy,
        item.claimedAt,
        item.createdAt,
        item.updatedAt,
        item.timeoutAt,
        item.reviewComment,
      );
  }

  private updateItem(item: EscalationItem): void {
    this.db
      .prepare(
        `UPDATE escalations SET
           status = ?, current_level = ?, claimed_by = ?, claimed_at = ?,
           updated_at = ?, timeout_at = ?, review_comment = ?
         WHERE id = ?`,
      )
      .run(
        item.status,
        item.currentLevel,
        item.claimedBy,
        item.claimedAt,
        item.updatedAt,
        item.timeoutAt,
        item.reviewComment,
        item.id,
      );
  }

  private persistAuditEntries(entries: AuditEntry[], itemAfter: EscalationItem): void {
    const insert = this.db.prepare(
      `INSERT INTO escalation_audit_trail
         (id, escalation_id, action, actor, timestamp, details,
          previous_status, new_status, snapshot_before, snapshot_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const entry of entries) {
      insert.run(
        entry.id,
        entry.escalationId,
        entry.action,
        entry.actor,
        entry.timestamp,
        entry.details ?? null,
        entry.previousStatus ?? null,
        entry.newStatus ?? null,
        null,
        JSON.stringify(this.itemSnapshot(itemAfter)),
      );
    }
  }

  private persistAuditEntry(
    entry: AuditEntry,
    before: EscalationItem,
    after: EscalationItem,
  ): void {
    this.db
      .prepare(
        `INSERT INTO escalation_audit_trail
           (id, escalation_id, action, actor, timestamp, details,
            previous_status, new_status, snapshot_before, snapshot_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.escalationId,
        entry.action,
        entry.actor,
        entry.timestamp,
        entry.details ?? null,
        entry.previousStatus ?? null,
        entry.newStatus ?? null,
        JSON.stringify(this.itemSnapshot(before)),
        JSON.stringify(this.itemSnapshot(after)),
      );
  }

  private persistNewAuditEntries(before: EscalationItem, after: EscalationItem): void {
    const existingIds = new Set(before.auditTrail.map((e) => e.id));
    const newEntries = after.auditTrail.filter((e) => !existingIds.has(e.id));

    for (const entry of newEntries) {
      this.persistAuditEntry(entry, before, after);
    }
  }

  private itemSnapshot(item: EscalationItem): Record<string, unknown> {
    return {
      id: item.id,
      status: item.status,
      priority: item.priority,
      currentLevel: item.currentLevel,
      claimedBy: item.claimedBy,
      reviewComment: item.reviewComment,
    };
  }

  private rowToItem(row: EscalationRow): EscalationItem {
    const auditRows = this.db
      .prepare(
        'SELECT * FROM escalation_audit_trail WHERE escalation_id = ? ORDER BY timestamp ASC',
      )
      .all(row.id) as AuditRow[];

    return {
      id: row.id,
      status: row.status as EscalationStatus,
      reason: row.reason as EscalationReason,
      priority: row.priority as EscalationPriority,
      chainId: row.chain_id,
      currentLevel: row.current_level,
      context: JSON.parse(row.context) as EscalationContext,
      claimedBy: row.claimed_by,
      claimedAt: row.claimed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      timeoutAt: row.timeout_at,
      reviewComment: row.review_comment,
      auditTrail: auditRows.map(this.auditRowToEntry),
    };
  }

  private auditRowToEntry(row: AuditRow): AuditEntry {
    return {
      id: row.id,
      escalationId: row.escalation_id,
      action: row.action as AuditEntry['action'],
      actor: row.actor,
      timestamp: row.timestamp,
      details: row.details ?? undefined,
      previousStatus: (row.previous_status as EscalationStatus) ?? undefined,
      newStatus: (row.new_status as EscalationStatus) ?? undefined,
    };
  }

  private broadcast(type: string, item: EscalationItem): void {
    if (!this.wsManager) return;

    const envelope: WsEnvelope = {
      type: type as WsEnvelope['type'],
      payload: item as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    };
    this.wsManager.broadcast(envelope);
  }
}

// ── Row types ───────────────────────────────────────────────────────

interface EscalationRow {
  id: string;
  status: string;
  reason: string;
  priority: string;
  chain_id: string;
  current_level: number;
  context: string;
  workflow_state: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
  timeout_at: string;
  review_comment: string | null;
}

interface AuditRow {
  id: string;
  escalation_id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string | null;
  previous_status: string | null;
  new_status: string | null;
  snapshot_before: string | null;
  snapshot_after: string | null;
}

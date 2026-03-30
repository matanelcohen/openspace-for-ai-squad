/**
 * Escalations API — HITL escalation engine, review queue, and audit trail.
 *
 * Escalation Items:
 *   POST   /api/escalations                   — Create escalation
 *   POST   /api/escalations/evaluate           — Evaluate confidence & auto-escalate
 *   POST   /api/escalations/check-timeouts     — Process timed-out escalations
 *   GET    /api/escalations                    — List with filters & pagination
 *   GET    /api/escalations/:id                — Get escalation detail
 *   POST   /api/escalations/:id/claim          — Claim for review
 *   POST   /api/escalations/:id/approve        — Approve
 *   POST   /api/escalations/:id/reject         — Reject
 *   POST   /api/escalations/:id/request-changes — Request changes
 *   GET    /api/escalations/:id/audit           — Get audit trail for item
 *   GET    /api/escalations/:id/workflow-state  — Get serialized workflow state
 *
 * Chains:
 *   POST   /api/escalation-chains              — Create chain
 *   GET    /api/escalation-chains              — List chains
 *   GET    /api/escalation-chains/:id          — Get chain
 *   PUT    /api/escalation-chains/:id          — Update chain
 *   DELETE /api/escalation-chains/:id          — Delete chain
 *
 * Thresholds:
 *   POST   /api/escalation-thresholds          — Create threshold
 *   GET    /api/escalation-thresholds          — List thresholds
 *   DELETE /api/escalation-thresholds/:id      — Delete threshold
 *
 * Audit Trail:
 *   GET    /api/audit-trail                    — Query all audit entries
 */

import type {
  EscalationContext,
  EscalationPriority,
  EscalationReason,
  EscalationStatus,
} from '@matanelcohen/openspace-shared';
import type { FastifyPluginAsync } from 'fastify';

const VALID_STATUSES: EscalationStatus[] = [
  'pending',
  'claimed',
  'approved',
  'rejected',
  'timed_out',
  'auto_escalated',
];
const VALID_PRIORITIES: EscalationPriority[] = ['critical', 'high', 'medium', 'low'];
const VALID_REASONS: EscalationReason[] = [
  'low_confidence',
  'explicit_request',
  'policy_violation',
  'timeout',
  'chain_escalation',
];

// ── Route Plugin ────────────────────────────────────────────────────

const escalationsRoute: FastifyPluginAsync = async (app) => {
  // ── Escalation Items ──────────────────────────────────────────

  // POST /api/escalations — create
  app.post<{
    Body: {
      reason: EscalationReason;
      priority: EscalationPriority;
      chainId: string;
      context: EscalationContext;
      workflowState?: string;
      startLevel?: number;
    };
  }>('/escalations', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }
    if (!body.reason || !VALID_REASONS.includes(body.reason)) {
      return reply.status(400).send({ error: `Invalid reason: ${body.reason}` });
    }
    if (!body.priority || !VALID_PRIORITIES.includes(body.priority)) {
      return reply.status(400).send({ error: `Invalid priority: ${body.priority}` });
    }
    if (!body.chainId || typeof body.chainId !== 'string') {
      return reply.status(400).send({ error: 'chainId is required' });
    }
    if (!body.context || typeof body.context !== 'object') {
      return reply.status(400).send({ error: 'context is required' });
    }

    try {
      const item = app.escalationService.create(body);
      return reply.status(201).send(item);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('not found')) {
        return reply.status(404).send({ error: msg });
      }
      if (msg.includes('Invalid escalation context')) {
        return reply.status(400).send({ error: msg });
      }
      return reply.status(500).send({ error: msg });
    }
  });

  // POST /api/escalations/evaluate — evaluate confidence & auto-create
  app.post<{
    Body: {
      confidenceScore: number;
      agentRole?: string;
      context: EscalationContext;
      workflowState?: string;
    };
  }>('/escalations/evaluate', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }
    if (typeof body.confidenceScore !== 'number') {
      return reply.status(400).send({ error: 'confidenceScore is required and must be a number' });
    }
    if (!body.context || typeof body.context !== 'object') {
      return reply.status(400).send({ error: 'context is required' });
    }

    try {
      const item = app.escalationService.evaluateAndEscalate(body);
      if (!item) {
        return reply.send({ escalated: false, item: null });
      }
      return reply.status(201).send({ escalated: true, item });
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  // POST /api/escalations/check-timeouts — process timed-out escalations
  app.post('/escalations/check-timeouts', async (_request, reply) => {
    const processed = app.escalationService.processTimeouts();
    return reply.send({ processed: processed.length, items: processed });
  });

  // GET /api/escalations — list with filters
  app.get<{
    Querystring: {
      status?: string;
      priority?: string;
      chainId?: string;
      claimedBy?: string;
      agentId?: string;
      workflowId?: string;
      limit?: string;
      offset?: string;
    };
  }>('/escalations', async (request, reply) => {
    const q = request.query;

    if (q.status && !VALID_STATUSES.includes(q.status as EscalationStatus)) {
      return reply.status(400).send({ error: `Invalid status filter: ${q.status}` });
    }
    if (q.priority && !VALID_PRIORITIES.includes(q.priority as EscalationPriority)) {
      return reply.status(400).send({ error: `Invalid priority filter: ${q.priority}` });
    }

    const result = app.escalationService.list({
      status: q.status as EscalationStatus | undefined,
      priority: q.priority as EscalationPriority | undefined,
      chainId: q.chainId,
      claimedBy: q.claimedBy,
      agentId: q.agentId,
      workflowId: q.workflowId,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });

    return reply.send(result);
  });

  // GET /api/escalations/:id — detail
  app.get<{ Params: { id: string } }>('/escalations/:id', async (request, reply) => {
    const item = app.escalationService.getById(request.params.id);
    if (!item) {
      return reply.status(404).send({ error: `Escalation not found: ${request.params.id}` });
    }
    return reply.send(item);
  });

  // POST /api/escalations/:id/claim — claim for review
  app.post<{ Params: { id: string }; Body: { reviewerId: string } }>(
    '/escalations/:id/claim',
    async (request, reply) => {
      const { reviewerId } = request.body ?? {};
      if (!reviewerId || typeof reviewerId !== 'string') {
        return reply.status(400).send({ error: 'reviewerId is required' });
      }
      try {
        const item = app.escalationService.claim(request.params.id, reviewerId);
        return reply.send(item);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: msg });
        }
        return reply.status(400).send({ error: msg });
      }
    },
  );

  // POST /api/escalations/:id/approve
  app.post<{ Params: { id: string }; Body: { reviewerId: string; comment?: string } }>(
    '/escalations/:id/approve',
    async (request, reply) => {
      const { reviewerId, comment } = request.body ?? {};
      if (!reviewerId || typeof reviewerId !== 'string') {
        return reply.status(400).send({ error: 'reviewerId is required' });
      }
      try {
        const item = app.escalationService.approve(request.params.id, reviewerId, comment);
        return reply.send(item);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: msg });
        }
        return reply.status(400).send({ error: msg });
      }
    },
  );

  // POST /api/escalations/:id/reject
  app.post<{ Params: { id: string }; Body: { reviewerId: string; comment?: string } }>(
    '/escalations/:id/reject',
    async (request, reply) => {
      const { reviewerId, comment } = request.body ?? {};
      if (!reviewerId || typeof reviewerId !== 'string') {
        return reply.status(400).send({ error: 'reviewerId is required' });
      }
      try {
        const item = app.escalationService.reject(request.params.id, reviewerId, comment);
        return reply.send(item);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: msg });
        }
        return reply.status(400).send({ error: msg });
      }
    },
  );

  // POST /api/escalations/:id/request-changes
  app.post<{ Params: { id: string }; Body: { reviewerId: string; comment: string } }>(
    '/escalations/:id/request-changes',
    async (request, reply) => {
      const { reviewerId, comment } = request.body ?? {};
      if (!reviewerId || typeof reviewerId !== 'string') {
        return reply.status(400).send({ error: 'reviewerId is required' });
      }
      if (!comment || typeof comment !== 'string') {
        return reply.status(400).send({ error: 'comment is required' });
      }
      try {
        const item = app.escalationService.requestChanges(
          request.params.id,
          reviewerId,
          comment,
        );
        return reply.send(item);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: msg });
        }
        return reply.status(400).send({ error: msg });
      }
    },
  );

  // GET /api/escalations/:id/audit — audit trail for a specific item
  app.get<{ Params: { id: string } }>('/escalations/:id/audit', async (request, reply) => {
    const trail = app.escalationService.getAuditTrail(request.params.id);
    return reply.send({ entries: trail });
  });

  // GET /api/escalations/:id/workflow-state — get serialized workflow state
  app.get<{ Params: { id: string } }>(
    '/escalations/:id/workflow-state',
    async (request, reply) => {
      const state = app.escalationService.getWorkflowState(request.params.id);
      if (state === null) {
        return reply
          .status(404)
          .send({ error: `No workflow state for escalation: ${request.params.id}` });
      }
      return reply.send({ workflowState: JSON.parse(state) });
    },
  );

  // ── Escalation Chains ─────────────────────────────────────────

  // POST /api/escalation-chains
  app.post<{
    Body: { id: string; name: string; levels: Array<{ level: number; name: string; reviewerIds: string[]; timeoutMs: number }> };
  }>('/escalation-chains', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }
    if (!body.id || typeof body.id !== 'string') {
      return reply.status(400).send({ error: 'id is required' });
    }
    if (!body.name || typeof body.name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (!Array.isArray(body.levels) || body.levels.length === 0) {
      return reply.status(400).send({ error: 'levels must be a non-empty array' });
    }

    try {
      const chain = app.escalationService.createChain(body);
      return reply.status(201).send(chain);
    } catch (err) {
      return reply.status(409).send({ error: (err as Error).message });
    }
  });

  // GET /api/escalation-chains
  app.get('/escalation-chains', async (_request, reply) => {
    const chains = app.escalationService.listChains();
    return reply.send(chains);
  });

  // GET /api/escalation-chains/:id
  app.get<{ Params: { id: string } }>('/escalation-chains/:id', async (request, reply) => {
    const chain = app.escalationService.getChain(request.params.id);
    if (!chain) {
      return reply
        .status(404)
        .send({ error: `Escalation chain not found: ${request.params.id}` });
    }
    return reply.send(chain);
  });

  // PUT /api/escalation-chains/:id
  app.put<{
    Params: { id: string };
    Body: { name?: string; levels?: Array<{ level: number; name: string; reviewerIds: string[]; timeoutMs: number }> };
  }>('/escalation-chains/:id', async (request, reply) => {
    const updated = app.escalationService.updateChain(request.params.id, request.body);
    if (!updated) {
      return reply
        .status(404)
        .send({ error: `Escalation chain not found: ${request.params.id}` });
    }
    return reply.send(updated);
  });

  // DELETE /api/escalation-chains/:id
  app.delete<{ Params: { id: string } }>('/escalation-chains/:id', async (request, reply) => {
    const deleted = app.escalationService.deleteChain(request.params.id);
    if (!deleted) {
      return reply
        .status(404)
        .send({ error: `Escalation chain not found: ${request.params.id}` });
    }
    return reply.status(204).send();
  });

  // ── Confidence Thresholds ─────────────────────────────────────

  // POST /api/escalation-thresholds
  app.post<{
    Body: { threshold: number; escalationLevel: number; agentRoles?: string[] };
  }>('/escalation-thresholds', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }
    if (typeof body.threshold !== 'number' || body.threshold < 0 || body.threshold > 1) {
      return reply.status(400).send({ error: 'threshold must be a number between 0 and 1' });
    }
    if (typeof body.escalationLevel !== 'number') {
      return reply.status(400).send({ error: 'escalationLevel is required' });
    }

    const created = app.escalationService.createThreshold(body);
    return reply.status(201).send(created);
  });

  // GET /api/escalation-thresholds
  app.get('/escalation-thresholds', async (_request, reply) => {
    const thresholds = app.escalationService.listThresholds();
    return reply.send(thresholds);
  });

  // DELETE /api/escalation-thresholds/:id
  app.delete<{ Params: { id: string } }>(
    '/escalation-thresholds/:id',
    async (request, reply) => {
      const deleted = app.escalationService.deleteThreshold(parseInt(request.params.id, 10));
      if (!deleted) {
        return reply.status(404).send({ error: `Threshold not found: ${request.params.id}` });
      }
      return reply.status(204).send();
    },
  );

  // ── Global Audit Trail ────────────────────────────────────────

  // GET /api/audit-trail — query all audit entries
  app.get<{
    Querystring: {
      escalationId?: string;
      action?: string;
      actor?: string;
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
    };
  }>('/audit-trail', async (request, reply) => {
    const q = request.query;
    const result = app.escalationService.queryAuditTrail({
      escalationId: q.escalationId,
      action: q.action,
      actor: q.actor,
      from: q.from,
      to: q.to,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
    return reply.send(result);
  });
};

export default escalationsRoute;

/**
 * Knowledge Search API — Similarity search and retrieval for agents.
 *
 * POST /api/knowledge/search    — Full hybrid search with filters
 * POST /api/knowledge/retrieve  — Agent-scoped context retrieval
 * GET  /api/knowledge/stats     — Knowledge base statistics
 */

import type { ChunkFilter, RAGSearchRequest } from '@openspace/shared';
import type { FastifyPluginAsync } from 'fastify';

import { ErrorCodes, sendError } from '../lib/api-errors.js';

// ── Request / Response schemas (for validation) ────────────────────

interface SearchBody {
  query: string;
  agentId?: string;
  filters?: ChunkFilter;
  limit?: number;
  tokenBudget?: number;
  includeMemories?: boolean;
  hybridSearch?: boolean;
}

interface RetrieveBody {
  agentId: string;
  query: string;
  filters?: ChunkFilter;
  limit?: number;
  tokenBudget?: number;
}

// ── Route ──────────────────────────────────────────────────────────

const knowledgeRoute: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/knowledge/search
   *
   * Full-featured similarity search with configurable top-k, score thresholds,
   * metadata filtering, hybrid search, and reranking.
   *
   * Body: RAGSearchRequest
   * Returns: RAGSearchResponse
   */
  app.post<{ Body: SearchBody }>('/knowledge/search', async (request, reply) => {
    const { query, agentId, filters, limit, tokenBudget, includeMemories, hybridSearch } =
      request.body ?? {};

    if (!query || typeof query !== 'string' || !query.trim()) {
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, 'Field "query" is required');
    }

    if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Field "limit" must be a number between 1 and 100',
      );
    }

    if (tokenBudget !== undefined && (typeof tokenBudget !== 'number' || tokenBudget < 1)) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Field "tokenBudget" must be a positive number',
      );
    }

    const searchRequest: RAGSearchRequest = {
      query: query.trim(),
      agentId,
      filters,
      limit,
      tokenBudget,
      includeMemories,
      hybridSearch,
    };

    const result = await app.knowledgeSearch.search(searchRequest);
    return reply.send(result);
  });

  /**
   * POST /api/knowledge/retrieve
   *
   * Agent-scoped context retrieval. Returns chunks relevant to the query,
   * scoped to the agent's knowledge domain.
   *
   * Body: { agentId, query, filters?, limit?, tokenBudget? }
   * Returns: RetrievalContext
   */
  app.post<{ Body: RetrieveBody }>('/knowledge/retrieve', async (request, reply) => {
    const { agentId, query, filters, limit, tokenBudget } = request.body ?? {};

    if (!agentId || typeof agentId !== 'string') {
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, 'Field "agentId" is required');
    }

    if (!query || typeof query !== 'string' || !query.trim()) {
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, 'Field "query" is required');
    }

    const context = await app.knowledgeSearch.retrieveForAgent(agentId, query.trim(), {
      filters,
      limit,
      tokenBudget,
    });

    return reply.send(context);
  });

  /**
   * GET /api/knowledge/stats
   *
   * Returns knowledge base statistics: total chunks, chunks by source type,
   * embedding count, and last ingestion timestamp.
   */
  app.get('/knowledge/stats', async (_request, reply) => {
    const stats = app.knowledgeSearch.getStats();
    return reply.send(stats);
  });
};

export default knowledgeRoute;

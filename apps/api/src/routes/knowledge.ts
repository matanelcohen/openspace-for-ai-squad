/**
 * Knowledge Search API — Similarity search and retrieval for agents.
 *
 * POST /api/knowledge/search    — Full hybrid search with filters
 * POST /api/knowledge/retrieve  — Agent-scoped context retrieval
 * GET  /api/knowledge/stats     — Knowledge base statistics
 */

import type { ChunkFilter, RAGSearchRequest } from '@matanelcohen/openspace-shared';
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

  /**
   * POST /api/knowledge/ingest
   *
   * Starts ingestion as a background job. Returns immediately.
   * Progress broadcast via WebSocket: knowledge:progress, knowledge:complete, knowledge:error.
   */
  app.post('/knowledge/ingest', async (_request, reply) => {
    const active = app.workspaceService?.getActive?.();
    const squadDir = active?.squadDir ?? '.squad';
    const projectDir = active?.projectDir ?? process.cwd();

    // Return immediately
    reply.send({ success: true, status: 'started', message: 'Ingestion running in background' });

    // Run in background
    setImmediate(async () => {
      try {
        const { IngestionPipeline } = await import('../services/ingestion/pipeline.js');
        const { DocsConnector, TasksConnector, GitCommitsConnector, PullRequestsConnector, ChatConnector, MemoriesConnector, ChartersConnector } = await import('../services/ingestion/connectors/index.js');
        const { migration_v3 } = await import('../services/ingestion/migration-v3.js');

        migration_v3(app.db);

        let embedder: import('@matanelcohen/openspace-shared').Embedder | undefined;
        try {
          const { LocalEmbedder } = await import('../services/embeddings/local-embedder.js');
          embedder = new LocalEmbedder();
        } catch { /* no embedder */ }

        const pipeline = new IngestionPipeline({ db: app.db, embedder, embeddingBatchSize: 5 });

        pipeline.registerConnector(new DocsConnector({ repoPath: projectDir, squadDir, scanPaths: ['docs', squadDir, 'README.md'] }));
        pipeline.registerConnector(new TasksConnector({ squadDir }));
        pipeline.registerConnector(new GitCommitsConnector({ repoPath: projectDir, includeDiffs: false, maxCommits: 200 }));
        pipeline.registerConnector(new PullRequestsConnector({ repoPath: projectDir, maxPRs: 50 }));
        pipeline.registerConnector(new ChatConnector({ db: app.db, workspaceId: active?.id ?? '' }));
        pipeline.registerConnector(new MemoriesConnector({ db: app.db }));
        pipeline.registerConnector(new ChartersConnector({ squadDir }));

        // Process each source type one at a time, broadcasting progress
        for (const sourceType of pipeline.getSourceTypes()) {
          try {
            const result = await pipeline.ingestSourceType(sourceType, { squadDir, projectDir });

            if (app.wsManager) {
              app.wsManager.broadcast(JSON.stringify({
                type: 'knowledge:progress',
                sourceType,
                documentsProcessed: (result as Record<string, unknown>).documentsProcessed ?? 0,
                chunksCreated: (result as Record<string, unknown>).chunksCreated ?? 0,
              }));
            }
            app.log.info(`[Knowledge] ${sourceType}: ${(result as Record<string, unknown>).chunksCreated ?? 0} chunks`);
          } catch (err) {
            app.log.warn(`[Knowledge] ${sourceType} failed: ${(err as Error).message}`);
          }
        }

        if (app.wsManager) {
          app.wsManager.broadcast(JSON.stringify({ type: 'knowledge:complete' }));
        }
        app.log.info('[Knowledge] Background ingestion complete');
      } catch (err) {
        app.log.error(`[Knowledge] Ingestion failed: ${(err as Error).message}`);
        if (app.wsManager) {
          app.wsManager.broadcast(JSON.stringify({ type: 'knowledge:error', error: (err as Error).message }));
        }
      }
    });
  });
};

export default knowledgeRoute;

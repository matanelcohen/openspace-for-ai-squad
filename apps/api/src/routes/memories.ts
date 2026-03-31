/**
 * Memories API — CRUD, search, and lifecycle management for agent memories.
 *
 * GET    /api/memories              — List all memories (filter by agentId, type)
 * POST   /api/memories              — Create a new memory
 * GET    /api/memories/settings     — Get memory settings + stats
 * PATCH  /api/memories/settings     — Update memory settings (global/per-agent enable)
 * POST   /api/memories/sync         — Sync history.md files into memory store
 * POST   /api/memories/search       — Semantic/FTS hybrid search
 * POST   /api/memories/consolidate  — Trigger decay + archive weak memories
 * PATCH  /api/memories/:id          — Update a memory
 * DELETE /api/memories/:id          — Delete a memory
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { hasMemorySchema, initializeMemorySchema, MemoryStoreService } from '@matanelcohen/openspace-memory-store';
import type { MemoryCreateInput, MemorySearchRequest, MemoryType } from '@matanelcohen/openspace-shared';
import type { FastifyPluginAsync } from 'fastify';

// ── Settings persistence ────────────────────────────────────────

const SETTINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS memory_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

interface MemorySettingsRow {
  key: string;
  value: string;
}

const memoriesRoute: FastifyPluginAsync = async (app) => {
  // Ensure schema exists
  if (!hasMemorySchema(app.db)) {
    initializeMemorySchema(app.db);
  }
  app.db.exec(SETTINGS_TABLE_SQL);

  const store = new MemoryStoreService(app.db, {});

  // ── Settings helpers ──────────────────────────────────────────

  function getSetting(key: string): string | null {
    const row = app.db
      .prepare<[string], MemorySettingsRow>('SELECT value FROM memory_settings WHERE key = ?')
      .get(key);
    return row?.value ?? null;
  }

  function setSetting(key: string, value: string): void {
    app.db
      .prepare('INSERT OR REPLACE INTO memory_settings (key, value) VALUES (?, ?)')
      .run(key, value);
  }

  function isGlobalEnabled(): boolean {
    return getSetting('global_enabled') !== 'false';
  }

  function _isAgentEnabled(agentId: string): boolean {
    const val = getSetting(`agent_enabled:${agentId}`);
    return val !== 'false'; // enabled by default
  }

  // ── History.md parsing ────────────────────────────────────────

  /** Parse history.md and return all learning entries (bullet points under ## Learnings). */
  function parseHistoryEntries(content: string): Array<{ text: string }> {
    const entries: Array<{ text: string }> = [];

    // Find the ## Learnings section
    const learningsMatch = content.match(/^##\s+Learnings\b/im);
    if (!learningsMatch || learningsMatch.index === undefined) return entries;

    const afterLearnings = content.slice(learningsMatch.index + learningsMatch[0].length);
    // Stop at next ## heading
    const nextSection = afterLearnings.match(/^##\s+/m);
    const learningsContent = nextSection?.index
      ? afterLearnings.slice(0, nextSection.index)
      : afterLearnings;

    // Extract every bullet point (may span multiple lines)
    let currentEntry = '';
    for (const line of learningsContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('<!--') || trimmed.endsWith('-->') || trimmed.length === 0) {
        if (currentEntry) {
          entries.push({ text: currentEntry.trim() });
          currentEntry = '';
        }
        continue;
      }
      if (trimmed.startsWith('- ')) {
        if (currentEntry) entries.push({ text: currentEntry.trim() });
        currentEntry = trimmed.slice(2);
      } else if (currentEntry) {
        currentEntry += ' ' + trimmed;
      }
    }
    if (currentEntry) entries.push({ text: currentEntry.trim() });

    return entries;
  }

  /** Sync all history.md files into the memory store. */
  async function syncHistories(): Promise<{ synced: number; skipped: number }> {
    const active = app.workspaceService?.getActive?.();
    const squadDir = active?.squadDir ?? '.squad';
    const agentsDir = join(squadDir, 'agents');

    if (!existsSync(agentsDir)) return { synced: 0, skipped: 0 };

    let synced = 0;
    let skipped = 0;

    const agentDirs = readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const dir of agentDirs) {
      const historyPath = join(agentsDir, dir.name, 'history.md');
      if (!existsSync(historyPath)) continue;

      const content = readFileSync(historyPath, 'utf-8');
      const entries = parseHistoryEntries(content);

      for (const entry of entries) {
        // Check if already exists (by content hash)
        const existing = store.list(dir.name, 1000);
        const alreadyExists = existing.some((m) => m.content === entry.text);
        if (alreadyExists) {
          skipped++;
          continue;
        }

        try {
          await store.create({
            agentId: dir.name,
            type: 'pattern',
            content: entry.text,
            sourceSession: `history-sync`,
            tags: ['from-history'],
          });
          synced++;
        } catch {
          skipped++;
        }
      }
    }

    return { synced, skipped };
  }

  /** Write memories back to an agent's history.md file. */
  function syncMemoriesToHistory(agentId: string): { written: number } {
    const active = app.workspaceService?.getActive?.();
    const squadDir = active?.squadDir ?? '.squad';
    const historyPath = join(squadDir, 'agents', agentId, 'history.md');

    if (!existsSync(historyPath)) return { written: 0 };

    const content = readFileSync(historyPath, 'utf-8');
    const memories = store.list(agentId, 1000);
    if (memories.length === 0) return { written: 0 };

    // Find existing entries to avoid duplicates
    const existingEntries = new Set<string>();
    const learningsMatch = content.match(/^##\s+Learnings\b/im);
    if (learningsMatch && learningsMatch.index !== undefined) {
      const afterLearnings = content.slice(learningsMatch.index + learningsMatch[0].length);
      const nextSection = afterLearnings.match(/^##\s+/m);
      const learningsContent = nextSection?.index
        ? afterLearnings.slice(0, nextSection.index)
        : afterLearnings;

      for (const line of learningsContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
          existingEntries.add(trimmed.slice(2).trim());
        }
      }
    }

    // Find new memories
    const newEntries: string[] = [];
    for (const mem of memories) {
      if (!existingEntries.has(mem.content)) {
        const alreadyExists = [...existingEntries].some(
          (e) => e.includes(mem.content) || mem.content.includes(e),
        );
        if (!alreadyExists) {
          newEntries.push(`- ${mem.content}`);
        }
      }
    }

    if (newEntries.length === 0) return { written: 0 };

    // Append new entries
    if (learningsMatch && learningsMatch.index !== undefined) {
      const afterLearnings = content.slice(learningsMatch.index + learningsMatch[0].length);
      const nextSection = afterLearnings.match(/^##\s+/m);

      if (nextSection?.index !== undefined) {
        const insertPoint = learningsMatch.index + learningsMatch[0].length + nextSection.index;
        const updated =
          content.slice(0, insertPoint).trimEnd() +
          '\n' +
          newEntries.join('\n') +
          '\n\n' +
          content.slice(insertPoint);
        writeFileSync(historyPath, updated, 'utf-8');
      } else {
        writeFileSync(historyPath, content.trimEnd() + '\n' + newEntries.join('\n') + '\n', 'utf-8');
      }
    } else {
      writeFileSync(
        historyPath,
        content.trimEnd() + '\n\n## Learnings\n\n' + newEntries.join('\n') + '\n',
        'utf-8',
      );
    }

    return { written: newEntries.length };
  }

  // Sync on startup
  syncHistories().then(({ synced, skipped }) => {
    if (synced > 0) console.log(`[Memories] Synced ${synced} entries from history.md (${skipped} skipped)`);
  }).catch(() => {});

  // ── GET /api/memories — list all memories ─────────────────────

  app.get('/memories', async (request, reply) => {
    const { agentId, type, limit, offset } = request.query as {
      agentId?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };
    const lim = Math.min(Number(limit ?? 500), 1000);
    const off = Number(offset ?? 0);

    if (agentId) {
      let results = store.list(agentId, lim, off);
      if (type) {
        results = results.filter((m) => m.type === type);
      }
      return reply.send(results);
    }

    const allMemories: unknown[] = [];
    try {
      const rows = app.db
        .prepare<[], { agent_id: string }>('SELECT DISTINCT agent_id FROM memories WHERE enabled = 1')
        .all();
      for (const row of rows) {
        let agentMems = store.list(row.agent_id, lim);
        if (type) {
          agentMems = agentMems.filter((m) => m.type === type);
        }
        allMemories.push(...agentMems);
      }
    } catch {
      // table might not exist yet
    }
    return reply.send(allMemories);
  });

  // ── POST /api/memories — create a new memory ─────────────────

  app.post<{ Body: MemoryCreateInput }>('/memories', async (request, reply) => {
    const body = request.body;
    if (!body?.agentId || !body?.content || !body?.type) {
      return reply.status(400).send({ error: 'agentId, type, and content are required' });
    }

    const validTypes: MemoryType[] = ['preference', 'pattern', 'decision'];
    if (!validTypes.includes(body.type)) {
      return reply.status(400).send({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    try {
      const memory = await store.create({
        agentId: body.agentId,
        type: body.type,
        content: body.content,
        sourceSession: body.sourceSession || 'api',
        sourceTaskId: body.sourceTaskId,
        tags: body.tags,
        importance: body.importance,
        ttlSeconds: body.ttlSeconds,
      });
      return reply.status(201).send(memory);
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Create failed' });
    }
  });

  // ── POST /api/memories/search — hybrid FTS + semantic search ──

  app.post<{ Body: MemorySearchRequest }>('/memories/search', async (request, reply) => {
    const body = request.body;
    if (!body?.query) {
      return reply.status(400).send({ error: 'query is required' });
    }

    try {
      const response = await store.search({
        query: body.query,
        agentId: body.agentId,
        types: body.types,
        tags: body.tags,
        topK: body.topK ?? 10,
        threshold: body.threshold ?? 0.25,
        hybridSearch: body.hybridSearch ?? true,
      });
      return reply.send(response);
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Search failed' });
    }
  });

  // ── POST /api/memories/consolidate — decay + archive ──────────

  app.post<{ Body: { agentId?: string; strengthThreshold?: number } }>(
    '/memories/consolidate',
    async (request, reply) => {
      const { agentId, strengthThreshold } = request.body ?? {};
      const threshold = strengthThreshold ?? 0.1;

      try {
        if (agentId) {
          const result = store.consolidate(agentId, threshold);
          return reply.send({ agents: { [agentId]: result } });
        }

        // Consolidate all agents
        const agents = app.db
          .prepare<[], { agent_id: string }>('SELECT DISTINCT agent_id FROM memories WHERE enabled = 1')
          .all();

        const results: Record<string, { merged: number; archived: number; remaining: number }> = {};
        for (const row of agents) {
          results[row.agent_id] = store.consolidate(row.agent_id, threshold);
        }

        return reply.send({ agents: results });
      } catch (err) {
        return reply.status(500).send({ error: err instanceof Error ? err.message : 'Consolidation failed' });
      }
    },
  );

  // ── GET /api/memories/settings ────────────────────────────────

  app.get('/memories/settings', async (_request, reply) => {
    const stats = store.stats();

    // Build per-agent settings
    const agentSettings: Record<string, boolean> = {};
    try {
      const rows = app.db
        .prepare<[], MemorySettingsRow>(
          `SELECT key, value FROM memory_settings WHERE key LIKE 'agent_enabled:%'`,
        )
        .all();
      for (const row of rows) {
        const agentId = row.key.replace('agent_enabled:', '');
        agentSettings[agentId] = row.value !== 'false';
      }
    } catch {
      // settings table might be new
    }

    return reply.send({
      globalEnabled: isGlobalEnabled(),
      agentSettings,
      ...stats,
    });
  });

  // ── POST /api/memories/sync — manually trigger history sync ───

  app.post<{ Body: { writeback?: boolean } }>('/memories/sync', async (request, reply) => {
    const result = await syncHistories();

    // Optionally write memories back to history.md files
    if (request.body?.writeback) {
      const active = app.workspaceService?.getActive?.();
      const squadDir = active?.squadDir ?? '.squad';
      const agentsDir = join(squadDir, 'agents');
      let totalWritten = 0;

      if (existsSync(agentsDir)) {
        const agentDirs = readdirSync(agentsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory());
        for (const dir of agentDirs) {
          const { written } = syncMemoriesToHistory(dir.name);
          totalWritten += written;
        }
      }

      return reply.send({ ...result, written: totalWritten });
    }

    return reply.send(result);
  });

  // ── PATCH /api/memories/settings ──────────────────────────────

  app.patch<{ Body: { globalEnabled?: boolean; agentSettings?: Record<string, boolean> } }>(
    '/memories/settings',
    async (request, reply) => {
      const { globalEnabled, agentSettings } = request.body ?? {};

      if (globalEnabled !== undefined) {
        setSetting('global_enabled', String(globalEnabled));
      }

      if (agentSettings) {
        for (const [agentId, enabled] of Object.entries(agentSettings)) {
          setSetting(`agent_enabled:${agentId}`, String(enabled));
        }
      }

      // Return updated settings
      const stats = store.stats();
      const currentAgentSettings: Record<string, boolean> = {};
      try {
        const rows = app.db
          .prepare<[], MemorySettingsRow>(
            `SELECT key, value FROM memory_settings WHERE key LIKE 'agent_enabled:%'`,
          )
          .all();
        for (const row of rows) {
          const aId = row.key.replace('agent_enabled:', '');
          currentAgentSettings[aId] = row.value !== 'false';
        }
      } catch {
        // noop
      }

      return reply.send({
        globalEnabled: isGlobalEnabled(),
        agentSettings: currentAgentSettings,
        ...stats,
      });
    },
  );

  // ── PATCH /api/memories/:id — update content ─────────────────

  app.patch<{ Params: { id: string }; Body: { content?: string; type?: MemoryType; enabled?: boolean } }>(
    '/memories/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { content, type, enabled } = request.body ?? {};
      if (!content && !type && enabled === undefined) {
        return reply.status(400).send({ error: 'At least one of content, type, or enabled is required' });
      }

      const updated = await store.update(id, { content, type, enabled });
      if (!updated) {
        return reply.status(404).send({ error: 'Memory not found' });
      }
      return reply.send(updated);
    },
  );

  // ── DELETE /api/memories/:id ──────────────────────────────────

  app.delete<{ Params: { id: string } }>('/memories/:id', async (request, reply) => {
    const deleted = store.delete(request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Memory not found' });
    }
    return reply.send({ success: true });
  });
};

export default memoriesRoute;

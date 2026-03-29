/**
 * Memories API — CRUD for agent memories, synced from history.md files.
 *
 * GET    /api/memories           — List all memories
 * GET    /api/memories/settings  — Get memory settings
 * POST   /api/memories/sync      — Sync history.md files into memory store
 * PATCH  /api/memories/settings  — Update memory settings
 * PATCH  /api/memories/:id       — Update a memory
 * DELETE /api/memories/:id       — Delete a memory
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { initializeMemorySchema, hasMemorySchema, MemoryStoreService } from '@openspace/memory-store';

const memoriesRoute: FastifyPluginAsync = async (app) => {
  // Ensure schema exists
  if (!hasMemorySchema(app.db)) {
    initializeMemorySchema(app.db);
  }

  const store = new MemoryStoreService(app.db, {});

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

  // Sync on startup
  syncHistories().then(({ synced, skipped }) => {
    if (synced > 0) console.log(`[Memories] Synced ${synced} entries from history.md (${skipped} skipped)`);
  }).catch(() => {});

  // GET /api/memories — list all memories
  app.get('/memories', async (request, reply) => {
    const { agentId, limit, offset } = request.query as { agentId?: string; limit?: string; offset?: string };

    if (agentId) {
      return reply.send(store.list(agentId, Number(limit ?? 500), Number(offset ?? 0)));
    }

    const allMemories: unknown[] = [];
    try {
      const rows = app.db
        .prepare<[], { agent_id: string }>('SELECT DISTINCT agent_id FROM memories WHERE enabled = 1')
        .all();
      for (const row of rows) {
        allMemories.push(...store.list(row.agent_id, Number(limit ?? 500)));
      }
    } catch {
      // table might not exist yet
    }
    return reply.send(allMemories);
  });

  // GET /api/memories/settings
  app.get('/memories/settings', async (_request, reply) => {
    const stats = store.stats();
    return reply.send({
      globalEnabled: true,
      agentSettings: {},
      totalMemories: stats.totalActive,
      ...stats,
    });
  });

  // POST /api/memories/sync — manually trigger history sync
  app.post('/memories/sync', async (_request, reply) => {
    const result = await syncHistories();
    return reply.send(result);
  });

  // PATCH /api/memories/settings
  app.patch('/memories/settings', async (request, reply) => {
    return reply.send({ globalEnabled: true });
  });

  // PATCH /api/memories/:id — update content
  app.patch<{ Params: { id: string }; Body: { content: string } }>(
    '/memories/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { content } = request.body ?? {};
      if (!content) {
        return reply.status(400).send({ error: 'content is required' });
      }

      const updated = await store.update(id, { content });
      if (!updated) {
        return reply.status(404).send({ error: 'Memory not found' });
      }
      return reply.send(updated);
    },
  );

  // DELETE /api/memories/:id
  app.delete<{ Params: { id: string } }>('/memories/:id', async (request, reply) => {
    const deleted = store.delete(request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Memory not found' });
    }
    return reply.send({ success: true });
  });
};

export default memoriesRoute;

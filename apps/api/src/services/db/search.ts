/**
 * Full-text search across the SQLite index layer.
 *
 * Provides search over decisions and tasks using FTS5.
 * Results are ranked by relevance (BM25) and include highlighted snippets.
 */

import type Database from 'better-sqlite3';

// ── Types ──────────────────────────────────────────────────────────

export interface SearchResult {
  /** Source table: 'decision' or 'task'. */
  source: 'decision' | 'task';
  /** Record ID. */
  id: string;
  /** Title of the matching record. */
  title: string;
  /** Highlighted snippet from the matching content. */
  snippet: string;
  /** BM25 relevance rank (lower is more relevant). */
  rank: number;
}

// ── Search functions ───────────────────────────────────────────────

/**
 * Search decisions by full-text query.
 * Matches against title, rationale, and author.
 */
export function searchDecisions(
  db: Database.Database,
  query: string,
  limit = 20,
): SearchResult[] {
  if (!query.trim()) return [];

  const safeQuery = sanitizeFtsQuery(query);

  const rows = db.prepare(`
    SELECT
      d.id,
      d.title,
      snippet(decisions_fts, 2, '<mark>', '</mark>', '…', 40) AS snippet,
      rank
    FROM decisions_fts
    JOIN decisions d ON d.id = decisions_fts.id
    WHERE decisions_fts MATCH @query
    ORDER BY rank
    LIMIT @limit
  `).all({ query: safeQuery, limit }) as Array<{
    id: string;
    title: string;
    snippet: string;
    rank: number;
  }>;

  return rows.map(row => ({
    source: 'decision' as const,
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    rank: row.rank,
  }));
}

/**
 * Search tasks by full-text query.
 * Matches against title and description.
 */
export function searchTasks(
  db: Database.Database,
  query: string,
  limit = 20,
): SearchResult[] {
  if (!query.trim()) return [];

  const safeQuery = sanitizeFtsQuery(query);

  const rows = db.prepare(`
    SELECT
      t.id,
      t.title,
      snippet(tasks_fts, 2, '<mark>', '</mark>', '…', 40) AS snippet,
      rank
    FROM tasks_fts
    JOIN tasks t ON t.id = tasks_fts.id
    WHERE tasks_fts MATCH @query
    ORDER BY rank
    LIMIT @limit
  `).all({ query: safeQuery, limit }) as Array<{
    id: string;
    title: string;
    snippet: string;
    rank: number;
  }>;

  return rows.map(row => ({
    source: 'task' as const,
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    rank: row.rank,
  }));
}

/**
 * Search across both decisions and tasks, returning combined results
 * sorted by relevance.
 */
export function searchAll(
  db: Database.Database,
  query: string,
  limit = 20,
): SearchResult[] {
  if (!query.trim()) return [];

  const decisions = searchDecisions(db, query, limit);
  const tasks = searchTasks(db, query, limit);

  // Merge and sort by rank (lower = more relevant)
  return [...decisions, ...tasks]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Sanitize a user query for FTS5.
 * Wraps each word in double-quotes to prevent syntax errors from
 * special characters, then joins with implicit AND.
 */
function sanitizeFtsQuery(query: string): string {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `"${term.replace(/"/g, '""')}"`)
    .join(' ');

  return terms || '""';
}

/**
 * Documentation files connector — reads markdown and text files.
 *
 * Scans configured directories (docs/, .squad/, README) for documentation
 * files and produces source documents for ingestion.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

import type { SourceType } from '@matanelcohen/openspace-shared';

import type { ConnectorOptions, SourceConnector, SourceDocument } from './types.js';

// ── File discovery ─────────────────────────────────────────────────

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst', '.adoc']);

/**
 * Recursively find documentation files in a directory.
 */
async function findDocFiles(dir: string, basePath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip hidden dirs, node_modules, dist, .cache
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }
        const subFiles = await findDocFiles(fullPath, basePath);
        files.push(...subFiles);
      } else if (entry.isFile() && DOC_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist — skip
  }

  return files;
}

/**
 * Read file content with size limit.
 */
async function readDocFile(filePath: string): Promise<{ content: string; mtime: string } | null> {
  try {
    const stats = await stat(filePath);
    // Skip files larger than 1MB
    if (stats.size > 1024 * 1024) return null;

    const content = await readFile(filePath, 'utf-8');
    return {
      content,
      mtime: stats.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Connector ──────────────────────────────────────────────────────

export interface DocsConnectorConfig {
  /** Path to the repository root. */
  repoPath: string;
  /** Additional directories to scan (relative to repoPath). Default: ['docs', '.squad', 'README.md']. */
  scanPaths?: string[];
  /** The .squad/ directory path. */
  squadDir?: string;
}

export class DocsConnector implements SourceConnector {
  readonly sourceType: SourceType = 'doc';
  private readonly repoPath: string;
  private readonly scanPaths: string[];

  constructor(config: DocsConnectorConfig) {
    this.repoPath = config.repoPath;
    this.scanPaths = config.scanPaths ?? ['docs', config.squadDir ?? '.squad'];
  }

  async fetchSources(_options?: ConnectorOptions): Promise<SourceDocument[]> {
    const documents: SourceDocument[] = [];

    // Scan configured directories
    for (const scanPath of this.scanPaths) {
      const fullPath = join(this.repoPath, scanPath);
      const docFiles = await findDocFiles(fullPath, this.repoPath);

      for (const filePath of docFiles) {
        const result = await readDocFile(filePath);
        if (!result) continue;

        const relPath = relative(this.repoPath, filePath);
        const isSquadFile = relPath.startsWith('.squad') || relPath.startsWith('squad');

        documents.push({
          sourceId: `doc:${relPath}`,
          sourceType: 'doc',
          content: result.content,
          metadata: {
            sourceType: 'doc',
            sourceId: `doc:${relPath}`,
            squadPath: isSquadFile ? relPath : null,
            filePath: relPath,
            agentIds: [],
            author: null,
            createdAt: result.mtime,
            updatedAt: result.mtime,
            tags: extractTags(relPath),
            status: null,
            priority: null,
            headingPath: null,
            threadId: null,
            sessionId: null,
          },
        });
      }
    }

    // Also pick up root-level README
    const readmePath = join(this.repoPath, 'README.md');
    const readme = await readDocFile(readmePath);
    if (readme) {
      documents.push({
        sourceId: 'doc:README.md',
        sourceType: 'doc',
        content: readme.content,
        metadata: {
          sourceType: 'doc',
          sourceId: 'doc:README.md',
          squadPath: null,
          filePath: 'README.md',
          agentIds: [],
          author: null,
          createdAt: readme.mtime,
          updatedAt: readme.mtime,
          tags: ['readme'],
          status: null,
          priority: null,
          headingPath: null,
          threadId: null,
          sessionId: null,
        },
      });
    }

    return documents;
  }
}

/** Extract simple tags from a file path. */
function extractTags(filePath: string): string[] {
  const tags: string[] = [];
  const lower = filePath.toLowerCase();

  if (lower.includes('architecture') || lower.includes('adr')) tags.push('architecture');
  if (lower.includes('design')) tags.push('design');
  if (lower.includes('prd') || lower.includes('requirements')) tags.push('requirements');
  if (lower.includes('api')) tags.push('api');
  if (lower.includes('guide') || lower.includes('tutorial')) tags.push('guide');
  if (lower.includes('changelog') || lower.includes('release')) tags.push('changelog');

  return tags;
}

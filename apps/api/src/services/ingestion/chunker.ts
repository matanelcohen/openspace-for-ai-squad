/**
 * Content chunker — splits text into appropriately-sized chunks for embedding.
 *
 * Markdown-aware: respects heading boundaries, code blocks, and paragraph breaks.
 * Produces Chunk objects with deterministic IDs (hash of sourceId + chunkIndex).
 */

import { createHash } from 'node:crypto';

import type { Chunk, ChunkingConfig,ChunkMetadata } from '@matanelcohen/openspace-shared';

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_CONFIG: ChunkingConfig = {
  targetTokens: 512,
  maxTokens: 1024,
  overlapTokens: 64,
};

// ── Token estimation ───────────────────────────────────────────────

/** Rough token count estimate (~4 chars per token for English). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Chunk ID ───────────────────────────────────────────────────────

/** Deterministic chunk ID from source ID + chunk index. */
export function chunkId(sourceId: string, chunkIndex: number): string {
  return createHash('sha256')
    .update(`${sourceId}:${chunkIndex}`)
    .digest('hex')
    .slice(0, 16);
}

// ── Markdown section splitting ─────────────────────────────────────

interface Section {
  heading: string | null;
  content: string;
}

/**
 * Split markdown into sections by headings (##, ###, etc.).
 * Preserves the heading as context for each section.
 */
function splitMarkdownSections(text: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      // Flush previous section
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
      }
      currentHeading = line.replace(/^#+\s*/, '').trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Flush last section
  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
  }

  return sections;
}

/**
 * Split text by paragraph boundaries (double newlines), preserving code blocks.
 */
function splitParagraphs(text: string): string[] {
  const blocks: string[] = [];
  let current = '';
  let inCodeBlock = false;

  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      current += line + '\n';
      continue;
    }

    if (inCodeBlock) {
      current += line + '\n';
      continue;
    }

    if (line.trim() === '' && current.trim() !== '') {
      blocks.push(current.trim());
      current = '';
    } else {
      current += line + '\n';
    }
  }

  if (current.trim()) {
    blocks.push(current.trim());
  }

  return blocks;
}

// ── Main chunking function ─────────────────────────────────────────

export interface ChunkInput {
  sourceId: string;
  content: string;
  metadata: Omit<ChunkMetadata, 'chunkIndex' | 'chunkTotal'>;
}

/**
 * Chunk content into appropriately-sized pieces for embedding.
 *
 * Strategy:
 * 1. Split by markdown headings into sections
 * 2. If a section exceeds targetTokens, split by paragraphs
 * 3. Merge small paragraphs up to targetTokens
 * 4. If a single paragraph exceeds maxTokens, hard-split by character
 */
export function chunkContent(input: ChunkInput, config?: Partial<ChunkingConfig>): Chunk[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { sourceId, content, metadata } = input;

  if (!content.trim()) return [];

  const sections = splitMarkdownSections(content);
  const rawChunks: Array<{ text: string; heading: string | null }> = [];

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);

    if (sectionTokens <= cfg.targetTokens) {
      rawChunks.push({ text: section.content, heading: section.heading });
      continue;
    }

    // Split large sections by paragraphs
    const paragraphs = splitParagraphs(section.content);
    let buffer = '';

    for (const para of paragraphs) {
      const paraTokens = estimateTokens(para);

      // Single paragraph exceeds max — hard split
      if (paraTokens > cfg.maxTokens) {
        if (buffer.trim()) {
          rawChunks.push({ text: buffer.trim(), heading: section.heading });
          buffer = '';
        }
        const hardChunks = hardSplit(para, cfg.maxTokens);
        for (const hc of hardChunks) {
          rawChunks.push({ text: hc, heading: section.heading });
        }
        continue;
      }

      const bufferTokens = estimateTokens(buffer);
      if (bufferTokens + paraTokens > cfg.targetTokens && buffer.trim()) {
        rawChunks.push({ text: buffer.trim(), heading: section.heading });
        buffer = '';
      }

      buffer += (buffer ? '\n\n' : '') + para;
    }

    if (buffer.trim()) {
      rawChunks.push({ text: buffer.trim(), heading: section.heading });
    }
  }

  // Build Chunk objects with deterministic IDs
  const total = rawChunks.length;
  return rawChunks.map((raw, index) => ({
    id: chunkId(sourceId, index),
    content: raw.text,
    metadata: {
      ...metadata,
      chunkIndex: index,
      chunkTotal: total,
      headingPath: raw.heading ?? metadata.headingPath,
    },
    tokenCount: estimateTokens(raw.text),
  }));
}

/**
 * Hard-split a long text block into pieces of approximately maxTokens.
 * Splits on sentence boundaries when possible.
 */
function hardSplit(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4;
  const pieces: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    // Try to find a sentence boundary near the limit
    let splitAt = maxChars;
    const searchStart = Math.max(0, maxChars - 200);
    const lastPeriod = remaining.lastIndexOf('. ', splitAt);
    const lastNewline = remaining.lastIndexOf('\n', splitAt);
    const bestBreak = Math.max(lastPeriod, lastNewline);

    if (bestBreak > searchStart) {
      splitAt = bestBreak + 1;
    }

    pieces.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.trim()) {
    pieces.push(remaining.trim());
  }

  return pieces;
}

// ── Content hash for change detection ──────────────────────────────

/** SHA-256 hash of content for incremental sync change detection. */
export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

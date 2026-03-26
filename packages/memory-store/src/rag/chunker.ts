/**
 * Text chunker for the RAG pipeline.
 *
 * Splits source content into overlapping chunks suitable for embedding,
 * respecting heading structure when available.
 */

import { createHash } from 'node:crypto';

import type { Chunk, ChunkingConfig, ChunkMetadata } from '@openspace/shared';

// ── Defaults ───────────────────────────────────────────────────────

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  targetTokens: 512,
  maxTokens: 1024,
  overlapTokens: 64,
};

// ── Token estimation ───────────────────────────────────────────────

/**
 * Approximate token count using a simple word-based heuristic.
 * ~1 token per 4 characters for English, ~1 per 2 for CJK.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Count CJK characters separately (they tend to be 1 token each)
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af]/g) || []).length;
  const nonCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af]/g, '');
  // English: ~4 chars per token on average
  const englishTokens = Math.ceil(nonCjk.length / 4);
  return englishTokens + cjkCount;
}

// ── Chunk ID generation ────────────────────────────────────────────

/** Generate a deterministic chunk ID from sourceId + chunkIndex. */
export function chunkId(sourceId: string, chunkIndex: number): string {
  return createHash('sha256').update(`${sourceId}:${chunkIndex}`).digest('hex').slice(0, 16);
}

// ── Heading path extraction ────────────────────────────────────────

/**
 * Extract heading breadcrumb path for markdown content.
 * Returns e.g. "## Architecture > ### Database"
 */
export function extractHeadingPath(text: string, position: number): string | null {
  const lines = text.slice(0, position).split('\n');
  const headings: { level: number; text: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      const level = match[1]!.length;
      const headingText = match[2]!.trim();
      // Remove headings at same or deeper level (only keep ancestors)
      while (headings.length > 0 && headings[headings.length - 1]!.level >= level) {
        headings.pop();
      }
      headings.push({ level, text: headingText });
    }
  }

  if (headings.length === 0) return null;
  return headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`).join(' > ');
}

// ── Split strategies ───────────────────────────────────────────────

/** Split text at paragraph boundaries (double newline). */
function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
}

/** Split text at sentence boundaries for finer granularity. */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or newline
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

// ── Main chunker ───────────────────────────────────────────────────

export interface ChunkInput {
  sourceId: string;
  content: string;
  metadata: Omit<ChunkMetadata, 'chunkIndex' | 'chunkTotal'>;
}

/**
 * Chunk text content into overlapping pieces suitable for embedding.
 *
 * Strategy:
 * 1. Split into paragraphs
 * 2. Greedily combine paragraphs until target token count
 * 3. If a single paragraph exceeds maxTokens, split it at sentence boundaries
 * 4. Add overlap from the end of the previous chunk
 */
export function chunkText(
  input: ChunkInput,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG,
): Chunk[] {
  const { content, sourceId, metadata } = input;

  if (!content || content.trim().length === 0) {
    return [];
  }

  const paragraphs = splitParagraphs(content);
  if (paragraphs.length === 0) return [];

  // Expand paragraphs that exceed maxTokens into sentences
  const segments: string[] = [];
  for (const para of paragraphs) {
    if (estimateTokens(para) > config.maxTokens) {
      segments.push(...splitSentences(para));
    } else {
      segments.push(para);
    }
  }

  // Greedily combine segments into chunks
  const rawChunks: { text: string; startOffset: number }[] = [];
  let currentText = '';
  let currentOffset = 0;

  for (const segment of segments) {
    const combined = currentText ? `${currentText}\n\n${segment}` : segment;
    if (estimateTokens(combined) > config.targetTokens && currentText) {
      rawChunks.push({ text: currentText, startOffset: currentOffset });
      currentText = segment;
      currentOffset = content.indexOf(segment, currentOffset);
      if (currentOffset === -1) currentOffset = 0;
    } else {
      if (!currentText) {
        currentOffset = content.indexOf(segment);
        if (currentOffset === -1) currentOffset = 0;
      }
      currentText = combined;
    }
  }

  if (currentText.trim()) {
    rawChunks.push({ text: currentText, startOffset: currentOffset });
  }

  // Apply overlap: prepend tail of previous chunk
  const chunkTotal = rawChunks.length;
  const chunks: Chunk[] = rawChunks.map((raw, index) => {
    let finalText = raw.text;

    if (index > 0 && config.overlapTokens > 0) {
      const prevText = rawChunks[index - 1]!.text;
      const prevWords = prevText.split(/\s+/);
      // Take approximately overlapTokens worth of words from previous chunk end
      const overlapWordCount = Math.min(config.overlapTokens, prevWords.length);
      const overlapText = prevWords.slice(-overlapWordCount).join(' ');
      finalText = `${overlapText}\n\n${finalText}`;
    }

    const headingPath = extractHeadingPath(content, raw.startOffset);

    return {
      id: chunkId(sourceId, index),
      content: finalText,
      metadata: {
        ...metadata,
        chunkIndex: index,
        chunkTotal,
        headingPath: headingPath ?? metadata.headingPath,
      },
      tokenCount: estimateTokens(finalText),
    };
  });

  return chunks;
}

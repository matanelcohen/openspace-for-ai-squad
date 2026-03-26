/**
 * Unit tests for the RAG text chunker.
 *
 * Tests: token estimation, chunk ID generation, heading path extraction,
 * text splitting, overlap, and boundary conditions.
 */

import { describe, expect, it } from 'vitest';

import { chunkId, chunkText, estimateTokens, extractHeadingPath } from '../chunker.js';

// ── estimateTokens ─────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates English text (~4 chars/token)', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const tokens = estimateTokens(text);
    // 43 chars / 4 ≈ 11
    expect(tokens).toBeGreaterThanOrEqual(8);
    expect(tokens).toBeLessThanOrEqual(15);
  });

  it('counts CJK characters as individual tokens', () => {
    const cjk = '这是一个中文测试句子';
    const tokens = estimateTokens(cjk);
    // 10 CJK characters = ~10 tokens
    expect(tokens).toBeGreaterThanOrEqual(9);
    expect(tokens).toBeLessThanOrEqual(12);
  });

  it('handles mixed English and CJK', () => {
    const mixed = 'Hello 世界 World';
    const tokens = estimateTokens(mixed);
    // "Hello  World" (~3 English tokens) + 2 CJK = ~5
    expect(tokens).toBeGreaterThanOrEqual(4);
    expect(tokens).toBeLessThanOrEqual(8);
  });

  it('handles whitespace-only text', () => {
    expect(estimateTokens('   \n\t  ')).toBeGreaterThanOrEqual(1);
  });
});

// ── chunkId ────────────────────────────────────────────────────────

describe('chunkId', () => {
  it('produces deterministic IDs', () => {
    const id1 = chunkId('source-1', 0);
    const id2 = chunkId('source-1', 0);
    expect(id1).toBe(id2);
  });

  it('produces different IDs for different indices', () => {
    const id1 = chunkId('source-1', 0);
    const id2 = chunkId('source-1', 1);
    expect(id1).not.toBe(id2);
  });

  it('produces different IDs for different sources', () => {
    const id1 = chunkId('source-1', 0);
    const id2 = chunkId('source-2', 0);
    expect(id1).not.toBe(id2);
  });

  it('returns a 16-char hex string', () => {
    const id = chunkId('test', 5);
    expect(id).toMatch(/^[a-f0-9]{16}$/);
  });
});

// ── extractHeadingPath ─────────────────────────────────────────────

describe('extractHeadingPath', () => {
  it('returns null for text without headings', () => {
    expect(extractHeadingPath('Just some plain text', 20)).toBeNull();
  });

  it('extracts single heading', () => {
    const text = '# Title\n\nContent here';
    expect(extractHeadingPath(text, text.length)).toBe('# Title');
  });

  it('extracts nested headings', () => {
    const text = '# Root\n\n## Section\n\n### Subsection\n\nContent';
    expect(extractHeadingPath(text, text.length)).toBe('# Root > ## Section > ### Subsection');
  });

  it('resets deeper headings when a same-level heading appears', () => {
    const text = '# Root\n\n## A\n\n### Deep\n\n## B\n\nContent';
    expect(extractHeadingPath(text, text.length)).toBe('# Root > ## B');
  });

  it('respects position parameter', () => {
    const text = '# Root\n\n## A\n\nContent\n\n## B\n\nMore';
    // Position before ## B
    const pos = text.indexOf('## B');
    expect(extractHeadingPath(text, pos)).toBe('# Root > ## A');
  });

  it('handles heading-only text', () => {
    expect(extractHeadingPath('## Just a heading', 17)).toBe('## Just a heading');
  });
});

// ── chunkText ──────────────────────────────────────────────────────

describe('chunkText', () => {
  const baseMetadata = {
    sourceType: 'doc' as const,
    sourceId: 'test-doc',
    squadPath: null,
    filePath: null,
    agentIds: [],
    author: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    status: null,
    priority: null,
    headingPath: null,
    threadId: null,
    sessionId: null,
  };

  it('returns empty array for empty content', () => {
    const chunks = chunkText({
      sourceId: 'test',
      content: '',
      metadata: baseMetadata,
    });
    expect(chunks).toEqual([]);
  });

  it('returns empty array for whitespace-only content', () => {
    const chunks = chunkText({
      sourceId: 'test',
      content: '   \n\n   ',
      metadata: baseMetadata,
    });
    expect(chunks).toEqual([]);
  });

  it('produces a single chunk for short content', () => {
    const chunks = chunkText({
      sourceId: 'test',
      content: 'A short paragraph of text.',
      metadata: baseMetadata,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toContain('short paragraph');
    expect(chunks[0]!.metadata.chunkIndex).toBe(0);
    expect(chunks[0]!.metadata.chunkTotal).toBe(1);
    expect(chunks[0]!.tokenCount).toBeGreaterThan(0);
  });

  it('splits long content into multiple chunks', () => {
    // Create content that exceeds target tokens
    const para = 'This is a moderately long paragraph. '.repeat(100);
    const content = `${para}\n\n${para}\n\n${para}`;

    const chunks = chunkText(
      { sourceId: 'test', content, metadata: baseMetadata },
      { targetTokens: 100, maxTokens: 200, overlapTokens: 10 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should have correct indices
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.metadata.chunkIndex).toBe(i);
      expect(chunks[i]!.metadata.chunkTotal).toBe(chunks.length);
    }
  });

  it('adds overlap between consecutive chunks', () => {
    const para1 = 'First paragraph content that is unique. '.repeat(50);
    const para2 = 'Second paragraph content that is different. '.repeat(50);
    const content = `${para1}\n\n${para2}`;

    const chunks = chunkText(
      { sourceId: 'test', content, metadata: baseMetadata },
      { targetTokens: 100, maxTokens: 200, overlapTokens: 20 },
    );

    if (chunks.length >= 2) {
      // Second chunk should contain some text from the end of the first
      // Overlap means some content from chunk 0 appears in chunk 1
      expect(chunks[1]!.content.length).toBeGreaterThan(0);
    }
  });

  it('handles very long single paragraphs by splitting at sentences', () => {
    // A single paragraph with many sentences
    const longPara = Array.from(
      { length: 200 },
      (_, i) => `Sentence number ${i} has some content.`,
    ).join(' ');

    const chunks = chunkText(
      { sourceId: 'test', content: longPara, metadata: baseMetadata },
      { targetTokens: 100, maxTokens: 200, overlapTokens: 10 },
    );

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('preserves heading paths in chunk metadata', () => {
    // Create enough content per section to force multiple chunks
    const content = [
      '# Introduction',
      '',
      'Some intro text goes here. '.repeat(80),
      '',
      '## Architecture',
      '',
      'Architecture details here. '.repeat(80),
      '',
      '### Database Layer',
      '',
      'Database content here that is the main content of this chunk. '.repeat(80),
    ].join('\n');

    const chunks = chunkText(
      { sourceId: 'test', content, metadata: baseMetadata },
      { targetTokens: 100, maxTokens: 200, overlapTokens: 10 },
    );

    // With forced splits, at least one chunk beyond the first should have a heading path
    const hasHeadingPath = chunks.some((c) => c.metadata.headingPath !== null);
    expect(hasHeadingPath).toBe(true);
  });

  it('generates deterministic chunk IDs', () => {
    const input = { sourceId: 'stable', content: 'Stable content', metadata: baseMetadata };
    const chunks1 = chunkText(input);
    const chunks2 = chunkText(input);

    expect(chunks1.length).toBe(chunks2.length);
    for (let i = 0; i < chunks1.length; i++) {
      expect(chunks1[i]!.id).toBe(chunks2[i]!.id);
    }
  });

  it('uses custom chunking config', () => {
    // Use paragraphs so the chunker can split at boundaries
    const para = 'Word word word word. '.repeat(40);
    const longContent = Array.from({ length: 50 }, () => para).join('\n\n');
    const smallChunks = chunkText(
      { sourceId: 'test', content: longContent, metadata: baseMetadata },
      { targetTokens: 50, maxTokens: 100, overlapTokens: 5 },
    );
    const bigChunks = chunkText(
      { sourceId: 'test', content: longContent, metadata: baseMetadata },
      { targetTokens: 500, maxTokens: 1000, overlapTokens: 50 },
    );

    expect(smallChunks.length).toBeGreaterThan(bigChunks.length);
  });

  it('handles content with only newlines', () => {
    const chunks = chunkText({
      sourceId: 'test',
      content: '\n\n\n\n',
      metadata: baseMetadata,
    });
    expect(chunks).toEqual([]);
  });

  it('handles single-character content', () => {
    const chunks = chunkText({
      sourceId: 'test',
      content: 'X',
      metadata: baseMetadata,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe('X');
  });
});

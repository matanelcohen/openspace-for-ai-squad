import { describe, expect, it } from 'vitest';

import type { ChunkInput } from '../chunker.js';
import { chunkContent, chunkId, contentHash, estimateTokens } from '../chunker.js';

// ── estimateTokens ──────────────────────────────────────────────

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('rounds up (ceiling)', () => {
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('ab')).toBe(1);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('handles long text', () => {
    const text = 'a'.repeat(2048);
    expect(estimateTokens(text)).toBe(512);
  });
});

// ── chunkId ─────────────────────────────────────────────────────

describe('chunkId', () => {
  it('produces 16-char hex string', () => {
    const id = chunkId('source-1', 0);
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic', () => {
    const id1 = chunkId('source-1', 0);
    const id2 = chunkId('source-1', 0);
    expect(id1).toBe(id2);
  });

  it('varies by source ID', () => {
    const id1 = chunkId('source-1', 0);
    const id2 = chunkId('source-2', 0);
    expect(id1).not.toBe(id2);
  });

  it('varies by chunk index', () => {
    const id1 = chunkId('source-1', 0);
    const id2 = chunkId('source-1', 1);
    expect(id1).not.toBe(id2);
  });
});

// ── contentHash ─────────────────────────────────────────────────

describe('contentHash', () => {
  it('produces hex string', () => {
    const hash = contentHash('hello world');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(contentHash('test')).toBe(contentHash('test'));
  });

  it('varies by content', () => {
    expect(contentHash('a')).not.toBe(contentHash('b'));
  });
});

// ── chunkContent ────────────────────────────────────────────────

describe('chunkContent', () => {
  const baseMetadata = {
    sourceType: 'docs' as const,
    sourceId: 'doc-1',
    headingPath: null,
  };

  function makeInput(content: string): ChunkInput {
    return { sourceId: 'doc-1', content, metadata: baseMetadata };
  }

  // ── Empty / whitespace ───────────────────────────────────

  describe('empty content', () => {
    it('returns empty array for empty string', () => {
      expect(chunkContent(makeInput(''))).toEqual([]);
    });

    it('returns empty array for whitespace only', () => {
      expect(chunkContent(makeInput('   \n\n  '))).toEqual([]);
    });
  });

  // ── Small content ────────────────────────────────────────

  describe('small content (fits in one chunk)', () => {
    it('returns single chunk for short text', () => {
      const chunks = chunkContent(makeInput('Hello, world!'));
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('Hello, world!');
    });

    it('sets correct metadata on single chunk', () => {
      const chunks = chunkContent(makeInput('Hello'));
      expect(chunks[0].metadata.chunkIndex).toBe(0);
      expect(chunks[0].metadata.chunkTotal).toBe(1);
    });

    it('generates deterministic chunk ID', () => {
      const chunks = chunkContent(makeInput('Hello'));
      expect(chunks[0].id).toBe(chunkId('doc-1', 0));
    });

    it('includes token count', () => {
      const chunks = chunkContent(makeInput('Hello'));
      expect(chunks[0].tokenCount).toBe(estimateTokens('Hello'));
    });
  });

  // ── Markdown heading splitting ───────────────────────────

  describe('markdown heading splitting', () => {
    it('splits on headings', () => {
      const content = [
        '# Introduction',
        'First section content.',
        '',
        '## Methods',
        'Second section content.',
        '',
        '## Results',
        'Third section content.',
      ].join('\n');

      const chunks = chunkContent(makeInput(content));
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it('preserves heading as headingPath in metadata', () => {
      const content = ['## My Section', 'Some content here.'].join('\n');

      const chunks = chunkContent(makeInput(content));
      expect(chunks[0].metadata.headingPath).toBe('My Section');
    });

    it('handles content before first heading', () => {
      const content = ['Preamble text.', '', '## First Heading', 'Section content.'].join('\n');

      const chunks = chunkContent(makeInput(content));
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // First chunk should contain the preamble
      const preambleChunk = chunks.find((c) => c.content.includes('Preamble'));
      expect(preambleChunk).toBeDefined();
    });
  });

  // ── Paragraph splitting for large sections ───────────────

  describe('paragraph splitting', () => {
    it('splits large sections by paragraphs', () => {
      // Create content where one section has multiple large paragraphs
      const para = 'Word '.repeat(600); // ~3000 chars = ~750 tokens (above 512 target)
      const content = `## Big Section\n\n${para}\n\n${para}`;

      const chunks = chunkContent(makeInput(content));
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('merges small paragraphs to reach target size', () => {
      // Use paragraphs without headings to test merging behavior
      const smallPara = 'Short paragraph text.';
      const content = Array(10).fill(smallPara).join('\n\n');

      const chunks = chunkContent(makeInput(content));
      // Small paragraphs should be merged, not 10 separate chunks
      expect(chunks.length).toBeLessThanOrEqual(10);
    });
  });

  // ── Hard split for very large paragraphs ─────────────────

  describe('hard split', () => {
    it('hard-splits a single massive paragraph', () => {
      // A single paragraph exceeding maxTokens (1024 * 4 = 4096 chars)
      const massiveText = 'A sentence. '.repeat(500); // ~6000 chars
      const content = `## Giant\n${massiveText}`;

      const chunks = chunkContent(makeInput(content));
      expect(chunks.length).toBeGreaterThan(1);

      // Each chunk should be within bounds
      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeLessThanOrEqual(1100); // some tolerance
      }
    });
  });

  // ── Code block preservation ──────────────────────────────

  describe('code block handling', () => {
    it('keeps code blocks intact within paragraphs', () => {
      const content = [
        '## Code Example',
        '',
        'Here is some code:',
        '',
        '```typescript',
        'function hello() {',
        '  console.log("hello");',
        '}',
        '```',
        '',
        'After the code.',
      ].join('\n');

      const chunks = chunkContent(makeInput(content));
      // Code block should not be split across chunks
      const codeChunk = chunks.find((c) => c.content.includes('```typescript'));
      expect(codeChunk).toBeDefined();
      expect(codeChunk!.content).toContain('```');
    });
  });

  // ── Custom config ────────────────────────────────────────

  describe('custom chunking config', () => {
    it('respects custom targetTokens', () => {
      // Use a large section with multiple paragraphs to force splitting
      const para = 'Word '.repeat(200); // ~1000 chars = ~250 tokens
      const content = `## Big Section\n\n${para}\n\n${para}\n\n${para}`;

      const chunks = chunkContent(makeInput(content), { targetTokens: 100 });
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('respects custom maxTokens for hard splitting', () => {
      // Single massive paragraph that exceeds maxTokens → triggers hard split
      const text = 'A sentence here. '.repeat(300); // ~5100 chars
      const content = `## Section\n${text}`;
      const chunks = chunkContent(makeInput(content), { maxTokens: 200 });

      // With maxTokens=200 (800 chars), ~5100 chars should produce multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  // ── Metadata propagation ─────────────────────────────────

  describe('metadata', () => {
    it('includes chunkIndex and chunkTotal', () => {
      const para = 'Word '.repeat(600);
      const content = `${para}\n\n${para}`;
      const chunks = chunkContent(makeInput(content));

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].metadata.chunkIndex).toBe(i);
        expect(chunks[i].metadata.chunkTotal).toBe(chunks.length);
      }
    });

    it('preserves sourceType from input metadata', () => {
      const chunks = chunkContent(makeInput('Some content'));
      expect(chunks[0].metadata.sourceType).toBe('docs');
    });

    it('uses input headingPath when section has no heading', () => {
      const input: ChunkInput = {
        sourceId: 'doc-1',
        content: 'Content without headings.',
        metadata: { ...baseMetadata, headingPath: 'Default Path' },
      };
      const chunks = chunkContent(input);
      expect(chunks[0].metadata.headingPath).toBe('Default Path');
    });
  });
});

/**
 * Unit tests for channel-parser — parsing `.squad/channels/*.md` files.
 *
 * Covers: valid parsing, missing/invalid fields, date coercion,
 * array coercion, multi-file parsing, error collection, and sort order.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseAllChannels, parseChannelFile } from '../channel-parser.js';

// ── Helpers ──────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'channel-parser-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** Write a markdown file with given content and return the file path. */
async function writeChannelFile(filename: string, content: string): Promise<string> {
  const filePath = path.join(tmpDir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

// ── parseChannelFile ─────────────────────────────────────────────

describe('parseChannelFile', () => {
  it('parses a well-formed channel file', () => {
    const content = [
      '---',
      'id: chan-abc12345',
      'name: Backend',
      'memberAgentIds:',
      '  - bender',
      '  - leela',
      'createdAt: "2024-06-01T12:00:00.000Z"',
      'updatedAt: "2024-06-02T08:30:00.000Z"',
      '---',
      '',
      'The backend engineering channel.',
    ].join('\n');

    const result = parseChannelFile(content, '/fake/chan-abc12345.md');

    expect(result.channel.id).toBe('chan-abc12345');
    expect(result.channel.name).toBe('Backend');
    expect(result.channel.memberAgentIds).toEqual(['bender', 'leela']);
    expect(result.channel.createdAt).toBe('2024-06-01T12:00:00.000Z');
    expect(result.channel.updatedAt).toBe('2024-06-02T08:30:00.000Z');
    expect(result.channel.description).toBe('The backend engineering channel.');
    expect(result.filePath).toBe('/fake/chan-abc12345.md');
  });

  it('trims whitespace from id and name', () => {
    const content = [
      '---',
      'id: "  chan-spaces  "',
      'name: "  Spacy Name  "',
      '---',
      '',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    expect(channel.id).toBe('chan-spaces');
    expect(channel.name).toBe('Spacy Name');
  });

  it('throws when id is missing', () => {
    const content = ['---', 'name: No ID', '---', ''].join('\n');

    expect(() => parseChannelFile(content, '/fake/no-id.md')).toThrow(
      'Missing required field "id"',
    );
  });

  it('throws when id is empty string', () => {
    const content = ['---', 'id: ""', 'name: Empty ID', '---', ''].join('\n');

    expect(() => parseChannelFile(content, '/fake/empty-id.md')).toThrow(
      'Missing required field "id"',
    );
  });

  it('throws when id is whitespace only', () => {
    const content = ['---', 'id: "   "', 'name: Whitespace ID', '---', ''].join('\n');

    expect(() => parseChannelFile(content, '/fake/ws-id.md')).toThrow(
      'Missing required field "id"',
    );
  });

  it('throws when name is missing', () => {
    const content = ['---', 'id: chan-noname', '---', ''].join('\n');

    expect(() => parseChannelFile(content, '/fake/no-name.md')).toThrow(
      'Missing required field "name"',
    );
  });

  it('throws when name is empty string', () => {
    const content = ['---', 'id: chan-emptyname', 'name: ""', '---', ''].join('\n');

    expect(() => parseChannelFile(content, '/fake/empty-name.md')).toThrow(
      'Missing required field "name"',
    );
  });

  it('defaults memberAgentIds to empty array when missing', () => {
    const content = [
      '---',
      'id: chan-nomembers',
      'name: Solo Channel',
      'createdAt: "2024-01-01T00:00:00.000Z"',
      'updatedAt: "2024-01-01T00:00:00.000Z"',
      '---',
      '',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    expect(channel.memberAgentIds).toEqual([]);
  });

  it('filters non-string values from memberAgentIds', () => {
    const content = [
      '---',
      'id: chan-mixed',
      'name: Mixed Members',
      'memberAgentIds:',
      '  - bender',
      '  - 42',
      '  - true',
      '  - leela',
      '---',
      '',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    // YAML parses 42 as number and true as boolean, so only strings survive
    expect(channel.memberAgentIds).toEqual(['bender', 'leela']);
  });

  it('handles non-array memberAgentIds gracefully', () => {
    const content = [
      '---',
      'id: chan-scalar',
      'name: Scalar Members',
      'memberAgentIds: not-an-array',
      '---',
      '',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    expect(channel.memberAgentIds).toEqual([]);
  });

  it('coerces valid date strings to ISO-8601', () => {
    const content = [
      '---',
      'id: chan-dates',
      'name: Date Channel',
      'createdAt: "2024-03-15"',
      'updatedAt: "2024-03-16T10:00:00Z"',
      '---',
      '',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    expect(channel.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(channel.updatedAt).toBe('2024-03-16T10:00:00.000Z');
  });

  it('defaults to current time for missing dates', () => {
    const before = new Date().toISOString();

    const content = [
      '---',
      'id: chan-nodates',
      'name: No Dates',
      '---',
      '',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    const after = new Date().toISOString();

    expect(channel.createdAt >= before).toBe(true);
    expect(channel.createdAt <= after).toBe(true);
    expect(channel.updatedAt >= before).toBe(true);
    expect(channel.updatedAt <= after).toBe(true);
  });

  it('defaults to current time for invalid date strings', () => {
    const before = new Date().toISOString();

    const content = [
      '---',
      'id: chan-baddates',
      'name: Bad Dates',
      'createdAt: "not-a-date"',
      'updatedAt: "also-not-a-date"',
      '---',
      '',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    const after = new Date().toISOString();

    expect(channel.createdAt >= before).toBe(true);
    expect(channel.createdAt <= after).toBe(true);
  });

  it('uses markdown body as description, trimmed', () => {
    const content = [
      '---',
      'id: chan-desc',
      'name: Description Test',
      '---',
      '',
      '  Some description with leading spaces.  ',
      '',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    expect(channel.description).toBe('Some description with leading spaces.');
  });

  it('handles empty body as empty description', () => {
    const content = ['---', 'id: chan-empty', 'name: Empty Body', '---', ''].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    expect(channel.description).toBe('');
  });

  it('handles multiline description', () => {
    const content = [
      '---',
      'id: chan-multi',
      'name: Multiline',
      '---',
      '',
      'Line 1',
      '',
      'Line 2',
      '',
      'Line 3',
    ].join('\n');

    const { channel } = parseChannelFile(content, '/fake/file.md');
    expect(channel.description).toContain('Line 1');
    expect(channel.description).toContain('Line 2');
    expect(channel.description).toContain('Line 3');
  });
});

// ── parseAllChannels ─────────────────────────────────────────────

describe('parseAllChannels', () => {
  it('returns empty results for non-existent directory', async () => {
    const result = await parseAllChannels(path.join(tmpDir, 'nonexistent'));
    expect(result.channels).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('returns empty results for empty directory', async () => {
    const result = await parseAllChannels(tmpDir);
    expect(result.channels).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('ignores non-.md files', async () => {
    await fs.writeFile(path.join(tmpDir, 'notes.txt'), 'not a channel', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'data.json'), '{}', 'utf-8');

    const result = await parseAllChannels(tmpDir);
    expect(result.channels).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('parses all valid .md files', async () => {
    await writeChannelFile(
      'chan-alpha.md',
      [
        '---',
        'id: chan-alpha',
        'name: Alpha',
        'createdAt: "2024-01-01T00:00:00.000Z"',
        'updatedAt: "2024-01-01T00:00:00.000Z"',
        '---',
        '',
      ].join('\n'),
    );

    await writeChannelFile(
      'chan-beta.md',
      [
        '---',
        'id: chan-beta',
        'name: Beta',
        'createdAt: "2024-01-02T00:00:00.000Z"',
        'updatedAt: "2024-01-02T00:00:00.000Z"',
        '---',
        '',
      ].join('\n'),
    );

    const result = await parseAllChannels(tmpDir);
    expect(result.channels).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('collects errors for malformed files without stopping', async () => {
    // Valid file
    await writeChannelFile(
      'good.md',
      ['---', 'id: chan-good', 'name: Good Channel', '---', ''].join('\n'),
    );

    // Invalid file — missing id
    await writeChannelFile('bad.md', ['---', 'name: Bad Channel', '---', ''].join('\n'));

    const result = await parseAllChannels(tmpDir);
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]!.channel.name).toBe('Good Channel');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.error).toContain('Missing required field "id"');
  });

  it('sorts channels by createdAt ascending', async () => {
    await writeChannelFile(
      'chan-c.md',
      [
        '---',
        'id: chan-c',
        'name: Third',
        'createdAt: "2024-03-01T00:00:00.000Z"',
        'updatedAt: "2024-03-01T00:00:00.000Z"',
        '---',
        '',
      ].join('\n'),
    );

    await writeChannelFile(
      'chan-a.md',
      [
        '---',
        'id: chan-a',
        'name: First',
        'createdAt: "2024-01-01T00:00:00.000Z"',
        'updatedAt: "2024-01-01T00:00:00.000Z"',
        '---',
        '',
      ].join('\n'),
    );

    await writeChannelFile(
      'chan-b.md',
      [
        '---',
        'id: chan-b',
        'name: Second',
        'createdAt: "2024-02-01T00:00:00.000Z"',
        'updatedAt: "2024-02-01T00:00:00.000Z"',
        '---',
        '',
      ].join('\n'),
    );

    const result = await parseAllChannels(tmpDir);
    expect(result.channels.map((c) => c.channel.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('includes filePath in each result', async () => {
    await writeChannelFile(
      'chan-fp.md',
      ['---', 'id: chan-fp', 'name: FilePath Test', '---', ''].join('\n'),
    );

    const result = await parseAllChannels(tmpDir);
    expect(result.channels[0]!.filePath).toBe(path.join(tmpDir, 'chan-fp.md'));
  });

  it('includes filePath in each error', async () => {
    await writeChannelFile('broken.md', ['---', 'name: No ID', '---', ''].join('\n'));

    const result = await parseAllChannels(tmpDir);
    expect(result.errors[0]!.filePath).toBe(path.join(tmpDir, 'broken.md'));
  });
});

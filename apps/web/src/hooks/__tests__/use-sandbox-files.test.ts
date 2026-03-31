import { describe, expect, it } from 'vitest';

import { parseFileTree } from '../use-sandbox-files';

describe('parseFileTree', () => {
  it('parses file entries into a tree', () => {
    const output = [
      'f /workspace/index.ts 1234',
      'f /workspace/package.json 567',
    ].join('\n');

    const tree = parseFileTree(output, '/workspace');

    expect(tree).toHaveLength(2);
    expect(tree.find((f) => f.name === 'index.ts')).toBeDefined();
    expect(tree.find((f) => f.name === 'package.json')).toBeDefined();
  });

  it('creates directories for nested paths', () => {
    const output = [
      'd /workspace/src 0',
      'f /workspace/src/main.ts 500',
    ].join('\n');

    const tree = parseFileTree(output, '/workspace');

    const srcDir = tree.find((f) => f.name === 'src');
    expect(srcDir).toBeDefined();
    expect(srcDir?.type).toBe('directory');
    expect(srcDir?.children).toBeDefined();
  });

  it('sorts directories before files', () => {
    const output = [
      'f /workspace/z-file.ts 100',
      'd /workspace/a-dir 0',
    ].join('\n');

    const tree = parseFileTree(output, '/workspace');
    expect(tree[0].name).toBe('a-dir');
    expect(tree[1].name).toBe('z-file.ts');
  });

  it('ignores malformed lines', () => {
    const output = [
      'f /workspace/good.ts 100',
      'garbage line',
      '',
      'f /workspace/also-good.ts 200',
    ].join('\n');

    const tree = parseFileTree(output, '/workspace');
    expect(tree).toHaveLength(2);
  });

  it('returns empty array for empty output', () => {
    expect(parseFileTree('', '/workspace')).toEqual([]);
  });

  it('sets file size from the parsed number', () => {
    const output = 'f /workspace/big.bin 999999';
    const tree = parseFileTree(output, '/workspace');
    expect(tree[0].size).toBe(999999);
  });

  it('strips basePath prefix from paths', () => {
    const output = 'f /workspace/src/index.ts 100';
    const tree = parseFileTree(output, '/workspace');
    const src = tree.find((f) => f.name === 'src');
    expect(src?.path).toBe('src');
  });
});

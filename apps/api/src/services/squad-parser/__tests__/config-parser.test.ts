import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseConfigContent, parseConfigFile } from '../config-parser.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures', '.squad');
const MALFORMED_DIR = join(import.meta.dirname, 'fixtures', 'malformed', '.squad');
const EMPTY_DIR = join(import.meta.dirname, 'fixtures', 'empty');

describe('config-parser', () => {
  describe('parseConfigFile', () => {
    it('parses a valid config.json', async () => {
      const config = await parseConfigFile(FIXTURES_DIR);

      expect(config.version).toBe(1);
      expect(config.allowedModels).toEqual(['claude-opus-4.6', 'gpt-5.4']);
      expect(config.defaultModel).toBe('claude-opus-4.6');
    });

    it('returns defaults for missing file', async () => {
      const config = await parseConfigFile(EMPTY_DIR);

      expect(config.version).toBe(1);
      expect(config.allowedModels).toEqual([]);
      expect(config.defaultModel).toBe('');
    });

    it('returns defaults for malformed JSON', async () => {
      const config = await parseConfigFile(MALFORMED_DIR);

      expect(config.version).toBe(1);
      expect(config.allowedModels).toEqual([]);
      expect(config.defaultModel).toBe('');
    });
  });

  describe('parseConfigContent', () => {
    it('parses valid JSON string', () => {
      const config = parseConfigContent(
        '{"version": 2, "allowedModels": ["gpt-5.4"], "defaultModel": "gpt-5.4"}',
      );
      expect(config.version).toBe(2);
      expect(config.allowedModels).toEqual(['gpt-5.4']);
      expect(config.defaultModel).toBe('gpt-5.4');
    });

    it('handles missing fields with defaults', () => {
      const config = parseConfigContent('{}');
      expect(config.version).toBe(1);
      expect(config.allowedModels).toEqual([]);
      expect(config.defaultModel).toBe('');
    });

    it('handles invalid JSON', () => {
      const config = parseConfigContent('not json');
      expect(config.version).toBe(1);
      expect(config.allowedModels).toEqual([]);
    });

    it('filters non-string values from allowedModels', () => {
      const config = parseConfigContent(
        '{"allowedModels": ["valid", 123, null, "also-valid"]}',
      );
      expect(config.allowedModels).toEqual(['valid', 'also-valid']);
    });

    it('handles non-number version', () => {
      const config = parseConfigContent('{"version": "not-a-number"}');
      expect(config.version).toBe(1);
    });
  });
});

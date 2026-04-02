import { describe, it, expect } from 'vitest';

import { parseOrigins, buildAllowlist, createOriginValidator } from '../lib/cors.js';

// ── parseOrigins ────────────────────────────────────────────────────────────

describe('parseOrigins', () => {
  it('returns empty array for undefined', () => {
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseOrigins('')).toEqual([]);
  });

  it('returns empty array for wildcard', () => {
    expect(parseOrigins('*')).toEqual([]);
  });

  it('parses single origin', () => {
    expect(parseOrigins('https://app.openspace.ai')).toEqual(['https://app.openspace.ai']);
  });

  it('parses comma-separated origins and trims whitespace', () => {
    expect(
      parseOrigins('https://app.openspace.ai , https://staging.openspace.ai'),
    ).toEqual(['https://app.openspace.ai', 'https://staging.openspace.ai']);
  });

  it('filters out empty segments from trailing commas', () => {
    expect(parseOrigins('https://a.com,,https://b.com,')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
});

// ── buildAllowlist ──────────────────────────────────────────────────────────

describe('buildAllowlist', () => {
  it('returns explicit origins when provided', () => {
    const list = buildAllowlist('https://a.com,https://b.com', 'production');
    expect(list).toEqual(['https://a.com', 'https://b.com']);
  });

  it('falls back to localhost origins in development when unset', () => {
    const list = buildAllowlist(undefined, 'development');
    expect(list).toContain('http://localhost:3000');
    expect(list.length).toBeGreaterThan(0);
  });

  it('falls back to localhost origins when NODE_ENV is undefined', () => {
    const list = buildAllowlist(undefined, undefined);
    expect(list).toContain('http://localhost:3000');
  });

  it('falls back to localhost origins in test', () => {
    const list = buildAllowlist('*', 'test');
    expect(list).toContain('http://localhost:3000');
  });

  it('returns empty array in production when wildcard or unset', () => {
    expect(buildAllowlist('*', 'production')).toEqual([]);
    expect(buildAllowlist(undefined, 'production')).toEqual([]);
  });
});

// ── createOriginValidator ───────────────────────────────────────────────────

describe('createOriginValidator', () => {
  const allowlist = ['https://app.openspace.ai', 'https://staging.openspace.ai'];
  const validate = createOriginValidator(allowlist);

  it('allows requests with no origin (non-browser)', () => {
    validate(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it('echoes back an allowed origin', () => {
    validate('https://app.openspace.ai', (err, origin) => {
      expect(err).toBeNull();
      expect(origin).toBe('https://app.openspace.ai');
    });
  });

  it('rejects an origin not in the allowlist', () => {
    validate('https://evil.com', (err, origin) => {
      expect(err).toBeNull();
      expect(origin).toBe(false);
    });
  });

  it('rejects when allowlist is empty', () => {
    const emptyValidate = createOriginValidator([]);
    emptyValidate('https://anything.com', (err, origin) => {
      expect(err).toBeNull();
      expect(origin).toBe(false);
    });
  });
});

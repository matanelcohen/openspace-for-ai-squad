import { describe, expect, it } from 'vitest';

import {
  compareSemVer,
  isUpgrade,
  maxVersion,
  parseSemVer,
  satisfiesRange,
  versionDiff,
} from '../versioning/semver.js';

// ── parseSemVer ───────────────────────────────────────────────────

describe('parseSemVer', () => {
  it('parses basic version', () => {
    const r = parseSemVer('1.2.3');
    expect(r).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] });
  });

  it('parses version with v prefix', () => {
    const r = parseSemVer('v1.2.3');
    expect(r).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] });
  });

  it('parses version with prerelease', () => {
    const r = parseSemVer('1.0.0-alpha.1');
    expect(r).toEqual({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'], build: [] });
  });

  it('parses version with build metadata', () => {
    const r = parseSemVer('1.0.0+build.123');
    expect(r).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [], build: ['build', '123'] });
  });

  it('parses version with prerelease and build', () => {
    const r = parseSemVer('v2.1.0-rc.1+20260101');
    expect(r).toEqual({
      major: 2,
      minor: 1,
      patch: 0,
      prerelease: ['rc', '1'],
      build: ['20260101'],
    });
  });

  it('parses 0.0.0', () => {
    expect(parseSemVer('0.0.0')).toEqual({
      major: 0,
      minor: 0,
      patch: 0,
      prerelease: [],
      build: [],
    });
  });

  it('parses large version numbers', () => {
    const r = parseSemVer('999.888.777');
    expect(r).toEqual({ major: 999, minor: 888, patch: 777, prerelease: [], build: [] });
  });

  it('returns null for empty string', () => {
    expect(parseSemVer('')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseSemVer('not-a-version')).toBeNull();
  });

  it('returns null for partial version', () => {
    expect(parseSemVer('1.2')).toBeNull();
  });

  it('returns null for four-part version', () => {
    expect(parseSemVer('1.2.3.4')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(parseSemVer('-1.0.0')).toBeNull();
  });

  it('trims whitespace', () => {
    const r = parseSemVer('  1.2.3  ');
    expect(r).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] });
  });

  it('parses prerelease with dashes', () => {
    const r = parseSemVer('1.0.0-beta-2');
    expect(r).toEqual({ major: 1, minor: 0, patch: 0, prerelease: ['beta-2'], build: [] });
  });
});

// ── compareSemVer ────────────────────────────────────────────────

describe('compareSemVer', () => {
  it('equal versions return 0', () => {
    expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
  });

  it('v-prefixed equal versions return 0', () => {
    expect(compareSemVer('v1.0.0', '1.0.0')).toBe(0);
  });

  it('major difference', () => {
    expect(compareSemVer('2.0.0', '1.0.0')).toBe(1);
    expect(compareSemVer('1.0.0', '2.0.0')).toBe(-1);
  });

  it('minor difference', () => {
    expect(compareSemVer('1.2.0', '1.1.0')).toBe(1);
    expect(compareSemVer('1.1.0', '1.2.0')).toBe(-1);
  });

  it('patch difference', () => {
    expect(compareSemVer('1.0.2', '1.0.1')).toBe(1);
    expect(compareSemVer('1.0.1', '1.0.2')).toBe(-1);
  });

  it('release > prerelease', () => {
    expect(compareSemVer('1.0.0', '1.0.0-alpha')).toBe(1);
    expect(compareSemVer('1.0.0-alpha', '1.0.0')).toBe(-1);
  });

  it('prerelease numeric comparison', () => {
    expect(compareSemVer('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe(1);
    expect(compareSemVer('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
  });

  it('prerelease string comparison', () => {
    expect(compareSemVer('1.0.0-beta', '1.0.0-alpha')).toBe(1);
    expect(compareSemVer('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
  });

  it('numeric prerelease < string prerelease', () => {
    expect(compareSemVer('1.0.0-1', '1.0.0-alpha')).toBe(-1);
  });

  it('fewer prerelease fields = lower precedence', () => {
    expect(compareSemVer('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
  });

  it('throws for invalid first argument', () => {
    expect(() => compareSemVer('bad', '1.0.0')).toThrow('Invalid semver');
  });

  it('throws for invalid second argument', () => {
    expect(() => compareSemVer('1.0.0', 'bad')).toThrow('Invalid semver');
  });
});

// ── versionDiff ──────────────────────────────────────────────────

describe('versionDiff', () => {
  it('returns none for equal versions', () => {
    expect(versionDiff('1.0.0', '1.0.0')).toBe('none');
  });

  it('detects major diff', () => {
    expect(versionDiff('1.0.0', '2.0.0')).toBe('major');
  });

  it('detects minor diff', () => {
    expect(versionDiff('1.0.0', '1.1.0')).toBe('minor');
  });

  it('detects patch diff', () => {
    expect(versionDiff('1.0.0', '1.0.1')).toBe('patch');
  });

  it('detects prerelease diff', () => {
    expect(versionDiff('1.0.0-alpha', '1.0.0-beta')).toBe('prerelease');
  });

  it('returns none for invalid input', () => {
    expect(versionDiff('bad', '1.0.0')).toBe('none');
    expect(versionDiff('1.0.0', 'bad')).toBe('none');
  });

  it('major takes priority over minor', () => {
    expect(versionDiff('1.2.3', '2.3.4')).toBe('major');
  });
});

// ── isUpgrade ────────────────────────────────────────────────────

describe('isUpgrade', () => {
  it('returns true for upgrade', () => {
    expect(isUpgrade('1.0.0', '1.0.1')).toBe(true);
    expect(isUpgrade('1.0.0', '1.1.0')).toBe(true);
    expect(isUpgrade('1.0.0', '2.0.0')).toBe(true);
  });

  it('returns false for downgrade', () => {
    expect(isUpgrade('2.0.0', '1.0.0')).toBe(false);
  });

  it('returns false for equal versions', () => {
    expect(isUpgrade('1.0.0', '1.0.0')).toBe(false);
  });

  it('prerelease to release is upgrade', () => {
    expect(isUpgrade('1.0.0-alpha', '1.0.0')).toBe(true);
  });

  it('release to prerelease is downgrade', () => {
    expect(isUpgrade('1.0.0', '1.0.0-alpha')).toBe(false);
  });
});

// ── satisfiesRange ───────────────────────────────────────────────

describe('satisfiesRange', () => {
  describe('exact match', () => {
    it('matches exact version', () => {
      expect(satisfiesRange('1.2.3', '1.2.3')).toBe(true);
    });

    it('rejects different version', () => {
      expect(satisfiesRange('1.2.4', '1.2.3')).toBe(false);
    });
  });

  describe('comparison operators', () => {
    it('>= operator', () => {
      expect(satisfiesRange('1.0.0', '>=1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.1', '>=1.0.0')).toBe(true);
      expect(satisfiesRange('0.9.9', '>=1.0.0')).toBe(false);
    });

    it('> operator', () => {
      expect(satisfiesRange('1.0.1', '>1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.0', '>1.0.0')).toBe(false);
    });

    it('<= operator', () => {
      expect(satisfiesRange('1.0.0', '<=1.0.0')).toBe(true);
      expect(satisfiesRange('0.9.9', '<=1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.1', '<=1.0.0')).toBe(false);
    });

    it('< operator', () => {
      expect(satisfiesRange('0.9.9', '<1.0.0')).toBe(true);
      expect(satisfiesRange('1.0.0', '<1.0.0')).toBe(false);
    });
  });

  describe('caret ranges', () => {
    it('^1.2.3 allows minor and patch', () => {
      expect(satisfiesRange('1.2.3', '^1.2.3')).toBe(true);
      expect(satisfiesRange('1.9.9', '^1.2.3')).toBe(true);
      expect(satisfiesRange('1.2.4', '^1.2.3')).toBe(true);
    });

    it('^1.2.3 blocks major bump', () => {
      expect(satisfiesRange('2.0.0', '^1.2.3')).toBe(false);
    });

    it('^1.2.3 blocks lower versions', () => {
      expect(satisfiesRange('1.2.2', '^1.2.3')).toBe(false);
    });

    it('^0.2.3 allows only patch for 0.x', () => {
      expect(satisfiesRange('0.2.3', '^0.2.3')).toBe(true);
      expect(satisfiesRange('0.2.9', '^0.2.3')).toBe(true);
      expect(satisfiesRange('0.3.0', '^0.2.3')).toBe(false);
    });

    it('^0.0.3 matches only exact patch for 0.0.x', () => {
      expect(satisfiesRange('0.0.3', '^0.0.3')).toBe(true);
      expect(satisfiesRange('0.0.4', '^0.0.3')).toBe(false);
    });
  });

  describe('tilde ranges', () => {
    it('~1.2.3 allows patch changes', () => {
      expect(satisfiesRange('1.2.3', '~1.2.3')).toBe(true);
      expect(satisfiesRange('1.2.9', '~1.2.3')).toBe(true);
    });

    it('~1.2.3 blocks minor bump', () => {
      expect(satisfiesRange('1.3.0', '~1.2.3')).toBe(false);
    });
  });

  describe('wildcard', () => {
    it('* matches everything', () => {
      expect(satisfiesRange('0.0.1', '*')).toBe(true);
      expect(satisfiesRange('99.99.99', '*')).toBe(true);
    });
  });

  describe('OR ranges', () => {
    it('matches either side of ||', () => {
      expect(satisfiesRange('1.0.0', '1.0.0 || 2.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '1.0.0 || 2.0.0')).toBe(true);
      expect(satisfiesRange('3.0.0', '1.0.0 || 2.0.0')).toBe(false);
    });
  });

  describe('AND ranges (space-separated)', () => {
    it('requires all comparators to pass', () => {
      expect(satisfiesRange('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
      expect(satisfiesRange('0.9.9', '>=1.0.0 <2.0.0')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for invalid version', () => {
      expect(satisfiesRange('bad', '>=1.0.0')).toBe(false);
    });

    it('returns false for invalid range', () => {
      expect(satisfiesRange('1.0.0', 'bad-range')).toBe(false);
    });

    it('handles complex compound ranges', () => {
      expect(satisfiesRange('1.5.0', '>=1.0.0 <2.0.0 || >=3.0.0')).toBe(true);
      expect(satisfiesRange('3.1.0', '>=1.0.0 <2.0.0 || >=3.0.0')).toBe(true);
      expect(satisfiesRange('2.5.0', '>=1.0.0 <2.0.0 || >=3.0.0')).toBe(false);
    });
  });
});

// ── maxVersion ───────────────────────────────────────────────────

describe('maxVersion', () => {
  it('returns highest version', () => {
    expect(maxVersion(['1.0.0', '2.0.0', '1.5.0'])).toBe('2.0.0');
  });

  it('returns null for empty array', () => {
    expect(maxVersion([])).toBeNull();
  });

  it('returns null for all-invalid versions', () => {
    expect(maxVersion(['bad', 'nope'])).toBeNull();
  });

  it('skips invalid versions', () => {
    expect(maxVersion(['bad', '1.0.0', 'nope', '2.0.0'])).toBe('2.0.0');
  });

  it('handles single version', () => {
    expect(maxVersion(['3.0.0'])).toBe('3.0.0');
  });

  it('handles prerelease versions correctly', () => {
    expect(maxVersion(['1.0.0-alpha', '1.0.0'])).toBe('1.0.0');
  });

  it('handles v-prefixed versions', () => {
    expect(maxVersion(['v1.0.0', 'v2.0.0'])).toBe('v2.0.0');
  });
});

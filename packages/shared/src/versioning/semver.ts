/**
 * Semantic Versioning utilities.
 *
 * Parses, compares, and evaluates version range constraints
 * without pulling in the full `semver` npm package.
 *
 * Supports: exact, >=, >, <=, <, ^, ~, wildcard (*), and
 * compound ranges with || (OR) and space (AND / intersection).
 */

// ── Types ────────────────────────────────────────────────────────

export interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string[];
}

export type VersionDiff = 'major' | 'minor' | 'patch' | 'prerelease' | 'none';

// ── Parsing ──────────────────────────────────────────────────────

const SEMVER_RE =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?$/;

/**
 * Parse a semver string into its components.
 * Returns null if the string is not valid semver.
 */
export function parseSemVer(version: string): ParsedSemVer | null {
  const m = SEMVER_RE.exec(version.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
    build: m[5] ? m[5].split('.') : [],
  };
}

// ── Comparison ───────────────────────────────────────────────────

function comparePrereleaseIdentifiers(a: string[], b: string[]): number {
  // No prerelease has higher precedence than any prerelease
  if (a.length === 0 && b.length > 0) return 1;
  if (a.length > 0 && b.length === 0) return -1;

  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (i >= a.length) return -1; // fewer fields = lower precedence
    if (i >= b.length) return 1;

    const ai = a[i];
    const bi = b[i];
    const aNum = /^\d+$/.test(ai);
    const bNum = /^\d+$/.test(bi);

    if (aNum && bNum) {
      const diff = Number(ai) - Number(bi);
      if (diff !== 0) return diff;
    } else if (aNum) {
      return -1; // numeric < string
    } else if (bNum) {
      return 1;
    } else {
      if (ai < bi) return -1;
      if (ai > bi) return 1;
    }
  }
  return 0;
}

/**
 * Compare two semver strings.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 * Throws if either string is not valid semver.
 */
export function compareSemVer(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa) throw new Error(`Invalid semver: "${a}"`);
  if (!pb) throw new Error(`Invalid semver: "${b}"`);

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;

  const pre = comparePrereleaseIdentifiers(pa.prerelease, pb.prerelease);
  if (pre < 0) return -1;
  if (pre > 0) return 1;
  return 0;
}

/**
 * Determine the type of version difference between two versions.
 */
export function versionDiff(from: string, to: string): VersionDiff {
  const a = parseSemVer(from);
  const b = parseSemVer(to);
  if (!a || !b) return 'none';

  if (a.major !== b.major) return 'major';
  if (a.minor !== b.minor) return 'minor';
  if (a.patch !== b.patch) return 'patch';
  if (comparePrereleaseIdentifiers(a.prerelease, b.prerelease) !== 0) return 'prerelease';
  return 'none';
}

/**
 * Check if `candidate` is an upgrade from `current`.
 */
export function isUpgrade(current: string, candidate: string): boolean {
  return compareSemVer(current, candidate) < 0;
}

// ── Range satisfaction ───────────────────────────────────────────

type Comparator = { op: '>=' | '>' | '<=' | '<' | '='; version: ParsedSemVer };

function versionSatisfiesComparator(v: ParsedSemVer, c: Comparator): boolean {
  const cmp = compareSemVer(
    `${v.major}.${v.minor}.${v.patch}${v.prerelease.length ? '-' + v.prerelease.join('.') : ''}`,
    `${c.version.major}.${c.version.minor}.${c.version.patch}${c.version.prerelease.length ? '-' + c.version.prerelease.join('.') : ''}`,
  );
  switch (c.op) {
    case '>=':
      return cmp >= 0;
    case '>':
      return cmp > 0;
    case '<=':
      return cmp <= 0;
    case '<':
      return cmp < 0;
    case '=':
      return cmp === 0;
  }
}

function parseComparatorSet(range: string): Comparator[][] | null {
  const orParts = range.split('||').map((s) => s.trim());
  const result: Comparator[][] = [];

  for (const orPart of orParts) {
    const comparators: Comparator[] = [];
    const tokens = orPart.split(/\s+/);

    for (const token of tokens) {
      if (token === '*' || token === '') {
        comparators.push({ op: '>=', version: { major: 0, minor: 0, patch: 0, prerelease: [], build: [] } });
        continue;
      }

      // ^X.Y.Z — compatible with version (same major for >=1, same major.minor for 0.x)
      if (token.startsWith('^')) {
        const v = parseSemVer(token.slice(1));
        if (!v) return null;
        comparators.push({ op: '>=', version: v });
        if (v.major > 0) {
          comparators.push({
            op: '<',
            version: { major: v.major + 1, minor: 0, patch: 0, prerelease: [], build: [] },
          });
        } else if (v.minor > 0) {
          comparators.push({
            op: '<',
            version: { major: 0, minor: v.minor + 1, patch: 0, prerelease: [], build: [] },
          });
        } else {
          comparators.push({
            op: '<',
            version: { major: 0, minor: 0, patch: v.patch + 1, prerelease: [], build: [] },
          });
        }
        continue;
      }

      // ~X.Y.Z — allows patch-level changes
      if (token.startsWith('~')) {
        const v = parseSemVer(token.slice(1));
        if (!v) return null;
        comparators.push({ op: '>=', version: v });
        comparators.push({
          op: '<',
          version: { major: v.major, minor: v.minor + 1, patch: 0, prerelease: [], build: [] },
        });
        continue;
      }

      // >=, >, <=, <, = or bare version
      const opMatch = /^(>=|>|<=|<|=)?(.+)$/.exec(token);
      if (!opMatch) return null;
      const op = (opMatch[1] || '=') as Comparator['op'];
      const v = parseSemVer(opMatch[2]);
      if (!v) return null;
      comparators.push({ op, version: v });
    }

    result.push(comparators);
  }

  return result;
}

/**
 * Check if a version satisfies a semver range expression.
 *
 * Supported syntax:
 *   - Exact: "1.2.3"
 *   - Comparison: ">=1.0.0", ">1.0.0", "<=2.0.0", "<2.0.0"
 *   - Caret: "^1.2.3" (compatible with major)
 *   - Tilde: "~1.2.3" (compatible with minor)
 *   - Wildcard: "*"
 *   - OR: ">=1.0.0 || >=2.0.0"
 *   - AND (space): ">=1.0.0 <2.0.0"
 */
export function satisfiesRange(version: string, range: string): boolean {
  const v = parseSemVer(version);
  if (!v) return false;

  const sets = parseComparatorSet(range.trim());
  if (!sets) return false;

  // OR semantics across sets — any set fully satisfied = pass
  return sets.some((comparators) => comparators.every((c) => versionSatisfiesComparator(v, c)));
}

/**
 * Find the maximum version from an array.
 * Returns null if the array is empty or contains no valid versions.
 */
export function maxVersion(versions: string[]): string | null {
  let best: string | null = null;
  for (const v of versions) {
    if (!parseSemVer(v)) continue;
    if (best === null || compareSemVer(v, best) > 0) {
      best = v;
    }
  }
  return best;
}

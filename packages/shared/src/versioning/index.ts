/**
 * Versioning module — semantic versioning utilities for skill management.
 */
export {
  compareSemVer,
  isUpgrade,
  maxVersion,
  parseSemVer,
  satisfiesRange,
  versionDiff,
} from './semver.js';

export type { ParsedSemVer, VersionDiff } from './semver.js';

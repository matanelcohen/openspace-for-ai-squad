/**
 * Versioning module — semantic versioning utilities for skill management.
 */
export type { ParsedSemVer, VersionDiff } from './semver.js';
export {
  compareSemVer,
  isUpgrade,
  maxVersion,
  parseSemVer,
  satisfiesRange,
  versionDiff,
} from './semver.js';

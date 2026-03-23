/**
 * Test teardown — Clean up temp files after tests.
 *
 * Provides helpers to remove temporary directories created during
 * integration tests that need write access to .squad/ files.
 */

import fs from 'node:fs/promises';

/**
 * Remove a temporary directory and all its contents.
 * Silently ignores if the directory doesn't exist.
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Directory already removed or doesn't exist — that's fine
  }
}

/**
 * Remove multiple temporary directories.
 */
export async function cleanupTempDirs(dirs: string[]): Promise<void> {
  await Promise.all(dirs.map(cleanupTempDir));
}

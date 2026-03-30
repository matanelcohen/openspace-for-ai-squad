/**
 * One-time migration: normalise legacy task statuses in `.squad/tasks/*.md`.
 *
 * - `backlog`          → `pending`
 * - `in-review`        → `done`
 * - `pending-approval` → `pending`
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';

const STATUS_MAP: Record<string, string> = {
  backlog: 'pending',
  'in-review': 'done',
  'pending-approval': 'pending',
};

export async function migrateTaskStatuses(tasksDir: string): Promise<number> {
  let entries: string[];
  try {
    entries = await fs.readdir(tasksDir);
  } catch {
    return 0;
  }

  const mdFiles = entries.filter((e) => e.endsWith('.md'));
  let migrated = 0;

  for (const file of mdFiles) {
    const filePath = path.join(tasksDir, file);
    const raw = await fs.readFile(filePath, 'utf-8');
    const { data, content } = matter(raw);

    const oldStatus = typeof data.status === 'string' ? data.status : undefined;
    if (!oldStatus || !STATUS_MAP[oldStatus]) continue;

    data.status = STATUS_MAP[oldStatus];
    data.updated = new Date().toISOString();

    const updated = matter.stringify(content, data);
    await fs.writeFile(filePath, updated, 'utf-8');
    migrated++;
  }

  if (migrated > 0) {
    console.log(`[Migration] Migrated ${migrated} task(s) from legacy statuses`);
  }

  return migrated;
}

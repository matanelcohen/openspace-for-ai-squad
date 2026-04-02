/**
 * One-time migration: normalise legacy task statuses in `.squad/tasks/*.md`.
 *
 * - `pending-approval` → `pending`
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';

const STATUS_MAP: Record<string, string> = {
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
    let changed = false;

    // Migrate legacy statuses
    if (oldStatus && STATUS_MAP[oldStatus]) {
      data.status = STATUS_MAP[oldStatus];
      changed = true;
    }

    // Recover orphaned in-progress tasks — on startup, no worker is active yet
    // so any in-progress task is stuck from a previous crash
    if (data.status === 'in-progress') {
      data.status = 'pending';
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const note = `\n\n---\n**[${now}]** ⚠️ Task was stuck in-progress after server restart. Reset to pending.\n`;
      const { data: newData, content: newContent } = matter(matter.stringify(content + note, data));
      data.description = newContent;
      changed = true;
    }

    if (!changed) continue;

    data.updated = new Date().toISOString();
    const updated = matter.stringify(content, data);
    await fs.writeFile(filePath, updated, 'utf-8');
    migrated++;
  }

  if (migrated > 0) {
    console.log(`[Migration] Recovered/migrated ${migrated} task(s)`);
  }

  return migrated;
}

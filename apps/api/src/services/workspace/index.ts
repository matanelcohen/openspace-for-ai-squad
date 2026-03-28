import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import type { Workspace } from '@openspace/shared';

/** Directory for global openspace config (not per-project). */
const OPENSPACE_DIR = join(homedir(), '.openspace');
const WORKSPACES_FILE = join(OPENSPACE_DIR, 'workspaces.json');

/** Generate a URL-safe ID from a workspace name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export class WorkspaceService {
  private workspaces: Workspace[];

  constructor() {
    this.workspaces = this.load();
  }

  // ── Persistence ───────────────────────────────────────────────────

  private load(): Workspace[] {
    try {
      if (existsSync(WORKSPACES_FILE)) {
        const raw = readFileSync(WORKSPACES_FILE, 'utf-8');
        return JSON.parse(raw) as Workspace[];
      }
    } catch {
      // Corrupted file — start fresh
    }
    return [];
  }

  private save(): void {
    if (!existsSync(OPENSPACE_DIR)) {
      mkdirSync(OPENSPACE_DIR, { recursive: true });
    }
    writeFileSync(WORKSPACES_FILE, JSON.stringify(this.workspaces, null, 2));
  }

  // ── Public API ────────────────────────────────────────────────────

  list(): Workspace[] {
    return this.workspaces;
  }

  get(id: string): Workspace | null {
    return this.workspaces.find((w) => w.id === id) ?? null;
  }

  create(input: { name: string; projectDir: string; icon?: string }): Workspace {
    const projectDir = resolve(input.projectDir);
    const squadDir = join(projectDir, '.squad');

    // Ensure .squad/ exists
    if (!existsSync(squadDir)) {
      mkdirSync(squadDir, { recursive: true });
    }

    // Prevent duplicates for the same project directory
    const existing = this.workspaces.find((w) => w.projectDir === projectDir);
    if (existing) {
      return existing;
    }

    // Generate a unique ID
    let id = slugify(input.name);
    if (this.workspaces.some((w) => w.id === id)) {
      id = `${id}-${Date.now().toString(36)}`;
    }

    const isFirst = this.workspaces.length === 0;

    const workspace: Workspace = {
      id,
      name: input.name,
      squadDir,
      projectDir,
      icon: input.icon ?? '🚀',
      isActive: isFirst,
      createdAt: new Date().toISOString(),
    };

    this.workspaces.push(workspace);
    this.save();
    return workspace;
  }

  update(
    id: string,
    updates: Partial<Pick<Workspace, 'name' | 'icon' | 'description'>>,
  ): Workspace | null {
    const workspace = this.workspaces.find((w) => w.id === id);
    if (!workspace) return null;

    if (updates.name !== undefined) workspace.name = updates.name;
    if (updates.icon !== undefined) workspace.icon = updates.icon;
    if (updates.description !== undefined) workspace.description = updates.description;

    this.save();
    return workspace;
  }

  delete(id: string): boolean {
    const idx = this.workspaces.findIndex((w) => w.id === id);
    if (idx === -1) return false;

    const wasActive = this.workspaces[idx]!.isActive;
    this.workspaces.splice(idx, 1);

    // If the deleted workspace was active, activate the first remaining one
    if (wasActive && this.workspaces.length > 0) {
      this.workspaces[0]!.isActive = true;
    }

    this.save();
    return true;
  }

  getActive(): Workspace | null {
    return this.workspaces.find((w) => w.isActive) ?? this.workspaces[0] ?? null;
  }

  setActive(id: string): Workspace | null {
    const target = this.workspaces.find((w) => w.id === id);
    if (!target) return null;

    for (const w of this.workspaces) {
      w.isActive = w.id === id;
    }
    this.save();
    return target;
  }

  /**
   * Auto-register a project directory as a workspace if not already tracked.
   * Called during app startup with the current working directory.
   */
  autoRegister(projectDir: string): Workspace {
    const resolved = resolve(projectDir);
    const existing = this.workspaces.find((w) => w.projectDir === resolved);
    if (existing) return existing;

    const name = basename(resolved);
    return this.create({ name, projectDir: resolved });
  }
}

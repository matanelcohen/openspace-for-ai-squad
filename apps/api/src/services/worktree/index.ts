/**
 * WorktreeService — git worktree-based sandbox for parallel agent execution.
 *
 * Each task gets an isolated git worktree on its own branch:
 *   - Regular tasks: task/<task-id> → PR to main
 *   - Delegated parent tasks: feature/<parent-id> → integration branch
 *   - Subtasks: task/<subtask-id> → PR to feature/<parent-id>
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync, readdirSync, lstatSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorktreeInfo {
  taskId: string;
  path: string;
  branch: string;
  baseBranch: string;
  createdAt: string;
  pr?: { number: number; url: string };
}

export interface WorktreeConfig {
  /** Absolute path to the repo root (main working tree). */
  projectDir: string;
  /** Directory name for worktrees (relative to projectDir). Default: .git-worktrees */
  worktreeDir?: string;
  /** Default base branch. Default: main */
  baseBranch?: string;
  /** Max concurrent worktrees. Default: 10 */
  maxWorktrees?: number;
  /** Run dependency install in new worktrees. Default: false */
  installDeps?: boolean;
  /** Symlink .squad/ into worktrees. Default: true */
  symlinkSquad?: boolean;
  /** Auto-commit on task completion. Default: true */
  autoCommit?: boolean;
  /** Auto-create PR on task completion. Default: true */
  autoPR?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WorktreeService {
  private readonly projectDir: string;
  private readonly worktreeDir: string;
  private readonly baseBranch: string;
  private readonly maxWorktrees: number;
  private readonly installDeps: boolean;
  private readonly symlinkSquad: boolean;
  readonly autoCommit: boolean;
  readonly autoPR: boolean;

  /** In-memory registry of active worktrees. */
  private readonly registry = new Map<string, WorktreeInfo>();

  constructor(config: WorktreeConfig) {
    this.projectDir = config.projectDir;
    this.worktreeDir = config.worktreeDir ?? '.git-worktrees';
    this.baseBranch = config.baseBranch ?? 'main';
    this.maxWorktrees = config.maxWorktrees ?? 10;
    this.installDeps = config.installDeps ?? false;
    this.symlinkSquad = config.symlinkSquad ?? true;
    this.autoCommit = config.autoCommit ?? true;
    this.autoPR = config.autoPR ?? true;
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /**
   * Scan existing worktrees on startup and rebuild registry.
   */
  init(): void {
    const dir = this.worktreesRoot();
    if (!existsSync(dir)) return;

    const existing = readdirSync(dir).filter((f) => {
      const full = join(dir, f);
      return lstatSync(full).isDirectory() && existsSync(join(full, '.git'));
    });

    for (const name of existing) {
      const worktreePath = join(dir, name);
      const branch = this.gitInDir(worktreePath, 'rev-parse --abbrev-ref HEAD').trim();
      this.registry.set(name, {
        taskId: name,
        path: worktreePath,
        branch,
        baseBranch: this.baseBranch,
        createdAt: new Date().toISOString(),
      });
    }

    if (existing.length > 0) {
      console.log(`[WorktreeService] Recovered ${existing.length} worktree(s)`);
    }
  }

  // ── Create ─────────────────────────────────────────────────────

  /**
   * Create an isolated worktree for a task.
   * @param taskId - unique task identifier (used as directory name + branch suffix)
   * @param opts.baseBranch - branch to create from (default: main, or feature/<parent> for subtasks)
   * @param opts.parentTaskId - parent task ID for subtask (creates feature branch if needed)
   */
  async create(
    taskId: string,
    opts?: { baseBranch?: string; parentTaskId?: string },
  ): Promise<WorktreeInfo> {
    // Already exists?
    const existing = this.registry.get(taskId);
    if (existing) {
      console.log(`[WorktreeService] Worktree already exists for ${taskId}`);
      return existing;
    }

    // Capacity check
    if (this.registry.size >= this.maxWorktrees) {
      throw new Error(
        `Max worktrees (${this.maxWorktrees}) reached. Destroy an existing worktree first.`,
      );
    }

    const base = opts?.baseBranch ?? this.baseBranch;
    const branchName = `task/${taskId}`;
    const worktreePath = join(this.worktreesRoot(), taskId);

    // If this is a subtask, ensure the parent feature branch exists
    if (opts?.parentTaskId) {
      await this.ensureFeatureBranch(opts.parentTaskId);
    }

    // Ensure base branch ref exists locally
    this.fetchBranchIfNeeded(base);

    // Create worktree + branch
    mkdirSync(this.worktreesRoot(), { recursive: true });
    this.git(`worktree add ${this.shellEscape(worktreePath)} -b ${this.shellEscape(branchName)} ${this.shellEscape(base)}`);

    console.log(`[WorktreeService] Created worktree ${taskId} (branch: ${branchName}, base: ${base})`);

    // Symlink .squad/ so agent can access config, skills, tasks
    if (this.symlinkSquad) {
      this.symlinkSquadDir(worktreePath);
    }

    // Install dependencies in worktree
    if (this.installDeps) {
      this.installDependencies(worktreePath);
    }

    const info: WorktreeInfo = {
      taskId,
      path: worktreePath,
      branch: branchName,
      baseBranch: base,
      createdAt: new Date().toISOString(),
    };
    this.registry.set(taskId, info);
    return info;
  }

  /**
   * Create a feature branch for a delegated parent task.
   * This becomes the integration branch that subtask PRs merge into.
   */
  async ensureFeatureBranch(parentTaskId: string): Promise<string> {
    const branchName = `feature/${parentTaskId}`;

    // Check if branch already exists
    try {
      this.git(`rev-parse --verify ${this.shellEscape(branchName)}`);
      return branchName; // Already exists
    } catch {
      // Branch doesn't exist, create it
    }

    this.git(`branch ${this.shellEscape(branchName)} ${this.shellEscape(this.baseBranch)}`);
    // Push so subtask PRs can target it
    try {
      this.git(`push -u origin ${this.shellEscape(branchName)}`);
    } catch {
      console.warn(`[WorktreeService] Could not push feature branch (no remote?)`);
    }

    console.log(`[WorktreeService] Created feature branch: ${branchName}`);
    return branchName;
  }

  // ── Query ──────────────────────────────────────────────────────

  get(taskId: string): WorktreeInfo | null {
    return this.registry.get(taskId) ?? null;
  }

  list(): WorktreeInfo[] {
    return Array.from(this.registry.values());
  }

  // ── Git operations on worktrees ────────────────────────────────

  /**
   * Stage and commit all changes in a worktree.
   * Returns the commit SHA, or null if nothing to commit.
   */
  async commit(taskId: string, message: string): Promise<string | null> {
    const info = this.mustGet(taskId);

    // Check for changes
    const status = this.gitInDir(info.path, 'status --porcelain').trim();
    if (!status) {
      console.log(`[WorktreeService] No changes to commit in ${taskId}`);
      return null;
    }

    this.gitInDir(info.path, 'add -A');
    this.gitInDir(info.path, `commit -m ${this.shellEscape(message)}`);

    const sha = this.gitInDir(info.path, 'rev-parse HEAD').trim();
    console.log(`[WorktreeService] Committed ${sha.substring(0, 8)} in ${taskId}`);

    // Push to remote
    try {
      this.gitInDir(info.path, `push -u origin ${this.shellEscape(info.branch)}`);
    } catch {
      console.warn(`[WorktreeService] Could not push ${info.branch} (no remote?)`);
    }

    return sha;
  }

  /**
   * Get a diff summary of changes in the worktree.
   */
  async diff(taskId: string): Promise<string> {
    const info = this.mustGet(taskId);
    const staged = this.gitInDir(info.path, 'diff --cached --stat').trim();
    const unstaged = this.gitInDir(info.path, 'diff --stat').trim();
    const untracked = this.gitInDir(info.path, 'ls-files --others --exclude-standard').trim();

    return [
      staged ? `Staged:\n${staged}` : '',
      unstaged ? `Unstaged:\n${unstaged}` : '',
      untracked ? `Untracked:\n${untracked}` : '',
    ]
      .filter(Boolean)
      .join('\n\n') || 'No changes';
  }

  /**
   * Create a PR from the worktree's branch.
   */
  async createPR(
    taskId: string,
    opts: { title: string; body: string; baseBranch?: string },
  ): Promise<{ number: number; url: string }> {
    const info = this.mustGet(taskId);
    const base = opts.baseBranch ?? info.baseBranch;

    const truncatedBody = opts.body.length > 2000
      ? opts.body.substring(0, 2000) + '\n\n_(truncated)_'
      : opts.body;
    const baseFlag = `--base ${this.shellEscape(base)}`;
    const url = this.gitInDir(
      info.path,
      `gh pr create --title ${this.shellEscape(opts.title)} --body ${this.shellEscape(truncatedBody)} --head ${this.shellEscape(info.branch)} ${baseFlag}`,
    ).trim();

    const match = url.match(/\/pull\/(\d+)/);
    const number = match ? parseInt(match[1], 10) : 0;
    const pr = { number, url };
    info.pr = pr;
    console.log(`[WorktreeService] PR #${pr.number} created for ${taskId}: ${pr.url}`);
    return pr;
  }

  // ── Cleanup ────────────────────────────────────────────────────

  /**
   * Remove a worktree and optionally delete its branch.
   */
  async destroy(taskId: string, opts?: { deleteBranch?: boolean }): Promise<void> {
    const info = this.registry.get(taskId);
    if (!info) return;

    try {
      // Remove symlinks first so git worktree remove doesn't error
      this.removSquadSymlink(info.path);
      this.git(`worktree remove ${this.shellEscape(info.path)} --force`);
    } catch (err) {
      console.warn(`[WorktreeService] Failed to remove worktree ${taskId}:`, err);
    }

    if (opts?.deleteBranch !== false) {
      try {
        this.git(`branch -D ${this.shellEscape(info.branch)}`);
      } catch {
        // Branch may already be deleted
      }
    }

    this.registry.delete(taskId);
    console.log(`[WorktreeService] Destroyed worktree ${taskId}`);
  }

  /**
   * Clean up worktrees for tasks that are done or blocked.
   */
  async cleanupStale(isDoneOrBlocked: (taskId: string) => boolean): Promise<number> {
    let cleaned = 0;
    for (const [taskId] of this.registry) {
      if (isDoneOrBlocked(taskId)) {
        await this.destroy(taskId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[WorktreeService] Cleaned up ${cleaned} stale worktree(s)`);
    }
    return cleaned;
  }

  // ── Feature branch completion (delegation) ─────────────────────

  /**
   * Create a final PR from a feature branch to main.
   * Called when all subtasks of a delegated parent are done.
   */
  async createFeaturePR(
    parentTaskId: string,
    opts: { title: string; body: string },
  ): Promise<{ number: number; url: string } | null> {
    const branchName = `feature/${parentTaskId}`;

    // Verify branch exists
    try {
      this.git(`rev-parse --verify ${this.shellEscape(branchName)}`);
    } catch {
      console.warn(`[WorktreeService] Feature branch ${branchName} not found`);
      return null;
    }

    try {
      const truncatedBody = opts.body.length > 2000
        ? opts.body.substring(0, 2000) + '\n\n_(truncated)_'
        : opts.body;
      const url = this.exec(
        `gh pr create --title ${this.shellEscape(opts.title)} --body ${this.shellEscape(truncatedBody)} --head ${this.shellEscape(branchName)} --base ${this.shellEscape(this.baseBranch)}`,
      ).trim();
      const match = url.match(/\/pull\/(\d+)/);
      const number = match ? parseInt(match[1], 10) : 0;
      const pr = { number, url };
      console.log(`[WorktreeService] Feature PR #${pr.number} for ${parentTaskId}: ${pr.url}`);
      return pr;
    } catch (err) {
      console.error(`[WorktreeService] Failed to create feature PR:`, err);
      return null;
    }
  }

  /**
   * Clean up all worktrees and branches for a delegated parent + its subtasks.
   */
  async cleanupDelegation(
    parentTaskId: string,
    subtaskIds: string[],
  ): Promise<void> {
    // Destroy subtask worktrees
    for (const subtaskId of subtaskIds) {
      await this.destroy(subtaskId);
    }

    // Delete feature branch
    const branchName = `feature/${parentTaskId}`;
    try {
      this.git(`branch -D ${this.shellEscape(branchName)}`);
    } catch {
      // May already be deleted
    }

    console.log(`[WorktreeService] Cleaned up delegation: ${parentTaskId} + ${subtaskIds.length} subtask(s)`);
  }

  // ── Private helpers ────────────────────────────────────────────

  private worktreesRoot(): string {
    return resolve(this.projectDir, this.worktreeDir);
  }

  private mustGet(taskId: string): WorktreeInfo {
    const info = this.registry.get(taskId);
    if (!info) throw new Error(`No worktree found for task ${taskId}`);
    return info;
  }

  private symlinkSquadDir(worktreePath: string): void {
    const squadSource = resolve(this.projectDir, '.squad');
    const squadTarget = join(worktreePath, '.squad');

    if (!existsSync(squadSource)) return;

    // Create .squad/ directory in worktree (NOT a symlink)
    // Only symlink safe subdirs — exclude tasks/ to prevent agents from creating subtasks
    try {
      mkdirSync(squadTarget, { recursive: true });

      const safeDirs = ['agents', 'skills', 'templates', 'charters'];
      for (const dir of safeDirs) {
        const src = join(squadSource, dir);
        const dst = join(squadTarget, dir);
        if (existsSync(src) && !existsSync(dst)) {
          symlinkSync(src, dst, 'dir');
        }
      }

      // Symlink individual config files (team.md, etc.)
      const safeFiles = ['team.md', 'config.yaml'];
      for (const file of safeFiles) {
        const src = join(squadSource, file);
        const dst = join(squadTarget, file);
        if (existsSync(src) && !existsSync(dst)) {
          symlinkSync(src, dst, 'file');
        }
      }

      console.log(`[WorktreeService] Symlinked .squad/ subdirs (excluding tasks/) into ${worktreePath}`);
    } catch (err) {
      console.warn(`[WorktreeService] Failed to symlink .squad/:`, err);
    }
  }

  private removSquadSymlink(worktreePath: string): void {
    const squadTarget = join(worktreePath, '.squad');
    try {
      if (!existsSync(squadTarget)) return;

      // Remove symlinked subdirs first
      const entries = readdirSync(squadTarget);
      for (const entry of entries) {
        const entryPath = join(squadTarget, entry);
        if (lstatSync(entryPath).isSymbolicLink()) {
          unlinkSync(entryPath);
        }
      }
    } catch {
      // Ignore
    }
  }

  private fetchBranchIfNeeded(branch: string): void {
    try {
      this.git(`rev-parse --verify ${this.shellEscape(branch)}`);
    } catch {
      // Branch not local — try fetching from origin
      try {
        this.git(`fetch origin ${this.shellEscape(branch)}`);
        this.git(`branch ${this.shellEscape(branch)} origin/${this.shellEscape(branch)}`);
      } catch {
        // Ignore — may be a new branch
      }
    }
  }

  private installDependencies(worktreePath: string): void {
    const hasLockfile = existsSync(join(worktreePath, 'pnpm-lock.yaml'));
    if (!hasLockfile) return;

    try {
      console.log(`[WorktreeService] Installing deps in ${worktreePath}...`);
      execSync('pnpm install --frozen-lockfile', {
        cwd: worktreePath,
        encoding: 'utf-8',
        timeout: 120_000,
        stdio: 'pipe',
      });
    } catch (err) {
      console.warn(`[WorktreeService] Dep install failed (non-blocking):`, err);
    }
  }

  private git(args: string): string {
    return this.exec(`git ${args}`);
  }

  private gitInDir(dir: string, args: string): string {
    return execSync(`git ${args}`, {
      cwd: dir,
      encoding: 'utf-8',
      env: { ...process.env },
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  private exec(command: string): string {
    return execSync(command, {
      cwd: this.projectDir,
      encoding: 'utf-8',
      env: { ...process.env },
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
}

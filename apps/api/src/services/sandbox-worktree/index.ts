/**
 * SandboxService — tmp-directory-based sandbox for parallel agent execution.
 *
 * Each task gets an isolated temp directory with a shallow clone of the repo.
 * Changes are committed to a task branch and PRs are created automatically.
 *
 * Branch strategy:
 *   - Regular tasks: task/<task-id> → PR to main
 *   - Delegated parent tasks: feature/<parent-id> → integration branch
 *   - Subtasks: task/<subtask-id> → PR to feature/<parent-id>
 */

import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import tmp from 'tmp';

// Auto-cleanup tmp dirs on process exit
tmp.setGracefulCleanup();

// ---------------------------------------------------------------------------
// Types (keep same interface so no downstream changes needed)
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
  projectDir: string;
  baseBranch?: string;
  maxWorktrees?: number;
  symlinkSquad?: boolean;
  autoCommit?: boolean;
  autoPR?: boolean;
  worktreeDir?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WorktreeService {
  private readonly projectDir: string;
  private readonly baseBranch: string;
  private readonly maxWorktrees: number;
  readonly autoCommit: boolean;
  readonly autoPR: boolean;

  private readonly registry = new Map<string, WorktreeInfo>();
  private readonly cleanupFns = new Map<string, () => void>();

  constructor(config: WorktreeConfig) {
    this.projectDir = config.projectDir;
    this.baseBranch = config.baseBranch ?? 'main';
    this.maxWorktrees = config.maxWorktrees ?? 10;
    this.autoCommit = config.autoCommit ?? true;
    this.autoPR = config.autoPR ?? true;
  }

  init(): void { /* tmp dirs are ephemeral — nothing to recover */ }

  async cleanupDoneTasks(getTaskStatus: (taskId: string) => string | null): Promise<void> {
    const toClean: string[] = [];
    for (const [taskId] of this.registry) {
      const status = getTaskStatus(taskId);
      if (status === 'done' || status === 'blocked' || status === 'merged' || status === null) {
        toClean.push(taskId);
      }
    }
    for (const taskId of toClean) {
      await this.destroy(taskId);
    }
    if (toClean.length > 0) {
      console.log(`[Sandbox] Cleaned ${toClean.length} sandbox(es)`);
    }
  }

  // ── Create ─────────────────────────────────────────────────────

  async create(
    taskId: string,
    opts?: { baseBranch?: string; parentTaskId?: string },
  ): Promise<WorktreeInfo> {
    const existing = this.registry.get(taskId);
    if (existing && existsSync(existing.path)) return existing;

    if (this.registry.size >= this.maxWorktrees) {
      throw new Error(`Max sandboxes (${this.maxWorktrees}) reached.`);
    }

    let base = opts?.baseBranch ?? this.baseBranch;
    const branchName = `task/${taskId}`;

    if (opts?.parentTaskId) {
      try {
        await this.ensureFeatureBranch(opts.parentTaskId);
      } catch {
        console.warn(`[Sandbox] Feature branch creation failed, using ${this.baseBranch}`);
        base = this.baseBranch;
      }
    }

    // Create task branch from base
    try {
      this.gitMain(`branch ${this.esc(branchName)} ${this.esc(base)}`);
    } catch { /* branch may exist */ }

    // Create tmp directory with shallow clone
    const tmpDir = tmp.dirSync({ prefix: `openspace-${taskId}-`, unsafeCleanup: true });
    this.cleanupFns.set(taskId, tmpDir.removeCallback);

    this.exec(`git clone --branch ${this.esc(branchName)} --single-branch --depth 1 file://${this.esc(this.projectDir)} ${this.esc(tmpDir.name)}`);

    // Configure git user in the clone
    this.gitIn(tmpDir.name, 'config user.email "agent@openspace.ai"');
    this.gitIn(tmpDir.name, 'config user.name "openspace-agent"');

    console.log(`[Sandbox] Created ${taskId} (${branchName} from ${base}) → ${tmpDir.name}`);

    const info: WorktreeInfo = {
      taskId,
      path: tmpDir.name,
      branch: branchName,
      baseBranch: base,
      createdAt: new Date().toISOString(),
    };
    this.registry.set(taskId, info);
    return info;
  }

  async ensureFeatureBranch(parentTaskId: string): Promise<string> {
    const branchName = `feature/${parentTaskId}`;
    try {
      this.gitMain(`rev-parse --verify ${this.esc(branchName)}`);
      return branchName;
    } catch { /* create it */ }

    this.gitMain(`branch ${this.esc(branchName)} ${this.esc(this.baseBranch)}`);
    try { this.gitMain(`push -u origin ${this.esc(branchName)}`); } catch { /* no remote */ }
    console.log(`[Sandbox] Created feature branch: ${branchName}`);
    return branchName;
  }

  // ── Query ──────────────────────────────────────────────────────

  get(taskId: string): WorktreeInfo | null {
    return this.registry.get(taskId) ?? null;
  }

  list(): WorktreeInfo[] {
    return Array.from(this.registry.values());
  }

  // ── Git operations ─────────────────────────────────────────────

  async commit(taskId: string, message: string): Promise<string | null> {
    const info = this.mustGet(taskId);
    if (!existsSync(info.path)) {
      console.warn(`[Sandbox] Path gone for ${taskId}`);
      return null;
    }

    const status = this.gitIn(info.path, 'status --porcelain').trim();
    if (!status) {
      console.log(`[Sandbox] No changes to commit in ${taskId}`);
      return null;
    }

    this.gitIn(info.path, 'add -A');
    this.gitIn(info.path, `commit -m ${this.esc(message)}`);
    const sha = this.gitIn(info.path, 'rev-parse HEAD').trim();
    console.log(`[Sandbox] Committed ${sha.substring(0, 8)} in ${taskId}`);

    // Push changes back to the main repo
    try {
      this.gitIn(info.path, `push origin ${this.esc(info.branch)}`);
    } catch {
      // Push to main repo directly if no remote
      try {
        this.gitMain(`fetch ${this.esc(info.path)} ${this.esc(info.branch)}:${this.esc(info.branch)}`);
      } catch { console.warn(`[Sandbox] Could not push ${info.branch}`); }
    }

    return sha;
  }

  async diff(taskId: string): Promise<string> {
    const info = this.mustGet(taskId);
    if (!existsSync(info.path)) return 'Sandbox not found';
    return this.gitIn(info.path, 'diff --stat HEAD').trim() || 'No changes';
  }

  async createPR(
    taskId: string,
    opts: { title: string; body: string; baseBranch?: string },
  ): Promise<{ number: number; url: string }> {
    const info = this.mustGet(taskId);
    const base = opts.baseBranch ?? info.baseBranch;

    // Ensure branch is on remote
    try { this.gitMain(`push -u origin ${this.esc(info.branch)}`); } catch { /* ok */ }

    const bodyFile = tmp.fileSync({ prefix: 'pr-body-', postfix: '.md' });
    try {
      writeFileSync(bodyFile.name, opts.body, 'utf-8');
      const url = this.exec(
        `gh pr create --title ${this.esc(opts.title)} --body-file ${this.esc(bodyFile.name)} --head ${this.esc(info.branch)} --base ${this.esc(base)}`,
      ).trim();

      const match = url.match(/\/pull\/(\d+)/);
      const number = match ? parseInt(match[1], 10) : 0;
      const pr = { number, url };
      info.pr = pr;
      console.log(`[Sandbox] PR #${pr.number} for ${taskId}: ${pr.url}`);

      // Auto-merge subtask PRs into feature branch
      if (base.startsWith('feature/')) {
        try {
          this.exec(`gh pr merge ${number} --merge --delete-branch`);
          console.log(`[Sandbox] PR #${number} auto-merged into ${base}`);
        } catch (err) {
          console.warn(`[Sandbox] Auto-merge #${number} failed:`, err);
        }
      }

      return pr;
    } finally {
      bodyFile.removeCallback();
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────

  async destroy(taskId: string, opts?: { deleteBranch?: boolean }): Promise<void> {
    const cleanup = this.cleanupFns.get(taskId);
    if (cleanup) {
      try { cleanup(); } catch { /* ignore */ }
      this.cleanupFns.delete(taskId);
    }

    if (opts?.deleteBranch !== false) {
      const info = this.registry.get(taskId);
      if (info) {
        try { this.gitMain(`branch -D ${this.esc(info.branch)}`); } catch { /* ok */ }
      }
    }

    this.registry.delete(taskId);
    console.log(`[Sandbox] Destroyed ${taskId}`);
  }

  async createFeaturePR(
    parentTaskId: string,
    opts: { title: string; body: string },
  ): Promise<{ number: number; url: string } | null> {
    const branchName = `feature/${parentTaskId}`;
    try { this.gitMain(`rev-parse --verify ${this.esc(branchName)}`); } catch { return null; }
    try { this.gitMain(`push -u origin ${this.esc(branchName)}`); } catch { /* ok */ }

    const bodyFile = tmp.fileSync({ prefix: 'pr-body-feature-', postfix: '.md' });
    try {
      writeFileSync(bodyFile.name, opts.body, 'utf-8');
      const url = this.exec(
        `gh pr create --title ${this.esc(opts.title)} --body-file ${this.esc(bodyFile.name)} --head ${this.esc(branchName)} --base ${this.esc(this.baseBranch)}`,
      ).trim();

      const match = url.match(/\/pull\/(\d+)/);
      const number = match ? parseInt(match[1], 10) : 0;
      console.log(`[Sandbox] Feature PR #${number} for ${parentTaskId}: ${url}`);
      return { number, url };
    } catch (err) {
      console.error(`[Sandbox] Feature PR failed:`, err);
      return null;
    } finally {
      bodyFile.removeCallback();
    }
  }

  async cleanupDelegation(parentTaskId: string, subtaskIds: string[]): Promise<void> {
    for (const id of subtaskIds) await this.destroy(id);
    try { this.gitMain(`branch -D feature/${parentTaskId}`); } catch { /* ok */ }
    console.log(`[Sandbox] Cleaned delegation: ${parentTaskId} + ${subtaskIds.length} subtask(s)`);
  }

  // ── Helpers ────────────────────────────────────────────────────

  private mustGet(taskId: string): WorktreeInfo {
    const info = this.registry.get(taskId);
    if (!info) throw new Error(`No sandbox for task ${taskId}`);
    return info;
  }

  private gitMain(args: string): string {
    // Ensure we're on the base branch before any git operations on the main repo
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.projectDir, encoding: 'utf-8', timeout: 5_000 }).trim();
    if (currentBranch !== this.baseBranch) {
      console.warn(`[Sandbox] Main repo on '${currentBranch}', switching to '${this.baseBranch}'`);
      execSync(`git checkout ${this.baseBranch}`, { cwd: this.projectDir, encoding: 'utf-8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'] });
    }
    return execSync(`git ${args}`, { cwd: this.projectDir, encoding: 'utf-8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'] });
  }

  private gitIn(dir: string, args: string): string {
    return execSync(`git ${args}`, { cwd: dir, encoding: 'utf-8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'] });
  }

  private exec(command: string): string {
    return execSync(command, { cwd: this.projectDir, encoding: 'utf-8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'] });
  }

  private esc(v: string): string {
    return `'${v.replace(/'/g, "'\\''")}'`;
  }
}

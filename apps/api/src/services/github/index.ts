/**
 * GitHub integration service — wraps the `gh` CLI for issues, branches and PRs.
 */

import { execSync } from 'node:child_process';

import type { GitHubIssue, GitHubPR } from '@matanelcohen/openspace-shared';

export class GitHubService {
  constructor(private projectDir: string) {}

  // ---------------------------------------------------------------------------
  // Issues
  // ---------------------------------------------------------------------------

  async listIssues(state?: 'open' | 'closed'): Promise<GitHubIssue[]> {
    const stateFlag = state ? `--state ${state}` : '--state open';
    const raw = this.exec(
      `gh issue list ${stateFlag} --json number,title,body,state,labels,url --limit 100`,
    );
    return JSON.parse(raw) as GitHubIssue[];
  }

  async getIssue(issueNumber: number): Promise<GitHubIssue> {
    const raw = this.exec(
      `gh issue view ${issueNumber} --json number,title,body,state,labels,url`,
    );
    return JSON.parse(raw) as GitHubIssue;
  }

  async createIssueFromTask(task: {
    title: string;
    description: string;
  }): Promise<{ number: number; url: string }> {
    const raw = this.exec(
      `gh issue create --title ${this.shellEscape(task.title)} --body ${this.shellEscape(task.description)} --json number,url`,
    );
    return JSON.parse(raw) as { number: number; url: string };
  }

  // ---------------------------------------------------------------------------
  // Branches
  // ---------------------------------------------------------------------------

  async createBranch(name: string, from?: string): Promise<void> {
    if (from) {
      this.exec(`git checkout -b ${this.shellEscape(name)} ${this.shellEscape(from)}`);
    } else {
      this.exec(`git checkout -b ${this.shellEscape(name)}`);
    }
  }

  async getCurrentBranch(): Promise<string> {
    return this.exec('git rev-parse --abbrev-ref HEAD').trim();
  }

  // ---------------------------------------------------------------------------
  // Pull Requests
  // ---------------------------------------------------------------------------

  async createPR(options: {
    title: string;
    body: string;
    head: string;
    base?: string;
  }): Promise<{ number: number; url: string }> {
    // Ensure branch is pushed to remote before creating PR
    try {
      this.exec(`git push -u origin ${this.shellEscape(options.head)}`);
    } catch {
      // May already be pushed or branch doesn't exist locally
    }

    const baseFlag = options.base ? `--base ${this.shellEscape(options.base)}` : '';
    const truncatedBody = options.body.length > 2000
      ? options.body.substring(0, 2000) + '\n\n_(truncated)_'
      : options.body;
    const url = this.exec(
      `gh pr create --title ${this.shellEscape(options.title)} --body ${this.shellEscape(truncatedBody)} --head ${this.shellEscape(options.head)} ${baseFlag}`.trim(),
    ).trim();
    const match = url.match(/\/pull\/(\d+)/);
    const number = match ? parseInt(match[1], 10) : 0;
    return { number, url };
  }

  async listPRs(state?: 'open' | 'closed'): Promise<GitHubPR[]> {
    const stateFlag = state ? `--state ${state}` : '--state open';
    const raw = this.exec(
      `gh pr list ${stateFlag} --json number,title,body,state,headRefName,baseRefName,url --limit 100`,
    );
    const items = JSON.parse(raw) as Array<Record<string, unknown>>;
    return items.map((item) => ({
      number: item.number as number,
      title: item.title as string,
      body: (item.body as string) ?? '',
      state: item.state as string,
      head: { ref: item.headRefName as string },
      base: { ref: item.baseRefName as string },
      url: item.url as string,
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private exec(command: string): string {
    return execSync(command, {
      cwd: this.projectDir,
      encoding: 'utf-8',
      env: { ...process.env },
      timeout: 30_000,
    });
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
}

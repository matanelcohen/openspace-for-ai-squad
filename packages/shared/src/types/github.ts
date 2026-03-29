/**
 * GitHub integration types — issues, PRs, and branches.
 */

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string }>;
  url: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: string;
  head: { ref: string };
  base: { ref: string };
  url: string;
}

/**
 * Workspace — a project/repo managed by openspace.
 *
 * Each workspace maps to a separate `.squad/` directory and allows
 * users to manage multiple teams/repos from a single UI.
 */
export interface Workspace {
  id: string;
  name: string;
  /** Absolute path to the `.squad/` directory. */
  squadDir: string;
  /** Absolute path to the repository root. */
  projectDir: string;
  description?: string;
  /** Emoji icon for quick identification. */
  icon?: string;
  /** Whether this workspace is the currently active one. */
  isActive: boolean;
  createdAt: string;
}

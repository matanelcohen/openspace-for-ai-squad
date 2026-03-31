/**
 * Sandbox types — containers for agent code execution.
 *
 * These types mirror the API implementation in apps/api/src/services/sandbox/types.ts.
 */

// ── Runtime environments ──────────────────────────────────────────

export type SandboxRuntime = 'node' | 'python' | 'go';

export const SANDBOX_RUNTIMES: readonly SandboxRuntime[] = ['node', 'python', 'go'];

// ── Lifecycle ─────────────────────────────────────────────────────

export type SandboxStatus = 'creating' | 'ready' | 'busy' | 'stopped' | 'destroyed' | 'error';

export interface SandboxResourceLimits {
  /** CPU shares (relative weight). Default: 1024 (1 CPU). */
  cpuShares?: number;
  /** Memory limit in bytes. Default: 512MB. */
  memoryBytes?: number;
  /** Execution timeout in milliseconds. Default: 300_000 (5 min). */
  timeoutMs?: number;
}

export interface SandboxInfo {
  id: string;
  containerId: string;
  runtime: SandboxRuntime;
  status: SandboxStatus;
  limits: Required<SandboxResourceLimits>;
  createdAt: string;
}

export interface SandboxCreateInput {
  runtime: SandboxRuntime;
  limits?: SandboxResourceLimits;
  env?: Record<string, string>;
}

// ── Command execution ─────────────────────────────────────────────

export interface ExecRequest {
  /** Shell command to execute inside the sandbox. */
  command: string;
  /** Working directory inside the container. Default: /workspace */
  workdir?: string;
  /** Additional env vars for this execution only. */
  env?: Record<string, string>;
  /** Override the timeout for this specific exec. */
  timeoutMs?: number;
}

export interface ExecResult {
  /** Unique execution ID. */
  execId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Whether the command was killed due to timeout. */
  timedOut: boolean;
  durationMs: number;
}

// ── Streaming output ──────────────────────────────────────────────

export interface StreamChunk {
  execId: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: string;
}

export interface StreamEnd {
  execId: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

// ── File operations ───────────────────────────────────────────────

export interface SandboxFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  children?: SandboxFile[];
}

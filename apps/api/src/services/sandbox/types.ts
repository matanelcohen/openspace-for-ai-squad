/**
 * Sandbox container types.
 *
 * Defines the interfaces for sandbox lifecycle management, command execution,
 * resource limits, and streaming output.
 */

// ── Runtime environments ──────────────────────────────────────────

export const SANDBOX_RUNTIMES = ['node', 'python', 'go'] as const;
export type SandboxRuntime = (typeof SANDBOX_RUNTIMES)[number];

/** Docker images for each runtime. */
export const RUNTIME_IMAGES: Record<SandboxRuntime, string> = {
  node: 'node:22-slim',
  python: 'python:3.12-slim',
  go: 'golang:1.22-alpine',
};

// ── Resource limits ───────────────────────────────────────────────

export interface ResourceLimits {
  /** CPU shares (relative weight). Default: 1024 (1 CPU). */
  cpuShares?: number;
  /** Memory limit in bytes. Default: 512MB. */
  memoryBytes?: number;
  /** Execution timeout in milliseconds. Default: 300_000 (5 min). */
  timeoutMs?: number;
}

export const DEFAULT_RESOURCE_LIMITS: Required<ResourceLimits> = {
  cpuShares: 1024,
  memoryBytes: 512 * 1024 * 1024, // 512 MB
  timeoutMs: 300_000, // 5 minutes
};

// ── Sandbox lifecycle ─────────────────────────────────────────────

export type SandboxStatus = 'creating' | 'ready' | 'busy' | 'stopped' | 'destroyed' | 'error';

export interface SandboxConfig {
  runtime: SandboxRuntime;
  limits?: ResourceLimits;
  /** Optional environment variables injected into the container. */
  env?: Record<string, string>;
}

export interface SandboxInfo {
  id: string;
  containerId: string;
  runtime: SandboxRuntime;
  status: SandboxStatus;
  limits: Required<ResourceLimits>;
  createdAt: string;
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

// ── Pool configuration ────────────────────────────────────────────

export interface PoolConfig {
  /** Minimum pre-warmed containers per runtime. Default: 0. */
  minPerRuntime?: number;
  /** Maximum total containers across all runtimes. Default: 10. */
  maxTotal?: number;
  /** How long an idle sandbox lives before auto-destroy (ms). Default: 600_000 (10 min). */
  idleTimeoutMs?: number;
}

export const DEFAULT_POOL_CONFIG: Required<PoolConfig> = {
  minPerRuntime: 0,
  maxTotal: 10,
  idleTimeoutMs: 600_000, // 10 minutes
};

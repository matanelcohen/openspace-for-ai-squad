/**
 * Sandbox types — containers for agent code execution.
 */

export type SandboxStatus = 'creating' | 'running' | 'stopped' | 'error' | 'destroying';

export type SandboxRuntime = 'node' | 'python' | 'go';

export interface Sandbox {
  id: string;
  name: string;
  runtime: SandboxRuntime;
  status: SandboxStatus;
  agentId: string | null;
  createdAt: string;
  lastActivityAt: string;
  /** Container image tag, e.g. "node:20-slim" */
  image: string;
  /** Exposed port for dev server, if any */
  port: number | null;
  /** CPU / memory usage summary */
  resources: SandboxResources;
}

export interface SandboxResources {
  cpuPercent: number;
  memoryMb: number;
  memoryLimitMb: number;
}

export interface SandboxCommand {
  sandboxId: string;
  command: string;
}

export interface SandboxOutputLine {
  /** Monotonic line index */
  index: number;
  /** Raw text, may include ANSI escape sequences */
  text: string;
  /** ISO timestamp */
  timestamp: string;
  /** Stream source */
  stream: 'stdout' | 'stderr';
}

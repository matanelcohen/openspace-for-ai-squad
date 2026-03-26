# Sandbox Architecture — Design & API Contract

> **Status:** Draft · **Author:** Leela (Squad Lead) · **Date:** 2026-03-26
>
> Defines the architecture for sandboxed code execution: container lifecycle,
> REST/WebSocket API surface, security model, and runtime plugin interface.
> This document is the build contract for **bender** (backend/infra) and
> **fry** (frontend integration).

---

## 1. Problem Statement

Agents in openspace.ai need to execute arbitrary code — running scripts,
installing packages, compiling programs, starting dev servers — as part of
task workflows. Today, `ToolExecutor` shells out via `execFile` in the API
process with no isolation. This is:

| Gap | Risk |
|-----|------|
| No filesystem isolation | Agent code can read/write host files |
| No network isolation | Unconstrained outbound access |
| No resource limits | Runaway process can OOM the host |
| No multi-runtime support | Only Node via child_process |
| No persistent workspace | Execution state lost between calls |
| No streaming output | Client must poll for results |

This design introduces **Docker-based sandbox containers** with a managed
lifecycle, strict resource constraints, and a streaming API. It preserves
the existing `Sandbox*` types in `@openspace/shared` and the frontend hooks
in `use-sandboxes.ts` / `use-sandbox-stream.ts`.

---

## 2. Design Principles

1. **Defense in depth** — every layer (container, network, filesystem, runtime)
   enforces its own limits. No single bypass compromises the host.
2. **Ephemeral by default** — containers are stateless. Persistent workspace
   files live in a mounted volume that survives container restarts but is
   scoped to the sandbox ID.
3. **Streaming-first** — all execution output is pushed via WebSocket in
   real-time. REST endpoints are for lifecycle management only.
4. **Runtime-agnostic** — Node, Python, and Go are first-class runtimes.
   Adding a new runtime requires only a `RuntimePlugin` implementation
   and a container image — no core changes.
5. **Composable with DAG engine** — sandbox execution is a first-class
   `StepNode` type (`task` with `executor: 'sandbox'`), enabling workflows
   to run code steps in isolated containers.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js)                        │
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ SandboxPanel │  │ TerminalOutput  │  │  RuntimeSelector    │ │
│  └──────┬───────┘  └───────┬─────────┘  └──────────┬──────────┘ │
│         │ REST              │ WebSocket             │ REST       │
└─────────┼──────────────────┼───────────────────────┼────────────┘
          │                  │                       │
          ▼                  ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     apps/api (Fastify)                            │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                   Sandbox Service                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ Lifecycle Mgr │  │ Exec Engine  │  │ Stream Router  │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │   │
│  │         │                 │                   │            │   │
│  │  ┌──────▼─────────────────▼───────────────────▼────────┐  │   │
│  │  │              Container Driver (Docker)               │  │   │
│  │  └──────────────────────┬──────────────────────────────┘  │   │
│  └─────────────────────────┼─────────────────────────────────┘   │
│                            │                                     │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │                 Runtime Plugin Registry                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │  │
│  │  │  Node.js  │  │  Python  │  │   Go     │  │  (custom) │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Docker Engine                                 │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  sbx-abc123      │  │  sbx-def456      │   ...               │
│  │  node:22-slim    │  │  python:3.12-slim│                     │
│  │  /workspace (vol)│  │  /workspace (vol)│                     │
│  │  CPU: 1 core     │  │  CPU: 0.5 core   │                     │
│  │  Mem: 512 MB     │  │  Mem: 256 MB     │                     │
│  │  Net: isolated   │  │  Net: isolated   │                     │
│  └──────────────────┘  └──────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Container Lifecycle

### 4.1 State Machine

```
                    create
    ────────────► CREATING ─────────►  RUNNING
                     │                   │  ▲
                     │ error              │  │ restart
                     ▼                   │  │
                   ERROR ◄──── stop ─── │  │
                     │                   ▼  │
                     │               STOPPED ┘
                     │                   │
                     └───► DESTROYING ◄──┘
                              │
                              ▼
                           (removed)
```

### 4.2 States

| State | Description | Transitions |
|-------|-------------|-------------|
| `creating` | Image pull + container start in progress | → `running`, → `error` |
| `running` | Container is live and accepting exec commands | → `stopped`, → `error`, → `destroying` |
| `stopped` | Container exited or was stopped; workspace preserved | → `running` (restart), → `destroying` |
| `error` | Unrecoverable failure (OOM, image pull fail, etc.) | → `destroying` |
| `destroying` | Container + volume teardown in progress | → (removed) |

### 4.3 Lifecycle Operations

| Operation | Trigger | Effect |
|-----------|---------|--------|
| **Create** | `POST /api/sandboxes` | Pull image (if needed), create container with resource limits, mount workspace volume, start container, set status `running` |
| **Execute** | `POST /api/sandboxes/:id/exec` | `docker exec` into running container, stream stdout/stderr over WebSocket |
| **Stop** | `POST /api/sandboxes/:id/stop` | `docker stop` with 10s grace period, set status `stopped` |
| **Restart** | `POST /api/sandboxes/:id/restart` | `docker restart`, set status `running` |
| **Destroy** | `DELETE /api/sandboxes/:id` | `docker rm -f` + volume cleanup, remove from DB |

### 4.4 Auto-cleanup

Sandboxes have a configurable idle timeout (default: **30 minutes**). The
`SandboxReaper` runs every 60 seconds and destroys sandboxes where
`lastActivityAt + idleTimeout < now`. Activity is reset on any exec command.

---

## 5. Security Model

### 5.1 Resource Limits (per container)

| Resource | Default | Max | Enforcement |
|----------|---------|-----|-------------|
| CPU | 1 core | 2 cores | `--cpus` flag |
| Memory | 512 MB | 1024 MB | `--memory` flag (OOM kill) |
| Disk (workspace) | 1 GB | 5 GB | `--storage-opt size=` or quota |
| PIDs | 256 | 512 | `--pids-limit` |
| Execution timeout | 5 min | 30 min | API-enforced per-exec deadline |
| Idle timeout | 30 min | 2 hours | Reaper background task |

Callers may request lower limits; exceeding maximums returns `400`.

### 5.2 Network Isolation

```
┌─────────────────────────────────┐
│   Docker Network: sbx-isolated  │  (internal, no external routing)
│                                 │
│  ┌───────┐     ┌───────┐       │
│  │ sbx-1 │     │ sbx-2 │       │  Containers cannot reach each
│  └───────┘     └───────┘       │  other or the internet by default
└─────────────────────────────────┘
```

- All sandbox containers attach to an **internal Docker network**
  (`sbx-isolated`) with `--internal` flag — no outbound internet.
- Inter-container communication is **disabled** (`--icc=false` on the network).
- If a sandbox needs internet (e.g., `npm install`), the create request must
  include `networkAccess: 'internet'`, which attaches a second bridge network
  with egress-only NAT rules. This requires explicit opt-in and is logged.
- The API host is **never** routable from sandbox containers.

### 5.3 Filesystem Isolation

| Mount | Path in Container | Mode | Purpose |
|-------|-------------------|------|---------|
| Workspace volume | `/workspace` | `rw` | Agent code, files, artifacts |
| Runtime shims | `/opt/openspace/shims` | `ro` | Entrypoint wrappers, health check scripts |
| `/tmp` | `/tmp` | `rw`, `noexec` | Temporary files (wiped on restart) |

- **No host filesystem mounts** beyond workspace and read-only shims.
- Workspace volumes are named `sbx-{sandboxId}-workspace` and persist
  until the sandbox is destroyed.
- The container runs as a **non-root user** (`uid=1000`) with no
  `--privileged` flag and all capabilities dropped except `NET_BIND_SERVICE`.

### 5.4 Container Hardening

```yaml
# Applied to every sandbox container
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE      # Allow binding to ports < 1024 for dev servers
read_only_rootfs: true    # Root filesystem is immutable
tmpfs:
  /tmp: "size=100m,noexec,nosuid"
```

### 5.5 Secrets & Environment

- Sandbox containers receive **no host environment variables** by default.
- The `env` field in the create request allows passing safe key-value pairs.
- Secret values (API keys, tokens) are injected via Docker secrets or a
  mounted `/run/secrets/` tmpfs — never as env vars in the container spec.
- The API validates env keys against an allowlist pattern:
  `^[A-Z_][A-Z0-9_]{0,63}$`.

---

## 6. API Surface

### 6.1 REST Endpoints

All endpoints under `/api/sandboxes`. Authentication via existing JWT middleware.

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/api/sandboxes` | List all sandboxes | — | `Sandbox[]` |
| `GET` | `/api/sandboxes/:id` | Get sandbox details | — | `Sandbox` |
| `POST` | `/api/sandboxes` | Create sandbox | `CreateSandboxRequest` | `Sandbox` (201) |
| `POST` | `/api/sandboxes/:id/exec` | Execute command | `ExecRequest` | `ExecResponse` (202) |
| `POST` | `/api/sandboxes/:id/stop` | Stop container | — | `Sandbox` |
| `POST` | `/api/sandboxes/:id/restart` | Restart container | — | `Sandbox` |
| `DELETE` | `/api/sandboxes/:id` | Destroy sandbox | — | 204 |
| `GET` | `/api/sandboxes/:id/files` | List workspace files | `?path=` | `FileEntry[]` |
| `GET` | `/api/sandboxes/:id/files/content` | Read file content | `?path=` | `FileContent` |
| `PUT` | `/api/sandboxes/:id/files/content` | Write file content | `WriteFileRequest` | 204 |

### 6.2 WebSocket Endpoints

| Path | Direction | Description |
|------|-----------|-------------|
| `ws://host/ws/sandboxes/:id/stream` | Server → Client | Real-time stdout/stderr output stream |

**WebSocket Message Protocol:**

```typescript
// Server → Client: output line
{
  type: 'sandbox:output',
  payload: SandboxOutputLine
}

// Server → Client: batch of output lines (buffered flush)
{
  type: 'sandbox:output:batch',
  payload: SandboxOutputLine[]
}

// Server → Client: execution completed
{
  type: 'sandbox:exec:done',
  payload: {
    executionId: string;
    exitCode: number;
    durationMs: number;
  }
}

// Server → Client: sandbox status changed
{
  type: 'sandbox:status',
  payload: {
    sandboxId: string;
    status: SandboxStatus;
    error?: string;
  }
}

// Client → Server: attach to execution stream (on connect)
{
  type: 'sandbox:attach',
  payload: {
    sandboxId: string;
    since?: number;  // Resume from line index
  }
}
```

### 6.3 Request/Response Types

```typescript
// ── Create ──────────────────────────────────────────────────────

interface CreateSandboxRequest {
  /** Display name for the sandbox */
  name: string;
  /** Runtime environment */
  runtime: SandboxRuntime;              // 'node' | 'python' | 'go'
  /** Optional: bind to a specific agent */
  agentId?: string;
  /** Optional: override default resource limits */
  resources?: Partial<ResourceLimits>;
  /** Optional: environment variables */
  env?: Record<string, string>;
  /** Optional: enable internet access (default: false) */
  networkAccess?: 'none' | 'internet';
  /** Optional: idle timeout in seconds (default: 1800) */
  idleTimeoutSec?: number;
}

interface ResourceLimits {
  cpuCores: number;           // 0.25 – 2.0
  memoryMb: number;           // 64 – 1024
  diskMb: number;             // 100 – 5120
  pidsLimit: number;          // 32 – 512
  execTimeoutSec: number;     // 10 – 1800
}

// ── Execute ─────────────────────────────────────────────────────

interface ExecRequest {
  /** Shell command to execute */
  command: string;
  /** Working directory inside container (default: /workspace) */
  cwd?: string;
  /** Per-command timeout override in seconds */
  timeoutSec?: number;
  /** Extra env vars for this execution only */
  env?: Record<string, string>;
}

interface ExecResponse {
  /** Unique execution ID for tracking via WebSocket */
  executionId: string;
  /** Sandbox ID */
  sandboxId: string;
}

// ── File Operations ─────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

interface FileContent {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
}

interface WriteFileRequest {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}
```

### 6.4 Error Responses

All errors follow the existing API error shape:

```typescript
interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
}
```

| HTTP | Code | When |
|------|------|------|
| 400 | `INVALID_RUNTIME` | Unknown runtime in create request |
| 400 | `RESOURCE_LIMIT_EXCEEDED` | Requested resources exceed maximum |
| 404 | `SANDBOX_NOT_FOUND` | Unknown sandbox ID |
| 409 | `SANDBOX_NOT_RUNNING` | Exec on a stopped/creating sandbox |
| 409 | `SANDBOX_ALREADY_RUNNING` | Restart on a running sandbox |
| 429 | `MAX_SANDBOXES_REACHED` | Per-user sandbox limit exceeded (default: 5) |
| 500 | `CONTAINER_ERROR` | Docker daemon failure |
| 504 | `EXEC_TIMEOUT` | Command exceeded timeout |

---

## 7. Runtime Plugin Interface

Each supported language provides a `RuntimePlugin` that encapsulates
image selection, entrypoint configuration, and health checking.

### 7.1 Interface

```typescript
interface RuntimePlugin {
  /** Unique runtime identifier matching SandboxRuntime type */
  readonly id: SandboxRuntime;

  /** Human-readable name */
  readonly name: string;

  /** Docker image to use (tag resolved at create-time) */
  readonly image: string;

  /** Default shell for exec commands */
  readonly shell: string[];

  /** Container entrypoint (keeps container alive) */
  readonly entrypoint: string[];

  /**
   * Runtime-specific environment variables injected into every container.
   * E.g., NODE_ENV=development, PYTHONDONTWRITEBYTECODE=1
   */
  defaultEnv(): Record<string, string>;

  /**
   * Health check command to verify the runtime is ready.
   * Called after container start; must exit 0 within 10s.
   */
  healthCheck(): string[];

  /**
   * Transform a user command into the actual exec command.
   * Allows runtimes to wrap commands (e.g., activate virtualenv).
   */
  wrapCommand(command: string, cwd: string): string[];

  /**
   * Optional: post-create setup (install base packages, create virtualenv).
   * Runs once after container start, before first user exec.
   */
  setup?(): string[];
}
```

### 7.2 Built-in Plugins

#### Node.js

```typescript
const nodePlugin: RuntimePlugin = {
  id: 'node',
  name: 'Node.js 22',
  image: 'node:22-slim',
  shell: ['/bin/bash', '-c'],
  entrypoint: ['sleep', 'infinity'],
  defaultEnv: () => ({
    NODE_ENV: 'development',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    NO_COLOR: '1',
  }),
  healthCheck: () => ['node', '--version'],
  wrapCommand: (cmd, cwd) => ['/bin/bash', '-c', `cd ${cwd} && ${cmd}`],
  setup: () => ['corepack', 'enable'],
};
```

#### Python

```typescript
const pythonPlugin: RuntimePlugin = {
  id: 'python',
  name: 'Python 3.12',
  image: 'python:3.12-slim',
  shell: ['/bin/bash', '-c'],
  entrypoint: ['sleep', 'infinity'],
  defaultEnv: () => ({
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUNBUFFERED: '1',
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
    VIRTUAL_ENV: '/workspace/.venv',
    PATH: '/workspace/.venv/bin:/usr/local/bin:/usr/bin:/bin',
  }),
  healthCheck: () => ['python3', '--version'],
  wrapCommand: (cmd, cwd) => [
    '/bin/bash', '-c',
    `source /workspace/.venv/bin/activate && cd ${cwd} && ${cmd}`,
  ],
  setup: () => ['python3', '-m', 'venv', '/workspace/.venv'],
};
```

#### Go

```typescript
const goPlugin: RuntimePlugin = {
  id: 'go',
  name: 'Go 1.23',
  image: 'golang:1.23-bookworm',
  shell: ['/bin/bash', '-c'],
  entrypoint: ['sleep', 'infinity'],
  defaultEnv: () => ({
    GOPATH: '/workspace/.gopath',
    GOBIN: '/workspace/.gopath/bin',
    CGO_ENABLED: '0',
  }),
  healthCheck: () => ['go', 'version'],
  wrapCommand: (cmd, cwd) => ['/bin/bash', '-c', `cd ${cwd} && ${cmd}`],
};
```

### 7.3 Adding a Custom Runtime

To add a new runtime (e.g., Rust, Java, Deno):

1. Create a `RuntimePlugin` implementation in
   `apps/api/src/services/sandbox/runtimes/`
2. Add the runtime ID to `SandboxRuntime` union in
   `packages/shared/src/types/sandbox.ts`
3. Register the plugin in `RuntimePluginRegistry`

```typescript
class RuntimePluginRegistry {
  private plugins = new Map<SandboxRuntime, RuntimePlugin>();

  register(plugin: RuntimePlugin): void { ... }
  get(runtime: SandboxRuntime): RuntimePlugin { ... }
  list(): RuntimePlugin[] { ... }
}
```

---

## 8. Service Architecture (Backend)

### 8.1 Module Structure

```
apps/api/src/services/sandbox/
├── index.ts                  # SandboxService (public API)
├── container-driver.ts       # Docker client abstraction
├── lifecycle-manager.ts      # Create / stop / restart / destroy
├── exec-engine.ts            # Command execution + streaming
├── stream-router.ts          # WebSocket connection management
├── sandbox-reaper.ts         # Idle timeout cleanup
├── runtime-plugin-registry.ts
└── runtimes/
    ├── node.ts
    ├── python.ts
    └── go.ts
```

### 8.2 SandboxService

The top-level service wired into Fastify routes:

```typescript
class SandboxService {
  constructor(
    private lifecycle: LifecycleManager,
    private execEngine: ExecEngine,
    private streamRouter: StreamRouter,
    private reaper: SandboxReaper,
    private db: DatabaseService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────
  async create(req: CreateSandboxRequest): Promise<Sandbox>;
  async get(id: string): Promise<Sandbox>;
  async list(): Promise<Sandbox[]>;
  async stop(id: string): Promise<Sandbox>;
  async restart(id: string): Promise<Sandbox>;
  async destroy(id: string): Promise<void>;

  // ── Execution ────────────────────────────────────────────────
  async exec(id: string, req: ExecRequest): Promise<ExecResponse>;

  // ── File Operations ──────────────────────────────────────────
  async listFiles(id: string, path: string): Promise<FileEntry[]>;
  async readFile(id: string, path: string): Promise<FileContent>;
  async writeFile(id: string, req: WriteFileRequest): Promise<void>;

  // ── Streaming ────────────────────────────────────────────────
  handleWebSocket(id: string, connection: WebSocket): void;

  // ── Lifecycle hooks ──────────────────────────────────────────
  async start(): Promise<void>;   // Called on API boot
  async shutdown(): Promise<void>; // Graceful shutdown — stop all containers
}
```

### 8.3 Container Driver

Abstraction over Docker Engine API:

```typescript
interface ContainerDriver {
  createContainer(config: ContainerConfig): Promise<string>;  // returns containerId
  startContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string, timeoutSec?: number): Promise<void>;
  removeContainer(containerId: string, force?: boolean): Promise<void>;
  execInContainer(
    containerId: string,
    command: string[],
    options: ExecOptions,
  ): AsyncIterable<OutputChunk>;
  inspectContainer(containerId: string): Promise<ContainerInfo>;
  createVolume(name: string): Promise<void>;
  removeVolume(name: string): Promise<void>;
}

interface ContainerConfig {
  image: string;
  name: string;
  entrypoint: string[];
  env: Record<string, string>;
  volumes: VolumeMount[];
  resources: ResourceLimits;
  network: string;
  user: string;
  securityOpt: string[];
  capDrop: string[];
  capAdd: string[];
  readOnlyRootfs: boolean;
  tmpfs: Record<string, string>;
  labels: Record<string, string>;
}

interface OutputChunk {
  stream: 'stdout' | 'stderr';
  data: string;
}
```

The default implementation uses `dockerode` (Docker Remote API via Unix socket).
The interface allows swapping to alternatives (Podman, containerd) or mocking
in tests.

---

## 9. Database Schema

Sandbox metadata is stored in SQLite alongside other openspace data.

```sql
CREATE TABLE sandboxes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  runtime       TEXT NOT NULL CHECK (runtime IN ('node', 'python', 'go')),
  status        TEXT NOT NULL DEFAULT 'creating'
                  CHECK (status IN ('creating', 'running', 'stopped', 'error', 'destroying')),
  agent_id      TEXT,
  container_id  TEXT,
  image         TEXT NOT NULL,
  port          INTEGER,
  cpu_percent   REAL NOT NULL DEFAULT 0,
  memory_mb     REAL NOT NULL DEFAULT 0,
  memory_limit_mb REAL NOT NULL DEFAULT 512,
  network_access TEXT NOT NULL DEFAULT 'none'
                  CHECK (network_access IN ('none', 'internet')),
  idle_timeout_sec INTEGER NOT NULL DEFAULT 1800,
  error_message TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE sandbox_executions (
  id            TEXT PRIMARY KEY,
  sandbox_id    TEXT NOT NULL,
  command       TEXT NOT NULL,
  exit_code     INTEGER,
  duration_ms   INTEGER,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT,
  FOREIGN KEY (sandbox_id) REFERENCES sandboxes(id) ON DELETE CASCADE
);

CREATE INDEX idx_sandboxes_agent ON sandboxes(agent_id);
CREATE INDEX idx_sandboxes_status ON sandboxes(status);
CREATE INDEX idx_executions_sandbox ON sandbox_executions(sandbox_id);
```

---

## 10. DAG Workflow Integration

Sandbox execution integrates with the DAG workflow engine as a specialized
tool executor.

### 10.1 Step Configuration

```typescript
// In a workflow definition
const codeBuildStep: StepNode = {
  id: 'build-project',
  label: 'Build Project',
  type: 'task',
  config: {
    executor: 'sandbox',
    sandbox: {
      runtime: 'node',
      commands: [
        'npm ci',
        'npm run build',
        'npm test',
      ],
      resources: { memoryMb: 1024 },
      networkAccess: 'internet',  // npm install needs network
    },
  },
};
```

### 10.2 Executor Binding

The `SandboxStepExecutor` implements the `NodeExecutor` interface:

```typescript
class SandboxStepExecutor implements NodeExecutor {
  constructor(private sandboxService: SandboxService) {}

  async execute(
    node: StepNode,
    context: ExecutionContext,
  ): Promise<NodeResult> {
    const config = node.config.sandbox;

    // 1. Create sandbox (or reuse agent's existing sandbox)
    const sandbox = await this.sandboxService.create({
      name: `wf-${context.workflowId}-${node.id}`,
      runtime: config.runtime,
      agentId: context.agentId,
      resources: config.resources,
      networkAccess: config.networkAccess,
    });

    try {
      // 2. Execute commands sequentially
      for (const cmd of config.commands) {
        const result = await this.execAndWait(sandbox.id, cmd, config);
        if (result.exitCode !== 0) {
          return { status: 'failed', error: `Command failed: ${cmd}` };
        }
      }
      return { status: 'completed', output: { sandboxId: sandbox.id } };
    } finally {
      // 3. Destroy unless sandbox is agent-owned
      if (!config.keepAlive) {
        await this.sandboxService.destroy(sandbox.id);
      }
    }
  }
}
```

---

## 11. Observability

### 11.1 Tracing Integration

Every sandbox operation emits spans via `@openspace/tracing`:

| Span | Kind | Attributes |
|------|------|------------|
| `sandbox.create` | `agent` | `sandbox.id`, `sandbox.runtime`, `sandbox.image` |
| `sandbox.exec` | `tool` | `sandbox.id`, `execution.id`, `command` (truncated), `exit_code`, `duration_ms` |
| `sandbox.destroy` | `agent` | `sandbox.id`, `reason` |

### 11.2 Activity Events

Sandbox lifecycle events are pushed to the activity feed:

| Event | Trigger |
|-------|---------|
| `sandbox:created` | New sandbox created |
| `sandbox:exec` | Command executed |
| `sandbox:stopped` | Container stopped |
| `sandbox:destroyed` | Container and volume removed |
| `sandbox:error` | Container error (OOM, timeout, etc.) |

### 11.3 Resource Metrics

The `SandboxService` periodically (every 5s) polls `docker stats` for
running containers and updates the `resources` field in the database.
These metrics are pushed to the frontend via the existing `agent:status`
WebSocket event.

---

## 12. Deployment & Configuration

### 12.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_ENABLED` | `false` | Feature flag — sandbox routes registered only when true |
| `SANDBOX_DOCKER_SOCKET` | `/var/run/docker.sock` | Docker socket path |
| `SANDBOX_MAX_PER_USER` | `5` | Max concurrent sandboxes per user |
| `SANDBOX_NETWORK_NAME` | `sbx-isolated` | Docker network for isolation |
| `SANDBOX_IDLE_TIMEOUT_SEC` | `1800` | Default idle timeout |
| `SANDBOX_WORKSPACE_ROOT` | `/var/lib/openspace/sandboxes` | Host path for workspace volumes |
| `SANDBOX_MAX_CPU` | `2` | Maximum CPU cores per sandbox |
| `SANDBOX_MAX_MEMORY_MB` | `1024` | Maximum memory per sandbox |
| `SANDBOX_MAX_DISK_MB` | `5120` | Maximum disk per sandbox |

### 12.2 Prerequisites

- Docker Engine 24+ (or compatible runtime)
- Docker socket accessible to the API process
- Pre-pulled images (or registry access for on-demand pulls)

### 12.3 Startup Sequence

1. API boot → `SandboxService.start()`
2. Verify Docker connectivity
3. Create/verify `sbx-isolated` network
4. Reconcile DB state with running containers (clean up orphans)
5. Start `SandboxReaper` interval
6. Register sandbox routes (REST + WebSocket)

---

## 13. Testing Strategy

| Layer | Approach |
|-------|----------|
| **Unit** | Mock `ContainerDriver` interface; test lifecycle state machine, resource validation, command wrapping |
| **Integration** | Use Docker-in-Docker or local Docker; create real containers with strict limits; verify isolation |
| **E2E** | Playwright tests via sandbox UI components; verify terminal output streaming |
| **Security** | Automated tests: container cannot reach host, cannot exceed resource limits, cannot write outside `/workspace` |

---

## 14. Implementation Phases

| Phase | Scope | Owner |
|-------|-------|-------|
| **P1: Core lifecycle** | ContainerDriver, LifecycleManager, REST routes (create/get/list/stop/destroy), DB schema | bender |
| **P2: Exec + streaming** | ExecEngine, StreamRouter, WebSocket endpoint, `exec` route | bender |
| **P3: Runtime plugins** | Node/Python/Go plugins, RuntimePluginRegistry, health checks | bender |
| **P4: Security hardening** | Network isolation, filesystem constraints, resource limits, capability dropping | bender |
| **P5: Frontend wiring** | Connect existing sandbox components to live API, terminal streaming | fry |
| **P6: DAG integration** | SandboxStepExecutor, workflow config schema | bender + fry |
| **P7: File operations** | Workspace file CRUD endpoints, file browser UI | fry |

---

## 15. Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | Should sandboxes share a volume pool or each get a fresh volume? | Fresh per sandbox — simpler isolation |
| 2 | Do we need live port-forwarding (e.g., preview a React app)? | Defer to P8 — expose via `sandbox.port` field |
| 3 | Should the Container Driver support Podman as an alternative? | Interface allows it; implement when needed |
| 4 | Max concurrent exec per sandbox? | 1 — queue additional execs to avoid interleaving |
| 5 | Should workspace persist after sandbox destroy for audit? | No — copy artifacts before destroy if needed |

---

## Appendix A: Compatibility with Existing Types

The existing types in `@openspace/shared/src/types/sandbox.ts` are preserved
as-is. New types extend them:

```typescript
// Existing (unchanged)
export type SandboxStatus = 'creating' | 'running' | 'stopped' | 'error' | 'destroying';
export type SandboxRuntime = 'node' | 'python' | 'go';
export interface Sandbox { ... }
export interface SandboxResources { ... }
export interface SandboxCommand { ... }
export interface SandboxOutputLine { ... }

// New additions (in separate file: sandbox-api.ts)
export interface CreateSandboxRequest { ... }
export interface ResourceLimits { ... }
export interface ExecRequest { ... }
export interface ExecResponse { ... }
export interface FileEntry { ... }
export interface FileContent { ... }
export interface WriteFileRequest { ... }
export interface RuntimePlugin { ... }
```

The frontend hooks in `use-sandboxes.ts` and `use-sandbox-stream.ts` already
target the correct endpoint shapes — no changes needed.

---

## Appendix B: OpenAPI Spec

See [`docs/sandbox-openapi.yaml`](./sandbox-openapi.yaml) for the complete
machine-readable specification.

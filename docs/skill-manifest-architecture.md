# Skill Manifest Schema & Plugin Architecture

> **Status:** Approved · **Owner:** Leela · **Version:** 1.0  
> **Date:** 2026-03-26 · **Package:** `@openspace/shared`

---

## 1. Overview

Skills are **declarative capability bundles** that bridge agents and tools. They answer the question: *"What can this agent do, and how?"*

Today, skills are implicit — inferred from an agent's `role` field via `personalityForRole()`. This architecture makes skills **explicit, composable, and pluggable** while preserving backward compatibility with the existing role-based system.

### Key Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Declarative first** | Manifests are data (JSON/YAML), not code. Most skills need zero imperative logic. |
| **Progressive complexity** | Simple skills = manifest only. Complex skills add lifecycle hooks via `entryPoint`. |
| **Scoped access** | Skills only see tools they declare. No ambient authority. |
| **Composable** | Skills can depend on other skills, enabling layered capabilities. |
| **Hot-reloadable** | The registry supports reload without restarting the runtime. |

### Relationship to Existing Systems

```
┌─────────────────────────────────────────────────┐
│                  Agent Runtime                    │
│                                                   │
│  ┌──────────┐    ┌──────────────┐                │
│  │  Agent    │───▶│ SkillRegistry │               │
│  │ Registry  │    │              │                │
│  └──────────┘    │  ┌────────┐  │  ┌───────────┐ │
│                  │  │ Skill  │──┼─▶│   Tool    │ │
│                  │  │Manifest│  │  │ Registry  │ │
│                  │  └────────┘  │  └───────────┘ │
│                  │  ┌────────┐  │                 │
│                  │  │ Skill  │  │                 │
│                  │  │Context │  │                 │
│                  │  └────────┘  │                 │
│                  └──────────────┘                 │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ DAG Workflow  │  │  A2A Service │              │
│  │   Engine      │  │              │              │
│  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────┘
```

- **AgentRegistry** → knows which agents exist and their roles
- **SkillRegistry** → knows which skills exist, matches them to tasks, activates them for agents
- **ToolRegistry** → provides the actual tool implementations that skills consume
- **DAG Workflow Engine** → can invoke skills as workflow steps
- **A2A Service** → skill metadata informs agent capability cards for delegation

---

## 2. Skill Manifest Format

A skill manifest is a JSON (or YAML) file named `skill.json` (or `skill.yaml`) located in a skill directory. The canonical location for project-local skills is `.squad/skills/<skill-id>/skill.json`.

### 2.1 Minimal Example

```json
{
  "manifestVersion": 1,
  "id": "code-review",
  "name": "Code Review",
  "version": "1.0.0",
  "description": "Reviews code changes for bugs, style issues, and security vulnerabilities.",
  "tags": ["code-analysis", "security"],
  "tools": [
    { "toolId": "git:diff", "reason": "Read code changes" },
    { "toolId": "file:read", "reason": "Read full file context" },
    { "toolId": "search:grep", "reason": "Search for related code", "optional": true }
  ],
  "prompts": [
    {
      "id": "system",
      "name": "Code Review System Prompt",
      "role": "system",
      "content": "You are reviewing code as {{agent.name}} ({{agent.role}}). Focus on: correctness, security, performance. Project: {{config.projectName}}.",
      "variables": [
        { "name": "config.projectName", "type": "string", "description": "Project name", "default": "openspace" }
      ]
    },
    {
      "id": "review-diff",
      "name": "Review Diff",
      "role": "execution",
      "content": "Review the following changes:\n\n{{#each files}}\n### {{this.path}}\n```diff\n{{this.diff}}\n```\n{{/each}}\n\nPriority: {{taskContext.priority}}. Labels: {{taskContext.labels}}.",
      "variables": [
        { "name": "files", "type": "object", "description": "Changed files with diffs", "required": true }
      ]
    }
  ],
  "triggers": [
    { "type": "task-type", "taskTypes": ["code-review", "pull-request"] },
    { "type": "label", "labels": ["needs-review"] }
  ],
  "config": [
    {
      "key": "strictness",
      "label": "Review Strictness",
      "type": "string",
      "description": "How strict the review should be",
      "default": "balanced",
      "enum": ["lenient", "balanced", "strict"]
    }
  ],
  "permissions": ["fs:read"]
}
```

### 2.2 Full Example with Dependencies & Entry Point

```json
{
  "manifestVersion": 1,
  "id": "deploy-preview",
  "name": "Deploy Preview",
  "version": "2.1.0",
  "description": "Builds and deploys preview environments for pull requests.",
  "author": "platform-team",
  "tags": ["deployment", "integration"],
  "icon": "rocket",

  "tools": [
    { "toolId": "git:checkout", "reason": "Switch to PR branch" },
    { "toolId": "api:rest", "reason": "Call deployment API" },
    { "toolId": "cli:exec", "reason": "Run build commands" }
  ],

  "prompts": [
    {
      "id": "plan",
      "name": "Deployment Plan",
      "role": "planning",
      "content": "Plan a preview deployment for PR #{{taskContext.metadata.prNumber}}.\nBranch: {{vars.branch}}\nTarget: {{config.previewUrl}}\n\n{{#if config.requireApproval}}⚠️ This deployment requires approval before proceeding.{{/if}}",
      "maxTokens": 500
    }
  ],

  "triggers": [
    {
      "type": "composite",
      "operator": "and",
      "triggers": [
        { "type": "task-type", "taskTypes": ["deployment"] },
        { "type": "label", "labels": ["preview"] }
      ]
    }
  ],

  "dependencies": [
    { "skillId": "code-review", "versionRange": "^1.0.0", "optional": true }
  ],

  "config": [
    { "key": "previewUrl", "label": "Preview URL Template", "type": "string", "description": "URL template for preview deploys", "default": "https://preview-{{branch}}.app.dev" },
    { "key": "requireApproval", "label": "Require Approval", "type": "boolean", "description": "Whether deploys need human approval", "default": true }
  ],

  "entryPoint": "./hooks.ts",
  "permissions": ["fs:read", "net:outbound", "exec:shell"]
}
```

### 2.3 Manifest Schema Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `manifestVersion` | `1` | ✅ | Schema version for forward compatibility |
| `id` | `string` | ✅ | Unique kebab-case identifier |
| `name` | `string` | ✅ | Human-readable display name |
| `version` | `SemVer` | ✅ | Semantic version |
| `description` | `string` | ✅ | Brief description |
| `author` | `string` | | Maintainer |
| `license` | `string` | | SPDX license |
| `homepage` | `string` | | Documentation URL |
| `tags` | `ToolCapabilityTag[]` | | Capability tags |
| `icon` | `string` | | UI icon identifier |
| `tools` | `SkillToolDeclaration[]` | ✅ | Required tools |
| `prompts` | `SkillPromptTemplate[]` | ✅ | Prompt templates |
| `triggers` | `SkillTrigger[]` | ✅ | Task-matching rules |
| `dependencies` | `SkillDependency[]` | | Skill dependencies |
| `config` | `SkillConfigSchema[]` | | User configuration |
| `entryPoint` | `string` | | Path to lifecycle hooks module |
| `permissions` | `SkillPermission[]` | | Requested permissions |

---

## 3. Plugin Lifecycle

Skills follow a strict state machine from discovery to deactivation:

```
 ┌──────────┐    ┌───────────┐    ┌────────┐    ┌────────┐
 │discovered│───▶│ validated  │───▶│ loaded │───▶│ active │
 └──────────┘    └───────────┘    └────────┘    └────┬───┘
       │              │               │              │
       │              │               │              ▼
       │              │               │         ┌────────────┐
       │              │               │         │deactivated │
       │              │               │         └────────────┘
       │              │               │
       ▼              ▼               ▼
 ┌─────────────────────────────────────┐
 │              error                   │
 └─────────────────────────────────────┘
```

### 3.1 Phase Details

#### **Discover**

The registry scans configured directories for skill manifests.

```typescript
// Scan paths (in priority order):
// 1. Built-in:  <app>/skills/
// 2. Project:   .squad/skills/
// 3. User:      ~/.openspace/skills/

const discovered = await registry.discover([
  path.join(__dirname, 'skills'),      // built-in
  path.join(projectRoot, '.squad/skills'), // project
]);
```

**What happens:**
- Walk directories looking for `skill.json` / `skill.yaml`
- Parse manifest files
- Register as `discovered` phase
- Emit `skill:discovered` event

**Failure modes:** File not found, parse error → phase = `error`

#### **Validate**

Schema validation ensures the manifest is well-formed.

```typescript
const result = await registry.validate('code-review');
// { valid: true, errors: [], warnings: [] }
```

**What happens:**
- Validate against JSON Schema (all required fields present, correct types)
- Check ID uniqueness (no duplicates across discovery paths)
- Validate semver format
- Validate prompt template syntax (balanced `{{}}` delimiters)
- Validate trigger structure
- Transition to `validated` or `error`

**Validation rules:**
- `id` must be kebab-case, 3–64 characters
- `version` must be valid semver
- `tools` array must be non-empty
- `prompts` array must be non-empty
- `prompts[].id` must be unique within the skill
- `triggers` array must be non-empty
- `dependencies` must not create circular references
- `entryPoint` path must be relative (no `../` escaping)
- `permissions` must be from the allowed set

#### **Load**

Dependency resolution, tool availability checks, and hook importing.

```typescript
await registry.load('code-review');
```

**What happens:**
1. **Resolve dependencies** — check that all required `dependencies` are already loaded. Detect circular dependencies via topological sort.
2. **Check tool availability** — query `ToolRegistry.discover()` for each declared tool. Required tools must be present; optional tools are flagged.
3. **Import entry point** — if `entryPoint` is set, dynamically import the module and validate it exports `SkillLifecycleHooks`.
4. **Call `onLoad` hook** — if the entry point provides `onLoad`, invoke it with a bootstrap `SkillContext`.
5. **Compile prompts** — pre-compile `{{}}` templates for fast rendering.
6. **Transition to `loaded`**.

**Failure modes:**
- `DEPENDENCY_NOT_FOUND` — required dependency skill not registered
- `DEPENDENCY_VERSION_MISMATCH` — loaded version outside declared range
- `TOOL_NOT_AVAILABLE` — required tool missing from ToolRegistry
- `ENTRY_POINT_NOT_FOUND` — file doesn't exist at declared path
- `ENTRY_POINT_LOAD_ERROR` — module fails to import or doesn't export hooks
- `CIRCULAR_DEPENDENCY` — cycle detected in dependency graph

#### **Activate**

Bind a skill to an agent for a specific task.

```typescript
const ctx = await registry.activate('code-review', 'bender', {
  id: 'task-123',
  title: 'Review auth module changes',
  description: '...',
  labels: ['needs-review'],
  priority: 'high',
  files: ['src/auth/login.ts', 'src/auth/token.ts'],
});
```

**What happens:**
1. Create `SkillContext` with scoped tools, config, logger, events
2. Merge user config with manifest defaults
3. Call `onActivate` hook (if present) — may inject additional `vars`
4. Add agent ID to `activeAgents` set
5. Transition to `active`
6. Emit `skill:activated` event

**Scoped tool access:** The `SkillToolkit` in the context only allows invoking tools listed in the manifest's `tools` array. Attempts to invoke undeclared tools throw `PERMISSION_DENIED`.

#### **Deactivate**

Release a skill from an agent.

```typescript
await registry.deactivate('code-review', 'bender');
```

**What happens:**
1. Call `onDeactivate` hook (if present)
2. Clean up `SkillContext`
3. Remove agent ID from `activeAgents` set
4. If no agents remain active, transition to `deactivated`
5. Emit `skill:deactivated` event

#### **Unload** (optional)

Remove a skill entirely from the registry.

```typescript
await registry.unload('code-review');
```

**Prerequisite:** Skill must have no active agents.

**What happens:**
1. Call `onUnload` hook (if present)
2. Remove from registry
3. Emit `skill:unloaded` event

---

## 4. Prompt Template Engine

### 4.1 Variable Interpolation

Templates use Handlebars-style `{{}}` syntax:

```
Hello {{agent.name}}, you are reviewing {{taskContext.title}}.
```

**Resolution order** (first match wins):
1. `SkillContext.vars` — runtime variables set by hooks
2. `SkillContext.taskContext` — current task data
3. `SkillContext.config` — user configuration values
4. **Built-in variables:**
   - `{{agent.name}}`, `{{agent.role}}`, `{{agent.expertise}}`
   - `{{skill.name}}`, `{{skill.version}}`
   - `{{now}}` — ISO-8601 timestamp

### 4.2 Conditionals

```
{{#if config.strictMode}}
Apply strict linting rules. Flag all warnings as errors.
{{/if}}

{{#if taskContext.files}}
Files to review:
{{#each taskContext.files}}
  - {{this}}
{{/each}}
{{/if}}
```

### 4.3 Iteration

```
{{#each files}}
### {{this.path}}
```diff
{{this.diff}}
```
{{/each}}
```

### 4.4 Token Budget

Each template can declare `maxTokens`. The registry's `getActivePrompts()` method respects these budgets when merging prompts from multiple active skills, truncating lower-priority content first.

---

## 5. Task-Type Matching

When a task arrives, the registry evaluates all loaded skills' triggers:

```typescript
const matches = await registry.matchTask({
  id: 'task-456',
  title: 'Fix login XSS vulnerability',
  description: 'The login form is vulnerable to XSS...',
  labels: ['security', 'bug'],
  priority: 'critical',
  files: ['src/auth/login.tsx'],
});
// Returns: [
//   { skillId: 'security-audit', confidence: 0.95, reason: 'label:security + pattern:XSS' },
//   { skillId: 'code-review', confidence: 0.7, reason: 'label match' },
// ]
```

### Trigger Types

| Trigger | Matching Logic |
|---------|---------------|
| `task-type` | Task labels or metadata contain one of the listed task types |
| `label` | All listed labels present on the task (AND semantics) |
| `pattern` | Regex match against title and/or description |
| `file` | Glob patterns matched against task's associated files |
| `composite` | AND/OR combination of other triggers |

### Confidence Scoring

Each trigger type produces a base confidence:

| Trigger | Base Confidence |
|---------|----------------|
| `task-type` exact match | 0.9 |
| `label` full match | 0.8 |
| `pattern` match | 0.7 |
| `file` glob match | 0.6 |

Composite triggers combine scores: AND = min(scores), OR = max(scores).

Custom `matchTask` hooks (from `SkillLifecycleHooks`) override the default scoring entirely, allowing LLM-based semantic matching.

---

## 6. Contract: Skills ↔ Agent Runtime

### 6.1 What the Runtime Provides to Skills

| Capability | Interface | Description |
|------------|-----------|-------------|
| Tool access | `SkillToolkit` | Scoped invocation of declared tools |
| Task context | `SkillTaskContext` | Current task metadata, files, labels |
| Configuration | `config: Record<string, unknown>` | Merged manifest defaults + user overrides |
| State | `vars: Record<string, unknown>` | Mutable scratchpad per activation |
| Logging | `SkillLogger` | Structured, skill-scoped logging |
| Events | `SkillEventEmitter` | Emit lifecycle and custom events |
| Inter-skill | `SkillInterop` | Query other active skills |
| Agent info | `SkillAgentRef` | ID, name, role, expertise of the agent |

### 6.2 What Skills Provide to the Runtime

| Capability | Source | Description |
|------------|--------|-------------|
| Prompt injection | `prompts[]` | Templates rendered and injected into agent context |
| Task matching | `triggers[]` | Declarative rules for auto-activation |
| Capability declaration | `tags[]` + `tools[]` | Used by A2A agent cards |
| Configuration schema | `config[]` | Drives UI for user settings |
| Lifecycle hooks | `entryPoint` | Optional imperative logic |

### 6.3 Guarantees

**Runtime guarantees to skills:**
- `onActivate` is called before any prompt rendering
- `onDeactivate` is called before context cleanup
- Tool invocations are routed through the ToolRegistry (same execution pipeline, tracing, timeouts)
- Config values are validated against the schema before reaching the skill
- `vars` state is isolated per skill × agent pair

**Skill guarantees to runtime:**
- Lifecycle hooks are idempotent (safe to call multiple times)
- Hooks complete within 30 seconds (enforced by timeout)
- Skills do not access tools outside their declaration
- Skills do not modify files outside declared permissions

### 6.4 Error Contract

If a lifecycle hook throws:
1. Error is caught and logged
2. Skill transitions to `error` phase
3. `skill:error` event is emitted with error details
4. Agent continues operating without the failed skill (graceful degradation)

---

## 7. Directory Structure

```
.squad/
  skills/
    code-review/
      skill.json          ← manifest
      hooks.ts            ← optional lifecycle hooks
      prompts/            ← optional: externalized prompt files
        system.md
        review.md
      README.md           ← optional: skill documentation
    security-audit/
      skill.json
      hooks.ts
    deploy-preview/
      skill.yaml          ← YAML also supported
```

Built-in skills ship with the `@openspace/api` package:

```
apps/api/src/skills/
  code-review/
    skill.json
  task-breakdown/
    skill.json
  ...
```

---

## 8. Integration Points

### 8.1 Agent Registry → Skill Registry

When an agent is loaded, the runtime queries the SkillRegistry to find skills matching the agent's role and expertise tags. These are auto-loaded (but not activated until a task arrives).

```typescript
// In agent-worker boot:
const agent = agentRegistry.get(agentId);
const skills = skillRegistry.list({ tags: agent.expertise });
for (const skill of skills) {
  await skillRegistry.load(skill.manifest.id);
}
```

### 8.2 Task Assignment → Skill Activation

When a task is assigned to an agent, the runtime:
1. Calls `skillRegistry.matchTask(task)` to find matching skills
2. Activates the top-N matching skills for the agent
3. Renders prompts from active skills and injects into the agent's context

```typescript
// In agent-worker task handler:
const matches = await skillRegistry.matchTask(taskContext);
const topSkills = matches.filter(m => m.confidence > 0.5).slice(0, 3);

for (const match of topSkills) {
  await skillRegistry.activate(match.skillId, agentId, taskContext);
}

const systemPrompts = await skillRegistry.getActivePrompts(agentId, 'system');
const executionPrompts = await skillRegistry.getActivePrompts(agentId, 'execution');
```

### 8.3 DAG Workflow → Skills

Skills can be referenced as workflow steps:

```json
{
  "id": "review-step",
  "type": "task",
  "label": "Code Review",
  "config": {
    "handler": "skill:code-review",
    "toolParams": { "files": "{{ctx.nodeOutputs['get-diff'].data}}" }
  }
}
```

### 8.4 A2A Agent Cards

Skill manifests enrich agent capability cards:

```typescript
function buildAgentCard(agent: Agent, skills: SkillManifest[]) {
  return {
    name: agent.name,
    capabilities: skills.map(s => ({
      name: s.name,
      description: s.description,
      tags: s.tags,
    })),
  };
}
```

---

## 9. TypeScript Interfaces

All types are defined in:

```
packages/shared/src/types/skill.ts
```

Exported from the barrel at `packages/shared/src/types/index.ts`.

### Key Interfaces

| Interface | Purpose |
|-----------|---------|
| `SkillManifest` | The declarative skill definition (JSON/YAML schema) |
| `SkillContext` | Runtime context provided to active skills |
| `SkillRegistry` | Plugin lifecycle manager interface |
| `SkillLifecycleHooks` | Optional imperative hooks exported from `entryPoint` |
| `ResolvedSkillManifest` | Manifest after validation + dependency resolution |
| `SkillRegistryEntry` | Internal registry state per skill |
| `SkillToolkit` | Scoped tool invocation interface |
| `SkillTrigger` | Union type for task-matching rules |
| `SkillPromptTemplate` | Template with variable interpolation |
| `SkillMatchResult` | Task matching result with confidence scoring |

---

## 10. Migration Path

### Phase 1: Foundation (this task)
- ✅ Define TypeScript interfaces
- ✅ Document architecture and contracts

### Phase 2: Registry Implementation
- Implement `SkillRegistry` class in `apps/api/src/services/skill-registry/`
- Implement manifest parser (JSON + YAML)
- Implement schema validator
- Implement prompt template engine

### Phase 3: Built-in Skills
- Convert existing `personalityForRole()` logic to skill manifests
- Create built-in skills: `code-review`, `task-breakdown`, `code-generation`
- Wire into `agent-worker` task handler

### Phase 4: Project-Local Skills
- File watcher for `.squad/skills/` directory
- Hot-reload support
- Skill configuration UI in `@openspace/web`

### Phase 5: Skill Marketplace (future)
- Remote skill packages (npm-like)
- Skill versioning and updates
- Trust and verification

---

## Appendix A: JSON Schema for Validation

The runtime validates manifests against a JSON Schema. The schema is generated from the TypeScript interfaces and lives at `apps/api/src/services/skill-registry/manifest-schema.json`.

## Appendix B: Example Skill — Security Audit

```json
{
  "manifestVersion": 1,
  "id": "security-audit",
  "name": "Security Audit",
  "version": "1.0.0",
  "description": "Scans code for security vulnerabilities including XSS, SQL injection, and dependency issues.",
  "tags": ["security", "code-analysis"],
  "tools": [
    { "toolId": "file:read", "reason": "Read source files for analysis" },
    { "toolId": "search:grep", "reason": "Search for vulnerability patterns" },
    { "toolId": "cli:exec", "reason": "Run security scanning tools", "optional": true }
  ],
  "prompts": [
    {
      "id": "system",
      "name": "Security Audit Context",
      "role": "system",
      "content": "You are a security specialist reviewing code for vulnerabilities. Apply OWASP Top 10 checks. Severity classification: Critical > High > Medium > Low > Info.\n\nStrictness: {{config.strictness}}",
      "variables": [
        { "name": "config.strictness", "type": "string", "description": "Audit strictness level", "default": "standard" }
      ]
    },
    {
      "id": "scan",
      "name": "Security Scan",
      "role": "execution",
      "content": "Scan the following files for security vulnerabilities:\n\n{{#each files}}\n**{{this.path}}** ({{this.language}})\n```{{this.language}}\n{{this.content}}\n```\n{{/each}}\n\nReport format: vulnerability name, severity, line number, remediation.",
      "variables": [
        { "name": "files", "type": "object", "description": "Files to scan", "required": true }
      ],
      "maxTokens": 4000
    }
  ],
  "triggers": [
    { "type": "label", "labels": ["security"] },
    { "type": "pattern", "titlePattern": "(?i)(vulnerabilit|xss|injection|auth|csrf|security)" },
    { "type": "file", "globs": ["**/auth/**", "**/security/**", "**/*.env*"] }
  ],
  "config": [
    {
      "key": "strictness",
      "label": "Audit Strictness",
      "type": "string",
      "description": "How thorough the security scan should be",
      "default": "standard",
      "enum": ["quick", "standard", "thorough"]
    }
  ],
  "permissions": ["fs:read", "exec:shell"]
}
```

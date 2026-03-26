/**
 * Tool Registry types — defines the shape of tools that agents
 * can discover, configure, and invoke.
 */

// ---------------------------------------------------------------------------
// Tool parameter schema (JSON-Schema-lite for dynamic form rendering)
// ---------------------------------------------------------------------------

export type ToolParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
  items?: ToolParameter;
  properties?: ToolParameter[];
}

export interface ToolInputSchema {
  parameters: ToolParameter[];
}

// ---------------------------------------------------------------------------
// Tool capability tags
// ---------------------------------------------------------------------------

export type ToolCapabilityTag =
  | 'code-generation'
  | 'code-analysis'
  | 'testing'
  | 'deployment'
  | 'data-retrieval'
  | 'communication'
  | 'file-system'
  | 'search'
  | 'monitoring'
  | 'security'
  | 'documentation'
  | 'integration';

// ---------------------------------------------------------------------------
// Tool execution status
// ---------------------------------------------------------------------------

export type ToolExecutionStatus = 'idle' | 'running' | 'success' | 'error';

export interface ToolExecution {
  id: string;
  toolId: string;
  status: ToolExecutionStatus;
  startedAt: string;
  completedAt: string | null;
  input: Record<string, unknown>;
  output: unknown | null;
  error: string | null;
  durationMs: number | null;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: ToolCapabilityTag[];
  inputSchema: ToolInputSchema;
  outputDescription: string;
  isEnabled: boolean;
  author: string;
}

// ---------------------------------------------------------------------------
// Tool suggestion (context-aware)
// ---------------------------------------------------------------------------

export interface ToolSuggestion {
  tool: Tool;
  relevanceScore: number;
  reason: string;
}

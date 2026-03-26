/**
 * Core types for the Tool Registry.
 */

// ── Tool Parameter ──────────────────────────────────────────────

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  items?: { type: string };
  properties?: Record<string, Omit<ToolParameter, 'name'>>;
}

// ── Tool Descriptor ─────────────────────────────────────────────

export interface ToolDescriptor {
  id: string;
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  timeout?: number; // ms, default 30_000
  retries?: number;
  metadata?: Record<string, unknown>;
}

export type ToolCategory = 'git' | 'file' | 'search' | 'api' | 'custom';

// ── Tool Execution ──────────────────────────────────────────────

export interface ToolInput {
  toolId: string;
  parameters: Record<string, unknown>;
  timeout?: number; // override descriptor timeout
}

export interface ToolResult {
  toolId: string;
  success: boolean;
  data?: unknown;
  error?: ToolError;
  durationMs: number;
}

export interface ToolError {
  code: ToolErrorCode;
  message: string;
  details?: unknown;
}

export type ToolErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'EXECUTION_ERROR'
  | 'TIMEOUT'
  | 'PERMISSION_DENIED'
  | 'PROVIDER_ERROR';

// ── Tool Provider (Plugin) ──────────────────────────────────────

export interface ToolProvider {
  readonly name: string;
  /** List all tools this provider offers. */
  getTools(): ToolDescriptor[];
  /** Execute a specific tool. */
  execute(toolId: string, params: Record<string, unknown>): Promise<unknown>;
  /** Optional lifecycle hooks. */
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}

// ── Registry Events ─────────────────────────────────────────────

export type RegistryEventType = 'tool:registered' | 'tool:unregistered' | 'tool:invoked' | 'tool:error';

export interface RegistryEvent {
  type: RegistryEventType;
  toolId: string;
  timestamp: number;
  details?: unknown;
}

export type RegistryEventListener = (event: RegistryEvent) => void;

// ── Config file format ──────────────────────────────────────────

export interface ToolConfigFile {
  tools: ToolDescriptor[];
}

// ── Custom tool configuration ──────────────────────────────────

export type CustomToolExecutionMode = 'rest-api' | 'cli-command' | 'file-processor';

/** REST API execution config. */
export interface RestApiExecution {
  mode: 'rest-api';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  bodyTemplate?: string; // JSON template with {{param}} placeholders
  responseTransform?: string; // JSONPath-like extraction (e.g. "data.results")
}

/** CLI command execution config. */
export interface CliCommandExecution {
  mode: 'cli-command';
  command: string;
  args?: string[]; // supports {{param}} placeholders
  cwd?: string;
  env?: Record<string, string>;
  parseOutput?: 'text' | 'json' | 'lines';
}

/** File processor execution config. */
export interface FileProcessorExecution {
  mode: 'file-processor';
  operation: 'read' | 'write' | 'transform' | 'glob';
  basePath?: string;
  pattern?: string; // glob pattern for 'glob' operation
  transformScript?: string; // inline JS transform
}

export type CustomToolExecution = RestApiExecution | CliCommandExecution | FileProcessorExecution;

/** Extended tool descriptor for config-driven custom tools. */
export interface CustomToolDescriptor extends ToolDescriptor {
  execution: CustomToolExecution;
  /** Template this tool was generated from (if any). */
  templateId?: string;
}

/** Full custom tools config file shape. */
export interface CustomToolsConfigFile {
  version: number;
  tools: CustomToolDescriptor[];
}

// ── Tool templates ─────────────────────────────────────────────

export interface ToolTemplate {
  id: string;
  name: string;
  description: string;
  mode: CustomToolExecutionMode;
  /** Default execution config (user fills in specifics). */
  defaultExecution: CustomToolExecution;
  /** Default parameters the template ships with. */
  defaultParameters: ToolParameter[];
}

// ── Discovery filter ────────────────────────────────────────────

export interface ToolFilter {
  category?: ToolCategory;
  name?: string;
  id?: string;
}

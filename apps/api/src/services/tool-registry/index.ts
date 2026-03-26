/**
 * @openspace/api — Tool Registry
 *
 * Central runtime service for tool management: registration, discovery,
 * validation, and sandboxed execution with plugin support.
 */

// Core
export { ToolRegistry } from './tool-registry.js';
export { ToolExecutor, ToolTimeoutError } from './tool-executor.js';
export { ToolLoader } from './tool-loader.js';
export { ToolValidator } from './tool-validator.js';

// Plugin interface
export { BaseToolProvider } from './plugin-interface.js';

// Built-in adapters
export { ApiAdapter, FileOpsAdapter, GitAdapter, SearchAdapter } from './adapters/index.js';

// Custom tool system
export { CustomToolManager } from './custom-tool-manager.js';
export type { CustomToolManagerEvent, CustomToolManagerEventType, CustomToolManagerOptions } from './custom-tool-manager.js';
export { CustomToolProvider, extractPath, substituteParams } from './custom-tool-provider.js';
export {
  CLI_COMMAND_TEMPLATE,
  FILE_PROCESSOR_TEMPLATE,
  REST_API_TEMPLATE,
  generateFromTemplate,
  getTemplate,
  getTemplates,
} from './tool-templates.js';

// CLI
export { executeCliCommand } from './cli/tool-cli.js';
export type { CliCommand, CliCommandArgs, CliResult } from './cli/tool-cli.js';

// Schemas
export { buildInputSchema, toolDescriptorSchema, toolParameterSchema } from './schemas.js';

// Types
export type {
  CliCommandExecution,
  CustomToolDescriptor,
  CustomToolExecution,
  CustomToolExecutionMode,
  CustomToolsConfigFile,
  FileProcessorExecution,
  RegistryEvent,
  RegistryEventListener,
  RegistryEventType,
  RestApiExecution,
  ToolCategory,
  ToolConfigFile,
  ToolDescriptor,
  ToolError,
  ToolErrorCode,
  ToolFilter,
  ToolInput,
  ToolParameter,
  ToolProvider,
  ToolResult,
  ToolTemplate,
} from './types.js';

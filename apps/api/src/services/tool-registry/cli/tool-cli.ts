/**
 * CLI commands for managing custom tools.
 *
 * Provides add, remove, list, init, and templates commands
 * that operate on the tools.config.yaml file via CustomToolManager.
 */

import { CustomToolManager } from '../custom-tool-manager.js';
import type {
  CustomToolDescriptor,
  CustomToolExecution,
  ToolParameter,
  ToolTemplate,
} from '../types.js';

// ── Command result types ───────────────────────────────────────

export interface CliResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// ── Command handlers ───────────────────────────────────────────

/**
 * Initialize a new tools.config.yaml file.
 */
export async function initCommand(manager: CustomToolManager): Promise<CliResult> {
  const created = await manager.initConfig();
  if (created) {
    return { success: true, message: `Created ${manager.getConfigPath()}` };
  }
  return { success: false, message: `Config already exists at ${manager.getConfigPath()}` };
}

/**
 * List all registered custom tools.
 */
export function listCommand(manager: CustomToolManager): CliResult {
  const tools = manager.listTools();
  if (tools.length === 0) {
    return { success: true, message: 'No custom tools registered.', data: [] };
  }

  const summary = tools.map((t) => ({
    id: t.id,
    name: t.name,
    mode: t.execution.mode,
    version: t.version,
    description: t.description,
  }));

  const lines = tools.map(
    (t) => `  ${t.id} (${t.execution.mode}) — ${t.name} v${t.version}`,
  );
  return {
    success: true,
    message: `Custom tools (${tools.length}):\n${lines.join('\n')}`,
    data: summary,
  };
}

/**
 * Add a new custom tool (direct descriptor).
 */
export async function addCommand(
  manager: CustomToolManager,
  descriptor: CustomToolDescriptor,
): Promise<CliResult> {
  try {
    await manager.addTool(descriptor);
    return { success: true, message: `Added tool "${descriptor.id}"` };
  } catch (err) {
    return { success: false, message: `Failed to add tool: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Add a tool from a template.
 */
export async function addFromTemplateCommand(
  manager: CustomToolManager,
  templateId: string,
  overrides: {
    id: string;
    name: string;
    description: string;
    version?: string;
    execution?: Partial<CustomToolExecution>;
    parameters?: ToolParameter[];
  },
): Promise<CliResult> {
  try {
    const descriptor = await manager.addToolFromTemplate(templateId, overrides);
    return {
      success: true,
      message: `Added tool "${descriptor.id}" from template "${templateId}"`,
      data: descriptor,
    };
  } catch (err) {
    return { success: false, message: `Failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Remove a custom tool by id.
 */
export async function removeCommand(
  manager: CustomToolManager,
  toolId: string,
): Promise<CliResult> {
  const removed = await manager.removeTool(toolId);
  if (removed) {
    return { success: true, message: `Removed tool "${toolId}"` };
  }
  return { success: false, message: `Tool "${toolId}" not found` };
}

/**
 * List available templates.
 */
export function templatesCommand(manager: CustomToolManager): CliResult {
  const templates = manager.getTemplates();
  const lines = templates.map(
    (t) => `  ${t.id} (${t.mode}) — ${t.description}`,
  );
  return {
    success: true,
    message: `Available templates (${templates.length}):\n${lines.join('\n')}`,
    data: templates.map((t) => ({ id: t.id, name: t.name, mode: t.mode, description: t.description })),
  };
}

/**
 * Get details of a specific tool.
 */
export function inspectCommand(
  manager: CustomToolManager,
  toolId: string,
): CliResult {
  const tool = manager.getTool(toolId);
  if (!tool) {
    return { success: false, message: `Tool "${toolId}" not found` };
  }
  return {
    success: true,
    message: formatToolDetails(tool),
    data: tool,
  };
}

// ── CLI Router ─────────────────────────────────────────────────

export type CliCommand = 'init' | 'list' | 'add' | 'add-from-template' | 'remove' | 'templates' | 'inspect';

export interface CliCommandArgs {
  command: CliCommand;
  descriptor?: CustomToolDescriptor;
  toolId?: string;
  templateId?: string;
  overrides?: {
    id: string;
    name: string;
    description: string;
    version?: string;
    execution?: Partial<CustomToolExecution>;
    parameters?: ToolParameter[];
  };
}

/**
 * Route a CLI command to the appropriate handler.
 */
export async function executeCliCommand(
  manager: CustomToolManager,
  args: CliCommandArgs,
): Promise<CliResult> {
  switch (args.command) {
    case 'init':
      return initCommand(manager);

    case 'list':
      return listCommand(manager);

    case 'add':
      if (!args.descriptor) {
        return { success: false, message: 'Missing tool descriptor for "add" command' };
      }
      return addCommand(manager, args.descriptor);

    case 'add-from-template':
      if (!args.templateId || !args.overrides) {
        return { success: false, message: 'Missing templateId or overrides for "add-from-template" command' };
      }
      return addFromTemplateCommand(manager, args.templateId, args.overrides);

    case 'remove':
      if (!args.toolId) {
        return { success: false, message: 'Missing toolId for "remove" command' };
      }
      return removeCommand(manager, args.toolId);

    case 'templates':
      return templatesCommand(manager);

    case 'inspect':
      if (!args.toolId) {
        return { success: false, message: 'Missing toolId for "inspect" command' };
      }
      return inspectCommand(manager, args.toolId);

    default:
      return { success: false, message: `Unknown command: "${args.command}"` };
  }
}

// ── Formatting helpers ─────────────────────────────────────────

function formatToolDetails(tool: CustomToolDescriptor): string {
  const lines = [
    `Tool: ${tool.name} (${tool.id})`,
    `  Version:  ${tool.version}`,
    `  Mode:     ${tool.execution.mode}`,
    `  Category: ${tool.category}`,
    `  Desc:     ${tool.description}`,
  ];

  if (tool.templateId) {
    lines.push(`  Template: ${tool.templateId}`);
  }

  if (tool.parameters.length > 0) {
    lines.push(`  Parameters:`);
    for (const p of tool.parameters) {
      const req = p.required ? ' (required)' : '';
      lines.push(`    - ${p.name}: ${p.type}${req} — ${p.description}`);
    }
  }

  return lines.join('\n');
}

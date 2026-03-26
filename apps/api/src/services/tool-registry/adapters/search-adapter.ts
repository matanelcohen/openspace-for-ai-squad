/**
 * Built-in search tool adapter (grep-like file content search).
 */

import { BaseToolProvider } from '../plugin-interface.js';
import { ToolExecutor } from '../tool-executor.js';
import type { ToolDescriptor } from '../types.js';

export class SearchAdapter extends BaseToolProvider {
  readonly name = 'search';
  private readonly executor = new ToolExecutor();

  constructor(private readonly workingDir?: string) {
    super();
    this.tools = [this.grepTool(), this.findTool()];
  }

  async execute(toolId: string, params: Record<string, unknown>): Promise<unknown> {
    this.getDescriptorOrThrow(toolId);
    const cwd = (params.cwd as string) ?? this.workingDir ?? process.cwd();

    switch (toolId) {
      case 'search-grep': {
        const pattern = params.pattern as string;
        const args = ['-r', '-n', '--color=never'];
        if (params.ignoreCase) args.push('-i');
        if (params.glob) args.push(`--include=${params.glob as string}`);
        args.push(pattern);
        if (params.path) args.push(params.path as string);

        const result = await this.executor.executeCommand('grep', args, { cwd, timeout: 15_000 });
        // grep returns exit code 1 for no matches — that's not an error
        if (result.exitCode > 1 && result.stderr) {
          throw new Error(result.stderr.trim());
        }
        return result.stdout;
      }
      case 'search-find': {
        const args = [params.path ? (params.path as string) : '.'];
        if (params.name) args.push('-name', params.name as string);
        if (params.type === 'file') args.push('-type', 'f');
        else if (params.type === 'directory') args.push('-type', 'd');
        if (params.maxDepth) args.push('-maxdepth', String(params.maxDepth));

        const result = await this.executor.executeCommand('find', args, { cwd, timeout: 15_000 });
        if (result.exitCode !== 0 && result.stderr) {
          throw new Error(result.stderr.trim());
        }
        return result.stdout;
      }
      default:
        throw new Error(`Unknown search tool: ${toolId}`);
    }
  }

  // ── Tool descriptors ───────────────────────────────────────────

  private grepTool(): ToolDescriptor {
    return {
      id: 'search-grep',
      name: 'Grep Search',
      description: 'Search file contents with regex patterns',
      version: '1.0.0',
      category: 'search',
      parameters: [
        { name: 'pattern', type: 'string', description: 'Search pattern (regex)', required: true },
        { name: 'path', type: 'string', description: 'Path to search in', required: false },
        { name: 'glob', type: 'string', description: 'File glob filter (e.g. "*.ts")', required: false },
        { name: 'ignoreCase', type: 'boolean', description: 'Case insensitive', required: false },
        { name: 'cwd', type: 'string', description: 'Working directory', required: false },
      ],
    };
  }

  private findTool(): ToolDescriptor {
    return {
      id: 'search-find',
      name: 'Find Files',
      description: 'Find files by name pattern',
      version: '1.0.0',
      category: 'search',
      parameters: [
        { name: 'name', type: 'string', description: 'File name pattern', required: false },
        { name: 'path', type: 'string', description: 'Start directory', required: false },
        { name: 'type', type: 'string', description: '"file" or "directory"', required: false },
        { name: 'maxDepth', type: 'number', description: 'Max directory depth', required: false },
        { name: 'cwd', type: 'string', description: 'Working directory', required: false },
      ],
    };
  }
}

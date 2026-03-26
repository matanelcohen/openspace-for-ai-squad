/**
 * Built-in Git operations tool adapter.
 */

import { BaseToolProvider } from '../plugin-interface.js';
import { ToolExecutor } from '../tool-executor.js';
import type { ToolDescriptor } from '../types.js';

export class GitAdapter extends BaseToolProvider {
  readonly name = 'git';
  private readonly executor = new ToolExecutor();

  constructor(private readonly workingDir?: string) {
    super();
    this.tools = [this.statusTool(), this.logTool(), this.diffTool(), this.blameToolDescriptor()];
  }

  async execute(toolId: string, params: Record<string, unknown>): Promise<unknown> {
    this.getDescriptorOrThrow(toolId);
    const cwd = (params.cwd as string) ?? this.workingDir ?? process.cwd();

    switch (toolId) {
      case 'git-status':
        return this.run(['status', '--porcelain'], cwd);
      case 'git-log': {
        const limit = (params.limit as number) ?? 10;
        const format = (params.format as string) ?? '%h %s (%an, %ar)';
        return this.run(['log', `--max-count=${limit}`, `--format=${format}`], cwd);
      }
      case 'git-diff': {
        const args = ['diff'];
        if (params.staged) args.push('--cached');
        if (params.path) args.push('--', params.path as string);
        return this.run(args, cwd);
      }
      case 'git-blame': {
        const file = params.file as string;
        return this.run(['blame', '--porcelain', file], cwd);
      }
      default:
        throw new Error(`Unknown git tool: ${toolId}`);
    }
  }

  private async run(args: string[], cwd: string): Promise<string> {
    const result = await this.executor.executeCommand('git', args, { cwd });
    if (result.exitCode !== 0 && result.stderr) {
      throw new Error(result.stderr.trim());
    }
    return result.stdout;
  }

  // ── Tool descriptors ───────────────────────────────────────────

  private statusTool(): ToolDescriptor {
    return {
      id: 'git-status',
      name: 'Git Status',
      description: 'Show working tree status in porcelain format',
      version: '1.0.0',
      category: 'git',
      parameters: [
        { name: 'cwd', type: 'string', description: 'Working directory', required: false },
      ],
    };
  }

  private logTool(): ToolDescriptor {
    return {
      id: 'git-log',
      name: 'Git Log',
      description: 'Show commit log',
      version: '1.0.0',
      category: 'git',
      parameters: [
        { name: 'cwd', type: 'string', description: 'Working directory', required: false },
        { name: 'limit', type: 'number', description: 'Max number of commits', required: false },
        { name: 'format', type: 'string', description: 'Pretty format string', required: false },
      ],
    };
  }

  private diffTool(): ToolDescriptor {
    return {
      id: 'git-diff',
      name: 'Git Diff',
      description: 'Show changes between commits or working tree',
      version: '1.0.0',
      category: 'git',
      parameters: [
        { name: 'cwd', type: 'string', description: 'Working directory', required: false },
        { name: 'staged', type: 'boolean', description: 'Show staged changes', required: false },
        { name: 'path', type: 'string', description: 'Specific file path', required: false },
      ],
    };
  }

  private blameToolDescriptor(): ToolDescriptor {
    return {
      id: 'git-blame',
      name: 'Git Blame',
      description: 'Show line-by-line authorship for a file',
      version: '1.0.0',
      category: 'git',
      parameters: [
        { name: 'file', type: 'string', description: 'File path to blame', required: true },
        { name: 'cwd', type: 'string', description: 'Working directory', required: false },
      ],
    };
  }
}

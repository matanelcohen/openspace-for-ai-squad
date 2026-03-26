/**
 * Built-in file operations tool adapter.
 */

import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { BaseToolProvider } from '../plugin-interface.js';
import type { ToolDescriptor } from '../types.js';

const MAX_READ_BYTES = 5_242_880; // 5 MB

export class FileOpsAdapter extends BaseToolProvider {
  readonly name = 'file-ops';

  constructor(private readonly rootDir?: string) {
    super();
    this.tools = [this.readTool(), this.writeTool(), this.listTool(), this.deleteTool(), this.statTool()];
  }

  async execute(toolId: string, params: Record<string, unknown>): Promise<unknown> {
    this.getDescriptorOrThrow(toolId);
    const root = this.rootDir ?? process.cwd();

    switch (toolId) {
      case 'file-read': {
        const filePath = this.safePath(root, params.path as string);
        const content = await readFile(filePath, 'utf-8');
        if (content.length > MAX_READ_BYTES) {
          return content.slice(0, MAX_READ_BYTES) + '\n[truncated]';
        }
        return content;
      }
      case 'file-write': {
        const filePath = this.safePath(root, params.path as string);
        await writeFile(filePath, params.content as string, 'utf-8');
        return { written: filePath };
      }
      case 'file-list': {
        const dirPath = this.safePath(root, (params.path as string) ?? '.');
        const entries = await readdir(dirPath, { withFileTypes: true });
        return entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
        }));
      }
      case 'file-delete': {
        const filePath = this.safePath(root, params.path as string);
        await unlink(filePath);
        return { deleted: filePath };
      }
      case 'file-stat': {
        const filePath = this.safePath(root, params.path as string);
        const info = await stat(filePath);
        return {
          size: info.size,
          isDirectory: info.isDirectory(),
          isFile: info.isFile(),
          modified: info.mtime.toISOString(),
          created: info.birthtime.toISOString(),
        };
      }
      default:
        throw new Error(`Unknown file-ops tool: ${toolId}`);
    }
  }

  /** Prevent path traversal outside root. */
  private safePath(root: string, relative: string): string {
    const resolved = resolve(root, relative);
    if (!resolved.startsWith(resolve(root))) {
      throw new Error('Path traversal not allowed');
    }
    return resolved;
  }

  // ── Tool descriptors ───────────────────────────────────────────

  private readTool(): ToolDescriptor {
    return {
      id: 'file-read',
      name: 'Read File',
      description: 'Read file contents as UTF-8 text',
      version: '1.0.0',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Relative file path', required: true },
      ],
    };
  }

  private writeTool(): ToolDescriptor {
    return {
      id: 'file-write',
      name: 'Write File',
      description: 'Write or overwrite a file with UTF-8 content',
      version: '1.0.0',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Relative file path', required: true },
        { name: 'content', type: 'string', description: 'File content to write', required: true },
      ],
    };
  }

  private listTool(): ToolDescriptor {
    return {
      id: 'file-list',
      name: 'List Directory',
      description: 'List files and directories at a path',
      version: '1.0.0',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Relative directory path', required: false },
      ],
    };
  }

  private deleteTool(): ToolDescriptor {
    return {
      id: 'file-delete',
      name: 'Delete File',
      description: 'Delete a file',
      version: '1.0.0',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Relative file path', required: true },
      ],
    };
  }

  private statTool(): ToolDescriptor {
    return {
      id: 'file-stat',
      name: 'File Info',
      description: 'Get file metadata (size, timestamps, type)',
      version: '1.0.0',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Relative file path', required: true },
      ],
    };
  }
}

/**
 * Task parser — reads `.squad/tasks/*.md` files into typed Task objects.
 *
 * File format: YAML frontmatter + markdown body.
 * The markdown body becomes the task description.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { Task, TaskAssigneeType, TaskPriority, TaskStatus } from '@openspace/shared';
import { TASK_PRIORITIES, TASK_STATUSES } from '@openspace/shared';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && (TASK_PRIORITIES as readonly string[]).includes(value);
}

function isTaskAssigneeType(value: unknown): value is TaskAssigneeType {
  return value === 'agent' || value === 'member';
}

function toISOString(value: unknown): string {
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return new Date().toISOString();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParseTaskResult {
  task: Task;
  filePath: string;
}

export interface ParseError {
  filePath: string;
  error: string;
}

export interface ParseAllResult {
  tasks: ParseTaskResult[];
  errors: ParseError[];
}

/**
 * Parse a single task file. Returns a Task or throws on invalid format.
 */
export function parseTaskFile(content: string, filePath: string): ParseTaskResult {
  const { data, content: body } = matter(content);

  if (!data || typeof data !== 'object') {
    throw new Error(`Missing or invalid frontmatter in ${filePath}`);
  }

  const fm = data as Record<string, unknown>;

  if (typeof fm.id !== 'string' || fm.id.trim() === '') {
    throw new Error(`Missing required field "id" in ${filePath}`);
  }
  if (typeof fm.title !== 'string' || fm.title.trim() === '') {
    throw new Error(`Missing required field "title" in ${filePath}`);
  }

  const task: Task = {
    id: fm.id.trim(),
    title: fm.title.trim(),
    description: body.trim(),
    status: isTaskStatus(fm.status) ? fm.status : 'backlog',
    priority: isTaskPriority(fm.priority) ? fm.priority : 'P2',
    assignee: typeof fm.assignee === 'string' && fm.assignee !== 'null' ? fm.assignee : null,
    assigneeType: isTaskAssigneeType(fm.assigneeType) ? fm.assigneeType : 'agent',
    labels: toStringArray(fm.labels),
    createdAt: toISOString(fm.created),
    updatedAt: toISOString(fm.updated),
    sortIndex: typeof fm.sortIndex === 'number' ? fm.sortIndex : 0,
  };

  return { task, filePath };
}

/**
 * Parse all `.md` files in the given tasks directory.
 * Returns successfully parsed tasks and any errors encountered.
 */
export async function parseAllTasks(tasksDir: string): Promise<ParseAllResult> {
  const tasks: ParseTaskResult[] = [];
  const errors: ParseError[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(tasksDir);
  } catch {
    // Directory doesn't exist or is unreadable — return empty
    return { tasks: [], errors: [] };
  }

  const mdFiles = entries.filter((e) => e.endsWith('.md')).sort();

  for (const file of mdFiles) {
    const filePath = path.join(tasksDir, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = parseTaskFile(content, filePath);
      tasks.push(result);
    } catch (err) {
      errors.push({
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Sort by sortIndex for stable ordering
  tasks.sort((a, b) => a.task.sortIndex - b.task.sortIndex);

  return { tasks, errors };
}

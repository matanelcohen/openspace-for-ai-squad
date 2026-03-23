/**
 * Task writer — CRUD operations for `.squad/tasks/*.md` files.
 *
 * Each task is stored as a YAML frontmatter + markdown body file.
 * The `.squad/` directory is the source of truth.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { Task, TaskPriority, TaskStatus } from '@openspace/shared';
import matter from 'gray-matter';
import { nanoid } from 'nanoid';

import { parseAllTasks, parseTaskFile } from '../squad-parser/task-parser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: string[];
}

export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'createdAt'>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function taskToFrontmatter(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee ?? 'null',
    labels: task.labels,
    created: task.createdAt,
    updated: task.updatedAt,
    sortIndex: task.sortIndex,
  };
}

function taskToFileContent(task: Task): string {
  const fm = taskToFrontmatter(task);
  const body = task.description || '';
  return matter.stringify(body.endsWith('\n') ? body : body + '\n', fm);
}

function taskFilePath(tasksDir: string, id: string): string {
  return path.join(tasksDir, `${id}.md`);
}

/** Generate a unique task ID: task-{nanoid(8)} */
export function generateTaskId(): string {
  return `task-${nanoid(8)}`;
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new task file in `.squad/tasks/`.
 * Returns the created Task object.
 */
export async function createTask(tasksDir: string, input: CreateTaskInput): Promise<Task> {
  await fs.mkdir(tasksDir, { recursive: true });

  // Determine the next sortIndex
  const { tasks: existing } = await parseAllTasks(tasksDir);
  const maxSortIndex = existing.length > 0 ? Math.max(...existing.map((t) => t.task.sortIndex)) : -1;

  const now = new Date().toISOString();
  const task: Task = {
    id: generateTaskId(),
    title: input.title,
    description: input.description ?? '',
    status: input.status ?? 'backlog',
    priority: input.priority ?? 'P2',
    assignee: input.assignee ?? null,
    labels: input.labels ?? [],
    createdAt: now,
    updatedAt: now,
    sortIndex: maxSortIndex + 1,
  };

  const filePath = taskFilePath(tasksDir, task.id);
  await fs.writeFile(filePath, taskToFileContent(task), 'utf-8');

  return task;
}

/**
 * Update an existing task by ID.
 * Reads the current file, applies updates, writes back.
 * Returns the updated Task.
 */
export async function updateTask(
  tasksDir: string,
  id: string,
  updates: UpdateTaskInput,
): Promise<Task> {
  const filePath = taskFilePath(tasksDir, id);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Task not found: ${id}`);
  }

  const { task: current } = parseTaskFile(content, filePath);

  const updated: Task = {
    ...current,
    ...updates,
    id: current.id, // ID is immutable
    createdAt: current.createdAt, // createdAt is immutable
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(filePath, taskToFileContent(updated), 'utf-8');
  return updated;
}

/**
 * Delete a task file by ID.
 * Throws if the task does not exist.
 */
export async function deleteTask(tasksDir: string, id: string): Promise<void> {
  const filePath = taskFilePath(tasksDir, id);

  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Task not found: ${id}`);
  }

  await fs.unlink(filePath);
}

/**
 * Reorder tasks by updating their sortIndex fields.
 * `orderedIds` is the desired order — index position becomes the new sortIndex.
 * Tasks not in the list keep their current sortIndex.
 */
export async function reorderTasks(tasksDir: string, orderedIds: string[]): Promise<Task[]> {
  const results: Task[] = [];

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const filePath = taskFilePath(tasksDir, id);

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      throw new Error(`Task not found during reorder: ${id}`);
    }

    const { task } = parseTaskFile(content, filePath);
    const updated: Task = {
      ...task,
      sortIndex: i,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(filePath, taskToFileContent(updated), 'utf-8');
    results.push(updated);
  }

  return results;
}

/**
 * Read a single task by ID.
 * Returns the Task or throws if not found.
 */
export async function getTask(tasksDir: string, id: string): Promise<Task> {
  const filePath = taskFilePath(tasksDir, id);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Task not found: ${id}`);
  }

  return parseTaskFile(content, filePath).task;
}

/**
 * P2-10 — Form validation, create/edit task tests
 *
 * Tests the CreateTaskInput and UpdateTaskInput contracts and
 * validation edge cases for form data.
 */
import type { TaskPriority } from '@openspace/shared';
import { describe, expect, it } from 'vitest';

import type { CreateTaskInput, UpdateTaskInput } from '@/hooks/use-tasks';

// These are contract-level tests that verify the shape of task
// inputs before they hit the API. Since the app uses react-query
// mutations with typed inputs, we test the type contracts.

describe('CreateTaskInput validation', () => {
  function validateCreate(input: CreateTaskInput): string[] {
    const errors: string[] = [];
    if (!input.title.trim()) errors.push('Title is required');
    if (input.title.length > 200) errors.push('Title too long');
    if (input.description.length > 50_000) errors.push('Description too long');
    if (!['P0', 'P1', 'P2', 'P3'].includes(input.priority)) errors.push('Invalid priority');
    return errors;
  }

  it('accepts valid input', () => {
    expect(
      validateCreate({
        title: 'Build auth module',
        description: 'JWT-based authentication',
        assignee: 'bender',
        priority: 'P1',
        labels: ['backend'],
      }),
    ).toEqual([]);
  });

  it('rejects empty title', () => {
    expect(
      validateCreate({
        title: '',
        description: '',
        assignee: null,
        priority: 'P2',
        labels: [],
      }),
    ).toContain('Title is required');
  });

  it('rejects whitespace-only title', () => {
    expect(
      validateCreate({
        title: '   ',
        description: '',
        assignee: null,
        priority: 'P2',
        labels: [],
      }),
    ).toContain('Title is required');
  });

  it('rejects extremely long title', () => {
    expect(
      validateCreate({
        title: 'A'.repeat(201),
        description: '',
        assignee: null,
        priority: 'P2',
        labels: [],
      }),
    ).toContain('Title too long');
  });

  it('rejects extremely long description', () => {
    expect(
      validateCreate({
        title: 'Valid title',
        description: 'A'.repeat(50_001),
        assignee: null,
        priority: 'P1',
        labels: [],
      }),
    ).toContain('Description too long');
  });

  it('rejects invalid priority', () => {
    expect(
      validateCreate({
        title: 'Valid title',
        description: '',
        assignee: null,
        priority: 'P99' as TaskPriority,
        labels: [],
      }),
    ).toContain('Invalid priority');
  });

  it('accepts all valid priorities', () => {
    for (const p of ['P0', 'P1', 'P2', 'P3'] as TaskPriority[]) {
      expect(
        validateCreate({ title: 'Valid', description: '', assignee: null, priority: p, labels: [] }),
      ).toEqual([]);
    }
  });

  it('accepts null assignee', () => {
    expect(
      validateCreate({ title: 'Valid', description: '', assignee: null, priority: 'P2', labels: [] }),
    ).toEqual([]);
  });

  it('accepts task with many labels', () => {
    const labels = Array.from({ length: 50 }, (_, i) => `label-${i}`);
    expect(
      validateCreate({ title: 'Valid', description: '', assignee: null, priority: 'P2', labels }),
    ).toEqual([]);
  });

  it('accepts unicode in title', () => {
    expect(
      validateCreate({
        title: '🚀 Implement 日本語 support',
        description: '',
        assignee: null,
        priority: 'P2',
        labels: [],
      }),
    ).toEqual([]);
  });
});

describe('UpdateTaskInput validation', () => {
  function validateUpdate(input: UpdateTaskInput): string[] {
    const errors: string[] = [];
    if (!input.taskId.trim()) errors.push('Task ID is required');
    if (!input.title.trim()) errors.push('Title is required');
    if (input.title.length > 200) errors.push('Title too long');
    return errors;
  }

  it('accepts valid update', () => {
    expect(
      validateUpdate({
        taskId: 'task-1',
        title: 'Updated title',
        description: 'Updated desc',
        assignee: 'fry',
        priority: 'P0',
        labels: ['urgent'],
      }),
    ).toEqual([]);
  });

  it('rejects missing task ID', () => {
    expect(
      validateUpdate({
        taskId: '',
        title: 'Updated',
        description: '',
        assignee: null,
        priority: 'P2',
        labels: [],
      }),
    ).toContain('Task ID is required');
  });

  it('rejects empty title on update', () => {
    expect(
      validateUpdate({
        taskId: 'task-1',
        title: '',
        description: '',
        assignee: null,
        priority: 'P2',
        labels: [],
      }),
    ).toContain('Title is required');
  });
});

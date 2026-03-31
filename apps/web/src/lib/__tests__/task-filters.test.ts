import type { Task } from '@matanelcohen/openspace-shared';
import { describe, expect, it } from 'vitest';

import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  type TaskFilters,
} from '@/lib/task-filters';

const baseTasks: Task[] = [
  {
    id: 't1',
    title: 'Login page',
    description: 'Build the login UI',
    status: 'pending',
    priority: 'P1',
    assignee: 'fry',
    assigneeType: 'agent',
    labels: ['frontend'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sortIndex: 0,
  },
  {
    id: 't2',
    title: 'API routes',
    description: 'Create REST endpoints',
    status: 'in-progress',
    priority: 'P0',
    assignee: 'bender',
    assigneeType: 'agent',
    labels: ['backend', 'api'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sortIndex: 0,
  },
  {
    id: 't3',
    title: 'Write tests',
    description: '',
    status: 'done',
    priority: 'P2',
    assignee: null,
    assigneeType: 'agent',
    labels: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sortIndex: 0,
  },
];

describe('applyFilters', () => {
  it('returns all tasks with default filters', () => {
    expect(applyFilters(baseTasks, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it('filters by status', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, status: 'pending' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('filters by priority', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, priority: 'P0' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('filters by assignee', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, assignee: 'fry' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('filters unassigned tasks', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, assignee: 'unassigned' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t3');
  });

  it('filters by search in title', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, search: 'login' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('filters by search in description', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, search: 'REST' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('filters by search in labels', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, search: 'api' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('search is case-insensitive', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, search: 'LOGIN' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('combines multiple filters', () => {
    const filters: TaskFilters = {
      status: 'in-progress',
      assignee: 'bender',
      priority: 'P0',
      search: 'api',
    };
    const result = applyFilters(baseTasks, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('returns empty when no tasks match', () => {
    const result = applyFilters(baseTasks, { ...DEFAULT_FILTERS, search: 'nonexistent' });
    expect(result).toHaveLength(0);
  });
});

describe('activeFilterCount', () => {
  it('returns 0 for default filters', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it('counts status filter', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, status: 'pending' })).toBe(1);
  });

  it('counts assignee filter', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, assignee: 'fry' })).toBe(1);
  });

  it('counts priority filter', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, priority: 'P0' })).toBe(1);
  });

  it('counts search filter', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, search: 'test' })).toBe(1);
  });

  it('counts multiple active filters', () => {
    expect(
      activeFilterCount({ status: 'done', assignee: 'fry', priority: 'P0', search: 'x' }),
    ).toBe(4);
  });

  it('ignores whitespace-only search', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, search: '   ' })).toBe(0);
  });
});

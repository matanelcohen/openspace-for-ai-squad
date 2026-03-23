import type { Task } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TaskCard } from '@/components/tasks/task-card';

const mockTask: Task = {
  id: 'task-1',
  title: 'Build the login page',
  description: 'Create the login page with email/password form',
  status: 'in-progress',
  priority: 'P1',
  assignee: 'fry',
  labels: ['frontend', 'auth'],
  createdAt: '2026-03-23T10:00:00Z',
  updatedAt: '2026-03-23T12:00:00Z',
  sortIndex: 0,
};

const unassignedTask: Task = {
  ...mockTask,
  id: 'task-2',
  title: 'Setup CI',
  assignee: null,
  labels: [],
  priority: 'P3',
};

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Build the login page')).toBeInTheDocument();
  });

  it('shows priority badge', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('P1 — High')).toBeInTheDocument();
  });

  it('shows assignee avatar when assigned', () => {
    render(<TaskCard task={mockTask} />);
    // Fry's emoji
    expect(screen.getByText('🍕')).toBeInTheDocument();
  });

  it('does not show avatar when unassigned', () => {
    render(<TaskCard task={unassignedTask} />);
    expect(screen.queryByText('🍕')).not.toBeInTheDocument();
  });

  it('renders labels', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('auth')).toBeInTheDocument();
  });

  it('does not render labels section when empty', () => {
    render(<TaskCard task={unassignedTask} />);
    expect(screen.queryByText('frontend')).not.toBeInTheDocument();
  });

  it('has a testid with task id', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument();
  });

  it('applies dragging styles when isDragging', () => {
    render(<TaskCard task={mockTask} isDragging />);
    const card = screen.getByTestId('task-card-task-1');
    expect(card.className).toContain('shadow-lg');
  });
});

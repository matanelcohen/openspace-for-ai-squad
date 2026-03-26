import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock hooks before any component imports ──────────────────────

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/use-skills');

// Mock @dnd-kit since jsdom doesn't support drag-and-drop
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: <T,>(arr: T[], from: number, to: number) => {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
  },
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

vi.mock('../skill-dependency-graph', () => ({
  SkillDependencyGraph: ({ skillIds }: { skillIds: string[] }) => (
    <div data-testid="skill-dependency-graph">Graph: {skillIds.join(', ')}</div>
  ),
}));

import type { AgentSkillsConfig, SkillSummary } from '@/hooks/use-skills';
import {
  useAgentSkills,
  useBulkToggleAgentSkills,
  useReorderAgentSkills,
  useSkillDetail,
  useSkills,
  useToggleAgentSkill,
  useUpdateAgentSkillConfig,
} from '@/hooks/use-skills';

import { AgentSkillList } from '../agent-skill-list';

// ── Test data ────────────────────────────────────────────────────

const mockAssignments: AgentSkillsConfig = {
  agentId: 'agent-1',
  agentName: 'CodeBot',
  agentRole: 'Developer',
  assignments: [
    { skillId: 'code-review', enabled: true, priority: 0 },
    { skillId: 'test-runner', enabled: false, priority: 1 },
  ],
  activeOnCurrentTask: ['code-review'],
};

const mockAllSkills: SkillSummary[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    version: '1.0.0',
    description: 'Reviews code changes.',
    phase: 'active',
    activeAgentCount: 1,
    tags: ['code'],
  },
  {
    id: 'test-runner',
    name: 'Test Runner',
    version: '2.0.0',
    description: 'Runs automated tests.',
    phase: 'loaded',
    activeAgentCount: 0,
    tags: ['testing'],
  },
];

const mockMutate = vi.fn();
const mockMutation = {
  mutate: mockMutate,
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  isIdle: true,
  data: undefined,
  error: null,
  reset: vi.fn(),
  status: 'idle' as const,
  variables: undefined,
  context: undefined,
  failureCount: 0,
  failureReason: null,
  submittedAt: 0,
  isPaused: false,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ── Setup / Teardown ─────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useAgentSkills).mockReturnValue({
    data: mockAssignments,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgentSkills>);

  vi.mocked(useSkills).mockReturnValue({
    data: mockAllSkills,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useSkills>);

  vi.mocked(useToggleAgentSkill).mockReturnValue({ ...mockMutation });
  vi.mocked(useBulkToggleAgentSkills).mockReturnValue({ ...mockMutation });
  vi.mocked(useReorderAgentSkills).mockReturnValue({ ...mockMutation });
  vi.mocked(useUpdateAgentSkillConfig).mockReturnValue({ ...mockMutation });
  vi.mocked(useSkillDetail).mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useSkillDetail>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────

describe('AgentSkillList', () => {
  // ── Loading & Empty States ──────────────────────────────────

  it('shows loading skeleton when isLoading is true', () => {
    vi.mocked(useAgentSkills).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useAgentSkills>);
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('agent-skill-list-loading')).toBeInTheDocument();
  });

  it('shows empty message when no assignments', () => {
    vi.mocked(useAgentSkills).mockReturnValue({
      data: { ...mockAssignments, assignments: [] },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgentSkills>);
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('agent-skill-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No skills assigned to this agent.')).toBeInTheDocument();
  });

  // ── Skill Rows ─────────────────────────────────────────────

  it('renders the skill list container', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('agent-skill-list')).toBeInTheDocument();
  });

  it('renders rows for each assigned skill', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('agent-skill-row-code-review')).toBeInTheDocument();
    expect(screen.getByTestId('agent-skill-row-test-runner')).toBeInTheDocument();
  });

  it('renders skill names from metadata', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Test Runner')).toBeInTheDocument();
  });

  it('renders skill descriptions', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByText('Reviews code changes.')).toBeInTheDocument();
    expect(screen.getByText('Runs automated tests.')).toBeInTheDocument();
  });

  it('renders priority numbers starting from 1', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders drag handles', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    const handles = screen.getAllByLabelText('Drag to reorder');
    expect(handles).toHaveLength(2);
  });

  it('renders phase badges for skills', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('skill-phase-active')).toBeInTheDocument();
    expect(screen.getByTestId('skill-phase-loaded')).toBeInTheDocument();
  });

  it('shows "Active on task" badge for active skills', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByText('Active on task')).toBeInTheDocument();
  });

  // ── Toggle ─────────────────────────────────────────────────

  it('renders toggle switches for each skill', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('skill-toggle-code-review')).toBeInTheDocument();
    expect(screen.getByTestId('skill-toggle-test-runner')).toBeInTheDocument();
  });

  it('links skill names to detail pages', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    const link = screen.getByText('Code Review').closest('a');
    expect(link).toHaveAttribute('href', '/skills/code-review');
  });

  // ── Select & Bulk Operations ───────────────────────────────

  it('renders select-all button', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('select-all-skills')).toBeInTheDocument();
  });

  it('shows skill count in toolbar', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByText('2 skills')).toBeInTheDocument();
  });

  it('renders individual select buttons for each skill', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('skill-select-code-review')).toBeInTheDocument();
    expect(screen.getByTestId('skill-select-test-runner')).toBeInTheDocument();
  });

  it('shows selected count after selecting a skill', async () => {
    const user = userEvent.setup();
    render(<AgentSkillList agentId="agent-1" />, { wrapper });

    await user.click(screen.getByTestId('skill-select-code-review'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('shows bulk enable/disable buttons when skills are selected', async () => {
    const user = userEvent.setup();
    render(<AgentSkillList agentId="agent-1" />, { wrapper });

    await user.click(screen.getByTestId('skill-select-code-review'));
    expect(screen.getByTestId('bulk-enable-skills')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-disable-skills')).toBeInTheDocument();
  });

  it('does not show bulk buttons when no skills selected', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.queryByTestId('bulk-enable-skills')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-disable-skills')).not.toBeInTheDocument();
  });

  it('selects all skills when select-all is clicked', async () => {
    const user = userEvent.setup();
    render(<AgentSkillList agentId="agent-1" />, { wrapper });

    await user.click(screen.getByTestId('select-all-skills'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('deselects all when select-all is clicked again', async () => {
    const user = userEvent.setup();
    render(<AgentSkillList agentId="agent-1" />, { wrapper });

    await user.click(screen.getByTestId('select-all-skills'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await user.click(screen.getByTestId('select-all-skills'));
    expect(screen.getByText('2 skills')).toBeInTheDocument();
  });

  // ── Dependency Graph Toggle ────────────────────────────────

  it('renders the dependency graph toggle button', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('toggle-dependency-graph')).toBeInTheDocument();
  });

  it('shows dependency graph when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<AgentSkillList agentId="agent-1" />, { wrapper });

    await user.click(screen.getByTestId('toggle-dependency-graph'));
    expect(screen.getByTestId('skill-dependency-graph')).toBeInTheDocument();
  });

  it('hides dependency graph when toggle is clicked again', async () => {
    const user = userEvent.setup();
    render(<AgentSkillList agentId="agent-1" />, { wrapper });

    await user.click(screen.getByTestId('toggle-dependency-graph'));
    expect(screen.getByTestId('skill-dependency-graph')).toBeInTheDocument();
    await user.click(screen.getByTestId('toggle-dependency-graph'));
    expect(screen.queryByTestId('skill-dependency-graph')).not.toBeInTheDocument();
  });

  // ── Config Panel ───────────────────────────────────────────

  it('renders config toggle button for each skill', () => {
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByTestId('skill-config-toggle-code-review')).toBeInTheDocument();
    expect(screen.getByTestId('skill-config-toggle-test-runner')).toBeInTheDocument();
  });

  it('shows config panel when config toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<AgentSkillList agentId="agent-1" />, { wrapper });

    await user.click(screen.getByTestId('skill-config-toggle-code-review'));
    expect(screen.getByTestId('skill-config-panel-code-review')).toBeInTheDocument();
  });

  it('shows "no configurable parameters" for skill without config schema', async () => {
    const user = userEvent.setup();
    render(<AgentSkillList agentId="agent-1" />, { wrapper });

    await user.click(screen.getByTestId('skill-config-toggle-code-review'));
    expect(screen.getByText('This skill has no configurable parameters.')).toBeInTheDocument();
  });

  // ── Fallback when metadata is missing ──────────────────────

  it('renders skillId as name when no metadata available', () => {
    vi.mocked(useSkills).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSkills>);
    render(<AgentSkillList agentId="agent-1" />, { wrapper });
    expect(screen.getByText('code-review')).toBeInTheDocument();
    expect(screen.getByText('test-runner')).toBeInTheDocument();
  });
});

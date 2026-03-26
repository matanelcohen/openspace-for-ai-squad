import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-skills');
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ agentId: 'agent-1' }),
}));

// Mock dnd-kit since jsdom doesn't support DnD
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

// Mock the dependency graph (uses @xyflow/react)
vi.mock('@/components/skills/skill-dependency-graph', () => ({
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

import AgentSkillConfigPage from '../../../../app/skills/agents/[agentId]/page';

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

describe('AgentSkillConfigPage', () => {
  it('renders the page header with agent name', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByText('CodeBot Skills')).toBeInTheDocument();
  });

  it('renders the agent role in the description', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(
      screen.getByText(/Developer · Configure which skills this agent uses/),
    ).toBeInTheDocument();
  });

  it('renders the back button linking to /skills', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    const backButton = screen.getByText('Back to Skill Store');
    expect(backButton.closest('a')).toHaveAttribute('href', '/skills');
  });

  it('renders assigned skills in the list', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByTestId('agent-skill-list')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Test Runner')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useAgentSkills).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useAgentSkills>);
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByText('Loading agent skill configuration...')).toBeInTheDocument();
  });

  it('renders skill phase badges for assigned skills', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByTestId('skill-phase-active')).toBeInTheDocument();
    expect(screen.getByTestId('skill-phase-loaded')).toBeInTheDocument();
  });

  it('renders enable/disable toggle for each skill', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByTestId('skill-toggle-code-review')).toBeInTheDocument();
    expect(screen.getByTestId('skill-toggle-test-runner')).toBeInTheDocument();
  });

  it('renders drag handles for reordering', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    const handles = screen.getAllByLabelText('Drag to reorder');
    expect(handles.length).toBe(2);
  });

  it('renders priority numbers', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows dependency graph toggle button', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByTestId('toggle-dependency-graph')).toBeInTheDocument();
  });

  it('shows select-all button', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByTestId('select-all-skills')).toBeInTheDocument();
  });

  it('shows active on task indicator', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByText('Active on task')).toBeInTheDocument();
  });

  it('renders hint text about green ring and drag ordering', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(
      screen.getByText(/Skills highlighted with a green ring are currently active/),
    ).toBeInTheDocument();
  });
});

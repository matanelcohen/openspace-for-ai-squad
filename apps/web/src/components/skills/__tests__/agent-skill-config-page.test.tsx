import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import {
  useAgentSkills,
  useAttachAgentSkill,
  useBulkToggleAgentSkills,
  useDetachAgentSkill,
  useReorderAgentSkills,
  useSkillDetail,
  useSkills,
  useToggleAgentSkill,
  useUpdateAgentSkillConfig,
} from '@/hooks/use-skills';
import type { AgentSkillsConfig, SkillSummary } from '@/hooks/use-skills';

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
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    version: '1.3.0',
    description: 'Scans for vulnerabilities.',
    phase: 'validated',
    activeAgentCount: 0,
    tags: ['security'],
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
  vi.mocked(useDetachAgentSkill).mockReturnValue({ ...mockMutation });
  vi.mocked(useAttachAgentSkill).mockReturnValue({ ...mockMutation });
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

  it('renders the Add Skills button', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByTestId('toggle-available-skills')).toBeInTheDocument();
    expect(screen.getByText('Add Skills')).toBeInTheDocument();
  });

  it('shows available skills panel when Add Skills is clicked', async () => {
    render(<AgentSkillConfigPage />, { wrapper });
    const addButton = screen.getByTestId('toggle-available-skills');
    await userEvent.click(addButton);
    expect(screen.getByTestId('available-skills-heading')).toBeInTheDocument();
    expect(screen.getByTestId('available-skills-panel')).toBeInTheDocument();
  });

  it('hides available skills panel when clicked again', async () => {
    render(<AgentSkillConfigPage />, { wrapper });
    const addButton = screen.getByTestId('toggle-available-skills');
    await userEvent.click(addButton);
    expect(screen.getByTestId('available-skills-panel')).toBeInTheDocument();
    await userEvent.click(addButton);
    expect(screen.queryByTestId('available-skills-panel')).not.toBeInTheDocument();
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

  it('renders detach button for each assigned skill', () => {
    render(<AgentSkillConfigPage />, { wrapper });
    expect(screen.getByTestId('skill-detach-code-review')).toBeInTheDocument();
    expect(screen.getByTestId('skill-detach-test-runner')).toBeInTheDocument();
  });

  it('only shows unassigned skills in the available panel', async () => {
    render(<AgentSkillConfigPage />, { wrapper });
    await userEvent.click(screen.getByTestId('toggle-available-skills'));
    // Security Scanner is not assigned, so it should appear
    expect(screen.getByTestId('available-skill-security-scanner')).toBeInTheDocument();
    // Code Review and Test Runner are assigned, so they should NOT appear in available
    expect(screen.queryByTestId('available-skill-code-review')).not.toBeInTheDocument();
    expect(screen.queryByTestId('available-skill-test-runner')).not.toBeInTheDocument();
  });

  it('shows assign button for available skills', async () => {
    render(<AgentSkillConfigPage />, { wrapper });
    await userEvent.click(screen.getByTestId('toggle-available-skills'));
    expect(screen.getByTestId('assign-skill-security-scanner')).toBeInTheDocument();
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

  it('shows "all skills assigned" message when no available skills', async () => {
    vi.mocked(useSkills).mockReturnValue({
      data: mockAllSkills.filter((s) => s.id === 'code-review' || s.id === 'test-runner'),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSkills>);
    render(<AgentSkillConfigPage />, { wrapper });
    await userEvent.click(screen.getByTestId('toggle-available-skills'));
    expect(screen.getByTestId('no-available-skills')).toBeInTheDocument();
    expect(screen.getByText('All skills are already assigned to this agent.')).toBeInTheDocument();
  });

  it('filters available skills by search', async () => {
    render(<AgentSkillConfigPage />, { wrapper });
    await userEvent.click(screen.getByTestId('toggle-available-skills'));
    const searchInput = screen.getByTestId('available-skills-search');
    await userEvent.type(searchInput, 'security');
    expect(screen.getByTestId('available-skill-security-scanner')).toBeInTheDocument();
  });

  it('shows no match message when search yields nothing', async () => {
    render(<AgentSkillConfigPage />, { wrapper });
    await userEvent.click(screen.getByTestId('toggle-available-skills'));
    const searchInput = screen.getByTestId('available-skills-search');
    await userEvent.type(searchInput, 'zzzznonexistent');
    expect(screen.getByText('No matching skills found.')).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-skills');

// Mock components that use unmocked hooks internally
vi.mock('@/components/skills/skill-import-dialog', () => ({
  SkillImportDialog: () => <button data-testid="import-dialog-btn">Import</button>,
}));
vi.mock('@/components/skills/skill-form-dialog', () => ({
  SkillFormDialog: () => <button data-testid="create-skill-btn">Create Skill</button>,
}));
vi.mock('@/hooks/use-agents', () => ({
  useAgents: () => ({ data: [], isLoading: false }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { SkillSummary } from '@/hooks/use-skills';
import { useAgentSkillsManagement, useAllSkillTags, useSkills } from '@/hooks/use-skills';

const mockedUseSkills = vi.mocked(useSkills);
const mockedUseAllSkillTags = vi.mocked(useAllSkillTags);
const mockedUseAgentSkillsManagement = vi.mocked(useAgentSkillsManagement);

import SkillStorePage from '../../../../app/skills/page';

const mockSkills: SkillSummary[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    version: '1.0.0',
    description: 'Reviews code changes for quality.',
    icon: 'code',
    tags: ['code', 'review'],
    phase: 'active',
    activeAgentCount: 2,
  },
  {
    id: 'test-runner',
    name: 'Test Runner',
    version: '2.1.0',
    description: 'Runs automated test suites.',
    icon: 'testing',
    tags: ['testing', 'ci'],
    phase: 'loaded',
    activeAgentCount: 0,
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    version: '1.3.0',
    description: 'Scans for security vulnerabilities.',
    icon: 'security',
    tags: ['security', 'code'],
    phase: 'error',
    activeAgentCount: 1,
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseSkills.mockReturnValue({
    data: mockSkills,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useSkills>);
  mockedUseAllSkillTags.mockReturnValue(['ci', 'code', 'review', 'security', 'testing']);
  mockedUseAgentSkillsManagement.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgentSkillsManagement>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SkillStorePage', () => {
  it('renders the page header with title', () => {
    render(<SkillStorePage />, { wrapper });
    expect(screen.getByText('Skill Store')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(<SkillStorePage />, { wrapper });
    expect(
      screen.getByText('Browse, discover, and manage skills for your AI agents.'),
    ).toBeInTheDocument();
  });

  it('renders the filters toolbar', () => {
    render(<SkillStorePage />, { wrapper });
    expect(screen.getByTestId('skill-filters')).toBeInTheDocument();
    expect(screen.getByTestId('skill-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('skill-tag-filter')).toBeInTheDocument();
    expect(screen.getByTestId('skill-phase-filter')).toBeInTheDocument();
  });

  it('renders skill cards in the grid', () => {
    render(<SkillStorePage />, { wrapper });
    expect(screen.getByTestId('skill-grid')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Test Runner')).toBeInTheDocument();
    expect(screen.getByText('Security Scanner')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseSkills.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useSkills>);
    render(<SkillStorePage />, { wrapper });
    expect(screen.getByTestId('skill-grid-loading')).toBeInTheDocument();
  });

  it('shows empty state when no skills returned', () => {
    mockedUseSkills.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSkills>);
    render(<SkillStorePage />, { wrapper });
    expect(screen.getByText('No skills found')).toBeInTheDocument();
  });

  it('calls useSkills with no filters initially', () => {
    render(<SkillStorePage />, { wrapper });
    expect(mockedUseSkills).toHaveBeenCalledWith({
      search: undefined,
      tag: undefined,
      phase: undefined,
    });
  });

  it('updates search filter when typing', async () => {
    render(<SkillStorePage />, { wrapper });
    const searchInput = screen.getByTestId('skill-search-input');
    await userEvent.type(searchInput, 'code');
    // useSkills should be called with updated search param
    expect(mockedUseSkills).toHaveBeenCalledWith(expect.objectContaining({ search: 'code' }));
  });

  it('displays skill descriptions', () => {
    render(<SkillStorePage />, { wrapper });
    expect(screen.getByText('Reviews code changes for quality.')).toBeInTheDocument();
    expect(screen.getByText('Runs automated test suites.')).toBeInTheDocument();
    expect(screen.getByText('Scans for security vulnerabilities.')).toBeInTheDocument();
  });

  it('displays skill tags', () => {
    render(<SkillStorePage />, { wrapper });
    // 'code' appears on multiple cards, so use getAllByText
    expect(screen.getAllByText('code').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('review')).toBeInTheDocument();
    expect(screen.getByText('testing')).toBeInTheDocument();
  });

  it('displays phase badges', () => {
    render(<SkillStorePage />, { wrapper });
    expect(screen.getByTestId('skill-phase-active')).toBeInTheDocument();
    expect(screen.getByTestId('skill-phase-loaded')).toBeInTheDocument();
    expect(screen.getByTestId('skill-phase-error')).toBeInTheDocument();
  });

  it('displays skill icons', () => {
    const { container } = render(<SkillStorePage />, { wrapper });
    // Each card has an icon container
    const iconContainers = container.querySelectorAll('.bg-primary\\/10');
    expect(iconContainers.length).toBe(3);
  });
});

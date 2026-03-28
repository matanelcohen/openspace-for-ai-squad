import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// ── Component Render Tests ───────────────────────────────────────

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

// Mock the hooks
vi.mock('@/hooks/use-skills', () => ({
  useCreateSkill: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'test-skill', name: 'test-skill' }),
    isPending: false,
  }),
  useUpdateSkill: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'test-skill' }),
    isPending: false,
  }),
}));

// Need to import after mocks
const { SkillFormDialog } = await import('@/components/skills/skill-form-dialog');

// Wrap with providers for react-query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('SkillFormDialog', () => {
  it('renders the create skill button', () => {
    render(
      <TestWrapper>
        <SkillFormDialog />
      </TestWrapper>,
    );
    expect(screen.getByTestId('create-skill-btn')).toBeInTheDocument();
    expect(screen.getByText('Create Skill')).toBeInTheDocument();
  });

  it('opens the form dialog when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillFormDialog />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    expect(screen.getByTestId('skill-form-dialog')).toBeInTheDocument();
    expect(screen.getByText('Create New Skill')).toBeInTheDocument();
  });

  it('shows all form fields', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillFormDialog />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    expect(screen.getByTestId('skill-field-name')).toBeInTheDocument();
    expect(screen.getByTestId('skill-field-description')).toBeInTheDocument();
    expect(screen.getByTestId('skill-field-tags')).toBeInTheDocument();
    expect(screen.getByTestId('skill-field-bins')).toBeInTheDocument();
    expect(screen.getByTestId('skill-field-env')).toBeInTheDocument();
    expect(screen.getByTestId('skill-field-instructions')).toBeInTheDocument();
  });

  it('shows agent role buttons', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillFormDialog />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    expect(screen.getByTestId('skill-role-*')).toBeInTheDocument();
    expect(screen.getByTestId('skill-role-lead')).toBeInTheDocument();
    expect(screen.getByTestId('skill-role-frontend-dev')).toBeInTheDocument();
    expect(screen.getByTestId('skill-role-backend-dev')).toBeInTheDocument();
    expect(screen.getByTestId('skill-role-tester')).toBeInTheDocument();
  });

  it('converts name to kebab-case', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillFormDialog />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    const nameInput = screen.getByTestId('skill-field-name');
    await user.type(nameInput, 'Code Review');
    expect(nameInput).toHaveValue('code-review');
  });

  it('shows submit and cancel buttons', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillFormDialog />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    expect(screen.getByTestId('skill-form-submit')).toBeInTheDocument();
    expect(screen.getByTestId('skill-form-cancel')).toBeInTheDocument();
  });
});

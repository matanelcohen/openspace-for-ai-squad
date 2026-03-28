import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SkillDetail } from '@/hooks/use-skills';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

const mockUpdateMutateAsync = vi.fn().mockResolvedValue({ id: 'code-review' });

vi.mock('@/hooks/use-skills', () => ({
  useCreateSkill: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'test-skill', name: 'test-skill' }),
    isPending: false,
  }),
  useUpdateSkill: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

// Need to import after mocks
const { SkillFormDialog } = await import('@/components/skills/skill-form-dialog');

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ── Fixtures ─────────────────────────────────────────────────────

const baseSkill: SkillDetail = {
  manifest: {
    manifestVersion: 1,
    id: 'code-review',
    name: 'Code Review',
    version: '1.2.0',
    description: 'Automated code reviews.',
    author: 'openspace',
    icon: 'code',
    tags: ['code-analysis'],
    tools: [],
    prompts: [],
    triggers: [],
    agentMatch: { roles: ['*'] },
    requires: { bins: ['git'], env: ['OPENAI_API_KEY'] },
    instructions: '## Code Review\n\nReview code.',
  },
  phase: 'active',
  hooks: null,
  activeAgents: new Set(),
  lastTransition: Date.now(),
} as unknown as SkillDetail;

// ── Edit Dialog Tests ────────────────────────────────────────────

describe('SkillFormDialog — edit mode', () => {
  it('opens with pre-populated data and shows "Edit Skill" title', () => {
    render(
      <TestWrapper>
        <SkillFormDialog skill={baseSkill} open={true} onOpenChange={() => {}} />
      </TestWrapper>,
    );

    expect(screen.getByText('Edit Skill')).toBeInTheDocument();
    expect(screen.getByTestId('skill-field-name')).toHaveValue('code-review');
    expect(screen.getByTestId('skill-field-description')).toHaveValue('Automated code reviews.');
    expect(screen.getByTestId('skill-form-submit')).toHaveTextContent('Save Changes');
  });

  it('disables the name field in edit mode', () => {
    render(
      <TestWrapper>
        <SkillFormDialog skill={baseSkill} open={true} onOpenChange={() => {}} />
      </TestWrapper>,
    );

    expect(screen.getByTestId('skill-field-name')).toBeDisabled();
  });

  it('submits with correct payload when saving changes', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillFormDialog skill={baseSkill} open={true} onOpenChange={() => {}} />
      </TestWrapper>,
    );

    const descInput = screen.getByTestId('skill-field-description');
    await user.clear(descInput);
    await user.type(descInput, 'Updated description');

    await user.click(screen.getByTestId('skill-form-submit'));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'code-review',
        description: 'Updated description',
      }),
    );
  });
});

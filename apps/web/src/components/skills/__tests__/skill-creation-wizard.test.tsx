import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  formStateToManifest,
  INITIAL_STATE,
  manifestToFormState,
  validateManifest,
  validateStep,
  type WizardFormState,
} from '@/hooks/use-skill-manifest-form';

// ── Validation Tests ─────────────────────────────────────────────

describe('validateManifest', () => {
  it('returns errors for empty initial state', () => {
    const errors = validateManifest(INITIAL_STATE);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'id')).toBe(true);
    expect(errors.some((e) => e.field === 'name')).toBe(true);
    expect(errors.some((e) => e.field === 'description')).toBe(true);
    expect(errors.some((e) => e.field === 'tools')).toBe(true);
    expect(errors.some((e) => e.field === 'triggers')).toBe(true);
    expect(errors.some((e) => e.field === 'prompts')).toBe(true);
  });

  it('validates kebab-case ID', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      id: 'InvalidCamelCase',
      name: 'Test',
      version: '1.0.0',
      description: 'test',
    };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field === 'id' && e.message.includes('kebab-case'))).toBe(true);
  });

  it('validates semver version', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      id: 'test-skill',
      name: 'Test',
      version: 'not-semver',
      description: 'test',
    };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field === 'version' && e.message.includes('semver'))).toBe(true);
  });

  it('returns no errors for valid complete state', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      id: 'code-review',
      name: 'Code Review',
      version: '1.0.0',
      description: 'Automated code reviews',
      tools: [{ toolId: 'git:diff' }],
      triggers: [{ type: 'task-type', taskTypes: ['review'] }],
      prompts: [{ id: 'main', name: 'Main', role: 'system', content: 'Review this code' }],
    };
    const errors = validateManifest(state);
    expect(errors).toHaveLength(0);
  });

  it('validates tool IDs are non-empty', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      description: 'test',
      tools: [{ toolId: '' }],
      triggers: [{ type: 'task-type', taskTypes: ['test'] }],
      prompts: [{ id: 'p', name: 'P', role: 'system', content: 'content' }],
    };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field === 'tools[0].toolId')).toBe(true);
  });

  it('validates prompt fields', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      description: 'test',
      tools: [{ toolId: 'git:diff' }],
      triggers: [{ type: 'task-type', taskTypes: ['test'] }],
      prompts: [{ id: '', name: '', role: 'system', content: '' }],
    };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field === 'prompts[0].id')).toBe(true);
    expect(errors.some((e) => e.field === 'prompts[0].name')).toBe(true);
    expect(errors.some((e) => e.field === 'prompts[0].content')).toBe(true);
  });
});

describe('validateStep', () => {
  it('returns only step 0 (basics) errors for step 0', () => {
    const errors = validateStep(INITIAL_STATE, 0);
    expect(errors.every((e) => ['id', 'name', 'version', 'description'].includes(e.field))).toBe(
      true,
    );
  });

  it('returns only tools errors for step 1', () => {
    const errors = validateStep(INITIAL_STATE, 1);
    expect(errors.every((e) => e.field === 'tools' || e.field.startsWith('tools['))).toBe(true);
  });

  it('returns only trigger errors for step 2', () => {
    const errors = validateStep(INITIAL_STATE, 2);
    expect(errors.every((e) => e.field === 'triggers' || e.field.startsWith('triggers['))).toBe(
      true,
    );
  });
});

// ── Serialization Tests ──────────────────────────────────────────

describe('formStateToManifest', () => {
  it('produces a valid SkillManifest from form state', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      id: 'code-review',
      name: 'Code Review',
      version: '1.0.0',
      description: 'Automated code reviews',
      author: 'squad',
      icon: 'code',
      tags: ['code-analysis'],
      tools: [{ toolId: 'git:diff', reason: 'Need to read diffs' }],
      triggers: [{ type: 'task-type', taskTypes: ['review'] }],
      prompts: [{ id: 'sys', name: 'System', role: 'system', content: 'Review code' }],
      config: [{ key: 'strictness', label: 'Strictness', type: 'string', description: 'Level' }],
    };

    const manifest = formStateToManifest(state);
    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.id).toBe('code-review');
    expect(manifest.name).toBe('Code Review');
    expect(manifest.tools).toHaveLength(1);
    expect(manifest.prompts).toHaveLength(1);
    expect(manifest.triggers).toHaveLength(1);
    expect(manifest.config).toHaveLength(1);
    expect(manifest.author).toBe('squad');
    expect(manifest.tags).toEqual(['code-analysis']);
  });

  it('omits optional fields when empty', () => {
    const manifest = formStateToManifest(INITIAL_STATE);
    expect(manifest.author).toBeUndefined();
    expect(manifest.tags).toBeUndefined();
    expect(manifest.config).toBeUndefined();
    expect(manifest.homepage).toBeUndefined();
    expect(manifest.permissions).toBeUndefined();
    expect(manifest.entryPoint).toBeUndefined();
  });
});

describe('manifestToFormState', () => {
  it('round-trips through formStateToManifest', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      id: 'test-skill',
      name: 'Test Skill',
      version: '2.0.0',
      description: 'Test description',
      tools: [{ toolId: 'file:read' }],
      triggers: [{ type: 'label', labels: ['security'] }],
      prompts: [{ id: 'p1', name: 'P1', role: 'execution', content: 'Do stuff' }],
    };

    const manifest = formStateToManifest(state);
    const restored = manifestToFormState(manifest);
    expect(restored.id).toBe(state.id);
    expect(restored.name).toBe(state.name);
    expect(restored.version).toBe(state.version);
    expect(restored.tools).toEqual(state.tools);
    expect(restored.prompts).toEqual(state.prompts);
  });
});

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
    mutateAsync: vi.fn().mockResolvedValue({ id: 'test-skill' }),
    isPending: false,
  }),
}));

// Need to import after mocks
const { SkillCreationWizard } = await import(
  '@/components/skills/skill-creation-wizard'
);
const { SkillCardPreview } = await import('@/components/skills/skill-card-preview');
const { WizardStepBasics } = await import('@/components/skills/wizard-step-basics');

// Wrap with providers for react-query
function TestWrapper({ children }: { children: React.ReactNode }) {
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('SkillCreationWizard', () => {
  it('renders the create skill button', () => {
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );
    expect(screen.getByTestId('create-skill-btn')).toBeInTheDocument();
    expect(screen.getByText('Create Skill')).toBeInTheDocument();
  });

  it('opens the wizard dialog when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    expect(screen.getByTestId('skill-creation-wizard')).toBeInTheDocument();
    expect(screen.getByText('Create New Skill')).toBeInTheDocument();
  });

  it('shows all step navigation items', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    expect(screen.getByTestId('wizard-step-nav-basics')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-nav-tools')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-nav-triggers')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-nav-prompts')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-step-nav-config')).toBeInTheDocument();
  });

  it('starts on the basics step', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    expect(screen.getByTestId('wizard-step-basics')).toBeInTheDocument();
  });

  it('navigates to next step when Next is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    await user.click(screen.getByTestId('wizard-next-btn'));
    expect(screen.getByTestId('wizard-step-tools')).toBeInTheDocument();
  });

  it('navigates back when Back is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    await user.click(screen.getByTestId('wizard-next-btn'));
    expect(screen.getByTestId('wizard-step-tools')).toBeInTheDocument();

    await user.click(screen.getByTestId('wizard-back-btn'));
    expect(screen.getByTestId('wizard-step-basics')).toBeInTheDocument();
  });

  it('shows the card preview pane', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    expect(screen.getByTestId('skill-card-preview')).toBeInTheDocument();
  });

  it('can navigate steps via sidebar', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));

    // Click on triggers step directly
    await user.click(screen.getByTestId('wizard-step-nav-triggers'));
    expect(screen.getByTestId('wizard-step-triggers')).toBeInTheDocument();

    // Click on config step directly
    await user.click(screen.getByTestId('wizard-step-nav-config'));
    expect(screen.getByTestId('wizard-step-config')).toBeInTheDocument();
  });

  it('shows submit button on last step', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <SkillCreationWizard />
      </TestWrapper>,
    );

    await user.click(screen.getByTestId('create-skill-btn'));
    await user.click(screen.getByTestId('wizard-step-nav-config'));
    expect(screen.getByTestId('wizard-submit-btn')).toBeInTheDocument();
  });
});

describe('SkillCardPreview', () => {
  it('renders default placeholder text for empty state', () => {
    render(<SkillCardPreview state={INITIAL_STATE} />);
    expect(screen.getByText('Skill Name')).toBeInTheDocument();
    expect(screen.getByText('Skill description will appear here...')).toBeInTheDocument();
  });

  it('renders actual values from form state', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      name: 'Security Scanner',
      version: '2.1.0',
      description: 'Scans code for vulnerabilities',
      tags: ['security', 'code-analysis'],
      tools: [{ toolId: 'scan:code' }, { toolId: 'git:diff' }],
    };
    render(<SkillCardPreview state={state} />);
    expect(screen.getByText('Security Scanner')).toBeInTheDocument();
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
    expect(screen.getByText('Scans code for vulnerabilities')).toBeInTheDocument();
    expect(screen.getByText('security')).toBeInTheDocument();
    expect(screen.getByText('code-analysis')).toBeInTheDocument();
    expect(screen.getByText('2 declared')).toBeInTheDocument();
  });

  it('shows summary counts', () => {
    const state: WizardFormState = {
      ...INITIAL_STATE,
      tools: [{ toolId: 'a' }, { toolId: 'b' }],
      triggers: [{ type: 'task-type', taskTypes: ['x'] }],
      prompts: [{ id: 'p', name: 'P', role: 'system', content: 'c' }],
      config: [
        { key: 'k', label: 'L', type: 'string', description: '' },
        { key: 'k2', label: 'L2', type: 'number', description: '' },
      ],
    };
    render(<SkillCardPreview state={state} />);
    expect(screen.getByText('2 declared')).toBeInTheDocument();
    expect(screen.getByText('1 rules')).toBeInTheDocument();
    expect(screen.getByText('1 templates')).toBeInTheDocument();
    expect(screen.getByText('2 parameters')).toBeInTheDocument();
  });
});

describe('WizardStepBasics', () => {
  it('renders all input fields', () => {
    const setField = vi.fn();
    const getFieldError = vi.fn().mockReturnValue(undefined);

    render(
      <WizardStepBasics
        state={INITIAL_STATE}
        setField={setField}
        getFieldError={getFieldError}
      />,
    );

    expect(screen.getByLabelText(/Skill Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Skill ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Version/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
  });

  it('calls setField when name is changed', async () => {
    const user = userEvent.setup();
    const setField = vi.fn();
    const getFieldError = vi.fn().mockReturnValue(undefined);

    render(
      <WizardStepBasics
        state={INITIAL_STATE}
        setField={setField}
        getFieldError={getFieldError}
      />,
    );

    const nameInput = screen.getByLabelText(/Skill Name/);
    await user.type(nameInput, 'M');
    expect(setField).toHaveBeenCalledWith('name', 'M');
  });

  it('shows validation errors', () => {
    const setField = vi.fn();
    const getFieldError = vi.fn((field: string) => {
      if (field === 'name') return 'Skill name is required';
      return undefined;
    });

    render(
      <WizardStepBasics
        state={INITIAL_STATE}
        setField={setField}
        getFieldError={getFieldError}
      />,
    );

    expect(screen.getByText('Skill name is required')).toBeInTheDocument();
  });

  it('renders tag toggle badges', () => {
    const setField = vi.fn();
    const getFieldError = vi.fn().mockReturnValue(undefined);

    render(
      <WizardStepBasics
        state={INITIAL_STATE}
        setField={setField}
        getFieldError={getFieldError}
      />,
    );

    expect(screen.getByTestId('tag-testing')).toBeInTheDocument();
    expect(screen.getByTestId('tag-security')).toBeInTheDocument();
  });
});

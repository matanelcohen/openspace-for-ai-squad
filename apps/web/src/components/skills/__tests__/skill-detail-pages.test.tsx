import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SkillDetail } from '@/hooks/use-skills';

import { SkillDetailOverview } from '../skill-detail-overview';
import { SkillDetailTools } from '../skill-detail-tools';
import { SkillDetailPrompts } from '../skill-detail-prompts';
import { SkillDetailDependencies } from '../skill-detail-dependencies';

// ── Mock SkillDependencyGraph (uses @xyflow/react which needs a DOM provider) ──
vi.mock('../skill-dependency-graph', () => ({
  SkillDependencyGraph: ({ skillIds }: { skillIds: string[] }) => (
    <div data-testid="skill-dependency-graph">Graph for {skillIds.join(', ')}</div>
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────

const baseSkill: SkillDetail = {
  manifest: {
    manifestVersion: 1,
    id: 'code-review',
    name: 'Code Review',
    version: '1.2.0',
    description: 'Automated code reviews with configurable strictness.',
    author: 'openspace',
    license: 'MIT',
    homepage: 'https://example.com/docs',
    icon: 'code',
    tags: ['code-analysis', 'testing'],
    tools: [
      { toolId: 'git:diff', reason: 'Compare changes' },
      { toolId: 'file:read', optional: true, versionRange: '^1.0.0' },
    ],
    prompts: [
      {
        id: 'system',
        name: 'System Prompt',
        role: 'system',
        content: 'You are {{agent.name}}, a code reviewer.',
        variables: [
          { name: 'agent.name', type: 'string', description: 'Agent display name', required: true },
        ],
        maxTokens: 4096,
      },
      {
        id: 'review',
        name: 'Review Execution',
        role: 'execution',
        content: 'Review the following diff:\n{{diff}}',
      },
    ],
    triggers: [{ type: 'task-type', taskTypes: ['review'] }],
    dependencies: [
      { skillId: 'git-expert', versionRange: '^1.0.0' },
      { skillId: 'linter', optional: true },
    ],
    config: [
      { key: 'strictness', label: 'Strictness', type: 'string', description: 'How strict', default: 'medium' },
    ],
    permissions: ['fs:read', 'exec:shell'],
    entryPoint: 'src/index.ts',
    toolAvailability: { 'git:diff': true, 'file:read': false },
    resolvedDependencies: { 'git-expert': '1.3.0' },
    sourcePath: '/skills/code-review',
  },
  phase: 'active',
  hooks: null,
  activeAgents: new Set(['agent-1']),
  lastTransition: Date.now(),
} as unknown as SkillDetail;

// ── SkillDetailOverview ──────────────────────────────────────────

describe('SkillDetailOverview', () => {
  it('renders the skill name and description', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Automated code reviews with configurable strictness.')).toBeInTheDocument();
  });

  it('renders the phase badge', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByTestId('skill-detail-overview')).toBeInTheDocument();
  });

  it('renders the version card', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
  });

  it('renders the author card', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('openspace')).toBeInTheDocument();
  });

  it('renders the entry point', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
  });

  it('renders capability tags', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('code-analysis')).toBeInTheDocument();
    expect(screen.getByText('testing')).toBeInTheDocument();
  });

  it('renders required permissions', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('fs:read')).toBeInTheDocument();
    expect(screen.getByText('exec:shell')).toBeInTheDocument();
  });

  it('renders documentation link', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    const link = screen.getByText('Documentation');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://example.com/docs');
  });

  it('shows declarative message when no entry point', () => {
    const skill = {
      ...baseSkill,
      manifest: { ...baseSkill.manifest, entryPoint: undefined },
    } as unknown as SkillDetail;
    render(<SkillDetailOverview skill={skill} />);
    expect(screen.getByText('Declarative (no entry point)')).toBeInTheDocument();
  });
});

// ── SkillDetailTools ─────────────────────────────────────────────

describe('SkillDetailTools', () => {
  it('renders tool count', () => {
    render(<SkillDetailTools skill={baseSkill} />);
    expect(screen.getByText('2 tools declared')).toBeInTheDocument();
  });

  it('renders each tool ID', () => {
    render(<SkillDetailTools skill={baseSkill} />);
    expect(screen.getByText('git:diff')).toBeInTheDocument();
    expect(screen.getByText('file:read')).toBeInTheDocument();
  });

  it('shows optional badge for optional tools', () => {
    render(<SkillDetailTools skill={baseSkill} />);
    expect(screen.getByText('optional')).toBeInTheDocument();
  });

  it('shows availability status', () => {
    render(<SkillDetailTools skill={baseSkill} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('shows tool reason', () => {
    render(<SkillDetailTools skill={baseSkill} />);
    expect(screen.getByText('Compare changes')).toBeInTheDocument();
  });

  it('shows version range', () => {
    render(<SkillDetailTools skill={baseSkill} />);
    expect(screen.getByText('Version: ^1.0.0')).toBeInTheDocument();
  });

  it('shows empty state for skills with no tools', () => {
    const skill = {
      ...baseSkill,
      manifest: { ...baseSkill.manifest, tools: [] },
    } as unknown as SkillDetail;
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('This skill does not declare any tool dependencies.')).toBeInTheDocument();
  });
});

// ── SkillDetailPrompts ───────────────────────────────────────────

describe('SkillDetailPrompts', () => {
  it('renders prompt count', () => {
    render(<SkillDetailPrompts skill={baseSkill} />);
    expect(screen.getByText('2 prompt templates')).toBeInTheDocument();
  });

  it('renders prompt names', () => {
    render(<SkillDetailPrompts skill={baseSkill} />);
    expect(screen.getByText('System Prompt')).toBeInTheDocument();
    expect(screen.getByText('Review Execution')).toBeInTheDocument();
  });

  it('renders role badges', () => {
    render(<SkillDetailPrompts skill={baseSkill} />);
    expect(screen.getByText('system')).toBeInTheDocument();
    expect(screen.getByText('execution')).toBeInTheDocument();
  });

  it('renders prompt content in pre blocks', () => {
    render(<SkillDetailPrompts skill={baseSkill} />);
    expect(screen.getByText(/You are \{\{agent\.name\}\}/)).toBeInTheDocument();
  });

  it('renders max tokens when present', () => {
    render(<SkillDetailPrompts skill={baseSkill} />);
    expect(screen.getByText('max 4096 tokens')).toBeInTheDocument();
  });

  it('renders variable badges', () => {
    render(<SkillDetailPrompts skill={baseSkill} />);
    expect(screen.getByText(/agent\.name/)).toBeInTheDocument();
  });

  it('shows empty state for skills with no prompts', () => {
    const skill = {
      ...baseSkill,
      manifest: { ...baseSkill.manifest, prompts: [] },
    } as unknown as SkillDetail;
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('This skill does not define any prompt templates.')).toBeInTheDocument();
  });
});

// ── SkillDetailDependencies ──────────────────────────────────────

describe('SkillDetailDependencies', () => {
  it('renders dependency count', () => {
    render(<SkillDetailDependencies skill={baseSkill} />);
    expect(screen.getByText('2 dependencies')).toBeInTheDocument();
  });

  it('renders each dependency skill ID', () => {
    render(<SkillDetailDependencies skill={baseSkill} />);
    expect(screen.getByText('git-expert')).toBeInTheDocument();
    expect(screen.getByText('linter')).toBeInTheDocument();
  });

  it('shows optional badge', () => {
    render(<SkillDetailDependencies skill={baseSkill} />);
    expect(screen.getByText('optional')).toBeInTheDocument();
  });

  it('shows resolved version for resolved deps', () => {
    render(<SkillDetailDependencies skill={baseSkill} />);
    expect(screen.getByText('v1.3.0')).toBeInTheDocument();
  });

  it('shows unresolved indicator for unresolved deps', () => {
    render(<SkillDetailDependencies skill={baseSkill} />);
    expect(screen.getByText('Unresolved')).toBeInTheDocument();
  });

  it('shows version range when specified', () => {
    render(<SkillDetailDependencies skill={baseSkill} />);
    expect(screen.getByText('Required: ^1.0.0')).toBeInTheDocument();
  });

  it('shows source path', () => {
    render(<SkillDetailDependencies skill={baseSkill} />);
    expect(screen.getByText('/skills/code-review')).toBeInTheDocument();
  });

  it('renders dependency graph when dependencies exist', () => {
    render(<SkillDetailDependencies skill={baseSkill} />);
    expect(screen.getByTestId('skill-dependency-graph')).toBeInTheDocument();
  });

  it('shows empty state for skills with no dependencies', () => {
    const skill = {
      ...baseSkill,
      manifest: { ...baseSkill.manifest, dependencies: [] },
    } as unknown as SkillDetail;
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('This skill has no dependencies on other skills.')).toBeInTheDocument();
  });

  it('does not render dependency graph when no dependencies', () => {
    const skill = {
      ...baseSkill,
      manifest: { ...baseSkill.manifest, dependencies: [] },
    } as unknown as SkillDetail;
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.queryByTestId('skill-dependency-graph')).not.toBeInTheDocument();
  });
});

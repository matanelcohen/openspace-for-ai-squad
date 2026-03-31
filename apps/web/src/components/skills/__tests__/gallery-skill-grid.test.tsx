import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GallerySkillItem } from '@/hooks/use-skill-gallery';

vi.mock('@/hooks/use-skill-gallery', () => ({
  useInstallGallerySkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { GallerySkillGrid } from '../gallery-skill-grid';

const makeSkill = (id: string, name: string): GallerySkillItem => ({
  id,
  name,
  description: `${name} desc`,
  category: 'code-quality',
  tags: [],
  version: '1.0.0',
  installCount: 0,
  addedAt: Date.now(),
  updatedAt: Date.now(),
});

beforeEach(() => vi.clearAllMocks());

describe('GallerySkillGrid', () => {
  it('shows loading skeletons', () => {
    render(<GallerySkillGrid isLoading skills={undefined} />);
    expect(screen.getByTestId('gallery-grid-loading')).toBeInTheDocument();
  });

  it('shows empty state when no skills', () => {
    render(<GallerySkillGrid isLoading={false} skills={[]} />);
    expect(screen.getByText('No gallery skills found')).toBeInTheDocument();
  });

  it('shows empty state when skills is undefined and not loading', () => {
    render(<GallerySkillGrid isLoading={false} skills={undefined} />);
    expect(screen.getByText('No gallery skills found')).toBeInTheDocument();
  });

  it('renders skill cards in a grid', () => {
    const skills = [makeSkill('s1', 'Alpha'), makeSkill('s2', 'Beta'), makeSkill('s3', 'Gamma')];
    render(<GallerySkillGrid isLoading={false} skills={skills} />);
    expect(screen.getByTestId('gallery-grid')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('marks installed skills via installedIds', () => {
    const skills = [makeSkill('s1', 'Alpha')];
    render(<GallerySkillGrid isLoading={false} skills={skills} installedIds={new Set(['s1'])} />);
    // When installed, the card should show "Installed" badge
    expect(screen.getByTestId('installed-badge')).toHaveTextContent('Installed');
  });

  it('shows install button for non-installed skills', () => {
    const skills = [makeSkill('s1', 'Alpha')];
    render(<GallerySkillGrid isLoading={false} skills={skills} installedIds={new Set()} />);
    expect(screen.getByTestId('install-button')).toBeInTheDocument();
  });
});

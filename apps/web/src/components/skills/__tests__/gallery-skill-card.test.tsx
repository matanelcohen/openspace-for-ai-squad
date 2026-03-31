import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the install hook so the component doesn't need a real mutation
const mockMutateAsync = vi.fn();
vi.mock('@/hooks/use-skill-gallery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-skill-gallery')>();
  return {
    ...actual,
    useInstallGallerySkill: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
  };
});

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { GallerySkillItem } from '@/hooks/use-skill-gallery';

import { GallerySkillCard } from '../gallery-skill-card';

const mockSkill: GallerySkillItem = {
  id: 'code-review',
  name: 'Code Review',
  description: 'Reviews code changes and provides feedback.',
  category: 'code-quality',
  tags: ['code', 'review', 'quality'],
  version: '1.2.0',
  author: 'openspace-team',
  installCount: 1234,
  featured: false,
  addedAt: Date.now(),
  updatedAt: Date.now(),
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({ success: true });
});

describe('GallerySkillCard', () => {
  it('renders skill name', () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    expect(screen.getByText('Code Review')).toBeInTheDocument();
  });

  it('renders skill description', () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    expect(
      screen.getByText('Reviews code changes and provides feedback.'),
    ).toBeInTheDocument();
  });

  it('renders skill version', () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
  });

  it('renders author', () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    expect(screen.getByText('by openspace-team')).toBeInTheDocument();
  });

  it('shows category badge', () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    expect(screen.getByTestId('category-badge')).toHaveTextContent('code-quality');
  });

  it('renders tags (max 3)', () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('review')).toBeInTheDocument();
    expect(screen.getByText('quality')).toBeInTheDocument();
  });

  it('shows +N overflow badge when more than 3 tags', () => {
    const skillManyTags: GallerySkillItem = {
      ...mockSkill,
      tags: ['code', 'review', 'quality', 'automation', 'ci'],
    };
    render(<GallerySkillCard skill={skillManyTags} />, { wrapper });
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('shows install count', () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    expect(screen.getByTestId('install-count')).toHaveTextContent('1,234');
  });

  it('shows "Featured" badge when skill.featured is true', () => {
    const featuredSkill: GallerySkillItem = { ...mockSkill, featured: true };
    render(<GallerySkillCard skill={featuredSkill} />, { wrapper });
    expect(screen.getByTestId('featured-badge')).toHaveTextContent('Featured');
  });

  it('does not show "Featured" badge when skill.featured is false', () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    expect(screen.queryByTestId('featured-badge')).not.toBeInTheDocument();
  });

  it('install button calls mutation when clicked', async () => {
    render(<GallerySkillCard skill={mockSkill} />, { wrapper });
    const btn = screen.getByTestId('install-button');
    await userEvent.click(btn);
    expect(mockMutateAsync).toHaveBeenCalledWith('code-review');
  });

  it('shows "Installed" state when isInstalled is true', () => {
    render(<GallerySkillCard skill={mockSkill} isInstalled />, { wrapper });
    expect(screen.getByTestId('installed-badge')).toHaveTextContent('Installed');
    expect(screen.queryByTestId('install-button')).not.toBeInTheDocument();
  });
});

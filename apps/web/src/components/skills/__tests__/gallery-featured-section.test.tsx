import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GallerySkillItem } from '@/hooks/use-skill-gallery';

// ── Mocks ──────────────────────────────────────────────────────────

const mockUseGalleryFeatured = vi.fn();
vi.mock('@/hooks/use-skill-gallery', () => ({
  useGalleryFeatured: (...args: unknown[]) => mockUseGalleryFeatured(...args),
  useInstallGallerySkill: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { GalleryFeaturedSection } from '../gallery-featured-section';

const skill = (id: string, name: string): GallerySkillItem => ({
  id,
  name,
  description: `${name} description`,
  category: 'code-quality',
  tags: ['test'],
  version: '1.0.0',
  installCount: 10,
  addedAt: Date.now(),
  updatedAt: Date.now(),
});

beforeEach(() => vi.clearAllMocks());

describe('GalleryFeaturedSection', () => {
  it('shows loading skeletons while fetching', () => {
    mockUseGalleryFeatured.mockReturnValue({ data: undefined, isLoading: true });
    render(<GalleryFeaturedSection />);
    expect(screen.getByTestId('gallery-featured-loading')).toBeInTheDocument();
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('renders nothing when skills array is empty', () => {
    mockUseGalleryFeatured.mockReturnValue({ data: { skills: [] }, isLoading: false });
    const { container } = render(<GalleryFeaturedSection />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when data is null', () => {
    mockUseGalleryFeatured.mockReturnValue({ data: null, isLoading: false });
    const { container } = render(<GalleryFeaturedSection />);
    expect(container.firstChild).toBeNull();
  });

  it('renders skill cards when data is present', () => {
    const skills = [skill('s1', 'Alpha'), skill('s2', 'Beta')];
    mockUseGalleryFeatured.mockReturnValue({ data: { skills }, isLoading: false });
    render(<GalleryFeaturedSection />);
    expect(screen.getByTestId('gallery-featured-section')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('passes installedIds to child cards', () => {
    const skills = [skill('s1', 'Alpha'), skill('s2', 'Beta')];
    mockUseGalleryFeatured.mockReturnValue({ data: { skills }, isLoading: false });
    render(<GalleryFeaturedSection installedIds={new Set(['s1'])} />);
    expect(screen.getByTestId('gallery-featured-section')).toBeInTheDocument();
  });

  it('calls useGalleryFeatured with limit 6', () => {
    mockUseGalleryFeatured.mockReturnValue({ data: undefined, isLoading: true });
    render(<GalleryFeaturedSection />);
    expect(mockUseGalleryFeatured).toHaveBeenCalledWith(6);
  });
});

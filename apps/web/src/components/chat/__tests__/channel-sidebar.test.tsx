import type { ChatChannel } from '@openspace/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ChannelSidebar,
  type ChannelCategory,
  type ChannelSidebarProps,
} from '@/components/chat/channel-sidebar';

// ── Mocks ───────────────────────────────────────────────────────────

// Mock useChannels hook
const mockChannelsData: { data: ChatChannel[]; isLoading: boolean; isError: boolean } = {
  data: [],
  isLoading: false,
  isError: false,
};

vi.mock('@/hooks/use-channels', () => ({
  useChannels: () => mockChannelsData,
}));

// Mock Next.js navigation
let mockPathname = '/chat';
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ── Polyfills for Radix UI ──────────────────────────────────────────

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  // Reset mock state between tests
  mockChannelsData.data = [];
  mockChannelsData.isLoading = false;
  mockChannelsData.isError = false;
  mockPathname = '/chat';
  mockSearchParams = new URLSearchParams();
});

// ── Fixtures ────────────────────────────────────────────────────────

const channels: ChatChannel[] = [
  {
    id: 'frontend',
    name: 'Frontend',
    description: 'Frontend team channel',
    memberAgentIds: ['fry', 'leela'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'backend',
    name: 'Backend',
    description: 'Backend team channel',
    memberAgentIds: ['bender'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Design discussions',
    memberAgentIds: ['fry'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'general',
    name: 'General',
    description: '',
    memberAgentIds: ['fry', 'leela', 'bender'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const categories: ChannelCategory[] = [
  { id: 'engineering', label: 'Engineering', channelIds: ['frontend', 'backend'] },
  { id: 'creative', label: 'Creative', channelIds: ['design'] },
];

function setChannels(chs: ChatChannel[]) {
  mockChannelsData.data = chs;
  mockChannelsData.isLoading = false;
  mockChannelsData.isError = false;
}

function renderSidebar(props: Partial<ChannelSidebarProps> = {}) {
  return render(<ChannelSidebar {...props} />);
}

// ── Tests ───────────────────────────────────────────────────────────

describe('ChannelSidebar', () => {
  // ── Loading state ───────────────────────────────────────────────

  describe('loading state', () => {
    it('renders skeleton placeholders while loading', () => {
      mockChannelsData.isLoading = true;
      renderSidebar();
      expect(screen.getByTestId('channel-sidebar-loading')).toBeInTheDocument();
    });

    it('does not render channels while loading', () => {
      mockChannelsData.isLoading = true;
      setChannels(channels);
      mockChannelsData.isLoading = true;
      renderSidebar();
      expect(screen.queryByTestId('channel-item-frontend')).not.toBeInTheDocument();
    });
  });

  // ── Error state ─────────────────────────────────────────────────

  describe('error state', () => {
    it('renders error message on fetch failure', () => {
      mockChannelsData.isError = true;
      renderSidebar();
      expect(screen.getByTestId('channel-sidebar-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load channels')).toBeInTheDocument();
    });
  });

  // ── Empty state ─────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders empty message when no channels exist', () => {
      setChannels([]);
      renderSidebar();
      expect(screen.getByTestId('channel-sidebar-empty')).toBeInTheDocument();
      expect(screen.getByText('No channels yet')).toBeInTheDocument();
    });
  });

  // ── Channel list (no categories) ───────────────────────────────

  describe('channel list without categories', () => {
    it('renders all channels under a single "Channels" section', () => {
      setChannels(channels);
      renderSidebar();
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('Backend')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    it('renders default "Channels" section label', () => {
      setChannels(channels);
      renderSidebar();
      // Section trigger has the label
      expect(screen.getByTestId('channel-section-trigger-_all')).toBeInTheDocument();
    });

    it('renders each channel with a hash icon and name', () => {
      setChannels(channels);
      renderSidebar();
      expect(screen.getByTestId('channel-item-frontend')).toBeInTheDocument();
      expect(screen.getByTestId('channel-item-backend')).toBeInTheDocument();
    });
  });

  // ── Categories ─────────────────────────────────────────────────

  describe('channel categories', () => {
    it('groups channels into category sections', () => {
      setChannels(channels);
      renderSidebar({ categories });
      expect(screen.getByTestId('channel-section-engineering')).toBeInTheDocument();
      expect(screen.getByTestId('channel-section-creative')).toBeInTheDocument();
    });

    it('renders section labels', () => {
      setChannels(channels);
      renderSidebar({ categories });
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Creative')).toBeInTheDocument();
    });

    it('places uncategorised channels in "Other" section', () => {
      setChannels(channels);
      renderSidebar({ categories });
      // "general" is not in any category → goes to "Other"
      expect(screen.getByTestId('channel-section-_other')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('collapses section when trigger is clicked', () => {
      setChannels(channels);
      renderSidebar({ categories });
      const trigger = screen.getByTestId('channel-section-trigger-engineering');
      // Channels should be visible initially
      expect(screen.getByTestId('channel-item-frontend')).toBeInTheDocument();
      // Click to collapse
      fireEvent.click(trigger);
      // Channels should be hidden after collapsing
      expect(screen.queryByTestId('channel-item-frontend')).not.toBeInTheDocument();
    });

    it('re-expands collapsed section on second click', () => {
      setChannels(channels);
      renderSidebar({ categories });
      const trigger = screen.getByTestId('channel-section-trigger-engineering');
      fireEvent.click(trigger); // collapse
      fireEvent.click(trigger); // expand
      expect(screen.getByTestId('channel-item-frontend')).toBeInTheDocument();
    });
  });

  // ── Active channel highlighting ────────────────────────────────

  describe('active channel', () => {
    it('highlights channel matching activeChannelId prop', () => {
      setChannels(channels);
      renderSidebar({ activeChannelId: 'frontend' });
      const item = screen.getByTestId('channel-item-frontend');
      expect(item.className).toContain('bg-accent');
    });

    it('highlights channel from URL search param when no prop given', () => {
      setChannels(channels);
      mockSearchParams = new URLSearchParams('channel=backend');
      renderSidebar();
      const item = screen.getByTestId('channel-item-backend');
      expect(item.className).toContain('bg-accent');
    });

    it('prop overrides URL search param', () => {
      setChannels(channels);
      mockSearchParams = new URLSearchParams('channel=backend');
      renderSidebar({ activeChannelId: 'frontend' });
      const frontendItem = screen.getByTestId('channel-item-frontend');
      const backendItem = screen.getByTestId('channel-item-backend');
      expect(frontendItem.className).toContain('bg-accent');
      // Use split to avoid matching "hover:bg-accent" from ghost variant
      expect(backendItem.className.split(' ')).not.toContain('bg-accent');
    });

    it('sets aria-current="page" on the active channel link', () => {
      setChannels(channels);
      renderSidebar({ activeChannelId: 'frontend' });
      // With asChild, Button's Slot merges props onto the Link/<a>, so the
      // data-testid element IS the <a> — no need to querySelector.
      const item = screen.getByTestId('channel-item-frontend');
      expect(item).toHaveAttribute('aria-current', 'page');
    });

    it('does not set aria-current on inactive channels', () => {
      setChannels(channels);
      renderSidebar({ activeChannelId: 'frontend' });
      const item = screen.getByTestId('channel-item-backend');
      expect(item).not.toHaveAttribute('aria-current');
    });
  });

  // ── Unread indicators ──────────────────────────────────────────

  describe('unread indicators', () => {
    it('shows unread badge on channels with unreads', () => {
      setChannels(channels);
      renderSidebar({ unreadCounts: { frontend: 3 } });
      expect(screen.getByTestId('channel-unread-frontend')).toBeInTheDocument();
      expect(screen.getByTestId('channel-unread-frontend')).toHaveTextContent('3');
    });

    it('does not show unread badge for zero-count channels', () => {
      setChannels(channels);
      renderSidebar({ unreadCounts: { frontend: 0 } });
      expect(screen.queryByTestId('channel-unread-frontend')).not.toBeInTheDocument();
    });

    it('shows total unread badge in header', () => {
      setChannels(channels);
      renderSidebar({ unreadCounts: { frontend: 3, backend: 5 } });
      expect(screen.getByTestId('total-unread-badge')).toBeInTheDocument();
      expect(screen.getByTestId('total-unread-badge')).toHaveTextContent('8');
    });

    it('hides total badge when all counts are zero', () => {
      setChannels(channels);
      renderSidebar({ unreadCounts: {} });
      expect(screen.queryByTestId('total-unread-badge')).not.toBeInTheDocument();
    });

    it('applies font-medium to unread inactive channels', () => {
      setChannels(channels);
      renderSidebar({ unreadCounts: { backend: 2 }, activeChannelId: 'frontend' });
      const item = screen.getByTestId('channel-item-backend');
      expect(item.className).toContain('font-medium');
    });

    it('shows section-level unread badge in category header', () => {
      setChannels(channels);
      renderSidebar({
        categories,
        unreadCounts: { frontend: 2, backend: 1 },
      });
      expect(screen.getByTestId('section-unread-engineering')).toBeInTheDocument();
      expect(screen.getByTestId('section-unread-engineering')).toHaveTextContent('3');
    });
  });

  // ── Navigation / channel selection ─────────────────────────────

  describe('navigation', () => {
    it('renders links with correct href (pathname + channel query param)', () => {
      setChannels(channels);
      mockPathname = '/chat';
      renderSidebar();
      // With asChild, the data-testid element IS the rendered <a> tag
      const item = screen.getByTestId('channel-item-frontend');
      expect(item).toHaveAttribute('href', '/chat?channel=frontend');
    });

    it('calls onChannelSelect when channel is clicked', () => {
      setChannels(channels);
      const onSelect = vi.fn();
      renderSidebar({ onChannelSelect: onSelect });
      const item = screen.getByTestId('channel-item-frontend');
      fireEvent.click(item);
      expect(onSelect).toHaveBeenCalledWith('frontend');
    });
  });

  // ── Create channel button ──────────────────────────────────────

  describe('create channel button', () => {
    it('shows create button when onCreateChannel is provided', () => {
      setChannels(channels);
      renderSidebar({ onCreateChannel: vi.fn() });
      expect(screen.getByTestId('channel-sidebar-create-btn')).toBeInTheDocument();
    });

    it('hides create button when onCreateChannel is not provided', () => {
      setChannels(channels);
      renderSidebar();
      expect(screen.queryByTestId('channel-sidebar-create-btn')).not.toBeInTheDocument();
    });

    it('calls onCreateChannel when button is clicked', () => {
      setChannels(channels);
      const onCreate = vi.fn();
      renderSidebar({ onCreateChannel: onCreate });
      fireEvent.click(screen.getByTestId('channel-sidebar-create-btn'));
      expect(onCreate).toHaveBeenCalledOnce();
    });
  });

  // ── Accessibility ──────────────────────────────────────────────

  describe('accessibility', () => {
    it('renders navigation landmark with label', () => {
      setChannels(channels);
      renderSidebar();
      const nav = screen.getByRole('navigation', { name: 'Channel list' });
      expect(nav).toBeInTheDocument();
    });

    it('create button has accessible label', () => {
      setChannels(channels);
      renderSidebar({ onCreateChannel: vi.fn() });
      expect(screen.getByLabelText('Create channel')).toBeInTheDocument();
    });
  });

  // ── Custom className ───────────────────────────────────────────

  describe('className prop', () => {
    it('applies custom className to root element', () => {
      setChannels(channels);
      renderSidebar({ className: 'my-custom-class' });
      const root = screen.getByTestId('channel-sidebar');
      expect(root.className).toContain('my-custom-class');
    });
  });
});

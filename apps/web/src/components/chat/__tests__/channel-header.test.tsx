import type { Agent, ChatChannel } from '@openspace/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ChannelHeader, type ChannelHeaderProps } from '@/components/chat/channel-header';

// ── Polyfills for Radix UI ──────────────────────────────────────────

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // PointerEvent stub for Radix dropdown menu
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init?: PointerEventInit & { pointerId?: number }) {
        super(type, init);
        this.pointerId = init?.pointerId ?? 0;
      }
    }
    (window as unknown as Record<string, unknown>).PointerEvent = PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

// ── Fixtures ────────────────────────────────────────────────────────

const channel: ChatChannel = {
  id: 'frontend',
  name: 'Frontend',
  description: 'Frontend team channel',
  memberAgentIds: ['fry', 'leela'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const channelNoDescription: ChatChannel = {
  ...channel,
  id: 'backend',
  name: 'Backend',
  description: '',
  memberAgentIds: [],
};

const agents: Agent[] = [
  {
    id: 'fry',
    name: 'Fry',
    role: 'Frontend',
    status: 'active',
    currentTask: null,
    expertise: ['react', 'css'],
    voiceProfile: { agentId: 'fry', displayName: 'Fry', voiceId: 'v1', personality: 'enthusiastic' },
  },
  {
    id: 'leela',
    name: 'Leela',
    role: 'Lead',
    status: 'active',
    currentTask: null,
    expertise: ['leadership'],
    voiceProfile: { agentId: 'leela', displayName: 'Leela', voiceId: 'v2', personality: 'decisive' },
  },
  {
    id: 'bender',
    name: 'Bender',
    role: 'Backend',
    status: 'idle',
    currentTask: null,
    expertise: ['node'],
    voiceProfile: { agentId: 'bender', displayName: 'Bender', voiceId: 'v3', personality: 'sarcastic' },
  },
];

const manyMemberChannel: ChatChannel = {
  ...channel,
  id: 'large',
  name: 'Large Channel',
  memberAgentIds: ['fry', 'leela', 'bender', 'a4', 'a5', 'a6', 'a7'],
};

const manyAgents: Agent[] = [
  ...agents,
  { id: 'a4', name: 'Agent4', role: 'QA', status: 'idle', currentTask: null, expertise: [], voiceProfile: { agentId: 'a4', displayName: 'Agent4', voiceId: 'v4', personality: 'thorough' } },
  { id: 'a5', name: 'Agent5', role: 'QA', status: 'idle', currentTask: null, expertise: [], voiceProfile: { agentId: 'a5', displayName: 'Agent5', voiceId: 'v5', personality: 'thorough' } },
  { id: 'a6', name: 'Agent6', role: 'QA', status: 'idle', currentTask: null, expertise: [], voiceProfile: { agentId: 'a6', displayName: 'Agent6', voiceId: 'v6', personality: 'thorough' } },
  { id: 'a7', name: 'Agent7', role: 'QA', status: 'idle', currentTask: null, expertise: [], voiceProfile: { agentId: 'a7', displayName: 'Agent7', voiceId: 'v7', personality: 'thorough' } },
];

function renderHeader(props: Partial<ChannelHeaderProps> = {}) {
  return render(<ChannelHeader channel={channel} {...props} />);
}

// ── Tests ───────────────────────────────────────────────────────────

describe('ChannelHeader', () => {
  // ── Basic rendering ────────────────────────────────────────────

  describe('basic rendering', () => {
    it('renders the header element', () => {
      renderHeader();
      expect(screen.getByTestId('channel-header')).toBeInTheDocument();
    });

    it('renders the channel name', () => {
      renderHeader();
      expect(screen.getByTestId('channel-header-name')).toHaveTextContent('Frontend');
    });

    it('renders the hash icon', () => {
      renderHeader();
      expect(screen.getByTestId('channel-header-hash')).toBeInTheDocument();
    });

    it('renders the channel description when present', () => {
      renderHeader();
      expect(screen.getByTestId('channel-header-description')).toHaveTextContent(
        'Frontend team channel',
      );
    });

    it('hides description when empty', () => {
      renderHeader({ channel: channelNoDescription });
      expect(screen.queryByTestId('channel-header-description')).not.toBeInTheDocument();
    });
  });

  // ── Member avatars ─────────────────────────────────────────────

  describe('member avatars', () => {
    it('renders member avatars when agents are provided', () => {
      renderHeader({ agents });
      expect(screen.getByTestId('channel-header-members')).toBeInTheDocument();
      expect(screen.getByTestId('channel-member-avatar-fry')).toBeInTheDocument();
      expect(screen.getByTestId('channel-member-avatar-leela')).toBeInTheDocument();
    });

    it('shows member count', () => {
      renderHeader({ agents });
      expect(screen.getByTestId('channel-header-member-count')).toHaveTextContent('2');
    });

    it('hides members section when no agents are resolved', () => {
      renderHeader({ channel: channelNoDescription });
      expect(screen.queryByTestId('channel-header-members')).not.toBeInTheDocument();
    });

    it('shows overflow badge when members exceed limit', () => {
      renderHeader({ channel: manyMemberChannel, agents: manyAgents });
      expect(screen.getByTestId('channel-header-overflow')).toHaveTextContent('+2');
    });

    it('displays total member count including overflow', () => {
      renderHeader({ channel: manyMemberChannel, agents: manyAgents });
      expect(screen.getByTestId('channel-header-member-count')).toHaveTextContent('7');
    });
  });

  // ── Back button ────────────────────────────────────────────────

  describe('back button', () => {
    it('shows back button when onBack is provided', () => {
      renderHeader({ onBack: vi.fn() });
      expect(screen.getByTestId('channel-header-back')).toBeInTheDocument();
    });

    it('hides back button when onBack is not provided', () => {
      renderHeader();
      expect(screen.queryByTestId('channel-header-back')).not.toBeInTheDocument();
    });

    it('calls onBack when clicked', () => {
      const onBack = vi.fn();
      renderHeader({ onBack });
      fireEvent.click(screen.getByTestId('channel-header-back'));
      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  // ── Settings actions ───────────────────────────────────────────

  describe('settings dropdown', () => {
    it('shows settings button when onEdit is provided', () => {
      renderHeader({ onEdit: vi.fn() });
      expect(screen.getByTestId('channel-header-settings')).toBeInTheDocument();
    });

    it('shows settings button when onDelete is provided', () => {
      renderHeader({ onDelete: vi.fn() });
      expect(screen.getByTestId('channel-header-settings')).toBeInTheDocument();
    });

    it('hides settings button when neither onEdit nor onDelete is provided', () => {
      renderHeader();
      expect(screen.queryByTestId('channel-header-settings')).not.toBeInTheDocument();
    });
  });

  // ── Custom actions slot ────────────────────────────────────────

  describe('custom actions', () => {
    it('renders custom actions slot', () => {
      renderHeader({
        actions: <button data-testid="custom-action">Voice</button>,
      });
      expect(screen.getByTestId('custom-action')).toBeInTheDocument();
    });
  });

  // ── Custom className ───────────────────────────────────────────

  describe('className prop', () => {
    it('applies custom className to root element', () => {
      renderHeader({ className: 'my-custom-class' });
      const root = screen.getByTestId('channel-header');
      expect(root.className).toContain('my-custom-class');
    });
  });

  // ── Accessibility ──────────────────────────────────────────────

  describe('accessibility', () => {
    it('back button has accessible label', () => {
      renderHeader({ onBack: vi.fn() });
      expect(screen.getByLabelText('Back to channels')).toBeInTheDocument();
    });

    it('settings button has accessible label', () => {
      renderHeader({ onEdit: vi.fn() });
      expect(screen.getByLabelText('Channel settings')).toBeInTheDocument();
    });
  });
});

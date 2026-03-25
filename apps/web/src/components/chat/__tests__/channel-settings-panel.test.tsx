import type { Agent, ChatChannel } from '@openspace/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ChannelSettingsPanel,
  type ChannelSettingsPanelProps,
} from '@/components/chat/channel-settings-panel';

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
});

// ── Fixtures ────────────────────────────────────────────────────────

const channel: ChatChannel = {
  id: 'frontend',
  name: 'Frontend',
  description: 'Frontend team channel',
  memberAgentIds: ['fry', 'leela'],
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-06-20T14:00:00Z',
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
    voiceProfile: {
      agentId: 'fry',
      displayName: 'Fry',
      voiceId: 'v1',
      personality: 'enthusiastic',
    },
  },
  {
    id: 'leela',
    name: 'Leela',
    role: 'Lead',
    status: 'active',
    currentTask: null,
    expertise: ['leadership'],
    voiceProfile: {
      agentId: 'leela',
      displayName: 'Leela',
      voiceId: 'v2',
      personality: 'decisive',
    },
  },
  {
    id: 'bender',
    name: 'Bender',
    role: 'Backend',
    status: 'idle',
    currentTask: null,
    expertise: ['node'],
    voiceProfile: {
      agentId: 'bender',
      displayName: 'Bender',
      voiceId: 'v3',
      personality: 'sarcastic',
    },
  },
];

function renderPanel(props: Partial<ChannelSettingsPanelProps> = {}) {
  const defaultProps: ChannelSettingsPanelProps = {
    channel,
    agents,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    ...props,
  };
  return render(<ChannelSettingsPanel {...defaultProps} />);
}

// ── Tests ───────────────────────────────────────────────────────────

describe('ChannelSettingsPanel', () => {
  // ── Basic rendering ────────────────────────────────────────────

  describe('basic rendering', () => {
    it('renders the panel', () => {
      renderPanel();
      expect(screen.getByTestId('channel-settings-panel')).toBeInTheDocument();
    });

    it('renders the title', () => {
      renderPanel();
      expect(screen.getByTestId('settings-panel-title')).toHaveTextContent('Channel Settings');
    });

    it('renders the close button', () => {
      renderPanel();
      expect(screen.getByTestId('settings-panel-close')).toBeInTheDocument();
    });

    it('displays the channel name in read mode', () => {
      renderPanel();
      expect(screen.getByTestId('settings-channel-name')).toHaveTextContent('Frontend');
    });

    it('displays the channel description in read mode', () => {
      renderPanel();
      expect(screen.getByTestId('settings-channel-description')).toHaveTextContent(
        'Frontend team channel',
      );
    });

    it('shows "No description" when description is empty', () => {
      renderPanel({ channel: channelNoDescription });
      expect(screen.getByTestId('settings-channel-description')).toHaveTextContent(
        'No description',
      );
    });

    it('renders member list in read mode', () => {
      renderPanel();
      expect(screen.getByTestId('settings-member-list')).toBeInTheDocument();
      expect(screen.getByTestId('settings-member-fry')).toBeInTheDocument();
      expect(screen.getByTestId('settings-member-leela')).toBeInTheDocument();
    });

    it('shows "No members" when channel has no resolved members', () => {
      renderPanel({ channel: channelNoDescription });
      expect(screen.getByTestId('settings-no-members')).toHaveTextContent('No members');
    });

    it('displays member count badge', () => {
      renderPanel();
      expect(screen.getByTestId('settings-member-count')).toHaveTextContent('2');
    });

    it('displays created and updated timestamps', () => {
      renderPanel();
      expect(screen.getByTestId('settings-created-at')).toBeInTheDocument();
      expect(screen.getByTestId('settings-updated-at')).toBeInTheDocument();
    });
  });

  // ── Close button ───────────────────────────────────────────────

  describe('close button', () => {
    it('calls onClose when clicked', () => {
      const onClose = vi.fn();
      renderPanel({ onClose });
      fireEvent.click(screen.getByTestId('settings-panel-close'));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ── Edit mode ─────────────────────────────────────────────────

  describe('edit mode', () => {
    it('enters edit mode when edit button is clicked', () => {
      renderPanel();
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      expect(screen.getByTestId('settings-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('settings-description-input')).toBeInTheDocument();
      expect(screen.getByTestId('settings-member-picker')).toBeInTheDocument();
    });

    it('shows save and cancel buttons in edit mode', () => {
      renderPanel();
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      expect(screen.getByTestId('settings-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('settings-cancel-btn')).toBeInTheDocument();
    });

    it('pre-fills inputs with current channel values', () => {
      renderPanel();
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      expect(screen.getByTestId('settings-name-input')).toHaveValue('Frontend');
      expect(screen.getByTestId('settings-description-input')).toHaveValue('Frontend team channel');
    });

    it('allows editing the channel name', () => {
      renderPanel();
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      const input = screen.getByTestId('settings-name-input');
      fireEvent.change(input, { target: { value: 'Frontend V2' } });
      expect(input).toHaveValue('Frontend V2');
    });

    it('disables save when name is empty', () => {
      renderPanel();
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      fireEvent.change(screen.getByTestId('settings-name-input'), { target: { value: '' } });
      expect(screen.getByTestId('settings-save-btn')).toBeDisabled();
    });

    it('reverts changes on cancel', () => {
      renderPanel();
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      fireEvent.change(screen.getByTestId('settings-name-input'), {
        target: { value: 'Changed' },
      });
      fireEvent.click(screen.getByTestId('settings-cancel-btn'));
      // Should be back to read mode with original name
      expect(screen.getByTestId('settings-channel-name')).toHaveTextContent('Frontend');
    });

    it('calls onSave with updated data', () => {
      const onSave = vi.fn();
      renderPanel({ onSave });
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      fireEvent.change(screen.getByTestId('settings-name-input'), {
        target: { value: 'Frontend V2' },
      });
      fireEvent.change(screen.getByTestId('settings-description-input'), {
        target: { value: 'Updated description' },
      });
      fireEvent.click(screen.getByTestId('settings-save-btn'));
      expect(onSave).toHaveBeenCalledWith({
        name: 'Frontend V2',
        description: 'Updated description',
        memberAgentIds: ['fry', 'leela'],
      });
    });
  });

  // ── Member management in edit mode ─────────────────────────────

  describe('member management', () => {
    it('shows all agents in member picker when editing', () => {
      renderPanel();
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      expect(screen.getByTestId('settings-member-toggle-fry')).toBeInTheDocument();
      expect(screen.getByTestId('settings-member-toggle-leela')).toBeInTheDocument();
      expect(screen.getByTestId('settings-member-toggle-bender')).toBeInTheDocument();
    });

    it('toggles member selection', () => {
      const onSave = vi.fn();
      renderPanel({ onSave });
      fireEvent.click(screen.getByTestId('settings-edit-btn'));

      // Add bender
      fireEvent.click(screen.getByTestId('settings-member-toggle-bender'));
      fireEvent.click(screen.getByTestId('settings-save-btn'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          memberAgentIds: expect.arrayContaining(['fry', 'leela', 'bender']),
        }),
      );
    });

    it('removes a member by toggling', () => {
      const onSave = vi.fn();
      renderPanel({ onSave });
      fireEvent.click(screen.getByTestId('settings-edit-btn'));

      // Remove leela
      fireEvent.click(screen.getByTestId('settings-member-toggle-leela'));
      fireEvent.click(screen.getByTestId('settings-save-btn'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          memberAgentIds: ['fry'],
        }),
      );
    });
  });

  // ── Delete action ──────────────────────────────────────────────

  describe('delete action', () => {
    it('renders delete button when onDelete is provided', () => {
      renderPanel();
      expect(screen.getByTestId('settings-delete-btn')).toBeInTheDocument();
    });

    it('hides delete button when onDelete is not provided', () => {
      renderPanel({ onDelete: undefined });
      expect(screen.queryByTestId('settings-delete-btn')).not.toBeInTheDocument();
    });

    it('calls onDelete when delete button is clicked', () => {
      const onDelete = vi.fn();
      renderPanel({ onDelete });
      fireEvent.click(screen.getByTestId('settings-delete-btn'));
      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  // ── Edit button visibility ─────────────────────────────────────

  describe('edit button visibility', () => {
    it('shows edit button when onSave is provided', () => {
      renderPanel();
      expect(screen.getByTestId('settings-edit-btn')).toBeInTheDocument();
    });

    it('hides edit button when onSave is not provided', () => {
      renderPanel({ onSave: undefined });
      expect(screen.queryByTestId('settings-edit-btn')).not.toBeInTheDocument();
    });
  });

  // ── Saving state ───────────────────────────────────────────────

  describe('saving state', () => {
    it('disables inputs when isSaving is true', () => {
      renderPanel({ isSaving: true });
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      expect(screen.getByTestId('settings-name-input')).toBeDisabled();
      expect(screen.getByTestId('settings-description-input')).toBeDisabled();
    });

    it('shows "Saving…" text on save button when saving', () => {
      renderPanel({ isSaving: true });
      fireEvent.click(screen.getByTestId('settings-edit-btn'));
      // Change name to enable save button
      fireEvent.change(screen.getByTestId('settings-name-input'), {
        target: { value: 'Changed' },
      });
      expect(screen.getByTestId('settings-save-btn')).toHaveTextContent('Saving…');
    });
  });

  // ── Accessibility ──────────────────────────────────────────────

  describe('accessibility', () => {
    it('close button has accessible label', () => {
      renderPanel();
      expect(screen.getByLabelText('Close settings')).toBeInTheDocument();
    });
  });

  // ── className prop ─────────────────────────────────────────────

  describe('className prop', () => {
    it('applies custom className to root element', () => {
      renderPanel({ className: 'my-custom-class' });
      const root = screen.getByTestId('channel-settings-panel');
      expect(root.className).toContain('my-custom-class');
    });
  });
});

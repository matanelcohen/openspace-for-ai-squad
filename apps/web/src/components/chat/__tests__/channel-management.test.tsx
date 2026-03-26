import type { Agent, ChatChannel } from '@openspace/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ChannelDialog } from '@/components/chat/channel-dialog';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { DeleteChannelDialog } from '@/components/chat/delete-channel-dialog';

// Polyfills required for Radix UI in jsdom
beforeAll(() => {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props);
      this.pointerId = props.pointerId ?? 0;
      this.pointerType = props.pointerType ?? '';
    }
  } as unknown as typeof PointerEvent;

  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockAgents: Agent[] = [
  {
    id: 'leela',
    name: 'Leela',
    role: 'Lead',
    status: 'active',
    currentTask: null,
    expertise: [],
    voiceProfile: { agentId: 'leela', displayName: 'Leela', voiceId: 'leela-v1', personality: '' },
  },
  {
    id: 'bender',
    name: 'Bender',
    role: 'Backend',
    status: 'idle',
    currentTask: null,
    expertise: [],
    voiceProfile: {
      agentId: 'bender',
      displayName: 'Bender',
      voiceId: 'bender-v1',
      personality: '',
    },
  },
  {
    id: 'fry',
    name: 'Fry',
    role: 'Frontend',
    status: 'active',
    currentTask: null,
    expertise: [],
    voiceProfile: { agentId: 'fry', displayName: 'Fry', voiceId: 'fry-v1', personality: '' },
  },
];

const mockChannel: ChatChannel = {
  id: 'ch-1',
  name: 'Frontend',
  description: 'Frontend discussion',
  memberAgentIds: ['leela', 'fry'],
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const mockChannels: ChatChannel[] = [
  mockChannel,
  {
    id: 'ch-2',
    name: 'Backend',
    description: 'Backend discussion',
    memberAgentIds: ['bender'],
    createdAt: '2024-01-15T11:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// ChannelDialog
// ---------------------------------------------------------------------------

describe('ChannelDialog', () => {
  it('renders in create mode with empty fields', () => {
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        agents={mockAgents}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('channel-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('channel-name-input')).toHaveValue('');
    expect(screen.getByTestId('channel-description-input')).toHaveValue('');
    expect(screen.getByTestId('channel-dialog-save')).toHaveTextContent('Create Channel');
  });

  it('renders in edit mode with pre-filled fields', () => {
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        channel={mockChannel}
        agents={mockAgents}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Edit Channel')).toBeInTheDocument();
    expect(screen.getByTestId('channel-name-input')).toHaveValue('Frontend');
    expect(screen.getByTestId('channel-description-input')).toHaveValue('Frontend discussion');
  });

  it('shows member picker with all agents', () => {
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        agents={mockAgents}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId('channel-member-picker')).toBeInTheDocument();
    expect(screen.getByTestId('member-toggle-leela')).toBeInTheDocument();
    expect(screen.getByTestId('member-toggle-bender')).toBeInTheDocument();
    expect(screen.getByTestId('member-toggle-fry')).toBeInTheDocument();
  });

  it('pre-selects members in edit mode', () => {
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        channel={mockChannel}
        agents={mockAgents}
        onSave={vi.fn()}
      />,
    );
    // mockChannel has memberAgentIds: ['leela', 'fry']
    // The badge should show "2" for selected members
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('toggles member selection when clicked', () => {
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        agents={mockAgents}
        onSave={vi.fn()}
      />,
    );
    // Initially 0 members selected
    expect(screen.getByText('0')).toBeInTheDocument();

    // Click to select Leela
    fireEvent.click(screen.getByTestId('member-toggle-leela'));
    expect(screen.getByText('1')).toBeInTheDocument();

    // Click again to deselect Leela
    fireEvent.click(screen.getByTestId('member-toggle-leela'));
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('calls onSave with form data on submit', () => {
    const onSave = vi.fn();
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        agents={mockAgents}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByTestId('channel-name-input'), {
      target: { value: 'Design Team' },
    });
    fireEvent.change(screen.getByTestId('channel-description-input'), {
      target: { value: 'Design discussions' },
    });
    fireEvent.click(screen.getByTestId('member-toggle-leela'));
    fireEvent.click(screen.getByTestId('channel-dialog-save'));

    expect(onSave).toHaveBeenCalledWith({
      name: 'Design Team',
      description: 'Design discussions',
      memberAgentIds: ['leela'],
    });
  });

  it('does not submit when name is empty', () => {
    const onSave = vi.fn();
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        agents={mockAgents}
        onSave={onSave}
      />,
    );

    // Save button should be disabled when name is empty
    expect(screen.getByTestId('channel-dialog-save')).toBeDisabled();
  });

  it('disables inputs when isSaving is true', () => {
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        agents={mockAgents}
        onSave={vi.fn()}
        isSaving={true}
      />,
    );
    expect(screen.getByTestId('channel-name-input')).toBeDisabled();
    expect(screen.getByTestId('channel-description-input')).toBeDisabled();
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('calls onOpenChange when cancel is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <ChannelDialog
        open={true}
        onOpenChange={onOpenChange}
        agents={mockAgents}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('channel-dialog-cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows empty agent message when no agents available', () => {
    render(
      <ChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        agents={[]}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('No agents available')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DeleteChannelDialog
// ---------------------------------------------------------------------------

describe('DeleteChannelDialog', () => {
  it('renders channel name in confirmation message', () => {
    render(
      <DeleteChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        channel={mockChannel}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId('delete-channel-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Frontend/)).toBeInTheDocument();
    expect(screen.getByText(/permanently remove the channel/)).toBeInTheDocument();
  });

  it('calls onConfirm when delete button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        channel={mockChannel}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByTestId('delete-channel-confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onOpenChange when cancel is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <DeleteChannelDialog
        open={true}
        onOpenChange={onOpenChange}
        channel={mockChannel}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('delete-channel-cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows loading state when isDeleting is true', () => {
    render(
      <DeleteChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        channel={mockChannel}
        onConfirm={vi.fn()}
        isDeleting={true}
      />,
    );
    expect(screen.getByText('Deleting…')).toBeInTheDocument();
    expect(screen.getByTestId('delete-channel-confirm')).toBeDisabled();
    expect(screen.getByTestId('delete-channel-cancel')).toBeDisabled();
  });

  it('shows default delete text when not deleting', () => {
    render(
      <DeleteChannelDialog
        open={true}
        onOpenChange={vi.fn()}
        channel={mockChannel}
        onConfirm={vi.fn()}
        isDeleting={false}
      />,
    );
    expect(screen.getByText('Delete Channel')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(
      <DeleteChannelDialog
        open={false}
        onOpenChange={vi.fn()}
        channel={mockChannel}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('delete-channel-dialog')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ChatSidebar — Channel Management
// ---------------------------------------------------------------------------

describe('ChatSidebar — Channel Management', () => {
  it('renders custom channels when provided', () => {
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={vi.fn()}
        channels={mockChannels}
      />,
    );
    expect(screen.getByTestId('channel-custom-ch-1')).toBeInTheDocument();
    expect(screen.getByText('Frontend discussion')).toBeInTheDocument();
    expect(screen.getByTestId('channel-custom-ch-2')).toBeInTheDocument();
    expect(screen.getByText('Backend discussion')).toBeInTheDocument();
  });

  it('selects a custom channel when clicked', () => {
    const onSelect = vi.fn();
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={onSelect}
        channels={mockChannels}
      />,
    );
    fireEvent.click(screen.getByTestId('channel-custom-ch-1'));
    expect(onSelect).toHaveBeenCalledWith('channel:ch-1');
  });

  it('highlights active custom channel', () => {
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="channel:ch-1"
        onSelectChannel={vi.fn()}
        channels={mockChannels}
      />,
    );
    const channelBtn = screen.getByTestId('channel-custom-ch-1');
    // The parent wrapper div has bg-accent
    expect(channelBtn.closest('[class*="bg-accent"]')).toBeTruthy();
  });

  it('renders create channel button when callback is provided', () => {
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={vi.fn()}
        channels={[]}
        onCreateChannel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('create-channel-btn')).toBeInTheDocument();
  });

  it('calls onCreateChannel when create button is clicked', () => {
    const onCreate = vi.fn();
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={vi.fn()}
        channels={[]}
        onCreateChannel={onCreate}
      />,
    );
    fireEvent.click(screen.getByTestId('create-channel-btn'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('shows channel context menu with edit and delete options', async () => {
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={vi.fn()}
        channels={mockChannels}
        onEditChannel={vi.fn()}
        onDeleteChannel={vi.fn()}
      />,
    );
    // Open the channel menu
    fireEvent.pointerDown(screen.getByTestId('channel-menu-ch-1'), {
      button: 0,
      pointerType: 'mouse',
    });
    expect(await screen.findByTestId('edit-channel-ch-1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-channel-ch-1')).toBeInTheDocument();
  });

  it('calls onEditChannel when edit option is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={vi.fn()}
        channels={mockChannels}
        onEditChannel={onEdit}
        onDeleteChannel={vi.fn()}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId('channel-menu-ch-1'), {
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.click(await screen.findByTestId('edit-channel-ch-1'));
    expect(onEdit).toHaveBeenCalledWith(mockChannels[0]);
  });

  it('calls onDeleteChannel when delete option is clicked', async () => {
    const onDelete = vi.fn();
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={vi.fn()}
        channels={mockChannels}
        onEditChannel={vi.fn()}
        onDeleteChannel={onDelete}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId('channel-menu-ch-1'), {
      button: 0,
      pointerType: 'mouse',
    });
    fireEvent.click(await screen.findByTestId('delete-channel-ch-1'));
    expect(onDelete).toHaveBeenCalledWith(mockChannels[0]);
  });

  it('does not show channel menu when no edit/delete callbacks provided', () => {
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={vi.fn()}
        channels={mockChannels}
      />,
    );
    expect(screen.queryByTestId('channel-menu-ch-1')).not.toBeInTheDocument();
  });

  it('does not show channels section when no channels and no create callback', () => {
    render(
      <ChatSidebar
        agents={mockAgents}
        selectedChannel="team"
        onSelectChannel={vi.fn()}
        channels={[]}
      />,
    );
    expect(screen.queryByTestId('create-channel-btn')).not.toBeInTheDocument();
  });
});

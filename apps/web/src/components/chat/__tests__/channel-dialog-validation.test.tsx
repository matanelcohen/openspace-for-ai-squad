import type { Agent, ChatChannel } from '@openspace/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ChannelDialog } from '@/components/chat/channel-dialog';

// ── Polyfills for Radix UI in jsdom ─────────────────────────────────

beforeAll(() => {
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

// ── Fixtures ────────────────────────────────────────────────────────

const agents: Agent[] = [
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
    voiceProfile: { agentId: 'bender', displayName: 'Bender', voiceId: 'bender-v1', personality: '' },
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

const existingChannel: ChatChannel = {
  id: 'ch-existing',
  name: 'Backend',
  description: 'Backend discussions',
  memberAgentIds: ['bender'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ── Tests ───────────────────────────────────────────────────────────

describe('ChannelDialog — form validation edge cases', () => {
  // ── Name validation ──────────────────────────────────────────────

  describe('name validation', () => {
    it('disables save when name is whitespace-only', () => {
      const onSave = vi.fn();
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={onSave} />,
      );
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: '   ' },
      });
      expect(screen.getByTestId('channel-dialog-save')).toBeDisabled();
    });

    it('does not call onSave when submitting whitespace-only name via form', () => {
      const onSave = vi.fn();
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={onSave} />,
      );
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: '   ' },
      });
      // Attempt to submit the form directly
      const form = screen.getByTestId('channel-dialog').querySelector('form')!;
      fireEvent.submit(form);
      expect(onSave).not.toHaveBeenCalled();
    });

    it('trims whitespace from name before calling onSave', () => {
      const onSave = vi.fn();
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={onSave} />,
      );
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: '  Design Team  ' },
      });
      fireEvent.click(screen.getByTestId('channel-dialog-save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Design Team' }),
      );
    });

    it('trims whitespace from description before calling onSave', () => {
      const onSave = vi.fn();
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={onSave} />,
      );
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: 'Design' },
      });
      fireEvent.change(screen.getByTestId('channel-description-input'), {
        target: { value: '  Some description  ' },
      });
      fireEvent.click(screen.getByTestId('channel-dialog-save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Some description' }),
      );
    });

    it('enables save when name transitions from empty to valid', () => {
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={vi.fn()} />,
      );
      expect(screen.getByTestId('channel-dialog-save')).toBeDisabled();
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: 'New Channel' },
      });
      expect(screen.getByTestId('channel-dialog-save')).not.toBeDisabled();
    });

    it('disables save when name transitions from valid to empty', () => {
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={vi.fn()} />,
      );
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: 'X' },
      });
      expect(screen.getByTestId('channel-dialog-save')).not.toBeDisabled();
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: '' },
      });
      expect(screen.getByTestId('channel-dialog-save')).toBeDisabled();
    });
  });

  // ── Form reset behavior ──────────────────────────────────────────

  describe('form reset on open', () => {
    it('resets fields when dialog re-opens in create mode', () => {
      const { rerender } = render(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          agents={agents}
          onSave={vi.fn()}
        />,
      );

      // Type a name
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: 'Typed Something' },
      });

      // Close
      rerender(
        <ChannelDialog
          open={false}
          onOpenChange={vi.fn()}
          agents={agents}
          onSave={vi.fn()}
        />,
      );

      // Re-open
      rerender(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          agents={agents}
          onSave={vi.fn()}
        />,
      );

      expect(screen.getByTestId('channel-name-input')).toHaveValue('');
    });

    it('populates fields when switching from create to edit mode', () => {
      const { rerender } = render(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          agents={agents}
          onSave={vi.fn()}
        />,
      );

      expect(screen.getByTestId('channel-name-input')).toHaveValue('');

      // Switch to edit mode
      rerender(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          channel={existingChannel}
          agents={agents}
          onSave={vi.fn()}
        />,
      );

      expect(screen.getByTestId('channel-name-input')).toHaveValue('Backend');
      expect(screen.getByTestId('channel-description-input')).toHaveValue('Backend discussions');
    });

    it('clears fields when switching from edit to create mode', () => {
      const { rerender } = render(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          channel={existingChannel}
          agents={agents}
          onSave={vi.fn()}
        />,
      );

      expect(screen.getByTestId('channel-name-input')).toHaveValue('Backend');

      // Close and re-open in create mode
      rerender(
        <ChannelDialog
          open={false}
          onOpenChange={vi.fn()}
          agents={agents}
          onSave={vi.fn()}
        />,
      );
      rerender(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          agents={agents}
          onSave={vi.fn()}
        />,
      );

      expect(screen.getByTestId('channel-name-input')).toHaveValue('');
      expect(screen.getByTestId('channel-description-input')).toHaveValue('');
    });
  });

  // ── Member selection edge cases ──────────────────────────────────

  describe('member selection', () => {
    it('allows selecting all agents', () => {
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={vi.fn()} />,
      );
      fireEvent.click(screen.getByTestId('member-toggle-leela'));
      fireEvent.click(screen.getByTestId('member-toggle-bender'));
      fireEvent.click(screen.getByTestId('member-toggle-fry'));
      // Badge should show 3
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('allows deselecting all agents after selecting', () => {
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={vi.fn()} />,
      );
      // Select all
      fireEvent.click(screen.getByTestId('member-toggle-leela'));
      fireEvent.click(screen.getByTestId('member-toggle-bender'));
      fireEvent.click(screen.getByTestId('member-toggle-fry'));
      // Deselect all
      fireEvent.click(screen.getByTestId('member-toggle-leela'));
      fireEvent.click(screen.getByTestId('member-toggle-bender'));
      fireEvent.click(screen.getByTestId('member-toggle-fry'));
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('submits with correct memberAgentIds after toggling', () => {
      const onSave = vi.fn();
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={onSave} />,
      );
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: 'Test' },
      });
      // Select leela and fry, but not bender
      fireEvent.click(screen.getByTestId('member-toggle-leela'));
      fireEvent.click(screen.getByTestId('member-toggle-fry'));
      fireEvent.click(screen.getByTestId('channel-dialog-save'));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ memberAgentIds: ['leela', 'fry'] }),
      );
    });

    it('disables member toggles when isSaving', () => {
      render(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          agents={agents}
          onSave={vi.fn()}
          isSaving={true}
        />,
      );
      expect(screen.getByTestId('member-toggle-leela')).toBeDisabled();
      expect(screen.getByTestId('member-toggle-bender')).toBeDisabled();
      expect(screen.getByTestId('member-toggle-fry')).toBeDisabled();
    });
  });

  // ── Submit without description ───────────────────────────────────

  describe('optional fields', () => {
    it('submits successfully without a description', () => {
      const onSave = vi.fn();
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={onSave} />,
      );
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: 'Minimal Channel' },
      });
      fireEvent.click(screen.getByTestId('channel-dialog-save'));
      expect(onSave).toHaveBeenCalledWith({
        name: 'Minimal Channel',
        description: '',
        memberAgentIds: [],
      });
    });

    it('submits successfully without selecting members', () => {
      const onSave = vi.fn();
      render(
        <ChannelDialog open={true} onOpenChange={vi.fn()} agents={agents} onSave={onSave} />,
      );
      fireEvent.change(screen.getByTestId('channel-name-input'), {
        target: { value: 'Empty Channel' },
      });
      fireEvent.click(screen.getByTestId('channel-dialog-save'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ memberAgentIds: [] }),
      );
    });
  });

  // ── isSaving state ───────────────────────────────────────────────

  describe('saving state', () => {
    it('disables save button when isSaving even with valid name', () => {
      render(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          channel={existingChannel}
          agents={agents}
          onSave={vi.fn()}
          isSaving={true}
        />,
      );
      expect(screen.getByTestId('channel-dialog-save')).toBeDisabled();
    });

    it('disables cancel button when isSaving', () => {
      render(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          agents={agents}
          onSave={vi.fn()}
          isSaving={true}
        />,
      );
      expect(screen.getByTestId('channel-dialog-cancel')).toBeDisabled();
    });

    it('shows "Save Changes" text in edit mode when not saving', () => {
      render(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          channel={existingChannel}
          agents={agents}
          onSave={vi.fn()}
        />,
      );
      expect(screen.getByTestId('channel-dialog-save')).toHaveTextContent('Save Changes');
    });

    it('shows "Saving…" text regardless of mode when saving', () => {
      render(
        <ChannelDialog
          open={true}
          onOpenChange={vi.fn()}
          channel={existingChannel}
          agents={agents}
          onSave={vi.fn()}
          isSaving={true}
        />,
      );
      expect(screen.getByTestId('channel-dialog-save')).toHaveTextContent('Saving…');
    });
  });
});

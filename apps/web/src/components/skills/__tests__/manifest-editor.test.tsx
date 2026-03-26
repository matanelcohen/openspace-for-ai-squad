import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ValidationError } from '@/hooks/use-skill-manifest-form';

import { ManifestEditor } from '../manifest-editor';

const validJson = JSON.stringify(
  {
    manifestVersion: 1,
    id: 'test-skill',
    name: 'Test Skill',
    version: '1.0.0',
    description: 'A test skill',
    tools: [{ toolId: 'git:diff' }],
    triggers: [{ type: 'task-type', taskTypes: ['test'] }],
    prompts: [{ id: 'p1', name: 'P1', role: 'system', content: 'test' }],
  },
  null,
  2,
);

describe('ManifestEditor', () => {
  it('renders the editor with filename', () => {
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={vi.fn(() => [])} />);
    expect(screen.getByTestId('manifest-editor')).toBeInTheDocument();
    expect(screen.getByText('skill.manifest.json')).toBeInTheDocument();
  });

  it('renders the JSON content in textarea', () => {
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={vi.fn(() => [])} />);
    const textarea = screen.getByTestId('manifest-json-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe(validJson);
  });

  it('shows valid message when no errors', () => {
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={vi.fn(() => [])} />);
    expect(screen.getByText('Manifest is valid')).toBeInTheDocument();
  });

  it('shows errors when validation errors exist', () => {
    const errors: ValidationError[] = [
      { field: 'id', message: 'Skill ID is required' },
      { field: 'name', message: 'Name is required' },
    ];
    render(
      <ManifestEditor manifestJson={validJson} errors={errors} onApplyJson={vi.fn(() => [])} />,
    );
    expect(screen.getByText('2 issues')).toBeInTheDocument();
    expect(screen.getByText('Skill ID is required')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('shows Modified indicator when content is changed', async () => {
    const user = userEvent.setup();
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={vi.fn(() => [])} />);

    const textarea = screen.getByTestId('manifest-json-textarea');
    await user.click(textarea);
    await user.type(textarea, ' ');

    expect(screen.getByText('• Modified')).toBeInTheDocument();
  });

  it('shows Apply and Discard buttons when dirty', async () => {
    const user = userEvent.setup();
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={vi.fn(() => [])} />);

    const textarea = screen.getByTestId('manifest-json-textarea');
    await user.click(textarea);
    await user.type(textarea, ' ');

    expect(screen.getByText('Apply to Form')).toBeInTheDocument();
    expect(screen.getByText('Discard')).toBeInTheDocument();
  });

  it('calls onApplyJson when Apply is clicked', async () => {
    const user = userEvent.setup();
    const onApplyJson = vi.fn(() => [] as ValidationError[]);
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={onApplyJson} />);

    const textarea = screen.getByTestId('manifest-json-textarea');
    await user.click(textarea);
    await user.type(textarea, ' ');
    await user.click(screen.getByText('Apply to Form'));

    expect(onApplyJson).toHaveBeenCalledTimes(1);
  });

  it('resets to original content when Discard is clicked', async () => {
    const user = userEvent.setup();
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={vi.fn(() => [])} />);

    const textarea = screen.getByTestId('manifest-json-textarea') as HTMLTextAreaElement;
    await user.click(textarea);
    await user.type(textarea, 'extra');

    await user.click(screen.getByText('Discard'));

    expect(textarea.value).toBe(validJson);
    expect(screen.queryByText('• Modified')).not.toBeInTheDocument();
  });

  it('shows JSON syntax error for invalid JSON', async () => {
    const user = userEvent.setup();
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={vi.fn(() => [])} />);

    const textarea = screen.getByTestId('manifest-json-textarea');
    await user.clear(textarea);
    // Use keyboard() to avoid userEvent interpreting `{` as a special key
    await user.click(textarea);
    await user.keyboard('invalid json');

    expect(screen.getByText('1 issue')).toBeInTheDocument();
  });

  it('disables Apply button when JSON has syntax errors', async () => {
    const user = userEvent.setup();
    render(<ManifestEditor manifestJson={validJson} errors={[]} onApplyJson={vi.fn(() => [])} />);

    const textarea = screen.getByTestId('manifest-json-textarea');
    await user.clear(textarea);
    await user.click(textarea);
    await user.keyboard('bad json');

    const applyBtn = screen.getByText('Apply to Form');
    expect(applyBtn).toBeDisabled();
  });
});

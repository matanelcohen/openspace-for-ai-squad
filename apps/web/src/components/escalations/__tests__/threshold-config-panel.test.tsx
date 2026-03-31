import type { ConfidenceThreshold } from '@matanelcohen/openspace-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ThresholdConfigPanel } from '../threshold-config-panel';

const defaultThresholds: ConfidenceThreshold[] = [
  { threshold: 0.3, escalationLevel: 1, agentRoles: ['frontend'] },
  { threshold: 0.6, escalationLevel: 2 },
];

describe('ThresholdConfigPanel', () => {
  it('renders the card with title', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    expect(screen.getByText('Confidence Thresholds')).toBeInTheDocument();
  });

  it('renders all threshold rows', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    expect(screen.getByTestId('threshold-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('threshold-row-1')).toBeInTheDocument();
  });

  it('displays threshold values correctly', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    const input0 = screen.getByTestId('threshold-value-0') as HTMLInputElement;
    const input1 = screen.getByTestId('threshold-value-1') as HTMLInputElement;
    expect(input0.value).toBe('0.3');
    expect(input1.value).toBe('0.6');
  });

  it('displays escalation levels correctly', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    const level0 = screen.getByTestId('threshold-level-0') as HTMLInputElement;
    const level1 = screen.getByTestId('threshold-level-1') as HTMLInputElement;
    expect(level0.value).toBe('1');
    expect(level1.value).toBe('2');
  });

  it('displays agent roles', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    const roles0 = screen.getByTestId('threshold-roles-0') as HTMLInputElement;
    expect(roles0.value).toBe('frontend');
  });

  it('shows empty state when no thresholds', () => {
    render(<ThresholdConfigPanel thresholds={[]} onSave={vi.fn()} />);
    expect(screen.getByTestId('no-thresholds')).toBeInTheDocument();
    expect(screen.getByText(/No thresholds configured/)).toBeInTheDocument();
  });

  it('adds a new threshold row', () => {
    render(<ThresholdConfigPanel thresholds={[]} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-threshold-btn'));
    expect(screen.getByTestId('threshold-row-0')).toBeInTheDocument();
  });

  it('removes a threshold row', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    expect(screen.getByTestId('threshold-row-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('remove-threshold-1'));
    expect(screen.queryByTestId('threshold-row-1')).not.toBeInTheDocument();
  });

  it('enables save button when dirty', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    const saveBtn = screen.getByTestId('save-thresholds-btn');
    expect(saveBtn).toBeDisabled();

    fireEvent.click(screen.getByTestId('add-threshold-btn'));
    expect(saveBtn).not.toBeDisabled();
  });

  it('calls onSave with cleaned thresholds', () => {
    const onSave = vi.fn();
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={onSave} />);

    // Make it dirty by adding a row
    fireEvent.click(screen.getByTestId('add-threshold-btn'));
    fireEvent.click(screen.getByTestId('save-thresholds-btn'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved).toHaveLength(3);
    // Verify _key is stripped
    expect(saved[0]).not.toHaveProperty('_key');
  });

  it('shows reset button when dirty', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    expect(screen.queryByTestId('reset-btn')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-threshold-btn'));
    expect(screen.getByTestId('reset-btn')).toBeInTheDocument();
  });

  it('resets to original values on reset', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-threshold-btn'));
    expect(screen.getByTestId('threshold-row-2')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('reset-btn'));
    expect(screen.queryByTestId('threshold-row-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('threshold-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('threshold-row-1')).toBeInTheDocument();
  });

  it('disables save when isSaving is true', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} isSaving />);
    // Save is also disabled when not dirty, but let's make it dirty first
    fireEvent.click(screen.getByTestId('add-threshold-btn'));
    expect(screen.getByTestId('save-thresholds-btn')).toBeDisabled();
  });

  it('shows "Saving…" text when isSaving', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} isSaving />);
    expect(screen.getByTestId('save-thresholds-btn')).toHaveTextContent('Saving…');
  });

  it('updates threshold value on input change', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    const input = screen.getByTestId('threshold-value-0') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.75' } });
    expect(input.value).toBe('0.75');
  });

  it('has correct data-testid on card', () => {
    render(<ThresholdConfigPanel thresholds={defaultThresholds} onSave={vi.fn()} />);
    expect(screen.getByTestId('threshold-config-panel')).toBeInTheDocument();
  });

  it('color-codes rows by threshold value', () => {
    const thresholds: ConfidenceThreshold[] = [
      { threshold: 0.9, escalationLevel: 1 },
      { threshold: 0.6, escalationLevel: 2 },
      { threshold: 0.3, escalationLevel: 3 },
    ];
    render(<ThresholdConfigPanel thresholds={thresholds} onSave={vi.fn()} />);
    const row0 = screen.getByTestId('threshold-row-0');
    const row2 = screen.getByTestId('threshold-row-2');
    expect(row0.className).toContain('green');
    expect(row2.className).toContain('red');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-threshold-config', () => ({
  useThresholdConfig: vi.fn(),
  useUpdateThresholds: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  })),
  useUpdateChains: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  })),
}));

vi.mock('@/components/workspace/squad-guard', () => ({
  SquadGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { useThresholdConfig } from '@/hooks/use-threshold-config';

import EscalationConfigPage from '../../../../app/escalations/config/page';

const mockUseThresholdConfig = vi.mocked(useThresholdConfig);

describe('EscalationConfigPage', () => {
  it('renders loading skeletons when loading', () => {
    mockUseThresholdConfig.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useThresholdConfig>);

    const { container } = render(<EscalationConfigPage />);
    expect(screen.getByText('Escalation Configuration')).toBeInTheDocument();
    // Check for skeleton elements
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error state', () => {
    mockUseThresholdConfig.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as ReturnType<typeof useThresholdConfig>);

    render(<EscalationConfigPage />);
    expect(screen.getByText(/Failed to load escalation configuration/)).toBeInTheDocument();
  });

  it('renders config panels when data is loaded', () => {
    mockUseThresholdConfig.mockReturnValue({
      data: {
        thresholds: [{ threshold: 0.5, escalationLevel: 1 }],
        chains: [
          {
            id: 'chain-1',
            name: 'Default',
            levels: [{ level: 1, name: 'L1', reviewerIds: [], timeoutMs: 1800000 }],
          },
        ],
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useThresholdConfig>);

    render(<EscalationConfigPage />);
    expect(screen.getByTestId('threshold-config-panel')).toBeInTheDocument();
    expect(screen.getByTestId('escalation-chain-editor')).toBeInTheDocument();
  });

  it('shows page title and description', () => {
    mockUseThresholdConfig.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useThresholdConfig>);

    render(<EscalationConfigPage />);
    expect(screen.getByText('Escalation Configuration')).toBeInTheDocument();
    expect(
      screen.getByText(/Configure confidence thresholds and escalation chains/),
    ).toBeInTheDocument();
  });

  it('has a back link to escalation queue', () => {
    mockUseThresholdConfig.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useThresholdConfig>);

    render(<EscalationConfigPage />);
    const backLink = screen.getByText('← Back to Queue').closest('a');
    expect(backLink).toHaveAttribute('href', '/escalations');
  });
});

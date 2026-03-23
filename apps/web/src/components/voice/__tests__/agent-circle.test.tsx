import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentCircle } from '../agent-circle';

vi.mock('@/components/agent-avatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid={`agent-avatar-${agentId}`}>Avatar</div>
  ),
}));

describe('AgentCircle', () => {
  it('renders agent avatar and name', () => {
    render(<AgentCircle agentId="leela" isSpeaking={false} />);
    
    expect(screen.getByTestId('agent-circle')).toBeInTheDocument();
    expect(screen.getByTestId('agent-avatar-leela')).toBeInTheDocument();
    expect(screen.getByText('leela')).toBeInTheDocument();
  });

  it('shows speaking indicator', () => {
    render(<AgentCircle agentId="bender" isSpeaking={false} />);
    
    expect(screen.getByTestId('speaking-indicator')).toBeInTheDocument();
  });

  it('applies speaking styles when active', () => {
    render(<AgentCircle agentId="fry" isSpeaking={true} />);
    
    const circle = screen.getByTestId('agent-circle');
    expect(circle).toHaveAttribute('data-speaking', 'true');
    expect(circle).toHaveClass('animate-pulse');
    expect(screen.getByTestId('glow-effect')).toBeInTheDocument();
  });

  it('does not show glow when not speaking', () => {
    render(<AgentCircle agentId="zoidberg" isSpeaking={false} />);
    
    expect(screen.queryByTestId('glow-effect')).not.toBeInTheDocument();
  });

  it('sets correct data attributes', () => {
    render(<AgentCircle agentId="leela" isSpeaking={true} />);
    
    const circle = screen.getByTestId('agent-circle');
    expect(circle).toHaveAttribute('data-agent-id', 'leela');
    expect(circle).toHaveAttribute('data-speaking', 'true');
  });
});

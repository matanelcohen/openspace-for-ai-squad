import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SkillIcon } from '../skill-icon';

describe('SkillIcon', () => {
  it('renders default Puzzle icon when no icon prop is provided', () => {
    const { container } = render(<SkillIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('h-5', 'w-5');
  });

  it('renders default Puzzle icon for unknown icon string', () => {
    const { container } = render(<SkillIcon icon="unknown-icon" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders mapped icon for known icon string', () => {
    const { container } = render(<SkillIcon icon="code" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SkillIcon icon="code" className="h-8 w-8" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-8', 'w-8');
  });

  it.each(['code', 'testing', 'deployment', 'search', 'security', 'database'])(
    'renders icon for known key "%s"',
    (iconKey) => {
      const { container } = render(<SkillIcon icon={iconKey} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    },
  );
});

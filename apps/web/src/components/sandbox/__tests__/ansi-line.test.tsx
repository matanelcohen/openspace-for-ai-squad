import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnsiLine } from '../ansi-line';

describe('AnsiLine', () => {
  it('renders plain text without ANSI codes', () => {
    render(<AnsiLine text="hello world" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders text with bold ANSI code', () => {
    const text = '\x1b[1mbold text\x1b[0m';
    const { container } = render(<AnsiLine text={text} />);
    const boldSpan = container.querySelector('.ansi-bold');
    expect(boldSpan).toBeInTheDocument();
    expect(boldSpan).toHaveTextContent('bold text');
  });

  it('renders text with foreground color', () => {
    const text = '\x1b[31mred text\x1b[0m';
    const { container } = render(<AnsiLine text={text} />);
    const redSpan = container.querySelector('.ansi-red');
    expect(redSpan).toBeInTheDocument();
    expect(redSpan).toHaveTextContent('red text');
  });

  it('renders text with multiple styles', () => {
    const text = '\x1b[1;32mbold green\x1b[0m plain';
    const { container } = render(<AnsiLine text={text} />);
    const styledSpan = container.querySelector('.ansi-bold.ansi-green');
    expect(styledSpan).toBeInTheDocument();
    expect(styledSpan).toHaveTextContent('bold green');
    expect(container).toHaveTextContent('plain');
  });

  it('renders text with background color', () => {
    const text = '\x1b[44mblue bg\x1b[0m';
    const { container } = render(<AnsiLine text={text} />);
    const bgSpan = container.querySelector('.ansi-bg-blue');
    expect(bgSpan).toBeInTheDocument();
    expect(bgSpan).toHaveTextContent('blue bg');
  });

  it('applies outer className', () => {
    const { container } = render(<AnsiLine text="test" className="my-class" />);
    expect(container.querySelector('.my-class')).toBeInTheDocument();
  });

  it('handles empty string', () => {
    const { container } = render(<AnsiLine text="" />);
    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('handles bright foreground colors', () => {
    const text = '\x1b[91mbright red\x1b[0m';
    const { container } = render(<AnsiLine text={text} />);
    expect(container.querySelector('.ansi-bright-red')).toHaveTextContent('bright red');
  });
});

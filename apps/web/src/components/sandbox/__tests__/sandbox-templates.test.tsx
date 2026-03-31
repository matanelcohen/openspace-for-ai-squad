import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SANDBOX_TEMPLATES, SandboxTemplates } from '../sandbox-templates';

describe('SANDBOX_TEMPLATES', () => {
  it('contains 8 templates', () => {
    expect(SANDBOX_TEMPLATES).toHaveLength(8);
  });

  it('covers all three runtimes', () => {
    const runtimes = new Set(SANDBOX_TEMPLATES.map((t) => t.runtime));
    expect(runtimes).toEqual(new Set(['node', 'python', 'go']));
  });

  it('each template has required fields', () => {
    for (const tpl of SANDBOX_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(tpl.runtime).toBeTruthy();
      expect(tpl.icon).toBeTruthy();
    }
  });
});

describe('SandboxTemplates', () => {
  it('renders all templates grouped by runtime', () => {
    render(<SandboxTemplates onSelect={vi.fn()} />);
    expect(screen.getByTestId('sandbox-templates')).toBeInTheDocument();
    // Runtime headings (may also appear as template names, so use getAllByText)
    expect(screen.getAllByText('Node.js').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Python').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Go').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a card for each template', () => {
    render(<SandboxTemplates onSelect={vi.fn()} />);
    for (const tpl of SANDBOX_TEMPLATES) {
      expect(screen.getByTestId(`template-${tpl.id}`)).toBeInTheDocument();
    }
  });

  it('shows template name and description', () => {
    render(<SandboxTemplates onSelect={vi.fn()} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Node.js with TypeScript, ts-node, and tsconfig')).toBeInTheDocument();
  });

  it('calls onSelect with the template when clicked', () => {
    const onSelect = vi.fn();
    render(<SandboxTemplates onSelect={onSelect} />);
    screen.getByTestId('template-node-blank').click();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'node-blank', runtime: 'node' }),
    );
  });

  it('calls onSelect with correct template for python', () => {
    const onSelect = vi.fn();
    render(<SandboxTemplates onSelect={onSelect} />);
    screen.getByTestId('template-python-fastapi').click();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'python-fastapi', runtime: 'python' }),
    );
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchHighlight } from '../search-highlight';

describe('SearchHighlight', () => {
  it('renders text without highlighting when no query', () => {
    render(<SearchHighlight text="Hello world" query="" />);
    
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.queryByTestId('highlight-match')).not.toBeInTheDocument();
  });

  it('highlights matching text', () => {
    render(<SearchHighlight text="Hello world" query="world" />);
    
    expect(screen.getByTestId('search-highlight')).toBeInTheDocument();
    expect(screen.getByTestId('highlight-match')).toHaveTextContent('world');
  });

  it('highlights multiple matches', () => {
    render(<SearchHighlight text="test test test" query="test" />);
    
    const matches = screen.getAllByTestId('highlight-match');
    expect(matches).toHaveLength(3);
    matches.forEach(match => {
      expect(match).toHaveTextContent('test');
    });
  });

  it('is case insensitive', () => {
    render(<SearchHighlight text="Hello World" query="hello" />);
    
    const match = screen.getByTestId('highlight-match');
    expect(match).toHaveTextContent('Hello');
  });

  it('highlights partial matches', () => {
    render(<SearchHighlight text="TypeScript is great" query="Script" />);
    
    const match = screen.getByTestId('highlight-match');
    expect(match).toHaveTextContent('Script');
  });

  it('preserves original text casing', () => {
    render(<SearchHighlight text="HELLO world" query="hello" />);
    
    const match = screen.getByTestId('highlight-match');
    expect(match).toHaveTextContent('HELLO');
  });
});

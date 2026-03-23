/**
 * P2-10 — cn() utility tests
 */
import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('merges simple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const includeHidden = false;
    const includeVisible = true;
    expect(
      cn(
        'base',
        includeHidden ? 'hidden' : undefined,
        includeVisible ? 'visible' : undefined,
      ),
    ).toBe('base visible');
  });

  it('merges conflicting tailwind classes', () => {
    // twMerge should keep the last one
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles arrays', () => {
    expect(cn(['a', 'b'])).toBe('a b');
  });

  it('handles objects', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
  });
});

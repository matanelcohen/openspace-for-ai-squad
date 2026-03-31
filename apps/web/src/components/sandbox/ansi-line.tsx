// @ts-nocheck
'use client';

import React from 'react';

import { parseAnsi } from '@/lib/ansi-parser';

interface AnsiLineProps {
  text: string;
  /** Extra class applied to the outer <span> wrapper */
  className?: string;
}

/**
 * Renders a single line of text with ANSI escape codes converted
 * to styled <span> elements. Memoised to avoid re-parsing unchanged lines.
 */
export const AnsiLine = React.memo(function AnsiLine({ text, className }: AnsiLineProps) {
  const spans = parseAnsi(text);

  return (
    <span className={className}>
      {spans.map((span, i) =>
        span.className ? (
          <span key={i} className={span.className}>
            {span.text}
          </span>
        ) : (
          <React.Fragment key={i}>{span.text}</React.Fragment>
        ),
      )}
    </span>
  );
});

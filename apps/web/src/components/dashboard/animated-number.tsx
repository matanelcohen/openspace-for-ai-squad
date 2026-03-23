'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({ value, duration = 500, className }: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(value);
  const previousRef = useRef(value);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = previousRef.current;
    const to = value;
    previousRef.current = value;

    if (from === to) return;

    const startTime = performance.now();
    const diff = to - from;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + diff * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return <span className={className} data-testid="animated-number">{displayed}</span>;
}

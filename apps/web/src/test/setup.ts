// Manually extend vitest's expect with jest-dom matchers.
// Using the barrel import (`@testing-library/jest-dom/vitest`) breaks under
// pnpm because jest-dom resolves a different vitest instance (root v4) than
// the one running our tests (web v2), so `expect.extend` targets the wrong
// object. Importing matchers separately and extending here guarantees we
// patch the correct `expect`.
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

// jsdom doesn't implement PointerEvent. Radix UI primitives (DropdownMenu,
// Dialog, etc.) rely on pointer events, so we polyfill with a thin wrapper
// around MouseEvent to keep component tests working.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, init: PointerEventInit & EventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
    }
  }

  globalThis.PointerEvent = PointerEvent as unknown as typeof globalThis.PointerEvent;
}

// Radix also guards on Element.hasPointerCapture / setPointerCapture /
// releasePointerCapture which jsdom lacks.
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

/**
 * Lightweight ANSI escape-code parser that converts raw terminal output
 * into an array of styled spans suitable for React rendering.
 *
 * Supports SGR (Select Graphic Rendition) codes 0-49 covering:
 *   - Reset, bold, dim, italic, underline, strikethrough
 *   - Standard foreground/background colours (30-37, 40-47)
 *   - Bright foreground/background colours (90-97, 100-107)
 *   - 256-colour mode (38;5;n / 48;5;n)
 */

export interface AnsiSpan {
  text: string;
  className: string;
}

const ANSI_RE = /\x1b\[([0-9;]*)m/g;

const FG_MAP: Record<number, string> = {
  30: 'ansi-black',
  31: 'ansi-red',
  32: 'ansi-green',
  33: 'ansi-yellow',
  34: 'ansi-blue',
  35: 'ansi-magenta',
  36: 'ansi-cyan',
  37: 'ansi-white',
  90: 'ansi-bright-black',
  91: 'ansi-bright-red',
  92: 'ansi-bright-green',
  93: 'ansi-bright-yellow',
  94: 'ansi-bright-blue',
  95: 'ansi-bright-magenta',
  96: 'ansi-bright-cyan',
  97: 'ansi-bright-white',
};

const BG_MAP: Record<number, string> = {
  40: 'ansi-bg-black',
  41: 'ansi-bg-red',
  42: 'ansi-bg-green',
  43: 'ansi-bg-yellow',
  44: 'ansi-bg-blue',
  45: 'ansi-bg-magenta',
  46: 'ansi-bg-cyan',
  47: 'ansi-bg-white',
  100: 'ansi-bg-bright-black',
  101: 'ansi-bg-bright-red',
  102: 'ansi-bg-bright-green',
  103: 'ansi-bg-bright-yellow',
  104: 'ansi-bg-bright-blue',
  105: 'ansi-bg-bright-magenta',
  106: 'ansi-bg-bright-cyan',
  107: 'ansi-bg-bright-white',
};

interface SgrState {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fg: string;
  bg: string;
}

function initialState(): SgrState {
  return { bold: false, dim: false, italic: false, underline: false, strikethrough: false, fg: '', bg: '' };
}

function stateToClassName(s: SgrState): string {
  const parts: string[] = [];
  if (s.bold) parts.push('ansi-bold');
  if (s.dim) parts.push('ansi-dim');
  if (s.italic) parts.push('ansi-italic');
  if (s.underline) parts.push('ansi-underline');
  if (s.strikethrough) parts.push('ansi-strikethrough');
  if (s.fg) parts.push(s.fg);
  if (s.bg) parts.push(s.bg);
  return parts.join(' ');
}

function applyCodes(state: SgrState, raw: string): void {
  if (raw === '' || raw === '0') {
    Object.assign(state, initialState());
    return;
  }

  const codes = raw.split(';').map(Number);
  let i = 0;
  while (i < codes.length) {
    const c = codes[i];

    if (c === 0) Object.assign(state, initialState());
    else if (c === 1) state.bold = true;
    else if (c === 2) state.dim = true;
    else if (c === 3) state.italic = true;
    else if (c === 4) state.underline = true;
    else if (c === 9) state.strikethrough = true;
    else if (c === 22) { state.bold = false; state.dim = false; }
    else if (c === 23) state.italic = false;
    else if (c === 24) state.underline = false;
    else if (c === 29) state.strikethrough = false;
    else if (c !== undefined && FG_MAP[c]) state.fg = FG_MAP[c]!;
    else if (c !== undefined && BG_MAP[c]) state.bg = BG_MAP[c]!;
    else if (c === 39) state.fg = '';
    else if (c === 49) state.bg = '';
    // 256-colour: 38;5;n or 48;5;n
    else if (c === 38 && codes[i + 1] === 5) {
      state.fg = `ansi-256-fg-${codes[i + 2] ?? 0}`;
      i += 2;
    } else if (c === 48 && codes[i + 1] === 5) {
      state.bg = `ansi-256-bg-${codes[i + 2] ?? 0}`;
      i += 2;
    }

    i++;
  }
}

/**
 * Parse a string containing ANSI escape codes into an array of styled spans.
 */
export function parseAnsi(input: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const state = initialState();
  let lastIndex = 0;

  ANSI_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ANSI_RE.exec(input)) !== null) {
    // Text before this escape
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text) spans.push({ text, className: stateToClassName(state) });
    }
    applyCodes(state, match[1]!);
    lastIndex = ANSI_RE.lastIndex;
  }

  // Trailing text
  if (lastIndex < input.length) {
    spans.push({ text: input.slice(lastIndex), className: stateToClassName(state) });
  }

  return spans;
}

/**
 * Strip all ANSI escape codes from a string.
 */
export function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, '');
}

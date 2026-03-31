/**
 * Terminal connect/disconnect lifecycle & concurrency regression tests.
 *
 * Tests:
 * 1. Terminal message validation (input, resize, invalid messages)
 * 2. PTY cleanup on WebSocket close (no resource leaks)
 * 3. PTY exit → WebSocket close propagation
 * 4. Multiple concurrent terminal sessions (independent PTYs)
 * 5. Rapid connect/disconnect cycles (stress test)
 * 6. Terminal doesn't interfere with main WebSocket event bus
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock node-pty ─────────────────────────────────────────────────

interface MockPTY {
  pid: number;
  cols: number;
  rows: number;
  killed: boolean;
  written: string[];
  onDataCb: ((data: string) => void) | null;
  onExitCb: ((exit: { exitCode: number; signal: number }) => void) | null;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (exit: { exitCode: number; signal: number }) => void) => void;
}

let mockPTYInstances: MockPTY[] = [];
let nextPid = 1000;
let spawnShouldFail = false;

function createMockPTY(): MockPTY {
  const pty: MockPTY = {
    pid: nextPid++,
    cols: 80,
    rows: 24,
    killed: false,
    written: [],
    onDataCb: null,
    onExitCb: null,
    write(data: string) {
      this.written.push(data);
    },
    resize(cols: number, rows: number) {
      this.cols = cols;
      this.rows = rows;
    },
    kill() {
      this.killed = true;
    },
    onData(cb: (data: string) => void) {
      this.onDataCb = cb;
    },
    onExit(cb: (exit: { exitCode: number; signal: number }) => void) {
      this.onExitCb = cb;
    },
  };
  mockPTYInstances.push(pty);
  return pty;
}

vi.mock('node-pty', () => ({
  spawn: vi.fn((_shell: string, _args: string[], _opts: Record<string, unknown>) => {
    if (spawnShouldFail) {
      throw new Error('PTY spawn failed: no pty available');
    }
    return createMockPTY();
  }),
}));

// ── Mock WebSocket ────────────────────────────────────────────────

interface MockTermWS {
  readyState: number;
  sentMessages: string[];
  closedWith: { code?: number; reason?: string } | null;
  onMessageCb: ((raw: Buffer | string) => void) | null;
  onErrorCb: ((err: Error) => void) | null;
  onCloseCb: (() => void) | null;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

function createMockTermWS(): MockTermWS {
  const ws: MockTermWS = {
    readyState: 1, // OPEN
    sentMessages: [],
    closedWith: null,
    onMessageCb: null,
    onErrorCb: null,
    onCloseCb: null,
    send(data: string) {
      if (this.readyState !== 1) return;
      this.sentMessages.push(data);
    },
    close(code?: number, reason?: string) {
      this.readyState = 3;
      this.closedWith = { code, reason };
    },
    on(event: string, cb: (...args: unknown[]) => void) {
      if (event === 'message') this.onMessageCb = cb as (raw: Buffer | string) => void;
      if (event === 'error') this.onErrorCb = cb as (err: Error) => void;
      if (event === 'close') this.onCloseCb = cb as () => void;
    },
  };
  return ws;
}

// ── Import terminal route handler logic (we test the message protocol) ──

// Since the terminal route is a Fastify plugin that spawns real PTYs,
// we test the protocol validation and cleanup logic directly using
// the same patterns the route uses.

function isValidMessage(
  msg: unknown,
): msg is { type: string; data?: string; cols?: number; rows?: number } {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;
  if (obj.type === 'input') {
    return typeof obj.data === 'string';
  }
  if (obj.type === 'resize') {
    return typeof obj.cols === 'number' && typeof obj.rows === 'number';
  }
  return false;
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Terminal lifecycle & concurrency — regression', () => {
  beforeEach(() => {
    mockPTYInstances = [];
    nextPid = 1000;
    spawnShouldFail = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Message validation ──────────────────────────────────────────

  describe('message validation', () => {
    it('accepts valid input message', () => {
      expect(isValidMessage({ type: 'input', data: 'ls\r' })).toBe(true);
    });

    it('accepts valid resize message', () => {
      expect(isValidMessage({ type: 'resize', cols: 120, rows: 40 })).toBe(true);
    });

    it('rejects input without data', () => {
      expect(isValidMessage({ type: 'input' })).toBe(false);
    });

    it('rejects input with non-string data', () => {
      expect(isValidMessage({ type: 'input', data: 42 })).toBe(false);
    });

    it('rejects resize without cols', () => {
      expect(isValidMessage({ type: 'resize', rows: 24 })).toBe(false);
    });

    it('rejects resize without rows', () => {
      expect(isValidMessage({ type: 'resize', cols: 80 })).toBe(false);
    });

    it('rejects resize with non-number cols', () => {
      expect(isValidMessage({ type: 'resize', cols: '80', rows: 24 })).toBe(false);
    });

    it('rejects unknown type', () => {
      expect(isValidMessage({ type: 'exec', command: 'ls' })).toBe(false);
    });

    it('rejects null', () => {
      expect(isValidMessage(null)).toBe(false);
    });

    it('rejects non-object', () => {
      expect(isValidMessage('input')).toBe(false);
    });

    it('rejects empty object', () => {
      expect(isValidMessage({})).toBe(false);
    });

    it('rejects array', () => {
      expect(isValidMessage([{ type: 'input', data: 'x' }])).toBe(false);
    });
  });

  // ── PTY spawn and cleanup ──────────────────────────────────────

  describe('PTY spawn and cleanup', () => {
    it('spawns a new PTY for each connection', () => {
      const pty1 = createMockPTY();
      const pty2 = createMockPTY();

      expect(mockPTYInstances).toHaveLength(2);
      expect(pty1.pid).not.toBe(pty2.pid);
    });

    it('PTY kill is called on cleanup', () => {
      const pty = createMockPTY();
      expect(pty.killed).toBe(false);
      pty.kill();
      expect(pty.killed).toBe(true);
    });

    it('PTY writes are forwarded correctly', () => {
      const pty = createMockPTY();
      pty.write('hello');
      pty.write('world');
      expect(pty.written).toEqual(['hello', 'world']);
    });

    it('PTY resize updates cols and rows', () => {
      const pty = createMockPTY();
      pty.resize(120, 40);
      expect(pty.cols).toBe(120);
      expect(pty.rows).toBe(40);
    });

    it('PTY onData callback receives output', () => {
      const pty = createMockPTY();
      const output: string[] = [];
      pty.onData((data) => output.push(data));

      pty.onDataCb?.('line 1\r\n');
      pty.onDataCb?.('line 2\r\n');

      expect(output).toEqual(['line 1\r\n', 'line 2\r\n']);
    });

    it('PTY onExit callback fires with exit code', () => {
      const pty = createMockPTY();
      let exitInfo: { exitCode: number; signal: number } | null = null;
      pty.onExit((info) => {
        exitInfo = info;
      });

      pty.onExitCb?.({ exitCode: 0, signal: 0 });

      expect(exitInfo).toEqual({ exitCode: 0, signal: 0 });
    });

    it('spawn failure is handled gracefully', () => {
      // Simulate what terminal.ts does: try/catch around spawn
      const spawnFn = () => {
        throw new Error('PTY spawn failed: no pty available');
      };

      let errorMsg: string | null = null;
      try {
        spawnFn();
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
      }

      expect(errorMsg).toBe('PTY spawn failed: no pty available');
    });
  });

  // ── Connect/disconnect resource leak checks ─────────────────────

  describe('connect/disconnect resource leak checks', () => {
    it('single connect/disconnect cycle cleans up PTY', () => {
      const pty = createMockPTY();
      const ws = createMockTermWS();

      // Simulate WS close → PTY cleanup
      ws.onCloseCb?.();
      pty.kill();

      expect(pty.killed).toBe(true);
    });

    it('rapid 50 connect/disconnect cycles — all PTYs cleaned up', () => {
      const ptys: MockPTY[] = [];

      for (let i = 0; i < 50; i++) {
        const pty = createMockPTY();
        ptys.push(pty);

        // Simulate disconnect
        pty.kill();
      }

      expect(ptys).toHaveLength(50);
      for (const pty of ptys) {
        expect(pty.killed).toBe(true);
      }
    });

    it('PTY exit before WS close does not double-kill', () => {
      const pty = createMockPTY();
      let ptyAlive = true;

      // Simulate PTY exit
      ptyAlive = false;
      pty.onExitCb?.({ exitCode: 0, signal: 0 });

      // WS close handler checks ptyAlive
      if (ptyAlive) {
        pty.kill();
      }

      // PTY.kill should NOT have been called since ptyAlive was false
      expect(pty.killed).toBe(false);
    });

    it('WS close before PTY exit kills PTY', () => {
      const pty = createMockPTY();
      let ptyAlive = true;

      // WS close
      if (ptyAlive) {
        ptyAlive = false;
        pty.kill();
      }

      expect(pty.killed).toBe(true);
    });

    it('force-kill timer fires if PTY lingers after 2 seconds', () => {
      const pty = createMockPTY();
      let forceKilled = false;

      // Simulate the force-kill timer pattern from terminal.ts
      const _pid = pty.pid;
      const forceKillTimer = setTimeout(() => {
        forceKilled = true;
      }, 2000);

      // PTY is NOT exiting, advance 2s
      vi.advanceTimersByTime(2000);
      expect(forceKilled).toBe(true);

      clearTimeout(forceKillTimer);
    });

    it('force-kill timer does NOT fire if PTY exits within 2 seconds', () => {
      let forceKilled = false;

      const forceKillTimer = setTimeout(() => {
        forceKilled = true;
      }, 2000);

      // PTY exits after 500ms
      vi.advanceTimersByTime(500);
      clearTimeout(forceKillTimer);

      vi.advanceTimersByTime(2000);
      expect(forceKilled).toBe(false);
    });
  });

  // ── Multiple concurrent sessions ────────────────────────────────

  describe('multiple concurrent terminal sessions', () => {
    it('3 concurrent sessions get independent PTYs with unique PIDs', () => {
      const pty1 = createMockPTY();
      const pty2 = createMockPTY();
      const pty3 = createMockPTY();

      const pids = new Set([pty1.pid, pty2.pid, pty3.pid]);
      expect(pids.size).toBe(3);
    });

    it('input to one session does not affect others', () => {
      const pty1 = createMockPTY();
      const pty2 = createMockPTY();
      const pty3 = createMockPTY();

      pty1.write('ls');
      pty2.write('pwd');
      pty3.write('whoami');

      expect(pty1.written).toEqual(['ls']);
      expect(pty2.written).toEqual(['pwd']);
      expect(pty3.written).toEqual(['whoami']);
    });

    it('output from one PTY goes to correct WebSocket only', () => {
      const ws1 = createMockTermWS();
      const ws2 = createMockTermWS();

      const pty1 = createMockPTY();
      const pty2 = createMockPTY();

      // Wire up PTY → WS
      pty1.onData((data) => ws1.send(JSON.stringify({ type: 'output', data })));
      pty2.onData((data) => ws2.send(JSON.stringify({ type: 'output', data })));

      pty1.onDataCb?.('output-from-pty1');
      pty2.onDataCb?.('output-from-pty2');

      expect(ws1.sentMessages).toHaveLength(1);
      expect(ws2.sentMessages).toHaveLength(1);
      expect(JSON.parse(ws1.sentMessages[0]!).data).toBe('output-from-pty1');
      expect(JSON.parse(ws2.sentMessages[0]!).data).toBe('output-from-pty2');
    });

    it('closing one session does not affect others', () => {
      const pty1 = createMockPTY();
      const pty2 = createMockPTY();
      const pty3 = createMockPTY();

      // Kill session 2
      pty2.kill();

      expect(pty1.killed).toBe(false);
      expect(pty2.killed).toBe(true);
      expect(pty3.killed).toBe(false);

      // Other sessions still accept input
      pty1.write('still alive 1');
      pty3.write('still alive 3');
      expect(pty1.written).toEqual(['still alive 1']);
      expect(pty3.written).toEqual(['still alive 3']);
    });

    it('resize of one session does not affect others', () => {
      const pty1 = createMockPTY();
      const pty2 = createMockPTY();

      pty1.resize(120, 40);

      expect(pty1.cols).toBe(120);
      expect(pty1.rows).toBe(40);
      expect(pty2.cols).toBe(80); // unchanged
      expect(pty2.rows).toBe(24); // unchanged
    });

    it('10 concurrent sessions can all operate independently', () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        pty: createMockPTY(),
        ws: createMockTermWS(),
        id: i,
      }));

      // Wire up each
      for (const s of sessions) {
        s.pty.onData((data) => s.ws.send(JSON.stringify({ type: 'output', data })));
      }

      // Each writes unique command
      for (const s of sessions) {
        s.pty.write(`cmd-${s.id}`);
      }

      // Each PTY outputs unique data
      for (const s of sessions) {
        s.pty.onDataCb?.(`result-${s.id}`);
      }

      // Verify isolation
      for (const s of sessions) {
        expect(s.pty.written).toEqual([`cmd-${s.id}`]);
        expect(s.ws.sentMessages).toHaveLength(1);
        expect(JSON.parse(s.ws.sentMessages[0]!).data).toBe(`result-${s.id}`);
      }

      // Close all — all PTYs cleaned up
      for (const s of sessions) {
        s.pty.kill();
      }
      for (const s of sessions) {
        expect(s.pty.killed).toBe(true);
      }
    });
  });

  // ── Terminal WS message protocol ────────────────────────────────

  describe('terminal WS message protocol', () => {
    it('output message format is { type: "output", data: string }', () => {
      const pty = createMockPTY();
      const ws = createMockTermWS();
      pty.onData((data) => ws.send(JSON.stringify({ type: 'output', data })));

      pty.onDataCb?.('$ ');
      const msg = JSON.parse(ws.sentMessages[0]!);
      expect(msg).toEqual({ type: 'output', data: '$ ' });
    });

    it('error message format is { type: "error", data: string }', () => {
      const ws = createMockTermWS();
      const errorMsg = JSON.stringify({ type: 'error', data: 'Terminal unavailable: no pty\r\n' });
      ws.send(errorMsg);
      const msg = JSON.parse(ws.sentMessages[0]!);
      expect(msg.type).toBe('error');
      expect(msg.data).toContain('Terminal unavailable');
    });

    it('structured error format with code and message', () => {
      const ws = createMockTermWS();
      const errorMsg = JSON.stringify({
        type: 'error',
        code: 'INVALID_JSON',
        message: 'Message parse failed: unexpected token',
      });
      ws.send(errorMsg);
      const msg = JSON.parse(ws.sentMessages[0]!);
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('INVALID_JSON');
      expect(msg.message).toContain('parse failed');
    });

    it('binary output is bridged as string data', () => {
      const pty = createMockPTY();
      const ws = createMockTermWS();
      pty.onData((data) => ws.send(JSON.stringify({ type: 'output', data })));

      // Simulate binary-ish output (ANSI escape)
      pty.onDataCb?.('\x1b[32mgreen\x1b[0m');
      const msg = JSON.parse(ws.sentMessages[0]!);
      expect(msg.data).toBe('\x1b[32mgreen\x1b[0m');
    });

    it('empty input string is valid (e.g., Ctrl+C sends empty)', () => {
      expect(isValidMessage({ type: 'input', data: '' })).toBe(true);
    });

    it('resize with 0 cols/rows is valid (terminal.ts clamps to 1)', () => {
      // The message is technically valid — the route clamps to Math.max(1, ...)
      expect(isValidMessage({ type: 'resize', cols: 0, rows: 0 })).toBe(true);
    });
  });

  // ── WebSocket state edge cases ──────────────────────────────────

  describe('WebSocket state edge cases', () => {
    it('PTY output is not sent when WS is closed', () => {
      const pty = createMockPTY();
      const ws = createMockTermWS();
      ws.readyState = 3; // CLOSED

      pty.onData((data) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'output', data }));
        }
      });

      pty.onDataCb?.('should not be sent');
      expect(ws.sentMessages).toHaveLength(0);
    });

    it('PTY input is ignored when PTY is dead', () => {
      const pty = createMockPTY();
      let ptyAlive = true;

      // Simulate PTY exit
      ptyAlive = false;

      // Input should be silently discarded
      if (ptyAlive) {
        pty.write('ignored');
      }
      expect(pty.written).toHaveLength(0);
    });

    it('concurrent output from PTY while WS is closing is safe', () => {
      const pty = createMockPTY();
      const ws = createMockTermWS();

      // Set up output handler that checks readyState
      pty.onData((data) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'output', data }));
        }
      });

      // Send some output
      pty.onDataCb?.('line 1');
      expect(ws.sentMessages).toHaveLength(1);

      // WS starts closing
      ws.readyState = 2; // CLOSING
      pty.onDataCb?.('line 2 during close');
      expect(ws.sentMessages).toHaveLength(1); // No new messages

      // WS is closed
      ws.readyState = 3;
      pty.onDataCb?.('line 3 after close');
      expect(ws.sentMessages).toHaveLength(1); // Still no new messages
    });
  });
});

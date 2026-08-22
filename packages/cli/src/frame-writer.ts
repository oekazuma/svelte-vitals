import { terminalSafe } from '@svelte-vitals/core/internal';

/**
 * In-place repaint for the CLI's multi-line frames (spinner, greeting, score animation).
 * Frames are authored in 1-column glyphs — pinned by frame-writer.test.ts — so a line's rendered
 * height is its ANSI-stripped code-point count over `stream.columns`, and the erase sequence
 * steps back over exactly that many rows. Design record:
 * docs/superpowers/specs/2026-08-22-drop-log-update-design.md.
 */
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const EXIT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP'] as const;

export interface FrameWriter {
  (frame: string): void;
  /** Erases the current frame and restores the cursor; the next render starts fresh. */
  clear(): void;
  /** Leaves the current frame on screen and restores the cursor. */
  done(): void;
}

let cursorHiddenOn: NodeJS.WriteStream | null = null;
let exitHooksInstalled = false;

function showCursor(): void {
  if (!cursorHiddenOn) return;
  cursorHiddenOn.write(SHOW_CURSOR);
  cursorHiddenOn = null;
}

function hideCursor(stream: NodeJS.WriteStream): void {
  if (cursorHiddenOn || !stream.isTTY) return;
  cursorHiddenOn = stream;
  stream.write(HIDE_CURSOR);
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;
  process.once('exit', showCursor);
  // Signal death skips 'exit', so restore the cursor here and re-raise for the default exit
  // status — unless something else (a prompt) has its own handler for the signal.
  for (const signal of EXIT_SIGNALS) {
    process.once(signal, () => {
      showCursor();
      if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
    });
  }
}

export function createFrameWriter(stream: NodeJS.WriteStream): FrameWriter {
  let rows = 0;
  let last = '';
  let lastColumns = 0;
  let lastLimit = 0;
  const write = (out: string): void => {
    if (out === '') return;
    // Synchronized output: the terminal holds the erase + repaint until the sequence ends.
    stream.write(stream.isTTY ? `\x1b[?2026h${out}\x1b[?2026l` : out);
  };
  // After a render the cursor sits on the blank line below the frame: erase it, then step up
  // through every rendered row, ending at column 0 of the frame's first row.
  const erase = (): string => (rows === 0 ? '' : `\x1b[2K${'\x1b[1A\x1b[2K'.repeat(rows)}\x1b[G`);
  const reset = (): void => {
    rows = 0;
    last = '';
    showCursor();
  };
  return Object.assign(
    (frame: string): void => {
      const columns = stream.columns || 80;
      const limit = (stream.rows || 24) - 1;
      if (frame === last && columns === lastColumns && limit === lastLimit) return;
      const rowsOf = (line: string): number => Math.max(1, Math.ceil([...terminalSafe(line)].length / columns));
      const lines = frame.split('\n');
      let height = lines.reduce((n, line) => n + rowsOf(line), 0);
      // A frame taller than the viewport scrolls, and `\x1b[1A` cannot climb back past the top
      // row — drop leading lines until the frame and its trailing newline fit; if the last line
      // alone still overflows, draw nothing rather than scroll.
      while (lines.length > 1 && height > limit) height -= rowsOf(lines.shift()!);
      if (height > limit) {
        write(erase());
        rows = 0;
      } else {
        hideCursor(stream);
        write(`${erase()}${lines.join('\n')}\n`);
        rows = height;
      }
      last = frame;
      lastColumns = columns;
      lastLimit = limit;
    },
    {
      clear(): void {
        write(erase());
        reset();
      },
      done: reset
    }
  );
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface Spinner {
  stop(): void;
}

/** A minimal stderr spinner. When `enabled` is false it is a no-op. */
export function startSpinner(text: string, opts: { enabled: boolean; stream?: NodeJS.WriteStream }): Spinner {
  const stream = opts.stream ?? process.stderr;
  if (!opts.enabled) return { stop() {} };
  let i = 0;
  const tick = (): void => {
    stream.write(`\r${FRAMES[i % FRAMES.length]} ${text}`);
    i++;
  };
  tick();
  const timer = setInterval(tick, 80);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop() {
      clearInterval(timer);
      stream.write('\r\x1b[K');
    }
  };
}

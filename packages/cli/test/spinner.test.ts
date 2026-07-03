import { describe, it, expect } from 'vitest';
import { startSpinner } from '../src/spinner.js';

function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

describe('startSpinner', () => {
  it('writes nothing when disabled and returns a working stop()', () => {
    const { writes, stream } = fakeStream();
    const spin = startSpinner('Analyzing…', { enabled: false, stream });
    spin.stop();
    expect(writes).toEqual([]);
  });
  it('writes a frame immediately when enabled and clears on stop', () => {
    const { writes, stream } = fakeStream();
    const spin = startSpinner('Analyzing…', { enabled: true, stream });
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]).toContain('Analyzing…');
    spin.stop();
    expect(writes[writes.length - 1]).toContain('\x1b[K'); // clears the line
  });
});

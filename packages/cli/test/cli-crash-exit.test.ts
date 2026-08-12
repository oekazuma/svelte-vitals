import { describe, it, expect, vi } from 'vitest';
import { captureIO } from './helpers/capture-io.js';

// Any throw that escapes the dispatchers in `runCli` (e.g. gunshi's `cli()` or a locale-plugin
// import) must map to exit 2, not propagate as an unhandled rejection. Stubbing the root
// analyzer is the smallest way to force a throw past the dispatch layer end-to-end.
vi.mock('../src/gunshi/analyze.js', () => ({
  runAnalyzeCliGunshi: async () => {
    throw new Error('synthetic dispatch crash (test)');
  }
}));

const { runCli } = await import('../src/cli.js');

describe('runCli crash isolation', () => {
  it('maps a dispatch-layer throw to exit 2 with a one-line diagnostic', async () => {
    const io = captureIO();
    const result = await runCli(['some-path'], io);
    expect(result).toEqual({ code: 2, exit: 'natural' });
    expect(io.err).toMatch(/^svelte-vitals: synthetic dispatch crash \(test\)$/);
    expect(io.err).not.toContain('\n');
  });
});

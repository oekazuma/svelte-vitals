import { describe, it, expect, vi } from 'vitest';
import { terminalSafe } from '@svelte-vitals/core/internal';
import { createFrameWriter } from '../src/frame-writer.js';
import { playScoreAnimation } from '../src/pulse-animation.js';
import { GREETING_MESSAGES, REACTION_MESSAGES, playMascotGreeting } from '../src/speech-bubble.js';
import { renderMascotIdleFrame, startMascotSpinner } from '../src/mascot.js';
import { ansiPalette } from '../src/color.js';
import { fakeStream } from './helpers/fake-stream.js';

const erase = (rows: number) => `\x1b[2K${'\x1b[1A\x1b[2K'.repeat(rows)}\x1b[G`;

describe('createFrameWriter', () => {
  it('erases as many rows as the previous frame occupied, wrapped lines included', () => {
    const { writes, stream } = fakeStream({ columns: 19 });
    const render = createFrameWriter(stream);
    const wave = `${'─'.repeat(24)}\nHealth: 10/100`; // 24 columns wrap to 2 rows at 19, plus 1
    const settled = 'Health: 10/100';

    render(wave);
    render(settled);
    render.clear();
    render.clear();

    expect(writes).toEqual([`${wave}\n`, `${erase(3)}${settled}\n`, erase(1)]);
  });

  it('skips a frame identical to the last one unless the width changed', () => {
    const { writes, stream } = fakeStream({ columns: 19 });
    const render = createFrameWriter(stream);
    const wave = `${'─'.repeat(24)}\nHealth: 10/100`;

    render(wave);
    render(wave);
    stream.columns = 80;
    render(wave);
    render.clear();
    render(wave);

    expect(writes).toEqual([`${wave}\n`, `${erase(3)}${wave}\n`, erase(2), `${wave}\n`]);
  });

  it('ignores ANSI sequences when measuring a line', () => {
    const { writes, stream } = fakeStream({ columns: 10 });
    const render = createFrameWriter(stream);

    render(`\x1b[38;2;255;62;0m${'x'.repeat(10)}\x1b[0m`);
    render.clear();

    expect(writes[1]).toBe(erase(1));
  });

  it('drops leading lines when the frame would not fit the terminal height', () => {
    const { writes, stream } = fakeStream({ rows: 4 });
    const render = createFrameWriter(stream);

    render('one\ntwo\nthree\nfour\nfive');
    render.clear();

    expect(writes).toEqual(['three\nfour\nfive\n', erase(3)]);
  });

  it('forgets the frame on done() without erasing it', () => {
    const { writes, stream } = fakeStream();
    const render = createFrameWriter(stream);

    render('a');
    render.done();
    render('b');

    expect(writes).toEqual(['a\n', 'b\n']);
  });

  // The row count assumes every glyph is 1 column wide, so the frames may only use the glyph
  // families listed here; anything new (CJK, emoji, fullwidth) needs a width decision first.
  it('every authored frame and message is 1-column glyphs only', async () => {
    vi.useFakeTimers();
    const { writes, stream } = fakeStream();
    try {
      for (const score of [82, 95, 100]) {
        await playScoreAnimation({ score, palette: ansiPalette, stream, frameDelayMs: 0 });
      }
      await playMascotGreeting({ enabled: true, stream, holdMs: 0 });
      const plain = startMascotSpinner('Analyzing…', { enabled: true, stream, mascot: false });
      vi.advanceTimersByTime(80 * 10);
      plain.stop();
    } finally {
      vi.useRealTimers();
    }
    for (let i = 0; i < 24; i++) writes.push(renderMascotIdleFrame(i));
    const text = terminalSafe([...writes, ...GREETING_MESSAGES, ...Object.values(REACTION_MESSAGES).flat()].join('\n'));

    expect(text).toMatch(/^[\x20-\x7e\n·…─-╿●◡⠀-⣿]*$/u);
  });
});

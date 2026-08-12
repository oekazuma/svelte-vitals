import { styleText } from 'node:util';
import { noColorPalette, type Palette } from '@svelte-vitals/core';

export { noColorPalette };

// validateStream: false so colorEnabled() below stays the sole gate (styleText
// would otherwise consult the stream and NO_COLOR/FORCE_COLOR itself).
const wrap =
  (format: Parameters<typeof styleText>[0]) =>
  (s: string): string =>
    styleText(format, s, { validateStream: false });

export const ansiPalette: Palette = {
  bold: wrap('bold'),
  dim: wrap('dim'),
  red: wrap('red'),
  yellow: wrap('yellow'),
  green: wrap('green'),
  cyan: wrap('cyan')
};

/** Whether ANSI color is enabled, following the de-facto env conventions. */
export function colorEnabled(opts: {
  reporter: string;
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
  noColorFlag?: boolean;
}): boolean {
  if (opts.noColorFlag) return false;
  if (opts.env.NO_COLOR !== undefined && opts.env.NO_COLOR !== '') return false;
  const fc = opts.env.FORCE_COLOR;
  if (fc !== undefined && fc !== '' && fc !== '0') return true;
  return opts.reporter === 'console' && opts.isTTY;
}

export const paletteFor = (enabled: boolean): Palette => (enabled ? ansiPalette : noColorPalette);

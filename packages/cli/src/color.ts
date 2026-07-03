import { noColorPalette, type Palette } from '@svelte-vitals/core';

const wrap =
  (open: number, close = 0) =>
  (s: string): string =>
    `\x1b[${open}m${s}\x1b[${close}m`;

/** Hand-rolled ANSI palette (no dependency). */
export const ansiPalette: Palette = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  yellow: wrap(33, 39),
  green: wrap(32, 39),
  cyan: wrap(36, 39)
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

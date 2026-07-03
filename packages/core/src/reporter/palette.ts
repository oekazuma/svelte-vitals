/** String decorators for the console reporter. Injected so core stays pure/dep-free. */
export interface Palette {
  bold: (s: string) => string;
  dim: (s: string) => string;
  red: (s: string) => string;
  yellow: (s: string) => string;
  green: (s: string) => string;
  cyan: (s: string) => string;
}

/** Default: no decoration (identity) — output is byte-identical to plain text. */
export const noColorPalette: Palette = {
  bold: (s) => s,
  dim: (s) => s,
  red: (s) => s,
  yellow: (s) => s,
  green: (s) => s,
  cyan: (s) => s
};

/** Green ≥ 90, yellow ≥ 70, red otherwise — for a 0–100 score. */
export function scoreColor(p: Palette, score: number): (s: string) => string {
  if (score >= 90) return p.green;
  if (score >= 70) return p.yellow;
  return p.red;
}

// Shared detection shapes for rules that emit explicit pass/fail Results.
// A failing finding reports as if the (good) tag were absent; a pass reports the
// tag as present and static. Kept in one place so the convention stays single-sourced.

export const PENALIZED = { presence: 'none', value: 'absent' } as const;
export const PASS = { presence: 'own', value: 'static' } as const;

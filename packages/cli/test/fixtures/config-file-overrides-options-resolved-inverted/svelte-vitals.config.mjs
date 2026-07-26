/**
 * Neither layer is inverted against its own built-in default in isolation:
 * `min: 40` alone is <= the built-in max of 60, and `max: 35` alone is >= the
 * built-in min of 30. But the effective range at `/x` — min 40 (from the
 * global layer) merged with max 35 (from the override) — is inverted. The
 * per-layer-only cross-check let this through; the baseline-aware one must
 * catch it (design 2026-07-26 review, Finding A).
 */
export default {
  rules: {
    'seo/title-length': { options: { min: 40 } }
  },
  overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { max: 35 } } } }]
};

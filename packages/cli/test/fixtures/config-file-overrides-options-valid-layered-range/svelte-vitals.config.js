/**
 * The global range (100–200) is valid, and the override only narrows `min` to
 * 150 — the effective range at `/x` is 150–200, also valid. Validating the
 * override's `{ min: 150 }` alone against the built-in max of 60 would
 * falsely reject this (design 2026-07-26 review, Finding A).
 */
export default {
  rules: {
    'seo/title-length': { options: { min: 100, max: 200 } }
  },
  overrides: [{ route: '/x', rules: { 'seo/title-length': { options: { min: 150 } } } }]
};

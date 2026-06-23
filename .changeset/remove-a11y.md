---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

**Remove the Accessibility (a11y) category.** svelte-vitals now focuses on SEO and
Performance; accessibility is well covered by the Svelte compiler, eslint-plugin-svelte,
and axe. This removes the a11y collector (the aggregated Svelte `a11y_*` compiler
warnings), the `a11y` category from the score/Health breakdown and reporters, and the
`--ignore a11y_*` / allow-list a11y handling. `Category` is now `'seo' | 'performance'`,
and the Health score averages SEO + Performance. **Breaking:** a11y findings and the
`categories.a11y` entry no longer appear in any reporter or the MCP `analyze` output.

---
'@svelte-vitals/core': minor
---

Fix PERF009 (heavy dependency import) always reporting `line: 0` for its findings. `ComponentFacts` gains `importSpans` (module specifiers with their real source line), and PERF009 now uses it instead of the line-less `imports`. Because `componentRule`'s suppression check only looks up an inline directive when a finding's `line > 0`, this also fixes `// svelte-vitals-disable-next-line PERF009` silently never suppressing a PERF009 finding.

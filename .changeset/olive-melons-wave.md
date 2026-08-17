---
'@svelte-vitals/core': minor
---

Promote report rendering and gating into the stable entry.

`summarize`, `hasFailureAtOrAbove`, `formatGithubReport` and `formatMarkdownReport` are now exported
from `@svelte-vitals/core` as well as `@svelte-vitals/core/internal`.

The first-party GitHub Action draws an analysis onto three GitHub surfaces — diff annotations, the
job summary, and a sticky PR comment — and gates its step on the result. `analyzeProject` and
`applyScope` were already stable, so the analysis entry was covered while rendering and gating were
not, and the Action's committed bundle depended on an entry that promises nothing across a patch.

The promotion is a pure re-export. Every type these four reference — `Result`, `Config`, `Summary`,
`Severity` — was already exported from the stable entry, so its type surface is unchanged.

**What this freezes is each function's existence and signature, not the text it returns.** Markdown
and workflow-command output stay human- and agent-readable: their prose, ordering and caps may
change in any release. Call them to render; read `JsonReport` if you need to parse.

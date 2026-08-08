---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`performance/minify-disabled`: the rule's rationale claimed "Vite minifies with esbuild by default" — false since Vite 8, which defaults to its own Oxc minifier and made `esbuild` an optional peer dependency. The machine `fix.snippet` wrote `minify: 'esbuild'`, which an agent applying it verbatim would ship as a build newly requiring an undeclared dependency. The description and snippet now describe removing/scoping the override without naming a minifier; docs (en/ja) drop the stale esbuild-default claim and add `'oxc'` to the not-flagged list.

`performance/preconnect`: the machine `fix.snippet` preconnected only `fonts.googleapis.com`. Google Fonts serves the actual font files from `fonts.gstatic.com` under anonymous CORS, so the canonical fix — already shown in the rule's own docs — is the two-link pair, the second carrying `crossorigin`. The snippet now matches the docs.

`performance/render-blocking-script`: both collectors (`svelte-vitals`'s static parse and `@svelte-vitals/vite`'s rendered-HTML parse) marked a `<script src>` render-blocking whenever it lacked `defer`/`async`/`type="module"`, which false-positived on non-executing script types — most notably `type="text/partytown"`, SvelteKit's own recommended way to offload third-party scripts off the main thread, plus `type="importmap"` and `type="speculationrules"`. None of these execute as a classic script, so none can block HTML parsing. Both collectors now flag only a script whose `type` is absent, empty, or a JavaScript MIME type (a classic script) and that lacks `defer`/`async` — a strict narrowing of detection, removing this false positive without adding any new one.

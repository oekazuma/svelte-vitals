---
'svelte-vitals': patch
---

`correctness/unmutated-state` now tells two bindings of one name apart. A parameter or local named like a `$state`, or like a local holding one, is its own binding and no longer stands in for the state:

- Writing through it, passing it, returning it or placing it no longer counts as using the state (`function use(s) { const d = s[0]; d.push(1); }`, or `const list = items; function f(list) { list.push(1); }`), so a state used only that way is now reported.
- Rebinding a local in one function no longer stops a same-named local elsewhere from carrying its state's writes (`const d = s[0]; d.n = 1; function f() { let d = []; d = [1]; }`), so `s` is no longer reported.
- Locals of one name that hold different states keep their writes apart, so a local named like one state that holds another (`function f() { const s = other[0]; s.x = 1; }`) mutates `other`, not `s`. A local declared in a template handler is no longer matched against an `{#each}` item of the same name.
- A `$state` declared in a function is no longer written by a top-level variable of its name, in the script or in a template handler (`let count = 0; function make() { let count = $state(0); … } count++;`), so it is now reported when nothing else writes it.

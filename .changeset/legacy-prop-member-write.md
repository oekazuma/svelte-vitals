---
'@svelte-vitals/core': patch
---

`correctness/prop-mutation` no longer flags a member write or update on a legacy `export let` prop (`collection.items = […]`, `user.count++`). The legacy compiler turns such a write into an update of the prop, so the warning that it "will not update the UI" was false. Mutating method calls (`items.push(…)`) and `delete` on a legacy prop are still reported, and runes-mode props are unaffected.

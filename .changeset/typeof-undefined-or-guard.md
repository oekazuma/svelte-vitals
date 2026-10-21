---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

`correctness/instance-browser-global` and `correctness/server-browser-global` no longer report `G` read on the right side of `typeof G === 'undefined' || …` (with `G` a browser global they track), which only runs where `G` is defined: `Boolean(user) && (typeof localStorage === 'undefined' || Boolean(localStorage.getItem('token')))` in a component's `<script>`. Other globals there are still reported, since a server may define `G` too (Node defines `localStorage`), unless `G` is `window` or `document`.

---
'@svelte-vitals/core': patch
'svelte-vitals': patch
---

`correctness/instance-browser-global` and `correctness/server-browser-global` read the right side of `typeof G === 'undefined' || …` (with `G` a browser global they track) as guarded, as they already read the right side of `!browser || …`: it only runs where `G` is defined. `Boolean(user) && (typeof localStorage === 'undefined' || Boolean(localStorage.getItem('token')))` in a component's `<script>` is no longer reported.

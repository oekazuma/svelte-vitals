---
'@svelte-vitals/core': patch
---

`correctness/server-browser-global` no longer reports a `<script module>` use of a name imported in the component's instance `<script>` when that name matches a browser global (`import alert from 'some-lib/alert'` used as `alert()` in `<script module>`). Svelte hoists instance-script imports to module scope, so the name refers to the import, not the global.

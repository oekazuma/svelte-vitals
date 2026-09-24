---
'@svelte-vitals/core': patch
---

`architecture/route-component-import` no longer reports an import of named exports only from a route entry (`import { theme } from './+layout.svelte'`, reading its `<script module>` exports): such an import never takes the component, so nothing renders without its data. Default, `default as`, and namespace imports are still reported.

<!--
  Not a route file (no `+` prefix), so SvelteKit's router never bundles this —
  glob-collected for static analysis (src/**/*.svelte) but never imported. `lodash`
  isn't an installed dependency: importing it from a real route would fail module
  resolution during `vite build`/`vite dev`.
-->
<script lang="ts">
  // performance/heavy-import: bare, non-tree-shakeable package specifier.
  // @ts-expect-error -- lodash is deliberately not installed (see the file comment).
  import _ from 'lodash';
  console.log(_);
</script>

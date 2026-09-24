<script lang="ts">
  // OpaqueSeo comes through a Vite-only alias the static analyzer cannot follow and carries this
  // route's entire meta family; only the `metaComponents: ['OpaqueSeo']` declaration keeps this
  // route clean (e2e-suppression removes the declaration and expects findings here).
  import OpaqueSeo from '@opaque-seo';
  // JsonLd is resolvable AND declared in metaComponents — the declaration must stay a no-op:
  // broad credit never covers JSON-LD, so this route's seo/json-ld pass proves the analyzer
  // still followed the wrapper (issue #584).
  import JsonLd from '$lib/clean/jsonld/OpaquePage.svelte';
</script>

<OpaqueSeo />
<JsonLd />

<h1>Opaque meta source</h1>
<p>
  This route's head metadata comes entirely from a component the static analyzer cannot follow, so it exercises the
  <code>metaComponents</code> declaration end to end.
</p>

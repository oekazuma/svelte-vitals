<script lang="ts">
  // OpaqueSeo is unresolvable statically (see $lib/clean/seo/index.ts) and carries this route's
  // entire meta family; only the `metaComponents: ['OpaqueSeo']` declaration keeps this route
  // clean. If the lever ever becomes a no-op, the clean-canary e2e fails with missing-title here.
  import OpaqueSeo from '$lib/clean/seo';
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

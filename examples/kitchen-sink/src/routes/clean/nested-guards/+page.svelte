<!-- The two <h1>s sit under `open || editing` and, in another block, under `!open` then `!editing`: no state renders both. -->
<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/NestedGuardsPage.svelte';

  let open = $state(true);
  let editing = $state(false);
</script>

<svelte:head>
  <title>Nested guards canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose heading comes from one of two blocks whose guards, read through nesting, never hold together."
  />
  <link rel="canonical" href="https://example.com/clean/nested-guards" />
  <meta property="og:title" content="Nested guards canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose heading comes from one of two blocks whose guards, read through nesting, never hold together."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/nested-guards" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

{#if open || editing}
  <h1>Nested guards canary</h1>
{/if}
<button type="button" onclick={() => (open = !open)}>Toggle</button>
<button type="button" onclick={() => (editing = !editing)}>Edit</button>
{#if !open}
  <p>Closed.</p>
  {#if !editing}
    <h1>Nested guards canary, closed</h1>
  {/if}
{/if}

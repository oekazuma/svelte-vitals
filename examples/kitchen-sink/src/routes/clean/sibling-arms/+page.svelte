<!-- The two <h1>s sit in sibling {#if} blocks whose conditions contradict each other, so one renders. The JSON-LD comes from a list named for structured data, serialized with `<` escaped. -->
<script lang="ts">
  import { jsonLd } from '$lib/clean/sibling-arms/seo';

  let pitch = $state(true);
  const structuredData = [jsonLd({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Sibling arms' })];
</script>

<svelte:head>
  <title>Sibling arms canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose heading comes from one of two sibling blocks that never render together."
  />
  <link rel="canonical" href="https://example.com/clean/sibling-arms" />
  <meta property="og:title" content="Sibling arms canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose heading comes from one of two sibling blocks that never render together."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/sibling-arms" />
  <meta name="twitter:card" content="summary_large_image" />
  {#each structuredData as ld, i (i)}
    <!-- svelte-vitals-disable-next-line security/raw-html -->
    {@html ld}
  {/each}
</svelte:head>

{#if pitch}
  <h1>Sibling arms canary</h1>
{/if}
<button type="button" onclick={() => (pitch = !pitch)}>Toggle</button>
{#if !pitch}
  <h1>Sibling arms canary, the other way</h1>
{/if}

<!-- Its <main> renders only signed out, when the layout adds none: one <main>, never nested. -->
<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/DataArmsPage.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Layout and page arms canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A layout and a page that choose their main landmark by the same signed-in field of the load data."
  />
  <link rel="canonical" href="https://example.com/clean/data-arms" />
  <meta property="og:title" content="Layout and page arms canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A layout and a page that choose their main landmark by the same signed-in field of the load data."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/data-arms" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

{#if !data.user}
  <main>
    <h1>Sign in</h1>
    <p>Sign in to see the staff panel.</p>
  </main>
{:else}
  <div>
    <h1>Staff panel</h1>
  </div>
{/if}

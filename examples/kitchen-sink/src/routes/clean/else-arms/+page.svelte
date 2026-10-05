<!-- The header's <h1> renders only when signed in; the other <h1> sits in the {:else} of a block on the same test, so one renders. -->
<script lang="ts">
  import { jsonLd } from '$lib/clean/sibling-arms/seo';

  let signedIn = $state(false);
  const structuredData = [jsonLd({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Else arms' })];
</script>

<svelte:head>
  <title>Else arms canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose heading comes from a one-arm block or from the else arm of a block on the same test."
  />
  <link rel="canonical" href="https://example.com/clean/else-arms" />
  <meta property="og:title" content="Else arms canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose heading comes from a one-arm block or from the else arm of a block on the same test."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/else-arms" />
  <meta name="twitter:card" content="summary_large_image" />
  {#each structuredData as ld, i (i)}
    <!-- svelte-vitals-disable-next-line security/raw-html -->
    {@html ld}
  {/each}
</svelte:head>

<div>
  {#if signedIn}
    <h1>Else arms canary</h1>
  {/if}
</div>
<div>
  {#if signedIn}
    <p>Signed in.</p>
  {:else}
    <h1>Else arms canary, signed out</h1>
    <button type="button" onclick={() => (signedIn = true)}>Sign in</button>
  {/if}
</div>

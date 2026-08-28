<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/CleanPage.svelte';

  let status = $state<'online' | 'offline'>('online');
  let detailsEl = $state<HTMLDivElement>();

  function checkStatus() {
    status = status === 'online' ? 'offline' : 'online';
    detailsEl?.focus();
  }
</script>

<svelte:head>
  <title>Clean canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A hand-built page exercising the accessibility patterns that once tripped up svelte-vitals, kept intentionally free of findings."
  />
  <link rel="canonical" href="https://example.com/clean" />
  <meta property="og:title" content="Clean canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A hand-built page exercising the accessibility patterns that once tripped up svelte-vitals, kept intentionally free of findings."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Clean canary</h1>
<p>
  This route exercises a conditional heading and an in-page fragment link to a focus target — patterns that earlier
  versions of svelte-vitals mistakenly flagged.
  <a href="#clean-details">Jump to status</a>.
</p>

{#if status === 'online'}
  <h2>Service is online</h2>
{:else}
  <h2>Service is offline</h2>
{/if}

<button type="button" onclick={checkStatus}>Check status</button>

<div id="clean-details" tabindex="-1" bind:this={detailsEl}>
  <p>Status detail focuses here when "Check status" is activated.</p>
</div>

<!-- The toggle pattern a11y/aria-hidden-focus must never flag: aria-hidden is an expression. -->
<div aria-hidden={status === 'online'}>
  <button type="button" onclick={checkStatus}>Reconnect</button>
</div>

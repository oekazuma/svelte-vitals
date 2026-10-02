<!-- The saved note renders only while a rule exists, i.e. with the `{:else}` arm above and its <h2>. -->
<script lang="ts">
  import SectionTitle from '$lib/clean/arms/SectionTitle.svelte';
  import JsonLd from '$lib/clean/jsonld/SessionPage.svelte';

  let { data } = $props();
  let rule = $state<string | null>(null);
  let saved = $state(false);
</script>

<svelte:head>
  <title>Session canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose load reads a session it initialized, with a heading that renders only after its section title."
  />
  <link rel="canonical" href="https://example.com/clean/session" />
  <meta property="og:title" content="Session canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose load reads a session it initialized, with a heading that renders only after its section title."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/session" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>{data.greeting}</h1>
{#if !rule}
  <button type="button" onclick={() => (rule = 'weekly')}>Add a rule</button>
{:else}
  <SectionTitle />
  <button type="button" onclick={() => (saved = true)}>Save</button>
{/if}
{#if saved && rule}
  <h3>Saved</h3>
{/if}

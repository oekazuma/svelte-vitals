<!-- The <h1> comes from a component in one arm and the page in the other; the modal's <title> renders only while it is open. -->
<script lang="ts">
  import { Heading } from '$lib/clean/page';
  import LoginModal from '$lib/clean/branches/LoginModal.svelte';
  import JsonLd from '$lib/clean/jsonld/BranchesPage.svelte';

  let { data } = $props();

  let loginOpen = $state(false);
</script>

<svelte:head>
  <title>Component arms canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose heading comes from a component in one if arm, and whose login modal sets its own title only while open."
  />
  <link rel="canonical" href="https://example.com/clean/branches" />
  <meta property="og:title" content="Component arms canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose heading comes from a component in one if arm, and whose login modal sets its own title only while open."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/branches" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

{#if data.post}
  <Heading>{data.post.title}</Heading>
{:else}
  <h1>Post not found</h1>
{/if}

<button type="button" onclick={() => (loginOpen = true)}>Log in to comment</button>

{#if loginOpen}
  <LoginModal onclose={() => (loginOpen = false)} />
{/if}

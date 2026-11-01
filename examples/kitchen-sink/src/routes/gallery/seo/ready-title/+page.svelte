<script lang="ts">
  import { onMount } from 'svelte';
  import ReadyTitle from '$lib/gallery/ReadyTitle.svelte';

  let ready = $state(false);
  onMount(() => {
    ready = true;
  });
</script>

<svelte:head>
  <meta
    name="description"
    content="This route is server-rendered, but the component that sets its title renders only after it mounts in the browser."
  />
  <link rel="canonical" href="https://example.com/gallery/seo/ready-title" />
  <meta property="og:title" content="Route titled only once the browser mounts it" />
  <meta property="og:description" content="A server-rendered route whose title component waits for onMount." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/ready-title" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "Route titled only once the browser mounts it" }
  </script>
</svelte:head>

{#if ready}
  <ReadyTitle />
{/if}

<h1>Route titled only once the browser mounts it</h1>
<p>
  The server-rendered HTML has no <code>&lt;title&gt;</code>: <code>ready</code> turns true only in
  <code>onMount</code>.
</p>

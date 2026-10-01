<script lang="ts">
  import BindableDraft from '$lib/clean/BindableDraft.svelte';
  import JsonLd from '$lib/clean/jsonld/UrlArmsPage.svelte';

  let draft = $state({ title: '' });
</script>

<svelte:head>
  <title>URL-decided layout arms canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page whose layout leaves out its shared note on this path, with an ARIA heading in its outline."
  />
  <link rel="canonical" href="https://example.com/clean/url-arms/bare" />
  <meta property="og:title" content="URL-decided layout arms canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose layout leaves out its shared note on this path, with an ARIA heading in its outline."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/url-arms/bare" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>URL-decided layout arms canary</h1>
<p id="section-note">This page carries its own note.</p>
<div role="heading" aria-level="2">Draft</div>
<h3>Title</h3>
<BindableDraft bind:draft />

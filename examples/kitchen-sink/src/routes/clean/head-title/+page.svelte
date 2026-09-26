<!-- The <title> is the top-level element of <PageTitle>, which this page renders inside <svelte:head>. -->
<script lang="ts">
  import PageTitle from '$lib/clean/head/PageTitle.svelte';
  import JsonLd from '$lib/clean/jsonld/HeadTitlePage.svelte';
</script>

<svelte:head>
  <PageTitle text="Head component title canary — svelte-vitals kitchen sink" />
  <meta
    name="description"
    content="A page whose document title is written at the top level of a component rendered inside the head."
  />
  <link rel="canonical" href="https://example.com/clean/head-title" />
  <meta property="og:title" content="Head component title canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page whose document title is written at the top level of a component rendered inside the head."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/head-title" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Head component title canary</h1>
<p>The title above comes from a component, not from a title tag in this file.</p>

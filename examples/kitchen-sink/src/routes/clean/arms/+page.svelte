<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/ArmsPage.svelte';
  import LevelPicker from '$lib/clean/arms/LevelPicker.svelte';
  import LikeButton from '$lib/clean/arms/LikeButton.svelte';

  let { data } = $props();

  let enabled = $state.raw(['info']);
</script>

<svelte:head>
  <title>Layout arms canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A page rendered in one arm of its layout's if block, whose other arm shows a sign-in form with the same id and its own heading."
  />
  <link rel="canonical" href="https://example.com/clean/arms" />
  <meta property="og:title" content="Layout arms canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A page rendered in one arm of its layout's if block, whose other arm shows a sign-in form with the same id and its own heading."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/arms" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Layout arms canary</h1>
<p>Signed in as {data.user?.name}; this page has {data.views} views.</p>

<label for="email">Newsletter email</label>
<input id="email" type="email" autocomplete="email" />

<LevelPicker config={{ levels: enabled }} onChange={(next) => (enabled = next)} />
<LikeButton />

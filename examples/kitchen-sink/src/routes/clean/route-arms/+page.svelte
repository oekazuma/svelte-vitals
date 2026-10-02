<!-- The layout's section <h1> is decided away on this route by its id; the card's <h2> precedes the <h3>. -->
<script lang="ts">
  import Card from '$lib/clean/arms/Card.svelte';
  import { Steps } from '$lib/clean/dot';
  import { t } from '$lib/clean/i18n';
  import JsonLd from '$lib/clean/jsonld/RouteArmsPage.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Route arms canary — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A section index whose layout heading is decided away by the route id, with a card heading before its own."
  />
  <link rel="canonical" href="https://example.com/clean/route-arms" />
  <meta property="og:title" content="Route arms canary — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A section index whose layout heading is decided away by the route id, with a card heading before its own."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/route-arms" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Route arms: {data.count} cards</h1>
<Card title={t('Details')}>
  <h3>Steps</h3>
  <Steps />
</Card>

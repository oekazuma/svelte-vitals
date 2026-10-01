<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Account settings for a signed-in user</title>
  <meta property="og:title" content="Account settings" />
  <meta property="og:description" content="Only reachable with a session." />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/gallery/seo/signed-in" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebPage", "name": "Account settings" }
  </script>
</svelte:head>

<h1>Account settings</h1>
<p>Signed in as {data.name}.</p>

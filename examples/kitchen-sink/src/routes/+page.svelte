<svelte:head>
  <title>Kitchen Sink — svelte-vitals example app</title>
  <meta
    name="description"
    content="A real SvelteKit app demonstrating every svelte-vitals rule end to end, plus clean canary routes that must stay finding-free."
  />
  <link rel="canonical" href="https://example.com/" />
  <meta property="og:title" content="Kitchen Sink — svelte-vitals example app" />
  <meta
    property="og:description"
    content="A real SvelteKit app demonstrating every svelte-vitals rule end to end, plus clean canary routes that must stay finding-free."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/" />
</svelte:head>

<header>
  <p>svelte-vitals kitchen sink</p>
</header>

<main>
  <h1>Kitchen Sink</h1>
  <p>A defect gallery and false-positive canary for every svelte-vitals rule.</p>
  <nav aria-label="Sections">
    <ul>
      <li><a href="/gallery">Gallery — one planted defect per rule</a></li>
      <li><a href="/clean">Clean — routes that must stay finding-free</a></li>
    </ul>
  </nav>
</main>

<footer>
  <p>Runs against the workspace's own <code>svelte-vitals</code> and <code>@svelte-vitals/vite</code>.</p>
</footer>

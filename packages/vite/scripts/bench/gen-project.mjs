// Throwaway benchmark fixture generator for Plan 037 (dev-server analysis isolation
// spike, plans/037-design-spike-dev-server-analysis-isolation.md).
// Not part of the shipped package — never imported from packages/vite/src. No tests:
// this is a one-off measurement tool, disposable once the design doc is written
// (see docs/superpowers/specs/2026-07-13-dev-server-analysis-isolation-design.md).
//
// Generates a synthetic SvelteKit-like project with N pages grouped into sections of
// GROUP_SIZE, each section with its own +layout.svelte, so the layout-chain walk
// (packages/cli/src/providers/source/routes.ts chainFiles/resolveRoute) does real
// multi-file resolution work per route instead of flat single-layout inheritance.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GROUP_SIZE = 20;

const LIB_CARD = `<script>
  let { title = '' } = $props();
</script>

<div class="card">
  <h3>{title}</h3>
</div>
`;

const LIB_BADGE = `<script>
  let { label = '' } = $props();
</script>

<span class="badge">{label}</span>
`;

const ROOT_LAYOUT = `<script>
  let { children } = $props();
</script>

<svelte:head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
`;

function groupLayout(g) {
  return `<script>
  let { children } = $props();
</script>

<svelte:head>
  <meta property="og:site_name" content="Section ${g}" />
</svelte:head>

{@render children()}
`;
}

function pageSvelte(g, i) {
  return `<script>
  import Card from '$lib/Card.svelte';
  import Badge from '$lib/Badge.svelte';
</script>

<svelte:head>
  <title>Page ${i} — Section ${g}</title>
  <meta name="description" content="Description for page ${i} in section ${g}, covering realistic body copy length for benchmark purposes." />
  <meta property="og:title" content="Page ${i}" />
  <meta property="og:description" content="Open Graph description for page ${i}." />
  <meta property="og:image" content="https://example.com/og/${g}-${i}.png" />
  <link rel="canonical" href="https://example.com/section-${g}/page-${i}" />
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Page ${i}","author":"Bench"}</script>
</svelte:head>

<h1>Page ${i} heading</h1>
<p>Realistic body copy for page ${i} in section ${g}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.</p>
<h2>Subsection ${i}</h2>
<p>More body copy to approximate a real content page rather than a stub, so parsing has a realistic AST to walk.</p>
<Card title="Card {i}" />
<Badge label="New" />
<img src="/images/hero-${g}-${i}.jpg" width="800" height="400" alt="Hero image for page ${i}" loading="lazy" />
<img src="/images/thumb-${g}-${i}.jpg" width="200" height="200" alt="Thumbnail ${i}" />
`;
}

/**
 * Generate a synthetic SvelteKit-like project with `routeCount` pages at `rootDir`.
 * Mirrors what packages/cli/src/providers/source/project.ts's detectProject needs
 * (package.json with a @sveltejs/kit devDependency, src/routes present).
 */
export function generateProject(rootDir, routeCount) {
  mkdirSync(join(rootDir, 'src', 'lib'), { recursive: true });
  mkdirSync(join(rootDir, 'src', 'routes'), { recursive: true });

  writeFileSync(
    join(rootDir, 'package.json'),
    JSON.stringify(
      {
        name: 'bench-project-fixture',
        private: true,
        type: 'module',
        devDependencies: { '@sveltejs/kit': '^2.0.0', svelte: '^5.0.0' }
      },
      null,
      2
    )
  );
  writeFileSync(join(rootDir, 'src', 'lib', 'Card.svelte'), LIB_CARD);
  writeFileSync(join(rootDir, 'src', 'lib', 'Badge.svelte'), LIB_BADGE);
  writeFileSync(join(rootDir, 'src', 'routes', '+layout.svelte'), ROOT_LAYOUT);

  let written = 0;
  let g = 0;
  while (written < routeCount) {
    const groupDir = join(rootDir, 'src', 'routes', `section-${g}`);
    mkdirSync(groupDir, { recursive: true });
    writeFileSync(join(groupDir, '+layout.svelte'), groupLayout(g));
    for (let i = 0; i < GROUP_SIZE && written < routeCount; i++, written++) {
      const pageDir = join(groupDir, `page-${i}`);
      mkdirSync(pageDir, { recursive: true });
      writeFileSync(join(pageDir, '+page.svelte'), pageSvelte(g, i));
    }
    g++;
  }
}
